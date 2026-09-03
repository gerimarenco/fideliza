'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RegistroPage() {
  const params = useParams();
  const router = useRouter();
  const negocio = params.negocio;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [datosNegocio, setDatosNegocio] = useState(null);

  useEffect(() => {
    fetch(`/api/registro/${negocio}`)
      .then(res => (res.ok ? res.json() : null))
      .then(setDatosNegocio)
      .catch(() => {});
  }, [negocio]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/registro/${negocio}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ocurrió un error al registrarte.');
        setLoading(false);
        return;
      }

      alert('¡Cuenta creada con éxito! Ahora podés iniciar sesión.');
      router.push('/login');
    } catch (err) {
      setError('Ocurrió un error al registrarte. Intentá de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 'bold',
            marginBottom: '4px',
            color: '#111827',
          }}
        >
          {datosNegocio ? `${datosNegocio.nombre} ${datosNegocio.emoji || ''}`.trim() : (
            <span style={{ textTransform: 'capitalize' }}>{negocio}</span>
          )}
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          {datosNegocio?.mensajeRegistro || 'Creá tu cuenta para empezar a sumar puntos'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#374151',
                fontWeight: '500',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                color: '#374151',
                fontWeight: '500',
              }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#6366f1',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>
      </div>
    </div>
  );
}