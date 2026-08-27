# Progreso — Fideliza

> Historial resumido, en orden cronológico, reconstruido de `git log`.
> Para el detalle de la sesión más reciente, ver `sesion-actual.md`.

## 2026-06-29 — Setup inicial

Primer commit del proyecto (`create-next-app`), configuración de deploy en
Netlify, ajustes de build (`tsconfig`, fixes de deploy).

## 2026-06-30 — Base funcional

- Conexión a la base de datos (Prisma + Postgres).
- APIs iniciales de clientes, compras y canjes.
- Login con NextAuth (sesión real).
- Sumar puntos y agregar clientes funcionando desde el panel.

## 2026-07-05 — Paneles por rol

- Panel separado para negocios (`PanelNegocio`).
- Primera versión del webhook de Tiendanube.
- Fixes de sidebar del negocio y de middleware.

## 2026-07-30 — Panel de cliente

Login y panel de cliente (`PanelCliente`), generación automática de
password para clientes dados de alta por el negocio.

## 2026-08-04 — Auto-registro

Auto-registro de clientes por negocio (link público `/registro/[slug]`).

## 2026-08-11 — Fix menor

Manejo de nombre nulo en el panel de cliente.

## 2026-08-12 — Mercado Pago

Integración de Mercado Pago: `crear-preferencia` + webhook. Ajuste para
usar `sandbox_init_point` en pagos de prueba.

## 2026-08-20 — Dragon Fish (versión inicial)

Endpoint de webhook de Dragon Fish preparado, en modo "solo loguear" —
todavía no se conocía el formato real del payload.

## 2026-08-21 — Sesión grande: seguridad, integraciones, estadísticas (PR #1)

Sesión extensa de trabajo con Claude Code que terminó en el PR #1
("Add authentication, security, and webhook idempotency"), mergeado a
`main`. En orden:

1. **Tiendanube terminado (a nivel código)**: se confirmó que el webhook
   de Tiendanube manda un payload liviano (`{store_id, event, id}`, sin
   los datos de la venta) — el código anterior asumía que sí venían, y
   nunca hubiera funcionado. Se reescribió para pedir la orden completa a
   la API de Tiendanube, y se agregaron `tiendanubeStoreId` /
   `tiendanubeAccessToken` a `Negocio` más `PATCH /api/negocios` para
   cargarlos.
2. **Auditoría de seguridad de passwords**: se detectó que `Cliente` y
   `Negocio` guardaban passwords en texto plano. Se migró a bcrypt
   (`lib/password.js`) con rehash automático de las passwords legacy en
   el primer login (sin resetear nada a mano). Se sacó el admin
   hardcodeado del código a variables de entorno. Se borró `fix.js`
   (script de un solo uso ya obsoleto).
3. **Hallazgo crítico de seguridad**: `GET /api/negocios` y
   `GET /api/clientes` no tenían ningún chequeo de sesión — el middleware
   excluye `/api/*` explícitamente. Cualquiera sin loguearse podía
   bajarse todos los negocios y clientes, incluidos los hashes de
   password y el `tiendanubeAccessToken` en texto plano. Se agregó
   autenticación y autorización por rol a **todos** los endpoints de API.
4. **Bug de duplicación de puntos**: el webhook de Mercado Pago tenía un
   comentario que decía "evitar sumar puntos dos veces" pero no hacía
   nada al respecto. Se agregó idempotencia real (`WebhookEvento` +
   transacción atómica) — priorizado porque era el único de los tres
   webhooks con tráfico real en producción.
5. **Índices faltantes**: se agregaron índices en las foreign keys que no
   los tenían (`Cliente.negocioId`, `Premio.negocioId`,
   `Canje.clienteId`/`premioId`), verificado con `EXPLAIN ANALYZE` contra
   20.000 filas de prueba.
6. **README real**: se reemplazó el README genérico de `create-next-app`
   por documentación real del proyecto (setup, variables de entorno,
   estado de las integraciones).
7. **Estadísticas del negocio**: nueva tabla `MovimientoPuntos` (historial
   de puntos otorgados, algo que no existía) + endpoint
   `GET /api/negocios/estadisticas` (clientes activos, puntos otorgados
   este mes, canjes este mes) + sección visual nueva en el panel.
8. Se detectó y arregló un conflicto de merge real contra `main`
   (`README.md`, por un commit de prueba ajeno) antes de mergear el PR.
9. Se desconectó la integración de Vercel del repo (el deploy real es
   Netlify; Vercel estaba fallando por falta de configuración y no
   aportaba nada).
10. **PR #1 mergeado.**

## 2026-08-22 — Paginación de listados (PR #2)

Diseño del agente local de Dragon Fish (sin código, quedó bloqueado
esperando a Zoo Logic). Auditoría de las consultas Prisma de los paneles:
se agregaron paginación a `GET /api/clientes` y un `GET /api/canjes`
nuevo (antes solo existía el `POST`), y se conectó la lista de clientes y
una pantalla nueva de "Historial de canjes" (el ítem de sidebar
"Canjes"/"Puntos y canjes", hasta entonces decorativo) a esos endpoints.
**PR #2 mergeado.**

## 2026-08-22 (tarde) — Documentación de contexto (PR #3)

Se creó esta carpeta `docs/` (`contexto-proyecto.md`, `progreso.md`,
`sesion-actual.md`, `tareas-pendientes.md`) para poder retomar el
proyecto entre sesiones sin releer todo el código. **PR #3 mergeado.**

## 2026-08-23/24 — Conectar todo el sidebar + Ajustes de negocio (PRs #4-#9)

Sesión larga retomando el proyecto: se conectó, uno por uno, cada ítem
decorativo que quedaba en los tres paneles, más el "Ajustes" del panel
de negocio (que no existía). Ver `sesion-actual.md` para el detalle
completo de cada PR, lo probado, y las decisiones tomadas con el negocio
antes de construir cada pantalla. En orden:

1. **PR #4** (ya estaba abierto de una sesión previa): botón "Canjear" en
   el panel de cliente, conectado a `POST /api/canjes`.
2. **PR #5**: "+ Nuevo negocio" y "Editar" en el panel admin; se borró
   `borrar-cliente.sql` (resto sin uso de una tarea ya cerrada).
3. **PR #6**: "Negocios" y "Clientes"/"Mis clientes" del sidebar.
4. **PR #7**: "Premios" del panel de negocio — CRUD completo nuevo
   (`/api/premios`), con borrado lógico (`Premio.activo`).
5. **PR #8**: "Integraciones" (Tiendanube + Mercado Pago + Dragon Fish) en
   ambos paneles, más un bug real encontrado en producción (el contenido
   del panel admin no reaccionaba a `seccionActiva` sin un negocio
   elegido) y arreglado en el mismo PR.
6. **PR #9**: "Ajustes" del panel de negocio (ítem nuevo): cambio de
   contraseña, `puntosXPeso` editable.
7. Manejo de errores agregado a los botones de guardado (`try/catch` +
   mensaje visible) — pusheado a la rama, sin PR abierto todavía.
8. Se descubrió que la cuenta de Netlify se quedó sin créditos operativos
   — deploys de producción pausados hasta que se resuelva. No es un bug
   de código.

## 2026-08-25/26 — Créditos de Netlify resueltos, causa de fondo real
del bug de producción, y marca propia por negocio (PRs #10-#17)

Cecilia actualizó el plan de Netlify y los deploys volvieron a andar.
Eso permitió retomar el diagnóstico del bug de producción que había
quedado abierto, y de ahí surgió una sesión larga que terminó en una
funcionalidad nueva grande (marca propia por negocio) a pedido de la
dueña de Peperina, que empezó a mostrarle el panel a su mamá.

1. **PR #10**: se fusionó el manejo de errores en los botones de guardado
   que había quedado pusheado sin PR (ver arriba).
2. **Causa de fondo real encontrada** (probando "Guardar negocio" en
   producción con el manejo de errores ya en su lugar): el build de
   Netlify nunca corría `prisma migrate deploy`, solo `prisma generate`
   — la base de producción estaba atrasada varias migraciones. La más
   grave, `Premio.activo` (del PR #7), rompía `GET /api/negocios` con un
   500 sin cuerpo. **PR #11**: build command corregido a
   `prisma migrate deploy && prisma generate && npm run build`, más un
   `catch` para email duplicado en `POST /api/negocios` que también
   estaba sin capturar.
3. **PR #12**: bug encontrado por la propia Cecilia al confundirse de
   cuenta — el panel Admin mostraba "Panel del negocio" como subtítulo
   (copiado por error de otra parte del código). Corregido a "Panel de
   administrador".
4. **PR #13**: se conectó `Negocio.activo` (ya existía en el schema, sin
   usar) — desactivar/reactivar un negocio desde la grilla, mismo
   patrón de borrado lógico que `Premio.activo`. Al probarlo se encontró
   otro bug real: cualquier acción que recargaba la lista de negocios
   sacaba al admin de la grilla sin avisar y lo mandaba al panel del
   primer negocio de la lista — arreglado de paso.
5. **Marca propia por negocio** (a pedido de Cecilia, mostrándole el
   panel a su mamá, dueña de Peperina): se decidió con ella, antes de
   escribir código, que el tema es por-negocio (pensando en revender
   Fideliza a futuro) y que el "chrome" del Admin nunca cambia.
   - **PR #14**: `Negocio.tema` (JSON), 7 tokens de color + tipografía de
     títulos, aplicado a `PanelNegocio` y `PanelCliente`. Paleta inicial
     negro/beige a partir del logo de Instagram de Peperina.
   - **PR #15**: reemplazo por la paleta real que mandó la dueña de la
     marca (blanco/crema con acentos en beige) — la inicial no
     coincidía con el sitio real (peperina.com, mucho más claro). Se
     agregó un token de "resaltado" (segundo acento, para los chips de
     puntos/avatares) para aprovechar más colores de la paleta real en
     vez de reducir todo a dos tonos.
   - **PR #16**: imagen de portada tipo "muro de Facebook" (URL, ya que
     la app no tiene carga de archivos propia) — visible en el panel del
     negocio y en el del cliente.
   - Probado extensamente en el navegador contra Postgres real en cada
     paso (incluida una vuelta atrás al descubrir, en medio de una
     prueba, que había que correr `prisma generate` después de
     `migrate deploy` — un cliente de Prisma desactualizado tiraba
     "Unknown field" para el campo nuevo).
6. **PR #17**: bug real encontrado mientras Cecilia probaba a cargar la
   imagen de portada — el texto tipeado en los campos de formulario
   quedaba invisible con el sistema en modo oscuro (`globals.css` traía
   una regla de modo oscuro automático heredada del template inicial,
   nunca usada a propósito). Afectaba a toda la app, no solo a Peperina.
7. Sesión de soporte extensa guiando a Cecilia paso a paso para subir la
   imagen real a imgur y conseguir el link directo correcto (varios
   intentos: ruta local de archivo, link de página en vez de imagen
   directa) — documentado en `sesion-actual.md`.
8. Se actualizó `docs/` completo con el detalle de la sesión (marca
   propia por negocio, Netlify resuelto).

## 2026-08-27 — Login con Google + mostrar contraseña (PRs #19-#20)

Pedido directo de Cecilia: agregar mostrar/ocultar contraseña y login con
Google a `/login`. Antes de construir se acordó el alcance: el botón de
Google es para los tres roles (admin/negocio/cliente), y si el email no
tiene cuenta creada, se rechaza el login en vez de crear una cuenta
nueva.

1. **PR #19**: toggle de mostrar/ocultar contraseña en el form de
   credentials; provider de Google agregado a `lib/auth.js` (solo se
   habilita si `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` están seteadas);
   `signIn` callback que mapea el email de Google a `admin`/`negocio`/
   `cliente` o rechaza el login. Documentadas las variables nuevas en el
   README. Mergeado.
2. Soporte paso a paso a Cecilia (no técnica) para crear las credenciales
   reales en Google Cloud Console (proyecto, pantalla de consentimiento,
   cliente OAuth) y cargarlas en Netlify. Dos problemas reales encontrados
   probando en producción:
   - `Error 400: redirect_uri_mismatch` apuntando a `localhost:3000` —
     faltaba la variable `NEXTAUTH_URL` en Netlify (nunca se había
     necesitado antes porque NextAuth infiere el host de la request para
     el login con credentials, pero no para armar la `redirect_uri` de
     un provider OAuth).
   - Rechazo de login (esperado, email sin cuenta) mostraba la página de
     error genérica de NextAuth en inglés en vez de volver a `/login` con
     el mensaje en español ya preparado — faltaba `error: '/login'` en la
     config de `pages` de `authOptions`. **PR #20**: agregado. Mergeado.
3. Validado en producción: login con un email de Google sin cuenta
   devuelve correctamente "Ese email de Google no tiene una cuenta en
   Fideliza". Un `OAuthCallback` intermedio durante las pruebas fue un
   código de autorización de Google reusado/vencido (reintento con "atrás"
   del navegador), no un problema de configuración — se resolvió solo al
   reintentar desde cero.
4. Se cerró el pendiente del sexto color de Peperina (`#37A1D`,
   incompleto): Cecilia decidió no perseguirlo, la paleta se queda con
   los 5 colores ya cargados.
5. **PR #23**: se conectó "Ajustes" del panel Admin, el último ítem del
   sidebar sin backend. Cecilia pidió usar criterio propio para el
   alcance — se implementó la versión mínima (email de acceso de solo
   lectura, mismo patrón que "Ajustes" del negocio), dejando afuera a
   propósito el cambio de contraseña del admin (hoy es fija por
   `ADMIN_PASSWORD_HASH`, variable de entorno; migrarla a la base es un
   cambio más grande de modelo de autenticación). Probado en el
   navegador con Postgres real, incluyendo el caso de estar dentro del
   panel de un negocio puntual (mismo patrón que Clientes/Canjes/
   Integraciones: muestra el Ajustes de ESE negocio, no el del Admin).
6. Cecilia confirmó que "los mini dibujitos" ya está resuelto (el color
   de resaltado en chips de puntos/avatares) — se cerró ese pendiente
   sin más cambios.
7. Explicando cómo se suman los puntos hoy (compra manual, Mercado Pago,
   Tiendanube, Dragon Fish), Cecilia planteó una preocupación de fondo:
   no quiere que el negocio tenga que cargar compra por compra a mano
   (no escala con miles de clientes) ni que la clienta tenga que hacer
   nada para sumar puntos. Eso destapó que "Cargar puntos con Mercado
   Pago" del panel de cliente estaba mal planteado desde el vamos: exigía
   que la clienta pagara *de nuevo*, a mano, el monto ya gastado. **PR
   #26**: se sacó ese botón/flujo del panel de cliente (UI, estado,
   handler); se dejó el backend intacto (`crear-preferencia`, webhook,
   config en "Integraciones") por si se rediseña como una integración
   real de cobro más adelante. Probado en el navegador con Postgres
   real: el panel de cliente pasa directo de "Tus puntos" a "Premios
   disponibles".
