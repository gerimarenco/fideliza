'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function OlvidePassword() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnviar = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/password-reset/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      // Siempre se muestra el mismo mensaje de éxito, exista o no la
      // cuenta -- el backend ya responde igual en los dos casos (ver
      // app/api/password-reset/solicitar) a propósito, para no revelar
      // qué emails están registrados.
      setEnviado(true);
    } catch {
      setError('Ocurrió un error. Probá de nuevo en un rato.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f5', color: '#17191b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 32, borderBottom: '1px solid #17191b', paddingBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontStyle: 'italic', fontSize: 40, lineHeight: 1 }}>Retornar</div>
          <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontSize: 22, color: '#17191b', marginTop: 10 }}>Recuperar contraseña</div>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#17191b', lineHeight: 1.5, marginBottom: 24 }}>
              Si <strong>{email.trim()}</strong> tiene una cuenta en Retornar, te mandamos un mail con un link para elegir una contraseña nueva. Revisá también la carpeta de spam.
            </div>
            <Link href="/login" style={{ fontSize: 13, color: '#17191b', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Volver al login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#55595e', marginBottom: 20, lineHeight: 1.5 }}>
              Escribí el email con el que te registraste y te mandamos un link para elegir una contraseña nueva.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#55595e', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnviar()}
                placeholder="tu@email.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: '1px solid #c9cac4', background: '#fff', color: '#17191b', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {error && <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

            <button onClick={handleEnviar} disabled={loading || !email.trim()} style={{ width: '100%', padding: '11px', borderRadius: 2, border: 'none', background: '#17191b', color: '#f8f8f5', minHeight: 46, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Enviando...' : 'Mandar link'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#55595e' }}>
              <Link href="/login" style={{ color: '#17191b', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                Volver al login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
