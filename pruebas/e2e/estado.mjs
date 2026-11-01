// Carpeta donde las pruebas E2E y las simulaciones (Tiendanube, Resend)
// comparten su estado: cupones creados, órdenes, mails "enviados" y el log
// del servidor de desarrollo. La comparten el proceso de la prueba y el del
// servidor, así que los dos tienen que ver el mismo RETORNAR_E2E_DIR.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DIR = process.env.RETORNAR_E2E_DIR || path.join(os.tmpdir(), 'retornar-e2e')
fs.mkdirSync(DIR, { recursive: true })
