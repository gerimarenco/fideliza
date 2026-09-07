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

**Pendiente real**: `retornar.com.ar` está registrado pero **todavía no
apunta al deploy de Netlify** (falta cargarlo como dominio personalizado
en Netlify + los registros DNS que pida en NIC.ar). Hasta que eso esté
hecho, la URL real de producción sigue siendo la de Netlify
(`incomparable-zabaione-b58c21.netlify.app`).

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
- **peperina.com → registro de Retornar**: pendiente por completo, es
  un cambio del lado de Tiendanube (no de este repo) — agregar un ítem
  de menú "Sumate al club Peperina" que linkee a
  `/registro/peperina` de Retornar. En Tiendanube esto suele hacerse
  desde el editor de menús como un "Enlace externo", sin necesitar
  tocar código de la tienda (a diferencia del widget, que sí necesitó
  el editor de código).

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

## 9. Otros pendientes menores (de sesiones previas, sin resolver)

- Tiendanube: la conexión real (OAuth2, para acreditar puntos
  automáticamente después de cada pago) todavía no está armada — pausado
  a propósito hasta que se retome. El widget de fidelización (punto 4
  arriba) no depende de esto y ya se puede usar.
- No hay pantalla de autogestión del tema visual para el propio negocio
  (hoy solo lo carga el admin, y para Peperina se cargó a mano vía
  migraciones de datos porque no había otra forma). Evaluar si hace
  falta una vez que haya un segundo negocio real usando marca propia.
- Cambiar la contraseña del admin no es auto-gestionable — sale de
  `ADMIN_PASSWORD_HASH` (variable de entorno en Netlify), no de la base.
  Migrarla es una decisión de diseño más grande (afecta el modelo de
  autenticación), se deja para cuando haya un pedido concreto.
