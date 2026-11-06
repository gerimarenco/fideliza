// Simulación de la API de Tiendanube para pruebas locales: las órdenes salen
// de un archivo que controla el test. Todo lo demás pasa al fetch real.
//   tn-ordenes.json          { "<id>": orden } (con store_id, solo se listan en esa tienda)
//   tn-ordenes-control.json  { fallar: { "<id>": n } } → la orden responde 503 n veces
//   tn-webhooks.json         suscripciones de webhooks de la tienda (GET/POST/PUT /webhooks)
import fs from 'node:fs'
import { DIR } from '../estado.mjs'
const ARCHIVO = `${DIR}/tn-ordenes.json`
const CONTROL = `${DIR}/tn-ordenes-control.json`
const WEBHOOKS = `${DIR}/tn-webhooks.json`
const leer = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d)
const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const fetchReal = globalThis.fetch
globalThis.fetch = async (url, opciones = {}) => {
  const u = typeof url === 'string' ? url : url?.url
  const una = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/(\d+)\/orders\/(\d+)$/)
  if (una) {
    const control = leer(CONTROL, {})
    if (control.fallar?.[una[2]] > 0) {
      control.fallar[una[2]]--
      fs.writeFileSync(CONTROL, JSON.stringify(control))
      return json({ code: 503, message: 'Service Unavailable' }, 503)
    }
    const orden = leer(ARCHIVO, {})[una[2]]
    return orden ? json(orden) : json({}, 404)
  }
  const lista = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/(\d+)\/orders\?(.+)$/)
  if (lista) {
    const q = new URLSearchParams(lista[2])
    const min = q.get('updated_at_min') ? new Date(q.get('updated_at_min')) : null
    const max = q.get('updated_at_max') ? new Date(q.get('updated_at_max')) : null
    const todas = Object.values(leer(ARCHIVO, {})).filter((o) => {
      const act = new Date(o.updated_at || o.created_at || 0)
      if (o.store_id != null && String(o.store_id) !== lista[1]) return false // órdenes de otra tienda
      return (!q.get('payment_status') || o.payment_status === q.get('payment_status')) && (!min || act >= min) && (!max || act <= max)
    })
    const pp = Number(q.get('per_page') || 30)
    const pagina = Number(q.get('page') || 1)
    const trozo = todas.slice((pagina - 1) * pp, pagina * pp)
    return pagina > 1 && !trozo.length ? json({ code: 404, message: 'Last page is 1' }, 404) : json(trozo)
  }
  const wh = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/(\d+)\/webhooks(?:\/(\d+))?$/)
  if (wh) {
    const lista = leer(WEBHOOKS, [])
    const metodo = opciones.method || 'GET'
    if (metodo === 'GET') return json(lista)
    const cuerpo = JSON.parse(opciones.body || '{}')
    if (metodo === 'POST') {
      const nuevo = { id: lista.length + 1, ...cuerpo, created_at: new Date().toISOString() }
      fs.writeFileSync(WEBHOOKS, JSON.stringify([...lista, nuevo]))
      return json(nuevo, 201)
    }
    if (metodo === 'PUT') {
      const i = lista.findIndex((w) => String(w.id) === wh[2])
      if (i < 0) return json({}, 404)
      lista[i] = { ...lista[i], ...cuerpo }
      fs.writeFileSync(WEBHOOKS, JSON.stringify(lista))
      return json(lista[i])
    }
  }
  return fetchReal(url, opciones)
}
