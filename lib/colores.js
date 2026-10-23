// Contraste de colores para el tema de marca de cada negocio (Negocio.tema,
// ver resolverTema en app/page.js). Cada negocio elige sus colores en
// Ajustes y no siempre combinan bien para leer: la paleta real de Peperina
// tiene un gris "texto secundario" (#A99886) que sobre su fondo crema da
// ~2.6:1, muy por debajo del 4.5:1 que se recomienda para texto chico.
// Esto NO cambia lo que el negocio guardó: solo oscurece (o aclara) el color
// al mostrarlo, lo justo para que se pueda leer.

function aRgb(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function aHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function luminancia(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Relación de contraste WCAG entre dos colores (1 a 21). null si alguno no
// es un hex válido.
export function contraste(a, b) {
  const ra = aRgb(a)
  const rb = aRgb(b)
  if (!ra || !rb) return null
  const la = luminancia(ra)
  const lb = luminancia(rb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Devuelve `color` tal cual si ya se lee bien sobre todos los `fondos`; si
// no, lo va mezclando de a poco con `haciaColor` (normalmente el color de
// texto principal del mismo tema, así conserva el tono de la marca) hasta
// llegar al mínimo. Si algún color no es un hex válido, no toca nada.
export function asegurarContraste(color, fondos, haciaColor, minimo = 4.5) {
  const base = aRgb(color)
  const destino = aRgb(haciaColor)
  if (!base || !destino || fondos.some((f) => !aRgb(f))) return color
  const peor = (c) => Math.min(...fondos.map((f) => contraste(c, f)))
  if (peor(color) >= minimo) return color
  for (let paso = 1; paso <= 20; paso++) {
    const t = paso / 20
    const mezcla = aHex(base.map((v, i) => v + (destino[i] - v) * t))
    if (peor(mezcla) >= minimo) return mezcla
  }
  return haciaColor
}

// Color de texto para poner encima de un botón/bloque de color `fondo`: el
// que eligió el negocio si se lee bien; si no, blanco o casi negro, el que
// contraste más.
export function textoSobre(fondo, preferido, minimo = 4.5) {
  if (contraste(preferido, fondo) >= minimo) return preferido
  if (contraste('#ffffff', fondo) == null) return preferido
  return contraste('#ffffff', fondo) >= contraste('#17191b', fondo) ? '#ffffff' : '#17191b'
}
