# Tareas futuras — Retornar

> Lo que sigue una vez retomado el proyecto. Ver `sesion-actual.md` para
> el detalle completo de cómo se llegó a este punto. El proyecto se
> llamaba "Fideliza" hasta el 2026-09-07 — ver ítem 1 abajo.

## 1. Cambio de nombre: Fideliza → Retornar — ✅ resuelto (2026-09-07)

Buscando un dominio para comprar, apareció que **"Fideliza" ya lo usa otra
empresa** en Argentina para lo mismo (programa de puntos de fidelización
sin app): existe `fideliza.app` y `fideliza.ar` con esa marca, más una
"Grupo Fideliza" en LinkedIn. Para evitar el choque de marca se
renombró el proyecto a **Retornar** y se registró `retornar.com.ar`.

Quedó actualizado en el código lo que se ve (título de la app, login,
mails, README) y los comentarios/mensajes internos. **A propósito no se
tocó**:
- Los nombres de variables de entorno `FIDELIZA_AGENT_TOKEN` /
  `FIDELIZA_BASE_URL` del agente de Dragon Fish — cambiarlos rompería el
  `.env` ya cargado en la PC de Peperina sin que nadie se entere.
- El `name` en `package.json` (interno, nunca se publica, cero impacto).
- Los archivos de `docs/` anteriores a esta fecha (`sesion-actual.md`,
  `progreso.md`, etc.) — quedan como registro histórico de cuando el
  proyecto se llamaba Fideliza, no se reescriben.
- El repo de GitHub sigue llamándose `fideliza` — renombrarlo es una
  decisión aparte (rompe/redirige links existentes), no se hizo todavía.

~~**Pendiente real**: `retornar.com.ar` está registrado pero todavía no
apunta al deploy de Netlify~~ — ✅ resuelto: el dominio ya está cargado
como dominio personalizado en Netlify, con el DNS delegado en NIC.ar a
los nameservers de Netlify. `https://retornar.com.ar` es la URL real de
producción — la de Netlify (`incomparable-zabaione-b58c21.netlify.app`)
sigue existiendo puertas adentro (Deploy Previews de cada PR), pero no
hay que usarla en ningún lado más (env vars, código, ni como link para
probar el sitio) — quedó pegada por error en varios lugares mientras
tanto (`NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, el widget embebible, el
agente de Dragon Fish), todos ya corregidos.

## 2. Notificar a clientes por email — ✅ resuelto (2026-09-04)

Su mamá (dueña de Peperina) quería que sus clientas **no tengan que
entrar a ninguna web** — que casi ni se enteren de que existe un panel —
y en cambio reciban un mail después de cada compra con los puntos que
sumaron. Quedó implementado así:

- Servicio de envío conectado: **Resend**, sin dominio propio todavía
  (remitente de prueba `onboarding@resend.dev`, ver `lib/email.js`) —
  mientras tanto solo puede mandar mails a la casilla con la que se creó
  la cuenta de Resend, no a clientes reales. Migrar a un dominio propio
  verificado es el paso que falta para que llegue a cualquier cliente.
- El disparador es cada acreditación de puntos (`MovimientoPuntos`), sin
  importar el origen: manual (`app/api/compras`), Mercado Pago,
  Tiendanube o Dragon Fish (los cuatro webhooks/endpoints llaman a
  `enviarEmailPuntosAcreditados` después de la transacción que suma los
  puntos).
- Si Dragon Fish reporta una venta de alguien sin cuenta en Retornar (y
  trae su email), se le crea la cuenta sola con una contraseña generada
  y se le manda un mail de bienvenida combinado (cuenta + puntos de esa
  compra) en vez del aviso genérico — ver `enviarEmailBienvenida` y
  `app/api/dragonfish/resolver`.
- Sin `RESEND_API_KEY` configurada, no rompe el flujo de puntos: solo no
  manda el mail (mismo criterio que el login con Google si faltan sus
  credenciales).
- Pendiente real: verificar dominio propio en Resend para poder mandarle
  mails a clientas reales (hoy limitado a la casilla de prueba); y
  eventualmente si hace falta algo de personalización visual del mail en
  sí (coherente con la marca de cada negocio).

## 3. Dragon Fish — ✅ resuelto (2026-09-03/04, arranque automático 2026-09-07)

Cecilia planteó que no quería que el negocio cargue compra por compra a
mano (no escala con miles de clientes) ni que la clienta tenga que hacer
nada. Dragon Fish (POS del local físico de Peperina, donde está el
volumen real) ya está integrado de punta a punta y confirmado en
producción: venta real de prueba acreditó puntos correctamente. Detalle
completo en el README (tabla de integraciones) y en `dragonfish-agente/`.
El agente local ya puede arrancar solo con Windows (`.env` +
`iniciar-agente.bat` + Programador de tareas, ver `dragonfish-agente/README.md`)
en vez de tener que iniciarlo a mano — sin probar todavía en la PC real de
Peperina.

## 4. Widget embebible para tiendas online — MVP hecho (2026-09-07)

Peperina sí tiene tienda online (no solo el local físico con Dragon
Fish). A partir de una captura de referencia de Portsaid/Frunds (cartel
"Registrate y sumá X puntos" en la página de producto), se armó
`public/widget.js`: un script chico que la tienda agrega a sus páginas de
producto y muestra cuántos puntos suma esa compra si el cliente se
registra en Retornar. Detalle de uso e integración en el README, sección
"Widget de fidelización para tiendas online". No depende del flujo de
Tiendanube (que es para acreditar puntos automáticamente después del
pago, ver abajo) — es solo promocional, con los datos que pone la propia
tienda en un `data-precio`.

Sin probar todavía embebido en una tienda real (Peperina u otra). Falta
también decidir si conviene una segunda versión más parecida a Frunds
(burbuja flotante en vez de un cartel fijo en la página) — quedó afuera
del MVP a propósito.

## 5. Registro extendido: fecha de nacimiento, DNI y sexo — ✅ resuelto (2026-09-07)

Se agregaron estos tres campos, obligatorios, al auto-registro público
(`/registro/[slug]`) — paso previo necesario para el regalo de cumpleaños
(punto 6 abajo), que depende de tener la fecha de nacimiento cargada.
Nullable en el modelo porque un cliente creado a mano por el negocio o de
alta automática por Dragon Fish no pasa por ese formulario.

## 6. Regalo de cumpleaños — ✅ resuelto (2026-09-07)

500 puntos automáticos el día del cumpleaños de cada cliente, por ahora
solo para Peperina. Implementado como una Scheduled Function de Netlify
(`netlify/functions/regalo-cumpleanos.mjs`, corre todos los días a las 9am
de Argentina) — se activa por negocio cargando
`Negocio.regaloCumpleanosPuntos` desde Ajustes en el panel (vacío/0 lo
desactiva). Manda el mismo mail de aviso que cualquier otra acreditación
de puntos. Depende de tener cargada la fecha de nacimiento (punto 5
arriba) — clientes sin ese dato quedan afuera del regalo.

Sin confirmar todavía en producción que la Scheduled Function corre
como se espera (recién se deployó) — revisar los logs de Netlify
Functions el primer día que le toque el cumpleaños a alguien.

## 7. Enlaces cruzados Peperina ↔ Retornar — código hecho, falta un paso externo (2026-09-07)

- **Panel del cliente → sitio de Peperina**: nuevo campo
  `Negocio.sitioWeb` (Ajustes en el panel, self-service, igual que
  `puntosXPeso`/`regaloCumpleanosPuntos`) que muestra un link "Visitar
  {negocio} →" al pie del panel del cliente cuando está cargado. Falta
  que alguien lo cargue con `https://peperina.com` en Ajustes.
- **peperina.com → registro de Retornar**: el ítem de menú en sí
  ("Sumate al club Peperina" o similar, como "Enlace externo" en el
  editor de menús de Tiendanube) es un cambio del lado de Tiendanube,
  no de este repo. Pero en vez de apuntarlo directo a
  `/registro/peperina` (un formulario pidiendo datos apenas alguien
  entra desde el menú de la tienda, sin ningún contexto — se sintió
  brusco al probarlo), se armó una mini-landing intermedia en
  `/club/[negocio]` (2026-09-09): muestra la imagen de portada del tema
  si está cargada, el mensaje de bienvenida (mismo campo que ya usa el
  formulario de registro), tres bullets genéricos de qué es el club
  (sumar puntos / canjear premios / sorpresas de cumpleaños), y recién
  ahí un botón "Registrarme" que lleva a `/registro/[negocio]`. El
  ítem de menú en Tiendanube debería apuntar a esta URL nueva
  (`/club/peperina`), no a la del formulario directo.

## 8. Nomenclatura "Club X" — ✅ resuelto (2026-09-07)

Cada negocio se llama "Club {Nombre}" (ej. "Club Peperina") en todo lo que
ve el cliente: mails (`lib/email.js`, vía el helper `nombreClub`),
pantalla de registro y widget embebible (ambos consumen `GET
/api/registro/[slug]`, que ya devuelve el nombre con el prefijo puesto), y
el encabezado del panel del cliente. Es automático para cualquier negocio,
no hace falta cargar "Club" a mano en el nombre — si mañana se suma un
segundo negocio, ya sale con el prefijo sin tocar código.

A propósito **no** lleva el prefijo: el nombre que ven admin/negocio en su
propio panel (`session.user.name`, gestión de negocios), ni la
descripción del ítem de pago de Mercado Pago ("Compra en Peperina" — ahí
es una transacción con el negocio, no con el club).

## 9. Integración de premios con Tiendanube — código hecho, falta cargar datos y verificar permisos del token (2026-09-07)

Cada premio (`Premio`) se puede vincular opcionalmente a la tienda
Tiendanube del negocio, de dos formas (ver detalle técnico en el README,
sección "Premios vinculados a Tiendanube"):

- **Producto puntual**: cargando `tiendanubeProductoId` (para el precio,
  consultado en el momento a la API) y `tiendanubeProductoUrl` (a mano, el
  link al producto en la tienda) desde Premios (menú de la izquierda, no adentro de Ajustes). Al clickear el
  premio en el panel del cliente, lleva a ese link; al canjearlo, genera un
  cupón de un solo uso por el valor del producto.
- **Descuento porcentual**: cargando `tiendanubeDescuentoPorcentaje` (ej.
  `10` para el premio de 10%). Al canjearlo, genera un cupón de un solo uso
  por ese porcentaje sobre toda la compra.

El cupón se muestra en pantalla al canjear (mismo `alert()` bloqueante que
ya se usaba de comprobante) y queda guardado en el canje para que el
negocio lo pueda consultar después en el historial de canjes.

**Pendiente real**:
- Cargar `tiendanubeProductoId`/`tiendanubeProductoUrl` en los premios de
  pañuelo y aromatizante, y `tiendanubeDescuentoPorcentaje: 10` en el de
  10% (Peperina) — nada de esto se carga solo.
- Verificar que el `tiendanubeAccessToken` ya cargado tenga permiso de
  lectura de productos y escritura de cupones/descuentos — se generó en su
  momento solo pensando en leer órdenes para acreditar puntos, puede que
  haga falta regenerarlo con más permisos desde el panel de Tiendanube.
- Limitación de la API de Tiendanube (no de este código): un cupón no se
  puede atar técnicamente a un producto específico, así que el de
  "producto puntual" es, en rigor, un cupón por ese valor con un piso de
  compra igual al precio del producto — ver el detalle completo en el
  README antes de prometerle a una clienta que el cupón "solo sirve para
  ese producto".

## 10. Vencimiento de puntos a los 6 meses — código hecho, falta activarlo (2026-09-07)

Cada compra (o regalo de cumpleaños) vence por separado a los N meses de
haberse ganado, si no se usó para ningún canje antes — Cecilia definió 6
meses como el valor a usar. Detalle técnico completo en el README, sección
"Vencimiento de puntos".

- Se activa por negocio cargando `Negocio.vencimientoPuntosMeses` (Ajustes
  en el panel) — todavía no está cargado para Peperina, hay que ponerle
  `6` para que arranque a vencer.
- **Importante**: los puntos que los clientes ya tienen acumulados de
  antes de este cambio no quedan "marcados" con ninguna fecha de origen
  (no había forma de trackear eso hasta ahora) — por diseño, esos puntos
  viejos nunca van a vencer, solo lo hacen las compras nuevas de acá en
  adelante. No hace falta ni conviene intentar "adivinar" cuándo se
  ganaron para vencerlos retroactivamente.
- Manda un mail cuando le vencen puntos a un cliente
  (`enviarEmailPuntosVencidos`) — sin `RESEND_API_KEY`/dominio propio
  verificado en Resend, mismo límite que el resto de los mails (ver ítem 2
  arriba): solo le llega a la casilla de prueba, no a clientas reales
  todavía.
- Sin confirmar todavía en producción que la Scheduled Function corre
  como se espera (recién se va a deployar) — revisar los logs de Netlify
  Functions cuando pase el primer vencimiento real.

**Actualización (2026-09-11)**: Cecilia confirmó que el valor correcto es
**12 meses**, no 6 (ver ítem 26) — hay que actualizar
`Negocio.vencimientoPuntosMeses` de Peperina a `12` desde Ajustes en el
panel (autogestionable, no requiere código).

## 11. El admin no podía llegar a Premios — ✅ resuelto (2026-09-07)

El menú de la izquierda del panel de **Admin** no tenía ningún ítem para
"Premios" — esa sección solo existía en el menú del negocio cuando se
loguea con su propia cuenta. Como Cecilia gestiona todo desde la cuenta de
admin, no tenía forma de llegar a la pantalla (ya armada) de alta/edición
de premios ni de cargar los datos de Tiendanube del ítem 9. Se agregó
"🎁 Premios" al menú de Admin, entre Clientes y Puntos y canjes — funciona
igual que Clientes/Canjes: primero hay que elegir un negocio en
"Negocios", después aparece Premios con la lista editable.

## 12. Premios ordenados de menor a mayor puntaje — ✅ resuelto (2026-09-07)

Con varios premios cargados (5000, 2500, 15000, 2500, 12500 puntos),
Cecilia pidió una forma fácil de ordenarlos de menor a mayor. En vez de
armar un reordenamiento manual (drag & drop, guardar una posición por
premio), se resolvió más simple: los premios ahora siempre se listan
ordenados por puntos ascendente — tanto en el panel de negocio/admin
(Premios) como en el panel del cliente (Premios disponibles/Próximos
premios). No hace falta acomodar nada a mano ni ahora ni cuando se
agreguen premios nuevos, el orden queda bien solo.

## 13. Favicon "R" de Retornar — ✅ resuelto (2026-09-08)

Cecilia mandó un boceto de ícono (cuadrado verde redondeado, "R" blanca
con el bowl dibujado como flecha hacia la izquierda — la idea de
"retornar") para usar de favicon. Igual que con la imagen de portada del
ítem 11: no hay forma de extraer el archivo exacto que compartió por
chat, así que se recreó el mismo diseño con SVG + Playwright/Chromium. Se
probaron 4 colores (verde, terracota, burdeos, azul noche) y Cecilia
eligió el verde original.

`app/favicon.ico` reemplazado por un ícono multi-resolución (16/32/48/256,
PNG-embebido con canal alfa — Turbopack rechaza ICO sin RGBA) generado a
mano con `sharp` (ya es dependencia del proyecto), no hay ninguna
herramienta de conversión de ICO instalada en este entorno.

## 14. Saludo de cumpleaños en el panel del cliente — ✅ resuelto (2026-09-08)

Además del mail y los puntos automáticos (ítem 6), el día del cumpleaños
el panel del cliente ahora muestra un cartel arriba de todo: "🎉 ¡Feliz
cumpleaños, {nombre}! Que tengas un lindo día. De parte de Retornar te
regalamos {puntos} puntos 🎂" — se puede cerrar con la (✕), y solo
aparece si el negocio tiene `regaloCumpleanosPuntos` cargado (si no, no
hay nada que festejar en puntos). Usa la fecha de nacimiento del propio
cliente, comparada en UTC igual que la Scheduled Function del regalo, así
el cartel coincide siempre con el día real en que se acreditan los
puntos, sin depender de la zona horaria del navegador.

## 15. Revisión de bugs de toda la sesión — ✅ resuelto (2026-09-08)

Cecilia pidió revisar bugs. Pasada una revisión de código sobre todo lo
agregado en esta sesión (Grupos 3 en adelante), aparecieron 5 bugs reales
(ya corregidos) más una duplicación de código:

- **`regalo-cumpleanos.mjs`**: el mail de regalo de cumpleaños mostraba
  mal el saldo total del cliente — un error de desestructuración
  (`const [, clienteActualizado]`) tomaba el resultado de crear el
  `MovimientoPuntos` en vez del de actualizar `Cliente`, así que el mail
  decía "ahora tenés 50 puntos" en vez del total real (ej. 350).
- **`POST /api/canjes`**: un cliente logueado podía canjear el premio de
  **cualquier negocio**, no solo el suyo, mandando ese `premioId` por
  fuera de la UI — se le descontaban sus propios puntos igual, pero el
  canje (y, desde el Grupo 7, el cupón real de Tiendanube) se generaban
  contra un negocio con el que esa clienta no tiene ninguna relación.
  Ahora se valida que el premio sea del mismo negocio que el cliente.
- **`vencimiento-puntos.mjs`**: condición de carrera — leía cuánto le
  quedaba a cada lote de puntos, y si justo en el medio un canje
  consumía parte de ese mismo lote, la función igual restaba el monto
  viejo (ya leído) del saldo del cliente, pudiendo descontar de más.
  Se resuelve venciendo cada lote con un UPDATE atómico
  (`... WHERE saldoRestante > 0 RETURNING saldoRestante`) que lee y
  vacía el lote en un solo paso, inmune a la carrera.
- **`vencimiento-puntos.mjs`**: el cálculo de la fecha de corte
  (`ahora menos N meses`) podía desbordarse a otro mes en fechas como el
  31 de agosto menos 6 meses (JS calcula "31 de febrero", que no existe,
  y lo corre al 2-3 de marzo) — venciendo puntos unos días antes de lo
  que correspondía. Se agrega un helper que clampea al último día válido
  del mes de destino.
- **`enviarEmailPuntosVencidos`**: el mail decía siempre "dentro de los 6
  meses", incluso para un negocio con `vencimientoPuntosMeses` distinto
  de 6 (el campo es configurable por negocio) — ahora usa el valor real.
- **Duplicación**: la lógica de "Club {nombre}" (`nombreClub`) estaba
  repetida en tres lugares (`lib/email.js`, la ruta de registro, y
  `app/page.js`). Se extrajo a `lib/nombreClub.js`, un módulo sin
  dependencias que puede importarse tanto desde código de servidor como
  desde `app/page.js` (un client component, que no puede importar
  `lib/email.js` sin arrastrar el paquete `resend` al navegador).

## 16. Segunda pasada de revisión de bugs (código previo a esta sesión) — ✅ resuelto (2026-09-08)

Después de la revisión del ítem 15, se pidió seguir revisando bugs — esta
vez sobre todo el proyecto, no solo lo agregado en esta sesión. Aparecieron
4 más:

- **`GET /api/negocios` filtraba los datos de todos los clientes a
  cualquier cliente logueado** — el más serio de los cuatro. La lista
  `clientes` de un negocio (con email, puntos y, desde el saludo de
  cumpleaños del ítem 14, fecha de nacimiento) se devolvía completa sin
  importar quién la pidiera. Un cliente cualquiera podía llamar al
  endpoint y ver los datos de todos los demás clientes de su mismo
  negocio. Ahora el `select` de `clientes` varía según el rol: admin y
  negocio siguen viendo la lista completa (la necesitan para gestionar el
  negocio), un cliente logueado solo recibe su propio registro.
- **`POST /api/clientes` no manejaba el email duplicado** — a diferencia
  de `POST /api/negocios` (que sí atrapa el error P2002), cargar un
  cliente con un email ya usado tiraba un 500 genérico en vez de un
  mensaje claro.
- **`POST /api/registro/[negocio]` no validaba que el negocio esté
  activo** — el `GET` de la misma ruta sí lo hacía (por eso la pantalla
  de registro no cargaba para un negocio desactivado), pero pegándole
  directo al `POST` igual se podía crear una cuenta nueva contra un
  negocio dado de baja.
- **Bug de monto en Dragon Fish, versión texto**: la validación
  `Number.isFinite(monto)` (agregada en una revisión anterior para que
  `null`/`''`/`false` no colaran como monto 0) también rechazaba un monto
  válido si Dragon Fish lo mandaba como string en vez de número — algo
  que pasa con algunos ERPs viejos. Se corrigió tanto en
  `app/api/dragonfish/resolver` como en `dragonfish-agente/index.js`
  (que es quien primero lee el dato de la API local de Dragon Fish) para
  aceptar número o string sin volver a colar `null`/`''`/`false`.

## 17. Verificación de las migraciones de Prisma — ✅ confirmado, sin cambios de código (2026-09-08)

Todas las migraciones de esta sesión se escribieron a mano (sin
`prisma migrate dev`, porque este entorno nunca tuvo `DATABASE_URL` para
conectarse a la base real) y nunca se habían probado contra una base de
verdad — quedaba la duda de si coincidían exactamente con
`schema.prisma`, algo que de estar mal recién se iba a notar en el
próximo deploy (`prisma migrate deploy` fallando, o peor, aplicando
"bien" pero dejando la base desalineada del Prisma Client generado).

Se encontró Postgres 16 instalado en este entorno (no se había notado
antes): se levantó un cluster local, se armó una base descartable, se
corrieron las 21 migraciones en orden con `prisma migrate deploy` (igual
comando que usa `netlify.toml` en producción) y se comparó el resultado
contra `schema.prisma` con `prisma migrate diff` — **cero diferencias**.
Se probó además un create/update real contra esa base con Prisma Client
(negocio, cliente, premio, movimiento de puntos, canje, y los campos
nuevos de esta sesión) sin ningún error. La base y el cluster de prueba
se borraron después, no queda nada corriendo.

No se tocó código: era una verificación, no encontró nada para arreglar.
Esto reemplaza la advertencia repetida en varios PRs de esta sesión de
"no se pudo probar la migración contra una base real" — ya se probó, y
coincide.

## 18. Prueba de punta a punta real (por primera vez con base de datos) — encontró y corrigió un bug crítico del vencimiento de puntos (2026-09-09)

Con el Postgres local del ítem 17 ya probado, se aprovechó para levantar
la app real (`next dev`) contra una base de prueba y probar los flujos
completos con un navegador (Playwright) en vez de solo leer código:
login de admin, alta de negocio, Premios en el menú de Admin, alta de
premios, orden ascendente, registro público, "Club X", saludo de
cumpleaños, canje con y sin cupón de Tiendanube, y el bloqueo de canje
cross-negocio. **Todo funcionó exactamente como estaba pensado** — la
primera confirmación end-to-end real de toda la sesión.

Al probar el vencimiento de puntos en sí (backdateando un lote a mano)
apareció un bug serio en la corrección de la condición de carrera del
ítem 15 (PR #61): `UPDATE ... SET "saldoRestante" = 0 ... RETURNING
"saldoRestante"` en Postgres devuelve la fila **después** del UPDATE, no
antes — así que esa consulta siempre devolvía 0, y el vencimiento vaciaba
el lote sin descontar nunca los puntos reales de `Cliente.puntos` ni
dejar el `MovimientoPuntos` de `origen: "vencimiento"`. En la práctica,
la función de vencimiento no vencía nada desde que se armó (PR #61), a
pesar de que la lógica se veía bien leyendo el código y de que el test
aislado de esa sesión pasaba (probaba la fecha de corte, no el UPDATE en
sí). Se corrigió leyendo el valor viejo con un `FROM (... FOR UPDATE)` en
el mismo `UPDATE`, que sí mantiene la fila de antes disponible para el
`RETURNING` — se volvió a probar contra la base real, incluyendo el caso
de carrera (un canje consumiendo parte del lote justo antes de que corra
el vencimiento) y quedó confirmado correcto.

De paso apareció un import sin extensión (`from './nombreClub'` en
`lib/email.js`) que Next.js tolera pero que rompe bajo Node ESM puro
(como corren las Netlify Functions `.mjs`) — se agregó la extensión
`.js`.

**Moraleja para la próxima sesión**: con Postgres disponible en este
entorno, conviene probar así (`next dev` + base descartable + Playwright)
en vez de solo revisar código a mano — esta sola prueba encontró un bug
que ninguna de las dos revisiones de código anteriores (ítems 15 y 16)
había detectado.

## 19. Auditoría de patrones similares al bug del ítem 18 (2026-09-09)

Después de encontrar el bug de `RETURNING` del ítem 18, se revisó el
resto del código buscando la misma familia de errores (lógica que se ve
bien leyendo el código pero falla en un caso puntual): otros usos de SQL
crudo, aritmética de fechas manual, llamadas HTTP dentro de una
transacción de Prisma, y incrementos/decrementos de saldo sin protección
contra condiciones de carrera.

No apareció ningún bug nuevo de esas primeras tres categorías (el único
`$queryRaw` es el ya corregido del ítem 18; las transacciones con
`increment`/`decrement` de puntos ya estaban bien protegidas). Sí apareció
uno chico, de la misma familia que el de `restarMeses` (desbordamiento de
fechas): el regalo de cumpleaños (`netlify/functions/regalo-cumpleanos.mjs`)
y el cartel del panel del cliente (`app/page.js`) comparaban mes/día de
nacimiento contra hoy de forma directa — una clienta nacida el 29 de
febrero nunca iba a recibir su regalo, porque esa fecha no existe en 3 de
cada 4 años. Se corrigió con un helper común (`lib/cumpleanos.js`,
`esCumpleanosHoy`) que festeja el 28 de febrero en años no bisiestos, y
se probó con casos concretos (nacimiento bisiesto, años bisiestos y no
bisiestos, cumpleaños normal) confirmando el resultado esperado en cada
uno.

Una segunda auditoría (rounding de puntos, idempotencia de webhooks,
mails faltantes, chequeos de `Negocio.activo`) no encontró más bugs de
esas primeras tres categorías (el redondeo de puntos es
`Math.floor(monto / puntosXPeso)` en los cuatro lugares donde se calcula
y coincide siempre; los tres webhooks que acreditan puntos ya evitan el
doble crédito por reenvío gracias a la restricción única de
`WebhookEvento`; todo camino que suma puntos ya manda algún mail). Sí
encontró un agujero real: desactivar un negocio (`Negocio.activo`,
pensado para sacarlo de circulación sin borrar su historial — ver
`app/api/negocios`) solo se chequeaba en el registro público. Compras
manuales, el agente de Dragon Fish, los webhooks de Tiendanube/Mercado
Pago y los canjes seguían funcionando igual con un negocio desactivado.
Se agregó el chequeo en los cinco lugares (a los webhooks, que no deben
fallar aunque el negocio esté desactivado, se les hace devolver 200 sin
acreditar, igual que ya hacían con un negocio no configurado).

## 20. Conexión real de Tiendanube por OAuth2 (2026-09-09)

Hasta ahora la única forma de conectar Tiendanube era crear una app privada
a mano en el panel de cada tienda y pegar el `tiendanubeStoreId`/
`tiendanubeAccessToken` en Ajustes → Integraciones — quedaba pendiente
armar el flujo real de OAuth2 para que el negocio se conecte con un click,
sin copiar ni pegar nada. Se implementó:

- `app/api/tiendanube/conectar`: redirige al negocio logueado a la pantalla
  de autorización de Tiendanube (`https://www.tiendanube.com/apps/{client_id}/authorize`).
- `app/api/tiendanube/callback`: recibe el `code` que Tiendanube manda de
  vuelta, lo cambia por un `access_token` (`intercambiarCodigoPorToken` en
  `lib/tiendanube.js`) y lo guarda en el negocio correspondiente.
- `lib/tiendanubeOAuthState.js`: como Tiendanube no documenta un `state`
  propio en la URL de autorización (siempre redirige a una única URL fija,
  registrada de antemano en su Partner Portal), para saber a qué negocio
  corresponde cada `code` que vuelve se usa una cookie firmada (HMAC con
  `NEXTAUTH_SECRET`, que ya existe) de 10 minutos en vez de depender de algo
  que la plataforma no garantiza.
- En Ajustes → Integraciones aparece un botón "Conectar con Tiendanube"
  — pero solo si el servidor tiene `TIENDANUBE_APP_ID` configurada; sin
  eso, sigue andando la carga manual de siempre sin ningún cambio.

**Ojo con esto**: a diferencia del resto de los bugs de esta sesión, este
flujo no se pudo probar de punta a punta contra una cuenta de partner real
de Tiendanube (no hay ninguna disponible en este entorno) — ni el
intercambio de código por token, ni el redirect completo. El código sigue
al pie de la letra lo que documentan Tiendanube y sus SDKs oficiales (URLs,
parámetros, forma del POST), verificado por lectura de esas fuentes, pero
no por una prueba en vivo como sí se pudo hacer con Postgres. Para
activarlo hace falta que alguien (ver README, sección "Conectar Tiendanube
por OAuth2") cree la app en el Partner Portal de Tiendanube y cargue
`TIENDANUBE_APP_ID`/`TIENDANUBE_CLIENT_SECRET` en Netlify — recién ahí se
va a poder confirmar que el intercambio de token funciona tal cual está
escrito.

## 21. Tiendanube conectado de verdad con Peperina — 3 bugs encontrados probando en vivo (2026-09-09)

Cecilia creó la app en el Partner Portal, cargó `TIENDANUBE_APP_ID`/
`TIENDANUBE_CLIENT_SECRET` reales, y probó el botón "Conectar con
Tiendanube" del ítem 20 — la primera prueba real contra una cuenta de
partner de verdad. Encontró y se corrigieron en el momento tres problemas:

1. **"No autorizado" al conectar** — `app/api/tiendanube/conectar` solo
   dejaba pasar `session.user.role === 'negocio'`, pero Ajustes →
   Integraciones también se edita desde el panel de admin eligiendo un
   negocio. Se agregó `negocioId` por query string con el mismo criterio
   de autorización que ya usa `PATCH /api/negocios`.
2. **Volvía al login en vez de confirmar la conexión** — sin poder
   reproducirlo de punta a punta acá para confirmar la causa exacta
   (sospecha: algo puntual con la sesión en esa vuelta desde un dominio
   externo). En vez de seguir diagnosticando a ciegas, `app/api/tiendanube/callback`
   ahora devuelve directamente una página de confirmación (no depende de
   que la sesión llegue viva a la siguiente carga de `/`).
3. **El webhook de "pedido pagado" nunca se registraba** — conectar la
   tienda guarda el token, pero no le avisa a Tiendanube que tiene que
   mandar el webhook de `order/paid` (es una suscripción de API aparte).
   Se agregó `asegurarWebhookOrderPaid` en `lib/tiendanube.js`, llamada
   automáticamente al final de un conectar exitoso — sin esto, ninguna
   compra online iba a sumar puntos pese a que la tienda apareciera
   "Conectada".

Con los tres corregidos, la tienda de Peperina (Store ID `820719`) quedó
conectada de verdad, con el webhook registrado.

**Confirmado con una compra de prueba real** (2026-09-09): la primera
prueba se hizo con una compra ya pagada antes de reconectar (webhooks no
son retroactivos — esa puntual no sumó nada, esperable), pero una segunda
compra de prueba después de reconectar sumó los puntos correctamente. El
Grupo 7 completo (integración de Tiendanube) queda confirmado funcionando
de punta a punta en producción con Peperina.

## 22. Mini-landing pública antes de registrarse (`/club/[negocio]`) (2026-09-09)

Para el ítem de menú "Sumate al club Peperina" que se va a agregar en
peperina.com (ítem 7 más abajo), mandar directo a `/registro/peperina`
(un formulario pidiendo datos, sin ningún contexto) se sintió demasiado
brusco al pensarlo. Se armó una página intermedia en `/club/[negocio]`:
imagen de portada del tema si está cargada, el mismo "mensaje de
bienvenida" que ya usa el formulario de registro, tres bullets genéricos
(sumar puntos / canjear premios / sorpresas de cumpleaños), y un botón
"Registrarme" que recién ahí lleva a `/registro/[negocio]`. Agregada a
la lista de rutas públicas en `middleware.js`, igual que `/registro`.

El ítem de menú en Tiendanube debería apuntar a esta URL nueva
(`/club/peperina`), no directo al formulario.

## 23. Niveles de cliente, estadísticas y mensaje de WhatsApp (2026-09-09)

Cecilia mandó una captura de otro sistema de fidelización ("Tienda de
Puntos") con una idea que le gustó para el panel de clientes: nivel a
simple vista, última actividad, y al abrir el detalle, más estadísticas y
un botón para mandarle un mensaje al cliente. Se armó una versión propia
en `VistaClientes` (`app/page.js`):

- **Celular obligatorio en el registro público** (`/registro/[negocio]`):
  hasta ahora `Cliente.telefono` solo se cargaba a mano (o vía Dragon
  Fish) — sin eso no hay forma de mandarle nada por WhatsApp a un cliente
  que se registró solo. Sin validar formato de país/área a propósito
  (varía mucho cómo la gente lo escribe), solo que tenga una cantidad de
  dígitos razonable.
- **Nivel del cliente** (`lib/clienteStats.js`): Bronce / Plata / Oro /
  Diamante / VIP según puntos **ganados de por vida**, no el saldo actual
  (que baja con cada canje — así un cliente frecuente no "pierde" nivel
  por canjear premios, sería premiarlo al revés). ~~Los umbrales (Bronce 0
  / Plata 1000 / Oro 3000 / Diamante 6000 / VIP 10000) son un punto de
  partida mío, no un número que haya pedido Cecilia — hay que revisarlos
  con ella~~ — ✅ revisados y subidos, ver ítem 39.
- **Estadísticas por cliente**, calculadas a partir de `MovimientoPuntos`
  (una sola consulta por página de la lista, no una por cliente): compras
  registradas (cuenta solo orígenes de venta real: manual, Mercado Pago,
  Tiendanube, Dragon Fish — no cumpleaños ni vencimiento), frecuencia
  promedio entre compras, y un ticket promedio **aproximado**
  (`MovimientoPuntos` guarda puntos, no el monto real de la venta — se
  reconstruye multiplicando por `puntosXPeso`, perdiendo el redondeo hacia
  abajo que ya se pierde en el origen).
- **Aviso de inactividad**: si hace 30+ días que un cliente no tiene
  actividad, aparece un cartel de alerta al abrir su detalle (mismo
  espíritu que el "hace 42 días que no vuelve" de la captura).
- **Botón de WhatsApp**: arma un link `wa.me` con un mensaje sugerido,
  calculado con datos reales (cuánto le falta en puntos/pesos para el
  próximo premio que todavía no puede pagar) — el negocio lo revisa y lo
  manda desde su propio WhatsApp. **No es una integración real de
  WhatsApp Business** (no hace falta ninguna cuenta ni costo aparte,
  `wa.me` es gratis y sin API key), simplemente abre WhatsApp Web/App con
  el chat y el texto ya escritos. El número se usa tal cual está cargado
  (solo se le sacan los caracteres que no son dígitos, sin agregarle
  código de país) — si no abre el chat esperado con algún cliente en
  particular, hay que revisar cómo quedó cargado ese celular.

**Pendiente/a revisar con Cecilia** (quedó sin poder confirmarlo, ella
estaba afuera): los umbrales de nivel, y si el mensaje sugerido de
WhatsApp es el tono/contenido que quiere (ella mencionó también la idea
de "te regalamos X puntos si comprás más de $Y", que es más una promoción
puntual que este botón no arma solo — el mensaje sugerido de acá se
limita a lo que ya se puede calcular con datos reales del cliente).

## 24. Menú (⋮) en el panel del cliente: cambio de contraseña, info de puntos y soporte (2026-09-09)

Cecilia sintió el panel del cliente "básico" y pidió agregar un menú arriba
a la derecha (tres rayitas/puntitos) con cambio de contraseña, info de cómo
funcionan los puntos, y un mail de soporte — "y lo que se te ocurra a vos
que sea importante". Se agregó un botón "⋮" al lado de "Salir" en el
encabezado del panel del cliente (`app/page.js`), con un menú desplegable de
tres opciones:

- **Cambiar contraseña**: no existía ningún endpoint para que un cliente
  cambie su propia contraseña (`POST /api/negocios/password` es solo para
  negocios) — se agregó `POST /api/clientes/password`, mismo patrón
  (contraseña actual + nueva, valida la actual antes de cambiarla). El
  formulario reutiliza el mismo estado/función que ya usaba Ajustes del
  negocio (`cambiarPassword`), que ahora elige el endpoint según el rol.
- **Cómo funcionan los puntos**: en vez de texto fijo, se armó a partir de
  la configuración real de cada negocio (`lib/clienteStats.js` no, esto
  quedó directo en `app/page.js`, función `reglasDePuntos`): cuántos pesos
  por punto (`puntosXPeso`), si tiene regalo de cumpleaños cargado, y si
  tiene vencimiento de puntos activado — así el texto nunca queda
  desactualizado si Peperina (o cualquier negocio futuro) cambia estos
  valores desde Ajustes.
- **Contactar soporte**: abre un `mailto:` con una casilla de soporte.
  **Pendiente real**: se usó `soporte@retornar.com.ar` como placeholder
  (`EMAIL_SOPORTE` en `app/page.js`) porque esa casilla todavía no existe —
  Cecilia mencionó que la va a crear ella. Hay que reemplazar esa constante
  por la casilla real en cuanto exista.

No se agregó nada más al menú por ahora (ej. términos y condiciones,
historial de movimientos) para no inventar contenido/legal sin que Cecilia
lo pida puntualmente — quedan como ideas a futuro si las quiere.

## 25. "Cliente desde" y "Primera compra" en el detalle del cliente (2026-09-10)

Cecilia pidió que al abrir el detalle de un cliente (`VistaClientes`) se
vea desde cuándo está en Retornar y/o cuál fue su primera venta. Se
agregaron los dos, uno al lado del otro arriba del detalle:

- **Cliente desde**: `Cliente.createdAt`, ya venía en la respuesta de
  `GET /api/clientes`, no hizo falta tocar el backend.
- **Primera compra**: nuevo campo `fechaPrimeraCompra` en
  `calcularStatsClientes` (`lib/clienteStats.js`) — mismo criterio que
  `fechaUltimaCompra` (que ya existía), solo que se queda con la primera
  fecha en vez de la última, y solo cuenta orígenes de venta real (no
  cumpleaños ni vencimiento). No se muestra si el cliente todavía no
  compró nunca (ej. se registró pero no volvió).

## 26. Bases y condiciones de Club Peperina en el menú del cliente (2026-09-11)

Cecilia mandó el texto oficial de Bases y Condiciones del Club (8 secciones:
qué es, cómo se suman puntos, vigencia, canje, premios, beneficios con
descuento, cambios, condiciones generales) para agregarlo al menú ⋮ del
panel del cliente. Se agregó tal cual como texto fijo
(`BASES_CONDICIONES_PEPERINA` en `app/page.js`), sin reformularlo, en un
modal con scroll (es bastante largo).

**Hardcodeado a propósito, no un campo de `Negocio`**: hoy Peperina es el
único negocio real usando el sistema. Si se suma un segundo negocio con su
propio texto legal, esto tiene que pasar a ser un campo editable (mismo
criterio que `mensajeRegistro`/`sitioWeb`) en vez de esta constante fija.

**Inconsistencia con la config — resuelta (2026-09-11)**: Cecilia confirmó
que los valores correctos son los del texto legal: **12 meses** de
vigencia y **$100 = 1 punto**. `Negocio.vencimientoPuntosMeses` de
Peperina seguía en `6` (ver ítem 10) — falta que alguien lo actualice a
`12` desde Ajustes en el panel (autogestionable, no es un cambio de
código). El valor de `puntosXPeso` no se pudo verificar desde este entorno
(sin acceso a la base de producción) — hay que confirmar en Ajustes que
esté en `100`, y corregirlo ahí mismo si no lo está.

## 27. Rediseño de textos de `/club/[negocio]` (2026-09-11)

Cecilia mandó una propuesta de copy más "emocional" para la mini-landing
del club (ítem 22): sacar la repetición del nombre del negocio debajo del
banner (ya lo dice la imagen de portada) y reemplazarlo por una frase que
venda el beneficio, explicar la mecánica de puntos enseguida, reformular
las tres tarjetas, y cambiar el botón de "Registrarme" a "Sumarme al
Club" (menos a trámite, más a pertenencia). Aplicado en
`app/club/[negocio]/page.js`:

- Título: "Tus compras ahora también tienen recompensa" (fijo, genérico
  para cualquier negocio, no específico de Peperina).
- Debajo: "Sumá 1 punto por cada $X de compra en el local y en nuestra
  tienda online" — el `$X` sale de `puntosXPeso` real del negocio (no
  hardcodeado), para que no quede desactualizado si ese valor cambia.
- Tarjetas: "Sumás puntos con cada compra" / "Canjealos por premios y
  prendas seleccionadas" / "Disfrutá beneficios y sorpresas especiales".
- Botón: "Sumarme al Club" en vez de "Registrarme".

`Negocio.mensajeRegistro` (el mensaje/promoción propia que antes se
mostraba acá) dejó de usarse en esta pantalla — sigue mostrándose en el
formulario de registro (`/registro/[negocio]`), no se tocó ahí.

## 28. "Mis movimientos": historial de puntos en el panel del cliente (2026-09-13)

Cecilia pidió sumar cosas que hagan ver a Retornar más "profesional",
como otros sistemas de fidelización — el primer pedido concreto fue un
historial de movimientos visible para el propio cliente (hasta ahora solo
veía el saldo actual, sin poder ver de dónde salió). Se agregó
"📜 Mis movimientos" al menú ⋮ existente (mismo menú del ítem 24), con:

- Nuevo endpoint `GET /api/clientes/movimientos` (`app/api/clientes/movimientos/route.js`):
  junta `MovimientoPuntos` (compras, regalo de cumpleaños, vencimientos)
  y `Canje` (canjes no generan fila en `MovimientoPuntos`, solo quedan en
  `Canje`) en una sola lista ordenada por fecha, paginada. Siempre acotado
  al cliente logueado (`session.user.id`), nunca acepta ver el historial
  de otro.
- Modal con scroll + paginado (reutiliza el componente `Paginador` que ya
  existía para Clientes/Canjes/Premios del lado del negocio), cada línea
  con emoji, descripción, fecha y el puntaje con signo (verde si suma,
  rojo si resta).

## 29. Barra de progreso hacia el próximo premio (2026-09-13)

Segunda mejora "de profesionalización" de la misma tanda del ítem 28: en
"Próximos premios" del panel del cliente, cada premio bloqueado ahora
muestra una barra de progreso (puntos actuales / puntos del premio, con
un mínimo visual de 4% para que nunca se vea vacía del todo) además del
texto "Te faltan X puntos" que ya estaba. Cambio chico, solo visual, en
`app/page.js` (`PanelCliente`).

## 30. Primeros tests automáticos del proyecto (2026-09-13)

Cecilia pidió mejoras de backend/confiabilidad (no visuales) — el proyecto
no tenía ningún test hasta ahora, y ya hubo dos bugs reales que pasaron
desapercibidos justo en la lógica más delicada (la condición de carrera
del vencimiento de puntos del ítem 18, y el desborde de fecha del 29 de
febrero del ítem 19). Se agregó una primera batería de tests con el test
runner nativo de Node (`node --test`, sin sumar Jest/Vitest ni ninguna
dependencia nueva) sobre la lógica pura de `lib/` — ver la sección "Tests"
del README para el detalle completo. Cubre:

- `lib/clienteStats.js`: `calcularNivel` (bordes exactos de cada nivel),
  `formatearMiles`, `descripcionNiveles`.
- `lib/cumpleanos.js`: `esCumpleanosHoy`, incluyendo el caso del 29 de
  febrero en años bisiestos y no bisiestos (el bug del ítem 19).
- `lib/nombreClub.js`: caso trivial.
- `lib/restarMeses.js` (**nuevo**, extraído de
  `netlify/functions/vencimiento-puntos.mjs` para poder testearlo aparte,
  sin cambiar su comportamiento): desbordes de fin de mes (31 de agosto
  menos 6 meses, etc.) — el bug de fecha que causó el ítem 18 era
  distinto (el `RETURNING` de Postgres), pero esta función ya tenía un
  comentario explícito sobre el mismo tipo de bug de fechas, así que
  quedó como candidata obvia para el primer test.

**Cambio de infraestructura necesario para que esto funcione**: el
proyecto pasó a `"type": "module"` en `package.json`, porque los módulos
de `lib/` ya estaban escritos con `import`/`export` (Next.js y el bundler
de Netlify Functions los toleraban igual sin este campo, transformándolos
por su cuenta) pero Node en crudo (`node --test`, sin pasar por ningún
bundler) los necesita así para poder cargarlos tal cual. El único archivo
que seguía usando `require`/`module.exports` de verdad,
`prisma/seed.js`, se renombró a **`prisma/seed.cjs`** (mismo contenido,
solo la extensión) para que siga siendo CommonJS sin importar el
`"type"` global — `dragonfish-agente/` tiene su propio `package.json`
aparte, así que no le afecta este cambio.

**Deliberadamente afuera de esta primera tanda** (no por falta de
importancia, sino para no demorar esto): tests de las rutas de API (que
necesitarían una base de datos real corriendo) y tests de componentes de
React (`app/page.js`, muy grande y sin una convención de testing de UI
elegida todavía). Quedan como una posible segunda tanda si hace falta más
cobertura.

**De nada sirven los tests si nadie se acuerda de correrlos**: hasta este
cambio, el único chequeo automático en cada PR era el deploy preview de
Netlify (que solo confirma que compila, ver `.github/workflows/ci.yml`
nuevo con el comentario completo). Se agregó un workflow de GitHub
Actions bien chico que corre `npm test` en cada PR y en cada push a
`main` — a propósito **no** corre `npm run lint` todavía, porque el
proyecto ya tiene errores de lint preexistentes sin resolver (los "19
problemas de base" mencionados en varios PRs de esta sesión) y sumarlo
dejaría el CI en rojo para cualquier PR futuro, sin relación con lo que
ese PR haya cambiado. Corregir esa base de lint es una tarea aparte,
después se puede sumar `npm run lint` a este mismo workflow.

## 31. Verificación de firma en los webhooks de Tiendanube y Mercado Pago (2026-09-13)

Cecilia pidió seguir con mejoras de backend/confiabilidad después de los
tests del ítem 30 — este era el otro pendiente concreto que ya estaba
identificado (ver ítem 32 de abajo, ahora resuelto): hasta ahora
cualquiera que adivinara un `store_id`+`orderId` real (Tiendanube) o un
`paymentId` real (Mercado Pago) podía disparar esos webhooks a mano, sin
que el servidor verificara que el pedido realmente venía del proveedor.
El impacto real siempre estuvo acotado (ver el razonamiento completo que
tenía anotado el pendiente, ninguno de los dos confía ciegamente en el
monto/cliente del POST), pero seguía siendo un agujero real.

Se agregó `lib/webhookSignature.js` (con sus propios tests, misma lógica
que el ítem 30: pura, sin base de datos) con una función por proveedor:

- **Tiendanube** (`verificarFirmaTiendanube`): firma el body **crudo**
  (los bytes tal cual, antes de parsear el JSON — por eso las rutas ahora
  leen `request.text()` primero y recién después hacen `JSON.parse`) con
  HMAC-SHA256, usando **el mismo `TIENDANUBE_CLIENT_SECRET`** que ya
  existe para el OAuth2 (ítem 20) — no hace falta ir a buscar ninguna
  clave nueva al Partner Portal. Viaja en el header
  `x-linkedstore-hmac-sha256`.
- **Mercado Pago** (`verificarFirmaMercadoPago`): arma un "manifest" de
  texto (`id:...;request-id:...;ts:...;`) con el id del recurso (sale del
  **query string** de la URL del webhook, `data.id`, no del body), el
  `x-request-id` y el timestamp, y lo firma con HMAC-SHA256 usando una
  clave nueva que Mercado Pago genera en *Tus integraciones → Webhooks →
  Configurar notificación* — variable de entorno nueva,
  `MERCADOPAGO_WEBHOOK_SECRET`, todavía sin cargar en Netlify. Viaja en
  el header `x-signature` (formato `ts=...,v1=...`).

**No rompe nada mientras no se cargue la clave**: las dos funciones
devuelven `{ verificable: false, valido: true }` si no hay secreto
configurado (mismo criterio que `RESEND_API_KEY`/`TIENDANUBE_APP_ID` en
el resto del proyecto) — Tiendanube queda automáticamente verificado sin
hacer nada más (la clave ya existe), Mercado Pago sigue sin verificar
hasta que alguien cargue `MERCADOPAGO_WEBHOOK_SECRET` con el valor que
Mercado Pago muestra en su panel.

**Sin poder probarlo contra una entrega real de webhook** (no hay forma
de generar una firma real de Mercado Pago sin la clave real, ni de
Tiendanube sin que llegue un webhook real firmado) — la lógica se
implementó siguiendo al pie de la letra la documentación oficial de cada
proveedor (headers exactos, formato del manifest, de dónde sale cada
clave), con tests que arman una firma válida a mano con la misma fórmula
y confirman que se acepta, y que cualquier alteración (id, request-id,
firma, o body distinto) la rechaza. Igual que con el ítem 20 en su
momento, la confirmación real de punta a punta queda pendiente de una
prueba en producción — para Mercado Pago, además, de que alguien cargue
`MERCADOPAGO_WEBHOOK_SECRET`.

## 32. Unificar el cálculo de puntos por compra (2026-09-13)

Tercera mejora de la misma tanda de backend/confiabilidad (Cecilia se
había ido un rato y pidió seguir avanzando sola): `Math.floor(monto /
puntosXPeso)` se calculaba por separado en 5 lugares (carga manual,
Dragon Fish, los webhooks de Tiendanube y Mercado Pago, y la vista previa
del formulario de carga manual en `app/page.js`) — una auditoría anterior
(ítem 19) había confirmado que las cuatro del backend coincidían, pero
seguían siendo copias independientes con el mismo riesgo de divergir si
alguna se editaba sin tocar las otras.

Se unificó en `calcularPuntosPorCompra(monto, puntosXPeso)`
(`lib/puntos.js`, con sus propios tests) y se actualizaron los 5 lugares
para usarla. Sin cambios de comportamiento: misma fórmula exacta, más una
guarda explícita para monto/puntosXPeso inválidos (antes esos casos ni
se daban porque cada lugar ya validaba por su cuenta antes de llegar a la
cuenta, pero ahora la función es segura igual si se la llama desde algún
lugar nuevo sin esa validación previa).

## 33. Revisión de bugs de la tanda de backend (2026-09-13)

Cecilia pidió revisar bugs después de la tanda de mejoras de backend
(ítems 30 a 32, ya en producción). Encontrado y corregido uno real:

- **`verificarFirmaTiendanube` recibía el body ya decodificado como
  string** (`request.text()`), no los bytes crudos. Decodificar como
  UTF-8 y volver a codificar para hashear casi siempre reproduce los
  mismos bytes originales para JSON puro, pero "casi siempre" no alcanza
  para algo que compara un hash byte a byte — un solo caracter que no
  hiciera ese viaje ida y vuelta sin cambios (poco probable en el payload
  liviano real de Tiendanube, que es solo `store_id`/`event`/`id`
  numéricos y simples, pero no imposible si Tiendanube cambia el formato)
  hubiera hecho que la firma calculada no coincida nunca más con la real,
  rechazando pedidos legítimos sin que nadie se entere hasta que una
  clienta se queje de que no le sumaron los puntos. Se corrigió leyendo
  `request.arrayBuffer()` y hasheando ese `Buffer` directo, sin pasar por
  texto en el medio — mismo criterio que `crypto.createHmac(...).update()`
  ya soporta nativamente. Se agregó un test explícito con un caracter no-
  ASCII para dejarlo cubierto.
- El resto de la tanda (Mercado Pago, `calcularPuntosPorCompra`, el
  historial de movimientos, el menú del cliente) no mostró problemas en
  esta revisión.

## 34. Contador de anticipación para el cumpleaños (2026-09-13)

Cecilia pidió otra mejora chica de "profesionalización" para el panel del
cliente. Se agregó un cartel discreto ("Faltan X días es tu cumpleaños —
vas a sumar N puntos de regalo") que aparece en el último mes antes de la
fecha (no todo el año, para no ser ruido de fondo) — el día del
cumpleaños en sí sigue mostrando el cartel grande de siempre (ítem 14),
este contador no se solapa con ese. Solo aparece si el negocio tiene
`regaloCumpleanosPuntos` cargado (si no, no hay nada que anticipar).

- `diasHastaProximoCumpleanos(fechaNacimiento, hoy)` (`lib/cumpleanos.js`,
  con sus propios tests): mismo criterio de fecha en UTC y mismo ajuste
  del 29 de febrero que `esCumpleanosHoy` (ítem 19), pero evaluado contra
  el año en que la próxima fecha realmente cae (este año si no pasó, el
  que viene si ya pasó) — no contra el año actual a secas, que hubiera
  hecho que alguien nacido el 29/2 festeje según si el año *que viene* es
  bisiesto en vez del año en que el cumpleaños en sí cae.

## 35. Buscador en la lista de Clientes (2026-09-13)

Primera de dos mejoras que pidió Cecilia (la segunda es un programa de
referidos). Se agregó un buscador arriba de la lista de "Clientes" (panel
de negocio/admin) que filtra por nombre, email o celular:

- `GET /api/clientes` acepta un parámetro `q` opcional — filtra con `OR`
  (`contains`, insensible a mayúsculas) sobre esos tres campos, siempre
  además del filtro de `negocioId` que ya existía. Búsqueda del lado del
  servidor (no solo de la página cargada): necesario para que encuentre a
  alguien sin importar en qué página del paginado esté.
- El input se debounce 300ms (no busca en cada tecla) y cada búsqueda
  nueva vuelve a la página 1, porque el resultado filtrado no tiene por
  qué tener la misma cantidad de páginas que la lista completa.
- `clientesData` es el mismo estado que alimenta también la vista previa
  de "Clientes" en Inicio — se agregó un efecto que vacía la búsqueda al
  salir de la sección Clientes, para que esa vista previa no se quede
  mostrando un resultado filtrado sin ningún indicio de por qué.

**Nota sobre lint**: esto sumó 2 nuevos "Calling setState synchronously
within an effect" (la base pasa de 19 a 21) — misma categoría exacta que
ya tenía varios casos preexistentes en este archivo (ej. el efecto que
resetea la página al cambiar de negocio, unas líneas más arriba), no un
tipo de problema nuevo.

## 36. Programa de referidos (2026-09-13)

Segunda de las dos mejoras que pidió Cecilia (la primera fue el buscador
de clientes, ítem 35). Cada cliente tiene su propio link de invitación;
cuando alguien se registra con ese link y hace su **primera compra**, las
dos (quien invitó y quien fue invitada) ganan la misma cantidad de
puntos. Es opcional por negocio: si no se configura, no pasa nada — para
Peperina queda sin activar hasta que Cecilia decida un monto.

Decisiones de diseño (confirmadas con Cecilia antes de implementar):
- **Quién gana puntos**: las dos personas, no solo quien invita.
- **Cuándo se acredita**: en la primera compra de la persona invitada, no
  al registrarse — así no se puede fabricar cuentas falsas sin comprar
  para juntar puntos.
- **Cuánto**: el mismo monto para las dos, un solo número configurable.
- **Dónde se configura**: nuevo campo "Programa de referidos" en Ajustes,
  mismo criterio que el regalo de cumpleaños (vacío = desactivado).

Cómo funciona:
- `Negocio.puntosReferido` (null/0 = desactivado). Nuevo campo en Ajustes,
  PATCH en `/api/negocios` con la misma validación que
  `regaloCumpleanosPuntos`.
- Cada cliente tiene un `Cliente.codigoReferido` de 6 caracteres (sin
  `0/O/1/I/L`, para que no se confundan al escribirlo o dictarlo por
  WhatsApp) — se genera solo, la primera vez que la persona abre "Referí
  a una amiga" en su panel (no al crear la cuenta, así no hace falta
  migrar a los clientes que ya existían).
- El link de invitación (`/club/[negocio]?ref=CODIGO`) se puede copiar o
  mandar por WhatsApp (abre el selector de contactos de WhatsApp, sin un
  número fijo, para que cada una lo mande a quien quiera). Si alguien se
  registra a través de ese link, `Cliente.referidoPorId` queda guardado.
- `Cliente.referidoRecompensado` marca si ya se pagó la recompensa, para
  que solo se pague **una vez** — en la primera compra que hace la
  persona invitada (sea por webhook de Tiendanube, Mercado Pago, Dragon
  Fish o un alta manual de puntos desde el panel), nunca de nuevo en
  compras siguientes.
- `lib/referidos.js` (`acreditarSiEsPrimeraCompraReferida`) hace el pago
  de las dos partes dentro de la misma transacción que ya acredita los
  puntos de la compra en sí (los 4 lugares que suman puntos por compra se
  convirtieron de la forma "lista de operaciones" de Prisma a la forma
  "función" para poder meter esta lógica condicional adentro de la
  transacción). El chequeo de "no pagar dos veces" usa el mismo patrón
  atómico que ya se usaba para no dejar canjear con puntos insuficientes:
  un `updateMany` con la condición en el `where`, y solo se paga si
  `count > 0`.
- Quien invitó recibe el mismo mail de "sumaste puntos" que ya existía,
  después de que la transacción se confirma (nunca adentro de la
  transacción, mismo criterio que ya se usaba para no hacer llamadas
  externas ahí adentro).

**Qué no cubre esto**: no hay ningún tope de cuántas personas puede
invitar alguien, ni límite de tiempo entre el registro y la primera
compra para que cuente. No se probó en producción con una invitación
real (solo con un test transaccional completo contra una base Postgres
real, en este entorno). No hace falta ninguna variable de entorno nueva.

**Nota sobre lint**: esto sumó 1 nuevo "Calling setState synchronously
within an effect" (misma categoría que ya venía de antes, ver ítem 35) —
nada nuevo en tipo de problema.

## 37. Mail de confirmación al canjear un premio (2026-09-13)

Cecilia pidió que a los clientes les lleguen mails "después de cada compra
y/o canje" — las compras ya mandaban mail (`enviarEmailPuntosAcreditados`,
ver README), pero un canje no mandaba nada. Se agregó
`enviarEmailCanje` (`lib/email.js`), llamado desde `POST /api/canjes`
después de confirmado el canje (nunca adentro de la transacción que
descuenta los puntos, mismo criterio que el resto de los mails: si el
mail falla, no hay que revertir un canje ya confirmado).

- Incluye qué premio canjeó, cuántos puntos usó, cuántos le quedan y —si
  el premio generó uno— el código del cupón de Tiendanube, para que la
  clienta sepa cómo usarlo sin tener que volver a entrar a la app.
- El saldo que muestra el mail se relee de la base después de la
  transacción (no se calcula a mano), para que sea el número real aunque
  algún otro movimiento haya pasado justo entre medio.

**Esto no alcanza por sí solo para que los mails le lleguen a clientes
reales**: mientras `RESEND_FROM_EMAIL` siga sin configurar, el remitente
por defecto (`onboarding@resend.dev`, el dominio de prueba de Resend)
solo entrega a la casilla con la que se creó la cuenta de Resend. Para
que llegue a cualquier clienta hace falta verificar `retornar.com.ar`
como dominio propio en Resend (agregando ahí los registros DNS que pida,
en el DNS de Netlify ya que el dominio delega a sus nameservers — ver
ítem sobre la delegación de NIC.ar) y cargar `RESEND_FROM_EMAIL` con una
dirección de ese dominio. Ese paso queda pendiente de que Cecilia lo
haga (o lo hagamos juntos) desde las cuentas de Resend/Netlify, no es
algo que se resuelva por código.

## 38. Link "Registrate" en la pantalla de login (2026-09-14)

Cecilia probó entrar a `retornar.com.ar` (que redirige sola a `/login`,
ver `middleware.js`) buscando cómo registrarse y no encontró ningún
indicio — la pantalla de login solo tiene email/contraseña, para entrar
con una cuenta que ya existe. Se agregó un link "¿No tenés cuenta?
Registrate" debajo del botón de "Ingresar".

**Hardcodeado a `/registro/peperina`**: el registro en Retornar siempre
es específico de un negocio (no existe una cuenta "genérica"), y hoy
Peperina es el único negocio real. Cuando exista un segundo negocio de
verdad, este link fijo deja de alcanzar — hay que resolverlo de otra
forma (¿un selector de negocio?, ¿un subdominio propio por negocio?,
¿que cada negocio tenga su propia URL de login?). Queda anotado para
cuando llegue ese momento, no es una decisión definitiva.

## 39. Umbrales de nivel de cliente, subidos (2026-09-14)

Quedó pendiente desde el ítem 23: los umbrales de nivel (Bronce/Plata/
Oro/Diamante/VIP) eran un punto de partida mío sin confirmar con
Cecilia. Ahora sí: le parecía muy fácil llegar a VIP. Con "1 punto cada
$100" (el `puntosXPeso` real de Peperina), los umbrales viejos ya
equivalían a $100mil/$300mil/$600mil/$1 millón de pesos gastados
acumulados — no tan bajo como ella pensaba (probablemente la impresión
vino de alguna compra de prueba cargada con un monto grande), pero de
todas formas pidió subirlos bastante más. Quedaron así:

| Nivel | Puntos (antes → ahora) | Pesos gastados (con $100/punto) |
|---|---|---|
| Bronce | 0 → 0 | $0 (arranca ahí, sin cambios) |
| Plata | 1.000 → 3.000 | $300.000 |
| Oro | 3.000 → 8.000 | $800.000 |
| Diamante | 6.000 → 15.000 | $1.500.000 |
| VIP | 10.000 → 30.000 | $3.000.000 |

Bronce sigue siendo el nivel automático desde el primer día (no hay un
estado "sin nivel" antes de eso — se lo planteé a Cecilia y prefirió
mantenerlo simple). Sin cambios en la lógica, solo en los números de
`NIVELES` (`lib/clienteStats.js`) — si el `puntosXPeso` de Peperina
cambia en el futuro, estos montos en pesos se corren proporcionalmente
(los umbrales están en puntos, no en pesos).

## 40. Panel de negocio/admin responsive en celular (2026-09-14)

Cecilia entró desde el celu al panel de negocio y de administrador y
tenía que arrastrar mucho de costado (o girar el teléfono) para ver todo
completo -- el panel de cliente ya andaba bien, el problema era solo del
lado de negocio/admin. Dos causas, las dos en `app/page.js` /
`app/globals.css`:

- **La barra lateral (`app/page.js`)** tiene 210px fijos -- en un celular
  angosto se come más de la mitad de la pantalla. Abajo de 640px se
  achica a una franja de solo íconos (56px): se ocultan el título, el
  nombre del usuario y el texto de los botones de navegación/cerrar
  sesión (quedan sus íconos, incluido uno nuevo 🚪 para "Cerrar sesión").
  Nuevas clases `fid-panel-sidebar`, `fid-sidebar-header`,
  `fid-sidebar-nav`, `fid-sidebar-label` para poder apuntarles desde el
  CSS (antes todo el layout era inline, sin ningún className).
- **Las grillas de varias columnas** (formularios, tarjetas de stats)
  usan `1fr` por columna -- por una particularidad de CSS Grid, una
  columna `1fr` no se achica por debajo del ancho mínimo de su contenido
  (ej. un `<input>`) salvo que se le diga explícitamente, así que
  forzaban scroll horizontal aunque el resto del layout ya se adaptara
  bien. Se arregló con dos reglas genéricas en `globals.css` que apuntan
  a cualquier elemento con `grid-template-columns` en el `style` inline
  (en vez de tocar una por una las ~18 grillas que hay en el archivo):
  `min-width: 0` en sus hijos directos (deja que se achiquen), y abajo de
  480px pasan a una sola columna (una de 4-5 columnas, como "Nuevo
  negocio" o los colores de marca, quedaba ilegible apretada aunque ya no
  forzara scroll).

Probado con Playwright contra un viewport de celular (390×844) logueado
como negocio y como admin, en las pantallas con las grillas más anchas
(Ajustes, Premios, Nuevo negocio, colores de marca) -- sin scroll
horizontal en ninguna, y sin cambios visuales en el panel de cliente
(confirmado aparte, para no meter una regresión ahí).

## 41. Texto largo superpuesto en las filas de clientes/canjes (celular) (2026-09-14)

Apenas mergeado el ítem 40, Cecilia probó "Mis clientes" desde el celu y
encontró otro caso que ese arreglo no cubría: con un nombre largo, el
texto se metía debajo de la insignia de nivel y de la burbuja de puntos
en vez de cortarse, y un email largo tampoco se llegaba a ver completo.
No era scroll horizontal (lo del ítem 40 son grillas CSS) sino filas con
`display: flex` normal, donde ni el nombre ni el email tenían ningún
límite: sin `overflow`/`text-overflow`/`white-space`, un texto largo
simplemente se dibuja más allá de su caja en vez de cortarse o
envolverse, superponiéndose visualmente con lo que esté al lado.

Se agregó recorte con "..." (`overflow: hidden`, `textOverflow:
'ellipsis'`, `whiteSpace: 'nowrap'`, más `minWidth: 0` en el contenedor
flex para que el recorte tenga sobre qué actuar) al nombre+insignia de
nivel y al email en la lista de "Clientes" (`VistaClientes`), a la
vista previa de clientes en Inicio, y al nombre de premio + cliente en
"Puntos y canjes" (`VistaCanjes`) -- mismo patrón en los tres, encontrado
al revisar dónde más se repetía. Las burbujas de puntos (que sí tienen
que verse completas) se marcaron con `flexShrink: 0` para que nunca sean
ellas las que se achiquen.

## 42. Filtro por nivel en la lista de Clientes (2026-09-14)

Al buscador de "Mis clientes" (nombre/email/celular, ver ítem 35) se le
agregó un desplegable al lado para filtrar por nivel (Bronce/Plata/Oro/
Diamante/VIP) — se combinan los dos filtros si están cargados los dos.

- El nivel no vive en la base (se calcula de los puntos ganados de por
  vida, ver ítem 39), así que `GET /api/clientes?nivel=...` necesita un
  paso aparte *antes* de paginar: junta los clientes que ya matchean el
  resto de los filtros, suma sus puntos ganados con un
  `movimientoPuntos.groupBy`, les calcula el nivel, y recién ahí filtra y
  pagina. Filtrar por nivel solo dentro de la página ya traída (después
  de paginar, como hace `calcularStatsClientes` normalmente) daría
  resultados incompletos según en qué página esté cada cliente.
- Sin test automático de la ruta en sí (el proyecto solo testea lógica
  pura en `lib/`, no rutas con base de datos, ver README) — se probó a
  mano contra una base Postgres real con un cliente de cada nivel:
  cada filtro muestra solo al que corresponde, la combinación con
  búsqueda de texto anda bien, y el mensaje de "sin resultados" aparece
  cuando ningún cliente matchea los dos filtros juntos.

## 43. Dominio viejo hardcodeado en el widget de la tienda online (2026-09-14)

Cecilia pidió el cartelito de "comprando esto sumás X puntos" al lado
del precio en la tienda online de Peperina — resultó que **ya existía**
(`public/widget.js`, ver ítem 2 y su sección en el README), armado hace
tiempo pero nunca embebido de verdad en una tienda real. Al revisarlo
para confirmar que decía exactamente "sumás X puntos" (nunca "$35.000 o
X puntos", para no confundir con que sea canjeable ahí) apareció el
mismo bug de dominio viejo que los ítems 6 y el de `NEXTAUTH_URL`: el
`base` por defecto (cuando la tienda no manda `data-retornar-base`)
seguía apuntando a `incomparable-zabaione-b58c21.netlify.app` en vez de
`retornar.com.ar`. Corregido en las dos funciones del widget, y sacada
del README la nota vieja de "mientras retornar.com.ar no esté apuntado,
usar la URL de Netlify" (ya está apuntado hace rato).

**Lo que falta no es código**: agregar el `<div data-retornar-widget>` +
`<script>` (ver README) al template de la página de producto de la
tienda de Peperina en Tiendanube, algo que se hace desde el editor de
temas de Tiendanube (no desde acá) y necesita el precio del producto en
formato numérico plano en `data-precio` — la sintaxis exacta de esa
variable en el theme de Peperina no se pudo confirmar desde este
entorno (sin acceso a internet para consultar la documentación de
Tiendanube ni al panel de la tienda), queda para resolver junto con
Cecilia o quien administre el tema de la tienda.

## 44. Diferenciar visualmente el panel de admin del de negocio (2026-09-14)

Cecilia sentía que el panel de admin y el de un negocio "se ven
prácticamente iguales" — con razón: cuando el admin entra al panel de un
negocio puntual, `PanelNegocio()` es literalmente el mismo componente
que ve el dueño de ese negocio logueado directo (mismo código a
propósito, para no duplicar pantallas — ver ítem 40 y el resto del panel
de negocio). Le pregunté qué tipo de diferencia buscaba (¿visual?,
¿más información solo para admin?, ¿separar funciones?) y pidió lo
visual: que se note a simple vista en cuál está, sin importar que el
contenido sea el mismo.

- La barra lateral de admin (`app/page.js`) pasó de blanca/genérica a un
  esquema oscuro fijo (`#111827`, con acentos índigo) que **nunca**
  cambia según el tema de ningún negocio — a diferencia de la del
  negocio, que sí usa los colores de marca propios (`tema.superficie`
  etc.), la de admin siempre se ve igual, para que sea inconfundible.
  Se le agregó también una etiqueta "ADMIN" al lado del logo.
- Cuando el admin entra al panel de un negocio puntual (`onVolver`
  presente, viene de la sidebar de admin — nunca cuando el negocio
  entra con su propia cuenta), aparece un cartel fijo arriba de todo
  ("🛡️ Estás viendo esto como administrador, no como {negocio}"), con
  la misma paleta oscura/índigo de la sidebar de admin, para asociarse
  visualmente con "modo admin" sin importar el tema del negocio que se
  esté mirando.
- `.fid-sidebar-item:hover` (compartida entre las dos sidebars) tenía un
  overlay oscuro que casi no se notaba sobre el fondo ahora oscuro de
  admin — se agregó una regla aparte (`.fid-panel-sidebar-admin`) con un
  overlay claro solo para esa sidebar, sin tocar el hover de la del
  negocio (que sigue pudiendo ser clara u oscura según su marca).

Probado con Playwright: el panel propio de Peperina (logueada como
negocio) sigue exactamente igual que antes; el panel de admin se ve
oscuro con la etiqueta ADMIN y, apenas entra a gestionar un negocio, el
cartel de aviso aparece arriba de todo.

## 45. Exportar clientes a CSV/Excel (2026-09-14)

Cecilia quería tener los datos de sus clientes en un Excel, para poder
usarlos fuera de Retornar (ej. una campaña de WhatsApp o mail masivo).
Se agregó un botón "⬇️ Exportar" al lado del buscador/filtro de nivel en
"Mis clientes" — descarga un CSV con todos los clientes que matchean los
filtros activos (si hay búsqueda o nivel cargados, exporta ESO, no
siempre la lista completa).

- `GET /api/clientes/exportar` (mismos filtros `q`/`nivel` que la lista
  en pantalla, mismo cálculo de nivel vía `calcularStatsClientes`) arma
  el CSV a mano, sin ninguna librería nueva.
- Separador `;` (no `,`): es lo que Excel en español espera para abrir
  el archivo directo con los acentos bien, sin pasar por el asistente de
  importación (`,` es el separador decimal en es-AR, así que Excel local
  no lo toma como separador de columnas).
- BOM UTF-8 al principio del archivo: sin esto Excel interpreta los
  acentos/ñ con el charset equivocado y quedan como símbolos raros.
- Columnas: nombre, email, teléfono, DNI, fecha de nacimiento, puntos
  actuales, nivel, compras registradas, fecha de alta, última actividad
  (DNI y fecha de nacimiento se sumaron a pedido de Cecilia apenas
  probó la primera versión). Vacío en vez de romper para un cliente
  que no tiene esos datos cargados (dados de alta antes del registro
  extendido, o cargados a mano sin completarlos). La fecha de
  nacimiento se formatea forzando `timeZone: 'UTC'` (se guarda como
  medianoche UTC, mismo criterio que `lib/cumpleanos.js`) para que no
  se corra un día para atrás según en qué huso horario corra el deploy.
- Probado con Playwright (login real, click en el botón, confirmar la
  descarga) contra una base Postgres real, incluyendo un cliente con
  comillas y punto y coma en el nombre para confirmar que el escapado
  CSV los maneja bien, y un cliente con DNI/fecha de nacimiento cargados
  junto a otro sin esos datos.

## 46. Nombre y apellido en el registro público (2026-09-14)

El formulario de auto-registro (`/registro/[negocio]`) nunca pedía el
nombre del cliente — solo email, contraseña, fecha de nacimiento, DNI,
celular y sexo. Por eso una clienta que se registraba sola aparecía en
el panel y en el Excel mostrando su email en vez de su nombre. Cecilia
preguntó si valía la pena agregarlo; dado que ya se pide el DNI (mucho
más invasivo), un campo de nombre no suma fricción real al registro.

- Dos campos separados en el formulario, "Nombre" y "Apellido" (a
  pedido de Cecilia), que se combinan en un solo string antes de
  mandarlo a la API (`${nombre} ${apellido}`) — el resto de la app
  (lista de clientes, mensaje de WhatsApp, exportación a Excel, alta
  manual desde el panel) ya trata `Cliente.nombre` como un solo campo
  de texto, así que no hizo falta agregar una columna `apellido`
  aparte ni tocar nada más.
- Ahora obligatorio (antes no existía el campo). Los clientes que ya se
  habían registrado sin nombre antes de este cambio quedan igual que
  estaban (`nombre: null`, siguen mostrando el email) — no se completa
  solo con nada retroactivamente.
- Probado con Playwright contra una base Postgres real: registro
  completo con "Julieta" / "Gómez" en los dos campos, confirmado en la
  base que quedó guardado como `"Julieta Gómez"`.

## 47. Cache-Control: no-store en las pantallas públicas (2026-09-15)

Apenas mergeado el ítem 46, el hermano de Cecilia probó registrarse y le
apareció el formulario VIEJO (sin los campos de Nombre/Apellido) pero
con el error NUEVO ("Nombre, email y contraseña son obligatorios.") —
su navegador tenía guardada una versión vieja de `/registro/[negocio]`
(sin los campos nuevos) pero el POST le pegó al backend ya actualizado
(que sí exige `nombre`), un combo imposible de entender para quien lo
sufre. Mismo tipo de confusión que ya había pasado con el redirect de
`/login` (ítem 38) unos días antes — pasó dos veces en la misma sesión.

Se agregó `Cache-Control: no-store` (`next.config.mjs`, `headers()`)
para `/login`, `/registro/[negocio]` y `/club/[negocio]` -- las tres
pantallas de cara a alguien que todavía no tiene sesión iniciada, y por
lo tanto no sabe que existe un botón de "recargar forzado" cuando algo
no cuadra. No cubre el panel de negocio/admin/cliente (ahí si hace
falta se lo puedo pedir yo directamente a quien lo esté viendo).

Confirmado con `next build && next start` + `curl -I` que las tres
rutas devuelven el header. **Esto no borra lo que el navegador de una
visita anterior ya tenía guardado** — solo previene que vuelva a pasar
después de futuros cambios. Quien ya lo tenía cacheado (como el
hermano de Cecilia en este caso) todavía necesita un refresco forzado
una vez.

## 48. Login automático después de registrarse (2026-09-15)

El hermano de Cecilia se registró y notó que, después de crear la
cuenta, lo mandaba a `/login` a tipear de nuevo el email/contraseña que
acababa de elegir — un paso de más e innecesario, ya que esos datos
recién se guardaron.

`app/registro/[negocio]/page.js` ahora llama a `signIn('credentials',
{ email, password, redirect: false })` con esas mismas credenciales
apenas el registro se confirma, y manda a `/` en vez de a `/login` — la
clienta cae directo en su panel ya logueada, sin ningún paso extra. Si
por algún motivo ese login automático fallara (no debería, son las
credenciales que recién se guardaron), sigue el comportamiento de antes
como respaldo: aviso de cuenta creada y redirección a `/login`.

Probado con Playwright contra una base Postgres real: registro
completo, sin que aparezca ningún alert, termina en `/` mostrando
"Hola, Sofía" ya dentro del panel de cliente.

## 49. Último rincón con el dominio viejo de Netlify + posible login con Google roto (2026-09-15)

Cecilia notó que los carteles de "creado con éxito"/"cargado con éxito"
mostraban "incomparable-zabaione-b58c21.netlify.app" en vez de
Retornar — eso es el navegador mostrando el sitio real en el que está
parada (no algo que el código pueda cambiar), así que confirma que
está entrando por la URL vieja de Netlify en vez de `retornar.com.ar`
(seguramente un favorito/acceso directo guardado de antes).

Aprovechando la revisión, encontré y corregí la causa raíz probable de
por qué esa URL quedó pegada en tantos lugares esta sesión
(`NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, el widget, y ahora esto): el
propio `docs/contexto-proyecto.md` (el documento que uso para arrancar
cualquier sesión sin releer todo el código) decía literalmente que "el
sitio de producción real" era la URL de Netlify — desactualizado desde
que `retornar.com.ar` quedó apuntado. Corregido ahí y en el ítem 1 de
este mismo archivo.

- `dragonfish-agente/index.js`: el `FIDELIZA_BASE_URL` por defecto (si
  se deja en blanco en el `.env` de la PC de Peperina, que es lo
  recomendado) también apuntaba a la URL de Netlify — corregido a
  `retornar.com.ar`.

**⚠️ Encontré algo más serio revisando esto, sin confirmar todavía**:
cuando se corrigió `NEXTAUTH_URL` (2026-09-14, ver más arriba), el
"URI de redireccionamiento autorizado" cargado en el Cliente OAuth de
Google Cloud Console sigue siendo el de Netlify (nunca se actualizó).
Si es así, el botón "Iniciar sesión con Google" en producción
probablemente esté devolviendo `Error 400: redirect_uri_mismatch`
ahora mismo. Hace falta que Cecilia (o quien tenga acceso) entre a
Google Cloud Console → Credenciales → Cliente OAuth "Fideliza Web" →
agregue `https://retornar.com.ar/api/auth/callback/google` a los URIs
autorizados. Detalle completo en `docs/contexto-proyecto.md`.

## 50. Otros pendientes menores (de sesiones previas, sin resolver)

- ~~Los webhooks de Tiendanube y Mercado Pago no verifican firma~~ — ✅
  resuelto, ver ítem 31.
- No hay pantalla de autogestión del tema visual para el propio negocio
  (hoy solo lo carga el admin, y para Peperina se cargó a mano vía
  migraciones de datos porque no había otra forma). Evaluar si hace
  falta una vez que haya un segundo negocio real usando marca propia.
- Cambiar la contraseña del admin no es auto-gestionable — sale de
  `ADMIN_PASSWORD_HASH` (variable de entorno en Netlify), no de la base.
  Migrarla es una decisión de diseño más grande (afecta el modelo de
  autenticación), se deja para cuando haya un pedido concreto.
