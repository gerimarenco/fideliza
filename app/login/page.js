'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'AccessDenied') {
      setError('Ese email de Google no tiene una cuenta en Fideliza');
    } else if (params.get('error')) {
      setError('No se pudo iniciar sesión con Google');
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const result = await signIn('credentials', {
      email, password, redirect: false
    });
    if (result?.error) {
      setError('Email o contraseña incorrectos');
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 360, border: '1px solid #eee' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a' }}>Fideliza</div>
          <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>Ingresá a tu cuenta</div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          Iniciar sesión con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <div style={{ fontSize: 12, color: '#aaa' }}>o</div>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
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

        {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}
