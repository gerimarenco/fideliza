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
// El paso 2 está implementado contra la documentación oficial de Zoo Logic
// (PDF "Documentación API" + swagger v16.0004.14968) — ver
// dragonfish-agente/README.md para cómo conseguir cada variable de entorno
// desde el propio Dragon Fish.

const FIDELIZA_BASE_URL = process.env.FIDELIZA_BASE_URL || 'https://incomparable-zabaione-b58c21.netlify.app'
const FIDELIZA_AGENT_TOKEN = process.env.FIDELIZA_AGENT_TOKEN

// Ej: http://localhost:8008/api.Dragonfish (host/puerto según "Configuración >
// Parámetros del sistema > Servicio REST API" del Dragon Fish del negocio).
const DRAGONFISH_BASE_URL = (process.env.DRAGONFISH_BASE_URL || '').replace(/\/+$/, '')
// Código del "Cliente REST API" configurado en Dragon Fish (en mayúscula).
const DRAGONFISH_ID_CLIENTE = process.env.DRAGONFISH_ID_CLIENTE
// El JWToken: se obtiene desde el propio Dragon Fish (Cliente REST API >
// Acciones > Obtener Token, versión 15.0006.14682 o posterior) o, en
// versiones más viejas, llamando a Mesa de Ayuda de Zoo Logic (77005700).
const DRAGONFISH_TOKEN = process.env.DRAGONFISH_TOKEN
// Opcional: solo hace falta si el servicio REST de Dragon Fish atiende más
// de una base de datos y no hay que usar la que tiene configurada por
// defecto ("Base de datos" en Servicio REST API).
const DRAGONFISH_BASE_DE_DATOS = process.env.DRAGONFISH_BASE_DE_DATOS

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000)

if (!FIDELIZA_AGENT_TOKEN) {
  console.error('Falta FIDELIZA_AGENT_TOKEN — generalo desde "Integraciones" > Dragon Fish en el panel del negocio.')
  process.exit(1)
}

if (!DRAGONFISH_BASE_URL || !DRAGONFISH_ID_CLIENTE || !DRAGONFISH_TOKEN) {
  console.error('Faltan variables de Dragon Fish: DRAGONFISH_BASE_URL, DRAGONFISH_ID_CLIENTE y DRAGONFISH_TOKEN son obligatorias. Ver dragonfish-agente/README.md.')
  process.exit(1)
}

function headersDragonfish() {
  const headers = {
    IdCliente: DRAGONFISH_ID_CLIENTE,
    Authorization: DRAGONFISH_TOKEN,
  }
  if (DRAGONFISH_BASE_DE_DATOS) headers.BaseDeDatos = DRAGONFISH_BASE_DE_DATOS
  return headers
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

// Paso 4 de la documentación de Zoo Logic: hay que "autenticar" el token
// contra /Autenticar antes de poder usar el resto de la API. Se hace una
// sola vez al arrancar el agente, no en cada consulta.
async function autenticarDragonfish() {
  const res = await fetch(`${DRAGONFISH_BASE_URL}/Autenticar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IdCliente: DRAGONFISH_ID_CLIENTE, JWToken: DRAGONFISH_TOKEN }),
  })
  if (!res.ok) {
    throw new Error(`Dragon Fish respondió ${res.status} al autenticar — revisar DRAGONFISH_ID_CLIENTE/DRAGONFISH_TOKEN`)
  }
}

// /Facturaagrupada/{Codigo}/ agrupa factura manual, electrónica y fiscal —
// no hace falta ramificar por el tipo de comprobante (`entidad`) que vino
// en el webhook. Devuelve `Total` (monto) y, si la factura tiene cargado un
// email, `Email`. Si no, se busca el email/teléfono en la ficha del cliente
// (`Cliente`, el código interno de Dragon Fish que trae la factura).
async function consultarDragonfish(codigo) {
  const res = await fetch(`${DRAGONFISH_BASE_URL}/Facturaagrupada/${codigo}/`, {
    headers: headersDragonfish(),
  })

  if (!res.ok) {
    throw new Error(`Dragon Fish respondió ${res.status} al consultar la factura ${codigo}`)
  }

  const factura = await res.json()
  const monto = factura.Total
  let email = factura.Email?.trim()
  let telefono

  if (!email && factura.Cliente) {
    const cliente = await consultarClienteDragonfish(factura.Cliente)
    email = cliente?.EMail?.trim()
    telefono = cliente?.Telefono?.trim()
  }

  return { monto, email, telefono }
}

async function consultarClienteDragonfish(codigoCliente) {
  const res = await fetch(`${DRAGONFISH_BASE_URL}/Cliente/${codigoCliente}/`, {
    headers: headersDragonfish(),
  })
  if (!res.ok) {
    console.warn(`Dragon Fish respondió ${res.status} al consultar el cliente ${codigoCliente}`)
    return null
  }
  return res.json()
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
    if (!Number.isFinite(monto) || (!email && !telefono)) {
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

async function arrancar() {
  try {
    await autenticarDragonfish()
  } catch (error) {
    console.error('No se pudo autenticar contra Dragon Fish:', error.message)
    process.exit(1)
  }
  console.log(`Agente Dragon Fish arrancado. Polling cada ${POLL_INTERVAL_MS / 1000}s contra ${FIDELIZA_BASE_URL}`)
  cicloDePolling()
  setInterval(cicloDePolling, POLL_INTERVAL_MS)
}

arrancar()
