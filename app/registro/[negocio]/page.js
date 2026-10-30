'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { resolverTema, FUENTE_TEXTO } from '@/lib/tema';

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
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [sexo, setSexo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [dni, setDni] = useState('');
  const [cuentaExistente, setCuentaExistente] = useState(false);
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
    setCuentaExistente(false);
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
        // Email o DNI ya registrados: a mano los caminos para entrar.
        setCuentaExistente(res.status === 409);
        setLoading(false);
        return;
      }

      // La cuenta ya existe con este email/contraseña -- inicia sesión sola
      // en vez de mandarla a /login a tipear de nuevo lo que acaba de
      // elegir. Sin ningún alert() bloqueante en el medio: a Cecilia y a
      // su hermano les molestaba el cartelito de "cuenta creada con
      // éxito" interrumpiendo el paso a la app, sin importar qué dijera.
      // Si por algún motivo el login automático fallara (nunca debería,
      // son las mismas credenciales que recién se guardaron), la cuenta
      // quedó creada igual -- solo la manda a /login sin ningún aviso de
      // por medio, ahí puede entrar a mano.
      const resultado = await signIn('credentials', { email, password, redirect: false });
      if (resultado?.error) {
        router.push('/login');
        return;
      }
      router.push('/');
    } catch (err) {
      setError('Ocurrió un error al registrarte. Intentá de nuevo.');
      setLoading(false);
    }
  }

  // Colores de la marca del negocio (ver /api/registro): hasta que llegan,
  // la paleta por defecto.
  const t = resolverTema(datosNegocio ? { primario: datosNegocio.temaPrimario, primarioTexto: datosNegocio.temaPrimarioTexto, ...(datosNegocio.tema || {}) } : null);
  const estiloLabel = { display: 'block', marginBottom: 6, fontSize: 14, color: t.textoSecundario };
  const estiloInput = { width: '100%', padding: '11px 12px', borderRadius: 2, border: `1px solid ${t.bordeCampo}`, background: t.superficie, color: t.texto, fontSize: 16, boxSizing: 'border-box' };
  const campo = { marginBottom: 16 };

  return (
    <div style={{ minHeight: '100vh', background: t.fondo, color: t.texto, fontFamily: FUENTE_TEXTO, display: 'flex', justifyContent: 'center', padding: '40px 20px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontFamily: t.fuenteTitulo, fontWeight: 400, fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 8px' }}>
          {datosNegocio ? datosNegocio.nombre : (
            <span style={{ textTransform: 'capitalize' }}>{negocio}</span>
          )}
        </h1>
        <p style={{ color: t.textoSecundario, margin: '0 0 24px', fontSize: 15, lineHeight: 1.5, paddingBottom: 20, borderBottom: `1px solid ${t.texto}` }}>
          {datosNegocio?.mensajeRegistro || 'Creá tu cuenta para empezar a sumar puntos.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={campo}>
              <span style={estiloLabel}>Nombre</span>
              <input type="text" autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={estiloInput} />
            </label>
            <label style={campo}>
              <span style={estiloLabel}>Apellido</span>
              <input type="text" autoComplete="family-name" value={apellido} onChange={(e) => setApellido(e.target.value)} required style={estiloInput} />
            </label>
          </div>

          <label style={{ ...campo, display: 'block' }}>
            <span style={estiloLabel}>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={estiloInput} />
          </label>

          <div style={campo}>
            <label htmlFor="registro-password" style={estiloLabel}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="registro-password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ ...estiloInput, paddingRight: 76 }}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((s) => !s)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: t.textoSecundario, padding: '8px 6px' }}
              >
                {mostrarPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <label style={{ ...campo, display: 'block' }}>
            <span style={estiloLabel}>Fecha de nacimiento</span>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              required
              max={new Date().toISOString().split('T')[0]}
              style={estiloInput}
            />
          </label>

          <label style={{ ...campo, display: 'block' }}>
            <span style={estiloLabel}>DNI</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^\d.\s-]/g, ''))}
              required
              maxLength={12}
              placeholder="12.345.678"
              aria-describedby="registro-dni-ayuda"
              style={estiloInput}
            />
            <span id="registro-dni-ayuda" style={{ display: 'block', marginTop: 6, fontSize: 13, color: t.textoSecundario }}>
              Solo para que cada persona tenga una única cuenta. No se muestra a nadie.
            </span>
          </label>

          <label style={{ ...campo, display: 'block' }}>
            <span style={estiloLabel}>Celular (WhatsApp)</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              placeholder="11 2345 6789"
              style={estiloInput}
            />
          </label>

          <label style={{ marginBottom: 22, display: 'block' }}>
            <span style={estiloLabel}>Género (opcional)</span>
            <select value={sexo} onChange={(e) => setSexo(e.target.value)} style={estiloInput}>
              <option value="">Prefiero no decirlo</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          </label>

          {error && (
            <p role="alert" style={{ color: '#b91c1c', fontSize: 14, margin: '0 0 16px' }}>
              {error}
              {cuentaExistente && (
                <span style={{ display: 'block', marginTop: 8 }}>
                  <a href="/login" className="fid-link" style={{ color: t.texto }}>Iniciar sesión</a>
                  {' · '}
                  <a href="/olvide-password" className="fid-link" style={{ color: t.texto }}>Recuperar contraseña</a>
                </span>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="fid-btn-primary"
            style={{ width: '100%', minHeight: 50, borderRadius: 2, border: 'none', backgroundColor: t.primario, color: t.primarioTexto, fontSize: 16, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: t.textoSecundario }}>
          ¿Ya tenés cuenta? <a href="/login" className="fid-link" style={{ color: t.texto }}>Iniciá sesión</a>
        </p>
      </div>
    </div>
  );
}
