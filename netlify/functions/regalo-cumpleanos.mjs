// Scheduled Function de Netlify (ver netlify.toml — corre todos los días a
// las 9am de Argentina) que le acredita solos los puntos de regalo de
// cumpleaños a cada cliente cuyo Negocio tenga `regaloCumpleanosPuntos`
// cargado (por ahora solo Peperina) y a quien le toque el cumpleaños hoy.
//
// El horario del cron (12:00 UTC) cae siempre dentro del mismo día de
// calendario en Argentina (UTC-3), así que comparar mes/día en UTC alcanza
// sin necesitar ninguna librería de timezones.
import { prisma } from '../../lib/db.js'
import { enviarEmailPuntosAcreditados } from '../../lib/email.js'
import { esCumpleanosHoy } from '../../lib/cumpleanos.js'

async function regaloCumpleanos() {
  const ahora = new Date()
  const inicioDeHoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))

  const negocios = await prisma.negocio.findMany({
    where: { activo: true, regaloCumpleanosPuntos: { not: null } },
    select: { id: true, nombre: true, regaloCumpleanosPuntos: true },
  })

  let acreditados = 0

  for (const negocio of negocios) {
    const clientes = await prisma.cliente.findMany({
      where: { negocioId: negocio.id, fechaNacimiento: { not: null } },
      select: { id: true, email: true, fechaNacimiento: true },
    })

    const cumpleanieros = clientes.filter((cliente) => esCumpleanosHoy(cliente.fechaNacimiento, ahora))

    for (const cliente of cumpleanieros) {
      // Idempotencia: si la función ya corrió hoy para este cliente (un
      // reintento, o que alguien la haya disparado a mano de nuevo), no
      // sumar los puntos una segunda vez.
      const yaAcreditadoHoy = await prisma.movimientoPuntos.findFirst({
        where: { clienteId: cliente.id, origen: 'cumpleanos', createdAt: { gte: inicioDeHoy } },
      })
      if (yaAcreditadoHoy) continue

      const [clienteActualizado] = await prisma.$transaction([
        prisma.cliente.update({
          where: { id: cliente.id },
          data: { puntos: { increment: negocio.regaloCumpleanosPuntos } },
        }),
        prisma.movimientoPuntos.create({
          data: { clienteId: cliente.id, negocioId: negocio.id, puntos: negocio.regaloCumpleanosPuntos, origen: 'cumpleanos', saldoRestante: negocio.regaloCumpleanosPuntos },
        }),
      ])

      await enviarEmailPuntosAcreditados({
        email: cliente.email,
        puntosAcreditados: negocio.regaloCumpleanosPuntos,
        puntosTotales: clienteActualizado.puntos,
        negocioNombre: negocio.nombre,
      })

      acreditados++
    }
  }

  console.log(`Regalo de cumpleaños: ${acreditados} cliente(s) acreditado(s)`)
  return new Response(JSON.stringify({ acreditados }), { status: 200 })
}

export default regaloCumpleanos

export const config = {
  schedule: '0 12 * * *',
}
