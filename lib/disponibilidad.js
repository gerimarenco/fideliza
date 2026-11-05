// Disponibilidad de los productos de los premios en Tiendanube, para la
// página intermedia de cada premio (app/club/[negocio]/producto/[premioId])
// y las etiquetas del panel de la clienta. Solo LEE la tienda: nunca cambia
// productos, precios ni stock.
//
// Tres estados, sin suponer nada:
// - 'con_stock': Tiendanube confirma que se puede comprar.
// - 'sin_stock': Tiendanube confirma que no (stock 0, producto sin publicar,
//   o la variante del enlace ya no existe).
// - 'desconocido': Tiendanube no respondió, respondió con un error o con
//   datos que no dejan claro el stock. Nunca se muestra como disponible.
//
// Stock de una variante según la documentación de la API de Tiendanube
// (recurso Product Variant): stock_management false = stock infinito;
// true = `stock` es la cantidad (0 o más). Con varias ubicaciones (multi
// inventario), `stock` es la suma de todas (ver
// docs/lanzamiento/enlaces-con-stock.md).
import { linkSeguro } from './guiaCupon.js'
import { precioDeVariante, obtenerProducto } from './tiendanube.js'

// Textos de Tiendanube: vienen por idioma ({ es: '...', pt: '...' }) o como
// texto plano.
export function textoTiendanube(valor) {
  if (typeof valor === 'string') return valor
  if (valor && typeof valor === 'object') return valor.es ?? Object.values(valor).find((v) => typeof v === 'string') ?? ''
  return ''
}

export function estadoVariante(variante) {
  if (!variante || typeof variante !== 'object') return 'desconocido'
  if (variante.stock_management === false) return 'con_stock'
  const { stock } = variante
  // Sin control de stock en la API vieja: stock null = infinito.
  if (stock === null && variante.stock_management !== true) return 'con_stock'
  const n = typeof stock === 'number' ? stock : typeof stock === 'string' && stock.trim() !== '' ? Number(stock) : NaN
  if (!Number.isFinite(n)) return 'desconocido'
  return n > 0 ? 'con_stock' : 'sin_stock'
}

export function nombreVariante(variante) {
  return (Array.isArray(variante?.values) ? variante.values : []).map(textoTiendanube).filter(Boolean).join(' / ')
}

// Link al producto en la tienda, con la variante elegida si hay una (el
// parámetro ?variant= lo interpretan las plantillas de Tiendanube; si la
// plantilla no lo hace, abre el producto igual).
export function urlProducto(producto, varianteId) {
  const base = linkSeguro(producto?.canonical_url)
  if (!base) return null
  if (varianteId == null) return base
  const u = new URL(base)
  u.searchParams.set('variant', String(varianteId))
  return u.toString()
}

function imagenDe(producto, variante) {
  const imagenes = Array.isArray(producto?.images) ? producto.images : []
  const propia = variante?.image_id != null ? imagenes.find((i) => i?.id === variante.image_id) : null
  return linkSeguro((propia || imagenes[0])?.src)
}

// El producto con lo que se muestra de cada variante.
export function resumenProducto(producto) {
  const variantes = (Array.isArray(producto?.variants) ? producto.variants : []).map((v) => ({
    id: String(v.id),
    nombre: nombreVariante(v),
    precio: precioDeVariante(v),
    estado: estadoVariante(v),
    imagen: imagenDe(producto, v),
    url: urlProducto(producto, v.id),
  }))
  return {
    id: String(producto?.id ?? ''),
    nombre: textoTiendanube(producto?.name),
    publicado: producto?.published !== false,
    url: urlProducto(producto),
    imagen: imagenDe(producto, null),
    variantes,
  }
}

// Estado de un enlace (producto, y variante si el enlace apunta a un color)
// a partir del producto leído. Sin producto → desconocido.
export function estadoEnlace(producto, varianteId) {
  if (!producto) return { estado: 'desconocido', motivo: 'sin_respuesta' }
  const r = resumenProducto(producto)
  if (!r.publicado) return { estado: 'sin_stock', motivo: 'no_publicado', producto: r }
  if (varianteId != null && varianteId !== '') {
    const variante = r.variantes.find((v) => v.id === String(varianteId))
    if (!variante) return { estado: 'sin_stock', motivo: 'variante_inexistente', producto: r }
    return { estado: variante.estado, motivo: null, producto: r, variante }
  }
  if (r.variantes.length === 0) return { estado: 'desconocido', motivo: 'sin_variantes', producto: r }
  const estados = r.variantes.map((v) => v.estado)
  const estado = estados.includes('con_stock') ? 'con_stock' : estados.every((e) => e === 'sin_stock') ? 'sin_stock' : 'desconocido'
  return { estado, motivo: null, producto: r }
}

// Otras variantes del MISMO producto con stock confirmado, para cuando la del
// enlace se agota: primero las del mismo precio, después el resto de menor a
// mayor precio.
export function otrasVariantesConStock(enlace) {
  if (!enlace?.producto) return []
  const precioBase = enlace.variante?.precio ?? null
  return enlace.producto.variantes
    .filter((v) => v.estado === 'con_stock' && v.id !== enlace.variante?.id && v.url)
    .sort((a, b) => {
      const mismoA = precioBase != null && a.precio === precioBase ? 0 : 1
      const mismoB = precioBase != null && b.precio === precioBase ? 0 : 1
      return mismoA - mismoB || (a.precio ?? Infinity) - (b.precio ?? Infinity)
    })
}

// Todo lo que muestra la página intermedia de un premio.
// principal: { producto | null, varianteId }; alternativas: [{ producto | null, varianteId }]
// (las configuradas por el negocio, en su orden).
// - Con stock: se muestra el producto y el botón a la tienda.
// - Sin stock: el mensaje, las otras variantes del mismo producto con stock
//   y las alternativas configuradas con stock confirmado (las agotadas o que
//   no se pudieron confirmar no se muestran).
// - Desconocido: el aviso; el botón a la tienda queda (decisión de Genaro),
//   sin decir que hay stock.
export function armarEnlace(principal, alternativas = []) {
  const enlace = estadoEnlace(principal?.producto, principal?.varianteId)
  const resultado = {
    estado: enlace.estado === 'con_stock' ? 'disponible' : enlace.estado,
    motivo: enlace.motivo ?? null,
    producto: enlace.producto ?? null,
    variante: enlace.variante ?? null,
    url: enlace.variante?.url ?? enlace.producto?.url ?? null,
    otrasVariantes: [],
    alternativas: [],
  }
  if (resultado.estado !== 'sin_stock') return resultado
  resultado.otrasVariantes = otrasVariantesConStock(enlace)
  const vistas = new Set()
  for (const alt of alternativas) {
    const e = estadoEnlace(alt?.producto, alt?.varianteId)
    if (e.estado !== 'con_stock' || !e.producto) continue
    // El mismo producto que el principal ya aparece como "otros colores".
    if (e.producto.id === resultado.producto?.id) continue
    const clave = `${e.producto.id}:${e.variante?.id ?? ''}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    const precios = (e.variante ? [e.variante] : e.producto.variantes.filter((v) => v.estado === 'con_stock')).map((v) => v.precio).filter((p) => p != null)
    resultado.alternativas.push({
      productoId: e.producto.id,
      varianteId: e.variante?.id ?? null,
      nombre: e.producto.nombre,
      variante: e.variante?.nombre || null,
      precio: precios.length ? Math.min(...precios) : null,
      imagen: e.variante?.imagen ?? e.producto.imagen,
      url: e.variante?.url ?? e.producto.url,
    })
  }
  resultado.alternativas = resultado.alternativas.filter((a) => a.url)
  return resultado
}

// --- Lectura con caché corta ---
//
// Una consulta por producto, con tiempo máximo de espera. Lo leído se
// guarda unos segundos para no repetir la misma consulta en cada vista (la
// API de Tiendanube limita las consultas por tienda); un error se guarda
// menos tiempo y se devuelve como "sin respuesta", nunca como disponible.
const cache = new Map()
export const EDAD_MAXIMA_MS = 20_000
const EDAD_MAXIMA_ERROR_MS = 10_000
export function limpiarCacheDisponibilidad() {
  cache.clear()
}

export async function leerProducto(negocio, productoId, { edadMaximaMs = EDAD_MAXIMA_MS, timeoutMs = 4000, ahora = Date.now } = {}) {
  if (!negocio?.tiendanubeStoreId || !negocio?.tiendanubeAccessToken || !productoId) return { error: 'sin_tienda' }
  const clave = `${negocio.tiendanubeStoreId}:${productoId}`
  const guardado = cache.get(clave)
  if (guardado && ahora() - guardado.en < (guardado.error ? Math.min(edadMaximaMs, EDAD_MAXIMA_ERROR_MS) : edadMaximaMs)) {
    return guardado.error ? { error: guardado.error } : { producto: guardado.producto }
  }
  try {
    const producto = await obtenerProducto(negocio, productoId, { timeoutMs })
    if (!producto || typeof producto !== 'object' || !Array.isArray(producto.variants)) throw new Error('respuesta sin variantes')
    cache.set(clave, { en: ahora(), producto })
    return { producto }
  } catch (error) {
    const motivo = /respondió 404/.test(error.message) ? 'no_existe' : 'sin_respuesta'
    cache.set(clave, { en: ahora(), error: motivo })
    return { error: motivo }
  }
}

// Un producto que ya no existe en la tienda es "sin stock" (no se puede
// comprar); cualquier otro error es "desconocido".
function productoONada(lectura) {
  if (lectura.producto) return lectura.producto
  if (lectura.error === 'no_existe') return { id: null, published: false, variants: [] }
  return null
}

// Arma la página intermedia de un premio (con sus alternativas cargadas).
export async function enlaceDePremio(premio, negocio, opciones = {}) {
  const [principal, ...alternativas] = await Promise.all([
    leerProducto(negocio, premio.tiendanubeProductoId, opciones),
    ...(premio.alternativas || []).map((a) => leerProducto(negocio, a.tiendanubeProductoId, opciones)),
  ])
  return armarEnlace(
    { producto: productoONada(principal), varianteId: premio.tiendanubeVarianteId },
    (premio.alternativas || []).map((a, i) => ({ producto: productoONada(alternativas[i]), varianteId: a.tiendanubeVarianteId })),
  )
}

// Estado del producto del premio para las etiquetas del panel:
// - 'disponible': el color del enlace (o el producto) tiene stock;
// - 'otros_colores': el color del enlace se agotó pero el producto tiene
//   otros con stock (el cupón vale para cualquier color: se puede canjear);
// - 'sin_stock': ninguna variante con stock (no se puede canjear, igual que
//   en app/api/canjes);
// - 'desconocido'.
export function estadoParaPanel(producto, varianteId) {
  const enlace = estadoEnlace(producto, varianteId)
  if (enlace.estado === 'con_stock') return 'disponible'
  if (enlace.estado === 'desconocido') return 'desconocido'
  if (enlace.motivo !== 'no_publicado' && varianteId != null && otrasVariantesConStock(enlace).length > 0) return 'otros_colores'
  return 'sin_stock'
}

export async function estadoDePremio(premio, negocio, opciones = {}) {
  const lectura = await leerProducto(negocio, premio.tiendanubeProductoId, opciones)
  return estadoParaPanel(productoONada(lectura), premio.tiendanubeVarianteId)
}
