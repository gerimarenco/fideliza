# Sesión actual — 2026-08-27

> Continuación directa de la sesión anterior (PRs #10 a #18, ver
> `progreso.md`). Arrancó con un pedido puntual de Cecilia (mostrar/
> ocultar contraseña y login con Google) y se extendió: cierre de varios
> pendientes menores, una charla sobre cómo se suman los puntos que
> terminó sacando una función mal planteada, un fix de idempotencia, y
> hover effects en todo el panel. Reconstruido del propio hilo de la
> conversación.

## 1. Alcance acordado antes de tocar código

Dos preguntas se resolvieron con Cecilia antes de escribir nada, porque
cambiaban el diseño:

- **¿Para quién es el login con Google?** Cecilia eligió: para los tres
  roles (admin, negocio y cliente), no solo para uno.
- **¿Qué pasa si el email de Google no tiene cuenta creada?** Se eligió
  **rechazar el login** (no crear una cuenta nueva automáticamente) — más
  seguro, evita cuentas fantasma, y evita tener que decidir a qué negocio
  asignaría un `Cliente` creado sobre la marcha.

## 2. Implementación (PR #19)

- `app/login/page.js`: botón "Mostrar"/"Ocultar" dentro del campo de
  contraseña del form de credentials; botón nuevo "Iniciar sesión con
  Google" arriba del form (icono SVG inline, sin dependencias nuevas);
  manejo de `?error=AccessDenied` en la URL para mostrar el mensaje en
  español.
- `lib/auth.js`: `GoogleProvider` agregado al array de `providers`, mismo
  patrón defensivo que otras integraciones opcionales — solo se agrega si
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` están seteadas, así el botón
  no rompe nada si faltan. Callback `signIn` nuevo: busca el email de la
  cuenta de Google contra `ADMIN_EMAIL` → `Negocio.email` →
  `Cliente.email`, en ese orden, y asigna `user.id`/`user.role` al
  encontrar match (mutando el objeto `user` in-place, que NextAuth
  después pasa igual al callback `jwt`); si no encuentra nada, devuelve
  `false` (rechaza el login).
- README actualizado con las dos variables de entorno nuevas
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) y la redirect URI a
  autorizar en Google.
- Validado con `npm run build` antes de mergear (no había forma de probar
  el flujo de Google real desde el sandbox, sin credenciales). **PR #19
  mergeado.**

## 3. Setup real en Google Cloud + Netlify (soporte paso a paso a Cecilia)

Cecilia no tiene perfil técnico, así que se la guio paso a paso, pidiendo
capturas de pantalla en cada paso para confirmar dónde estaba parada:

1. Crear proyecto "Fideliza" en Google Cloud Console.
2. Configurar la pantalla de consentimiento OAuth ("Google Auth
   Platform" en la UI actual) como tipo "Externo".
3. Crear el cliente de OAuth ("Fideliza Web", tipo "Aplicación web") con
   la redirect URI:
   `https://incomparable-zabaione-b58c21.netlify.app/api/auth/callback/google`.
4. Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` como variables de
   entorno en Netlify. Al marcar el secret como sensible, Netlify obliga
   a elegir valor por contexto de deploy (no permite "same value for
   all") — se cargó el mismo valor en Production, Deploy Previews y
   Branch deploys, con scope Builds+Functions+Runtime (el scope por
   defecto ya incluía Functions/Runtime, no fue necesario tocarlo).
5. Redeploy manual (`Trigger deploy`) para que tomaran efecto.

## 4. Dos bugs reales encontrados probando en producción

Probar el flujo real destapó dos problemas que no aparecían en el build
local (porque requerían la infraestructura real de Netlify + Google):

1. **`Error 400: redirect_uri_mismatch`**, con el detalle mostrando
   `redirect_uri=http://localhost:3000/api/auth/callback/google`. Causa:
   faltaba la variable `NEXTAUTH_URL` en Netlify — nunca se había
   necesitado antes porque el login con credentials no depende de ella
   (NextAuth infiere el host de la propia request), pero armar la
   `redirect_uri` que se le manda a un provider OAuth sí la necesita
   explícita. Se agregó con el valor de producción y se redeployó.
2. Con la redirect URI ya corregida, el rechazo de un email sin cuenta
   (comportamiento esperado) mostraba la página de error genérica de
   NextAuth en inglés ("Access Denied — You do not have permission to
   sign in") en vez de volver a `/login` con el mensaje en español ya
   preparado. Causa: `pages` en `authOptions` solo tenía `signIn`
   configurado, no `error` — sin eso, NextAuth usa su página de error
   por defecto para cualquier rechazo, no reusa la de `signIn`.
   **PR #20**: se agrega `error: '/login'`. Mergeado y redeployado.

De paso, un tercer síntoma (`?error=OAuthCallback`) resultó ser una falsa
alarma: un código de autorización de Google reusado por reintentar con
"atrás" del navegador en vez de arrancar el flujo de cero — se resolvió
solo al reintentar limpio, sin cambiar nada de configuración.

## 5. Validado en producción

Con las dos correcciones en producción, Cecilia probó el flujo real:
login con Google con un email sin cuenta existente → redirige
correctamente a `/login?error=AccessDenied` y muestra "Ese email de
Google no tiene una cuenta en Fideliza". Confirmado visualmente.

Queda sin probar el caso de éxito (un email de Google que sí coincide
con una cuenta existente) — no había a mano un email de prueba que
matcheara. Ver `tareas-pendientes.md`.

Se documentó todo lo anterior en `docs/` (PR #21) y, de paso, Cecilia
avisó que no hace falta seguir esperando el sexto color de la paleta de
Peperina (`#37A1D`, incompleto) — se cerró ese pendiente sin cargarlo
(PR #22).

## 6. "Ajustes" del panel Admin (PR #23)

Único ítem del sidebar que quedaba sin conectar (`id: null`, decorativo,
ver `contexto-proyecto.md` de sesiones previas). Se le preguntó a
Cecilia qué debería incluir — respondió "hacé lo que mejor te parezca".

Se optó por la versión mínima y de menor riesgo, en vez de asumir algo
más grande: `VistaAjustesAdmin`, una vista nueva con un solo bloque
("Cuenta" → email de acceso, solo lectura), sin `tema` (el chrome del
Admin nunca se tematiza, a diferencia de `PanelNegocio`/`PanelCliente`).
Mismo patrón visual que ya usaba "Ajustes" del negocio para su bloque de
"Cuenta".

Se decidió **no** incluir cambio de contraseña del admin: hoy sale de
`ADMIN_PASSWORD_HASH` (variable de entorno en Netlify), no de la base de
datos — habilitarlo requeriría migrar ese modelo (guardar el hash en
`Negocio`/una tabla nueva de admins), un cambio de arquitectura de auth
más grande que no correspondía meter sin que lo pidan explícitamente.
Tampoco se inventó una sección de "configuración general de la app": no
hay ningún ajuste global concreto identificado en el código que hoy no
tenga dónde vivir.

Conexión al sidebar: se cambió el id de `null` a `'ajustes'` en el array
del sidebar del Admin, y se agregó una rama de render nueva
(`!negocioActivo && seccionActiva === 'ajustes'`) antes de la grilla de
negocios. Verificado que, dentro del panel de un negocio puntual, el
mismo botón de sidebar sigue mostrando el "Ajustes" de *ese* negocio
(`VistaAjustes`, con cambio de contraseña y `puntosXPeso`) en vez del
del Admin — es el comportamiento ya existente para Clientes/Canjes/
Integraciones, no algo nuevo que haya que arreglar.

Probado en el navegador levantando Postgres local (`pg_ctlcluster`) y
corriendo migraciones reales, con Playwright headless contra
`/opt/pw-browsers/chromium`: login como admin de prueba, click en
"Ajustes" desde la grilla general, capturas confirmando que muestra el
email de la sesión.

Cecilia confirmó de paso que "los mini dibujitos" ya está resuelto — se
cerró ese pendiente sin más cambios (PR #25).

## 7. Cómo se suman los puntos hoy, y por qué "Mercado Pago" del cliente no servía (PR #26)

Antes de arrancar con la idea de notificar por email, Cecilia pidió que
se le explicara cómo funciona hoy la suma de puntos. Se repasaron las
cuatro formas (compra manual, Mercado Pago, Tiendanube, Dragon Fish) con
la fórmula `puntos = piso(monto / puntosXPeso)`, y se marcó un cabo
suelto ya conocido: el webhook de Tiendanube no escribe en
`MovimientoPuntos` ni tiene protección de idempotencia, a diferencia de
Mercado Pago — relevante para cuando se diseñe qué dispara el email.

De ahí surgieron dos objeciones de fondo de Cecilia, con un ejemplo
concreto (clienta compra una remera de $30.000 en Peperina con Mercado
Pago):

- **No quiere que el negocio cargue compra por compra a mano** — con
  miles de clientes, la carga manual sería una carga operativa, no un
  beneficio.
- **Tampoco quiere que la clienta tenga que hacer nada** para sumar
  puntos — ni entrar a la app, ni ningún paso extra.

Revisando el código de "Cargar puntos con Mercado Pago" (panel de
cliente) a la luz de ese ejemplo, se destapó que **nunca representó un
cobro real**: genera una preferencia de pago nueva por el mismo monto
que la clienta ya gastó, y se lo cobra *de nuevo*, a la cuenta de
Mercado Pago de la plataforma (no la de Peperina) — recién ahí suma los
puntos. Con el ejemplo de la remera: la clienta terminaría pagando
$60.000 en vez de $30.000 para que el sistema le "crea" que compró algo.
Va exactamente en contra de los dos objetivos de arriba.

Se le preguntó a Cecilia qué hacer al respecto — eligió sacarlo del
panel de cliente. **PR #26**: se borró el bloque de UI, el estado
(`montoPago`, `generandoPago`) y el handler (`iniciarPago`) de
`PanelCliente`. Se dejó el backend intacto (`POST
/api/mercadopago/crear-preferencia`, el webhook, la config de
"Integraciones" del negocio) — no se pidió borrarlo, y sirve como base
si en algún momento se rediseña como una integración real de cobro
(mismo patrón que Tiendanube: el pago pasa por el checkout real del
negocio, un solo cobro, sin pasos extra en Fideliza).

Los dos caminos que sí cumplen "cero acción de la clienta y cero carga
para el negocio" siguen siendo Tiendanube (ya andando) y Dragon Fish
(bloqueado esperando a Zoo Logic) — quedó explícito que destrabar Dragon
Fish es el paso que de verdad importa para el volumen real del local
físico de Peperina, más que cualquier ajuste al lado de Mercado Pago.

Probado en el navegador contra Postgres real (cliente de prueba
sembrado a mano): el panel de cliente pasa directo de "Tus puntos" a
"Premios disponibles", sin rastro del bloque de Mercado Pago.

## 8. Idempotencia y MovimientoPuntos para el webhook de Tiendanube (PR #28)

Con Dragon Fish todavía bloqueado esperando a Zoo Logic, se retomó el
cabo suelto marcado en el punto anterior: el webhook de Tiendanube sumaba
puntos pero no dejaba registro en `MovimientoPuntos` ni tenía protección
contra reenvíos duplicados, a diferencia de Mercado Pago.

Se aplicó el mismo patrón que ya usaba Mercado Pago: `WebhookEvento` +
`Cliente.update` + `MovimientoPuntos.create` en una sola transacción de
Prisma; si Tiendanube reenvía la misma notificación, la restricción
única de `WebhookEvento` hace fallar la transacción entera (`P2002`) y
no se duplica nada. Un detalle a tener en cuenta: `referenciaExterna` se
armó como `storeId:orderId` (no solo `orderId`), porque el ID de orden
de Tiendanube solo es único dentro de una tienda — dos negocios
distintos podrían tener órdenes con el mismo número.

No se pudo probar el webhook real end-to-end (requiere una tienda de
Tiendanube activa y su API, que no está disponible desde el sandbox),
así que se validó la lógica de la transacción directamente contra
Postgres real: se ejecutó dos veces con la misma referencia — la primera
suma los puntos y crea el `MovimientoPuntos`, la segunda se detecta como
duplicado sin volver a sumar ni duplicar el registro.

Con esto, los tres orígenes de puntos que ya están en producción
(manual, Mercado Pago, Tiendanube) quedan alimentando `MovimientoPuntos`
de forma consistente — relevante para cuando se diseñe qué dispara el
email de notificación.

## 9. Hover effects en todo el panel (PR #30)

Pedido nuevo de Cecilia, sin relación con lo anterior: efectos de hover
suaves en botones, tarjetas y otros elementos interactivos. Antes de
tocar código se le propuso un criterio por tipo de elemento (qué efecto
para botones primarios vs. secundarios vs. destructivos, tarjetas, filas
de listas, ítems de sidebar) y se esperó su confirmación ("dale arrancá
con eso") en vez de asumir.

Decisión técnica clave antes de escribir CSS: como el panel de negocio/
cliente usa colores dinámicos (`tema`, la marca propia de cada negocio —
Peperina tiene su propia paleta), los efectos no podían usar colores
fijos de hover. Se resolvió con `transform`/`filter`/`box-shadow`, que
se ven bien sobre cualquier paleta sin necesidad de conocer el color
exacto de antemano.

Se agregaron 5 clases en `globals.css` (`fid-btn-primary`,
`fid-btn-secondary`, `fid-card-hover`, `fid-row-hover`,
`fid-sidebar-item`) y se les puso `className` a los ~31 botones, las
tarjetas de negocio/premio disponible, las filas de listas (clientes,
canjes, premios del negocio) y los ítems de los dos sidebars — es la
primera vez que `app/page.js` usa `className` en vez de depender
exclusivamente de estilos inline. Se dejaron sin hover las tarjetas
puramente informativas sin acción asociada (ej. "Próximos premios"
bloqueados), para no sugerir interactividad donde no la hay.

**Bug real encontrado probando en el navegador**: los botones
"secundarios" (outline) y los ítems de sidebar siempre traen un
`background` fijo en el estilo inline (`tema.superficie`, `'#fff'`,
`'transparent'`) — como un estilo inline siempre le gana a una regla de
un stylesheet externo para la misma propiedad, el `background-color`
del hover en CSS quedaba completamente bloqueado en esos casos (se
notó al testear con Playwright: el color computado no cambiaba en
absoluto al hacer hover). Se resolvió de dos formas distintas según el
caso:
- Botones secundarios: pasa a usar `filter: brightness(0.94)` en el
  hover en vez de `background-color` — es una propiedad CSS distinta,
  no hay conflicto con el `background` inline.
- Ítems de sidebar: el `background` inline del estado no-activo pasa de
  `'transparent'` a `undefined` — en React, una propiedad de estilo en
  `undefined` no se renderiza, así que el `background-color` de la
  regla `:hover` del stylesheet puede aplicar sin competencia. El
  estado activo sigue fijando su color inline sin cambios.

Probado en el navegador contra Postgres real, con Playwright forzando
`:hover` programáticamente (`locator.hover()`) en cada una de las 5
categorías y comparando el estilo computado (`getComputedStyle`) antes y
después — incluyendo la vuelta atrás después de encontrar el bug de los
botones secundarios, para confirmar que el fix realmente lo resolvía
(el primer intento de prueba mostró `filter: none` tanto antes como
después del hover, lo que llevó a encontrar que faltaba limpiar la
caché de build de Next — `rm -rf .next` — para que tomara el CSS nuevo).

## Archivos nuevos/tocados en esta sesión

- `app/login/page.js` — toggle de contraseña, botón de Google, manejo de
  `?error=`.
- `lib/auth.js` — `GoogleProvider`, callback `signIn`, `pages.error`.
- `README.md` — variables de entorno nuevas documentadas.
- `app/page.js` — `VistaAjustesAdmin`, sidebar del Admin conectado;
  después, se saca el bloque de "Cargar puntos con Mercado Pago" del
  panel de cliente (UI + estado + handler).
- `app/api/webhooks/tiendanube/route.js` — idempotencia +
  `MovimientoPuntos`.
- `app/globals.css` — 5 clases de hover nuevas.
- `docs/` — actualizaciones sucesivas (PRs #21, #24, #27, #29 y esta),
  más el cierre de tres pendientes (sexto color, mini dibujitos, y la
  nota sobre Mercado Pago).

## 10. Probando el login con Google, decisión de orden, y el check de Netlify (PR #32)

Se intentó probar el caso de éxito del login con Google (un email que sí
matchea una cuenta) con el admin — quedó a mitad de camino, sin
confirmar todavía.

Cecilia confirmó que la idea del email de notificación queda **a
propósito en pausa** hasta que se resuelva Dragon Fish (no tiene sentido
diseñar el disparador sin saber cómo va a quedar esa integración) —
dijo explícitamente que no quería avanzar ni con esa idea ni con
Dragon Fish en este momento (bloqueado externamente, esperando a Zoo
Logic).

Pidió "hagamos lo que te parezca" entre los pendientes menores que
quedaban (Tiendanube pausado, límite de Netlify en Deploy Previews,
tema visual autogestionable). Se eligió el de Netlify por ser el único
con una solución concreta de bajo riesgo y sin depender de nada externo
— Tiendanube no tiene nada útil para avanzar sin una tienda activa, y el
tema autogestionable es especulativo hasta que haya un segundo negocio
real usando marca propia (ya apuntado explícitamente en sesiones
previas).

Antes de tocar nada se probó localmente si `next build` necesita
conexión a la base — no la necesita (la app es 100% client-side, ninguna
ruta se pre-renderiza contra Postgres). Con eso confirmado, **PR #32**:
el build command de `netlify.toml` corre `prisma migrate deploy` solo
si `DATABASE_URL` está presente, en vez de la alternativa que había
quedado pendiente de evaluar (darle a los Deploy Previews acceso a la
base de producción real, con sus riesgos). Probado localmente el
comando completo en los dos escenarios (con y sin `DATABASE_URL`).

## 11. Spinners de carga en vez de estados vacíos (PR #34)

Pedido nuevo de Cecilia: cuando algo tarda en cargar (lista de clientes,
estadísticas), mostrar un ícono girando en vez de que se vea vacío por
un segundo. Se agregó un componente `Spinner` reutilizable (usa
`currentColor` para heredar el color por `style`, así funciona con
cualquier `tema` de marca propia) y una animación `fid-spin` nueva en
`globals.css`.

Se reemplazaron los 7 lugares donde el pedido aplicaba directamente: las
tres listas paginadas (Canjes, Clientes, Premios del negocio, que
mostraban texto "Cargando..." plano) y los tres tiles de "Este mes"
(estadísticas del negocio, que mostraban un guión `'—'`).

Probando en el navegador con una carga demorada artificialmente
(Playwright interceptando `/api/negocios` y `/api/negocios/
estadisticas`), aparecieron dos casos más del mismo problema que no
estaban en el pedido original pero eran exactamente lo mismo:

- Los tres números de arriba de todo en el **Inicio del admin**
  (Negocios activos, Clientes registrados, Puntos en circulación)
  mostraban **"0"** mientras `negocios` todavía era el array vacío
  inicial — peor que verse vacío, parecía un dato real (cero negocios)
  en vez de "todavía no sabemos".
- La grilla de **"Mis negocios"** quedaba directamente en blanco, sin
  ningún indicio de que algo estaba cargando.

Para estos dos se reutilizó el estado `loading` — ya existía en el
código (`useState(true)`, seteado a `false` al final de
`cargarNegocios`), pero no se leía en ningún lado de la UI, un resabio
sin usar. También se separó un caso ambiguo: "No encontramos tus datos
de cliente." (cuando un cliente entra directo, sin admin de por medio)
mezclaba el estado de carga real con un mensaje de error genuino; ahora
usa `negocios.length === 0` como señal de que la carga inicial todavía
no terminó, y solo muestra el mensaje de error si ya cargó y
efectivamente no hay match.

Probado en el navegador contra Postgres real con Playwright: se
interceptaron las rutas mencionadas para demorarlas 3 segundos,
confirmando que los spinners aparecen y animan (`animation-name:
fid-spin`) durante la espera, y que todos terminan resolviendo a los
datos reales sin quedar colgados (se esperó explícitamente más tiempo
que el delay simulado para confirmarlo).

## 12. Verificando el canje de puntos, se encontró un double-spend real (PR #36)

Cecilia pidió confirmar específicamente que el descuento de puntos al
canjear funciona bien, con un caso concreto (1000 puntos, canjea premio
de 400, ¿quedan 600 exactos?) y pidió explícitamente que se probara
contra Postgres real, no solo revisando el código, mostrando el
resultado antes de decir que estaba todo bien.

Se sembraron datos de prueba reales (negocio, cliente con 1000 puntos,
premios de 400 y 1500) y se probó `POST /api/canjes` vía HTTP real, con
una sesión de cliente real logueada por Playwright (no se bypaseó la
auth). El caso secuencial pedido anduvo perfecto: descuento exacto
(1000 → 600), bloqueo correcto con `400 Puntos insuficientes` al
intentar un premio de 1500 con 600 disponibles (sin tocar el saldo), y
el `Canje` quedó registrado con `clienteId`/`premioId`/`createdAt`
correctos — todo confirmado leyendo directo de Postgres, no solo la
respuesta del endpoint.

Revisando el código para armar la prueba, se notó que `POST /api/canjes`
no envolvía la validación de saldo y el decremento en una transacción
(a diferencia del webhook de Mercado Pago) — leía `cliente.puntos`,
comparaba, y recién después actualizaba, en pasos separados. Se decidió
probar esa sospecha en vez de solo señalarla: disparando 8 canjes
simultáneos (`Promise.all`, sin esperarse entre sí) contra un cliente
con 1000 puntos y un premio de 600 (debía entrar 1 solo), se coló entre
5 y 6 en las 5 corridas de prueba. En un caso, el cliente terminó con
**-2600 puntos** y **6 canjes registrados** en la base — un double-spend
real y fácilmente reproducible, no un caso hipotético.

Se mostró el resultado completo de esta prueba (HTTP + verificación
directa en Postgres) antes de proponer el fix, tal como se pidió. Con
la confirmación de Cecilia, **PR #36**: la validación de saldo pasa a
ser parte del propio `UPDATE` (`cliente.updateMany` con
`puntos: { gte: premio.puntos }` en el `WHERE`), envuelto junto con la
creación del `Canje` en una transacción de Prisma — Postgres serializa
los `UPDATE` concurrentes sobre la misma fila, así que el segundo pedido
recién evalúa el saldo después de que el primero ya confirmó su
descuento. Mismo patrón que ya usaban Mercado Pago y Tiendanube para su
propia idempotencia, aplicado acá al descuento de puntos en sí. De paso
se agregó el chequeo de `!premio` (antes tiraba un error sin manejar si
el `premioId` no existía).

Repetido el mismo ataque de 8 canjes simultáneos contra 5 clientes
distintos después del fix: entró exactamente 1 en las 5 corridas, cada
cliente quedó en 400 puntos (1000 − 600) con 1 solo `Canje` registrado.
Repetido también el caso secuencial original para confirmar que no hubo
regresión: mismo resultado exacto que antes del cambio.

## 13. Confirmaciones visuales (toast) para las acciones principales (PR #38)

Pedido de Cecilia: un mensajito tipo "¡Listo!"/"✓ Guardado" que aparece y
desaparece solo, en vez de que no pase nada visible después de guardar.
Pidió el plan antes de tocar código: cómo se implementaría (¿un
componente reutilizable o algo por pantalla?) y si convenía agregar
también el caso de error.

Se propuso un componente `Toast` único para toda la app (no uno por
pantalla), con colores fijos —no atados a `tema`— para verse igual en
el chrome del Admin (que nunca se tematiza) y en los paneles con marca
propia, y se recomendó sí agregar el caso de error, con más tiempo en
pantalla que el de éxito para dar lugar a leer el mensaje.

Revisando las 7 acciones pedidas (sumar puntos, crear cliente, crear
negocio, canjear premio, editar negocio, editar premio, cambiar
contraseña) apareció una distinción importante que se sumó al plan
antes de codear: en **crear cliente**, **crear negocio** y **canjear
premio**, el mensaje de éxito de hoy no es una simple confirmación —
trae la contraseña generada (que hay que copiar) o funciona como
comprobante de canje (que la clienta necesita mostrarle al negocio). Un
toast que se auto-oculta a los 2-3 segundos sería activamente malo en
esos tres casos. Cecilia confirmó el criterio completo, incluido dejar
"canjear premio" como estaba.

**PR #38**: componente `Toast` + función `mostrarToast(tipo, mensaje)`,
con un `setTimeout` que se limpia y reinicia si llega un toast nuevo
antes de que termine el anterior. Aplicado a las 4 acciones sin la
restricción de arriba (sumar puntos, editar negocio, editar premio,
cambiar contraseña) — dos de ellas (editar negocio, editar premio) no
tenían ninguna confirmación de éxito antes, quedaban en silencio.
Crear cliente, crear negocio y canjear premio mantienen su `alert()`
bloqueante sin cambios en el caso de éxito; se les pasó igual el
**error** a toast, para que ese aspecto sea consistente en toda la app.

Probado en el navegador contra Postgres real con Playwright:
- Toast de error de validación (sumar puntos sin cliente/monto):
  aparece, y se midió que se auto-oculta solo a los ~4000ms (medido
  4366ms, coherente con el timeout más el overhead de esperar el
  elemento con Playwright).
- Toast de éxito en "editar negocio": aparece "✓ Negocio actualizado" —
  confirma que el caso antes silencioso ahora sí da feedback.
- "Crear cliente": se disparó el flujo completo y se confirmó que sigue
  apareciendo el `alert()` nativo bloqueante, con la contraseña generada
  intacta en el mensaje, y que no aparece ningún `.fid-toast` en su
  lugar.

## Estado al cierre de esta sesión

- PRs #19, #20, #21 (docs), #22 (docs), #23, #24 (docs), #25 (docs), #26,
  #27 (docs), #28, #29 (docs), #30, #32, #34, #36 y #38: todos
  mergeados a `main`.
- Las acciones de guardar del panel ya dan feedback visual consistente:
  toast para confirmaciones de paso, `alert()` bloqueante solo donde el
  mensaje trae algo que hay que conservar o mostrar (contraseñas
  generadas, comprobante de canje).
- `POST /api/canjes` ya no tiene la condición de carrera de double-spend
  — verificado que exactamente 1 de 8 canjes simultáneos entra ahora,
  sin regresión en el caso secuencial normal.
- Spinners de carga funcionando en las listas, estadísticas, Inicio del
  admin, y las dos pantallas de "cargando tu negocio/tus datos".
- Deploy Previews de Netlify: ya no deberían fallar más por
  `DATABASE_URL` — a confirmar en el próximo PR real.
- Hover effects funcionando en todo el panel (botones, tarjetas, filas,
  sidebars), validado con Playwright forzando `:hover` sobre las 5
  categorías.
- Login con Google funcionando en producción para el caso de rechazo
  (validado). Caso de éxito sin probar todavía, pero no hay motivo para
  esperar que falle (la lógica es simétrica).
- Netlify: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `NEXTAUTH_URL`
  cargadas y funcionando.
- Sidebar de los tres paneles: **100% conectado**, no queda ningún ítem
  decorativo.
- Panel de cliente: ya no ofrece ninguna acción de "cargar puntos" — los
  puntos siempre se suman desde afuera (compra manual del negocio, o
  automático vía Tiendanube/Dragon Fish).
- Los tres orígenes de puntos en producción (manual, Mercado Pago,
  Tiendanube) ya dejan registro consistente en `MovimientoPuntos`, con
  idempotencia donde aplica (los dos webhooks).
- Pendientes reales que quedan: destrabar Dragon Fish (sigue esperando a
  Zoo Logic; el camino que de verdad importa para el volumen del local
  físico) y, a propósito **en pausa hasta que eso se resuelva**, la idea
  de notificar clientes por email. Menores sin urgencia: Tiendanube
  pausado hasta que la tienda esté activa, tema visual autogestionable.
  Ver `tareas-futuras.md`.
- Falta confirmar el caso de éxito del login con Google (quedó a mitad
  de camino, probando con la cuenta de admin).
