import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dniDeVenta, celularesDeVenta, montoDeVenta, nombreDeFicha, cuentaPosterior, codigoDeFicha, fichaGenerica } from './dragonfishIdentificacion.js'

const require = createRequire(import.meta.url)
const { identificacionDeVenta, tieneIdentificacion } = require('../dragonfish-agente/identificacion.js')

test('dniDeVenta: DNI de la ficha, o el del medio de un CUIT/CUIL', () => {
  assert.equal(dniDeVenta({ dni: '30.111.222' }), '30111222')
  assert.equal(dniDeVenta({ dni: ' 030111222 ' }), '30111222')
  assert.equal(dniDeVenta({ cuit: '27-30111222-4' }), '30111222')
  assert.equal(dniDeVenta({ dni: '', cuit: '20301112229' }), '30111222')
  assert.equal(dniDeVenta({ cuit: '123' }), null)
  assert.equal(dniDeVenta({}), null)
})

test('celularesDeVenta: Movil y Telefono (agente nuevo) o telefono (agente viejo), sin repetir', () => {
  assert.deepEqual(celularesDeVenta({ telefonos: ['2324-500294', '(02324) 42-1111'], telefono: '2324-500294' }), ['2324500294', '02324421111'])
  assert.deepEqual(celularesDeVenta({ telefono: '+54 9 2324 50-0294' }), ['5492324500294'])
  assert.deepEqual(celularesDeVenta({ telefonos: ['123'] }), [])
})

test('montoDeVenta: número o texto; null, vacío o negativo no valen', () => {
  assert.equal(montoDeVenta(12500.5), 12500.5)
  assert.equal(montoDeVenta('8000'), 8000)
  for (const m of [null, undefined, '', false, 'abc', -100]) assert.equal(montoDeVenta(m), null)
  assert.equal(montoDeVenta(0), 0)
})

test('nombreDeFicha: sin espacios de más, recortado', () => {
  assert.equal(nombreDeFicha('  GONZALEZ   MARIA '), 'GONZALEZ MARIA')
  assert.equal(nombreDeFicha(''), null)
  assert.equal(nombreDeFicha('x'.repeat(200)).length, 120)
})

test('cuentaPosterior: la cuenta se creó después de la venta', () => {
  const venta = { createdAt: new Date('2026-10-15T12:00:00Z') }
  assert.equal(cuentaPosterior({ createdAt: new Date('2026-11-02T00:00:00Z') }, venta), true)
  assert.equal(cuentaPosterior({ createdAt: new Date('2026-09-01T00:00:00Z') }, venta), false)
})

test('agente: junta email, Movil, Telefono, DNI, CUIT y nombre de la ficha de Dragon Fish', () => {
  const d = identificacionDeVenta({ Total: 1000, Cliente: 'C1' }, { EMail: ' ana@x.com ', Movil: '2324-500294', Telefono: '421111', NroDocumento: '30111222', CUIT: '27301112224', PrimerNombre: 'Ana', Apellido: 'Gómez' })
  assert.deepEqual(d, { codigoFicha: 'C1', email: 'ana@x.com', telefono: '2324-500294', telefonos: ['2324-500294', '421111'], dni: '30111222', cuit: '27301112224', nombre: 'Ana Gómez' })
  assert.equal(tieneIdentificacion(d), true)
})

test('agente: el email de la factura tiene prioridad; ficha con solo nombre no identifica', () => {
  assert.equal(identificacionDeVenta({ Email: 'factura@x.com' }, { EMail: 'ficha@x.com' }).email, 'factura@x.com')
  const soloNombre = identificacionDeVenta({ Cliente: 'C2' }, { Nombre: 'PEREZ LAURA' })
  assert.equal(soloNombre.nombre, 'PEREZ LAURA')
  // Con solo nombre, igual se manda el código de la ficha (puede estar vinculada).
  assert.equal(soloNombre.codigoFicha, 'C2')
  assert.equal(tieneIdentificacion(soloNombre), true)
  assert.equal(tieneIdentificacion({ ...soloNombre, codigoFicha: undefined }), false)
  assert.equal(tieneIdentificacion(identificacionDeVenta({}, null)), false)
  assert.equal(identificacionDeVenta({}, { Movil: '  ' }).telefonos.length, 0)
})

test('fichaGenerica: consumidor final, mostrador o sin código no se vinculan a una persona', () => {
  assert.equal(fichaGenerica('PEREZ LAURA', 'C123'), false)
  for (const [nombre, codigo] of [['CONSUMIDOR FINAL', 'CF'], ['Mostrador', 'M1'], ['Cliente', 'X'], ['', 'C9'], ['PEREZ LAURA', ''], ['PEREZ LAURA', '0000'], ['Varios', 'V']]) {
    assert.equal(fichaGenerica(nombre, codigo), true, `${nombre}/${codigo}`)
  }
  assert.equal(codigoDeFicha('  C123 '), 'C123')
  assert.equal(codigoDeFicha(''), null)
  assert.equal(codigoDeFicha('x'.repeat(80)), null)
})
