// DNI de las clientas (Cliente.dni): obligatorio en el registro público
// desde 2026-10-30, para que una misma persona no pueda abrir varias cuentas
// en el mismo negocio con distintos emails (y cobrar varias veces la
// bonificación de bienvenida o el bono de referidos).
//
// Es un dato personal sensible: nunca se loguea, no viaja en mails ni en
// URLs, y ninguna respuesta de la API lo devuelve (ver
// app/api/registro/[negocio]).
//
// Se guarda normalizado (solo dígitos, sin ceros adelante), así "12.345.678",
// "12 345 678" y "12-345-678" son el mismo documento. El índice único
// (negocioId, dni) de la base garantiza uno por negocio (ver la migración
// 20261031000000_dni_obligatorio).

// 7 u 8 dígitos: los DNI argentinos vigentes (incluidos los de extranjeros,
// que empiezan con 9).
const LARGO_MINIMO = 7
const LARGO_MAXIMO = 8

// "12.345.678" → "12345678". null si no es un DNI posible: vacío, con
// letras u otros signos, de largo inválido, o claramente inventado (todos
// los dígitos iguales, o 1234567 / 12345678 / 87654321 y similares).
export function normalizarDni(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const texto = String(valor).replace(/[\s.\-]/g, '')
  if (!/^\d+$/.test(texto)) return null
  const dni = texto.replace(/^0+/, '')
  if (dni.length < LARGO_MINIMO || dni.length > LARGO_MAXIMO) return null
  if (/^(\d)\1+$/.test(dni)) return null
  if (esEscalera(dni)) return null
  return dni
}

function esEscalera(dni) {
  const digitos = [...dni].map(Number)
  const paso = digitos[1] - digitos[0]
  if (paso !== 1 && paso !== -1) return false
  return digitos.every((d, i) => i === 0 || d - digitos[i - 1] === paso)
}

// Mensajes que ve la clienta en el registro. Ninguno repite el documento.
export const MENSAJE_DNI_FALTA = 'El DNI es obligatorio.'
export const MENSAJE_DNI_INVALIDO = 'El DNI no es válido. Ingresá los 7 u 8 números de tu documento.'
export const MENSAJE_DNI_REPETIDO = 'Este DNI ya está registrado. Ya existe una cuenta asociada a este documento. Iniciá sesión o recuperá tu cuenta.'
export const MENSAJE_EMAIL_REPETIDO = 'Este correo electrónico ya está registrado. Iniciá sesión o recuperá tu contraseña.'
