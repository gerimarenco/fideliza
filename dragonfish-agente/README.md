# Agente local de Dragon Fish

Script chico de Node que corre en la PC del negocio (donde vive Dragon
Fish) y conecta esa facturación con Fideliza, sin exponer la red del
negocio a internet: solo hace llamadas salientes (polling a Fideliza,
consultas a la API local de Dragon Fish), nunca escucha conexiones
entrantes.

## Cómo funciona

1. Cada `POLL_INTERVAL_MS` le pregunta a Fideliza (`GET
   /api/dragonfish/pendientes`) qué facturas quedaron pendientes de
   resolver (Fideliza las anota ahí cuando le llega el webhook de Dragon
   Fish, que solo trae un `Codigo`, sin datos de la venta).
2. Por cada una, consulta la API REST local de Dragon Fish
   (`/facturagrupada/{Codigo}`) para traer los datos completos: cliente y
   monto.
3. Reporta el resultado a Fideliza (`POST /api/dragonfish/resolver`), que
   ahí sí busca al cliente y le suma los puntos.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `FIDELIZA_AGENT_TOKEN` | Sí | Token del negocio, generado desde "Integraciones" > Dragon Fish en el panel de Fideliza. Se muestra una sola vez al generarlo. |
| `FIDELIZA_BASE_URL` | No (default: producción) | URL de Fideliza. |
| `DRAGONFISH_BASE_URL` | Sí, para que funcione de verdad | Host/puerto de la API REST local de Dragon Fish. **Todavía no confirmado**, ver estado abajo. |
| `POLL_INTERVAL_MS` | No (default: 30000) | Cada cuánto hace polling. |

## Estado: bloqueado en 2 puntos, esperando a Zoo Logic

El agente ya puede correr y conectarse a Fideliza (`pedirPendientes` /
`reportarResultado` están completos), pero `consultarDragonfish` en
`index.js` tiene placeholders porque faltan confirmar:

1. **Host/puerto real** de la API REST local (`DRAGONFISH_BASE_URL`).
2. **Autenticación** contra esa API — Zoo Logic no dijo nada todavía sobre
   usuario/password o token.
3. **Nombres reales de los campos de la respuesta** (cliente, monto) — Zoo
   Logic dijo que están en el swagger de la API, pero no lo compartieron
   todavía. Los campos que usa hoy `consultarDragonfish` (`factura.Total`,
   `factura.Cliente?.Email`, etc.) son un placeholder razonable, no
   confirmado.

Confirmado hasta ahora: el endpoint es `/facturagrupada/{Codigo}` (agrupa
factura manual, electrónica y fiscal, así que no hace falta ramificar por
tipo de comprobante). El "número de serie" que Zoo Logic pidió mandar
siempre **no va en las llamadas a la API** — confirmaron que es solo un
dato a incluir cuando se los consulta por mail a su casilla de soporte, no
un parámetro técnico de la integración.

## Instalación en la PC del negocio

```bash
npm install
FIDELIZA_AGENT_TOKEN=... DRAGONFISH_BASE_URL=... npm start
```

(O cargar las variables en un `.env` y un gestor de procesos tipo `pm2`
para que quede corriendo en segundo plano y arranque solo con la PC.)
