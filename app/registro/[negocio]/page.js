'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function RegistroPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const negocio = params.negocio;
  // Link de invitación de otra clienta (ver "Referí a una amiga" en el
  // panel del cliente) — si no está o no matchea a nadie, el backend lo
  // ignora en silencio, no hace falta validarlo acá.
  const codigoReferido = searchParams.get('ref');

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [dni, setDni] = useState('');
  const [sexo, setSexo] = useState('');
  const [telefono, setTelefono] = useState('');
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
        body: JSON.stringify({ nombre: `${nombre.trim()} ${apellido.trim()}`.trim(), email, password, fechaNacimiento, dni, sexo, telefono, codigoReferido }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Ocurrió un error al registrarte.');
        setLoading(false);
        return;
      }

      // La cuenta ya existe con este email/contraseña -- inicia sesión sola
      // en vez de mandarla a /login a tipear de nuevo lo que acaba de
      // elegir. Si por algún motivo el login automático fallara (nunca
      // debería, son las mismas credenciales que recién se guardaron),
      // sigue funcionando como antes: la cuenta quedó creada igual, solo
      // que la manda a loguearse a mano.
      const resultado = await signIn('credentials', { email, password, redirect: false });
      if (resultado?.error) {
        alert('¡Cuenta creada con éxito! Ahora podés iniciar sesión.');
        router.push('/login');
        return;
      }
      router.push('/');
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
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
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
              Apellido
            </label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
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
              Fecha de nacimiento
            </label>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              required
              max={new Date().toISOString().split('T')[0]}
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
              DNI
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
              required
              minLength={7}
              maxLength={8}
              placeholder="Sin puntos"
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
              Celular (WhatsApp)
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              placeholder="11 2345 6789"
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
              Sexo
            </label>
            <select
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'white',
              }}
            >
              <option value="" disabled>Seleccioná una opción</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
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