// Agente local de Dragon Fish para Fideliza.
//
// Corre en la PC del negocio (donde vive Dragon Fish), NUNCA escucha
// conexiones entrantes — solo hace llamadas salientes, así no hace falta
// exponer la red del negocio a internet. El ciclo es:
//
//   1. Le pregunta a Fideliza (GET /api/dragonfish/pendientes) qué facturas
//      quedaron pendientes de resolver.
//   2. Por cada una, consulta la API REST local de Dragon Fish para traer
//      los datos completos de esa factura (cliente, monto).
//   3. Le reporta el resultado a Fideliza (POST /api/dragonfish/resolver),
//      que ahí sí suma los puntos al cliente.
//
// ⚠️ ESTADO: el paso 2 (consultarDragonfish) todavía tiene 3 cosas sin
// confirmar con el soporte de Zoo Logic — están marcadas con TODO más abajo
// y también documentadas en docs/tareas-pendientes.md. Sin esas respuestas
// este agente puede correr (conecta con Fideliza, hace polling), pero la
// consulta a Dragon Fish va a fallar o devolver datos incompletos.

const FIDELIZA_BASE_URL = process.env.FIDELIZA_BASE_URL || 'https://incomparable-zabaione-b58c21.netlify.app'
const FIDELIZA_AGENT_TOKEN = process.env.FIDELIZA_AGENT_TOKEN
const DRAGONFISH_BASE_URL = process.env.DRAGONFISH_BASE_URL // TODO: host:puerto real de la API REST local, ej. http://localhost:PUERTO/api.Dragonfish
const DRAGONFISH_NUMERO_SERIE = process.env.DRAGONFISH_NUMERO_SERIE // Zoo Logic pidió mandar siempre el "número de serie" — falta confirmar dónde va (¿header? ¿query param?)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000)

if (!FIDELIZA_AGENT_TOKEN) {
  console.error('Falta FIDELIZA_AGENT_TOKEN — generalo desde "Integraciones" > Dragon Fish en el panel del negocio.')
  process.exit(1)
}

async function pedirPendientes() {
  const res = await fetch(`${FIDELIZA_BASE_URL}/api/dragonfish/pendientes`, {
    headers: { Authorization: `Bearer ${FIDELIZA_AGENT_TOKEN}` },
  })
  if (!res.ok) {
    throw new Error(`Fideliza respondió ${res.status} al pedir pendientes`)
  }
  const { pendientes } = await res.json()
  return pendientes
}

// Zoo Logic confirmó que el endpoint depende del tipo de comprobante, pero
// que /facturagrupada/{Codigo} agrupa las tres variantes (factura manual,
// electrónica y fiscal) — así que no hace falta ramificar por `entidad`.
//
// TODO (falta confirmar con Zoo Logic antes de que esto funcione de verdad):
//   1. DRAGONFISH_BASE_URL real (host y puerto de la API REST local).
//   2. Cómo autenticarse contra esa API (¿usuario/password? ¿token?) — no
//      dijeron nada todavía.
//   3. Dónde va el "número de serie" que pidieron mandar siempre (¿header
//      propio, query param, form field?) y qué valor le corresponde a la
//      base de este negocio.
//   4. Los nombres reales de los campos de la respuesta (cliente, monto):
//      dijeron que están en el swagger de la API, pero no lo compartieron
//      todavía — falta pedirlo, o un JSON de ejemplo real.
async function consultarDragonfish(codigo) {
  if (!DRAGONFISH_BASE_URL) {
    throw new Error('Falta configurar DRAGONFISH_BASE_URL (host/puerto de la API REST local de Dragon Fish)')
  }

  const res = await fetch(`${DRAGONFISH_BASE_URL}/facturagrupada/${codigo}`, {
    headers: {
      // TODO: reemplazar por el mecanismo de auth real una vez confirmado.
      // TODO: agregar acá el "número de serie" si va como header.
    },
  })

  if (!res.ok) {
    throw new Error(`Dragon Fish respondió ${res.status} al consultar la factura ${codigo}`)
  }

  const factura = await res.json()

  // TODO: reemplazar por los nombres de campo reales una vez que Zoo Logic
  // confirme el formato de la respuesta (o llegue el swagger). Estos son
  // placeholders razonables, no confirmados.
  return {
    monto: factura.Total ?? factura.monto,
    email: factura.Cliente?.Email ?? factura.email,
    telefono: factura.Cliente?.Telefono ?? factura.telefono,
  }
}

async function reportarResultado(codigo, datos) {
  const res = await fetch(`${FIDELIZA_BASE_URL}/api/dragonfish/resolver`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIDELIZA_AGENT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ codigo, ...datos }),
  })
  if (!res.ok) {
    throw new Error(`Fideliza respondió ${res.status} al reportar el resultado de ${codigo}`)
  }
  return res.json()
}

async function procesarPendiente(pendiente) {
  try {
    const { monto, email, telefono } = await consultarDragonfish(pendiente.codigo)
    if (!monto || (!email && !telefono)) {
      console.warn(`Factura ${pendiente.codigo}: Dragon Fish no trajo monto o identificación de cliente, se marca sin datos`)
      await reportarResultado(pendiente.codigo, { sinDatos: true })
      return
    }
    const resultado = await reportarResultado(pendiente.codigo, { monto, email, telefono })
    console.log(`Factura ${pendiente.codigo}: ${resultado.resultado}`, resultado.puntosAcreditados ? `(+${resultado.puntosAcreditados} puntos)` : '')
  } catch (error) {
    console.error(`Error procesando factura ${pendiente.codigo}:`, error.message)
    // No se reporta nada a Fideliza: la factura sigue pendiente y se
    // reintenta en el próximo ciclo de polling.
  }
}

async function cicloDePolling() {
  try {
    const pendientes = await pedirPendientes()
    for (const pendiente of pendientes) {
      await procesarPendiente(pendiente)
    }
  } catch (error) {
    console.error('Error en el ciclo de polling:', error.message)
  }
}

console.log(`Agente Dragon Fish arrancado. Polling cada ${POLL_INTERVAL_MS / 1000}s contra ${FIDELIZA_BASE_URL}`)
cicloDePolling()
setInterval(cicloDePolling, POLL_INTERVAL_MS)
