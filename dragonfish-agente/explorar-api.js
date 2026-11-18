// Explorar la API de Dragon Fish (SOLO LECTURA): qué operaciones hay para
// clientes (buscar, crear, modificar) y qué campos lleva una ficha.
//
// Lee el swagger (la documentación que publica el propio servicio REST de
// Dragon Fish en esta PC) y muestra rutas, métodos, parámetros y nombres de
// campos. No consulta ni modifica ninguna ficha ni venta, no muestra datos de
// clientas y no se conecta a Retornar.
//
// Uso (en la carpeta del agente):
//   node explorar-api.js
require('dotenv').config({ quiet: true })

const BASE = (process.env.DRAGONFISH_BASE_URL || '').replace(/\/+$/, '')
const ID_CLIENTE = process.env.DRAGONFISH_ID_CLIENTE
const TOKEN = process.env.DRAGONFISH_TOKEN
if (!BASE) {
  console.error('Falta DRAGONFISH_BASE_URL en el .env (correlo en la carpeta del agente).')
  process.exit(1)
}
const origen = new URL(BASE).origin
const headers = { ...(ID_CLIENTE ? { IdCliente: ID_CLIENTE } : {}), ...(TOKEN ? { Authorization: TOKEN } : {}) }

const candidatas = [
  `${BASE}/swagger/docs/v1`, `${origen}/swagger/docs/v1`,
  `${BASE}/swagger/v1/swagger.json`, `${origen}/swagger/v1/swagger.json`,
  `${BASE}/swagger.json`, `${origen}/swagger.json`,
  `${BASE}/api-docs`, `${origen}/api-docs`,
]

async function buscarSwagger() {
  for (const url of candidatas) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) { console.log(`  ${url} → ${res.status}`); continue }
      const json = await res.json().catch(() => null)
      if (json && (json.swagger || json.openapi) && json.paths) return { url, doc: json }
      console.log(`  ${url} → responde, pero no es un swagger`)
    } catch (e) {
      console.log(`  ${url} → no responde (${e.message})`)
    }
  }
  return null
}

function resolver(doc, esquema, vistos = new Set()) {
  if (!esquema) return null
  if (esquema.$ref) {
    if (vistos.has(esquema.$ref)) return { type: 'object', properties: {} }
    vistos.add(esquema.$ref)
    const partes = esquema.$ref.replace(/^#\//, '').split('/')
    let nodo = doc
    for (const p of partes) nodo = nodo?.[p]
    return resolver(doc, nodo, vistos)
  }
  if (esquema.type === 'array' && esquema.items) return { type: 'array', items: resolver(doc, esquema.items, vistos) }
  return esquema
}

function campos(doc, esquema, sangria = '        ') {
  const e = resolver(doc, esquema)
  const obj = e?.type === 'array' ? e.items : e
  if (!obj?.properties) { console.log(`${sangria}(${e?.type || 'sin esquema'})`); return }
  const requeridos = new Set(obj.required || [])
  for (const [nombre, prop] of Object.entries(obj.properties)) {
    const p = resolver(doc, prop) || {}
    const tipo = p.type === 'array' ? `lista de ${resolver(doc, p.items)?.type || 'objetos'}` : (p.type || (p.properties ? 'objeto' : '?'))
    console.log(`${sangria}${nombre}: ${tipo}${p.format ? ` (${p.format})` : ''}${requeridos.has(nombre) ? '  [obligatorio]' : ''}${p.maxLength ? `  [máx. ${p.maxLength}]` : ''}`)
  }
}

async function main() {
  console.log('Buscando el swagger de Dragon Fish...')
  const r = await buscarSwagger()
  if (!r) {
    console.log('\nNo se encontró el swagger en las direcciones habituales. Abrí en el navegador la página del swagger de Dragon Fish y mandá la dirección que aparece arriba.')
    return
  }
  const { url, doc } = r
  console.log(`\nSwagger encontrado: ${url}`)
  console.log(`Versión: ${doc.info?.version || '?'} · ${Object.keys(doc.paths).length} rutas en total`)

  const rutas = Object.entries(doc.paths).filter(([ruta]) => /cliente/i.test(ruta) && !/clientes?(rest|api)/i.test(ruta))
  console.log(`\n=== Rutas de clientes (${rutas.length}) ===`)
  for (const [ruta, ops] of rutas) {
    for (const [metodo, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) continue
      console.log(`\n${metodo.toUpperCase()} ${ruta}${op.summary ? `  — ${op.summary}` : ''}`)
      const params = [...(ops.parameters || []), ...(op.parameters || [])]
      for (const p of params) {
        if (p.in === 'body') { console.log('    Cuerpo:'); campos(doc, p.schema); continue }
        console.log(`    parámetro ${p.name} (${p.in})${p.required ? ' [obligatorio]' : ''}${p.description ? `: ${p.description}` : ''}`)
      }
      const cuerpo = op.requestBody?.content && Object.values(op.requestBody.content)[0]?.schema
      if (cuerpo) { console.log('    Cuerpo:'); campos(doc, cuerpo) }
    }
  }

  // La ficha completa (para saber qué se puede cargar).
  const esquemas = doc.definitions || doc.components?.schemas || {}
  const ficha = Object.keys(esquemas).find((n) => /^cliente$/i.test(n)) || Object.keys(esquemas).find((n) => /cliente/i.test(n) && !/rest|api/i.test(n))
  if (ficha) {
    console.log(`\n=== Campos de la ficha (${ficha}) ===`)
    campos(doc, { $ref: doc.definitions ? `#/definitions/${ficha}` : `#/components/schemas/${ficha}` }, '    ')
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
