// Sin dependencias (lo importan tanto un componente cliente de Next.js,
// app/page.js, como una Netlify Function .mjs corriendo con Node puro) —
// mismo motivo que lib/nombreClub.js.
//
// Devuelve true si `fechaNacimiento` cae hoy (`hoy`), comparando mes/día en
// UTC. Los nacidos el 29 de febrero festejan el 28 en años no bisiestos,
// para que el regalo de puntos (netlify/functions/regalo-cumpleanos.mjs) y
// el cartel del panel del cliente (app/page.js) no se salteen su
// cumpleaños 3 de cada 4 años (28 de febrero nunca coincidía con el 29).
function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

export function esCumpleanosHoy(fechaNacimiento, hoy) {
  const nacimiento = new Date(fechaNacimiento)
  const mes = nacimiento.getUTCMonth()
  let dia = nacimiento.getUTCDate()

  if (mes === 1 && dia === 29 && !esBisiesto(hoy.getUTCFullYear())) {
    dia = 28
  }

  return mes === hoy.getUTCMonth() && dia === hoy.getUTCDate()
}

// Cuántos días faltan para el próximo cumpleaños (0 si es hoy) -- para el
// contador de anticipación del panel del cliente ("Faltan X días para tu
// cumpleaños"). Mismo ajuste del 29 de febrero que esCumpleanosHoy, pero
// evaluado contra el año en que realmente cae la próxima fecha (este año
// si todavía no pasó, el que viene si ya pasó), no contra el año actual a
// secas -- si no, alguien nacido el 29/2 podría festejar según si el año
// que viene es bisiesto en vez del año en que el cumpleaños realmente cae.
export function diasHastaProximoCumpleanos(fechaNacimiento, hoy) {
  const nacimiento = new Date(fechaNacimiento)
  const mes = nacimiento.getUTCMonth()
  const diaNacimiento = nacimiento.getUTCDate()

  const diaAjustado = (anio) => (mes === 1 && diaNacimiento === 29 && !esBisiesto(anio) ? 28 : diaNacimiento)

  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  const anioActual = hoy.getUTCFullYear()

  let proxima = Date.UTC(anioActual, mes, diaAjustado(anioActual))
  if (proxima < hoyUTC) {
    proxima = Date.UTC(anioActual + 1, mes, diaAjustado(anioActual + 1))
  }

  return Math.round((proxima - hoyUTC) / (1000 * 60 * 60 * 24))
}
