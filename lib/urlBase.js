// URL pública de Retornar para armar links absolutos (mails, recuperación de
// contraseña). Antes, si faltaba NEXT_PUBLIC_BASE_URL, los mails salían con
// links relativos ("/login") que no llevan a ningún lado fuera del sitio.
const PRODUCCION = 'https://retornar.com.ar'

export function urlBase() {
  const configurada = (process.env.NEXT_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
  return configurada || PRODUCCION
}
