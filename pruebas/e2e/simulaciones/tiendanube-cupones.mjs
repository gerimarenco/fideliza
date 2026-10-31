// Simula los cupones y productos de la API de Tiendanube (servidor local de
// desarrollo): registra cada cupón creado en un archivo. Nada sale a internet.
// Si el archivo de control dice fallar=true, la creación del cupón responde 500.
import fs from 'node:fs'
import { DIR } from '../estado.mjs'
const CUPONES = `${DIR}/tn-cupones.json`
const CONTROL = `${DIR}/tn-control.json`
const fetchReal = globalThis.fetch
globalThis.fetch = async (url, opciones = {}) => {
  const u = typeof url === 'string' ? url : url?.url
  // Listado de cupones (GET /coupons?...): los creados, con los usos y bajas
  // que indique tn-estado-cupones.json ({ CODIGO: { used, valid, borrado,
  // sinUsed } }). Como la API real: encabezados x-total-count y Link
  // (next/last). tn-control.json puede achicar las páginas (porPagina) o
  // quitar encabezados (sinLink, sinTotal) para probar la paginación.
  const l = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/(\d+)\/coupons\?(.+)$/)
  if (l && (!opciones.method || opciones.method === 'GET')) {
    const lista = fs.existsSync(CUPONES) ? JSON.parse(fs.readFileSync(CUPONES, 'utf8')) : []
    const extra = fs.existsSync(DIR + '/tn-estado-cupones.json') ? JSON.parse(fs.readFileSync(DIR + '/tn-estado-cupones.json', 'utf8')) : {}
    const control = fs.existsSync(CONTROL) ? JSON.parse(fs.readFileSync(CONTROL, 'utf8')) : {}
    if (control.listadoFalla) return new Response('{"error":"simulado"}', { status: 503 })
    if (control.fallaPagina && new URLSearchParams(l[2]).get('page') === String(control.fallaPagina)) return new Response('{"error":"simulado"}', { status: 503 })
    const todos = lista.filter((c) => !(extra[c.code] && extra[c.code].borrado)).map((c, i) => {
      const { sinUsed, borrado, ...resto } = extra[c.code] || {}
      const cupon = { id: i + 1, code: c.code, type: c.type, value: c.value, max_uses: c.max_uses, used: 0, valid: true, end_date: null, ...resto }
      if (sinUsed) delete cupon.used
      return cupon
    })
    const q = new URLSearchParams(l[2])
    const porPagina = Math.min(Number(q.get('per_page')) || 30, control.porPagina || 200), pagina = Number(q.get('page')) || 1
    const ultima = Math.max(1, Math.ceil(todos.length / porPagina))
    const lote = todos.slice((pagina - 1) * porPagina, pagina * porPagina)
    if (pagina > 1 && lote.length === 0) return new Response('{"code":404,"message":"Not Found","description":"Last page is ' + (pagina - 1) + '"}', { status: 404 })
    const headers = { 'Content-Type': 'application/json' }
    if (!control.sinTotal) headers['x-total-count'] = String(todos.length)
    if (!control.sinLink) {
      const enlace = (p) => `<https://api.tiendanube.com/2025-03/${l[1]}/coupons?page=${p}&per_page=${q.get('per_page')}>`
      headers.Link = [pagina < ultima ? `${enlace(pagina + 1)}; rel="next"` : null, `${enlace(ultima)}; rel="last"`].filter(Boolean).join(', ')
    }
    fs.appendFileSync(DIR + '/tn-listado-pedidos.log', u + '\n')
    return new Response(JSON.stringify(lote), { status: 200, headers })
  }
  const m = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/\d+\/(coupons|products\/(\d+))$/)
  if (m) {
    if (m[1] === 'coupons' && opciones.method === 'POST') {
      const control = fs.existsSync(CONTROL) ? JSON.parse(fs.readFileSync(CONTROL, 'utf8')) : {}
      if (control.fallar) return new Response('{"error":"simulado"}', { status: 500 })
      const lista = fs.existsSync(CUPONES) ? JSON.parse(fs.readFileSync(CUPONES, 'utf8')) : []
      const cuerpo = JSON.parse(opciones.body)
      lista.push(cuerpo)
      fs.writeFileSync(CUPONES, JSON.stringify(lista))
      return new Response(JSON.stringify({ id: lista.length, ...cuerpo }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }
    if (m[2]) return new Response(JSON.stringify({ id: Number(m[2]), variants: [{ price: '15000.00' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return fetchReal(url, opciones)
}
