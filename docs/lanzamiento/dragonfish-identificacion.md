# Ventas del local: reconocer a la clienta y ventas sin identificar (2026-11-11)

## Qué pasó

El 2026-11-10 se puso en marcha el agente de Dragon Fish en la PC del local.
Hasta ese día nunca había funcionado: la tarea programada arrancaba una
copia vieja sin el archivo `.env`, así que se cerraba al instante
(resultado `0x1`). Al arrancar, procesó todas las ventas que estaban en la
fila desde agosto, y aparecieron dos problemas:

1. **Se acreditaron compras de octubre a clientas que se registraron en
   noviembre.** El servidor buscaba la cuenta y sumaba, sin mirar si la
   compra era de antes del registro. Con el agente andando eso casi no pasa
   (cada venta se procesa a los segundos), pero con ventas acumuladas sí.
2. **Muchas clientas registradas que compraron no sumaron.** La ficha de
   Dragon Fish tiene el celular en el campo `Movil`, y el agente solo leía
   `Telefono` (el fijo) y `EMail`. Una ficha con celular pero sin email
   quedaba "sin datos". Tampoco se usaba el DNI (`NroDocumento`).

## Qué se cambió

- **Agente** (`dragonfish-agente/identificacion.js`): consulta siempre la
  ficha del cliente de la factura y manda email, `Movil`, `Telefono`,
  `NroDocumento`, `CUIT` y el nombre. Sigue sin escribir nada en Dragon Fish.
- **Retornar** (`lib/dragonfishIdentificacion.js`, `app/api/dragonfish/resolver`):
  - primero, si la ficha está **vinculada** a una cuenta, esa cuenta;
  - si no, mira **email**, **celular** (cualquier formato) y **DNI** (también
    el que va dentro del CUIT/CUIL). **Solo acredita sola si todos esos datos
    señalan a una única cuenta.** Si señalan a más de una (un celular
    compartido por dos cuentas, o el email de una y el celular de otra), la
    venta queda **"ambigua"** y aparece en el panel con esas cuentas
    sugeridas, para que una persona elija;
  - **una compra de antes de que existiera la cuenta no suma** (queda
    "cuenta_posterior"), aunque se procese tarde;
  - por nombre nunca acredita solo (puede haber dos personas con el mismo);
  - guarda el monto, el nombre de la ficha, a quién se acreditó y por qué
    dato (columnas nuevas en `FacturaPendiente`).
  - Un agente viejo (solo email/teléfono) sigue funcionando igual.
- **Panel → Integraciones → "Ventas del local sin identificar"**: las
  ventas de los últimos 90 días que no se reconocieron, con fecha, monto,
  puntos y nombre de la ficha.
  - **"Volver a revisar (últimos 60 días)"**: vuelven a la fila y el agente
    las procesa otra vez con los datos actuales de las fichas (sirve después
    de actualizar el agente o completar fichas). Las compras anteriores al
    registro siguen sin sumar.
  - **Asignar a mano**: elegir la clienta (arriba aparecen las parecidas por
    nombre) y "Sumar puntos". Suma una sola vez (misma clave que el agente),
    nunca a una cuenta de otro negocio ni creada después de la compra, y le
    manda el mail de puntos.
- **Vincular la ficha (fichas sin email, celular ni DNI)** (2026-11-12): muchas
  fichas de Dragon Fish solo tienen nombre. Al asignar a mano una venta de esas,
  la casilla **"Recordar esta ficha para esta clienta"** (tildada por defecto)
  guarda el vínculo ficha de Dragon Fish → cuenta de Retornar
  (`FichaDragonfish`). Desde ahí:
  - **cada compra de esa ficha suma sola** (el agente manda el código de la
    ficha, `codigoFicha`), aunque la ficha siga sin datos;
  - se suman también **las otras ventas sin identificar de esa ficha**, desde
    que existe la cuenta (las de antes del registro siguen sin sumar).

  Así se hace **una vez por clienta**, no una vez por compra. No se escribe
  nada en Dragon Fish. Una ficha genérica ("Consumidor final", "Mostrador",
  sin código) nunca se vincula: solo se asigna esa venta. Una ficha ya
  vinculada a otra clienta no se vuelve a vincular (hay que desvincularla
  primero), y la lista **"Fichas de Dragon Fish vinculadas"** permite
  desvincular una puesta por error (los puntos ya sumados no cambian).
- Migraciones `20261111120000_dragonfish_identificacion` y
  `20261112120000_fichas_dragonfish`: columnas nuevas vacías en
  `FacturaPendiente` y la tabla nueva `FichaDragonfish`; no modifican datos
  existentes (comprobado con una huella de todas las tablas).
- Si un reporte trae menos datos que uno anterior (por ejemplo, un agente
  viejo al "Volver a revisar"), se conservan el monto, el nombre y el código
  de ficha ya guardados.

## Fecha de la venta y recuperación de Peperina desde el 05/11/2026 (2026-11-11)

- **Qué fecha es cuál.** Dragon Fish manda en el aviso (webhook) `Fecha`
  (`DD/MM/AAAA`) y `Hora` (`HH:MM:SS`), en hora de Argentina; se guardan tal
  cual, como texto, en `FacturaPendiente.fecha` y `.hora`. Esa es la fecha de
  la venta. `FacturaPendiente.createdAt` es cuándo llegó el aviso a Retornar
  (segundos después de facturar). Hasta ahora todo usaba `createdAt`: la regla
  "cuenta posterior", los 60 días de "Volver a revisar" y los 90 de la lista.
  Desde este cambio se usa la fecha de la venta (`lib/dragonfishFecha.js`).
- **Fecha verificable** (`fechaVerificada`): `fecha` legible y existente,
  `hora` vacía o legible, y no más de un día posterior a la llegada del aviso.
  Si no, no hay fecha verificable.
  - **En la recuperación de un negocio con día de inicio** (lista, "Volver a
    revisar", asignar a mano, vincular ficha), una venta sin fecha verificable
    **queda afuera**: no se usa `createdAt` para decidir si entra.
  - **Cuando el agente reporta una venta** (`controlDeFecha`), vieja o nueva:
    sin fecha verificable queda **`sin_fecha`**, para revisión. No suma, no
    se busca a la clienta y no se manda mail, aunque el aviso haya llegado
    recién: un aviso reciente no prueba que la compra lo sea (puede ser una
    venta vieja reenviada o recibida tarde). No vuelve a la fila con "Volver a
    revisar" ni se puede asignar a mano; el panel muestra cuántas hay ("N
    ventas llegaron sin una fecha de Dragon Fish que se pueda verificar").
    Con fecha anterior al día de inicio, `fuera_de_periodo`.
  - **En los flujos sin límite** (regla de cuenta posterior, negocios sin día
    de inicio) se sigue usando `createdAt` si no hay fecha verificable, como
    antes.
- **Club Peperina: solo desde el 05/11/2026.** `INICIO_VENTAS_LOCAL` en
  `lib/dragonfishFecha.js` fija, por el nombre de la base de Dragon Fish
  (`Negocio.dragonfishBaseDeDatos` = `PEPERINA`), el día desde el que suman las
  ventas del local: 05/11/2026 00:00 de Argentina, inclusive. Una venta
  anterior:
  - no aparece en "Ventas del local sin identificar" y "Volver a revisar" no
    la vuelve a la fila (el botón dice "desde el 05/11/2026");
  - no se puede asignar a mano (409) ni suma al vincular su ficha;
  - si el agente la reporta (por ejemplo, una que nunca se procesó), queda
    `fuera_de_periodo` y no suma.
- **No afecta a nadie más.** Las compras nuevas de Peperina son siempre
  posteriores al 05/11 y suman normalmente; un negocio que no figura en
  `INICIO_VENTAS_LOCAL` no tiene límite (se comporta como antes, con la fecha
  de la venta en vez de la del aviso). Las acreditaciones ya hechas (incluidas
  las de octubre del 10/11) no se tocan.
- Sin migración: `fuera_de_periodo` y `sin_fecha` son valores más de
  `resultado` (texto).
- Pruebas: `lib/dragonfishFecha.test.js` (límites 04/11 23:59:59 / 05/11
  00:00:00, hora de Argentina, otros negocios) y
  `pruebas/e2e/dragonfish-recuperacion.mjs`.

### Hora de Dragon Fish en formato de 12 horas (2026-11-13)

Dragon Fish manda `Hora` en formato de 12 horas **sin AM/PM**: una venta de
las 19:56 llega como `"07:56:19"`. Se vio en producción con 4 clientas que se
registraron a las 19:53, 17:21, 19:44 y 18:24, cuyas compras (3 minutos
después) quedaron `cuenta_posterior` porque se leían a la mañana. Coincide con
la consulta 3: 319 de 785 avisos a menos de 15 minutos de la venta (las de la
mañana) y la mayor demora, de exactamente 12 horas (las de la tarde).

- `fechaVerificada`: si la hora es menor a 12 y la misma hora + 12 queda
  pegada a la llegada del aviso (como mucho 10 minutos después y 1 hora
  antes), es de la tarde. Un aviso que llega horas tarde no se corre.
- "Volver a revisar" ahora también vuelve a la fila las `cuenta_posterior`
  (dentro del mismo período): el agente las recalcula; las que de verdad son
  anteriores al registro siguen sin sumar, y ninguna suma dos veces. Sin
  migración ni cambios en el agente.

### Consulta de solo lectura: cuántas ventas de Peperina entran

En el SQL Editor de Neon, rama `Production`. Solo lectura (`SELECT`). Funciona
antes y después del deploy: usa solo columnas que existen desde 2026-08-30.
No devuelve datos de clientas, solo conteos. Las fechas se leen sin `to_date`
para que una fecha imposible (31/11) cuente como "sin fecha verificable" en
vez de cortar la consulta, con el mismo criterio que el código.

**Cómo está guardado `createdAt`** (verificado 2026-11-12): la columna es
`timestamp(3) without time zone` con `DEFAULT CURRENT_TIMESTAMP`
(migración `20260830194640_add_dragonfish_agente`), pero la app no usa ese
DEFAULT: el único que crea filas es el webhook
(`app/api/webhooks/dragonfish`), con Prisma, que manda `createdAt` explícito
en el INSERT, calculado en UTC. Probado en una base local: con la sesión en
UTC o en `America/Argentina/Buenos_Aires`, Prisma guarda la hora UTC (el
DEFAULT, en cambio, guardaría la hora de la sesión). Por eso las consultas
convierten con `("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE
'America/Argentina/Buenos_Aires'`, que da lo mismo con cualquier zona de la
sesión. La consulta 3 lo comprueba con los datos reales (las dos últimas
columnas). Probadas con casos alrededor de la medianoche (04/11 23:59:59,
05/11 00:00:00, 05/11 21:30 que en UTC ya es 06/11, reloj adelantado, sin
fecha, 31/11): mismo resultado que el código y con la sesión en UTC o en
Argentina.

```sql
-- 1) Negocio con base de Dragon Fish PEPERINA (tiene que devolver exactamente 1 fila)
SELECT n.nombre,
       n."dragonfishBaseDeDatos",
       (SELECT count(*) FROM "FacturaPendiente" f WHERE f."negocioId" = n.id) AS ventas_registradas
FROM "Negocio" n
WHERE upper(btrim(n."dragonfishBaseDeDatos")) = 'PEPERINA';

-- 2) Ventas de Club Peperina por período (fecha real de Dragon Fish, verificable) y resultado.
--    createdAt guarda la hora UTC (Prisma la manda explícita en UTC; no se usa el DEFAULT de la base):
--    se convierte a hora de Argentina con AT TIME ZONE 'UTC' y después 'America/Argentina/Buenos_Aires',
--    que no depende de la zona horaria de la sesión.
WITH v AS (
  SELECT f.resultado, f.procesado,
         (f."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS llegada,
         btrim(f.hora) AS hora,
         CASE WHEN btrim(f.fecha) ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN string_to_array(btrim(f.fecha), '/')::int[] END AS dma
  FROM "FacturaPendiente" f
  JOIN "Negocio" n ON n.id = f."negocioId"
  WHERE upper(btrim(n."dragonfishBaseDeDatos")) = 'PEPERINA'
), w AS (
  SELECT resultado, procesado, llegada,
         CASE WHEN dma IS NULL OR dma[3] < 1 OR dma[2] NOT BETWEEN 1 AND 12 OR dma[1] < 1 THEN NULL
              WHEN dma[1] > extract(day FROM make_date(dma[3], dma[2], 1) + interval '1 month - 1 day') THEN NULL
              WHEN hora <> '' AND hora !~ '^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' THEN NULL
              ELSE make_date(dma[3], dma[2], dma[1]) + CASE WHEN hora = '' THEN time '00:00' ELSE hora::time END
         END AS venta
  FROM v
)
SELECT CASE WHEN venta IS NULL OR venta > llegada + interval '1 day' THEN 'sin fecha verificable (no entra)'
            WHEN venta >= timestamp '2026-11-05 00:00:00' THEN 'desde el 05/11 (entra)'
            ELSE 'antes del 05/11 (no entra)' END AS periodo,
       CASE WHEN NOT procesado THEN 'pendiente (sin procesar)' ELSE resultado END AS resultado,
       count(*) AS ventas
FROM w GROUP BY 1, 2 ORDER BY 1, 2;

-- 3) ¿La fecha real de Dragon Fish coincide con el día en que llegó el aviso (hora de Argentina)?
--    Las dos últimas columnas comprueban con los datos cómo está guardado createdAt: cuántos avisos
--    llegaron dentro de los 15 minutos de la venta leyendo createdAt como UTC, y cuántos si fuera
--    hora de Argentina. Si createdAt es UTC (lo esperado), la primera es alta y la segunda casi 0.
WITH v AS (
  SELECT (f."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS llegada,
         f."createdAt" AS creado_sin_convertir,
         btrim(f.hora) AS hora,
         CASE WHEN btrim(f.fecha) ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN string_to_array(btrim(f.fecha), '/')::int[] END AS dma
  FROM "FacturaPendiente" f
  JOIN "Negocio" n ON n.id = f."negocioId"
  WHERE upper(btrim(n."dragonfishBaseDeDatos")) = 'PEPERINA'
), w AS (
  SELECT llegada, creado_sin_convertir,
         CASE WHEN dma IS NULL OR dma[3] < 1 OR dma[2] NOT BETWEEN 1 AND 12 OR dma[1] < 1 THEN NULL
              WHEN dma[1] > extract(day FROM make_date(dma[3], dma[2], 1) + interval '1 month - 1 day') THEN NULL
              WHEN hora <> '' AND hora !~ '^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$' THEN NULL
              ELSE make_date(dma[3], dma[2], dma[1]) + CASE WHEN hora = '' THEN time '00:00' ELSE hora::time END
         END AS venta
  FROM v
), x AS (
  SELECT llegada, creado_sin_convertir, CASE WHEN venta <= llegada + interval '1 day' THEN venta END AS venta FROM w
)
SELECT count(*) AS total,
       count(*) FILTER (WHERE venta IS NULL) AS sin_fecha_verificable,
       count(*) FILTER (WHERE venta::date = llegada::date) AS mismo_dia,
       count(*) FILTER (WHERE venta::date <> llegada::date) AS distinto_dia,
       count(*) FILTER (WHERE venta > llegada) AS venta_despues_del_aviso,
       max(llegada - venta) AS mayor_demora_del_aviso,
       count(*) FILTER (WHERE abs(extract(epoch FROM llegada - venta)) <= 900) AS aviso_15min_si_createdat_utc,
       count(*) FILTER (WHERE abs(extract(epoch FROM creado_sin_convertir - venta)) <= 900) AS aviso_15min_si_createdat_hora_arg
FROM x;
```

Lo que "Volver a revisar" va a poner en la fila son las filas `desde el 05/11
(entra)` con resultado `sin_cliente` o `sin_datos` (y `ambigua`, que solo
existe después del deploy). Las `acreditado` no se tocan. Las `sin fecha
verificable (no entra)` quedan afuera de la recuperación, igual que en el
código.

## Pendiente (con autorización)

1. Deploy (aplica la migración).
2. **Actualizar el agente en la PC del local**: copiar `index.js` e
   `identificacion.js` nuevos a la carpeta del agente (ver
   `dragonfish-agente/README.md`, "Actualizar el agente") y reiniciarlo.
3. En el panel, **"Volver a revisar (desde el 05/11/2026)"**: las ventas del
   05/11 en adelante que quedaron "sin datos" por el celular en `Movil` se
   acreditan solas si la cuenta ya existía. Las anteriores al 05/11 no.
4. Las que sigan sin identificar: asignarlas a mano con "Recordar esta ficha"
   tildado (una vez por clienta; después suman solas).

**Fuera de alcance**: las acreditaciones ya hechas (incluidas las compras de
octubre acreditadas el 2026-11-10) quedan como están; no se corrigen ni se
revierten, y no se modifica ningún saldo ni movimiento histórico.

## Pruebas

- `pruebas/e2e/dragonfish-identificacion.mjs` (con la vinculación de fichas y las coincidencias ambiguas): email con
  mayúsculas, `Movil` con otro formato, DNI, CUIT, agente viejo, reporte
  repetido, cuenta posterior, solo nombre, sin cuenta, multiempresa,
  permisos, asignación (otro negocio, cuenta posterior, dos veces), volver a
  revisar (ventana de 60 días) y la pantalla.
- `lib/dragonfishIdentificacion.test.js`: DNI desde CUIT, celulares, monto,
  nombre, cuenta posterior y qué junta el agente de la ficha.
- No probado contra el Dragon Fish real: los nombres de campo salen del
  swagger del propio Dragon Fish de Peperina (`/Cliente/{id}/`).
