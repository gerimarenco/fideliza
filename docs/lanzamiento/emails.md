# Emails a las clientas (2026-11-07)

Todos los mails que Retornar manda a las clientas: compra (y regalo de
cumpleaños y bono por referir), canje, puntos por vencer, puntos vencidos,
recuperación de contraseña y, nuevo, la bienvenida. Se mandan con Resend
(`lib/email.js`, plantilla en `lib/plantillaEmail.js`).

## 1. Remitente

**Hecho: nombre visible.** En Ajustes → "Emails a tus clientas" cada negocio
carga el nombre que se ve en la bandeja (ej. **Club Peperina**). El mail sale
como `Club Peperina <club@retornar.com.ar>`: cambia el nombre, no la
dirección, así que no hace falta tocar DNS ni Resend. Vacío = "Retornar",
como hasta ahora (los demás negocios no cambian hasta que lo carguen). El
mail de contraseña de la cuenta del negocio sigue saliendo de Retornar.

**Hecho: "responder a".** Si el negocio cargó su email de soporte (Ajustes →
Contacto de soporte), las respuestas de las clientas llegan ahí, y el pie del
mail invita a responder.

**No hecho (requiere DNS y tu autorización): la dirección club@peperina.com.ar.**
Resend solo manda desde dominios verificados. Para usar `peperina.com.ar`:

1. En Resend → Domains → Add domain: `peperina.com.ar` (conviene un
   subdominio de envío, p. ej. `mail.peperina.com.ar`, para no mezclar con
   los mails que ya use Peperina).
2. En el DNS de `peperina.com.ar` (quien lo administre: NIC.ar, el hosting o
   Tiendanube), cargar los registros que muestra Resend:
   - **MX** en `send` (return-path de los rebotes).
   - **TXT SPF** en `send`: `v=spf1 include:amazonses.com ~all`.
   - **TXT DKIM** en `resend._domainkey`: el valor que da Resend.
   - Recomendado, **TXT DMARC** en `_dmarc`: empezar con
     `v=DMARC1; p=none; rua=mailto:<un email de Peperina>` y, cuando los
     reportes den bien, pasar a `p=quarantine`.
   Estos registros no tocan el MX principal: los mails que recibe Peperina
   siguen igual.
3. Esperar la verificación (suele ser en minutos; hasta 72 h).
4. Recién ahí, cambiar la dirección en el código o la configuración
   (variable `RESEND_FROM_EMAIL` o un campo por negocio). Con un solo negocio
   con dominio propio alcanza con la variable.

A revisar antes: el plan de Resend de la cuenta y cuántos dominios permite
(si hubiera que pasar a un plan pago, consultarlo antes). Sin el dominio
verificado, un mail desde `@peperina.com.ar` lo rechaza Resend.

Ventaja de hacerlo: la dirección coincide con la marca y la tienda; Gmail
asocia la reputación al dominio de Peperina. Mientras tanto, `retornar.com.ar`
ya está verificado y funciona.

## 2. Bienvenida

Nuevo, activable por negocio (Ajustes → "Mandar un email de bienvenida…",
desactivado por defecto). Al registrarse por la página del club: saludo por
el nombre, gracias por sumarse, cómo se suman puntos (1 punto cada $X), el
regalo de bienvenida si lo hubo, el primer premio y cuántos puntos faltan.
Se manda una sola vez (al crear la cuenta) y si falla no frena el registro.
Las cuentas cargadas desde el panel no lo reciben.

## 3. Aviso de vencimiento

Ya existía (30 días antes, una vez por lote, con pausa de 14 días entre
avisos). Se calcula **por movimiento de puntos**: cada compra es un lote con
su propia fecha y solo cuenta lo que todavía no se usó (`saldoRestante`); los
lotes ya usados o ya vencidos no entran, y nunca el saldo total. Ejemplo
(probado): saldo 4.700 con 500 y 200 por vencer en fechas distintas → "Tenés
700 puntos que vencen…", con el detalle "500 el … · 200 el …".

Nuevo en el mail:
- el detalle por fecha si vencen en días distintos;
- los premios que ya puede canjear y, para los demás, cuántos puntos faltan
  y **cuánto tendría que comprar** según la equivalencia vigente
  (`Negocio.puntosXPeso`; ej. 300 puntos a $100 por punto = $30.000);
- la invitación según el caso (canjear antes de la fecha o cuánto le falta
  para el primer premio).

No se repite: cada lote se marca al avisar (`avisoVencimientoEn`) y correr la
tarea de nuevo no manda nada (probado).

## 4. Gmail: canje en "Promociones", compra en "Principal"

Gmail no publica sus reglas: clasifica con aprendizaje automático según el
contenido, el historial del remitente y lo que hacen las destinatarias. No
hay forma de garantizar una pestaña.

**Qué se comparó** (antes de este cambio):

| | Compra | Canje |
|---|---|---|
| Remitente | `Retornar <club@retornar.com.ar>` | igual |
| Autenticación (SPF/DKIM del dominio) | igual (mismo dominio y proveedor) | igual |
| Plantilla | igual | igual |
| Proveedor | Resend, mismos encabezados | igual |
| Asunto | `+250 puntos en Club Peperina` | `Canjeaste 10% en toda la tienda en Club Peperina` / `…$70.000 de descuento…` |
| Contenido | puntos sumados, premios | **código de cupón en un recuadro punteado**, "descuento", "%", "$", link a la tienda (otro dominio) |
| Versión de texto | no | no |

Lo único que cambia entre los dos es el **contenido**: el de canje tenía las
señales típicas de un mail promocional (cupón, porcentaje, monto, "descuento"
en el asunto, link a una tienda). Remitente, dominio, autenticación y
proveedor son los mismos, así que no son la causa de la diferencia.

**Qué se cambió** (todos los mails):
- Canje como confirmación: asunto `Confirmación de tu canje en Club
  Peperina` (sin %, $ ni "descuento"), título "Canje confirmado", el código
  como un dato ("usá este código al pagar"), no como "cupón de descuento".
- Versión de solo texto en todos los mails (además del HTML).
- "Responder a" el email de soporte del negocio: un mail al que se puede
  responder es más "personal" para los filtros.
- Línea de vista previa (preheader) clara en cada mail.
- Nombre del remitente del club, coherente con el contenido.
- HTML más liviano: sin sombras ni bloques decorativos, una sola llamada a
  la acción.

**Qué revisar con un mail real** (sin mandar campañas: alcanza con un canje
de prueba a una cuenta propia): en Gmail, "⋮ → Mostrar original" tiene que
decir **SPF: PASS**, **DKIM: PASS** y **DMARC: PASS**. Si DMARC no aparece,
agregar el registro `_dmarc` de `retornar.com.ar` (`v=DMARC1; p=none;` para
empezar). También se puede probar la autenticación con mail-tester.com.

## 5. Diseño

Una sola plantilla para todos, con los colores del negocio (los mismos de su
panel): fondo del negocio, tarjeta blanca con línea fina, logo (o el nombre
del club en versalitas), ícono lineal, título en serif con una línea corta
del color de marca, el dato principal en serif sobre el fondo del negocio,
botón recto y un pie breve ("Recibís este email porque tenés una cuenta en
Club Peperina · Club Peperina · con Retornar"). Hecha con tablas y estilos en
línea para que se vea igual en Gmail, Outlook y Apple Mail. Aplica a todos
los negocios (cada uno con sus colores).

## Pruebas

`pruebas/e2e/emails.mjs` con Resend simulado (ningún mail sale de verdad):
ajustes, bienvenida (y que no se manda si está desactivada), remitente y
"responder a", versión de texto, compra, canje, aviso de vencimiento por lote
(700 de 4.700; lotes usados y vencidos excluidos; premios y cuánto comprar;
sin repetir), contraseña del negocio y de la clienta, y otro negocio sin
cambios. Las capturas de cada mail quedan en `$RETORNAR_E2E_DIR/mail-*.png`.
