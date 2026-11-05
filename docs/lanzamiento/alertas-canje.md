# Alerta de canje para las empleadas (2026-11-08)

## Qué hace

En el panel del negocio, las clientas que ya pueden canjear el premio de la
alerta (en Peperina, el pañuelo, el primer premio) y todavía no fueron
contactadas aparecen marcadas:

- **Clientes**: "Puede canjear" con un "!" junto al nombre, y arriba de la
  lista "N clientas ya pueden canjear Pañuelo de seda… · Ver solo esas".
- **Inicio**: el mismo aviso con "Ver clientas", y el "!" junto al nombre en
  la lista de clientes.
- **Detalle de la clienta**: "Ya puede canjear Pañuelo de seda", cuántos
  puntos tiene, cuántos le faltan para el siguiente premio (y cuál es),
  **"Avisarle por WhatsApp"** y **"Marcar como contactada"**.

El WhatsApp se abre con el mensaje sugerido; **no se manda nada solo**: la
empleada lo revisa, lo manda desde su WhatsApp y marca el contacto:

> ¡Hola! ¿Cómo estás? Te contamos que ya tenés los puntos necesarios para
> canjear tu pañuelo en Club Peperina. Además, estás cada vez más cerca de
> conseguir tu próximo premio.

(El nombre del premio sale del premio configurado; si ya le alcanza para
todos los premios, no se agrega la última frase.)

## Reglas

- **Umbral**: el puntaje del premio elegido en Ajustes → "Alerta de canje"
  (por negocio). No es un número aparte a propósito: así la alerta nunca dice
  "ya podés canjear" con menos puntos de los que cuesta el premio. Elegir el
  premio no cambia su puntaje ni ninguna regla.
- **Pendiente**: saldo actual (no los puntos ganados de por vida) mayor o
  igual al puntaje del premio, y sin contacto marcado.
- **Sin repetir**: al marcar "contactada" se guarda cuándo y con cuántos
  puntos; deja de estar pendiente y no vuelve a aparecer para avisar.
  "Deshacer" la vuelve a poner pendiente (por si se marcó por error).
- **Canje**: cualquier canje (desde su panel o en el local) borra el contacto.
  Si le quedan puntos suficientes, o cuando vuelve a llegar, aparece de nuevo.
- **Multiempresa**: cada negocio elige su premio (o ninguno: desactivada por
  defecto). Un negocio no ve ni marca las alertas de otro.

Los niveles (Bronce, Plata, Oro…) no cambian: se calculan sobre los puntos
ganados de por vida y no tienen relación con la alerta.

## Configuración actual: verificar antes de activar

Desde la sesión no se puede ver la base real, así que **no se pudo confirmar
que el pañuelo cueste 4.000 puntos en producción** (los datos de prueba lo
tienen en otro valor). No se cambió ningún premio ni puntaje. Antes de
activar la alerta, correr (solo lectura):

```bash
DATABASE_URL=... node scripts/revisar-alerta-canje.mjs --esperado=4000
```

Lista los premios con su puntaje, dice si el primero coincide con 4.000 y
cuántas clientas aparecerían. Si no coincide, decidir con Genaro antes de
cambiar nada. Después, en Ajustes → "Alerta de canje", elegir el pañuelo.

## Datos

Migración `20261108120000_alerta_canje`: `Negocio.alertaCanjePremioId`,
`Cliente.alertaContactadaEn` y `Cliente.alertaContactadaPuntos`, columnas
nuevas y vacías (ningún negocio con la alerta activada). No toca puntos,
premios ni saldos.
