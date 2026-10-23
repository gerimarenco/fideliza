// Estado del agente de Dragon Fish a partir de su último contacto con
// Retornar. El agente consulta cada 30 segundos aunque no haya ventas, así
// que "hace mucho que no consulta" significa que no está corriendo (o que la
// PC está apagada o sin internet), no que no se vendió nada.
export const MINUTOS_ACTIVO = 5
export const MINUTOS_DEMORADO = 60

export function estadoAgente(ultimoContacto, ahora = new Date()) {
  if (!ultimoContacto) return { estado: 'nunca', minutos: null }
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(ultimoContacto).getTime()) / 60000))
  if (minutos <= MINUTOS_ACTIVO) return { estado: 'activo', minutos }
  if (minutos <= MINUTOS_DEMORADO) return { estado: 'demorado', minutos }
  return { estado: 'sin_conexion', minutos }
}

export function textoTiempo(minutos) {
  if (minutos == null) return ''
  if (minutos < 1) return 'hace menos de un minuto'
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} días`
}
