// Estadísticas por cliente para el panel de negocio (ver VistaClientes en
// app/page.js) — pensado a partir de un ejemplo que mostró Cecilia de otro
// sistema de fidelización ("Tienda de Puntos"): nivel a simple vista,
// última actividad, y al abrir el detalle, frecuencia de compra y ticket
// promedio.

// "Compras registradas" solo cuenta orígenes que representan una venta real
// -- ni el regalo de cumpleaños ni un vencimiento de puntos son una compra.
// "Última actividad" en cambio sí incluye el cumpleaños: es algo real que
// le pasó a esa cuenta, tiene sentido que se vea reflejado.
const ORIGENES_COMPRA = ['manual', 'mercadopago', 'tiendanube', 'dragonfish']

// Umbrales en puntos GANADOS de por vida (no el saldo actual, que baja con
// cada canje) -- así un cliente frecuente no "baja" de nivel solo por
// haber canjeado premios, que es justamente el comportamiento que se
// quiere premiar. Son un punto de partida razonable, no un dato que haya
// pedido Cecilia con un número exacto -- fácil de ajustar acá si en la
// práctica no reflejan bien a los clientes reales de cada negocio.
const NIVELES = [
  { nombre: 'VIP', minimo: 10000, color: '#7c3aed' },
  { nombre: 'Diamante', minimo: 6000, color: '#0ea5e9' },
  { nombre: 'Oro', minimo: 3000, color: '#f59e0b' },
  { nombre: 'Plata', minimo: 1000, color: '#9ca3af' },
  { nombre: 'Bronce', minimo: 0, color: '#b45309' },
]

export function calcularNivel(puntosTotalesGanados) {
  return NIVELES.find((n) => puntosTotalesGanados >= n.minimo) || NIVELES[NIVELES.length - 1]
}

// Separador de miles con punto, sin usar Intl/toLocaleString: el runtime de
// Netlify Functions puede no traer los datos de ICU para 'es-AR' (solo
// 'en-US' si es un build "small-icu"), y toLocaleString('es-AR') ahí tira
// un RangeError que puede tumbar toda la página si se llama durante el
// render del lado del servidor — pasó en producción con la primera
// versión de descripcionNiveles(). Esto funciona igual en cualquier
// runtime de JS, sin depender de qué locales tenga compilados.
export function formatearMiles(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Texto para el tooltip de VistaClientes (app/page.js) — de menor a mayor,
// al revés del orden de NIVELES de arriba (que va de mayor a menor porque
// calcularNivel() necesita encontrar el primero que el cliente supera). Se
// arma acá, a partir de los mismos umbrales, para que nunca se
// desactualice si se ajustan los números.
export function descripcionNiveles() {
  const ordenAscendente = [...NIVELES].reverse()
  return ordenAscendente
    .map((nivel, i) => {
      const siguiente = ordenAscendente[i + 1]
      const rango = siguiente ? `${formatearMiles(nivel.minimo)} a ${formatearMiles(siguiente.minimo - 1)}` : `${formatearMiles(nivel.minimo)}+`
      return `${nivel.nombre}: ${rango} puntos`
    })
    .join('\n')
}

// `clientes` es la lista ya paginada de app/api/clientes (necesita al menos
// `id`). Devuelve un objeto { [clienteId]: stats }. Una sola consulta de
// MovimientoPuntos para toda la página en vez de una por cliente.
export async function calcularStatsClientes(prisma, clientes) {
  if (clientes.length === 0) return {}
  const clienteIds = clientes.map((c) => c.id)

  const movimientos = await prisma.movimientoPuntos.findMany({
    where: { clienteId: { in: clienteIds }, puntos: { gt: 0 } },
    select: { clienteId: true, negocioId: true, createdAt: true, puntos: true, origen: true },
    orderBy: { createdAt: 'asc' },
  })

  const negocioIds = [...new Set(movimientos.map((m) => m.negocioId))]
  const negocios = negocioIds.length
    ? await prisma.negocio.findMany({ where: { id: { in: negocioIds } }, select: { id: true, puntosXPeso: true } })
    : []
  const puntosXPesoPorNegocio = Object.fromEntries(negocios.map((n) => [n.id, n.puntosXPeso]))

  const stats = {}
  const fechasCompraPorCliente = {}
  const sumaPuntosCompraPorCliente = {}

  for (const id of clienteIds) {
    stats[id] = {
      ultimaActividad: null,
      comprasRegistradas: 0,
      fechaPrimeraCompra: null,
      fechaUltimaCompra: null,
      frecuenciaPromedioDias: null,
      ticketPromedio: null,
      puntosTotalesGanados: 0,
      nivel: calcularNivel(0),
    }
  }

  for (const mov of movimientos) {
    const s = stats[mov.clienteId]
    s.puntosTotalesGanados += mov.puntos
    if (!s.ultimaActividad || mov.createdAt > s.ultimaActividad) s.ultimaActividad = mov.createdAt

    if (ORIGENES_COMPRA.includes(mov.origen)) {
      s.comprasRegistradas++
      if (!s.fechaPrimeraCompra) s.fechaPrimeraCompra = mov.createdAt
      s.fechaUltimaCompra = mov.createdAt
      sumaPuntosCompraPorCliente[mov.clienteId] = (sumaPuntosCompraPorCliente[mov.clienteId] || 0) + mov.puntos
      ;(fechasCompraPorCliente[mov.clienteId] ||= []).push({ fecha: mov.createdAt, negocioId: mov.negocioId })
    }
  }

  for (const id of clienteIds) {
    const s = stats[id]
    s.nivel = calcularNivel(s.puntosTotalesGanados)

    const compras = fechasCompraPorCliente[id]
    if (compras?.length) {
      const puntosXPeso = puntosXPesoPorNegocio[compras[0].negocioId] || 1
      // Aproximado: MovimientoPuntos guarda puntos, no el monto real de la
      // venta -- se reconstruye multiplicando por puntosXPeso, que es
      // exactamente cómo se calcularon esos puntos en primer lugar (ver
      // app/api/compras, webhooks de Mercado Pago/Tiendanube/Dragon Fish),
      // salvo por el redondeo hacia abajo que ya se pierde en el origen.
      s.ticketPromedio = Math.round((sumaPuntosCompraPorCliente[id] / s.comprasRegistradas) * puntosXPeso)
    }
    if (compras?.length >= 2) {
      const primera = compras[0].fecha.getTime()
      const ultima = compras[compras.length - 1].fecha.getTime()
      s.frecuenciaPromedioDias = Math.round((ultima - primera) / (1000 * 60 * 60 * 24 * (compras.length - 1)))
    }
  }

  return stats
}
