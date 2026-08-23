# Contexto del proyecto — Fideliza

> Última actualización: 2026-08-22. Este documento es la foto general del
> proyecto para arrancar cualquier sesión de trabajo sin tener que releer
> todo el código. Para el detalle de qué falta, ver `tareas-pendientes.md`.
> Para el historial de cambios, ver `progreso.md` y `sesion-actual.md`.

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
  de Tailwind.
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
  y la lista de premios disponibles/próximos (ver limitación en
  `tareas-pendientes.md` sobre el canje real).

Dentro de `PanelNegocio` hay un estado `seccionActiva` (`'inicio'` |
`'canjes'`) que decide qué se muestra — es la única "navegación" real que
existe hoy; el resto de los ítems del sidebar (Premios, Integraciones,
Ajustes, Negocios, Clientes en el caso admin) son decorativos, no hacen
nada al clickearlos.

## Modelo de datos (`prisma/schema.prisma`)

- **`Negocio`**: `nombre`, `tipo`, `ciudad`, `emoji`, `puntosXPeso`
  (default 1000), `email`/`password` (login propio), `slug` (para el link
  público de auto-registro y para Mercado Pago), `tiendanubeStoreId` /
  `tiendanubeAccessToken` (credenciales de Tiendanube, ver más abajo).
- **`Cliente`**: `nombre`, `telefono`, `email` (único), `password`,
  `puntos` (contador acumulado), pertenece a un `Negocio`.
- **`Premio`**: `nombre`, `puntos` (costo), `emoji`, pertenece a un
  `Negocio`.
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
- Rama de trabajo de esta sesión: `claude/fideliza-xmf7ee` (PR #1, ya
  mergeado a `main`; luego PR #2 con paginación, ver `sesion-actual.md`).
- Deploy: Netlify, conectado directo al repo. Hay Deploy Previews
  automáticos por cada PR.
