# Exportar clientes a Google Sheets (2026-11-09)

## Qué hace

En el panel del negocio hay una sección nueva, **"Exportar clientes"** (en el
menú, debajo de Clientes), con dos caminos:

- **Google Sheets**: el negocio conecta **su propia** cuenta de Google, crea
  una hoja nueva ("Clientes — Club Peperina") o elige una que ya tiene, y
  aprieta **"Exportar clientes a la hoja"**. Cada vez que vuelve a exportar,
  la hoja se actualiza.
- **Archivo para Excel**: la descarga de siempre (`/api/clientes/exportar`),
  sin conectar nada. Se mantiene: sirve a quien no quiere dar acceso a su
  Google, y en Clientes sigue el botón para exportar solo una búsqueda o un
  nivel.

## Columnas

Pestaña **Clientes**, fila 1 con los encabezados (en negrita y fija):

| Columna | Contenido |
|---|---|
| A — ID Retornar | ID interno de la clienta: es lo que se usa para no duplicar |
| B — Nombre y apellido | |
| C — Email | |
| D — Teléfono | Como está guardado (con el código del país) |
| E — Fecha de registro | `AAAA-MM-DD` |
| F — Puntos actuales | Número (se puede sumar u ordenar) |
| G — Nivel | Bronce / Plata / Oro / … según la configuración del negocio |
| H — Puntos ganados en total | De por vida |
| I — Compras registradas | |
| J — Última actividad | `AAAA-MM-DD` |
| K — Cumpleaños (día/mes) | `dd/mm`, **sin el año** |
| L — Actualizado en Retornar | Fecha y hora (Buenos Aires) de la última exportación de esa fila |

**No se exportan** el DNI, la contraseña, el género ni el año de nacimiento.
Solo las clientas del negocio que tiene la sesión abierta.

## Cómo actualiza (sin duplicar)

- Lee la pestaña Clientes entera y ubica a cada clienta por el **ID** de la
  columna A, esté en la fila que esté (aunque hayan ordenado o filtrado la
  hoja).
- Las que ya están: se reescriben **solo las columnas A a L** de su fila,
  con los datos actuales.
- Las nuevas: se agregan **debajo de la última fila usada**, sin pisar filas
  escritas a mano.
- **No borra nada**: si una clienta ya no está en Retornar, su fila queda.
  Las columnas que el negocio agregue a la derecha (M en adelante), las
  otras pestañas, los colores, filtros y formatos no se tocan.
- Si un ID aparece en dos filas (alguien la copió), se actualiza la primera
  y la copia queda como está.
- Las filas con un ID que ya no es de una clienta actual quedan sin tocar,
  y el aviso de "Exportación lista" dice cuántas son.
- Se escribe como **valor** (`RAW`): un nombre que empiece con `=` queda como
  texto, nunca como fórmula.
- Una exportación a la vez por negocio (si se aprieta dos veces, la segunda
  espera).

## Seguridad y multiempresa

- **Permiso mínimo**: se pide solo `drive.file` (más el email para mostrar
  qué cuenta está conectada). Con ese permiso Retornar ve **únicamente** las
  hojas que creó o las que el negocio eligió en el selector de Google; no ve
  el resto del Drive ni puede abrir una hoja pegando su enlace. Google lo
  clasifica como permiso **no sensible** (no requiere la revisión de
  seguridad de Google). El permiso amplio de Sheets (`spreadsheets`) es
  sensible y daría acceso a todas las hojas de la cuenta: no se usa.
- **Una conexión por negocio** (tabla `ConexionGoogle`, borrada en cascada
  con el negocio). Todas las rutas toman el negocio de la sesión, nunca de un
  parámetro: un negocio no puede ver, usar ni exportar a la conexión o la
  hoja de otro. Las clientas y el admin no tienen acceso.
- **Vuelta de Google** (`/api/google-sheets/callback`): se acepta solo con un
  `state` firmado (HMAC con `NEXTAUTH_SECRET`, vence en 10 minutos) que sea
  del negocio con la sesión abierta y coincida con una cookie de un solo uso
  de ese navegador.
- **Token**: se guarda solo el de actualización, **cifrado** (AES-256-GCM,
  clave derivada de `NEXTAUTH_SECRET`); nunca se devuelve al navegador ni se
  escribe en logs. El selector de hojas recibe un token de acceso corto (1
  hora).
- **Desconectar** revoca el permiso en Google y borra la conexión. La hoja
  queda en el Drive del negocio. Si el negocio quita el acceso desde su
  cuenta de Google, la próxima exportación pide volver a conectar.
- Si se cambia `NEXTAUTH_SECRET`, las conexiones guardadas dejan de poder
  descifrarse: cada negocio tiene que volver a conectar (Retornar lo detecta
  y borra la conexión vieja).

## Qué hay que configurar (no está hecho)

La función queda **apagada** hasta cargar las credenciales: la sección dice
"La conexión con Google Sheets todavía no está habilitada" y la descarga para
Excel funciona igual. **No se configuró nada** en Google Cloud ni en Netlify:
requiere tu autorización.

### En Google Cloud (proyecto de Retornar)

1. **Habilitar** "Google Sheets API" y "Google Picker API" (APIs y
   servicios → Biblioteca). No tienen costo; el límite gratuito es de 300
   pedidos por minuto por proyecto, de sobra para exportar.
2. **Cliente OAuth** (Credenciales → ID de cliente de OAuth, tipo
   "Aplicación web"). Dos opciones:
   - **Recomendado**: uno nuevo, "Retornar — Google Sheets", así el permiso
     de la hoja no se mezcla con el login.
   - O reutilizar el del login con Google (`GOOGLE_CLIENT_ID`).
   En ambos casos, agregar como URI de redireccionamiento autorizado:
   `https://retornar.com.ar/api/google-sheets/callback`
   y como origen de JavaScript autorizado: `https://retornar.com.ar`.
3. **Pantalla de consentimiento** (Google Auth Platform → Acceso a los
   datos): agregar el permiso `.../auth/drive.file`. Revisar que el nombre de
   la app, el logo, el dominio `retornar.com.ar` y el link a la política de
   privacidad estén cargados.
   - El **estado de publicación** tiene que ser **"En producción"**. En
     "Prueba", Google vence los permisos a los 7 días y solo deja entrar a
     los usuarios de prueba.
   - Con solo permisos no sensibles no hace falta la verificación de
     seguridad; Google puede pedir verificar la marca (nombre y logo) para
     mostrarlos en la pantalla de permiso.
4. **Clave de API para el selector** (Credenciales → Clave de API):
   restringirla a la "Google Picker API" y a sitios web
   `https://retornar.com.ar/*`. Sin esta clave se puede igual **crear** una
   hoja nueva, pero no **elegir** una existente.
5. Anotar el **número de proyecto** (Configuración del proyecto); lo usa el
   selector para que la hoja elegida quede habilitada para la app.

### En Netlify (variables de entorno)

| Variable | Valor |
|---|---|
| `GOOGLE_SHEETS_CLIENT_ID` | ID del cliente OAuth del paso 2 (si se reutiliza el del login, se puede omitir: usa `GOOGLE_CLIENT_ID`) |
| `GOOGLE_SHEETS_CLIENT_SECRET` | Secreto del mismo cliente (o, si se omite, `GOOGLE_CLIENT_SECRET`) |
| `GOOGLE_PICKER_API_KEY` | Clave del paso 4 (opcional: sin ella no aparece "Elegir una hoja existente") |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Número del paso 5 (junto con la clave) |

Usa también `NEXTAUTH_SECRET` y `NEXT_PUBLIC_BASE_URL`, que ya existen. Hay
que volver a desplegar para que tomen efecto.

### Migración

`20261109120000_conexion_google`: crea la tabla `ConexionGoogle` (vacía).
No cambia ninguna tabla existente (comprobado con una huella de todos los
datos antes y después en una base de prueba).

## Qué se probó y qué no

- Probado con **Google simulado** (`pruebas/e2e/google-sheets.mjs`, 42
  comprobaciones, y pruebas unitarias en `lib/googleSheets.test.js`): permiso
  pedido, vueltas falsas o de otro negocio rechazadas, token cifrado, crear y
  elegir hoja, exportar y volver a exportar con la hoja reordenada, columnas
  y filas propias, sin DNI, fórmulas, dos exportaciones a la vez,
  multiempresa, desconectar y acceso revocado. La simulación reproduce la
  regla de `drive.file` (solo hojas creadas o elegidas).
- **No probado contra Google real**: no se creó ni modificó ninguna hoja
  real. Que pase la simulación no prueba la integración real. Después de
  configurar las credenciales, falta una prueba con una cuenta de Google de
  prueba (no la de Peperina) para confirmar:
  - la pantalla de permiso;
  - el selector;
  - crear, exportar y volver a exportar;
  - desconectar.

## Fuentes

- Permisos de Drive (`drive.file` no sensible, recomendado):
  https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Permisos de Sheets (`spreadsheets` es sensible):
  https://developers.google.com/workspace/sheets/api/scopes
- Selector de Google (Picker), clave y número de proyecto:
  https://developers.google.com/workspace/drive/picker/guides/overview
- Vencimiento de permisos en apps en "Prueba":
  https://developers.google.com/identity/protocols/oauth2#expiration
- Límites de uso de la API de Sheets:
  https://developers.google.com/workspace/sheets/api/limits
