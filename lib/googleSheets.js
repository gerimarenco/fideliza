// Exportar los clientes de un negocio a una hoja de Google Sheets (panel →
// Exportar clientes). Cada negocio conecta su propia cuenta de Google con
// OAuth; Retornar pide solo el permiso `drive.file` (no sensible según
// Google): ve y edita únicamente las hojas que crea o que el negocio elige
// con el selector de Google, nunca el resto de su Drive. El token de
// actualización se guarda cifrado (lib/cifrado.js) y nunca sale del servidor.
//
// La hoja: una pestaña "Clientes" con columnas fijas (COLUMNAS). Cada
// clienta se identifica por su ID interno (columna A): al volver a exportar
// se actualiza su fila (donde esté, aunque se haya reordenado la hoja) y las
// nuevas se agregan al final. No se borran filas, no se tocan las columnas
// que el negocio agregue a la derecha ni las filas que no son de clientas
// actuales, y se escribe solo el valor (los formatos de la hoja quedan). Se
// escribe en modo RAW: un texto que empiece con "=" nunca se toma como
// fórmula. Sin DNI, contraseña, género ni año de nacimiento.
import { urlBase } from './urlBase.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
export const ALCANCES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email']
export const PESTANA = 'Clientes'

// Credenciales (variables de entorno, ver docs/lanzamiento/google-sheets.md).
// Se puede usar un cliente OAuth propio para Sheets o el del login con Google.
export function configGoogle() {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || ''
  return {
    clientId,
    clientSecret,
    configurada: Boolean(clientId && clientSecret && process.env.NEXTAUTH_SECRET),
    // Para elegir una hoja existente con el selector de Google (Picker).
    pickerApiKey: process.env.GOOGLE_PICKER_API_KEY || '',
    pickerAppId: process.env.GOOGLE_CLOUD_PROJECT_NUMBER || '',
  }
}

export const urlRedireccion = () => `${urlBase()}/api/google-sheets/callback`

export function urlAutorizacion(state) {
  const { clientId } = configGoogle()
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: urlRedireccion(),
    response_type: 'code',
    scope: ALCANCES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${q}`
}

async function pedirToken(parametros) {
  const { clientId, clientSecret } = configGoogle()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...parametros }),
    signal: AbortSignal.timeout(15000),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(`Google respondió ${res.status} al pedir el token: ${datos.error || ''}`)
    error.codigo = datos.error === 'invalid_grant' ? 'TOKEN_INVALIDO' : 'GOOGLE_ERROR'
    throw error
  }
  return datos
}

// Email de la cuenta conectada, del id_token que devuelve el endpoint de
// tokens de Google (respuesta directa por HTTPS, no hace falta verificar la
// firma para mostrarlo en el panel).
function emailDeIdToken(idToken) {
  try {
    return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')).email || null
  } catch {
    return null
  }
}

// Vuelta del OAuth: cambia el código por los tokens. Exige el permiso
// drive.file y un token de actualización (para exportar más adelante).
export async function canjearCodigo(code) {
  const datos = await pedirToken({ code, grant_type: 'authorization_code', redirect_uri: urlRedireccion() })
  const alcances = String(datos.scope || '').split(/\s+/)
  if (!alcances.includes('https://www.googleapis.com/auth/drive.file')) {
    const error = new Error('La cuenta no dio permiso para crear y editar la hoja')
    error.codigo = 'SIN_PERMISO'
    throw error
  }
  if (!datos.refresh_token) {
    const error = new Error('Google no devolvió el token de actualización')
    error.codigo = 'SIN_REFRESH'
    throw error
  }
  return { refreshToken: datos.refresh_token, accessToken: datos.access_token, email: emailDeIdToken(datos.id_token) }
}

export async function accessToken(refreshToken) {
  const datos = await pedirToken({ refresh_token: refreshToken, grant_type: 'refresh_token' })
  return { token: datos.access_token, venceEn: Date.now() + (Number(datos.expires_in) || 3600) * 1000 }
}

// Revoca el permiso en Google (al desconectar). Si falla, la conexión se
// borra igual de Retornar; el negocio puede quitar el acceso desde su cuenta.
export async function revocar(token) {
  try {
    const res = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000) })
    return res.ok
  } catch {
    return false
  }
}

async function sheets(token, ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${SHEETS_URL}${ruta}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(`Google Sheets respondió ${res.status}: ${datos?.error?.message || ''}`)
    error.status = res.status
    error.codigo = res.status === 404 || res.status === 403 ? 'HOJA_INACCESIBLE' : 'GOOGLE_ERROR'
    throw error
  }
  return datos
}

export async function crearHoja(token, titulo) {
  const hoja = await sheets(token, '', {
    method: 'POST',
    body: {
      properties: { title: titulo, locale: 'es_AR', timeZone: 'America/Argentina/Buenos_Aires' },
      sheets: [{ properties: { title: PESTANA, gridProperties: { frozenRowCount: 1 } } }],
    },
  })
  return { hojaId: hoja.spreadsheetId, nombre: hoja.properties?.title || titulo }
}

// Datos de una hoja (para comprobar que Retornar puede usarla) y la pestaña
// "Clientes", que se crea si no está (con la primera fila fija).
export async function prepararHoja(token, hojaId) {
  const info = await sheets(token, `/${encodeURIComponent(hojaId)}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title)`)
  let pestana = (info.sheets || []).find((s) => s.properties?.title === PESTANA)?.properties
  if (!pestana) {
    const r = await sheets(token, `/${encodeURIComponent(hojaId)}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ addSheet: { properties: { title: PESTANA, gridProperties: { frozenRowCount: 1 } } } }] },
    })
    pestana = r.replies?.[0]?.addSheet?.properties
  }
  return { hojaId: info.spreadsheetId, nombre: info.properties?.title || '', pestanaId: pestana?.sheetId ?? null }
}

// --- Qué se escribe ---

const fechaIso = (f) => (f ? new Date(f).toISOString().slice(0, 10) : '')
const fechaHora = (f) => new Date(f).toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16)
const cumpleanos = (f) => {
  if (!f) return ''
  const d = new Date(f) // medianoche UTC (ver lib/cumpleanos.js)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// Columnas de la pestaña, en orden. Fechas en formato AAAA-MM-DD (se ordenan
// bien aunque la hoja las tome como texto).
export const COLUMNAS = [
  ['ID Retornar', (c) => c.id],
  ['Nombre y apellido', (c) => c.nombre || ''],
  ['Email', (c) => c.email || ''],
  ['Teléfono', (c) => c.telefono || ''],
  ['Fecha de registro', (c) => fechaIso(c.createdAt)],
  ['Puntos actuales', (c) => c.puntos ?? 0],
  ['Nivel', (c, s) => s?.nivel?.nombre || ''],
  ['Puntos ganados en total', (c, s) => s?.puntosTotalesGanados ?? 0],
  ['Compras registradas', (c, s) => s?.comprasRegistradas ?? 0],
  ['Última actividad', (c, s) => fechaIso(s?.ultimaActividad)],
  ['Cumpleaños (día/mes)', (c) => cumpleanos(c.fechaNacimiento)],
  ['Actualizado en Retornar', (c, s, ahora) => fechaHora(ahora)],
]
export const ENCABEZADOS = COLUMNAS.map(([t]) => t)
const ULTIMA_COLUMNA = String.fromCharCode(64 + COLUMNAS.length) // L

export function filaDeCliente(cliente, stats, ahora = new Date()) {
  return COLUMNAS.map(([, valor]) => valor(cliente, stats, ahora))
}

// Plan de escritura a partir de lo que ya tiene la hoja: `encabezado` (la
// fila 1), `ids` (columna A, fila 1 incluida) y `totalFilas` (cuántas filas
// usa la pestaña en cualquier columna: las nuevas van después de la última,
// así nunca se pisa una fila escrita a mano aunque tenga la columna A vacía).
// Devuelve los bloques a escribir (filas consecutivas juntas) y cuántas se actualizan,
// agregan y quedan sin clienta (filas de clientas borradas o agregadas a mano:
// no se tocan). Si un ID aparece repetido, se actualiza la primera fila.
export function planDeExportacion({ encabezado = [], ids = [], totalFilas = 0 }, filas) {
  const escribirEncabezado = ENCABEZADOS.some((t, i) => String(encabezado[i] ?? '') !== t)
  const filaDeId = new Map()
  let ultimaOcupada = 1
  ids.forEach((valor, i) => {
    const id = String(valor ?? '').trim()
    if (i === 0) return
    if (id) ultimaOcupada = i + 1
    if (id && !filaDeId.has(id)) filaDeId.set(id, i + 1)
  })
  const escrituras = new Map() // número de fila (1 = encabezado) → valores
  if (escribirEncabezado) escrituras.set(1, ENCABEZADOS)
  let actualizadas = 0
  let agregadas = 0
  let siguiente = Math.max(ultimaOcupada, ids.length, totalFilas, 1) + 1
  const idsActuales = new Set()
  for (const fila of filas) {
    const id = String(fila[0])
    idsActuales.add(id)
    if (filaDeId.has(id)) {
      escrituras.set(filaDeId.get(id), fila)
      actualizadas++
    } else {
      escrituras.set(siguiente++, fila)
      agregadas++
    }
  }
  const sinCliente = [...filaDeId.keys()].filter((id) => !idsActuales.has(id)).length
  const numeros = [...escrituras.keys()].sort((a, b) => a - b)
  const bloques = []
  for (const n of numeros) {
    const ultimo = bloques[bloques.length - 1]
    if (ultimo && ultimo.desde + ultimo.valores.length === n) ultimo.valores.push(escrituras.get(n))
    else bloques.push({ desde: n, valores: [escrituras.get(n)] })
  }
  return { bloques, actualizadas, agregadas, sinCliente, escribirEncabezado }
}

// Lee la pestaña entera (solo valores), escribe el plan y, si la pestaña
// estaba vacía, deja la fila de encabezados en negrita.
export async function exportarFilas(token, hojaId, pestanaId, filas) {
  const lectura = await sheets(token, `/${encodeURIComponent(hojaId)}/values:batchGet?ranges=${encodeURIComponent(`'${PESTANA}'`)}&valueRenderOption=UNFORMATTED_VALUE`)
  const valores = lectura.valueRanges?.[0]?.values || []
  const encabezado = valores[0] || []
  const ids = valores.map((f) => f?.[0] ?? '')
  const plan = planDeExportacion({ encabezado, ids, totalFilas: valores.length }, filas)
  if (plan.bloques.length) {
    await sheets(token, `/${encodeURIComponent(hojaId)}/values:batchUpdate`, {
      method: 'POST',
      body: {
        valueInputOption: 'RAW',
        data: plan.bloques.map((b) => ({ range: `'${PESTANA}'!A${b.desde}:${ULTIMA_COLUMNA}${b.desde + b.valores.length - 1}`, majorDimension: 'ROWS', values: b.valores })),
      },
    })
  }
  if (encabezado.length === 0 && pestanaId != null) {
    await sheets(token, `/${encodeURIComponent(hojaId)}:batchUpdate`, {
      method: 'POST',
      body: { requests: [{ repeatCell: { range: { sheetId: pestanaId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }] },
    }).catch(() => {})
  }
  return plan
}

export const urlHoja = (hojaId) => `https://docs.google.com/spreadsheets/d/${encodeURIComponent(hojaId)}/edit`
