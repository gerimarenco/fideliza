// Simula los cupones y productos de la API de Tiendanube (servidor local de
// desarrollo): registra cada cupón creado en un archivo. Nada sale a internet.
// Si el archivo de control dice fallar=true, la creación del cupón responde 500.
//
// Productos: tn-productos.json ({ "<id>": { variants, published } }); un id
// que no está ahí responde un producto de $15.000 sin control de stock.
// Control: productosFalla=true → la lectura de productos responde 503;
// ignorarProductos=true → la tienda guarda el cupón SIN el campo products
// (como si la API lo ignorara), para probar que Retornar no lo entrega.
// Cupones: GET, DELETE y PUT /coupons/<id> (el id es la posición + 1); los
// borrados quedan con retirado=true y los desactivados con valid=false.
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
    const todos = lista.map((c, i) => ({ c, id: i + 1 })).filter(({ c }) => !c.retirado && !(extra[c.code] && extra[c.code].borrado)).map(({ c, id }) => {
      const { sinUsed, borrado, ...resto } = extra[c.code] || {}
      const cupon = { id, code: c.code, type: c.type, value: c.value, max_uses: c.max_uses, used: 0, valid: c.valid !== false, end_date: null, ...resto }
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
  const m = u && u.match(/^https:\/\/api\.tiendanube\.com\/2025-03\/\d+\/(coupons|coupons\/(\d+)|products\/(\d+))$/)
  if (m) {
    const control = fs.existsSync(CONTROL) ? JSON.parse(fs.readFileSync(CONTROL, 'utf8')) : {}
    const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
    const leer = () => (fs.existsSync(CUPONES) ? JSON.parse(fs.readFileSync(CUPONES, 'utf8')) : [])
    // Como lo devolvería la tienda: products como objetos (o sin products si
    // la tienda "ignora" el campo).
    const comoTienda = (c, id) => {
      const { products, retirado, ...resto } = c
      return { id, ...resto, ...(products && !c.sinProductos ? { products: products.map((p) => ({ id: p })) } : {}) }
    }
    if (m[1] === 'coupons' && opciones.method === 'POST') {
      if (control.fallar) return new Response('{"error":"simulado"}', { status: 500 })
      const lista = leer()
      const cuerpo = JSON.parse(opciones.body)
      if (lista.some((c) => c.code === cuerpo.code && !c.retirado)) return json({ code: ['has already been taken'] }, 422)
      const guardado = control.ignorarProductos ? { ...cuerpo, sinProductos: true } : cuerpo
      lista.push(guardado)
      fs.writeFileSync(CUPONES, JSON.stringify(lista))
      return json(comoTienda(guardado, lista.length), 201)
    }
    if (m[2]) {
      const lista = leer()
      const i = Number(m[2]) - 1
      if (!lista[i] || lista[i].retirado) return json({ code: 404, message: 'Not Found' }, 404)
      if (opciones.method === 'DELETE') {
        if (control.borrarFalla) return json({ error: 'simulado' }, 500)
        lista[i].retirado = true
        fs.writeFileSync(CUPONES, JSON.stringify(lista))
        return new Response('', { status: 200 })
      }
      if (opciones.method === 'PUT') {
        if (control.desactivarFalla) return json({ error: 'simulado' }, 500)
        Object.assign(lista[i], JSON.parse(opciones.body))
        fs.writeFileSync(CUPONES, JSON.stringify(lista))
        return json(comoTienda(lista[i], i + 1))
      }
      return json(comoTienda(lista[i], i + 1))
    }
    if (m[3]) {
      if (control.productosFalla) return json({ error: 'simulado' }, 503)
      const productos = fs.existsSync(DIR + '/tn-productos.json') ? JSON.parse(fs.readFileSync(DIR + '/tn-productos.json', 'utf8')) : {}
      const producto = productos[m[3]]
      if (producto === null) return json({ code: 404, message: 'Not Found' }, 404)
      return json({ id: Number(m[3]), published: true, variants: [{ price: '15000.00' }], ...producto })
    }
  }
  return fetchReal(url, opciones)
}
