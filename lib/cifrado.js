// Cifrado de secretos guardados en la base (hoy: el token de actualización
// de Google de cada negocio, ver lib/googleSheets.js). AES-256-GCM con una
// clave derivada (HKDF) de NEXTAUTH_SECRET, que ya es un secreto del
// servidor: no hace falta otra variable. Si NEXTAUTH_SECRET cambia, los
// tokens guardados dejan de poder leerse y cada negocio tiene que volver a
// conectar su cuenta (no se pierde nada más).
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto'

function clave(proposito) {
  const secreto = process.env.NEXTAUTH_SECRET
  if (!secreto) throw new Error('Falta NEXTAUTH_SECRET para cifrar')
  return Buffer.from(hkdfSync('sha256', secreto, 'retornar', `retornar:${proposito}`, 32))
}

// → "v1:<iv>:<tag>:<datos>" en base64url.
export function cifrar(texto, proposito = 'tokens-google') {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', clave(proposito), iv)
  const datos = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), datos.toString('base64url')].join(':')
}

// null si no se puede descifrar (clave distinta o dato alterado).
export function descifrar(valor, proposito = 'tokens-google') {
  try {
    const [version, iv, tag, datos] = String(valor).split(':')
    if (version !== 'v1') return null
    const decipher = createDecipheriv('aes-256-gcm', clave(proposito), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(datos, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
