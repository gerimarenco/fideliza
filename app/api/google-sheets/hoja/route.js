import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { negocioDeSesion, tokenDeConexion } from '@/lib/googleSheetsServidor'
import { crearHoja, prepararHoja, urlHoja } from '@/lib/googleSheets'
import { nombreClub } from '@/lib/nombreClub'

// Elegir la hoja donde se exporta:
// { accion: 'crear' } → una hoja nueva "Clientes — Club X" en el Drive del negocio;
// { accion: 'elegir', hojaId } → una existente, elegida con el selector de
//   Google (Picker). Con el permiso drive.file, Retornar solo puede abrir una
//   hoja que el negocio haya elegido ahí: si no, Google responde que no hay
//   acceso y no se guarda.
const ID_HOJA = /^[A-Za-z0-9_-]{20,100}$/

export async function POST(request) {
  const { negocioId, error } = await negocioDeSesion()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  if (body.accion !== 'crear' && body.accion !== 'elegir') return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  if (body.accion === 'elegir' && !ID_HOJA.test(String(body.hojaId || ''))) return NextResponse.json({ error: 'Hoja inválida' }, { status: 400 })

  const { token, error: errorToken } = await tokenDeConexion(negocioId)
  if (errorToken) return errorToken
  try {
    let hojaId
    if (body.accion === 'crear') {
      const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } })
      hojaId = (await crearHoja(token, `Clientes — ${nombreClub(negocio.nombre)}`)).hojaId
    } else {
      hojaId = body.hojaId
    }
    const hoja = await prepararHoja(token, hojaId)
    await prisma.conexionGoogle.update({ where: { negocioId }, data: { hojaId: hoja.hojaId, hojaNombre: hoja.nombre } })
    return NextResponse.json({ hoja: { id: hoja.hojaId, nombre: hoja.nombre, url: urlHoja(hoja.hojaId) } })
  } catch (e) {
    console.error('Google Sheets: no se pudo preparar la hoja', negocioId, e.message)
    if (e.codigo === 'HOJA_INACCESIBLE') return NextResponse.json({ error: 'Retornar no tiene acceso a esa hoja. Elegila con el selector de Google o creá una nueva.' }, { status: 400 })
    return NextResponse.json({ error: 'No se pudo preparar la hoja en Google. Probá de nuevo en unos minutos.' }, { status: 503 })
  }
}
