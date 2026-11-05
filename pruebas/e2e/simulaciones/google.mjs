// Simula Google (OAuth y la API de Sheets) en el servidor de desarrollo y en
// el proceso de las pruebas. Nada sale a internet: las hojas viven en
// google-hojas.json y cada pedido queda en google-pedidos.log.
//
// OAuth: el código "codigo-ok" da una cuenta (google-control.json → cuenta,
// por defecto "peperina@gmail.com") con permiso drive.file; "codigo-sin-permiso"
// da una cuenta sin ese permiso. Un token de actualización revocado (desde
// "revocar" o con control.revocados) responde invalid_grant.
// Sheets, como drive.file: una cuenta solo accede a las hojas que la app
// creó con ella o que la persona eligió (hojas[id].elegida = true).
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
import { DIR } from '../estado.mjs'

const HOJAS = `${DIR}/google-hojas.json`
const CONTROL = `${DIR}/google-control.json`
const TOKENS = `${DIR}/google-tokens.json`
const PEDIDOS = `${DIR}/google-pedidos.log`
const leer = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d)
const guardar = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1))
const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const esperar = (ms, signal) => new Promise((ok, falla) => {
  const t = setTimeout(ok, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); falla(signal.reason ?? new Error('aborted')) })
})

const columna = (letras) => [...letras].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
// "'Clientes'!A5:L7" o "'Clientes'!A:A" → { pestana, c1, f1, c2, f2 } (0-based; f2 null = toda la columna)
function rango(texto) {
  const entera = String(texto).match(/^'?([^'!]+)'?$/)
  if (entera) return { pestana: entera[1], c1: 0, f1: 0, c2: 701, f2: null }
  const m = String(texto).match(/^'?([^'!]+)'?!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/)
  if (!m) return null
  return { pestana: m[1], c1: columna(m[2]), f1: m[3] ? Number(m[3]) - 1 : 0, c2: columna(m[4] || m[2]), f2: m[5] ? Number(m[5]) - 1 : (m[3] ? Number(m[3]) - 1 : null) }
}

const fetchReal = globalThis.fetch
globalThis.fetch = async (url, opciones = {}) => {
  const u = typeof url === 'string' ? url : url?.url
  if (!u || !/^https:\/\/(oauth2|sheets)\.googleapis\.com\//.test(u)) return fetchReal(url, opciones)
  const metodo = opciones.method || 'GET'
  const auth = opciones.headers?.Authorization || opciones.headers?.authorization || ''
  fs.appendFileSync(PEDIDOS, `${metodo} ${u.replace(/\?.*$/, '')} ${auth ? 'con-token' : 'sin-token'}\n`)
  const control = leer(CONTROL, {})
  const tokens = leer(TOKENS, { acceso: {}, refresh: {}, revocados: [] })

  // --- OAuth ---
  if (u === 'https://oauth2.googleapis.com/token') {
    const p = new URLSearchParams(String(opciones.body))
    if (!p.get('client_id') || !p.get('client_secret')) return json({ error: 'invalid_client' }, 401)
    if (p.get('grant_type') === 'authorization_code') {
      const code = p.get('code')
      if (code !== 'codigo-ok' && code !== 'codigo-sin-permiso') return json({ error: 'invalid_grant' }, 400)
      const cuenta = control.cuenta || 'peperina@gmail.com'
      const refresh = `rt-secreto-${randomBytes(8).toString('hex')}`
      const acceso = `at-${randomBytes(8).toString('hex')}`
      tokens.refresh[refresh] = cuenta
      tokens.acceso[acceso] = cuenta
      guardar(TOKENS, tokens)
      const idToken = ['x', Buffer.from(JSON.stringify({ email: cuenta })).toString('base64url'), 'firma'].join('.')
      const scope = code === 'codigo-ok' ? 'https://www.googleapis.com/auth/drive.file openid https://www.googleapis.com/auth/userinfo.email' : 'openid https://www.googleapis.com/auth/userinfo.email'
      return json({ access_token: acceso, refresh_token: refresh, id_token: idToken, scope, expires_in: 3599, token_type: 'Bearer' })
    }
    if (p.get('grant_type') === 'refresh_token') {
      const refresh = p.get('refresh_token')
      if (!tokens.refresh[refresh] || tokens.revocados.includes(refresh) || (control.revocados || []).includes(tokens.refresh[refresh])) return json({ error: 'invalid_grant' }, 400)
      const acceso = `at-${randomBytes(8).toString('hex')}`
      tokens.acceso[acceso] = tokens.refresh[refresh]
      guardar(TOKENS, tokens)
      return json({ access_token: acceso, expires_in: 3599, token_type: 'Bearer' })
    }
    return json({ error: 'unsupported_grant_type' }, 400)
  }
  if (u.startsWith('https://oauth2.googleapis.com/revoke')) {
    const token = new URL(u).searchParams.get('token')
    tokens.revocados.push(token)
    guardar(TOKENS, tokens)
    return json({})
  }

  // --- Sheets ---
  const cuenta = tokens.acceso[auth.replace(/^Bearer /, '')]
  if (!cuenta) return json({ error: { code: 401, message: 'Invalid Credentials' } }, 401)
  const hojas = leer(HOJAS, {})
  const m = u.match(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets(?:\/([^/?:]+))?(:batchUpdate|\/values:batchGet|\/values:batchUpdate)?(?:\?(.*))?$/)
  if (!m) return json({ error: { code: 404, message: 'Not found' } }, 404)
  const [, idCodificado, accion, consulta] = m
  const id = idCodificado && decodeURIComponent(idCodificado)
  const cuerpo = opciones.body ? JSON.parse(opciones.body) : {}

  if (!id && metodo === 'POST') {
    const nuevoId = `hoja${randomBytes(15).toString('hex')}`
    const pestana = cuerpo.sheets?.[0]?.properties?.title || 'Hoja 1'
    hojas[nuevoId] = { titulo: cuerpo.properties?.title, cuenta, creadaPorApp: true, pestanas: { [pestana]: { id: 0, filas: [], negrita: false, fijas: cuerpo.sheets?.[0]?.properties?.gridProperties?.frozenRowCount || 0 } }, escrituras: [] }
    guardar(HOJAS, hojas)
    return json({ spreadsheetId: nuevoId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${nuevoId}/edit`, properties: { title: cuerpo.properties?.title }, sheets: [{ properties: { sheetId: 0, title: pestana } }] })
  }
  const hoja = hojas[id]
  // drive.file: solo las hojas de esta cuenta creadas por la app o elegidas.
  if (!hoja || hoja.cuenta !== cuenta || !(hoja.creadaPorApp || hoja.elegida)) {
    return json({ error: { code: hoja ? 403 : 404, message: hoja ? 'The caller does not have permission' : 'Requested entity was not found.' } }, hoja ? 403 : 404)
  }
  if (control.demoraMs) await esperar(control.demoraMs, opciones.signal)

  if (!accion && metodo === 'GET') {
    return json({ spreadsheetId: id, properties: { title: hoja.titulo }, sheets: Object.entries(hoja.pestanas).map(([title, p]) => ({ properties: { sheetId: p.id, title } })) })
  }
  if (accion === ':batchUpdate') {
    const replies = []
    for (const r of cuerpo.requests || []) {
      if (r.addSheet) {
        const pid = Object.keys(hoja.pestanas).length + 100
        hoja.pestanas[r.addSheet.properties.title] = { id: pid, filas: [], negrita: false, fijas: r.addSheet.properties.gridProperties?.frozenRowCount || 0 }
        replies.push({ addSheet: { properties: { sheetId: pid, title: r.addSheet.properties.title } } })
      } else if (r.repeatCell) {
        const p = Object.values(hoja.pestanas).find((x) => x.id === r.repeatCell.range.sheetId)
        if (p && r.repeatCell.cell?.userEnteredFormat?.textFormat?.bold) p.negrita = true
        replies.push({})
      }
    }
    guardar(HOJAS, hojas)
    return json({ replies })
  }
  if (accion === '/values:batchGet') {
    const q = new URLSearchParams(consulta)
    return json({
      valueRanges: q.getAll('ranges').map((r) => {
        const g = rango(r)
        const filas = hoja.pestanas[g.pestana]?.filas || []
        const hasta = g.f2 == null ? filas.length - 1 : g.f2
        const valores = []
        for (let f = g.f1; f <= hasta && f < filas.length; f++) valores.push((filas[f] || []).slice(g.c1, g.c2 + 1))
        while (valores.length && valores[valores.length - 1].every((v) => v === '' || v == null)) valores.pop()
        return { range: r, values: valores }
      }),
    })
  }
  if (accion === '/values:batchUpdate') {
    hoja.escrituras.push(cuerpo.valueInputOption)
    for (const d of cuerpo.data || []) {
      const g = rango(d.range)
      const p = hoja.pestanas[g.pestana]
      d.values.forEach((fila, i) => {
        const f = g.f1 + i
        while (p.filas.length <= f) p.filas.push([])
        fila.forEach((v, j) => {
          while (p.filas[f].length <= g.c1 + j) p.filas[f].push('')
          p.filas[f][g.c1 + j] = v
        })
      })
    }
    guardar(HOJAS, hojas)
    return json({ totalUpdatedRows: (cuerpo.data || []).reduce((t, d) => t + d.values.length, 0) })
  }
  return json({ error: { code: 400, message: 'no simulado' } }, 400)
}
