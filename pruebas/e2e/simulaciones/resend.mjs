// Simula la API de Resend en el servidor de desarrollo: cada mail se guarda
// en un archivo en vez de enviarse. Nada sale a internet.
import fs from 'node:fs'
import { DIR } from '../estado.mjs'
const ARCHIVO = `${DIR}/mails-enviados.json`
const fetchReal = globalThis.fetch
globalThis.fetch = async (url, opciones) => {
  const u = typeof url === 'string' ? url : url?.url
  if (u && u.startsWith('https://api.resend.com/')) {
    const cuerpo = JSON.parse(opciones.body)
    const lista = fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) : []
    lista.push({ to: cuerpo.to, subject: cuerpo.subject, html: cuerpo.html })
    fs.writeFileSync(ARCHIVO, JSON.stringify(lista))
    return new Response(JSON.stringify({ id: 'mail-' + lista.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return fetchReal(url, opciones)
}
