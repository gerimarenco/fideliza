// Buscador de clientas del panel (ej. al asignar a mano una venta del local
// sin identificar): sin distinguir mayúsculas ni acentos, con todas las
// palabras escritas en cualquier orden, sobre el nombre y el email.
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function buscarClientas(clientes, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length) return clientes || []
  return (clientes || []).filter((c) => {
    const donde = `${normalizar(c.nombre)} ${normalizar(c.email)}`
    return palabras.every((p) => donde.includes(p))
  })
}
