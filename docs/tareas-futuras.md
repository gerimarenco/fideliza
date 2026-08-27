# Tareas futuras — Fideliza

> Lo que sigue una vez retomado el proyecto. Ver `sesion-actual.md` para
> el detalle completo de cómo se llegó a este punto.

## 1. Aclarar "los mini dibujitos"

Cecilia pidió explícitamente "meterle los detalles, los mini dibujitos"
al hablar del diseño. Se interpretó como el color de "resaltado" nuevo
en los chips de puntos/avatares, pero no quedó confirmado si se refería
a algo más concreto (íconos ilustrados, alguna decoración puntual que
vio en peperina.com u otro sitio de referencia).

- [ ] Preguntarle directamente con un ejemplo puntual la próxima vez que
      se retome el tema visual, en vez de asumir.

## 2. Ítem "Ajustes" del panel Admin (sin construir)

Sigue sin alcance definido y sin backend (a diferencia de "Ajustes" del
panel de Negocio, que ya está completo: contraseña, `puntosXPeso`, datos
de cuenta). Pendiente de una charla de producto sobre qué debería
incluir antes de encararlo.

## 3. Idea nueva planteada por Cecilia: notificar a clientes por email

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
- Sin retomar todavía — queda anotado para la próxima vez que se hable
  de features nuevas.

## 4. Otros pendientes menores (de sesiones previas, sin resolver)

- Dragon Fish: bloqueado esperando la respuesta de soporte de Zoo Logic
  sobre el formato real de la consulta de factura por `Codigo`.
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
