'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: '#555', display: 'block', marginBottom: 6 }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
        </div>

        {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}