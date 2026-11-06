# Compras de Tiendanube que no suman puntos (2026-11-10)

Caso: una clienta de Club Peperina con cuenta en Retornar compró en la tienda
online y no recibió los puntos. Este documento recorre el proceso completo,
las causas posibles, qué se cambió y cómo revisar y recuperar compras en
producción sin duplicar puntos.

> **Estado del incidente: abierto.** La causa **no está confirmada**: no hubo
> acceso a producción (base, logs de Netlify ni API de Tiendanube) desde el
> entorno de trabajo. Lo del webhook (sección 4, hipótesis 1) es una
> **hipótesis** deducida del código, no un hecho comprobado: sigue así hasta
> verificar la configuración real de Tiendanube (a qué dirección está
> suscripto `order/paid` en la tienda de Peperina y si la clave
> `TIENDANUBE_CLIENT_SECRET` de Netlify es la de la app). No se recuperaron
> puntos ni se cambió nada en producción: el próximo paso es el diagnóstico
> controlado (sección 5, paso 1, solo lectura).
>
> **Ninguna orden mencionada en este documento ni en las pruebas es real.**
> Las órdenes #1003, #1017 y el resto de los números que aparecen en las
> pruebas son datos ficticios de la simulación (ver sección 6).

Abajo están las hipótesis ordenadas y la evidencia exacta que las confirma o
descarta (sección 4).

## 1. Recorrido de una compra (antes de este cambio)

| # | Etapa | Dónde | Qué podía fallar | ¿Quedaba rastro? |
|---|---|---|---|---|
| 1 | La clienta paga; Tiendanube marca la orden `paid` y dispara `order/paid` | Tiendanube | Pago pendiente (transferencia, efectivo): el evento sale recién cuando la tienda lo marca pagado | — |
| 2 | Tiendanube manda un POST a la dirección suscripta | Tiendanube → Netlify | **Dirección vieja**: se registró el 2026-09-09 tomando la dirección del navegador al conectar (`app/api/tiendanube/callback`), no la del dominio. Si fue la de Netlify (`…netlify.app`), con el dominio propio como principal Netlify normalmente redirige a `retornar.com.ar`, y un webhook redirigido no cuenta como entregado. Suscripción ausente o borrada (por ejemplo, si se desinstaló la app) | No |
| 3 | Firma `x-linkedstore-hmac-sha256` con `TIENDANUBE_CLIENT_SECRET` | `app/api/webhooks/tiendanube` | Si la clave de Netlify no es la de la app dueña de la suscripción, **todo** aviso se rechaza con 401 | Solo un log de Netlify |
| 4 | Negocio por `store_id`; activo | idem | Tienda no conectada o negocio desactivado | Log |
| 5 | Pide la orden a la API con el token del negocio | idem | Token vencido/revocado (401), Tiendanube lento (sin límite de tiempo) → 500; Tiendanube reintenta hasta 18 veces en 48 h y después la pierde | Log |
| 6 | Pagada y no cancelada | `lib/tiendanube.js` | Reembolsada/anulada respondía 409 (se reintentaba en vano) | No |
| 7 | Cupones de canje usados → "utilizado" | `lib/sincronizarCupones.js` | Nunca frena la acreditación | — |
| 8 | **Clienta**: solo por `contact_email` (sin mayúsculas) | route | **Email del checkout distinto del de la cuenta** → "no registrada", **200 y sin ningún registro**: perdida para siempre. Cuenta vieja guardada con espacios. Sin búsqueda por celular | **No** |
| 9 | Puntos = `floor(total / puntosXPeso)` | `lib/puntos.js` | Compra menor a la equivalencia → 0 | No |
| 10 | Transacción: `WebhookEvento` (`<tienda>:<orden>`) + saldo + movimiento + referidos | route | Error de base → 500 y reintento (correcto) | Log |
| 11 | Mail "sumaste puntos" | `lib/email.js` | Si fallaba, respondía 500 (sin efecto: el reintento veía duplicado) | — |
| 12 | El panel de la clienta muestra `Cliente.puntos` | `app/page.js` | — | — |

La protección contra duplicados (paso 10) estaba bien: un reenvío choca con
la clave única y no suma de nuevo; no descarta compras legítimas (la clave
incluye tienda y orden).

## 2. Cambios recientes revisados

| PR | ¿En `main`? | ¿Toca la acreditación online? |
|---|---|---|
| #122 bienvenida, cupones, Dragon Fish | Sí | Agregó marcar cupones (dentro de un try, no frena) y no acreditar órdenes canceladas. Correcto |
| #123 DNI obligatorio | Sí | No toca el webhook ni la búsqueda por email |
| #124 clientes, origen, teléfonos | Sí (mergeado 2026-11-05) | No toca el webhook. Borrar cuentas "sin nombre" limpia referidos (no rompe el bono de referidos dentro de la transacción) |
| #125 cupones por producto | Sí | Solo canjes |
| #126 stock | Sí | Solo enlaces y canjes |

Ninguno cambió la identificación, el cálculo ni el registro de la compra. Qué
versión corre en producción se confirma en Netlify → Deploys (el último
publicado tiene que ser el commit de `main`); desde acá no se puede ver.

## 3. Qué se cambió

- **Una sola lógica** (`lib/acreditacionTiendanube.js`) para el webhook, la
  conciliación y la recuperación.
- **Identificación**: email de contacto **y** email de la cuenta de la tienda
  (`customer.email`), sin mayúsculas ni espacios (también en cuentas viejas
  guardadas con espacios); si no, **celular** (cualquier formato), solo si
  una única cuenta lo tiene.
- **Registro de cada orden** (tabla `OrdenTiendanube`): acreditada,
  sin_cliente (con motivo), cuenta_posterior, pendiente_pago, cancelada,
  reembolsada, sin_puntos, incompleta o error (con el motivo). Sin emails
  completos (`an***@gmail.com`).
- **Reintentos**: error leyendo la orden o de base → 500 (Tiendanube
  reintenta) y queda "error"; lectura de la orden con límite de 8 s;
  reembolsada/anulada → 200 (antes 409 para siempre); un mail que falla ya no
  convierte una acreditación correcta en 500.
- **Conciliación programada** (`netlify/functions/conciliar-tiendanube.mjs`,
  cada 20 minutos): pide a Tiendanube las órdenes pagadas recientes y procesa
  las que el webhook no acreditó, con la misma protección contra duplicados.
  Así una compra suma aunque el aviso no llegue (dirección vieja, firma,
  caída). **No acredita compras de antes de su primera corrida**: esa corrida
  solo guarda la fecha de inicio (`Negocio.tiendanubeConciliarDesde`). Retoma
  pendientes de pago, errores y "sin cuenta" (por si se corrige el email de la
  cuenta) durante 7 días.
- **Dirección del webhook**: al conectar Tiendanube se usa siempre la del
  dominio público (`NEXT_PUBLIC_BASE_URL` o `retornar.com.ar`), y si existe
  una suscripción de Retornar con otra dirección se corrige en vez de duplicarla.
- **Script de revisión** (`scripts/revisar-compras-tiendanube.mjs`):
  diagnóstico, simulación por defecto y, con autorización, recuperación
  idempotente y reparación del webhook (ver 5).

**Reglas que no cambiaron**: la equivalencia (`puntosXPeso`), los premios y
niveles; no se crean cuentas solas; una compra pagada **antes** de que
existiera la cuenta no suma (igual que Dragon Fish: "sus próximas compras
sí"); no se descuentan puntos por cancelaciones posteriores (eso sería una
regla nueva).

## 4. Hipótesis del caso y cómo confirmarlas

Todas se revisan con el script en modo simulación (sección 5), que no
cambia nada:

1. **El aviso no llega (dirección vieja o suscripción ausente)** — la más
   probable por el código, pero **sin verificar**: la suscripción se creó con
   la dirección del navegador, y no se sabe cuál era ni si sigue existiendo.
   Se confirma o descarta solo mirando la configuración real de la tienda.
   *Evidencia*: la sección 1 del script marca ✗ si la dirección no
   es `https://retornar.com.ar/api/webhooks/tiendanube`, y muestra la última
   compra online acreditada y cuántas por mes (si no hay ninguna desde
   mediados de septiembre, ninguna compra online sumó desde entonces).
2. **Firma rechazada** — *Evidencia*: en Netlify → Logs → Functions, buscar
   `firma HMAC inválida`. Si aparece con compras reales, la clave
   `TIENDANUBE_CLIENT_SECRET` de Netlify no es la de la app de Tiendanube
   (Partner Portal → la app → Client Secret). No se cambió nada de esto.
3. **Email distinto del de la cuenta** — *Evidencia*: la orden figura
   "sin_cliente (email_sin_cuenta)". Con el cambio, si el email de la cuenta
   de la tienda o el celular coinciden, ya suma.
4. **Token del negocio inválido** — *Evidencia*: el script no puede leer de
   Tiendanube (401/403) → volver a conectar la tienda en Ajustes.
5. **Pago todavía pendiente** (transferencia, efectivo) — la orden no figura
   entre las pagadas; suma cuando la tienda la marca pagada.
6. **Cuenta creada después de pagar** — figura "cuenta_posterior": por las
   reglas actuales no suma.

Para el caso puntual alcanza con el número de la orden: aparece en la lista
del script con su estado.

## 5. Revisar y recuperar en producción (con autorización)

Requiere el deploy de este cambio (aplica la migración: tabla nueva y una
columna vacía; no modifica datos existentes).

```bash
# 1. Simulación (no cambia nada): diagnóstico + lista de órdenes pagadas
DATABASE_URL=<producción> node scripts/revisar-compras-tiendanube.mjs --negocio=peperina --desde=2026-09-01

# 2. Si la dirección del aviso está mal: corregirla (cambia la configuración de la tienda)
DATABASE_URL=<producción> node scripts/revisar-compras-tiendanube.mjs --negocio=peperina --desde=2026-11-01 --reparar-webhook

# 3. Acreditar las que figuran "acreditaría" (idempotente; --enviar-mails opcional)
DATABASE_URL=<producción> node scripts/revisar-compras-tiendanube.mjs --negocio=peperina --desde=2026-09-01 --aplicar
```

- Usa la equivalencia vigente del negocio; los puntos recuperados vencen
  contando desde el día en que se acreditan.
- **Sin duplicados**: usa la misma clave que el webhook (`WebhookEvento`
  `<tienda>:<orden>`). Correrlo dos veces, o que llegue el aviso o la
  conciliación después, no vuelve a sumar (probado).
- Las "sin_cliente" no se acreditan solas: si se confirma que la clienta
  tenía cuenta con otro email, se corrige el email de su cuenta y se vuelve a
  correr el script (o lo toma la conciliación dentro de los 7 días).
- Los datos personales salen ocultos (`an***@gmail.com`) y sin teléfonos.

## 6. Pruebas

- `pruebas/e2e/acreditacion-tiendanube.mjs` (34 comprobaciones, Tiendanube y
  Resend simulados, webhook firmado): los 13 casos pedidos más cuenta
  posterior, multiempresa, conciliación y script.
- `lib/acreditacionTiendanube.test.js`: clasificación de órdenes, emails y
  celulares de la orden, reparación del webhook, paginación de órdenes.
- **Orden #1003 (y #1017): casos de prueba, no compras reales.** Son órdenes
  inventadas por la suite e2e (el número sale del id simulado menos 8000), con
  una clienta ficticia (`ana.compra@prueba.test`) en una base local de prueba,
  y la "API de Tiendanube" es la simulación de `pruebas/e2e/simulaciones/`.
  La #1003 es el caso "aviso rechazado por firma inválida": la prueba
  comprueba que el script la detecta y la recupera una sola vez. **No se
  comprobó ninguna orden en producción**; si Peperina tiene órdenes reales
  con esos números, no tienen relación con las pruebas.
- **No probado contra Tiendanube real** (no hay acceso): que pase la
  simulación no prueba la integración. Después del deploy: una compra real de
  prueba, y ver en `OrdenTiendanube` / el script que figure "acreditada".
