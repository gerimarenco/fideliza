// Restar meses a una fecha sin el bug clásico de JS: `setUTCMonth` no
// "clampea" el día si el mes de destino tiene menos días (ej. 31 de agosto
// menos 6 meses calcularía "31 de febrero", que Date normaliza de
// prepo a 2-3 de marzo). Si eso pasa, nos quedamos con el último día
// válido del mes de destino en vez de dejar que se corra a otro mes.
// Usado por netlify/functions/vencimiento-puntos.mjs -- extraído a un
// módulo aparte para poder testearlo sin levantar la función completa.
export function restarMeses(fecha, meses) {
  const resultado = new Date(fecha)
  const diaOriginal = resultado.getUTCDate()
  resultado.setUTCMonth(resultado.getUTCMonth() - meses)
  if (resultado.getUTCDate() !== diaOriginal) {
    resultado.setUTCDate(0)
  }
  return resultado
}
