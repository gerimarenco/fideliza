import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'
import { hashPassword } from '@/lib/password'
import { enviarEmailBienvenida, enviarEmailPuntosAcreditados } from '@/lib/email'

// El agente local reporta acá el resultado de consultar una factura pendiente
// contra la API REST de Dragon Fish: monto de la venta y el dato de
// identificación del cliente que haya podido sacar de esa respuesta (email
// y/o teléfono — Dragon Fish no maneja el mismo DNI/email que Retornar
// necesariamente, así que puede no encontrar nada; ver docs/ para el estado
// de esa parte).
// Los cuatro desenlaces que no acreditan puntos (sin_datos, sin_cliente x2,
// duplicado) comparten el mismo patrón: marcar la factura como procesada
// con ese resultado y devolverlo. Un helper evita que una futura corrección
// de este patrón (ej. loguear algo más) se aplique en tres lugares y se
// olvide en el cuarto.
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

  let passwordGenerada
  if (!cliente) {
    // Sin email no hay con qué loguearse — no se puede crear cuenta, solo
    // queda identificar al cliente por teléfono si ya estaba registrado.
    if (!emailNormalizado) {
      return marcarFactura(factura.id, codigo, 'sin_cliente')
    }

    // Cliente no registrado en Retornar: se crea la cuenta sola a partir de
    // los datos de la venta, con una contraseña generada que se manda por
    // mail (ver lib/email.js) — es la única forma de que se entere, porque
    // nadie está mirando la pantalla cuando llega este webhook.
    try {
      passwordGenerada = Math.random().toString(36).slice(-8)
      cliente = await prisma.cliente.create({
        data: {
          email: emailNormalizado,
          telefono: telefonoNormalizado || null,
          password: await hashPassword(passwordGenerada),
          negocioId: negocio.id,
          puntos: 0,
        },
      })
    } catch (error) {
      // El email es único en toda la base: si ya existe (de otro negocio,
      // o una carrera con otro reporte del agente), no se puede crear —
      // se deja como sin_cliente en vez de romper el flujo.
      if (error.code === 'P2002') {
        return marcarFactura(factura.id, codigo, 'sin_cliente')
      }
      throw error
    }
  }

  const puntos = Math.floor(montoNumerico / negocio.puntosXPeso)

  // Mismo patrón de idempotencia que Mercado Pago/Tiendanube: WebhookEvento +
  // Cliente.update + MovimientoPuntos.create en una sola transacción, más el
  // FacturaPendiente.procesado de arriba como segunda barrera si el agente
  // reintenta muy rápido (antes de ver la respuesta anterior).
  let clienteActualizado
  try {
    [, clienteActualizado] = await prisma.$transaction([
      prisma.webhookEvento.create({
        data: { proveedor: 'dragonfish', referenciaExterna: `${negocio.id}:${codigo}` },
      }),
      prisma.cliente.update({
        where: { id: cliente.id },
        data: { puntos: { increment: puntos } },
      }),
      prisma.movimientoPuntos.create({
        data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'dragonfish', saldoRestante: puntos },
      }),
      prisma.facturaPendiente.update({
        where: { id: factura.id },
        data: { procesado: true, resultado: 'acreditado' },
      }),
    ])
  } catch (error) {
    if (error.code === 'P2002') {
      return marcarFactura(factura.id, codigo, 'duplicado')
    }
    throw error
  }

  // Con cuenta nueva se manda un solo mail combinado (bienvenida + puntos
  // de esta compra); con cliente ya existente, el aviso de puntos solo.
  if (passwordGenerada) {
    await enviarEmailBienvenida({
      email: cliente.email,
      passwordGenerada,
      puntosAcreditados: puntos,
      puntosTotales: clienteActualizado.puntos,
      negocioNombre: negocio.nombre,
    })
  } else {
    await enviarEmailPuntosAcreditados({
      email: cliente.email,
      puntosAcreditados: puntos,
      puntosTotales: clienteActualizado.puntos,
      negocioNombre: negocio.nombre,
    })
  }

  return NextResponse.json({ codigo, procesado: true, resultado: 'acreditado', puntosAcreditados: puntos })
}
