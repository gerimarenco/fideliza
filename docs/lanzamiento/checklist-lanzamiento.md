# Checklist de lanzamiento — Club Peperina

Cada punto se marca recién con evidencia (captura, línea de log, número).
"Genaro" incluye a quien él designe (por ejemplo, la persona de la caja).

## A. Antes de anunciarlo

| # | Qué | Responsable | Cómo se confirma (evidencia) | Hecho |
|---|---|---|---|---|
| A1 | Mergear y publicar el hito 1 y 2 (PR #114) | Genaro | Publicado (Genaro confirmó el nuevo diseño en retornar.com.ar) | [x] |
| A1b | Publicar el hito 3 (validaciones, límite de login) | Genaro | Netlify publicado; Inicio del negocio muestra "N compraron este mes" | [ ] |
| A2 | Ajustes de Peperina: puntos por peso = 100, vencimiento = 9 meses, regalo de cumpleaños = 350 (decidido por Genaro: ~5% del promedio de los premios). Cargados en Ajustes el 2026-10-24, y bases y condiciones actualizadas a 9 meses | Genaro | Captura de Ajustes | [ ] |
| A3 | Contacto de soporte cargado (Ajustes → Contacto de soporte) | Genaro | En el menú ⋮ de una cuenta de prueba aparece "Escribinos..." y abre el contacto correcto | [ ] |
| A4 | Actualizar los archivos del agente en la PC del local | Genaro | `dragonfish-agente/README.md`, "Actualizar el agente": `verificar-agente.bat` existe en la carpeta | [ ] |
| A5 | Arranque automático: reiniciar la PC, abrir Dragon Fish, esperar 2 min | Genaro | `verificar-agente.bat` dice "El agente esta corriendo" y la última línea tiene la hora de hoy; Integraciones dice "Agente funcionando" | [ ] |
| A6 | Copia de seguridad verificada | Genaro | `backups.md`, puntos 2 y 3, con fila en el registro | [ ] |
| A7 | Privacidad revisada por un profesional, textos aprobados | Genaro | `privacidad.md`, sección 6 | [ ] |
| A8 | Prueba integral completa (sección B) | Genaro | Todas las filas de B con evidencia | [ ] |
| A9 | Vendedoras capacitadas | Genaro | Leyeron `capacitacion-vendedoras.md` e hicieron una venta de prueba cargando el email | [ ] |
| A10 | Material de comunicación listo (sección D) | Genaro | Cartel impreso, posteo programado | [ ] |
| A11 | Mails a clientas reales: remitente con dominio verificado | Genaro | Netlify → Site configuration → Environment variables: `RESEND_FROM_EMAIL` con una dirección `@retornar.com.ar` (no `onboarding@resend.dev`), en el contexto Production. Resend → Domains: `retornar.com.ar` en **Verified**. Resend → Emails: un mail de prueba a una casilla propia (no de una clienta) en **Delivered** | [ ] |

## B. Prueba integral (con una cuenta de prueba propia, nunca de una clienta real)

Lo que ya cubren las pruebas automáticas está marcado **[auto]** (se probó
contra una base local con datos ficticios). Igual hay que confirmarlo una
vez en producción, porque las integraciones reales no se pueden simular
del todo.

| # | Paso | Tipo | Resultado esperado | Hecho |
|---|---|---|---|---|
| B1 | Registrarse en retornar.com.ar/club/peperina con un email propio **escrito con alguna mayúscula** | Manual [auto] | Queda logueada sola; en el panel del negocio el email figura en minúsculas | [ ] |
| B2 | Cerrar sesión, entrar escribiendo el email en minúsculas | Manual [auto] | Entra | [ ] |
| B3 | "¿Olvidaste tu contraseña?" | Manual [auto] | Llega un mail con un link que funciona una sola vez; un segundo pedido inmediato no manda otro mail | [ ] |
| B4 | Compra en el local de $X con ese email cargado en Dragon Fish | Manual (real) | En minutos: puntos sumados, mail de "sumaste puntos", movimiento en "Mis movimientos" | [ ] |
| B5 | Compra en el local con el **celular** cargado en Dragon Fish (con guiones) | Manual (real) [auto] | Suma igual | [ ] |
| B6 | Compra online pagada en peperina.com con el mismo email | Manual (real) | Puntos sumados + mail | [ ] |
| B7 | Canje presencial desde Mis clientes de un premio sin cupón | Manual [auto] | Se descuentan los puntos una vez; aparece en Canjes y llega el mail | [ ] |
| B8 | Canje de cada tipo de cupón (sección C) | Manual (real, autorizado) | Ver C | [ ] |
| B9 | Repetir el reporte de una misma venta [auto]; doble clic rápido en Canjear (manual) | Mixto | La venta no suma dos veces; el doble clic genera un solo canje (el botón se deshabilita al primer clic) | [ ] |
| B10 | Desde la cuenta de prueba, intentar ver datos de otra clienta | [auto] | Imposible (probado en el código: cada consulta filtra por la cuenta) | [ ] |
| B11 | Todo lo anterior desde el celular | Manual | Se lee bien, sin scroll de costado | [ ] |
| B13 | Venta en la caja de $0 (cambio) o menor a $100 con el email de prueba | Manual (real) [auto] | Log del agente: `sin_puntos`; **no** llega mail | [ ] |
| B12 | Día siguiente: Netlify → Functions → `regalo-cumpleanos` y `vencimiento-puntos` | Manual | Las dos corrieron sin error (línea "Regalo de cumpleaños: N cliente(s)..." y "Vencimiento de puntos: ... avisada(s) de puntos por vencer") | [ ] |

## C. Prueba real de cupones de Tiendanube (requiere autorización de Genaro)

Genera cupones reales en la tienda. Usar la cuenta de prueba, premios de
pocos puntos creados para la prueba, y borrar los cupones al terminar
(Tiendanube → Descuentos → Cupones).

| # | Premio de prueba | Qué comprobar | Hecho |
|---|---|---|---|
| C1 | Producto gratis (con ID de producto) | Al canjear aparece un código `RETORNAR-...`; en Tiendanube el cupón existe con el valor del producto, 1 uso; aplicado a un carrito con ese producto lo deja en $0 + envío | [ ] |
| C2 | 10% de descuento | El cupón descuenta el 10% del carrito; no se puede usar dos veces | [ ] |
| C3 | Descuento fijo (ej. $1.000 desde $2.000) | Con carrito de $1.999 **no** se aplica; con $2.000 sí y se paga $1.000 | [ ] |
| C4 | C3 con una promoción automática activa en la tienda | ¿Tiendanube compara la compra mínima antes o después de la promoción? Anotar el resultado | [ ] |
| C5 | C3 con envío | ¿El envío cuenta para llegar a la compra mínima? Anotar el resultado | [ ] |
| C6 | Desconectar/reconectar no aplica: forzar un error (ej. premio con ID de producto inexistente) | El canje queda con error y "Reintentar cupón" en Canjes; al corregir el premio y reintentar, se genera | [ ] |

Si C4 o C5 muestran que el descuento puede superar la mitad de lo pagado,
ajustar la compra mínima del premio de $70.000 en consecuencia.

## D. Comunicación (borradores para ajustar)

**Cartel con QR (local)**
> **Club Peperina**
> Sumá puntos con cada compra y cambialos por premios.
> Escaneá y sumate en 1 minuto.
> [QR a retornar.com.ar/club/peperina]
> Preguntanos en la caja.

(El QR se arma con cualquier generador gratuito apuntando a
`https://retornar.com.ar/club/peperina`. Probarlo con dos celulares
distintos antes de imprimir.)

**Posteo de Instagram**
> Llegó el **Club Peperina** 🤍
> Cada compra en el local y en peperina.com te suma puntos, y los cambiás
> por premios. En tu cumpleaños, puntos de regalo.
> Sumarte es gratis y lleva 1 minuto: link en la bio.
> (Link en la bio: retornar.com.ar/club/peperina)

**Mensaje para clientas actuales (WhatsApp)**
> ¡Hola {nombre}! Te cuento que lanzamos el Club Peperina: con cada compra
> sumás puntos para canjear por premios, y en tu cumpleaños te regalamos
> puntos. Sumate gratis acá: retornar.com.ar/club/peperina
> Cuando vengas, decinos tu mail o celular en la caja y los puntos se suman
> solos.

Ojo: mandar promociones a la base de clientas tiene reglas (ver
`privacidad.md`, punto 2.8): quien pida no recibir más mensajes, no se le
manda más.

## E. Después del lanzamiento (primera semana)

| Qué | Cada cuánto | Responsable |
|---|---|---|
| Integraciones → Dragon Fish: "Agente funcionando" y pocas ventas esperando | Todos los días al abrir | Caja |
| Clientas nuevas registradas (Mis clientes) | Cada 2–3 días | Genaro |
| Canjes con error de cupón (Canjes, en rojo) | Cada 2–3 días | Genaro |
| Mails: Resend → Emails, que no haya rebotes masivos | Semanal | Genaro |
