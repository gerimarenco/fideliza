import { asegurarContraste, textoSobre } from './colores.js'

// Paleta por defecto del panel de negocio, del panel de cliente y de las
// páginas públicas del club (dirección "Editorial": papel, tinta y un verde
// sobrio). Un negocio con marca propia (ej. Peperina) puede sobreescribir
// cualquiera de estos tokens vía Negocio.tema — lo que no sobreescriba usa
// este valor.
export const TEMA_DEFAULT = {
  fondo: '#f8f8f5',
  superficie: '#ffffff',
  borde: '#dadbd6',
  texto: '#17191b',
  textoSecundario: '#55595e',
  primario: '#1e5b45',
  primarioTexto: '#ffffff',
  resaltado: '#e8efe9',
  fuenteTitulo: 'var(--font-titulo), Georgia, serif',
  imagenPortada: '',
}

export const FUENTE_TEXTO = "var(--font-texto), 'Helvetica Neue', Arial, sans-serif"

// Además de combinar el tema guardado con los valores por defecto, ajusta
// (solo al mostrar, sin tocar lo guardado) los colores que no se leerían
// bien: ver lib/colores.js. primarioLegible es el color de marca para usar
// como TEXTO (nivel, montos, links) sobre el fondo; bordeCampo, el borde de
// inputs y selects, que necesita al menos 3:1 para que se vea dónde tipear
// (las líneas divisorias decorativas siguen usando `borde` tal cual).
export function resolverTema(temaGuardado) {
  const t = { ...TEMA_DEFAULT, ...(temaGuardado || {}) }
  const fondos = [t.fondo, t.superficie, t.resaltado]
  return {
    ...t,
    textoSecundario: asegurarContraste(t.textoSecundario, fondos, t.texto),
    primarioTexto: textoSobre(t.primario, t.primarioTexto),
    primarioLegible: asegurarContraste(t.primario, fondos, t.texto),
    bordeCampo: asegurarContraste(t.borde, [t.fondo, t.superficie], t.texto, 3),
  }
}
