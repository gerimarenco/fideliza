# Agente local de Dragon Fish

Script chico de Node que corre en la PC del negocio (donde vive Dragon
Fish) y conecta esa facturación con Retornar, sin exponer la red del
negocio a internet: solo hace llamadas salientes (polling a Retornar,
consultas a la API local de Dragon Fish), nunca escucha conexiones
entrantes.

## Cómo funciona

1. Cada `POLL_INTERVAL_MS` le pregunta a Retornar (`GET
   /api/dragonfish/pendientes`) qué facturas quedaron pendientes de
   resolver (Retornar las anota ahí cuando le llega el webhook de Dragon
   Fish, que solo trae un `Codigo`, sin datos de la venta).
2. Por cada una, consulta la API REST local de Dragon Fish
   (`GET /Facturaagrupada/{Codigo}/`) para traer el monto (`Total`) y el
   email del cliente (`Email`). Si la factura no tiene email cargado, busca
   el email/teléfono en la ficha del cliente (`GET /Cliente/{Codigo}/`,
   usando el código de cliente que trae la factura).
3. Reporta el resultado a Retornar (`POST /api/dragonfish/resolver`), que
   ahí sí busca al cliente y le suma los puntos.

Implementado contra la documentación oficial de Zoo Logic (PDF
"Documentación API", actualización agosto 2026) y el swagger
`v16.0004.14968` que compartieron — no quedan incógnitas técnicas del lado
de la API. Lo que falta es específico de la instalación de cada negocio,
ver "Configuración" abajo.

## Variables de entorno

El prefijo de estas dos primeras variables sigue siendo `FIDELIZA_` (el
nombre del proyecto antes de renombrarse a Retornar) a propósito: cambiarlo
rompería el `.env` ya cargado en la PC de Peperina sin avisar. Nuevas
instalaciones pueden seguir usando estos mismos nombres.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `FIDELIZA_AGENT_TOKEN` | Sí | Token del negocio, generado desde "Integraciones" > Dragon Fish en el panel de Retornar. Se muestra una sola vez al generarlo. |
| `FIDELIZA_BASE_URL` | No (default: producción) | URL de Retornar. |
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
```

Copiar `.env.example` a `.env` (misma carpeta) y completar ahí los valores
reales — el agente los carga solos al arrancar (nunca hace falta escribir
`$env:...` a mano en PowerShell). Después:

```bash
npm start
```

Al arrancar, el agente hace un chequeo de autenticación contra Dragon Fish
(`POST /Autenticar`) antes de empezar a hacer polling. Si Dragon Fish no
responde (lo más común: todavía no está abierto), no se cierra: lo vuelve a
intentar cada minuto y lo anota en `agente.log`. Si el problema persiste
con Dragon Fish abierto, revisar `DRAGONFISH_ID_CLIENTE`/`DRAGONFISH_TOKEN`.

Cada línea de `agente.log` lleva fecha y hora, y una vez por hora el agente
deja una línea "Agente funcionando" aunque no haya ventas. Las líneas nunca
incluyen el email ni el teléfono de las clientas, solo el código de factura.

Una factura que Dragon Fish no encuentra (responde 404) se informa como
"sin datos" en vez de reintentarse para siempre.

Probarlo así una vez a mano antes de configurar el arranque automático
(abajo), para confirmar que el `.env` está bien cargado.

## Actualizar el agente en una PC donde ya está instalado

Cuando hay una versión nueva del agente (como la que suma
`verificar-agente.bat`, fecha y hora en `agente.log` y la espera a que
Dragon Fish esté abierto):

1. Descargar el proyecto de GitHub (botón verde **Code → Download ZIP**) y
   descomprimirlo en cualquier lado.
2. Abrir la carpeta `dragonfish-agente` del ZIP y copiar estos archivos a la
   carpeta del agente en la PC, reemplazando los que haya:
   `index.js`, `iniciar-agente.bat`, `verificar-agente.bat`,
   `package.json`, `package-lock.json`, `README.md`.
3. **No** copiar ni borrar `.env` (tiene los datos reales del negocio) ni
   la carpeta `node_modules`.
4. Si el agente estaba corriendo, reiniciar la PC (o en el Programador de
   tareas: click derecho en la tarea → **Finalizar** y después
   **Ejecutar**).

> Por qué importa: en la PC de Peperina se vio (2026-10) un
> `iniciar-agente.bat` de 487 bytes que mostraba la salida de `npm
> install`/`npm start` en pantalla — no es el de este repositorio (que
> escribe todo en `agente.log` y nunca muestra nada). Esa diferencia explica
> por qué nunca apareció `agente.log`. Reemplazarlo por el de acá es el
> primer paso.

## Arranque automático con Windows

Esta es la configuración que se usa en Peperina: el agente arranca solo al
prender la PC, en segundo plano (sin ninguna ventana que alguien pueda
cerrar sin querer), y espera solo a que se abra Dragon Fish.

1. Confirmar que `npm install` ya se corrió una vez en esta carpeta y que
   `.env` tiene los valores reales (ver arriba).
2. Probar `iniciar-agente.bat` con doble clic. Se abre una ventana negra
   **vacía** (es normal: todo se escribe en `agente.log`). Esperar 30
   segundos y hacer doble clic en `verificar-agente.bat`: tiene que decir
   "El agente esta corriendo" y mostrar líneas de `agente.log` con la hora
   actual. Cerrar la ventana negra de `iniciar-agente.bat` (eso cierra el
   agente; en el próximo paso queda configurado para abrirse solo).
3. Abrir el **Programador de tareas** de Windows (`Win + R` → escribir
   `taskschd.msc` → Enter).
4. **Acción → Crear tarea básica...** y completar:
   - **Nombre**: `Agente Dragon Fish - Retornar`.
   - **Desencadenador**: "Al iniciar el equipo".
   - **Acción**: "Iniciar un programa" → **Examinar...** y elegir
     `iniciar-agente.bat` en esta carpeta.
   - En la misma pantalla, en **"Iniciar en (opcional)"**, pegar la ruta de
     esta carpeta (la misma que en "Programa o script" pero sin
     `\iniciar-agente.bat` al final). El `.bat` ya se posiciona solo en su
     carpeta, pero así queda doblemente asegurado.
5. Antes de terminar el asistente, tildar **"Abrir el diálogo Propiedades
   para esta tarea"** y en las propiedades:
   - Pestaña **General**: elegir **"Ejecutar tanto si el usuario inició
     sesión como si no"**. Windows pide la contraseña de ese usuario: es la
     de Windows (con la que se desbloquea la PC). Si alguna vez se cambia
     esa contraseña, hay que volver a cargarla acá — si no, la tarea deja
     de arrancar sin avisar.
   - Pestaña **Condiciones**: destildar "Iniciar la tarea solo si el
     equipo funciona con corriente alterna".
   - Pestaña **Configuración**: destildar "Detener la tarea si se ejecuta
     durante más de..." (el agente tiene que correr todo el día).
6. Aceptar.

Como la tarea corre en segundo plano, **al ejecutarla no se abre ninguna
ventana** — eso es lo esperado. Para confirmar que funciona se usa
`verificar-agente.bat` o la sección Integraciones del panel (ver abajo).

### Comprobar el arranque después de reiniciar la PC

1. Reiniciar la PC y entrar a Windows como siempre. Abrir Dragon Fish.
2. Esperar 2 minutos y hacer doble clic en `verificar-agente.bat`.
   - "El agente esta corriendo" + líneas con la hora de recién →
     funciona. Listo.
   - "Dragon Fish todavía no responde" en la última línea → el agente
     está andando pero esperando a Dragon Fish: confirmar que Dragon Fish
     esté abierto y volver a mirar en 2 minutos.
   - "El agente NO esta corriendo" y ninguna línea nueva → la tarea no se
     ejecutó. En el Programador de tareas, en la columna "Resultado de la
     última ejecución" de la tarea: si dice algo distinto de `(0x0)` o
     `(0x41301)` ("en ejecución"), volver a cargar la contraseña en la
     pestaña General (paso 5).
3. También desde el panel de Retornar: **Integraciones → Dragon Fish**
   muestra "Agente funcionando — último contacto hace X minutos". Si la PC
   está prendida y eso dice más de una hora, el agente no está corriendo.

Con esto el agente queda corriendo solo cada vez que se prende la PC, se
reinicia solo si se cae por algún error, y si Dragon Fish todavía no está
abierto, lo espera.

## Configurar el webhook en Dragon Fish

En Dragon Fish: **Configuración → Parámetros del sistema → Webhook**
(disponible desde la versión 12.0004.13576). Crear uno nuevo con:

- **URL de notificación**: `https://retornar.com.ar/api/webhooks/dragonfish`
- **Entidad**: "Factura de venta" (tildar **Ing.**, no hace falta Mod./Elim.)
- **Base de datos**: la del negocio (tiene que coincidir con
  `Negocio.dragonfishBaseDeDatos` cargado en "Integraciones" de Retornar).
