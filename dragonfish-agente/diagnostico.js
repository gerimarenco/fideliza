// Diagnóstico de SOLO LECTURA: cómo devuelve Dragon Fish algunas ventas.
//
// Para cuando el agente marca ventas "sin datos" o "sin cliente" y hay que
// ver qué campos trae realmente Dragon Fish. Consulta (solo GET, más el
// /Autenticar que hace el agente al arrancar) la factura y la ficha del
// cliente, y muestra QUÉ CAMPOS hay y de qué tipo, nunca su contenido: ni
// nombres, ni emails, ni teléfonos, ni DNI. No escribe nada en Dragon Fish
// ni le avisa nada a Retornar.
//
// Uso (en la carpeta del agente, con el agente funcionando o no):
//   node diagnostico.js CODIGO1 CODIGO2 ...
// Los códigos son los de la factura (los que aparecen en "Factura <código>:"
// en la ventana del agente).
require('dotenv').config({ quiet: true })

const BASE = (process.env.DRAGONFISH_BASE_URL || '').replace(/\/+$/, '')
const ID_CLIENTE = process.env.DRAGONFISH_ID_CLIENTE
const TOKEN = process.env.DRAGONFISH_TOKEN
const BASE_DE_DATOS = process.env.DRAGONFISH_BASE_DE_DATOS

if (!BASE || !ID_CLIENTE || !TOKEN) {
  console.error('Faltan DRAGONFISH_BASE_URL, DRAGONFISH_ID_CLIENTE o DRAGONFISH_TOKEN en el .env (correlo en la carpeta del agente).')
  process.exit(1)
}
const codigos = process.argv.slice(2).map((c) => c.trim()).filter(Boolean)
if (!codigos.length) {
  console.error('Uso: node diagnostico.js CODIGO1 CODIGO2 ...')
  process.exit(1)
}

const headers = { IdCliente: ID_CLIENTE, Authorization: TOKEN, ...(BASE_DE_DATOS ? { BaseDeDatos: BASE_DE_DATOS } : {}) }

// Tipo de un valor, sin mostrarlo.
function tipo(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `lista de ${v.length}`
  if (typeof v === 'string') return v.trim() ? `texto (${v.trim().length} caracteres)` : 'texto VACÍO'
  if (typeof v === 'number') return 'número'
  if (typeof v === 'object') return `objeto con ${Object.keys(v).length} campos`
  return typeof v
}

// Lista de campos y tipos (hasta 2 niveles), sin valores.
function estructura(obj, sangria = '    ', nivel = 0) {
  if (!obj || typeof obj !== 'object') return
  const entrada = Array.isArray(obj) ? (obj[0] && typeof obj[0] === 'object' ? obj[0] : null) : obj
  if (!entrada) return
  for (const [k, v] of Object.entries(entrada)) {
    console.log(`${sangria}${k}: ${tipo(v)}`)
    if (nivel < 1 && v && typeof v === 'object') estructura(v, sangria + '    ', nivel + 1)
  }
}

const presente = (o, campo) => {
  if (!o || typeof o !== 'object' || !(campo in o)) return 'no viene'
  const v = o[campo]
  if (v === null || v === undefined) return 'viene vacío (null)'
  if (typeof v === 'string') return v.trim() ? 'viene con dato' : 'viene vacío ("")'
  if (typeof v === 'number') return 'viene con dato (número)'
  return `viene como ${tipo(v)}`
}

async function pedir(ruta) {
  const res = await fetch(`${BASE}${ruta}`, { headers })
  let cuerpo = null
  const texto = await res.text()
  try { cuerpo = JSON.parse(texto) } catch { cuerpo = null }
  return { status: res.status, cuerpo, largo: texto.length }
}

async function main() {
  const auth = await fetch(`${BASE}/Autenticar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IdCliente: ID_CLIENTE, JWToken: TOKEN }),
  })
  console.log(`Autenticar: ${auth.status}`)

  for (const codigo of codigos) {
    console.log(`\n=== Factura ${codigo.slice(0, 6)}…${codigo.slice(-4)} (${codigo.length} caracteres)`)
    const f = await pedir(`/Facturaagrupada/${encodeURIComponent(codigo)}/`)
    console.log(`  /Facturaagrupada → respuesta ${f.status}${f.cuerpo === null ? ` (no es JSON, ${f.largo} caracteres)` : ''}`)
    if (!f.cuerpo) continue
    console.log(`  La respuesta es: ${tipo(f.cuerpo)}`)
    const fac = Array.isArray(f.cuerpo) ? f.cuerpo[0] : f.cuerpo
    const total = fac?.Total
    console.log(`  Total: ${presente(fac, 'Total')}${typeof total === 'number' ? ` = ${total}` : typeof total === 'string' && total.trim() ? ` (texto "${total.trim()}")` : ''}`)
    console.log(`  Cliente: ${presente(fac, 'Cliente')}`)
    console.log(`  Email: ${presente(fac, 'Email')}`)
    console.log('  Campos de la factura:')
    estructura(f.cuerpo)

    const cli = fac?.Cliente
    if (typeof cli === 'string' && cli.trim()) {
      const c = await pedir(`/Cliente/${encodeURIComponent(cli.trim())}/`)
      console.log(`  /Cliente → respuesta ${c.status}${c.cuerpo === null ? ` (no es JSON, ${c.largo} caracteres)` : ''}`)
      if (c.cuerpo) {
        const ficha = Array.isArray(c.cuerpo) ? c.cuerpo[0] : c.cuerpo
        for (const campo of ['Nombre', 'PrimerNombre', 'Apellido', 'EMail', 'Email', 'Movil', 'Telefono', 'NroDocumento', 'CUIT']) {
          console.log(`  Ficha ${campo}: ${presente(ficha, campo)}`)
        }
        console.log('  Campos de la ficha:')
        estructura(c.cuerpo)
      }
    } else if (cli && typeof cli === 'object') {
      console.log('  Cliente viene como objeto (el agente espera un código de texto):')
      estructura(cli)
    }
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
