// Ventas del local (Dragon Fish): a qué cuenta de Retornar corresponde una
// venta y cómo se acredita. Lo usan el resolver (lo que informa el agente)
// y la pantalla "Ventas del local sin identificar" (asignación a mano).
//
// La ficha del cliente en Dragon Fish puede tener cualquier combinación de
// datos (email, celular en "Movil", fijo en "Telefono", DNI en "NroDocumento"
// o CUIT/CUIL). Se busca en este orden, siempre dentro del mismo negocio:
//   1. email (sin distinguir mayúsculas ni espacios);
//   2. celular (cualquier formato);
//   3. DNI (también el que va en el medio de un CUIT/CUIL).
// Antes que todo eso, la ficha vinculada a mano (FichaDragonfish): para las
// fichas sin email, celular ni DNI, el negocio elige una vez a qué cuenta
// corresponde y desde ahí cada venta de esa ficha suma sola.
// Solo se acredita sola si todos los datos señalan a una única cuenta; si
// señalan a más de una (celular compartido, email de una y celular de otra),
// queda "ambigua" para que el negocio elija.
// Por nombre nunca se acredita solo: puede haber dos personas con el mismo.
//
// Regla: una venta de antes de que existiera la cuenta no suma (la clienta se
// registró después de comprar). Antes dependía de que el agente estuviera
// corriendo; con ventas acumuladas, se acreditaban compras anteriores.
import { normalizarEmail, normalizarTelefono } from './identidad.js'
import { mismoCelular } from './bienvenida.js'
import { normalizarDni } from './dni.js'
import { calcularPuntosPorCompra } from './puntos.js'
import { acreditarSiEsPrimeraCompraReferida } from './referidos.js'
import { fechaDeVenta } from './dragonfishFecha.js'

// Número de documento de la venta: el DNI de la ficha o, si no, el que va en
// el medio de un CUIT/CUIL de 11 dígitos (20-12345678-9 → 12345678).
export function dniDeVenta({ dni, cuit } = {}) {
  const directo = normalizarDni(String(dni ?? '').replace(/\D/g, ''))
  if (directo) return directo
  const digitos = String(cuit ?? '').replace(/\D/g, '')
  return digitos.length === 11 ? normalizarDni(digitos.slice(2, 10)) : null
}

// Celulares de la venta (solo dígitos, sin repetir): el agente nuevo manda
// `telefonos` (Movil primero, después Telefono); el viejo, `telefono`.
export function celularesDeVenta({ telefono, telefonos } = {}) {
  const lista = [...(Array.isArray(telefonos) ? telefonos : []), telefono].map((t) => normalizarTelefono(t ?? '')).filter((t) => t.length >= 6)
  return [...new Set(lista)]
}

// Monto informado: número o texto numérico; cualquier otra cosa no vale
// (null/''/false no cuelan como 0). Negativo (nota de crédito) tampoco.
export function montoDeVenta(monto) {
  const n = typeof monto === 'number' ? monto : (typeof monto === 'string' && monto.trim() !== '' ? Number(monto) : NaN)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function codigoDeFicha(codigo) {
  const texto = String(codigo ?? '').trim()
  return texto && texto.length <= 60 ? texto : null
}

// Fichas que usa cualquiera (consumidor final, mostrador…): nunca se vinculan
// a una persona, porque todas sus ventas le sumarían a ella.
export function fichaGenerica(nombre, codigo) {
  if (!codigoDeFicha(codigo) || /^0+$/.test(String(codigo).trim())) return true
  const n = String(nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return !n.trim() || /consumidor|final|mostrador|ocasional|generico|varios|sin nombre|^cliente$/.test(n)
}

export function nombreDeFicha(nombre) {
  const texto = String(nombre ?? '').replace(/\s+/g, ' ').trim()
  return texto ? texto.slice(0, 120) : null
}

export async function buscarClientaDeVenta(db, negocioId, { codigoFicha, email, celulares = [], dni }) {
  if (codigoFicha) {
    const vinculo = await db.fichaDragonfish.findUnique({ where: { negocioId_codigo: { negocioId, codigo: codigoFicha } } })
    const cliente = vinculo && await db.cliente.findFirst({ where: { id: vinculo.clienteId, negocioId } })
    if (cliente) return { cliente, por: 'ficha' }
  }
  // Cada dato de la ficha puede señalar a una o más cuentas. Solo se acredita
  // sola si TODOS los datos señalan a una única cuenta; si señalan a varias
  // (un celular compartido, o el email de una y el celular de otra) es
  // ambigua: queda para que el negocio elija y confirme (ver candidatas).
  const encontradas = new Map() // clienteId → primer dato que la señaló
  const e = normalizarEmail(email)
  if (e) {
    const filas = await db.$queryRaw`
      SELECT id FROM "Cliente" WHERE "negocioId" = ${negocioId} AND lower(btrim(email)) = ${e}`
    for (const f of filas) if (!encontradas.has(f.id)) encontradas.set(f.id, 'email')
  }
  for (const celular of celulares) {
    const filas = await db.$queryRaw`
      SELECT id, telefono FROM "Cliente"
      WHERE "negocioId" = ${negocioId}
        AND right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 6) = ${celular.slice(-6)}`
    for (const f of filas) if (mismoCelular(f.telefono, celular) && !encontradas.has(f.id)) encontradas.set(f.id, 'celular')
  }
  if (dni) {
    const filas = await db.cliente.findMany({ where: { negocioId, dni }, select: { id: true } })
    for (const f of filas) if (!encontradas.has(f.id)) encontradas.set(f.id, 'dni')
  }
  if (encontradas.size > 1) return { cliente: null, ambigua: true, candidatas: [...encontradas.keys()] }
  if (encontradas.size === 1) {
    const [[id, por]] = [...encontradas]
    return { cliente: await db.cliente.findUnique({ where: { id } }), por }
  }
  return { cliente: null }
}

// La cuenta se creó después de la venta. Se compara con la fecha y hora de la
// venta que manda Dragon Fish (fecha/hora), no con cuándo llegó el aviso a
// Retornar (createdAt), que puede ser más tarde (ver lib/dragonfishFecha.js).
export const cuentaPosterior = (cliente, factura) => new Date(cliente.createdAt) > fechaDeVenta(factura)

// Acredita la venta una sola vez: misma clave de siempre
// (WebhookEvento "dragonfish", "<negocioId>:<codigo>"). Devuelve
// { estado: 'acreditado' | 'duplicado' | 'sin_puntos', puntos, cliente,
// puntosTotales, referido }.
export async function acreditarVenta(db, negocio, factura, cliente, monto, { resultado = 'acreditado', por }) {
  const puntos = calcularPuntosPorCompra(monto, negocio.puntosXPeso)
  const ahora = new Date()
  if (puntos <= 0) {
    await db.facturaPendiente.update({ where: { id: factura.id }, data: { procesado: true, resultado: 'sin_puntos', monto, clienteId: cliente.id, identificadaPor: por, procesadaEn: ahora } })
    return { estado: 'sin_puntos', puntos: 0 }
  }
  let clienteActualizado, referido
  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvento.create({ data: { proveedor: 'dragonfish', referenciaExterna: `${negocio.id}:${factura.codigo}` } })
      clienteActualizado = await tx.cliente.update({ where: { id: cliente.id }, data: { puntos: { increment: puntos } } })
      await tx.movimientoPuntos.create({ data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'dragonfish', saldoRestante: puntos } })
      await tx.facturaPendiente.update({ where: { id: factura.id }, data: { procesado: true, resultado, monto, clienteId: cliente.id, identificadaPor: por, procesadaEn: ahora, candidatas: [], ...(factura.codigoFicha ? { codigoFicha: factura.codigoFicha } : {}), ...(factura.nombreFicha ? { nombreFicha: factura.nombreFicha } : {}) } })
      referido = await acreditarSiEsPrimeraCompraReferida(tx, cliente, negocio)
    })
  } catch (error) {
    if (error.code === 'P2002') {
      await db.facturaPendiente.update({ where: { id: factura.id }, data: { procesado: true, resultado: 'duplicado', procesadaEn: ahora } })
      return { estado: 'duplicado', puntos: 0 }
    }
    throw error
  }
  const puntosTotales = referido
    ? (await db.cliente.findUnique({ where: { id: cliente.id }, select: { puntos: true } })).puntos
    : clienteActualizado.puntos
  return { estado: resultado, puntos, cliente: clienteActualizado, puntosTotales, referido }
}
