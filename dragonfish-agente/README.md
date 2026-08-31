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
   (`GET /Facturaagrupada/{Codigo}/`) para traer el monto (`Total`) y el
   email del cliente (`Email`). Si la factura no tiene email cargado, busca
   el email/teléfono en la ficha del cliente (`GET /Cliente/{Codigo}/`,
   usando el código de cliente que trae la factura).
3. Reporta el resultado a Fideliza (`POST /api/dragonfish/resolver`), que
   ahí sí busca al cliente y le suma los puntos.

Implementado contra la documentación oficial de Zoo Logic (PDF
"Documentación API", actualización agosto 2026) y el swagger
`v16.0004.14968` que compartieron — no quedan incógnitas técnicas del lado
de la API. Lo que falta es específico de la instalación de cada negocio,
ver "Configuración" abajo.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `FIDELIZA_AGENT_TOKEN` | Sí | Token del negocio, generado desde "Integraciones" > Dragon Fish en el panel de Fideliza. Se muestra una sola vez al generarlo. |
| `FIDELIZA_BASE_URL` | No (default: producción) | URL de Fideliza. |
| `DRAGONFISH_BASE_URL` | Sí | Host, puerto y `basePath` de la API REST local de Dragon Fish, ej. `http://localhost:8008/api.Dragonfish`. Sale de configurar el "Servicio REST API" en el propio Dragon Fish — ver paso 1 abajo. |
| `DRAGONFISH_ID_CLIENTE` | Sí | El "Código" del "Cliente REST API" configurado en Dragon Fish (en mayúscula) — ver paso 2 abajo. |
| `DRAGONFISH_TOKEN` | Sí | El token (JWToken) para autenticarse — ver paso 3 abajo. Vigencia de 2 años. |
| `DRAGONFISH_BASE_DE_DATOS` | No | Solo hace falta si el servicio REST de Dragon Fish atiende más de una base y no alcanza con la que tiene configurada por defecto. |
| `POLL_INTERVAL_MS` | No (default: 30000) | Cada cuánto hace polling. |

## Configuración en Dragon Fish (a hacer una sola vez, en la PC del negocio)

### Paso 1: Servicio REST API

En Dragon Fish: **Configuración → Parámetros del sistema → Servicio REST
API**. Ahí se define el **puerto de escucha** y la **base de datos** por
defecto. Con eso arma `DRAGONFISH_BASE_URL`:
`http://<IP o nombre del equipo>:<puerto>/api.Dragonfish` (usar
`localhost` solo si el agente corre en la misma PC que el servicio).

Para confirmar que el servicio quedó activo: entrar a
`http://localhost:<puerto>/api.Dragonfish/docs/` desde esa PC — si carga
el swagger, está andando.

### Paso 2: Cliente REST API

En Dragon Fish: **Configuración → Parámetros del sistema → Cliente REST
API**. Ahí se genera:
- **Código** → `DRAGONFISH_ID_CLIENTE`.
- **Clave privada** → se pide en el paso 3 si hay que llamar a soporte.

### Paso 3: Obtener el token

Depende de la versión de Dragon Fish instalada:

- **Versión 15.0006.14682 o posterior**: desde Cliente REST API →
  **Acciones → Obtener Token**, elegir usuario de Dragon Fish y fecha de
  expiración. El token se copia solo al portapapeles → `DRAGONFISH_TOKEN`.
- **Versión 14.0012.14529 o anterior**: hay que llamar a **Mesa de Ayuda
  de Zoo Logic (77005700, o 011-77005700 desde el interior)** y darles el
  **Código** y **Clave privada** del paso 2, más usuario y contraseña de
  Dragon Fish. Te devuelven el token por teléfono → `DRAGONFISH_TOKEN`.

  ⚠️ El sistema de Peperina tiene más de 2 años sin actualizar (avisado
  por el propio soporte de Zoo Logic) — es probable que corresponda a este
  caso. Zoo Logic recomienda además actualizar el sistema en algún
  momento, ya que hubo varios cambios al servicio REST API desde esa
  versión.

### Paso 4: activar

Después de los pasos 1-3, cerrar y volver a abrir Dragon Fish para que
arranque el servicio REST API. Esperar unos minutos y confirmar que
`http://localhost:<puerto>/api.Dragonfish/docs/` responde.

## Instalación del agente

```bash
npm install
FIDELIZA_AGENT_TOKEN=... DRAGONFISH_BASE_URL=... DRAGONFISH_ID_CLIENTE=... DRAGONFISH_TOKEN=... npm start
```

(O cargar las variables en un `.env` y un gestor de procesos tipo `pm2`
para que quede corriendo en segundo plano y arranque solo con la PC.)

Al arrancar, el agente hace un chequeo de autenticación contra Dragon Fish
(`POST /Autenticar`) antes de empezar a hacer polling — si falla, revisa
`DRAGONFISH_ID_CLIENTE`/`DRAGONFISH_TOKEN` y corta.

## Configurar el webhook en Dragon Fish

En Dragon Fish: **Configuración → Parámetros del sistema → Webhook**
(disponible desde la versión 12.0004.13576). Crear uno nuevo con:

- **URL de notificación**: `https://<tu-dominio-de-fideliza>/api/webhooks/dragonfish`
- **Entidad**: "Factura de venta" (tildar **Ing.**, no hace falta Mod./Elim.)
- **Base de datos**: la del negocio (tiene que coincidir con
  `Negocio.dragonfishBaseDeDatos` cargado en "Integraciones" de Fideliza).
