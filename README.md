# Fideliza

Programa de fidelización de clientes por puntos para comercios chicos. Cada
negocio define cuánto gasto equivale a un punto (`puntosXPeso`), sus clientes
acumulan puntos con sus compras y los canjean por premios que el negocio
configura.

Construido con Next.js (App Router), Prisma + PostgreSQL y NextAuth.

## Cómo funciona

- **Negocio**: el comercio. Tiene login propio, define sus premios y cuántos
  puntos otorga cada compra.
- **Cliente**: el cliente final de un negocio. Se registra solo (link público
  `/registro/[slug-del-negocio]`) o lo da de alta el negocio desde su panel.
  Acumula puntos y los canjea por premios.
- **Premio**: recompensa canjeable por puntos, definida por cada negocio.
- **Canje**: un cliente cambia puntos por un premio.

Los puntos se suman automáticamente cuando el cliente compra, vía integración
con la plataforma de venta del negocio (ver [Integraciones](#integraciones)
más abajo) o manualmente por el negocio.

## Levantar el proyecto en local

Requisitos: Node.js 20+, una base PostgreSQL (local o remota).

```bash
npm install
```

Creá un archivo `.env` en la raíz con las variables de [Variables de
entorno](#variables-de-entorno) (como mínimo `DATABASE_URL` para arrancar).

Aplicá las migraciones de Prisma:

```bash
npx prisma migrate deploy
npx prisma generate
```

(Opcional) Cargá datos de ejemplo — crea el negocio "Peperina" con premios:

```bash
npx prisma db seed
```

Arrancá el servidor de desarrollo:

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

### Otros comandos

```bash
npm run build   # build de producción
npm run start   # levantar el build de producción
npm run lint    # eslint
```

> ⚠️ Cuidado con los `$` en archivos `.env`: Next.js expande `$VAR` dentro de
> `.env` (vía `dotenv-expand`). Un valor que contenga `$` literal (por ejemplo
> un hash de bcrypt, que arranca con `$2b$10$...`) hay que escaparlo como
> `\$2b\$10\$...` en el `.env` local. Esto **no aplica** a variables cargadas
> directo en el dashboard de Netlify — ahí van tal cual, sin escapar.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. |
| `NEXTAUTH_SECRET` | Sí | Firma de sesión de NextAuth. |
| `NEXTAUTH_URL` | En producción | URL pública del sitio (NextAuth la necesita fuera de `localhost`). |
| `ADMIN_EMAIL` | Para el login de admin | Email de la cuenta admin (reemplaza al que antes estaba hardcodeado en el código). |
| `ADMIN_PASSWORD_HASH` | Para el login de admin | Hash bcrypt de la password del admin. Se genera con `bcryptjs` (`bcrypt.hash('tu-password', 10)`), nunca la password en texto plano. |
| `MERCADOPAGO_ACCESS_TOKEN` | Para cobrar con Mercado Pago | Access token de la cuenta de Mercado Pago del negocio/plataforma. |
| `NEXT_PUBLIC_BASE_URL` | Para Mercado Pago | URL pública del sitio, usada para armar las `back_urls` y el `notification_url` de las preferencias de pago. |

Las credenciales de Tiendanube (`tiendanubeStoreId`, `tiendanubeAccessToken`)
y de Dragon Fish **no van en variables de entorno**: se guardan por negocio en
la base (`Negocio.tiendanubeStoreId` / `Negocio.tiendanubeAccessToken`), y se
cargan vía `PATCH /api/negocios`. Ver estado abajo.

## Estructura del proyecto

```
app/
  api/
    auth/[...nextauth]/    # login (NextAuth, credentials provider)
    negocios/              # CRUD de negocios (GET, POST, PATCH)
    clientes/               # alta y listado de clientes de un negocio
    registro/[negocio]/     # auto-registro público de clientes (por slug)
    compras/                 # acreditar puntos manualmente
    canjes/                  # canjear puntos por un premio
    mercadopago/
      crear-preferencia/     # generar link de pago
    webhooks/
      mercadopago/            # acredita puntos cuando se aprueba un pago
      tiendanube/              # acredita puntos cuando se aprueba una orden
      dragonfish/              # (en progreso, ver abajo)
  login/                    # pantalla de login
  registro/[negocio]/       # pantalla de auto-registro de clientes
prisma/
  schema.prisma             # modelos: Negocio, Cliente, Premio, Canje, WebhookEvento
  migrations/
  seed.js                   # datos de ejemplo (negocio "Peperina")
lib/
  db.js                     # cliente de Prisma (singleton)
  password.js                # hashPassword / verifyPassword (bcrypt)
middleware.js                # protege rutas: sin sesión redirige a /login
```

### Autenticación

Login con `next-auth` (Credentials provider), tres roles: `admin`, `negocio`,
`cliente`. Las passwords se guardan hasheadas con bcrypt. Los usuarios que
todavía tienen la password vieja en texto plano (de antes de la migración a
bcrypt) se rehashean automáticamente la primera vez que loguean — no hace
falta resetear nada a mano.

### Idempotencia de webhooks

Hay una tabla `WebhookEvento` (`proveedor` + `referenciaExterna`, única) que
registra qué notificaciones de cada integración ya se procesaron, para no
sumar puntos dos veces si un proveedor reenvía la misma notificación. Hoy la
usa el webhook de Mercado Pago; Tiendanube y Dragon Fish todavía no la tienen
conectada (ver estado de cada uno abajo).

## Integraciones

| Integración | Estado | Qué falta |
|---|---|---|
| **Mercado Pago** | ✅ Lista, en producción | Genera el link de pago (`/api/mercadopago/crear-preferencia`) y el webhook (`/api/webhooks/mercadopago`) acredita los puntos cuando el pago queda `approved`, buscando al cliente por el `cliente_id`/`negocio_id` que viaja en la metadata de la preferencia. Protegida contra notificaciones duplicadas. |
| **Tiendanube** | 🚧 En progreso | El webhook (`/api/webhooks/tiendanube`) escucha `order/paid`, resuelve el negocio por `tiendanubeStoreId`, pide la orden completa a la API de Tiendanube (el webhook solo manda `{store_id, event, id}`, no el pedido completo) y acredita puntos por email. **Falta**: cargar `tiendanubeStoreId` y `tiendanubeAccessToken` de cada negocio (vía `PATCH /api/negocios`, obtenidos del flujo OAuth2 de Tiendanube — ese flujo todavía no está armado en este proyecto) y agregar protección de idempotencia (`WebhookEvento`), hoy no la tiene. |
| **Dragon Fish** | 🚧 En progreso | El webhook (`/api/webhooks/dragonfish`) todavía solo loguea el payload crudo que llega, para poder ver el formato real una vez que se active del lado de Dragon Fish y se haga una venta de prueba. La lógica de acreditar puntos (buscar cliente por email/DNI/teléfono, sumar puntos) está planeada pero no escrita — depende de confirmar el formato real del payload primero. |

## Deploy

Pensado para Netlify (`netlify.toml`): build con `prisma generate && npm run
build`, plugin `@netlify/plugin-nextjs`. Cargar las variables de entorno de la
tabla de arriba en el dashboard de Netlify antes de deployar.
