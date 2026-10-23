// Normalización de los datos con los que se identifica a una clienta
// (email y teléfono) entre las distintas puertas de entrada: registro,
// login, Google, Tiendanube, Dragon Fish y "Olvidé mi contraseña".
//
// Hasta acá el registro guardaba el email tal cual se tipeaba, pero
// Tiendanube y Dragon Fish lo buscaban en minúsculas con igualdad exacta: una
// clienta registrada como "Maria.Gomez@gmail.com" nunca sumaba puntos por
// sus compras, y el login con Google (que siempre devuelve el email en
// minúsculas) la rechazaba. Los emails nuevos se guardan normalizados, y las
// búsquedas no distinguen mayúsculas para seguir encontrando a las cuentas
// viejas que ya están guardadas con mayúsculas (no se reescriben: podría
// haber dos cuentas que solo difieren en mayúsculas y la migración fallaría).

export function normalizarEmail(email) {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

// Filtro de Prisma para buscar un email sin distinguir mayúsculas.
export function filtroEmail(email) {
  return { equals: normalizarEmail(email), mode: 'insensitive' }
}

export function mismoEmail(a, b) {
  const na = normalizarEmail(a)
  return na !== '' && na === normalizarEmail(b)
}

// Para los logs de Netlify: alcanza para reconocer de quién se trata al
// diagnosticar un problema, sin dejar el email completo de una clienta
// guardado en un registro que no es la base de datos.
export function ocultarEmail(email) {
  const normalizado = normalizarEmail(email)
  const arroba = normalizado.indexOf('@')
  if (arroba < 1) return normalizado ? '***' : ''
  return `${normalizado.slice(0, Math.min(2, arroba))}***${normalizado.slice(arroba)}`
}

// Solo dígitos: el registro ya guarda el celular así, pero Dragon Fish
// puede traerlo con guiones, espacios o paréntesis ("2324-123456").
export function normalizarTelefono(telefono) {
  if (typeof telefono !== 'string' && typeof telefono !== 'number') return ''
  return String(telefono).replace(/\D/g, '')
}

// Forma mínima de un email (algo@algo.algo, sin espacios y de largo
// razonable): no garantiza que exista, solo evita cuentas con un email al
// que nunca le va a llegar ningún mail.
export function emailValido(email) {
  const e = normalizarEmail(email)
  return e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}
