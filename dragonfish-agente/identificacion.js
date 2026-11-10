// Qué datos de una venta de Dragon Fish se le mandan a Retornar para
// reconocer a la clienta. Sale de la factura (/Facturaagrupada) y de la
// ficha del cliente (/Cliente/{Codigo}), con los nombres de campo del swagger
// de Dragon Fish: EMail, Movil (celular), Telefono, NroDocumento, CUIT,
// Nombre / PrimerNombre / Apellido. Retornar normaliza y decide (ver
// lib/dragonfishIdentificacion.js en el repo); acá solo se juntan los datos.
const texto = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

function identificacionDeVenta(factura = {}, ficha = null) {
  const f = ficha || {}
  const email = texto(factura.Email) || texto(f.EMail) || texto(f.Email)
  const telefonos = [texto(f.Movil), texto(f.Telefono), texto(factura.Telefono)].filter(Boolean)
  const nombre = texto(f.Nombre) || [texto(f.PrimerNombre), texto(f.SegundoNombre), texto(f.Apellido)].filter(Boolean).join(' ') || texto(factura.ClienteDetalle) || texto(factura.ClienteNombre)
  return {
    email: email || undefined,
    // `telefono` lo sigue leyendo un Retornar anterior a este cambio.
    telefono: telefonos[0] || undefined,
    telefonos: [...new Set(telefonos)],
    dni: texto(f.NroDocumento) || undefined,
    cuit: texto(f.CUIT) || undefined,
    nombre: nombre || undefined,
  }
}

const tieneIdentificacion = (d) => !!(d.email || d.telefonos.length || d.dni || d.cuit)

module.exports = { identificacionDeVenta, tieneIdentificacion }
