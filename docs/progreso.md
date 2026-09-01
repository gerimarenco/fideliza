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
8. Mientras se espera la respuesta de Zoo Logic para destrabar Dragon
   Fish, se retomó un cabo suelto que no dependía de eso: el webhook de
   Tiendanube sumaba puntos sin dejar registro en `MovimientoPuntos` ni
   protección de idempotencia, a diferencia de Mercado Pago. **PR #28**:
   mismo patrón que Mercado Pago (transacción con `WebhookEvento` +
   `Cliente.update` + `MovimientoPuntos.create`), con
   `referenciaExterna` = `storeId:orderId` (el ID de orden de Tiendanube
   solo es único dentro de una tienda). Probado contra Postgres real
   ejecutando la misma transacción dos veces: la primera suma y registra,
   la segunda se detecta como duplicado sin volver a sumar.
9. Pedido de Cecilia: hover effects en el panel (botones, tarjetas, filas
   de listas, ítems de sidebar), con transiciones suaves. Se charló el
   criterio antes de tocar código (qué efecto para cada tipo de
   elemento, evitar recargar la UI). **PR #30**: 5 clases nuevas en
   `globals.css`, basadas en `transform`/`filter`/`box-shadow` en vez de
   colores fijos porque el panel de negocio/cliente usa colores
   dinámicos por `tema`. Se encontró y arregló un bug real probando: los
   botones "secundarios" y los ítems de sidebar siempre traen un
   `background` inline, que pisa cualquier `background-color` definido
   en una regla `:hover` de CSS — se resolvió usando `filter` para esos
   casos en vez de `background-color`. Probado en el navegador con
   Postgres real y Playwright, forzando `:hover` en las 5 categorías y
   comparando estilos computados antes/después.
10. Decidido con Cecilia: la idea del email de notificación queda en
    pausa a propósito hasta que se resuelva Dragon Fish — no tiene
    sentido diseñar el disparador sin saber cómo va a quedar la
    integración del local físico.
11. Se retomó el pendiente del check de deploy-preview de Netlify en
    rojo (conocido desde el PR #11). **PR #32**: en vez de la opción
    riesgosa (darle a los previews acceso a la base de producción real),
    se cambió el build command para que corra `prisma migrate deploy`
    solo si `DATABASE_URL` está presente — confirmado localmente que
    `next build` no necesita conexión a la base en absoluto. Probado el
    comando completo en los dos escenarios (con y sin `DATABASE_URL`).
12. Pedido de Cecilia: spinners de carga en vez de estados vacíos
    (listas de clientes/canjes/premios, estadísticas). **PR #34**:
    componente `Spinner` nuevo + animación `fid-spin` en `globals.css`.
    De paso se encontraron dos casos más del mismo problema que no
    estaban en el pedido original: los tres números de arriba del
    Inicio del admin mostraban "0" en vez de un estado de carga (parecía
    dato real), y la grilla de "Mis negocios" quedaba en blanco — ambos
    reutilizando el estado `loading`, que ya existía en el código pero
    nunca se leía en ningún lado. Probado en el navegador con Postgres
    real y Playwright, demorando artificialmente `/api/negocios` y
    `/api/negocios/estadisticas` para confirmar que los spinners
    aparecen, animan, y terminan resolviendo a los datos reales.
13. Cecilia pidió confirmar que el descuento de puntos al canjear
    funciona bien, con casos concretos a probar contra Postgres real
    (no solo revisar el código). El caso secuencial normal andaba
    perfecto (descuento exacto, bloqueo correcto por saldo insuficiente,
    `Canje` bien registrado) — pero se encontró un bug real no pedido:
    `POST /api/canjes` no usaba transacción, leía `cliente.puntos` y
    decrementaba en pasos separados. Se probó una condición de carrera
    disparando 8 canjes simultáneos contra un cliente con 1000 puntos y
    un premio de 600 (debía entrar 1 solo) — entraron 5-6 en 5 corridas
    de prueba, llegando a dejar a un cliente con **-2600 puntos** y 6
    canjes registrados. **PR #36**: arreglado con `cliente.updateMany`
    condicional (`puntos: { gte: premio.puntos }` en el `WHERE`) dentro
    de una transacción junto con la creación del `Canje` — mismo patrón
    que la idempotencia de Mercado Pago/Tiendanube, aplicado acá al
    descuento de puntos. Reproducido el mismo ataque después del fix:
    exactamente 1 de 8 entra en las 5 corridas, saldo y `Canje` exactos.
14. Pedido de Cecilia: confirmaciones visuales ("¡Listo!"/"✓ Guardado") en
    vez de que no pase nada visible después de guardar. **PR #38**:
    componente `Toast` único, auto-oculta solo (2.5s éxito, 4s error),
    colores fijos (no `tema`). Aplicado a sumar puntos, editar negocio,
    editar premio y cambiar contraseña. Se dejaron a propósito **fuera**
    del toast (siguen con `alert()` bloqueante en el éxito): crear
    cliente y crear negocio (el mensaje trae la contraseña generada) y
    canjear premio (el mensaje es un comprobante que la clienta necesita
    mostrar). Probado en el navegador con Postgres real y Playwright.

## 2026-08-30 — Dragon Fish: agente local construido, bloqueado en 3 datos de la API real

Cecilia avisó que el soporte de Zoo Logic respondió (parcialmente) la
consulta sobre cómo traer la factura completa por `Codigo`. La respuesta
confirmó que `/facturagrupada/{Codigo}` agrupa los tres tipos de
comprobante (factura manual, electrónica, fiscal — no hace falta
ramificar por `Entidad`), pero no incluyó host/puerto de la API,
autenticación, dónde va el "número de serie" que piden mandar siempre, ni
un ejemplo de la respuesta (remitieron a un swagger no compartido).

Con esa respuesta parcial, se construyó toda la parte de Fideliza que no
depende de esos 3 datos faltantes, siguiendo la arquitectura ya acordada
en sesiones previas (agente local con polling, sin exponer la red del
negocio):

1. **Prisma**: tabla `FacturaPendiente` (`negocioId`, `codigo`, `entidad`,
   `fecha`, `hora`, `procesado`, `resultado`), única por
   `(negocioId, codigo)`; campos `Negocio.dragonfishBaseDeDatos` (mapea
   `BaseDeDatos` del webhook a un negocio, análogo a `tiendanubeStoreId`)
   y `Negocio.dragonfishAgentToken` (token propio para autenticar al
   agente, análogo a `tiendanubeAccessToken` pero generado por Fideliza).
2. **Webhook reescrito** (`/api/webhooks/dragonfish`): pasa de solo
   loguear a insertar una fila en `FacturaPendiente`, filtrando por
   `Entidad` (solo tipos de comprobante de venta — Dragon Fish también
   manda webhooks de otras entidades) y deduplicando reenvíos vía la
   restricción única.
3. **`GET /api/dragonfish/pendientes`**: el agente pregunta qué facturas
   quedaron pendientes. Autenticación propia por `Authorization: Bearer
   <dragonfishAgentToken>` en vez de sesión de NextAuth, porque no hay un
   usuario logueado del otro lado (`lib/dragonfishAgente.js`, compartido
   con el endpoint de abajo).
4. **`POST /api/dragonfish/resolver`**: el agente reporta
   `{codigo, monto, email/telefono}`. Dispara la misma transacción de
   idempotencia que Mercado Pago/Tiendanube (`WebhookEvento` +
   `Cliente.update` + `MovimientoPuntos.create`), con un segundo nivel de
   idempotencia (`FacturaPendiente.procesado`) para el caso de que el
   agente reintente un reporte. Si falta el monto o la identificación de
   cliente, o no matchea ningún cliente registrado, marca `resultado`
   (`sin_datos`/`sin_cliente`) sin sumar puntos ni dejar la factura
   reintentando para siempre.
5. **"Integraciones"**: la card de Dragon Fish, antes fija en "Bloqueada"
   sin ningún campo, ahora tiene un input para `dragonfishBaseDeDatos` y
   un botón "Generar/Regenerar token del agente" (con confirmación si ya
   había uno, porque regenerarlo corta al agente que esté usándolo) — el
   token se muestra una sola vez en un `alert()`, mismo patrón que una
   contraseña generada.
6. **Agente local** (`dragonfish-agente/`, script de Node aparte de la
   app — corre en la PC del negocio, no se deploya con el resto): ciclo
   de polling completo y probado (`pedirPendientes`/`reportarResultado`).
   La función que consulta la API real de Dragon Fish
   (`consultarDragonfish`) quedó con placeholders documentados con TODO
   para los 3 datos que todavía faltan — no se asumió nada no confirmado,
   siguiendo el criterio ya establecido en sesiones anteriores para esta
   integración.

Probado en el navegador contra Postgres real (negocio y cliente de
prueba sembrados a mano) y con `curl` directo a los endpoints nuevos:
el ciclo completo webhook → `FacturaPendiente` pendiente → agente la
levanta por `GET /pendientes` → reporta con `POST /resolver` → cliente
recibe los puntos exactos (`monto / puntosXPeso`) con un
`MovimientoPuntos` (`origen: "dragonfish"`) registrado. Se probaron
también los casos de reenvío de webhook duplicado, reporte duplicado del
agente (no vuelve a sumar), entidad no-factura ignorada, y factura sin
cliente matcheado (marca `sin_cliente`, no rompe ni reintenta para
siempre). En el navegador (Playwright, login real): la card de Dragon
Fish en "Integraciones" muestra "Conectada" y el flujo de generar token
funciona de punta a punta.

**PR #40 mergeado a `main`.**

## 2026-08-31 — Dragon Fish: implementación real del agente contra la API de Zoo Logic

Zoo Logic contestó dos veces más en el mismo hilo de mail. La primera
respuesta aclaraba que el "número de serie" no es un parámetro de la API
sino un dato para identificar la cuenta al escribirles por mail — un
primer malentendido llevó a redactar una pregunta de más, hasta darse
cuenta de que en realidad estaban pidiendo el número de serie de la
instalación de Dragon Fish de Peperina. Se armó un mensaje para que
Cecilia se lo pidiera a su mamá (guía paso a paso de dónde encontrarlo en
el programa), se consiguieron los dos números de serie (una por PC:
`706112` y `803677`) y se reenviaron a Zoo Logic.

La segunda respuesta trajo la documentación completa: un PDF de 16
páginas ("Documentación API", actualización agosto 2026) y el swagger
real de la versión actual (`v16.0004.14968`, ~600 endpoints). Con eso se
pudo terminar `consultarDragonfish` en `dragonfish-agente/index.js` de
punta a punta, reemplazando los placeholders de la sesión anterior:

- **Endpoint confirmado por el swagger**: `GET /Facturaagrupada/{Codigo}/`
  (con mayúscula y barra final — no `/facturagrupada/` como se había
  asumido). Devuelve `Total` (monto) y `Email`. Si la factura no trae
  email cargado, se agregó un segundo pedido a
  `GET /Cliente/{Codigo}/` (usando el código de cliente que trae la
  factura) para sacar `EMail`/`Telefono` de la ficha del cliente — no
  estaba en el plan original, se descubrió revisando el schema completo
  del swagger que la ficha de cliente sí tiene esos campos aunque la
  factura no los traiga siempre.
- **Autenticación confirmada por el PDF**: headers `IdCliente` +
  `Authorization` (el JWToken) en cada consulta a la API, más un paso
  previo de `POST /Autenticar` que hay que hacer una sola vez al arrancar
  (no en cada consulta) — agregado como función `autenticarDragonfish`,
  llamada al inicio del agente antes de arrancar el polling.
- **Cómo se consiguen las 3 variables de entorno nuevas**
  (`DRAGONFISH_BASE_URL`, `DRAGONFISH_ID_CLIENTE`, `DRAGONFISH_TOKEN`):
  documentado paso a paso en `dragonfish-agente/README.md` a partir de la
  guía de configuración del PDF (Servicio REST API → Cliente REST API →
  Obtener Token). Se marcó explícitamente que el token depende de la
  versión de Dragon Fish instalada: las versiones viejas (probablemente
  el caso de Peperina, avisado por el propio Zoo Logic que tiene más de 2
  años sin actualizar) necesitan que Mesa de Ayuda (77005700) lo genere
  por teléfono, dando el código y clave privada del Cliente REST API más
  usuario/contraseña de Dragon Fish.

Se armó un mock HTTP local (dos servidores de prueba: uno simulando
Dragon Fish, otro simulando los endpoints de Fideliza) para validar el
agente completo sin depender de la instalación real de Peperina —
confirmando dos casos: una factura con email cargado (matchea directo) y
una factura sin email que dispara la consulta de fallback a `/Cliente/`
y trae el teléfono. En ambos casos el ciclo completo (autenticar →
consultar factura → reportar a Fideliza → puntos acreditados) se
verificó de punta a punta, incluidos los headers exactos que la API real
va a esperar (`IdCliente`, `Authorization`, body de `/Autenticar`).

Con este avance, ya no queda ninguna incógnita técnica de la integración
con Dragon Fish — lo único que falta es específico de la instalación de
Peperina (las 3 variables de entorno, que salen de configurar el sistema
en esa PC) y no depende más de que Zoo Logic responda algo.

De paso, charlando con Cecilia sobre el diseño a futuro, surgieron dos
temas que se dejaron pendientes a propósito para más adelante (no se
tocó código): creación automática de cuenta de cliente a partir de los
datos de una venta (ella lo quiere hablar primero con su mamá), y
rediseño de Mercado Pago por negocio (cuenta propia vía Point/QR, mismo
patrón que Tiendanube) para negocios futuros sin Dragon Fish — se
descartó en la misma charla el miedo de un doble conteo de puntos para
Peperina (MP de Fideliza está atado a la cuenta de la plataforma, no a
la de Peperina, y nada en la UI dispara ese flujo desde el PR #26).

## 2026-09-01 — Zoo Logic destraba el token, bug de foco encontrado y arreglado, bono de bienvenida (PR #41)

1. Zoo Logic contestó (por mail, tras pedirle a la mamá de Cecilia el
   número de serie de la instalación de Dragon Fish) con la documentación
   completa de la API y su swagger real. **PR #41**: se terminó
   `consultarDragonfish` contra el contrato real (`GET
   /Facturaagrupada/{Codigo}/`, fallback a `GET /Cliente/{Codigo}/` para
   email/teléfono si la factura no los trae, autenticación por headers
   `IdCliente`/`Authorization` con un chequeo de `POST /Autenticar` al
   arrancar). Ver `tareas-pendientes.md` para el detalle técnico completo.
2. Guiada paso a paso por WhatsApp (con fotos de la pantalla de Dragon
   Fish en el local), la mamá de Cecilia armó el "Servicio REST API" y el
   "Cliente REST API" en Dragon Fish, y consiguió el token real llamando a
   Mesa de Ayuda de Zoo Logic (versión de Dragon Fish `v14.0006.14379`, de
   las que no permiten autogenerar el token desde el propio programa).
   Con eso Cecilia cargó desde el panel de Fideliza el `dragonfishBaseDeDatos`
   y generó el `FIDELIZA_AGENT_TOKEN` real de Peperina — quedan los 4
   datos reales del agente listos, solo falta instalarlo en la PC del
   local (con AnyDesk, coordinado para cuando la mamá esté de vuelta).
3. **Bug real encontrado por Cecilia**: al escribir "PEPERINA" a mano en
   el campo nuevo de Dragon Fish (Integraciones), el campo perdía el foco
   en cada letra — había que hacer clic de nuevo para cada carácter.
   Causa: `PanelNegocio`, `PanelCliente` y las 6 pantallas "VistaX"
   (Canjes, Clientes, Premios, Integraciones, Ajustes, AjustesAdmin)
   estaban definidas como funciones dentro del propio componente `Home` e
   invocadas como componentes JSX (`<VistaX />`) — cada tecla actualiza
   estado en `Home`, redefiniendo esas funciones como referencias nuevas
   en cada render, y React las trataba como un tipo de componente
   distinto, remontando el árbol entero. **PR #41**: se solucionó
   invocándolas como funciones planas (`VistaX()`) en vez de elementos
   JSX. Afectaba a cualquier input de esas pantallas tecleado a mano (no
   pegado) — probablemente no se había notado antes porque la mayoría de
   esos campos se pegan. Probado con Playwright tecleando carácter por
   carácter con delay (simulando una persona escribiendo real).
4. Cecilia pidió investigar el programa de fidelización "Friends" de
   Portsaid (mandó el link de un producto de su sitio) para sacar ideas.
   Se investigó vía búsqueda web (el dominio de Portsaid está bloqueado
   para fetch directo desde el sandbox) — acumulan 10 puntos cada $100
   ($1 c/u), canjeables como descuento de hasta 50% de una compra futura
   (no premios fijos), vencen a los 6 meses con recordatorio por mail, dan
   un bono de bienvenida al registrarse, y piden identificarse con DNI en
   caja. De las 4 ideas identificadas, se marcó cuál se podía construir
   ya y cuál necesitaba una decisión de diseño antes:
   - **Bono de bienvenida**: sin ninguna vuelta, se construyó ya
     (`Negocio.puntosBienvenida`, default 0 = sin cambio para negocios
     existentes; se acredita en `POST /api/registro/[negocio]` y `POST
     /api/clientes` con una transacción interactiva de Prisma —
     `MovimientoPuntos` necesita el id del cliente recién creado, así que
     no alcanza con un array de transacción simple; editable desde
     "Ajustes"). Probado contra Postgres real: auto-registro y alta
     manual acreditan el bono configurado, un negocio sin bono
     configurado (default 0) no genera ningún `MovimientoPuntos` de más,
     y el campo nuevo en "Ajustes" no tiene el bug de foco del punto 3
     (probado con Playwright tecleando de a un carácter).
   - **Vencimiento de puntos**, **canje como descuento flexible** y
     **tope de descuento**: quedaron pendientes de que Cecilia confirme
     el alcance (el vencimiento necesita el servicio de email que todavía
     no existe para el recordatorio; el descuento flexible solo sería
     viable en compra manual, no en las automáticas). Ver
     `tareas-pendientes.md`.
