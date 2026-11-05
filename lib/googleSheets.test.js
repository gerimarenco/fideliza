import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXTAUTH_SECRET = 'secreto-de-prueba-para-tests-0123456789'
const { cifrar, descifrar } = await import('./cifrado.js')
const { nuevoEstado, verificarEstado } = await import('./estadoOAuth.js')
const { planDeExportacion, filaDeCliente, ENCABEZADOS, urlAutorizacion, ALCANCES } = await import('./googleSheets.js')

test('cifrado: ida y vuelta; sin la clave correcta o alterado, null', () => {
  const c = cifrar('1//refresh-token-secreto')
  assert.ok(!c.includes('refresh-token-secreto'))
  assert.equal(descifrar(c), '1//refresh-token-secreto')
  assert.notEqual(cifrar('x'), cifrar('x'), 'cada cifrado usa otro IV')
  const partes = c.split(':')
  partes[3] = partes[3].slice(0, -2) + (partes[3].endsWith('A') ? 'BB' : 'AA')
  assert.equal(descifrar(partes.join(':')), null, 'dato alterado')
  const original = process.env.NEXTAUTH_SECRET
  process.env.NEXTAUTH_SECRET = 'otro-secreto-distinto-0123456789-abcdef'
  assert.equal(descifrar(c), null, 'otra clave')
  process.env.NEXTAUTH_SECRET = original
  assert.equal(descifrar('basura'), null)
})

test('state del OAuth: solo vale para su negocio, su nonce y dentro de 10 minutos', () => {
  const { state, nonce } = nuevoEstado('negocio-1', 1_000_000)
  assert.equal(verificarEstado(state, nonce, 1_000_000 + 60_000), 'negocio-1')
  assert.equal(verificarEstado(state, 'otro-nonce', 1_000_000), null, 'otro navegador')
  assert.equal(verificarEstado(state, nonce, 1_000_000 + 11 * 60_000), null, 'vencido')
  const [datos, firma] = state.split('.')
  const falso = Buffer.from(JSON.stringify({ n: 'negocio-2', x: 9e15, r: nonce })).toString('base64url')
  assert.equal(verificarEstado(`${falso}.${firma}`, nonce, 1_000_000), null, 'otro negocio con la firma del primero')
  assert.equal(verificarEstado(`${datos}.x${firma.slice(1)}`, nonce, 1_000_000), null, 'firma alterada')
  assert.equal(verificarEstado('', nonce), null)
})

test('pedido de permiso: solo drive.file (más email), offline, con state', () => {
  process.env.GOOGLE_SHEETS_CLIENT_ID = 'cliente-prueba'
  process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'secreto'
  const u = new URL(urlAutorizacion('estado-123'))
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive.file openid email')
  assert.ok(!ALCANCES.some((a) => /spreadsheets|auth\/drive$|drive\.readonly/.test(a)), 'nada de acceso a todas las hojas o todo el Drive')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('state'), 'estado-123')
  assert.equal(u.searchParams.get('redirect_uri'), 'https://retornar.com.ar/api/google-sheets/callback')
})

test('fila de una clienta: columnas ordenadas, sin DNI ni datos sensibles', () => {
  const cliente = { id: 'c1', nombre: 'Lucía Fernández', email: 'lucia@x.com', telefono: '2324555000', createdAt: new Date('2026-10-01T15:00:00Z'), puntos: 4150, fechaNacimiento: new Date('1990-03-07T00:00:00Z'), dni: '30111222', password: 'hash', sexo: 'femenino' }
  const stats = { nivel: { nombre: 'Plata' }, puntosTotalesGanados: 5200, comprasRegistradas: 3, ultimaActividad: new Date('2026-11-01T12:00:00Z') }
  const fila = filaDeCliente(cliente, stats, new Date('2026-11-09T15:30:00Z'))
  assert.deepEqual(ENCABEZADOS, ['ID Retornar', 'Nombre y apellido', 'Email', 'Teléfono', 'Fecha de registro', 'Puntos actuales', 'Nivel', 'Puntos ganados en total', 'Compras registradas', 'Última actividad', 'Cumpleaños (día/mes)', 'Actualizado en Retornar'])
  assert.deepEqual(fila, ['c1', 'Lucía Fernández', 'lucia@x.com', '2324555000', '2026-10-01', 4150, 'Plata', 5200, 3, '2026-11-01', '07/03', '2026-11-09 12:30'])
  assert.ok(!fila.join('|').includes('30111222') && !fila.join('|').includes('hash') && !fila.join('|').includes('femenino') && !fila.join('|').includes('1990'))
})

const fila = (id, puntos = 0) => [id, `Clienta ${id}`, '', '', '', puntos, '', 0, 0, '', '', '']

test('plan: hoja vacía → encabezados y todas las filas en un bloque', () => {
  const p = planDeExportacion({ encabezado: [], ids: [] }, [fila('a'), fila('b')])
  assert.equal(p.escribirEncabezado, true)
  assert.deepEqual(p.bloques.map((b) => [b.desde, b.valores.length]), [[1, 3]])
  assert.deepEqual([p.actualizadas, p.agregadas], [0, 2])
})

test('plan: re-exportar actualiza cada clienta en su fila (aunque se haya reordenado) y agrega las nuevas al final, sin duplicar', () => {
  // La hoja quedó ordenada a mano: b, c (borrada de Retornar), a; y una fila escrita a mano.
  const ids = ['ID Retornar', 'b', 'c', 'a', '', 'nota a mano']
  const p = planDeExportacion({ encabezado: ENCABEZADOS, ids }, [fila('a', 10), fila('b', 20), fila('d', 30)])
  assert.equal(p.escribirEncabezado, false)
  const escritas = Object.fromEntries(p.bloques.flatMap((b) => b.valores.map((v, i) => [b.desde + i, v[0]])))
  assert.deepEqual(escritas, { 2: 'b', 4: 'a', 7: 'd' }, 'b en la fila 2, a en la 4, la nueva al final (después de la fila a mano)')
  assert.deepEqual([p.actualizadas, p.agregadas, p.sinCliente], [2, 1, 2], 'c y la fila a mano quedan sin tocar')
  const otra = planDeExportacion({ encabezado: ENCABEZADOS, ids: [...ids, 'd'] }, [fila('a'), fila('b'), fila('d')])
  assert.equal(otra.agregadas, 0, 'la segunda vez no agrega nada')
})

test('plan: ID repetido en la hoja → se actualiza la primera fila; encabezados cambiados se reponen', () => {
  const p = planDeExportacion({ encabezado: ['ID', 'Nombre'], ids: ['ID', 'a', 'a'] }, [fila('a')])
  assert.equal(p.escribirEncabezado, true)
  const escritas = Object.fromEntries(p.bloques.flatMap((b) => b.valores.map((v, i) => [b.desde + i, v[0]])))
  assert.deepEqual(escritas, { 1: 'ID Retornar', 2: 'a' })
})

test('plan: una fila escrita a mano con la columna A vacía al final no se pisa', () => {
  const ids = ['ID Retornar', 'a', '']
  const p = planDeExportacion({ encabezado: ENCABEZADOS, ids: ['ID Retornar', 'a'], totalFilas: 3 }, [fila('a'), fila('nueva')])
  const escritas = Object.fromEntries(p.bloques.flatMap((b) => b.valores.map((v, i) => [b.desde + i, v[0]])))
  assert.deepEqual(escritas, { 2: 'a', 4: 'nueva' }, 'la nueva va a la fila 4, no a la 3 (la escrita a mano)')
  assert.equal(ids.length, 3)
})
