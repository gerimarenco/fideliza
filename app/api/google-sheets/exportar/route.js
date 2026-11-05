import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { negocioDeSesion, tokenDeConexion } from '@/lib/googleSheetsServidor'
import { prepararHoja, exportarFilas, filaDeCliente, urlHoja } from '@/lib/googleSheets'
import { calcularStatsClientes } from '@/lib/clienteStats'

// Exporta TODAS las clientas del negocio de la sesión a su hoja (ver
// lib/googleSheets.js): actualiza las que ya están (por ID), agrega las
// nuevas, no duplica ni borra. Una exportación a la vez por negocio.
const BLOQUEO_MS = 3 * 60 * 1000

export async function POST() {
  const { negocioId, error } = await negocioDeSesion()
  if (error) return error
  const conexion = await prisma.conexionGoogle.findUnique({ where: { negocioId }, select: { hojaId: true } })
  if (!conexion) return NextResponse.json({ error: 'Conectá tu cuenta de Google primero.' }, { status: 400 })
  if (!conexion.hojaId) return NextResponse.json({ error: 'Elegí o creá la hoja primero.' }, { status: 400 })

  // Bloqueo: dos exportaciones a la vez podrían agregar dos veces a las nuevas.
  const ahora = new Date()
  const { count } = await prisma.conexionGoogle.updateMany({
    where: { negocioId, OR: [{ exportandoDesde: null }, { exportandoDesde: { lt: new Date(ahora.getTime() - BLOQUEO_MS) } }] },
    data: { exportandoDesde: ahora },
  })
  if (count === 0) return NextResponse.json({ error: 'Ya hay una exportación en curso. Esperá a que termine.' }, { status: 409 })

  try {
    const { token, error: errorToken } = await tokenDeConexion(negocioId)
    if (errorToken) return errorToken
    // Solo las clientas de ESTE negocio, sin DNI ni otros datos sensibles.
    const clientes = await prisma.cliente.findMany({
      where: { negocioId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, email: true, telefono: true, createdAt: true, puntos: true, fechaNacimiento: true },
    })
    const stats = await calcularStatsClientes(prisma, clientes)
    const filas = clientes.map((c) => filaDeCliente(c, stats[c.id], ahora))
    const hoja = await prepararHoja(token, conexion.hojaId)
    const plan = await exportarFilas(token, hoja.hojaId, hoja.pestanaId, filas)
    const info = `${plan.actualizadas} actualizadas, ${plan.agregadas} nuevas${plan.sinCliente ? `, ${plan.sinCliente} fila(s) que no son de clientas actuales quedaron sin tocar` : ''}`
    await prisma.conexionGoogle.update({ where: { negocioId }, data: { ultimaExportacionEn: new Date(), ultimaExportacionInfo: info, hojaNombre: hoja.nombre } })
    return NextResponse.json({ total: filas.length, actualizadas: plan.actualizadas, agregadas: plan.agregadas, sinCliente: plan.sinCliente, info, hoja: { id: hoja.hojaId, nombre: hoja.nombre, url: urlHoja(hoja.hojaId) } })
  } catch (e) {
    console.error('Google Sheets: no se pudo exportar', negocioId, e.message)
    if (e.codigo === 'HOJA_INACCESIBLE') return NextResponse.json({ error: 'Retornar ya no tiene acceso a la hoja (¿se borró?). Elegí o creá otra.' }, { status: 400 })
    return NextResponse.json({ error: 'No se pudo exportar a Google Sheets. Probá de nuevo en unos minutos.' }, { status: 503 })
  } finally {
    await prisma.conexionGoogle.updateMany({ where: { negocioId, exportandoDesde: ahora }, data: { exportandoDesde: null } })
  }
}
