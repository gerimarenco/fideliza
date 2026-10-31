// Simulación de la API de Tiendanube para pruebas locales: las órdenes salen
// de un archivo que controla el test. Todo lo demás pasa al fetch real.
import fs from 'node:fs'
import { DIR } from '../estado.mjs'
const ARCHIVO = `${DIR}/tn-ordenes.json`
const fetchReal = globalThis.fetch
globalThis.fetch = async (url, opciones) => {
  const u = typeof url === 'string' ? url : url?.url
  const m = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/(\d+)\/orders\/(\d+)$/)
  if (m) {
    const ordenes = fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) : {}
    const orden = ordenes[m[2]]
    return orden ? new Response(JSON.stringify(orden), { status: 200, headers: { 'Content-Type': 'application/json' } }) : new Response('{}', { status: 404 })
  }
  return fetchReal(url, opciones)
}
