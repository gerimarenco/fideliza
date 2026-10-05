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
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 360, border: '1px solid #eee' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>Retornar</div>
          <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Recuperar contraseña</div>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 24 }}>
              Si <strong>{email.trim()}</strong> tiene una cuenta en Retornar, te mandamos un mail con un link para elegir una contraseña nueva. Revisá también la carpeta de spam.
            </div>
            <Link href="/login" style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
              Volver al login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
              Escribí el email con el que te registraste y te mandamos un link para elegir una contraseña nueva.
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnviar()}
                placeholder="tu@email.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

            <button onClick={handleEnviar} disabled={loading || !email.trim()} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Enviando...' : 'Mandar link'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
              <Link href="/login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
                Volver al login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
