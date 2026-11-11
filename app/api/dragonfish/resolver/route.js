import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { normalizarEmail } from '@/lib/identidad'
import { montoDeVenta, nombreDeFicha, codigoDeFicha, celularesDeVenta, dniDeVenta, buscarClientaDeVenta, cuentaPosterior, acreditarVenta } from '@/lib/dragonfishIdentificacion'

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
async function marcarFactura(facturaId, codigo, resultado, datos = {}) {
  await prisma.facturaPendiente.update({
    where: { id: facturaId },
    data: { procesado: true, resultado, ...datos, procesadaEn: new Date() },
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
  const { codigo, sinDatos } = body

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

  // Lo que pudo sacar el agente de la factura y de la ficha del cliente
  // (ver lib/dragonfishIdentificacion.js). El agente viejo manda solo
  // email/telefono; el nuevo, además, telefonos (Movil y Telefono), dni,
  // cuit y el nombre de la ficha.
  const monto = montoDeVenta(body.monto)
  const nombreFicha = nombreDeFicha(body.nombre)
  const codigoFicha = codigoDeFicha(body.codigoFicha)
  const email = normalizarEmail(body.email)
  const celulares = celularesDeVenta(body)
  const dni = dniDeVenta(body)
  // El monto y el nombre quedan guardados para la pantalla "Ventas del
  // local sin identificar" (asignar a mano la que no se pudo reconocer).
  // Si un reporte trae menos datos que uno anterior (por ejemplo, un agente
  // viejo al volver a revisar), se conserva lo que ya estaba guardado.
  const marcar = (resultado, extra = {}) => marcarFactura(factura.id, codigo, resultado, { monto: monto ?? factura.monto, nombreFicha: nombreFicha ?? factura.nombreFicha, codigoFicha: codigoFicha ?? factura.codigoFicha, candidatas: [], ...extra })

  if (sinDatos || monto == null || (!codigoFicha && !email && !celulares.length && !dni)) {
    return marcar('sin_datos')
  }

  // A propósito no se crea cuenta sola acá aunque la venta traiga email:
  // el negocio no quiere que alguien se entere de que tiene una cuenta en
  // Retornar (y que se le está usando su mail para eso) sin haberse
  // registrado ella misma. Una venta de alguien sin cuenta todavía queda
  // sin acreditar hasta que se registre por su cuenta en /registro/[negocio]
  // — ahí sí, sus próximas compras la van a encontrar por email/teléfono/DNI.
  const { cliente, por, ambigua, candidatas } = await buscarClientaDeVenta(prisma, negocio.id, { codigoFicha: codigoFicha ?? factura.codigoFicha, email, celulares, dni })
  if (ambigua) return marcar('ambigua', { candidatas })
  // Sin email, celular ni DNI, y la ficha todavía no se vinculó: "sin datos".
  if (!cliente) return marcar(!email && !celulares.length && !dni ? 'sin_datos' : 'sin_cliente')
  // Compra anterior al registro: no suma (aunque se procese tarde, por
  // ejemplo si el agente estuvo apagado).
  if (cuentaPosterior(cliente, factura)) return marcar('cuenta_posterior', { clienteId: cliente.id, identificadaPor: por })

  const r = await acreditarVenta(prisma, negocio, { ...factura, codigoFicha: codigoFicha ?? factura.codigoFicha, nombreFicha: nombreFicha ?? factura.nombreFicha }, cliente, monto, { por })
  if (r.estado !== 'acreditado') {
    return NextResponse.json({ codigo, procesado: true, resultado: r.estado })
  }
  const referido = r.referido
  const puntos = r.puntos
  const puntosTotalesFinales = r.puntosTotales

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
      motivo: 'referido',
      puntosAcreditados: referido.puntos,
      puntosTotales: referido.invitadorPuntosTotales,
      negocioNombre: negocio.nombre,
      negocioId: negocio.id,
    })
  }

  return NextResponse.json({ codigo, procesado: true, resultado: 'acreditado', puntosAcreditados: puntos })
}
