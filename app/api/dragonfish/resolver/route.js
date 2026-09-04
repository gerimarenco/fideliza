import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'
import { hashPassword } from '@/lib/password'
import { enviarEmailBienvenida } from '@/lib/email'

// El agente local reporta acá el resultado de consultar una factura pendiente
// contra la API REST de Dragon Fish: monto de la venta y el dato de
// identificación del cliente que haya podido sacar de esa respuesta (email
// y/o teléfono — Dragon Fish no maneja el mismo DNI/email que Fideliza
// necesariamente, así que puede no encontrar nada; ver docs/ para el estado
// de esa parte).
export async function POST(request) {
  const negocio = await autenticarAgente(request)
  if (!negocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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

  // Number.isFinite (sin coaccionar con Number()) para que null/''/false no
  // cuelen como monto 0 — y monto < 0 para no acreditar (ni descontar)
  // puntos si Dragon Fish llega a mandar una nota de crédito con Total
  // negativo, que /Facturaagrupada agrupa junto con las facturas de venta.
  if (sinDatos || !Number.isFinite(monto) || monto < 0 || (!emailNormalizado && !telefonoNormalizado)) {
    await prisma.facturaPendiente.update({
      where: { id: factura.id },
      data: { procesado: true, resultado: 'sin_datos' },
    })
    return NextResponse.json({ codigo, procesado: true, resultado: 'sin_datos' })
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
      await prisma.facturaPendiente.update({
        where: { id: factura.id },
        data: { procesado: true, resultado: 'sin_cliente' },
      })
      return NextResponse.json({ codigo, procesado: true, resultado: 'sin_cliente' })
    }

    // Cliente no registrado en Fideliza: se crea la cuenta sola a partir de
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
        await prisma.facturaPendiente.update({
          where: { id: factura.id },
          data: { procesado: true, resultado: 'sin_cliente' },
        })
        return NextResponse.json({ codigo, procesado: true, resultado: 'sin_cliente' })
      }
      throw error
    }
  }

  const puntos = Math.floor(Number(monto) / negocio.puntosXPeso)

  // Mismo patrón de idempotencia que Mercado Pago/Tiendanube: WebhookEvento +
  // Cliente.update + MovimientoPuntos.create en una sola transacción, más el
  // FacturaPendiente.procesado de arriba como segunda barrera si el agente
  // reintenta muy rápido (antes de ver la respuesta anterior).
  try {
    await prisma.$transaction([
      prisma.webhookEvento.create({
        data: { proveedor: 'dragonfish', referenciaExterna: `${negocio.id}:${codigo}` },
      }),
      prisma.cliente.update({
        where: { id: cliente.id },
        data: { puntos: { increment: puntos } },
      }),
      prisma.movimientoPuntos.create({
        data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'dragonfish' },
      }),
      prisma.facturaPendiente.update({
        where: { id: factura.id },
        data: { procesado: true, resultado: 'acreditado' },
      }),
    ])
  } catch (error) {
    if (error.code === 'P2002') {
      await prisma.facturaPendiente.update({
        where: { id: factura.id },
        data: { procesado: true, resultado: 'duplicado' },
      })
      return NextResponse.json({ codigo, procesado: true, resultado: 'duplicado' })
    }
    throw error
  }

  if (passwordGenerada) {
    await enviarEmailBienvenida({ email: cliente.email, passwordGenerada, negocioNombre: negocio.nombre })
  }

  return NextResponse.json({ codigo, procesado: true, resultado: 'acreditado', puntosAcreditados: puntos })
}
