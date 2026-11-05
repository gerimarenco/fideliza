import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { premioGeneraCupon, generarCuponDeCanje, codigoPrevistoDeCanje, verificarPremioEnTienda } from '@/lib/cuponCanje'
import { beneficioDePremio } from '@/lib/guiaCupon'
import { enviarEmailCanje } from '@/lib/email'

// Descuenta `cantidad` puntos de los lotes de MovimientoPuntos más viejos
// del cliente que todavía tengan saldo vivo (FIFO), para que el vencimiento
// a los 6 meses (ver netlify/functions/vencimiento-puntos.mjs) sepa cuánto
// de cada compra sigue sin usarse. No es la fuente de verdad del saldo total
// —eso sigue siendo Cliente.puntos, ya protegido contra condiciones de
// carrera arriba— así que si un cliente tiene puntos de antes de este
// campo existir (sin lotes registrados), esta consumición simplemente no
// encuentra nada para descontar y no pasa nada: esos puntos viejos quedan
// sin trackear y nunca vencen, no hay forma de reconstruir su fecha real.
async function consumirPuntosFifo(tx, clienteId, cantidad) {
  const lotes = await tx.movimientoPuntos.findMany({
    where: { clienteId, saldoRestante: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })

  let restante = cantidad
  for (const lote of lotes) {
    if (restante <= 0) break
    const consumido = Math.min(lote.saldoRestante, restante)
    await tx.movimientoPuntos.update({
      where: { id: lote.id },
      data: { saldoRestante: { decrement: consumido } },
    })
    restante -= consumido
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')

  if (!negocioId) {
    return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  }

  if (session.user.role === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))
  const where = { premio: { negocioId } }

  const [total, items] = await Promise.all([
    prisma.canje.count({ where }),
    prisma.canje.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        entregado: true,
        tiendanubeCuponCodigo: true,
        tiendanubeCuponError: true,
        premioNombre: true,
        puntosUsados: true,
        cuponEstado: true,
        cuponVerificadoEn: true,
        cuponUsadoEn: true,
        cliente: { select: { id: true, nombre: true, email: true } },
        premio: { select: { id: true, nombre: true, puntos: true, emoji: true } },
      }
    })
  ])

  // El nombre y los puntos que se ven son los del momento del canje (si el
  // canje los tiene guardados), no los del premio editado después.
  for (const canje of items) {
    canje.premio = { ...canje.premio, nombre: canje.premioNombre ?? canje.premio.nombre, puntos: canje.puntosUsados ?? canje.premio.puntos }
  }

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}

const CLAVE_VALIDA = /^[A-Za-z0-9-]{8,100}$/

// El detalle del error del cupón (puede nombrar un código que hay que
// desactivar a mano) se ve solo en el historial de canjes del negocio; quien
// canjea recibe un aviso genérico.
const errorParaRespuesta = (error) => (error ? 'No se pudo generar el cupón automáticamente' : error)

// Respuesta a un canje repetido: los mismos datos que el canje original, sin
// tocar nada. Si la clave es de otro canje (otra clienta u otro premio), se
// rechaza: no se reutiliza una confirmación para otra cosa.
function respuestaCanjeRepetido(previo, clienteId, premio) {
  if (previo.clienteId !== clienteId || previo.premioId !== premio.id) {
    return NextResponse.json({ error: 'Esta confirmación ya se usó para otro canje' }, { status: 409 })
  }
  // cuponCodigoPrevisto no se devuelve: el código solo se muestra cuando
  // Tiendanube confirmó el cupón (tiendanubeCuponCodigo).
  const { cuponCodigoPrevisto: _previsto, ...datosPrevio } = previo
  return NextResponse.json({
    ...datosPrevio,
    tiendanubeCuponError: errorParaRespuesta(previo.tiendanubeCuponError),
    tiendanubeProductoUrl: premio.tiendanubeProductoUrl,
    repetido: true,
    // El primer pedido todavía está generando el cupón.
    cuponPendiente: premioGeneraCupon(premio) && !previo.tiendanubeCuponCodigo && !previo.tiendanubeCuponError,
  })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { premioId } = body
  // Un cliente solo puede canjear para sí mismo, nunca en nombre de otro.
  const clienteId = session.user.role === 'cliente' ? session.user.id : body.clienteId

  if (!clienteId || !premioId || typeof premioId !== 'string') {
    return NextResponse.json({ error: 'premioId y clienteId son obligatorios' }, { status: 400 })
  }

  const premio = await prisma.premio.findUnique({
    where: { id: premioId },
    include: { negocio: { select: { activo: true, nombre: true, slug: true } } },
  })

  // Un negocio desactivado (ver app/api/negocios) no debería seguir dejando
  // canjear puntos, aunque el premio en sí siga marcado activo.
  if (!premio || !premio.activo || !premio.negocio.activo) {
    return NextResponse.json({ error: 'Este premio ya no está disponible' }, { status: 400 })
  }

  // Un negocio solo puede canjear premios propios para clientes propios —
  // antes alcanzaba con estar logueado como negocio y mandar cualquier
  // premioId/clienteId por fuera de la UI (que hoy no expone este camino,
  // pero el endpoint no lo impedía).
  if (session.user.role === 'negocio') {
    if (premio.negocioId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { negocioId: true } })
    if (!cliente || cliente.negocioId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  } else if (session.user.role === 'cliente') {
    // Sin esto, un cliente logueado podía canjear el premio de CUALQUIER
    // negocio (no solo el suyo) mandando ese premioId por fuera de la UI —
    // se le descontaban sus propios puntos, pero el canje y, desde el
    // Grupo 7, el cupón de Tiendanube se generaban contra un negocio con el
    // que esa clienta no tiene ninguna relación.
    const clientePropio = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { negocioId: true } })
    if (!clientePropio || clientePropio.negocioId !== premio.negocioId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  } else if (session.user.role === 'admin') {
    // El admin puede canjear en nombre de cualquiera, pero siempre un premio
    // del mismo negocio que la clienta: si no, el canje (y el cupón) quedaba
    // registrado contra un negocio con el que ella no tiene relación.
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { negocioId: true } })
    if (!cliente || cliente.negocioId !== premio.negocioId) {
      return NextResponse.json({ error: 'La clienta no pertenece al negocio de este premio' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Clave de idempotencia (ver Canje.claveIdempotencia): el panel manda una
  // por cada confirmación. Si ya hay un canje con esa clave, es el mismo
  // pedido repetido (doble clic, reintento): se devuelve ese canje sin
  // descontar puntos ni generar otro cupón. Es opcional para no romper a
  // quien llame sin ella.
  let clave = null
  if (body.claveIdempotencia != null) {
    if (typeof body.claveIdempotencia !== 'string' || !CLAVE_VALIDA.test(body.claveIdempotencia)) {
      return NextResponse.json({ error: 'Clave de confirmación inválida' }, { status: 400 })
    }
    clave = body.claveIdempotencia
    const previo = await prisma.canje.findUnique({ where: { claveIdempotencia: clave } })
    if (previo) return respuestaCanjeRepetido(previo, clienteId, premio)
  }

  // Premio-producto: antes de descontar puntos, que se pueda comprar hoy en
  // la tienda (con stock y publicado). Si no, no se descuenta nada.
  const enTienda = await verificarPremioEnTienda(premio)
  if (enTienda.error) {
    return NextResponse.json({ error: enTienda.error }, { status: enTienda.status })
  }

  try {
    // updateMany con el saldo en el WHERE: Postgres serializa los UPDATE
    // concurrentes sobre la misma fila, así que si dos canjes llegan al
    // mismo tiempo, el segundo recién evalúa "puntos >= premio.puntos"
    // después de que el primero ya haya confirmado su descuento. Sin esto
    // (leer puntos y decidir aparte, en un paso separado del UPDATE), dos
    // pedidos simultáneos podían pasar los dos la validación antes de que
    // cualquiera descontara, dejando al cliente con saldo negativo.
    const canje = await prisma.$transaction(async (tx) => {
      const { count } = await tx.cliente.updateMany({
        where: { id: clienteId, puntos: { gte: premio.puntos } },
        // El canje reinicia la alerta de canje de las empleadas (ver
        // lib/alertaCanje.js): si vuelve a llegar al premio, se avisa de nuevo.
        data: { puntos: { decrement: premio.puntos }, alertaContactadaEn: null, alertaContactadaPuntos: null }
      })

      if (count === 0) {
        throw new Error('PUNTOS_INSUFICIENTES')
      }

      await consumirPuntosFifo(tx, clienteId, premio.puntos)

      const creado = await tx.canje.create({
        data: {
          clienteId,
          premioId,
          claveIdempotencia: clave,
          premioNombre: premio.nombre,
          puntosUsados: premio.puntos,
          premioBeneficio: beneficioDePremio(premio),
        },
      })
      // El código del cupón se fija ahora, antes de pedírselo a Tiendanube
      // (ver Canje.cuponCodigoPrevisto).
      if (!premioGeneraCupon(premio)) return creado
      return tx.canje.update({ where: { id: creado.id }, data: { cuponCodigoPrevisto: codigoPrevistoDeCanje(creado.id, premio) } })
    })

    // El cupón de Tiendanube se genera después de confirmar el canje, nunca
    // adentro de la transacción de arriba: es una llamada HTTP externa, y si
    // fallara no tiene sentido revertir el descuento de puntos ya
    // confirmado (mismo criterio que enviarEmailPuntosAcreditados en los
    // webhooks: un problema en el paso externo no le cuesta el canje a la
    // clienta, solo se guarda para que el negocio lo resuelva a mano).
    let cuponCodigo, cuponError
    if (premioGeneraCupon(premio)) {
      const resultadoCupon = await generarCuponDeCanje(premio, canje, { producto: enTienda.producto })
      cuponCodigo = resultadoCupon.cuponCodigo
      cuponError = resultadoCupon.cuponError

      // Igual que arriba: si esto llegara a fallar (ej. un problema
      // transitorio de conexión justo acá), el canje ya está confirmado y
      // los puntos ya se descontaron — no hay que tirar un 500 por esto,
      // solo queda sin guardar el resultado del cupón para consulta
      // posterior (el código sigue siendo válido si se llegó a crear).
      try {
        await prisma.canje.update({
          where: { id: canje.id },
          data: { tiendanubeCuponCodigo: cuponCodigo, tiendanubeCuponError: cuponError },
        })
      } catch (error) {
        console.error('No se pudo guardar el resultado del cupón en el canje', canje.id, error)
      }
    }

    // Se relee el saldo final después de la transacción (en vez de calcularlo
    // a mano acá) para que el mail siempre muestre el número real, incluso
    // si algún otro canje o compra concurrente ya lo modificó entre medio.
    const clienteFinal = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { email: true, puntos: true } })
    await enviarEmailCanje({
      email: clienteFinal.email,
      premioNombre: premio.nombre,
      puntosUsados: premio.puntos,
      puntosRestantes: clienteFinal.puntos,
      negocioNombre: premio.negocio.nombre,
      negocioId: premio.negocioId,
      cuponCodigo,
      tiendanubeProductoUrl: premio.tiendanubeProductoUrl,
      // El link del mail va a la página intermedia del premio (consulta el
      // stock), si el premio tiene producto y el negocio tiene slug.
      enlaceProducto: premio.tiendanubeProductoId && premio.negocio.slug ? `/club/${encodeURIComponent(premio.negocio.slug)}/producto/${encodeURIComponent(premio.id)}` : null,
    })

    const { cuponCodigoPrevisto: _codigoPrevisto, ...datosCanje } = canje
    return NextResponse.json({ ...datosCanje, tiendanubeCuponCodigo: cuponCodigo, tiendanubeCuponError: errorParaRespuesta(cuponError), tiendanubeProductoUrl: premio.tiendanubeProductoUrl })
  } catch (error) {
    if (error.message === 'PUNTOS_INSUFICIENTES') {
      return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 })
    }
    // Dos pedidos con la misma clave al mismo tiempo: el segundo choca con
    // el índice único al crear el canje y su transacción se deshace entera
    // (incluido el descuento de puntos); se responde con el canje del primero.
    if (clave && error.code === 'P2002') {
      const previo = await prisma.canje.findUnique({ where: { claveIdempotencia: clave } })
      if (previo) return respuestaCanjeRepetido(previo, clienteId, premio)
    }
    throw error
  }
}
