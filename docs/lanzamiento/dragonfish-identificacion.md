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
  - busca la cuenta por **email**, después por **celular** (cualquier
    formato) y después por **DNI** (también el que va dentro del CUIT/CUIL);
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
- **Reporte de solo lectura**: `scripts/revisar-dragonfish-cuenta-posterior.mjs`
  lista las ventas ya acreditadas a cuentas creadas después de la compra
  (fecha de venta, de registro, puntos, email oculto). No cambia nada.
- Migración `20261111120000_dragonfish_identificacion`: cinco columnas nuevas
  vacías en `FacturaPendiente`; no modifica datos existentes (comprobado con
  una huella de todas las tablas).

## Pendiente (con autorización)

1. Deploy (aplica la migración).
2. **Actualizar el agente en la PC del local**: copiar `index.js` e
   `identificacion.js` nuevos a la carpeta del agente (ver
   `dragonfish-agente/README.md`, "Actualizar el agente") y reiniciarlo.
3. En el panel, **"Volver a revisar"**: las ventas de noviembre que quedaron
   "sin datos" por el celular en `Movil` se acreditan solas si la cuenta ya
   existía.
4. Las que sigan sin identificar: completar la ficha o asignarlas a mano.
5. **Compras de octubre acreditadas a cuentas de noviembre**: correr el
   reporte (solo lectura) y decidir si se dejan o se descuentan. No se tocó
   ningún saldo.

## Pruebas

- `pruebas/e2e/dragonfish-identificacion.mjs` (24 comprobaciones): email con
  mayúsculas, `Movil` con otro formato, DNI, CUIT, agente viejo, reporte
  repetido, cuenta posterior, solo nombre, sin cuenta, multiempresa,
  permisos, asignación (otro negocio, cuenta posterior, dos veces), volver a
  revisar (ventana de 60 días) y la pantalla.
- `lib/dragonfishIdentificacion.test.js`: DNI desde CUIT, celulares, monto,
  nombre, cuenta posterior y qué junta el agente de la ficha.
- No probado contra el Dragon Fish real: los nombres de campo salen del
  swagger del propio Dragon Fish de Peperina (`/Cliente/{id}/`).
