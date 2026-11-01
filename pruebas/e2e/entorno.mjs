// Entorno común de las pruebas E2E (ver pruebas/e2e/README.md). Al
// importarlo, corta todo si DATABASE_URL no apunta a una base local de
// prueba: estas pruebas borran y crean datos.
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

export { DIR } from './estado.mjs'
export const BASE = process.env.RETORNAR_E2E_BASE || 'http://localhost:3000'

export function baseLocalDePrueba(url) {
  let u
  try { u = new URL(url) } catch { return false }
  const socket = u.searchParams.get('host') || ''
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) || socket.startsWith('/')
  const nombre = decodeURIComponent(u.pathname.replace(/^\//, ''))
  return local && /(test|prueba)/i.test(nombre)
}

if (!baseLocalDePrueba(process.env.DATABASE_URL || '')) {
  console.error('Pruebas E2E: DATABASE_URL tiene que ser una base LOCAL cuyo nombre incluya "test" o "prueba". No se ejecuta nada.')
  process.exit(1)
}

// Playwright no es dependencia del proyecto: se usa el instalado en la máquina.
export function chromiumDePlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright').chromium
  } catch {
    return require(`${execSync('npm root -g').toString().trim()}/playwright`).chromium
  }
}
