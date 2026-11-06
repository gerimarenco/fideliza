import Link from 'next/link';

// Política de privacidad pública (sin sesión, ver middleware.js). Google la
// pide para publicar la app de OAuth (login con Google y Exportar clientes a
// Google Sheets). Basada en docs/lanzamiento/privacidad.md: conviene que la
// revise un profesional (Ley 25.326) y ajustarla si cambia lo que se pide.
export const metadata = {
  title: 'Política de privacidad — Retornar',
  description: 'Qué datos trata Retornar, para qué y cómo ejercer tus derechos.',
};

const CONTACTO = 'genaromarenco110@gmail.com';
const ACTUALIZADA = '6 de noviembre de 2026';

const s = {
  pagina: { minHeight: '100vh', background: '#f8f8f5', color: '#17191b', padding: '48px 16px', boxSizing: 'border-box' },
  cuerpo: { maxWidth: 720, margin: '0 auto', fontSize: 15, lineHeight: 1.6 },
  marca: { fontFamily: 'var(--font-titulo), Georgia, serif', fontStyle: 'italic', fontSize: 32, color: '#17191b', textDecoration: 'none' },
  h1: { fontFamily: 'var(--font-titulo), Georgia, serif', fontWeight: 400, fontSize: 34, lineHeight: 1.15, margin: '24px 0 4px' },
  h2: { fontFamily: 'var(--font-titulo), Georgia, serif', fontWeight: 400, fontSize: 22, margin: '32px 0 8px' },
  fecha: { color: '#55595e', fontSize: 13, margin: 0 },
  link: { color: '#17191b', textDecoration: 'underline', textUnderlineOffset: 3 },
};

export default function Privacidad() {
  return (
    <main style={s.pagina}>
      <div style={s.cuerpo}>
        <Link href="/login" style={s.marca}>Retornar</Link>
        <h1 style={s.h1}>Política de privacidad</h1>
        <p style={s.fecha}>Última actualización: {ACTUALIZADA}</p>

        <h2 style={s.h2}>Quiénes somos</h2>
        <p>
          Retornar (retornar.com.ar) es una plataforma de programas de puntos para comercios. Cada comercio
          (por ejemplo, Club Peperina) es responsable de los datos de las personas de su club; Retornar los
          trata por cuenta del comercio, solo para prestar el servicio. Contacto:{' '}
          <a href={`mailto:${CONTACTO}`} style={s.link}>{CONTACTO}</a>.
        </p>

        <h2 style={s.h2}>Qué datos tratamos y para qué</h2>
        <ul>
          <li><strong>Nombre, email y celular</strong>: tu cuenta, sumar los puntos de tus compras (en el local y en la tienda online) y avisarte por mail cuando sumás, canjeás o están por vencer tus puntos.</li>
          <li><strong>Fecha de nacimiento</strong>: el regalo de cumpleaños, si el comercio lo ofrece.</li>
          <li><strong>Género</strong> (opcional): armar comunicaciones del club.</li>
          <li><strong>Contraseña</strong>: entrar a tu cuenta. Se guarda cifrada; nadie puede leerla.</li>
          <li><strong>Compras, puntos y canjes</strong>: el programa de puntos, tu historial y tu nivel.</li>
        </ul>
        <p>No vendemos ni cedemos tus datos, y no los usamos para publicidad de terceros.</p>

        <h2 style={s.h2}>Inicio de sesión con Google</h2>
        <p>
          Si entrás con tu cuenta de Google, recibimos solo tu nombre, tu email y tu foto de perfil, para
          identificarte en Retornar. No accedemos a otros datos de tu cuenta de Google.
        </p>

        <h2 style={s.h2}>Exportar clientes a Google Sheets (para comercios)</h2>
        <p>
          Un comercio puede conectar su propia cuenta de Google para exportar la lista de sus clientas a una
          hoja de cálculo. Para eso Retornar pide únicamente el permiso <code>drive.file</code>, que permite
          ver y editar solo las hojas que Retornar crea o que el comercio elige expresamente; no da acceso al
          resto del Google Drive. Se exportan nombre, email, teléfono, fecha de registro, puntos, nivel,
          compras, última actividad y cumpleaños (día y mes); nunca DNI, contraseñas ni datos de otro
          comercio. El acceso se guarda cifrado y el comercio puede quitarlo en cualquier momento desde
          Retornar («Desconectar») o desde su cuenta de Google.
        </p>
        <p>
          El uso y la transferencia de la información recibida de las APIs de Google cumplen la{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" style={s.link}>Política de datos del usuario de los servicios de API de Google</a>,
          incluidos los requisitos de uso limitado: esos datos se usan solo para la función que el comercio
          pidió, no se usan para publicidad, no se venden y no los leen personas salvo que el comercio lo pida
          para darle soporte o lo exija la ley.
        </p>

        <h2 style={s.h2}>Con quién se comparten</h2>
        <p>
          Solo con los proveedores que hacen funcionar el servicio, y solo para eso: alojamiento del sitio y
          de la base de datos, envío de mails (Resend), Google (inicio de sesión y, si el comercio lo usa,
          Google Sheets) y las tiendas online o sistemas de venta del comercio (Tiendanube, Dragon Fish) para
          reconocer tus compras. Algunos de estos proveedores guardan datos fuera de Argentina.
        </p>

        <h2 style={s.h2}>Cuánto tiempo y cómo se protegen</h2>
        <p>
          Guardamos tus datos mientras tu cuenta esté activa. Usamos conexiones cifradas, contraseñas cifradas
          y accesos separados por comercio: cada comercio ve solo a las personas de su club.
        </p>

        <h2 style={s.h2}>Tus derechos</h2>
        <p>
          Podés pedir ver, corregir o borrar tus datos escribiendo al comercio de tu club o a{' '}
          <a href={`mailto:${CONTACTO}`} style={s.link}>{CONTACTO}</a>. El titular de los datos personales
          tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no
          inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido
          en el artículo 14, inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su
          carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y
          reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las
          normas vigentes en materia de protección de datos personales.
        </p>

        <h2 style={s.h2}>Cambios</h2>
        <p>Si cambia esta política, actualizamos la fecha de arriba.</p>
      </div>
    </main>
  );
}
