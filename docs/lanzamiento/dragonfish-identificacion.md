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
  Desde este cambio se usa la fecha de la venta (`lib/dragonfishFecha.js`,
  `fechaDeVenta`; si Dragon Fish no mandó una fecha legible, `createdAt`).
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
- Sin migración: `fuera_de_periodo` es un valor más de `resultado` (texto).
- Pruebas: `lib/dragonfishFecha.test.js` (límites 04/11 23:59:59 / 05/11
  00:00:00, hora de Argentina, otros negocios) y
  `pruebas/e2e/dragonfish-recuperacion.mjs`.

### Consulta de solo lectura: cuántas ventas de Peperina entran

En el SQL Editor de Neon, rama `Production`. Funciona antes y después del
deploy (usa solo columnas que ya existen desde 2026-08-30).

```sql
-- 1) La base de Dragon Fish de cada negocio: tiene que figurar PEPERINA
SELECT nombre, "dragonfishBaseDeDatos" FROM "Negocio" WHERE "dragonfishBaseDeDatos" IS NOT NULL ORDER BY nombre;

-- 2) Ventas de Club Peperina por período (fecha de la venta en Dragon Fish) y resultado
WITH v AS (
  SELECT f.resultado, f.procesado,
         CASE WHEN f.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(f.fecha, 'DD/MM/YYYY') END AS dia_venta
  FROM "FacturaPendiente" f
  JOIN "Negocio" n ON n.id = f."negocioId"
  WHERE upper(btrim(n."dragonfishBaseDeDatos")) = 'PEPERINA'
)
SELECT CASE WHEN dia_venta IS NULL THEN 'sin fecha legible'
            WHEN dia_venta >= DATE '2026-11-05' THEN 'desde el 05/11'
            ELSE 'antes del 05/11' END AS periodo,
       CASE WHEN NOT procesado THEN 'pendiente (sin procesar)' ELSE resultado END AS resultado,
       count(*) AS ventas
FROM v GROUP BY 1, 2 ORDER BY 1, 2;

-- 3) ¿La fecha de Dragon Fish coincide con el día en que llegó el aviso (hora de Argentina)?
SELECT count(*) AS total,
       count(*) FILTER (WHERE NOT (f.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$')) AS sin_fecha_legible,
       count(*) FILTER (WHERE f.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$'
         AND to_date(f.fecha, 'DD/MM/YYYY') = (f."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS mismo_dia,
       count(*) FILTER (WHERE f.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$'
         AND to_date(f.fecha, 'DD/MM/YYYY') <> (f."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS distinto_dia
FROM "FacturaPendiente" f
JOIN "Negocio" n ON n.id = f."negocioId"
WHERE upper(btrim(n."dragonfishBaseDeDatos")) = 'PEPERINA';
```

Lo que "Volver a revisar" va a poner en la fila son las filas `desde el 05/11`
con resultado `sin_cliente` o `sin_datos` (y `ambigua`, que solo existe
después del deploy). Las `acreditado` no se tocan.

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
