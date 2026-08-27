# Tareas futuras — Fideliza

> Lo que sigue una vez retomado el proyecto. Ver `sesion-actual.md` para
> el detalle completo de cómo se llegó a este punto.

## 1. Idea nueva planteada por Cecilia: notificar a clientes por email

Su mamá (dueña de Peperina) quiere que sus clientas **no tengan que
entrar a ninguna web** — que casi ni se enteren de que existe un panel —
y en cambio reciban un mail después de cada compra con los puntos que
sumaron. Es una funcionalidad nueva bastante grande, no un ajuste:

- Hoy el proyecto **no tiene ningún servicio de envío de emails
  conectado** — habría que sumar uno (ej. Resend, SendGrid), con su
  propia configuración de dominio/remitente y costo aparte.
- Falta charlar el diseño antes de escribir código: qué dispara el
  email (cada `MovimientoPuntos`, o solo compras por sobre cierto
  monto), qué información lleva, si reemplaza o convive con el panel del
  cliente actual (`PanelCliente`), y si hace falta algo de
  personalización visual del email en sí (coherente con la marca propia
  ya construida).
- **Ojo**: si el email se dispara desde `MovimientoPuntos`, hoy el
  webhook de Tiendanube no escribe ahí (a diferencia de compra manual y
  Mercado Pago) — habría que arreglar eso primero, o elegir otra fuente.
- Sin retomar todavía — queda anotado para la próxima vez que se hable
  de features nuevas.

## 2. Destrabar Dragon Fish (prioridad real para el volumen de Peperina)

Charlando cómo se suman los puntos, Cecilia planteó que no quiere que el
negocio cargue compra por compra a mano (no escala con miles de
clientes) ni que la clienta tenga que hacer nada. De los caminos que
existen hoy, los únicos dos que cumplen eso son Tiendanube (ya andando,
para ventas online) y Dragon Fish (para las ventas del local físico,
donde está el volumen real). Por eso destrabar Dragon Fish pesa más que
cualquier otro ajuste pendiente — bloqueado esperando la respuesta de
soporte de Zoo Logic sobre el formato real de la consulta de factura por
`Codigo`.

## 3. Otros pendientes menores (de sesiones previas, sin resolver)

- Tiendanube: pausado a propósito hasta que la tienda esté activa (el
  flujo OAuth2 no está armado).
- Limitación conocida de Netlify (no bloqueante): `DATABASE_URL` no está
  configurada para el contexto de Deploy Previews, así que esos checks
  siempre van a fallar con `P1012`. Ver `contexto-proyecto.md` si en
  algún momento se quiere resolver (implica darle a los previews acceso
  a la base de producción real, a evaluar con cuidado).
- No hay pantalla de autogestión del tema visual para el propio negocio
  (hoy solo lo carga el admin, y para Peperina se cargó a mano vía
  migraciones de datos porque no había otra forma). Evaluar si hace
  falta una vez que haya un segundo negocio real usando marca propia.
- Cambiar la contraseña del admin no es auto-gestionable — sale de
  `ADMIN_PASSWORD_HASH` (variable de entorno en Netlify), no de la base.
  Migrarla es una decisión de diseño más grande (afecta el modelo de
  autenticación), se deja para cuando haya un pedido concreto.
