# Plan de lanzamiento de Retornar en Peperina

Seguimiento de todo lo que falta para lanzar Retornar en Peperina. Se
actualiza al cerrar cada hito. El detalle técnico de cada cambio sigue en
`docs/tareas-futuras.md`.

**Estados** (no se mezclan):
Pendiente de diagnóstico · Pendiente de decisión · Pendiente de
intervención manual · Implementado · Probado automáticamente · Verificado
manualmente en prueba · Verificado en producción · Bloqueado.

"Probado automáticamente" = pasó tests y/o pruebas de punta a punta contra
una base local descartable con datos ficticios (nunca producción).

**Responsable**: Claude (código) o Genaro (decisiones, accesos, PC del local,
pruebas reales).

## P0 — Imprescindible para lanzar

| ID | Tarea | Resp. | Estado | Depende de | Evidencia / pendiente |
|---|---|---|---|---|---|
| L-01 | Emails con mayúsculas: clientas que no sumaban puntos (Tiendanube, Dragon Fish), login con Google rechazado, cuentas duplicadas | Claude | Probado automáticamente | — | Registro guarda en minúsculas; login, Google, Tiendanube, Dragon Fish y "Olvidé mi contraseña" buscan sin distinguir mayúsculas. E2E: cuenta vieja "Maria.Gomez@Gmail.com" entra con "maria.gomez@gmail.com" y acredita por Dragon Fish; duplicado en otras mayúsculas → 409. Mergeado (PR #114). **Falta**: confirmarlo con la cuenta de prueba en producción (`lanzamiento/visita-al-local.md`, 2.1). |
| L-02 | El `iniciar-agente.bat` de la PC de Peperina no es el del repositorio (487 bytes vs. el del repo; mostraba `npm install/start` en pantalla y nunca escribía `agente.log`) | Claude + Genaro | Probado automáticamente · Pendiente de intervención manual | — | Lanzador nuevo (chequea Node y `.env`, rota el log, reintenta), `verificar-agente.bat`, guía corregida. Agente probado con Dragon Fish simulado. **Falta**: Genaro copia los archivos nuevos a la PC (ver `dragonfish-agente/README.md`, "Actualizar el agente"). |
| L-03 | Confirmar arranque automático del agente al prender la PC | Genaro | Pendiente de intervención manual | L-02 | Procedimiento en `dragonfish-agente/README.md`, "Comprobar el arranque después de reiniciar la PC". |
| L-04 | Saber si el agente está funcionando (sin confundirlo con "no hubo ventas") | Claude | Probado automáticamente | — | Integraciones → Dragon Fish muestra "Agente funcionando — último contacto hace X" y cuántas ventas esperan. Verificado en navegador local. |
| L-05 | Una factura que Dragon Fish no encuentra trababa la cola para siempre (el agente pedía siempre las mismas 20) | Claude | Probado automáticamente | — | Pendientes se reparten por intentos; el agente marca "sin datos" las facturas que Dragon Fish no encuentra (404). E2E con factura inexistente. |
| L-06 | Configuración de Peperina: $100 = 1 punto, vencimiento 12 meses, cumpleaños 500 puntos | Genaro | Pendiente de decisión | — | Claude no tiene acceso a producción: no puede leer los valores actuales. Los textos que ve la clienta (club, "Cómo funcionan los puntos", mails) ya salen de esos campos, no están escritos a mano. **Falta**: Genaro confirma valores y revisa Ajustes de Peperina. |
| L-07 | Contacto de soporte por negocio (antes: casilla inexistente fija para todos) | Claude + Genaro | Probado automáticamente · Pendiente de decisión | — | Ajustes → "Contacto de soporte" (email y/o WhatsApp). Si no hay nada cargado, la opción no aparece. **Falta**: Genaro decide qué contacto cargar. |
| L-08 | Cupones de Tiendanube (3 tipos): tests de escenarios y errores; prueba real | Claude + Genaro | Probado automáticamente · Pendiente de intervención manual | — | Tests con `fetch` simulado de los tres tipos y sus errores. Bug corregido: un descuento fijo sin compra mínima (o con mínimo igual al descuento) podía dejar una compra en $0; ahora la compra mínima es obligatoria y mayor que el descuento. **Falta**: prueba real autorizada (ver `docs/lanzamiento/checklist-lanzamiento.md`) — en particular, si Tiendanube compara la compra mínima antes o después de otras promociones y si cuenta el envío. |
| L-09 | Cuentas creadas solas por Dragon Fish antes del 2026-09-22 | Claude + Genaro | Pendiente de intervención manual | Acceso a la base | Consulta de solo lectura en `docs/lanzamiento/cuentas-automaticas.sql`. No se borra nada sin aprobación. |
| L-10 | Privacidad y datos personales (Ley 25.326) | Claude + Genaro | Pendiente de intervención manual | Revisión legal | Relevamiento, plan y borradores en `docs/lanzamiento/privacidad.md`. Hallazgos: el registro no informa nada sobre el uso de los datos; DNI y género se piden obligatorios y no se usan para nada. **Falta**: revisión profesional; después Claude implementa aviso, política por negocio y "Mis datos". |
| L-14 | DNI y género: dejar de pedirlos, volverlos opcionales o justificar su uso | Claude + Genaro | Probado automáticamente · Pendiente de decisión (DNI ya guardados) | — | Decisión de Genaro: el DNI se deja de pedir (registro, API y Excel); el género se mantiene para campañas futuras (hay que decir esa finalidad en el aviso de privacidad). Los DNI ya guardados siguen en la base hasta que Genaro autorice borrarlos (`privacidad.md`, 3.1). |
| L-11 | Copias de seguridad de la base | Genaro | Pendiente de diagnóstico | Saber el proveedor de PostgreSQL | Procedimiento en `docs/lanzamiento/backups.md`: cómo identificar el proveedor, copia propia con `pg_dump` y restauración de prueba en una base aparte. |
| L-12 | "Olvidé mi contraseña" sin límite: se podía agotar el cupo diario de mails (100/día) y dejar a todas sin sus mails de puntos | Claude | Probado automáticamente | — | Máx. 1 mail cada 2 min y 5 por hora por cuenta; el link no se puede usar dos veces ni en simultáneo; al cambiar la contraseña se anulan los demás links. E2E + prueba de concurrencia. |
| L-13 | Emails completos de clientas en los logs de Netlify | Claude | Implementado | — | Ahora se registran enmascarados (`ma***@gmail.com`). |
| L-29 | Una venta que no llega a 1 punto (cambio en $0, monto menor a $100) acreditaba 0 puntos, mandaba el mail "sumaste 0 puntos" y pagaba el bono de referidos | Claude | Probado automáticamente | — | Caja, tienda online, Mercado Pago y carga manual ya no acreditan ni mandan mail; en la caja queda como `sin_puntos`. E2E: venta de $50 y cambio en $0 → `sin_puntos` sin movimiento; carga manual de $50 → error claro. **Falta**: confirmarlo en la caja real (visita, 2.5). |
| L-30 | El webhook de Tiendanube acreditaba cualquier orden avisada como "pagada" sin confirmarlo | Claude | Probado automáticamente | — | Ahora solo acredita si la orden pedida a la API figura `payment_status: paid` y no está cancelada; si todavía no figura pagada responde 409 para que Tiendanube lo reenvíe (no se pierden puntos si la API tarda en actualizarse). E2E con la API de Tiendanube simulada: pagada, reintentos y 5 avisos simultáneos (una sola acreditación), pendiente que después se paga, cancelada, anulada, reintegrada, sin cuenta. No probado contra Tiendanube real: **falta** la compra de prueba (visita, 3). |
| L-31 | El Excel exportado podía ejecutar fórmulas escritas en el nombre de una clienta | Claude | Probado automáticamente | — | Celdas que empiezan con = + - @ van como texto; fechas dd/mm/aaaa sin depender del idioma del servidor. Tests + E2E. |
| L-32 | Inicio del negocio: "compraron este mes" mostraba el total de clientas; el mes se cortaba en hora UTC | Claude | Probado automáticamente | — | Cuenta clientas distintas con una compra real en el mes, en hora argentina. E2E: 5 de 7. |
| L-33 | Validaciones: canje sin premio daba error 500; el admin podía canjear un premio de otro negocio; emails sin forma de email; contraseña de negocio nuevo con `Math.random` y email duplicado en otras mayúsculas | Claude | Probado automáticamente | — | E2E de cada caso. |
| L-34 | Puntos de la tienda online calculados sobre el total **con envío** | Genaro | Pendiente de decisión | — | Hoy se usa el total de la orden. ¿Se calculan sin el envío (subtotal)? Cambio chico una vez decidido. |
| L-35 | Guía para la visita al local (agente, ventas reales, compra online, cupones, backup) | Claude + Genaro | Pendiente de intervención manual | Publicar el hito 3 | `lanzamiento/visita-al-local.md`. |

## P1 — Fiabilidad y operación

| ID | Tarea | Resp. | Estado | Depende de | Evidencia / pendiente |
|---|---|---|---|---|---|
| L-20 | Aviso por mail si el agente deja de reportar | Claude | Pendiente de decisión | L-04 | Falta definir destinatario(s) y cuántas horas sin contacto son alarma (la PC se apaga de noche: no tiene que avisar todas las noches). |
| L-21 | Tareas diarias (cumpleaños, vencimiento): una clienta con error ya no corta a las demás; cumpleaños no se duplica aunque corra dos veces a la vez | Claude | Probado automáticamente | — | Prueba con dos corridas simultáneas: +500 una sola vez. |
| L-22 | Mails con links relativos si faltaba una variable; mail de cumpleaños sin los colores del negocio | Claude | Implementado | — | Links siempre absolutos (`https://retornar.com.ar` por defecto). |
| L-23 | Programa de referidos | Genaro | Pendiente de decisión | — | Lógica revisada: se paga una sola vez, en la primera compra, dentro de la misma transacción. Activarlo depende de Genaro (monto). |
| L-24 | Seguridad: sin límite de intentos de login; webhook de Dragon Fish sin firma; sesiones siguen abiertas después de cambiar la contraseña | Claude | Probado automáticamente (login) · Pendiente de decisión (resto) | — | **Login**: máx. 10 contraseñas probadas por cuenta **y conexión** cada 15 minutos (así nadie puede bloquearle la cuenta a otra persona desde afuera) y 30 por conexión entre todas las cuentas; el intento se registra antes de probar la contraseña (no se elude con pedidos simultáneos); recuperar la contraseña desbloquea; se guardan HMAC de email e IP, nunca los datos. E2E: 30 intentos simultáneos → 10 probados; la dueña entra desde otra conexión. **Webhook de Dragon Fish**: sin firma, pero solo crea pendientes que el agente verifica contra Dragon Fish real, así que no permite inventar puntos (riesgo: llenar la cola). **Sesiones**: quedan para la segunda etapa (ver `privacidad.md`, 5.1). |
| L-25 | Prueba integral de punta a punta | Claude + Genaro | Pendiente de intervención manual | PR #114 mergeado | `docs/lanzamiento/checklist-lanzamiento.md`, secciones B y C (separa lo ya probado automáticamente de lo que requiere una operación real). |
| L-26 | Si el cupón de Tiendanube falla al canjear, no había forma de reintentarlo desde el panel | Claude | Probado automáticamente | — | Botón "Reintentar cupón" en Canjes; no descuenta puntos de nuevo y nunca crea dos cupones (código fijo por canje). E2E local: error mostrado, reintento sin descuento extra, sin sesión → 403. |
| L-28 | Los cupones de premios no vencen nunca | Genaro | Pendiente de decisión | — | Tiendanube permite fecha de vencimiento por cupón. ¿Querés que venzan (ej. 60 días después del canje)? |
| L-27 | Una compra anulada/devuelta en Tiendanube o Dragon Fish no descuenta los puntos | Genaro | Pendiente de decisión | — | Regla de negocio: ¿se descuentan? |
| L-36 | "Nuevo cliente": el negocio puede crear una cuenta a mano (la persona no pasó por el registro) | Genaro | Pendiente de decisión | — | No es automático, pero choca con "la clienta se registra sola" y con el aviso de privacidad. ¿Se mantiene, se saca, o se deja solo para el admin? |
| L-37 | "Cargar una compra" lista a todas las clientas en un desplegable | Claude | Pendiente de diagnóstico | — | Con cientos de clientas es incómodo y carga todos los datos en cada pantalla. Mejora propuesta: buscador. P2: las ventas normales llegan solas por la caja y la tienda. |

## Diseño

| ID | Tarea | Resp. | Estado | Evidencia / pendiente |
|---|---|---|---|---|
| D-01 | Tres propuestas visuales aisladas (admin, negocio, clienta, celular) | Claude | Implementado | Prototipos aparte con datos ficticios. Genaro eligió la 1 (Editorial) el 2026-10-23. |
| D-02 | Aplicar la dirección elegida | Claude | Probado automáticamente | Aplicada a admin, negocio, clienta, login, recuperación de contraseña, club público y registro (ver tareas-futuras.md, ítem 66). Falta: verificarla en el deploy preview con la cuenta real de Peperina (Genaro) y confirmar que le gusta el bloque de puntos con el rosa de la marca. |

## Documentos de lanzamiento

- `docs/lanzamiento/checklist-lanzamiento.md` — checklist con responsables y evidencia, prueba integral, prueba real de cupones, borradores de comunicación.
- `docs/lanzamiento/visita-al-local.md` — guion de la visita a Peperina: agente, ventas reales, compra online, cupones y backup.
- `docs/lanzamiento/capacitacion-vendedoras.md` — hoja para la caja.
- `docs/lanzamiento/privacidad.md` — plan de cumplimiento y borradores (para revisión legal).
- `docs/lanzamiento/backups.md` — copias de seguridad y restauración de prueba.
- `docs/lanzamiento/cuentas-automaticas.sql` — consulta de solo lectura.
- `docs/lanzamiento/estimacion-y-segunda-etapa.md` — horas, esperas y plan para un segundo comercio.
