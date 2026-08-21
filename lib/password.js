import bcrypt from 'bcryptjs'

const BCRYPT_HASH_REGEX = /^\$2[aby]\$/

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

// Compara una password contra lo guardado en la base. Como todavía hay
// passwords viejas en texto plano, si lo guardado no es un hash de bcrypt
// se compara directo y se avisa (needsRehash) para que el caller la
// actualice a un hash recién generado.
export async function verifyPassword(password, stored) {
  if (BCRYPT_HASH_REGEX.test(stored)) {
    return { valid: await bcrypt.compare(password, stored), needsRehash: false }
  }

  return { valid: password === stored, needsRehash: true }
}
