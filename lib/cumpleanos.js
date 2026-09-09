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
