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
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 360, border: '1px solid #eee' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>Retornar</div>
          <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Elegí tu nueva contraseña</div>
        </div>

        {listo ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 24 }}>
              Listo, ya podés entrar con tu nueva contraseña.
            </div>
            <button onClick={() => router.push('/login')} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Ir al login
            </button>
          </div>
        ) : !token ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#ef4444', lineHeight: 1.5, marginBottom: 24 }}>
              Este link no es válido. Pedí uno nuevo desde &quot;Olvidé mi contraseña&quot;.
            </div>
            <Link href="/olvide-password" style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
              Pedir un link nuevo
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', padding: 4 }}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Repetir contraseña</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGuardar()}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

            <button onClick={handleGuardar} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
