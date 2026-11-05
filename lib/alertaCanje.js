// Alerta para las empleadas: clientas que ya pueden canjear el premio que el
// negocio eligió (Negocio.alertaCanjePremioId, ej. el pañuelo) y todavía no
// fueron contactadas. Se muestra en Clientes con un "!" junto al nombre,
// cuántos puntos tiene, cuántos le faltan para el siguiente premio y un
// WhatsApp con el mensaje sugerido. Nunca se manda nada solo: la empleada
// revisa el mensaje, lo manda desde su WhatsApp y marca el contacto.
//
// Reglas:
// - El umbral es el puntaje del premio elegido (no un número aparte): así la
//   alerta nunca dice "ya podés canjear" con menos puntos de los que cuesta.
// - Pendiente: puntos >= umbral y sin contacto marcado
//   (Cliente.alertaContactadaEn null). Marcar el contacto la apaga; un canje
//   la reinicia (app/api/canjes): si después vuelve a llegar, aparece de nuevo.
// - Es por negocio: cada uno elige su premio (o ninguno).

// El premio de la alerta del negocio, si está activo y es suyo.
export function premioDeAlerta(negocio, premios) {
  if (!negocio?.alertaCanjePremioId) return null
  return (premios || []).find((p) => p.id === negocio.alertaCanjePremioId && p.activo !== false && p.negocioId === negocio.id) || null
}

// Estado de la alerta de una clienta, o null si no le corresponde.
// premios: los activos del negocio (para el siguiente premio).
export function estadoAlerta(cliente, premio, premios = []) {
  if (!premio || !cliente || !(cliente.puntos >= premio.puntos)) return null
  const siguiente = [...premios]
    .filter((p) => p.activo !== false && p.puntos > cliente.puntos)
    .sort((a, b) => a.puntos - b.puntos)[0]
  return {
    premio: { id: premio.id, nombre: premio.nombre, puntos: premio.puntos },
    puntos: cliente.puntos,
    siguiente: siguiente ? { nombre: siguiente.nombre, puntos: siguiente.puntos, faltan: siguiente.puntos - cliente.puntos } : null,
    pendiente: !cliente.alertaContactadaEn,
    contactadaEn: cliente.alertaContactadaEn ?? null,
    contactadaPuntos: cliente.alertaContactadaPuntos ?? null,
  }
}

// Filtro de Prisma de las clientas con la alerta pendiente.
export function filtroAlertaPendiente(premio) {
  return { puntos: { gte: premio.puntos }, alertaContactadaEn: null }
}

// "Pañuelo de seda" → "pañuelo de seda" (va en medio de la frase). Si arranca
// con una sigla o un número ("$70.000 de descuento", "10% …"), queda igual.
function enMinuscula(nombre) {
  const texto = String(nombre || '').trim()
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(texto)) return texto[0].toLowerCase() + texto.slice(1)
  return texto
}

// Mensaje sugerido (decisión de Genaro, 2026-11-08). La empleada lo puede
// editar en WhatsApp antes de mandarlo. Sin siguiente premio, no promete uno.
export function mensajeAlerta({ premioNombre, club, haySiguiente }) {
  return `¡Hola! ¿Cómo estás? Te contamos que ya tenés los puntos necesarios para canjear tu ${enMinuscula(premioNombre)} en ${club}.${haySiguiente ? ' Además, estás cada vez más cerca de conseguir tu próximo premio.' : ''}`
}
