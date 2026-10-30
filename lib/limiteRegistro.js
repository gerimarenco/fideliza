// Tope de registros rechazados por email o DNI ya registrados, por conexión
// (ver app/api/registro/[negocio]). El registro tiene que decir "Este DNI ya
// está registrado" para que la clienta sepa qué hacer; sin tope, ese mensaje
// serviría para probar documentos en masa y averiguar cuáles tienen cuenta.
// Una persona real se equivoca una o dos veces, no diez en un cuarto de hora.
export const MAXIMO_RECHAZOS_POR_CONEXION = 10
export const VENTANA_REGISTRO_MS = 15 * 60 * 1000

export function registroBloqueado(rechazosRecientes) {
  return rechazosRecientes >= MAXIMO_RECHAZOS_POR_CONEXION
}

export function inicioVentanaRegistro(ahora = new Date()) {
  return new Date(ahora.getTime() - VENTANA_REGISTRO_MS)
}

export const MENSAJE_DEMASIADOS_INTENTOS = 'Hubo demasiados intentos de registro desde esta conexión. Probá de nuevo en unos minutos.'
