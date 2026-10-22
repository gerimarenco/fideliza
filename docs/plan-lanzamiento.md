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
| L-01 | Emails con mayúsculas: clientas que no sumaban puntos (Tiendanube, Dragon Fish), login con Google rechazado, cuentas duplicadas | Claude | Probado automáticamente | — | Registro guarda en minúsculas; login, Google, Tiendanube, Dragon Fish y "Olvidé mi contraseña" buscan sin distinguir mayúsculas. E2E: cuenta vieja "Maria.Gomez@Gmail.com" entra con "maria.gomez@gmail.com" y acredita por Dragon Fish; duplicado en otras mayúsculas → 409. **Falta**: mergear y confirmar en producción. |
| L-02 | El `iniciar-agente.bat` de la PC de Peperina no es el del repositorio (487 bytes vs. el del repo; mostraba `npm install/start` en pantalla y nunca escribía `agente.log`) | Claude + Genaro | Probado automáticamente · Pendiente de intervención manual | — | Lanzador nuevo (chequea Node y `.env`, rota el log, reintenta), `verificar-agente.bat`, guía corregida. Agente probado con Dragon Fish simulado. **Falta**: Genaro copia los archivos nuevos a la PC (ver `dragonfish-agente/README.md`, "Actualizar el agente"). |
| L-03 | Confirmar arranque automático del agente al prender la PC | Genaro | Pendiente de intervención manual | L-02 | Procedimiento en `dragonfish-agente/README.md`, "Comprobar el arranque después de reiniciar la PC". |
| L-04 | Saber si el agente está funcionando (sin confundirlo con "no hubo ventas") | Claude | Probado automáticamente | — | Integraciones → Dragon Fish muestra "Agente funcionando — último contacto hace X" y cuántas ventas esperan. Verificado en navegador local. |
| L-05 | Una factura que Dragon Fish no encuentra trababa la cola para siempre (el agente pedía siempre las mismas 20) | Claude | Probado automáticamente | — | Pendientes se reparten por intentos; el agente marca "sin datos" las facturas que Dragon Fish no encuentra (404). E2E con factura inexistente. |
| L-06 | Configuración de Peperina: $100 = 1 punto, vencimiento 12 meses, cumpleaños 500 puntos | Genaro | Pendiente de decisión | — | Claude no tiene acceso a producción: no puede leer los valores actuales. Los textos que ve la clienta (club, "Cómo funcionan los puntos", mails) ya salen de esos campos, no están escritos a mano. **Falta**: Genaro confirma valores y revisa Ajustes de Peperina. |
| L-07 | Contacto de soporte por negocio (antes: casilla inexistente fija para todos) | Claude + Genaro | Probado automáticamente · Pendiente de decisión | — | Ajustes → "Contacto de soporte" (email y/o WhatsApp). Si no hay nada cargado, la opción no aparece. **Falta**: Genaro decide qué contacto cargar. |
| L-08 | Cupones de Tiendanube (3 tipos): tests de escenarios y errores; prueba real | Claude + Genaro | Probado automáticamente · Pendiente de intervención manual | — | Tests con `fetch` simulado de los tres tipos y sus errores. Bug corregido: un descuento fijo sin compra mínima (o con mínimo igual al descuento) podía dejar una compra en $0; ahora la compra mínima es obligatoria y mayor que el descuento. **Falta**: prueba real autorizada (ver `docs/lanzamiento/checklist-lanzamiento.md`) — en particular, si Tiendanube compara la compra mínima antes o después de otras promociones y si cuenta el envío. |
| L-09 | Cuentas creadas solas por Dragon Fish antes del 2026-09-22 | Claude + Genaro | Pendiente de intervención manual | Acceso a la base | Consulta de solo lectura en `docs/lanzamiento/cuentas-automaticas.sql`. No se borra nada sin aprobación. |
| L-10 | Privacidad y datos personales (Ley 25.326) | Claude + Genaro | Pendiente de intervención manual | Revisión legal | Relevamiento, plan y borradores en `docs/lanzamiento/privacidad.md`. Hallazgos: el registro no informa nada sobre el uso de los datos; DNI y género se piden obligatorios y no se usan para nada. **Falta**: revisión profesional; después Claude implementa aviso, política por negocio y "Mis datos". |
| L-14 | DNI y género: dejar de pedirlos, volverlos opcionales o justificar su uso | Genaro | Pendiente de decisión | — | Ver `privacidad.md`, 3.1. |
| L-11 | Copias de seguridad de la base | Genaro | Pendiente de diagnóstico | Saber el proveedor de PostgreSQL | Procedimiento en `docs/lanzamiento/backups.md`: cómo identificar el proveedor, copia propia con `pg_dump` y restauración de prueba en una base aparte. |
| L-12 | "Olvidé mi contraseña" sin límite: se podía agotar el cupo diario de mails (100/día) y dejar a todas sin sus mails de puntos | Claude | Probado automáticamente | — | Máx. 1 mail cada 2 min y 5 por hora por cuenta; el link no se puede usar dos veces ni en simultáneo; al cambiar la contraseña se anulan los demás links. E2E + prueba de concurrencia. |
| L-13 | Emails completos de clientas en los logs de Netlify | Claude | Implementado | — | Ahora se registran enmascarados (`ma***@gmail.com`). |

## P1 — Fiabilidad y operación

| ID | Tarea | Resp. | Estado | Depende de | Evidencia / pendiente |
|---|---|---|---|---|---|
| L-20 | Aviso por mail si el agente deja de reportar | Claude | Pendiente de decisión | L-04 | Falta definir destinatario(s) y cuántas horas sin contacto son alarma (la PC se apaga de noche: no tiene que avisar todas las noches). |
| L-21 | Tareas diarias (cumpleaños, vencimiento): una clienta con error ya no corta a las demás; cumpleaños no se duplica aunque corra dos veces a la vez | Claude | Probado automáticamente | — | Prueba con dos corridas simultáneas: +500 una sola vez. |
| L-22 | Mails con links relativos si faltaba una variable; mail de cumpleaños sin los colores del negocio | Claude | Implementado | — | Links siempre absolutos (`https://retornar.com.ar` por defecto). |
| L-23 | Programa de referidos | Genaro | Pendiente de decisión | — | Lógica revisada: se paga una sola vez, en la primera compra, dentro de la misma transacción. Activarlo depende de Genaro (monto). |
| L-24 | Seguridad: sin límite de intentos de login; webhook de Dragon Fish sin firma; sesiones siguen abiertas después de cambiar la contraseña | Claude | Pendiente de decisión | — | Propuestas en el informe del hito; ninguna rompe nada hoy. |
| L-25 | Prueba integral de punta a punta | Claude + Genaro | Pendiente de intervención manual | PR #114 mergeado | `docs/lanzamiento/checklist-lanzamiento.md`, secciones B y C (separa lo ya probado automáticamente de lo que requiere una operación real). |
| L-26 | Si el cupón de Tiendanube falla al canjear, no había forma de reintentarlo desde el panel | Claude | Probado automáticamente | — | Botón "Reintentar cupón" en Canjes; no descuenta puntos de nuevo y nunca crea dos cupones (código fijo por canje). E2E local: error mostrado, reintento sin descuento extra, sin sesión → 403. |
| L-28 | Los cupones de premios no vencen nunca | Genaro | Pendiente de decisión | — | Tiendanube permite fecha de vencimiento por cupón. ¿Querés que venzan (ej. 60 días después del canje)? |
| L-27 | Una compra anulada/devuelta en Tiendanube o Dragon Fish no descuenta los puntos | Genaro | Pendiente de decisión | — | Regla de negocio: ¿se descuentan? |

## Diseño

| ID | Tarea | Resp. | Estado | Evidencia / pendiente |
|---|---|---|---|---|
| D-01 | Tres propuestas visuales aisladas (admin, negocio, clienta, celular) | Claude | Pendiente de decisión | Hechas como prototipo aparte (artifact privado con datos ficticios), sin tocar la app real. Falta que Genaro elija una dirección. |
| D-02 | Aplicar la dirección elegida | Claude | Bloqueado | Depende de la elección de Genaro. |

## Documentos de lanzamiento

- `docs/lanzamiento/checklist-lanzamiento.md` — checklist con responsables y evidencia, prueba integral, prueba real de cupones, borradores de comunicación.
- `docs/lanzamiento/capacitacion-vendedoras.md` — hoja para la caja.
- `docs/lanzamiento/privacidad.md` — plan de cumplimiento y borradores (para revisión legal).
- `docs/lanzamiento/backups.md` — copias de seguridad y restauración de prueba.
- `docs/lanzamiento/cuentas-automaticas.sql` — consulta de solo lectura.
- `docs/lanzamiento/estimacion-y-segunda-etapa.md` — horas, esperas y plan para un segundo comercio.
