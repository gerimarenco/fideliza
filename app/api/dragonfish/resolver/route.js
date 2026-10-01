import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { calcularPuntosPorCompra } from '@/lib/puntos'
import { acreditarSiEsPrimeraCompraReferida } from '@/lib/referidos'

// El agente local reporta acá el resultado de consultar una factura pendiente
// contra la API REST de Dragon Fish: monto de la venta y el dato de
// identificación del cliente que haya podido sacar de esa respuesta (email
// y/o teléfono — Dragon Fish no maneja el mismo DNI/email que Retornar
// necesariamente, así que puede no encontrar nada; ver docs/ para el estado
// de esa parte).
// Los tres desenlaces que no acreditan puntos (sin_datos, sin_cliente,
// duplicado) comparten el mismo patrón: marcar la factura como procesada
// con ese resultado y devolverlo. Un helper evita que una futura corrección
// de este patrón (ej. loguear algo más) se aplique en dos lugares y se
// olvide en el tercero.
async function marcarFactura(facturaId, codigo, resultado) {
  await prisma.facturaPendiente.update({
    where: { id: facturaId },
    data: { procesado: true, resultado },
  })
  return NextResponse.json({ codigo, procesado: true, resultado })
}

export async function POST(request) {
  const negocio = await autenticarAgente(request)
  if (!negocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Desactivar un negocio (ver app/api/negocios) lo saca de circulación sin
  // borrar su historial — sin este chequeo, el agente local podía seguir
  // acreditando puntos con el mismo token aunque el negocio ya no tuviera
  // que operar.
  if (!negocio.activo) {
    return NextResponse.json({ error: 'Negocio desactivado' }, { status: 403 })
  }

  const body = await request.json()
  const { codigo, monto, email, telefono, sinDatos } = body

  if (!codigo) {
    return NextResponse.json({ error: 'codigo es obligatorio' }, { status: 400 })
  }

  const factura = await prisma.facturaPendiente.findUnique({
    where: { negocioId_codigo: { negocioId: negocio.id, codigo } },
  })

  if (!factura) {
    return NextResponse.json({ error: 'No hay ninguna factura pendiente con ese código' }, { status: 404 })
  }

  // Idempotente: si el agente reintenta un reporte ya procesado (por ejemplo
  // porque no llegó a confirmar la respuesta la primera vez), devolvemos el
  // resultado ya guardado en vez de volver a sumar puntos.
  if (factura.procesado) {
    return NextResponse.json({ codigo, procesado: true, resultado: factura.resultado })
  }

  const emailNormalizado = email?.trim().toLowerCase()
  const telefonoNormalizado = telefono?.trim()

  // Dragon Fish (vía el agente local) puede mandar el monto como número o
  // como string (algunos ERPs viejos serializan los decimales como texto) —
  // hay que aceptar los dos sin caer de nuevo en el bug original de
  // Number(null/''/false) === 0 colando como "monto válido". Por eso NO se
  // usa Number(monto) directo: solo se coacciona si es un number real o un
  // string no vacío, cualquier otra cosa (null, '', false, undefined) queda
  // en NaN y cae en sin_datos. monto < 0 tampoco se procesa, por si Dragon
  // Fish manda una nota de crédito con Total negativo, que /Facturaagrupada
  // agrupa junto con las facturas de venta.
  const montoNumerico = typeof monto === 'number'
    ? monto
    : (typeof monto === 'string' && monto.trim() !== '' ? Number(monto) : NaN)
  if (sinDatos || !Number.isFinite(montoNumerico) || montoNumerico < 0 || (!emailNormalizado && !telefonoNormalizado)) {
    return marcarFactura(factura.id, codigo, 'sin_datos')
  }

  let cliente = await prisma.cliente.findFirst({
    where: {
      negocioId: negocio.id,
      OR: [
        ...(emailNormalizado ? [{ email: emailNormalizado }] : []),
        ...(telefonoNormalizado ? [{ telefono: telefonoNormalizado }] : []),
      ],
    },
  })

  // A propósito no se crea cuenta sola acá aunque la venta traiga email:
  // el negocio no quiere que alguien se entere de que tiene una cuenta en
  // Retornar (y que se le está usando su mail para eso) sin haberse
  // registrado ella misma. Una venta de alguien sin cuenta todavía queda
  // sin acreditar hasta que se registre por su cuenta en /registro/[negocio]
  // — ahí sí, sus próximas compras la van a encontrar por email/teléfono.
  if (!cliente) {
    return marcarFactura(factura.id, codigo, 'sin_cliente')
  }

  const puntos = calcularPuntosPorCompra(montoNumerico, negocio.puntosXPeso)

  // Mismo patrón de idempotencia que Mercado Pago/Tiendanube: WebhookEvento +
  // Cliente.update + MovimientoPuntos.create en una sola transacción, más el
  // FacturaPendiente.procesado de arriba como segunda barrera si el agente
  // reintenta muy rápido (antes de ver la respuesta anterior).
  let clienteActualizado, referido
  try {
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvento.create({
        data: { proveedor: 'dragonfish', referenciaExterna: `${negocio.id}:${codigo}` },
      })
      clienteActualizado = await tx.cliente.update({
        where: { id: cliente.id },
        data: { puntos: { increment: puntos } },
      })
      await tx.movimientoPuntos.create({
        data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'dragonfish', saldoRestante: puntos },
      })
      await tx.facturaPendiente.update({
        where: { id: factura.id },
        data: { procesado: true, resultado: 'acreditado' },
      })
      referido = await acreditarSiEsPrimeraCompraReferida(tx, cliente, negocio)
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return marcarFactura(factura.id, codigo, 'duplicado')
    }
    throw error
  }

  // Si esta fue la primera compra de una clienta referida, su saldo final
  // quedó desactualizado -- se le pagó el bono después de leerlo, dentro
  // de la misma transacción.
  const puntosTotalesFinales = referido
    ? (await prisma.cliente.findUnique({ where: { id: cliente.id }, select: { puntos: true } })).puntos
    : clienteActualizado.puntos

  await enviarEmailPuntosAcreditados({
    email: cliente.email,
    puntosAcreditados: puntos,
    puntosTotales: puntosTotalesFinales,
    negocioNombre: negocio.nombre,
    negocioId: negocio.id,
  })

  if (referido) {
    await enviarEmailPuntosAcreditados({
      email: referido.invitadorEmail,
      puntosAcreditados: referido.puntos,
      puntosTotales: referido.invitadorPuntosTotales,
      negocioNombre: negocio.nombre,
      negocioId: negocio.id,
    })
  }

  return NextResponse.json({ codigo, procesado: true, resultado: 'acreditado', puntosAcreditados: puntos })
}
