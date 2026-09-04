import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Mientras no haya un dominio propio verificado en Resend, el remitente de
// prueba (onboarding@resend.dev) solo puede mandar mails a la casilla con la
// que se creó la cuenta de Resend, no a clientes reales — ver README.
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Fideliza <onboarding@resend.dev>'

// Mail de bienvenida para un cliente creado automáticamente a partir de una
// venta (hoy solo pasa con Dragon Fish, ver app/api/dragonfish/resolver) —
// es la única forma de que se entere de que tiene cuenta y contraseña,
// porque nadie está mirando la pantalla cuando llega ese webhook. Si no hay
// RESEND_API_KEY configurada, no rompe el flujo de puntos: solo no manda el
// mail (mismo criterio que el login con Google si faltan sus credenciales).
export async function enviarEmailBienvenida({ email, passwordGenerada, negocioNombre }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de bienvenida a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `¡Ya sumás puntos en ${negocioNombre}!`,
      html: `
        <p>¡Hola!</p>
        <p>Con tu última compra en <strong>${negocioNombre}</strong> arrancaste a sumar puntos en Fideliza, su programa de fidelización de clientes.</p>
        <p>Ya tenés una cuenta creada para vos:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Contraseña:</strong> ${passwordGenerada}</li>
        </ul>
        <p><a href="${loginUrl}">Entrá acá para ver tus puntos</a>. Te recomendamos cambiar la contraseña la primera vez que ingreses.</p>
      `,
    })
  } catch (error) {
    // Un email fallido no tiene que tirar abajo la acreditación de puntos.
    console.error('Error al enviar el email de bienvenida a', email, error)
  }
}
