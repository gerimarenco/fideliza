'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RestablecerContrasena() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);
  const router = useRouter();

  // Leído con window.location.search en vez de useSearchParams(), mismo
  // criterio que app/login/page.js con el ?error de Google: evita tener
  // que envolver la página en un Suspense boundary solo por esto.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  const handleGuardar = async () => {
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/password-reset/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passwordNueva: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cambiar la contraseña');
      } else {
        setListo(true);
      }
    } catch {
      setError('Ocurrió un error. Probá de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f5', color: '#17191b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 32, borderBottom: '1px solid #17191b', paddingBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontStyle: 'italic', fontSize: 40, lineHeight: 1 }}>Retornar</div>
          <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontSize: 22, color: '#17191b', marginTop: 10 }}>Elegí tu nueva contraseña</div>
        </div>

        {listo ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#17191b', lineHeight: 1.5, marginBottom: 24 }}>
              Listo, ya podés entrar con tu nueva contraseña.
            </div>
            <button onClick={() => router.push('/login')} style={{ width: '100%', padding: '11px', borderRadius: 2, border: 'none', background: '#17191b', color: '#f8f8f5', minHeight: 46, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Ir al login
            </button>
          </div>
        ) : !token ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#b91c1c', lineHeight: 1.5, marginBottom: 24 }}>
              Este link no es válido. Pedí uno nuevo desde &quot;Olvidé mi contraseña&quot;.
            </div>
            <Link href="/olvide-password" style={{ fontSize: 13, color: '#17191b', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Pedir un link nuevo
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#55595e', display: 'block', marginBottom: 6 }}>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: 2, border: '1px solid #c9cac4', background: '#fff', color: '#17191b', fontSize: 14, boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#55595e', padding: 4 }}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#55595e', display: 'block', marginBottom: 6 }}>Repetir contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGuardar()}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 2, border: '1px solid #c9cac4', background: '#fff', color: '#17191b', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {error && <div role="alert" style={{ fontSize: 13, color: '#b91c1c', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

            <button onClick={handleGuardar} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 2, border: 'none', background: '#17191b', color: '#f8f8f5', minHeight: 46, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
