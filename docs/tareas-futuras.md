# Tareas futuras — Fideliza

> Lo que sigue una vez retomado el proyecto. Ver `sesion-actual.md` para
> el detalle completo de cómo se llegó a este punto.

## 1. Notificar a clientes por email — ✅ resuelto (2026-09-04)

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
- Si Dragon Fish reporta una venta de alguien sin cuenta en Fideliza (y
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

## 2. Dragon Fish — ✅ resuelto (2026-09-03/04)

Cecilia planteó que no quería que el negocio cargue compra por compra a
mano (no escala con miles de clientes) ni que la clienta tenga que hacer
nada. Dragon Fish (POS del local físico de Peperina, donde está el
volumen real) ya está integrado de punta a punta y confirmado en
producción: venta real de prueba acreditó puntos correctamente. Detalle
completo en el README (tabla de integraciones) y en `dragonfish-agente/`.
Pendiente menor: que el agente local arranque solo con Windows en vez de
tener que iniciarlo a mano en la PC de Peperina.

## 3. Otros pendientes menores (de sesiones previas, sin resolver)

- Tiendanube: pausado a propósito hasta que la tienda esté activa (el
  flujo OAuth2 no está armado).
- No hay pantalla de autogestión del tema visual para el propio negocio
  (hoy solo lo carga el admin, y para Peperina se cargó a mano vía
  migraciones de datos porque no había otra forma). Evaluar si hace
  falta una vez que haya un segundo negocio real usando marca propia.
- Cambiar la contraseña del admin no es auto-gestionable — sale de
  `ADMIN_PASSWORD_HASH` (variable de entorno en Netlify), no de la base.
  Migrarla es una decisión de diseño más grande (afecta el modelo de
  autenticación), se deja para cuando haya un pedido concreto.
