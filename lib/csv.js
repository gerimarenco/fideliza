// Celdas para el CSV de clientes (ver app/api/clientes/exportar), que el
// negocio abre en Excel.

// Formato CSV estándar (RFC 4180) con ";" como separador: si un valor tiene
// ";", comillas o saltos de línea, va entre comillas dobles duplicando las
// que ya tuviera.
//
// Además, un valor que empieza con = + - @ (o tab / retorno) Excel lo
// interpreta como fórmula al abrir el archivo: el nombre lo tipea la propia
// clienta al registrarse, así que alguien podría registrarse como
// "=HYPERLINK(...)" y que se ejecute en la PC del negocio. Se le antepone
// un apóstrofo, que Excel muestra como texto tal cual.
export function celdaCsv(valor) {
  let texto = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  if (/[";\n\r]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}

// dd/mm/aaaa sin toLocaleDateString (el runtime de Netlify puede no traer
// los datos de 'es-AR', ver formatearMiles en lib/clienteStats.js). Con
// `utc` se lee la fecha en UTC (fechaNacimiento se guarda como medianoche
// UTC); si no, en hora de Argentina (UTC-3, sin horario de verano).
export function fechaCorta(fecha, { utc = false } = {}) {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  const local = utc ? d : new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const dd = String(local.getUTCDate()).padStart(2, '0')
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${local.getUTCFullYear()}`
}
