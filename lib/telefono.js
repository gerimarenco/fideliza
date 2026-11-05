import { celularesPosibles } from './bienvenida.js'

// Celular de las clientas (Cliente.telefono). La clienta elige el país
// (Argentina por defecto) y escribe solo el código de área y el número:
// "2324500294" (Mercedes) o "1155551234" (Buenos Aires), sin +54, sin 9 y
// sin 15. Se guarda en formato internacional: "+5492324500294".
//
// Los celulares guardados antes de este cambio quedan como estaban
// ("2324500294", "2324-50-0294"...): mismoCelular (lib/bienvenida.js) los
// sigue reconociendo como el mismo número que su versión internacional, y
// numeroWhatsapp arma el enlace de WhatsApp para los dos.

// nacional: cantidad de dígitos del número sin el prefijo del país (para
// Argentina, código de área + número). Los países que no son Argentina no
// llevan un indicador de celular en el formato internacional.
export const PAISES = [
  { codigo: 'AR', nombre: 'Argentina', prefijo: '54', nacional: [10, 10], ejemplo: '2324500294' },
  { codigo: 'UY', nombre: 'Uruguay', prefijo: '598', nacional: [8, 8], ejemplo: '94123456' },
  { codigo: 'CL', nombre: 'Chile', prefijo: '56', nacional: [9, 9], ejemplo: '912345678' },
  { codigo: 'PY', nombre: 'Paraguay', prefijo: '595', nacional: [9, 9], ejemplo: '981123456' },
  { codigo: 'BO', nombre: 'Bolivia', prefijo: '591', nacional: [8, 8], ejemplo: '71234567' },
  { codigo: 'BR', nombre: 'Brasil', prefijo: '55', nacional: [10, 11], ejemplo: '11912345678' },
  { codigo: 'PE', nombre: 'Perú', prefijo: '51', nacional: [9, 9], ejemplo: '912345678' },
  { codigo: 'ES', nombre: 'España', prefijo: '34', nacional: [9, 9], ejemplo: '612345678' },
  { codigo: 'US', nombre: 'Estados Unidos', prefijo: '1', nacional: [10, 10], ejemplo: '2025550123' },
]
export const PAIS_PREDETERMINADO = 'AR'

export const MENSAJE_CELULAR_FALTA = 'El celular es obligatorio.'
export const MENSAJE_CELULAR_ARGENTINA = 'Escribí el código de área sin el 0 y el número sin el 15: 10 números en total (por ejemplo, 2324500294 o 1155551234).'

// Número de Argentina → los 10 dígitos de código de área + número, o null.
// Acepta que la clienta igual escriba el 0, el 15, o el +54 / +54 9 (se
// sacan, para no duplicarlos); si con el 15 no se puede saber dónde
// termina el código de área, no se adivina.
function nacionalArgentina(digitos) {
  let d = digitos
  if (d.length === 13 && d.startsWith('549')) d = d.slice(3)
  else if (d.length === 12 && d.startsWith('54')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 13 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 12) {
    // Con el 15 después del código de área (de 2, 3 o 4 dígitos).
    const lecturas = [2, 3, 4].filter((k) => d.slice(k, k + 2) === '15').map((k) => d.slice(0, k) + d.slice(k + 2))
    if (lecturas.length !== 1) return null
    d = lecturas[0]
  }
  if (d.length !== 10) return null
  // Los códigos de área argentinos empiezan con 11 (AMBA), con 2 o con 3.
  if (!/^(11|2|3)/.test(d)) return null
  return d
}

// (numero, pais) → { telefono: '+549…' } o { error }.
export function normalizarCelular(numero, codigoPais = PAIS_PREDETERMINADO) {
  if (numero == null || String(numero).trim() === '') return { error: MENSAJE_CELULAR_FALTA }
  if (/[^\d\s\-().+]/.test(String(numero))) return { error: 'El celular tiene que tener solo números.' }
  const pais = PAISES.find((p) => p.codigo === codigoPais)
  if (!pais) return { error: 'Elegí el país del celular.' }
  const digitos = String(numero).replace(/\D/g, '')

  if (pais.codigo === 'AR') {
    const nacional = nacionalArgentina(digitos)
    if (!nacional) return { error: MENSAJE_CELULAR_ARGENTINA }
    // El 9 es el indicador de celular en el formato internacional argentino.
    return { telefono: `+549${nacional}` }
  }

  let d = digitos
  const [minimo, maximo] = pais.nacional
  if (d.startsWith(pais.prefijo) && d.length - pais.prefijo.length >= minimo) d = d.slice(pais.prefijo.length)
  d = d.replace(/^0+/, '')
  if (d.length < minimo || d.length > maximo) {
    const cuantos = minimo === maximo ? `${minimo}` : `${minimo} o ${maximo}`
    return { error: `Para ${pais.nombre}, el celular tiene que tener ${cuantos} números, sin el código del país (por ejemplo, ${pais.ejemplo}).` }
  }
  return { telefono: `+${pais.prefijo}${d}` }
}

// Número para el enlace de WhatsApp (wa.me/<número>): con código de país y
// solo dígitos. Para los celulares viejos guardados sin código de país, si
// tienen forma de número argentino se les agrega +54 9.
export function numeroWhatsapp(telefono) {
  const texto = String(telefono || '').trim()
  if (!texto) return null
  const digitos = texto.replace(/\D/g, '')
  if (texto.startsWith('+')) return digitos
  const lecturas = celularesPosibles(texto)
  if (lecturas.length === 1 && lecturas[0].length === 10 && /^(11|2|3)/.test(lecturas[0])) return `549${lecturas[0]}`
  return digitos || null
}
