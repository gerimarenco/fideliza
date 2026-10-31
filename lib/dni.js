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

// "12.345.678" → "12345678". null si no tiene la forma de un DNI: vacío,
// con letras u otros signos, o de largo inválido. Solo se controla el
// formato: no se rechazan números por parecer raros (11.111.111 o
// 12.345.678 son documentos reales) y no se verifica contra RENAPER ni
// ningún registro oficial, así que un número inventado con la forma
// correcta pasa.
export function normalizarDni(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const texto = String(valor).replace(/[\s.\-]/g, '')
  if (!/^\d+$/.test(texto)) return null
  const dni = texto.replace(/^0+/, '')
  if (dni.length < LARGO_MINIMO || dni.length > LARGO_MAXIMO) return null
  return dni
}

// Mensajes que ve la clienta en el registro. Ninguno repite el documento.
export const MENSAJE_DNI_FALTA = 'El DNI es obligatorio.'
export const MENSAJE_DNI_INVALIDO = 'El DNI no es válido. Ingresá los 7 u 8 números de tu documento.'
export const MENSAJE_DNI_REPETIDO = 'Este DNI ya está registrado. Ya existe una cuenta asociada a este documento. Iniciá sesión o recuperá tu cuenta.'
export const MENSAJE_EMAIL_REPETIDO = 'Este correo electrónico ya está registrado. Iniciá sesión o recuperá tu contraseña.'
