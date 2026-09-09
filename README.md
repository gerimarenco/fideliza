# Retornar

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
| `GOOGLE_CLIENT_ID` | Para "Iniciar sesión con Google" | Client ID de OAuth de Google Cloud Console. Si falta (junto con `GOOGLE_CLIENT_SECRET`), el botón de Google simplemente no aparece como provider habilitado. |
| `GOOGLE_CLIENT_SECRET` | Para "Iniciar sesión con Google" | Client secret de la misma credencial OAuth. Callback URL a autorizar en Google: `<NEXTAUTH_URL>/api/auth/callback/google`. |
| `MERCADOPAGO_ACCESS_TOKEN` | Para cobrar con Mercado Pago | Access token de la cuenta de Mercado Pago del negocio/plataforma. |
| `NEXT_PUBLIC_BASE_URL` | Para Mercado Pago y el mail de bienvenida | URL pública del sitio, usada para armar las `back_urls`/`notification_url` de Mercado Pago y el link de login del mail de bienvenida. |
| `RESEND_API_KEY` | Para los mails de puntos acreditados y de bienvenida (cuenta creada automáticamente por Dragon Fish) | API key de [Resend](https://resend.com). Si falta, el mail simplemente no se manda (no rompe la acreditación de puntos). |
| `RESEND_FROM_EMAIL` | No (default: `Retornar <onboarding@resend.dev>`) | Remitente de los mails. El remitente de prueba de Resend (`onboarding@resend.dev`) solo entrega a la casilla con la que se creó la cuenta de Resend — para mandarle mails a clientes reales hace falta verificar el dominio propio (`retornar.com.ar`) en Resend y poner acá una dirección de ese dominio. |
| `TIENDANUBE_APP_ID` | Para conectar Tiendanube por OAuth2 (botón "Conectar con Tiendanube") | Client ID de la app registrada en el [Partner Portal de Tiendanube](https://partners.tiendanube.com). Ver "Conectar Tiendanube por OAuth2" abajo. Sin esto, el botón no aparece y sigue funcionando la carga manual de `tiendanubeStoreId`/`tiendanubeAccessToken` de siempre. |
| `TIENDANUBE_CLIENT_SECRET` | Junto con `TIENDANUBE_APP_ID` | Client secret de la misma app. |

Las credenciales de Tiendanube por negocio (`tiendanubeStoreId`,
`tiendanubeAccessToken`) y las de Dragon Fish **no van en variables de
entorno**: se guardan por negocio en la base (`Negocio.tiendanubeStoreId` /
`Negocio.tiendanubeAccessToken`), y se cargan vía `PATCH /api/negocios` o
solas, para Tiendanube, con el botón de conectar por OAuth2. Ver estado abajo.

### Conectar Tiendanube por OAuth2

Antes, la única forma de conectar Tiendanube era crear una app privada a
mano en el panel de cada tienda y pegar el token generado en Ajustes →
Integraciones. Eso sigue andando (queda como alternativa si algo falla), pero
ahora también existe un flujo real de OAuth2 (`app/api/tiendanube/conectar` +
`app/api/tiendanube/callback`): el negocio hace click en "Conectar con
Tiendanube", autoriza el acceso desde su propia tienda, y Retornar guarda el
`tiendanubeStoreId`/`tiendanubeAccessToken` solo — sin que nadie tenga que
copiar ni pegar nada.

Para activarlo hace falta, una sola vez:

1. Crear una cuenta en el [Partner Portal de Tiendanube](https://partners.tiendanube.com) y registrar una app nueva (no hace falta publicarla en la tienda de apps — alcanza con que exista para usarla desde Retornar).
2. En los datos de la app, configurar la **URL de redirección** exactamente como `<tu dominio>/api/tiendanube/callback` (por ejemplo `https://retornar.com.ar/api/tiendanube/callback`, o la URL real de Netlify mientras el dominio propio no esté apuntado — ver "Deploy" más abajo). Esa URL es fija: Tiendanube siempre redirige ahí, no se puede indicar una distinta por pedido.
3. Elegir los permisos (`scopes`) que la app va a pedir — como mínimo lectura de productos y escritura de descuentos/cupones, que es lo que usan los premios vinculados a Tiendanube (ver más abajo).
4. Copiar el **Client ID** y el **Client Secret** que Tiendanube genera para la app, y cargarlos en Netlify como `TIENDANUBE_APP_ID` y `TIENDANUBE_CLIENT_SECRET`.

Con eso cargado, el botón "Conectar con Tiendanube" aparece solo en Ajustes →
Integraciones para cualquier negocio. **Importante**: este flujo no se pudo
probar contra una cuenta de partner real dentro de esta sesión (no hay una
disponible en este entorno) — el código sigue exactamente lo que documentan
Tiendanube y sus SDKs oficiales, pero conviene probarlo con un negocio de
prueba la primera vez que se cargue el Client ID/Secret, antes de darlo por
funcionando en Peperina.

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
sumar puntos dos veces si un proveedor reenvía la misma notificación. La usan
los tres orígenes automáticos: Mercado Pago, Tiendanube y Dragon Fish (ver
estado de cada uno abajo).

### Notificación por email después de cada compra

Cada vez que se acreditan puntos — manual, Mercado Pago, Tiendanube o Dragon
Fish — se le manda un mail al cliente avisándole cuántos puntos sumó y cuántos
tiene en total (`enviarEmailPuntosAcreditados` en `lib/email.js`). La única
excepción es la primera compra de una cuenta creada automáticamente por Dragon
Fish, donde se manda un solo mail combinado con la contraseña generada más los
puntos de esa compra (`enviarEmailBienvenida`), en vez de dos mails seguidos.
Sin `RESEND_API_KEY` configurada no se manda ningún mail, pero tampoco se
rompe la acreditación de puntos.

## Integraciones

| Integración | Estado | Qué falta |
|---|---|---|
| **Mercado Pago** | ✅ Lista, en producción | Genera el link de pago (`/api/mercadopago/crear-preferencia`) y el webhook (`/api/webhooks/mercadopago`) acredita los puntos cuando el pago queda `approved`, buscando al cliente por el `cliente_id`/`negocio_id` que viaja en la metadata de la preferencia. Protegida contra notificaciones duplicadas. |
| **Tiendanube** | ✅ Lista (falta activar OAuth2 con credenciales reales) | El webhook (`/api/webhooks/tiendanube`) escucha `order/paid`, resuelve el negocio por `tiendanubeStoreId`, pide la orden completa a la API de Tiendanube (el webhook solo manda `{store_id, event, id}`, no el pedido completo), busca al cliente por email y le acredita puntos, con la misma protección de idempotencia (`WebhookEvento`) que Mercado Pago y Dragon Fish. `tiendanubeStoreId`/`tiendanubeAccessToken` de cada negocio se cargan a mano (vía `PATCH /api/negocios`) o, ahora, con el flujo real de OAuth2 (ver "Conectar Tiendanube por OAuth2" arriba) — ese flujo está armado pero necesita `TIENDANUBE_APP_ID`/`TIENDANUBE_CLIENT_SECRET` (de una app registrada en el Partner Portal) para activarse, y todavía no se probó contra una cuenta de partner real. |
| **Dragon Fish** | ✅ Lista, en producción (Peperina) | El webhook (`/api/webhooks/dragonfish`) recibe la notificación liviana de Dragon Fish (`Entidad`, `Codigo`, `BaseDeDatos`, sin datos de la venta) y la deja anotada en `FacturaPendiente`. El agente local (`dragonfish-agente/`, corre en la PC del negocio) hace polling contra `GET /api/dragonfish/pendientes`, consulta la factura completa contra la API REST local de Dragon Fish, y reporta el resultado a `POST /api/dragonfish/resolver` (que ahí sí suma los puntos, con la misma idempotencia que Mercado Pago/Tiendanube). Si la venta es de alguien que todavía no tiene cuenta en Retornar (pero Dragon Fish trae su email), se le crea la cuenta sola y se le manda un mail de bienvenida con la contraseña (ver `RESEND_API_KEY` arriba) — sin eso, esa venta queda marcada `sin_cliente` y no suma puntos. Configuración local por negocio documentada paso a paso en `dragonfish-agente/README.md`. |

## Widget de fidelización para tiendas online

Para un negocio con tienda online (Tiendanube o cualquier otra), `public/widget.js`
es un script embebible chico (sin dependencias) que se agrega a la página de
producto de la tienda y muestra un cartel con los puntos que esa compra le
sumaría al cliente si se registra en Retornar — la misma idea que usan
servicios como Frunds (el de Portsaid). No depende del flujo de Tiendanube de
arriba (que es para acreditar puntos automáticamente después del pago): esto
es solo promocional, así que anda incluso sin tener `tiendanubeStoreId`/
`tiendanubeAccessToken` cargados.

Se agrega así en el HTML de la página de producto de la tienda:

```html
<div data-retornar-widget data-negocio="peperina" data-precio="18320"></div>
<script src="https://retornar.com.ar/widget.js" defer></script>
```

(Mientras `retornar.com.ar` no esté apuntado al deploy de Netlify — ver
"Deploy" más abajo — usar la URL real de Netlify en el `src` en su lugar.)

- `data-negocio`: el `slug` del negocio en Retornar (el mismo que usa la URL
  pública `/registro/[slug]`).
- `data-precio`: el precio final del producto, en pesos, sin separadores ni
  símbolo de moneda — lo pone la propia tienda ahí (el script no scrapea el
  DOM buscando el precio, así no se rompe cada vez que la tienda cambia de
  diseño).

El script llama a `GET /api/registro/[slug]` (pública, con CORS abierto para
poder llamarse desde el dominio de la tienda) para traer el nombre, emoji,
`puntosXPeso` y colores de marca (`tema.primario`/`primarioTexto`) del
negocio, calcula los puntos y arma un link a `/registro/[slug]` con esos
colores. Si el negocio no existe, está inactivo, o falla la llamada, no
muestra nada (nunca rompe la página de la tienda).

## Mini-landing pública antes de registrarse (`/club/[negocio]`)

Para un link desde afuera de Retornar (por ejemplo un ítem de menú "Sumate
al club" en la tienda online del negocio) que no tiene el contexto que sí
tiene el widget de arriba, mandar directo al formulario de
`/registro/[negocio]` se siente brusco — alguien que nunca escuchó hablar
del "Club X" cae de una en una pantalla pidiéndole DNI y fecha de
nacimiento. `/club/[negocio]` es un paso intermedio: muestra la imagen de
portada del tema (si está cargada), el mismo "Mensaje de bienvenida" que
ya usa el formulario de registro (Ajustes, self-service), tres bullets
genéricos de qué es el club, y recién ahí un botón "Registrarme" que lleva
a `/registro/[negocio]`. Pública (agregada a `middleware.js` junto con
`/login` y `/registro`), consume el mismo `GET /api/registro/[slug]` que
el widget.

## Premios vinculados a Tiendanube

Un premio (`Premio`, editable desde la sección Premios del panel de
negocio/admin — es un ítem de menú propio, no está adentro de Ajustes)
puede vincularse opcionalmente a la tienda Tiendanube del
negocio de dos formas, mutuamente excluyentes:

- **Producto puntual** (`tiendanubeProductoId` + `tiendanubeProductoUrl`):
  la clienta puede clickear el premio para ir directo al producto
  (`tiendanubeProductoUrl`, una URL que carga el negocio a mano — no se
  arma sola), y al canjearlo se le genera un cupón de Tiendanube de un solo
  uso por el valor de ese producto (precio consultado en el momento a la
  API de Tiendanube con `tiendanubeProductoId`, así no se desactualiza si
  el precio cambia).
- **Descuento porcentual** (`tiendanubeDescuentoPorcentaje`, ej. `10`): al
  canjearlo se genera un cupón de Tiendanube de un solo uso por ese
  porcentaje sobre toda la compra.

Ambos casos usan `lib/tiendanube.js` y las mismas credenciales que ya usa el
webhook de acreditación de puntos (`Negocio.tiendanubeStoreId` /
`tiendanubeAccessToken`, ver tabla de integraciones abajo) — no hace falta
cargar nada nuevo si el negocio ya tiene Tiendanube conectado para sumar
puntos, pero sí revisar que ese access token tenga permiso de **lectura de
productos** y **escritura de cupones/descuentos**, además del de lectura de
órdenes que ya usa el webhook (si se generó como app privada con menos
permisos que esos, hay que regenerarlo).

El cupón se genera en el momento de canjear (`POST /api/canjes`), después de
descontar los puntos — si la llamada a Tiendanube falla (token sin permisos,
producto borrado, Tiendanube caído), el canje igual queda confirmado y los
puntos ya se descontaron: el error queda anotado en
`Canje.tiendanubeCuponError` (visible en el historial de canjes del negocio)
para que se resuelva el descuento a mano en vez de perder el canje.

**Limitación conocida**: la API de cupones de Tiendanube no permite atarlos
a un producto específico (eso existe para "Descuentos" vía un partner app
con webhook de checkout — una integración mucho más pesada, pensada para
apps públicas de terceros, que no corresponde para el uso interno de un solo
negocio). Por eso el cupón de "producto puntual" en realidad es un cupón por
el valor de ese producto con un piso de compra (`min_price`) igual a ese
valor — cubre el precio del producto si es lo único que hay en el carrito,
pero Tiendanube no impide técnicamente usarlo con otra combinación de
productos que sume ese piso. "No acumulable" tampoco es un campo de la API:
Tiendanube ya limita a un cupón por pedido en el checkout, así que un cupón
de un solo uso (`max_uses: 1`) no se puede combinar con *otro* cupón, pero
si el negocio tiene una promoción automática configurada aparte en su panel
de Tiendanube, esa sí se puede seguir acumulando (no hay forma de
desactivarla por API, es una configuración de la tienda).

## Regalo de cumpleaños

`netlify/functions/regalo-cumpleanos.mjs` es una [Scheduled Function de
Netlify](https://docs.netlify.com/functions/scheduled-functions/) (cron
declarado en el propio archivo vía `export const config = { schedule }`,
corre todos los días a las 9am de Argentina) que le acredita puntos solos a
cada cliente el día de su cumpleaños — mismo mail de aviso
(`enviarEmailPuntosAcreditados`) que cualquier otra acreditación.

- Se activa por negocio cargando `Negocio.regaloCumpleanosPuntos` (desde
  Ajustes en el panel, o `PATCH /api/negocios`) — vacío/`0`/`null` lo deja
  desactivado. Por ahora solo Peperina lo tiene cargado.
- Necesita que el cliente haya cargado su fecha de nacimiento al
  registrarse (ver "Registro extendido" — clientes de antes de esa
  funcionalidad, o dados de alta por otras vías, no tienen `fechaNacimiento`
  y quedan afuera).
- Idempotente: antes de acreditar busca si ya existe un `MovimientoPuntos`
  con `origen: 'cumpleanos'` para ese cliente creado hoy mismo, para no
  duplicar los puntos si la función se reintenta o se dispara a mano dos
  veces el mismo día.
- Es una función de Netlify aparte del deploy de Next.js (no una ruta de la
  app) — por eso `netlify.toml` necesita `included_files` para que el motor
  nativo de Prisma (un binario) se empaquete tal cual en vez de que el
  bundler lo intente procesar como código.

## Vencimiento de puntos

`netlify/functions/vencimiento-puntos.mjs` es otra Scheduled Function de
Netlify (corre todos los días a las 10am de Argentina, después de la de
regalo de cumpleaños) que vence los puntos que un cliente no usó dentro de
los N meses de haberlos ganado — cada compra vence por separado, según su
propia fecha, no el saldo total de una sola vez.

- Se activa por negocio cargando `Negocio.vencimientoPuntosMeses` (desde
  Ajustes en el panel, o `PATCH /api/negocios`) — vacío/`0`/`null` lo deja
  desactivado. Por ahora solo Peperina lo tiene cargado, en 6 meses.
- Para trackear "cuánto de cada compra sigue sin usarse", cada
  `MovimientoPuntos` que suma puntos (compras, Mercado Pago, Tiendanube,
  Dragon Fish, regalo de cumpleaños) ahora también guarda
  `saldoRestante`, arrancando igual al monto ganado. Al canjear un premio
  (`POST /api/canjes`), se descuenta ese `saldoRestante` de los lotes más
  viejos del cliente primero (FIFO) antes de vencer nada — así un canje
  "gasta" primero los puntos más próximos a vencer.
- **Los puntos de un cliente de antes de este campo existir no tienen
  ningún lote asociado** (`saldoRestante: null`, no se hizo un backfill al
  migrar) y por lo tanto **nunca vencen**: no hay forma de reconstruir de
  qué compra salió cada punto ya acreditado antes de este cambio, así que
  quedan afuera del vencimiento en vez de arriesgarse a vencer de más (o de
  menos) con un cálculo inventado.
- Idempotente por construcción: un lote vencido queda en `saldoRestante: 0`
  para siempre, así que nunca vuelve a aparecer en una corrida posterior —
  no hace falta ningún chequeo aparte como el de regalo de cumpleaños.
- Manda un mail de aviso (`enviarEmailPuntosVencidos`) con el total vencido
  ese día (agrupando todos los lotes que le vencieron juntos a un mismo
  cliente en un solo mail) y el saldo que le queda — sin esto, el cliente
  vería bajar sus puntos sin ninguna explicación.

## Deploy

Pensado para Netlify (`netlify.toml`): build con `prisma generate && npm run
build`, plugin `@netlify/plugin-nextjs`. Cargar las variables de entorno de la
tabla de arriba en el dashboard de Netlify antes de deployar.

Dominio propio: se registró `retornar.com.ar`, pero todavía no está
apuntado al deploy de Netlify (hay que agregarlo como dominio personalizado
en el dashboard de Netlify + cargar los registros DNS que pida en NIC.ar).
Hasta que esté hecho, la URL real sigue siendo la de Netlify
(`incomparable-zabaione-b58c21.netlify.app`) — `NEXT_PUBLIC_BASE_URL` y el
`src` del widget deben usarla mientras tanto.
