# Contexto del proyecto — Fideliza

> Última actualización: 2026-08-26. Este documento es la foto general del
> proyecto para arrancar cualquier sesión de trabajo sin tener que releer
> todo el código. Para el detalle de qué falta, ver `tareas-pendientes.md`.
> Para el historial de cambios, ver `progreso.md` y `sesion-actual.md`.
> Para lo que sigue, ver `tareas-futuras.md`.

## Qué es Fideliza

Programa de fidelización de clientes por puntos, pensado para comercios
chicos (el caso de referencia es "Peperina", una tienda de indumentaria
femenina). Cada negocio define cuánto gasto equivale a un punto
(`puntosXPeso`), sus clientes acumulan puntos con sus compras (manuales o
automáticas vía integraciones) y los canjean por premios que el negocio
configura.

## Stack técnico

- **Framework**: Next.js 16 (App Router), React 19.
- **Base de datos**: PostgreSQL, vía Prisma 5 (`@prisma/client` +
  `@prisma/adapter-pg`).
- **Auth**: NextAuth v4, `CredentialsProvider` (login por email/password,
  sin OAuth de terceros para el login propio de la app).
- **Passwords**: hasheadas con `bcryptjs` (`lib/password.js`).
- **Pagos**: SDK oficial de Mercado Pago (`mercadopago` npm package).
- **Estilos**: Tailwind 4 configurado, pero la UI actual (`app/page.js`)
  está escrita con inline styles (objetos `style={{...}}`), no con clases
  de Tailwind. `app/globals.css` fuerza `color-scheme: light` a
  propósito — el template inicial traía una regla de modo oscuro
  automático (`prefers-color-scheme: dark`) que nunca se usó, y que hacía
  que el texto tipeado en los `<input>` quedara invisible (texto claro
  sobre el fondo blanco por defecto del navegador) si el sistema/
  navegador de quien usaba la app estaba en modo oscuro.
- **Deploy**: Netlify (`netlify.toml`, plugin `@netlify/plugin-nextjs`).
  Hay también una integración de Vercel que se desconectó por no ser el
  destino real de deploy (ver `progreso.md`).

## Estructura de paneles

No hay routing real entre pantallas — todo vive en un único componente
`app/page.js` (`'use client'`), que decide qué renderizar según
`session.user.role`:

- **Admin** (`role: 'admin'`): ve todos los negocios, puede entrar al panel
  de cualquiera de ellos (`PanelNegocio`, el mismo componente que usa el
  negocio). El admin es una única cuenta hardcodeada por variables de
  entorno (`ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`), no hay tabla de admins.
- **Negocio** (`role: 'negocio'`): ve su propio panel (`PanelNegocio`):
  estadísticas, lista de clientes (paginada), premios configurados, form
  de "Registrar compra manual", y una pantalla de "Historial de canjes".
- **Cliente** (`role: 'cliente'`): panel de solo lectura mobile-friendly
  (`PanelCliente`): sus puntos, botón para cargar puntos vía Mercado Pago,
  y la lista de premios disponibles/próximos, con botón "Canjear" que
  llama a `POST /api/canjes` (conectado; antes solo mostraba la lista).

Dentro de `PanelNegocio` hay un estado `seccionActiva` (`'inicio'` |
`'clientes'` | `'premios'` | `'canjes'` | `'integraciones'` | `'ajustes'`)
que decide qué se muestra. **Todos los ítems del sidebar de los tres
paneles ya están conectados**, salvo uno: "Ajustes" del panel **Admin**
(sigue sin backend ni alcance definido — no confundir con "Ajustes" del
panel **Negocio**, que es una cosa distinta y sí está conectado). Detalle
de cada uno en `tareas-pendientes.md`.

Un detalle de layout del panel Admin: cuando no hay ningún negocio
elegido (la grilla de "Mis negocios"), el contenido se rige por
`negocioActivo` (no por `seccionActiva`) — si en ese estado se toca un
ítem que vive dentro del panel de un negocio puntual (Clientes, Premios,
Canjes, Integraciones), se muestra un mensaje "Elegí un negocio para ver
sus..." con un botón de vuelta a la grilla, en vez de no reaccionar.

## Marca propia por negocio (tema visual)

Pensando en revender Fideliza a otros comercios a futuro, un negocio puede
tener su propia identidad visual — hoy en uso por Peperina. Vive en
`Negocio.tema` (`Json?`, opcional): si es `null`, todo se ve con la
paleta clara neutra de siempre (cero impacto para negocios que no lo
configuren).

- **Tokens de color**: `fondo`, `superficie`, `borde`, `texto`,
  `textoSecundario`, `primario`, `primarioTexto`, `resaltado` (un segundo
  acento para chips de puntos/avatares, para no reducir toda la marca a
  un solo color). Validados como hex en `PATCH /api/negocios` (admin-only).
- **Tipografía**: `fuenteTitulo` (string libre, ej. `Georgia, serif`) — se
  aplica solo a los títulos más visibles (el saludo "Bienvenida, X", el
  nombre del negocio en su propio sidebar, el saludo y "Tus puntos" del
  cliente), no al resto del texto, para no perder legibilidad en tablas y
  formularios.
- **Imagen de portada**: `imagenPortada` (URL de una imagen ya alojada en
  otro lado — Google Drive, Imgur, Instagram; la app no tiene sistema
  propio de carga de archivos). Se muestra como banner de ancho completo
  arriba de todo, estilo foto de portada de Facebook, tanto en el panel
  del negocio como en el del cliente.
- **Dónde se aplica**: `resolverTema(negocio)` en `app/page.js` mezcla
  estos tokens sobre una paleta clara por defecto (`TEMA_DEFAULT`) y solo
  afecta `PanelNegocio` (compartido entre "Ver panel" del admin y el
  negocio logueado, con todas sus secciones) y `PanelCliente`. El chrome
  del Admin (su propio sidebar, la grilla de "Negocios") nunca lee el
  tema.
- **Quién lo edita**: por ahora solo el admin, desde "Editar negocio"
  (7 selectores de color + 2 campos de texto). No hay autogestión propia
  del negocio todavía.
- La paleta actual de Peperina (negro/gris oscuro inicial, después
  reemplazada por la real de la marca a pedido de la dueña: fondo
  `#F6EFE9`, bordes `#EBDAC6`, texto secundario `#A99886`, acento
  `#877152`, resaltado `#F4D9D1`, tipografía `Georgia, serif`) se carga
  vía migraciones de datos (no de esquema) en `prisma/migrations/`, ya
  que no hay pantalla de autogestión — ver `progreso.md` para el detalle
  de cada ajuste.

## Modelo de datos (`prisma/schema.prisma`)

- **`Negocio`**: `nombre`, `tipo`, `ciudad`, `emoji`, `puntosXPeso`
  (default 1000, editable desde "Ajustes" del propio negocio o por el
  admin), `email`/`password` (login propio, password cambiable desde
  "Ajustes" vía `POST /api/negocios/password`), `slug` (para el link
  público de auto-registro y para Mercado Pago — editable desde
  "Integraciones"), `tiendanubeStoreId` / `tiendanubeAccessToken`
  (credenciales de Tiendanube, ver más abajo), `activo` (Boolean, default
  `true` — borrado lógico igual que `Premio.activo`: "Desactivar" un
  negocio no borra sus clientes/premios/canjes, solo lo saca de
  circulación; admin-only, editable desde la grilla de "Negocios"),
  `tema` (`Json?`, marca propia — ver sección de arriba). `GET
  /api/negocios` nunca expone `tiendanubeAccessToken` ni `password` tal
  cual — sí expone `tiendanubeStoreId` (no es secreto) y un booleano
  calculado `tiendanubeConectado`.
- **`Cliente`**: `nombre`, `telefono`, `email` (único), `password`,
  `puntos` (contador acumulado), pertenece a un `Negocio`.
- **`Premio`**: `nombre`, `puntos` (costo, editable desde la pantalla
  "Premios"), `emoji`, `activo` (Boolean, default `true` — borrado
  lógico: "Desactivar" no borra la fila, solo lo saca de "Premios
  disponibles" del cliente y de nuevos canjes, para no perder el
  historial de canjes que ya lo referencian), pertenece a un `Negocio`.
- **`Canje`**: un cliente cambia puntos por un premio. `entregado`
  (boolean, no se usa activamente en la UI todavía).
- **`MovimientoPuntos`** (agregado 2026-08-22): historial de cada vez que
  se otorgan puntos — `clienteId`, `negocioId` (denormalizado a
  propósito), `puntos`, `origen` (`"manual"` | `"mercadopago"` |
  `"tiendanube"` | `"dragonfish"`), `createdAt`. Antes de esto, `Cliente.
  puntos` era solo un contador sin ningún registro histórico — este
  modelo es lo que permite calcular estadísticas por rango de fechas.
- **`WebhookEvento`** (agregado 2026-08-21): idempotencia de webhooks —
  `proveedor` + `referenciaExterna` (unique), para no procesar la misma
  notificación externa dos veces. Hoy solo lo usa el webhook de Mercado
  Pago.

Índices agregados sobre las foreign keys que no los tenían:
`Cliente.negocioId`, `Premio.negocioId`, `Canje.clienteId`,
`Canje.premioId`, y el compuesto `MovimientoPuntos(negocioId, createdAt)`.

## Lógica de puntos

1. Una compra (manual desde el panel, o vía webhook de una integración)
   calcula `puntos = Math.floor(monto / negocio.puntosXPeso)`.
2. Se incrementa `Cliente.puntos` y se crea una fila en `MovimientoPuntos`
   con el origen correspondiente — ambas cosas en la misma transacción de
   Prisma cuando el flujo lo amerita (compra manual, Mercado Pago).
3. Un canje decrementa `Cliente.puntos` y crea una fila en `Canje`.
4. `GET /api/negocios/estadisticas?negocioId=X` agrega, para el mes en
   curso: `clientesActivos` (conteo total de clientes, no hay hoy manera
   de distinguir activo/inactivo), `puntosOtorgadosEsteMes` (suma de
   `MovimientoPuntos` del mes) y `canjesEsteMes` (conteo de `Canje` del
   mes, vía `premio.negocioId`).

## Autenticación y autorización

- Login con NextAuth Credentials (`lib/auth.js`, antes vivía inline en el
  route handler). Tres roles: `admin`, `negocio`, `cliente`.
- Passwords hasheadas con bcrypt. Las que quedaban en texto plano de antes
  de la migración se **rehashean automáticamente en el primer login**
  (`lib/password.js` → `verifyPassword` detecta si el hash guardado es
  bcrypt o texto plano legacy).
- El admin ya no está hardcodeado en el código — sale de
  `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH` (variables de entorno).
- **Todos los endpoints de API validan sesión y rol** (esto no era así
  originalmente — ver `progreso.md`, fue un hallazgo de seguridad
  importante). Regla general: admin puede todo, negocio solo puede leer/
  escribir sobre su propio `negocioId`, cliente solo puede actuar sobre
  sus propios datos (nunca en nombre de otro cliente).
- Los webhooks (Mercado Pago, Tiendanube, Dragon Fish) **no** llevan esta
  auth basada en sesión — son llamados por los proveedores externos, no
  por usuarios logueados.

## Estado de las integraciones

### Mercado Pago — ✅ Lista, en producción
`POST /api/mercadopago/crear-preferencia` genera el link de pago (el
`clienteId` sale de la sesión, no del body, para que un cliente no pueda
generar un pago que acredite puntos a otra cuenta). El webhook
(`/api/webhooks/mercadopago`) acredita los puntos cuando el pago queda
`approved`, y tiene protección de idempotencia real (una transacción que
marca el pago como procesado + suma los puntos; si Mercado Pago reenvía la
misma notificación, la restricción única de `WebhookEvento` hace fallar
la transacción entera y no se duplica nada).

### Tiendanube — 🚧 Pausada, esperando que la tienda esté activa
El webhook (`/api/webhooks/tiendanube`) ya está reescrito correctamente:
Tiendanube manda un payload liviano (`{store_id, event, id}`, sin los
datos de la venta), así que el webhook resuelve el negocio por
`tiendanubeStoreId`, pide la orden completa a la API de Tiendanube con
`tiendanubeAccessToken`, y acredita puntos por email. Existe
`PATCH /api/negocios` para cargar esas credenciales.

**Lo que falta y por qué está pausado**: el `tiendanubeAccessToken` sale
del flujo OAuth2 de Tiendanube, que **todavía no está armado** — no tiene
sentido construirlo hasta que la tienda esté activa en Tiendanube. Cuando
lo esté, retomamos: armar el flujo OAuth, cargar las credenciales reales,
y agregar la misma protección de idempotencia que ya tiene Mercado Pago
(hoy Tiendanube no la tiene).

### Dragon Fish — 🚧 En progreso, bloqueada esperando a Zoo Logic
Dragon Fish (el sistema de facturación que usa el negocio, de Zoo Logic)
manda un webhook con un payload muy liviano — confirmado con un ejemplo
real:

```json
{ "Entidad": "FACTURA", "Evento": "INGRESAR", "Codigo": "161A4E7581FFDF14994191C013840261333101", "Fecha": "21/08/2026", "Hora": "12:53:14", "Version": "1.0.0.1", "BaseDeDatos": "PEPERINA" }
```

No trae cliente, monto ni artículos — solo un `Codigo` identificador de la
factura. Los datos reales de la venta hay que pedirlos a la API REST de
Dragon Fish, que **corre local en la PC del negocio**, no es accesible
desde internet, y **ya se decidió no exponerla** (sin port forwarding, sin
túneles tipo ngrok/Cloudflare Tunnel).

**Arquitectura acordada** (diseñada, no implementada todavía): un agente
local que solo hace llamadas salientes — le pregunta a Fideliza
periódicamente (polling) "¿hay facturas pendientes?", resuelve cada una
contra la API REST local de Dragon Fish, y le reporta el resultado a
Fideliza. Nada entra a la red del negocio desde afuera. Detalle completo
en `tareas-pendientes.md`.

**Bloqueante actual**: estamos esperando la respuesta del soporte de Zoo
Logic sobre cómo se consulta una factura por `Codigo` contra esa API REST
local, y qué datos de identificación del cliente devuelve (email, DNI,
teléfono) — sin eso no se puede terminar de diseñar la lógica de matching
del lado de Fideliza.

## Repositorio y ramas

- Repo: `gerimarenco/fideliza`.
- Rama de trabajo activa: `claude/fideliza-retomada-af1eus` — se abrió un
  PR nuevo por cada tanda de trabajo (PR #4 a #17, todos mergeados a
  `main`; ver `sesion-actual.md`/`progreso.md` para el detalle de cada
  uno), siempre desde la misma rama.
- Deploy: Netlify (cuenta `gerimarenco`), conectado directo al repo. Hay
  Deploy Previews automáticos por cada PR (`deploy-preview-N--
  incomparable-zabaione-b58c21.netlify.app`) — **importante**: un link de
  preview queda congelado en el momento en que ese PR se cierra/mergea,
  no se actualiza más aunque seguamos mergeando código a `main` después.
  El sitio de producción real (el que hay que usar para probar el estado
  actual) es **`https://incomparable-zabaione-b58c21.netlify.app`**, sin
  ningún prefijo.

### Estado de la cuenta de Netlify (resuelto el 2026-08-25)

La cuenta se había quedado sin créditos operativos del ciclo de
facturación, pausando deploys de producción nuevos — Cecilia actualizó el
plan y los deploys volvieron a funcionar con normalidad.

**Build command** (`netlify.toml`): `prisma migrate deploy && prisma
generate && npm run build`. Esto no estaba así desde el principio — se
descubrió, durante el diagnóstico de "los botones no andan" en
producción, que el build nunca corría las migraciones de Prisma contra la
base real (solo `prisma generate`), así que la base de producción se
había quedado atrás de varias migraciones (la más grave: la base no tenía
la columna `Premio.activo`, y cualquier consulta que la pidiera —
`GET /api/negocios`— rompía con un 500 sin cuerpo). Ya corregido: cada
deploy aplica las migraciones pendientes antes de buildear.

**Limitación conocida y no bloqueante**: `DATABASE_URL` solo está
configurada para el contexto de Producción en Netlify, no para "Deploy
Previews" — cualquier PR desde el que agregó `prisma migrate deploy`
muestra el check de deploy-preview en rojo (`P1012`, variable vacía). Es
esperable, no afecta al sitio real, y ya quedó documentado como tal en
cada PR que lo atraviesa. Si en algún momento se quiere que los previews
también funcionen, hay que agregar `DATABASE_URL` a ese contexto en
Netlify (con cuidado: eso le daría a cualquier preview acceso a la base
de producción real).
