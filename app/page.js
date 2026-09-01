'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';

// Paleta por defecto (clara) del panel de negocio y del panel de cliente.
// Un negocio con marca propia (ej. Peperina) puede sobreescribir cualquiera
// de estos tokens vía Negocio.tema — lo que no sobreescriba usa este valor.
const TEMA_DEFAULT = {
  fondo: '#f5f5f5',
  superficie: '#ffffff',
  borde: '#eeeeee',
  texto: '#1a1a1a',
  textoSecundario: '#999999',
  primario: '#6366f1',
  primarioTexto: '#ffffff',
  resaltado: '#eef2ff',
  fuenteTitulo: 'system-ui, sans-serif',
  imagenPortada: '',
};

function resolverTema(negocio) {
  return { ...TEMA_DEFAULT, ...(negocio?.tema || {}) };
}

export default function Home() {
  const { data: session } = useSession();
  const [negocios, setNegocios] = useState([]);
  const [negocioActivo, setNegocioActivo] = useState(null);
  const [negocioPropio, setNegocioPropio] = useState(null);
  const [monto, setMonto] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '', email: '' });
  const [mostrarFormNegocio, setMostrarFormNegocio] = useState(false);
  const [nuevoNegocio, setNuevoNegocio] = useState({ nombre: '', tipo: '', ciudad: '', emoji: '', email: '' });
  const [negocioEditandoId, setNegocioEditandoId] = useState(null);
  const [formEdicionNegocio, setFormEdicionNegocio] = useState({ nombre: '', tipo: '', ciudad: '', emoji: '', tema: { ...TEMA_DEFAULT } });
  const [clientePropio, setClientePropio] = useState(null);
  const [negocioDelCliente, setNegocioDelCliente] = useState(null);
  const [canjeandoId, setCanjeandoId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [clientesPagina, setClientesPagina] = useState(1);
  const [clientesData, setClientesData] = useState(null);
  const [canjesPagina, setCanjesPagina] = useState(1);
  const [canjesData, setCanjesData] = useState(null);
  const [premiosPagina, setPremiosPagina] = useState(1);
  const [premiosData, setPremiosData] = useState(null);
  const [mostrarFormPremio, setMostrarFormPremio] = useState(false);
  const [nuevoPremio, setNuevoPremio] = useState({ nombre: '', puntos: '', emoji: '' });
  const [premioEditandoId, setPremioEditandoId] = useState(null);
  const [formEdicionPremio, setFormEdicionPremio] = useState({ nombre: '', puntos: '', emoji: '' });
  const [formIntegraciones, setFormIntegraciones] = useState({ tiendanubeStoreId: '', tiendanubeAccessToken: '', slug: '', dragonfishBaseDeDatos: '' });
  const [formPassword, setFormPassword] = useState({ actual: '', nueva: '', confirmar: '' });
  const [formPuntosXPeso, setFormPuntosXPeso] = useState('');
  const [formPuntosBienvenida, setFormPuntosBienvenida] = useState('');

  const isAdmin = session?.user?.role === 'admin';
  const isNegocio = session?.user?.role === 'negocio';
  const isCliente = session?.user?.role === 'cliente';

  const negocioMostrado = isAdmin ? negocioActivo : (isNegocio ? negocioPropio : null);
  // Marca propia del negocio (ej. Peperina): si no tiene tema cargado, usa la
  // paleta clara por defecto. Solo afecta su propio panel y el de sus
  // clientes, nunca el chrome general del Admin.
  const tema = resolverTema(isCliente ? negocioDelCliente : negocioMostrado);

  // esCargaInicial solo es true la primera vez (justo después del login):
  // ahí sí conviene pararse directo en un negocio. Las recargas que dispara
  // cualquier acción (crear/editar/desactivar) no deben sacar al admin de la
  // grilla si ya estaba parado ahí a propósito (negocioActivo en null).
  const cargarNegocios = (esCargaInicial = false) => {
    fetch('/api/negocios')
      .then(res => res.json())
      .then(data => {
        setNegocios(data);
        if (isAdmin) {
          if (esCargaInicial && data.length > 0 && !negocioActivo) setNegocioActivo(data[0]);
          else if (negocioActivo) setNegocioActivo(data.find(n => n.id === negocioActivo.id) || null);
        }
        if (isNegocio && session?.user?.id) {
          const propio = data.find(n => n.id === session.user.id);
          setNegocioPropio(propio || null);
        }
        if (isCliente && session?.user?.id) {
          for (const neg of data) {
            const c = neg.clientes?.find(cl => cl.id === session.user.id);
            if (c) {
              setClientePropio(c);
              setNegocioDelCliente(neg);
              break;
            }
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (session) cargarNegocios(true);
  }, [session]);

  const cargarEstadisticas = (negocioId) => {
    if (!negocioId) { setEstadisticas(null); return; }
    fetch(`/api/negocios/estadisticas?negocioId=${negocioId}`)
      .then(res => res.json())
      .then(setEstadisticas)
      .catch(() => {});
  };

  useEffect(() => {
    cargarEstadisticas(negocioMostrado?.id);
  }, [negocioMostrado?.id]);

  const cargarClientes = (negocioId, page = 1) => {
    if (!negocioId) { setClientesData(null); return; }
    fetch(`/api/clientes?negocioId=${negocioId}&page=${page}&pageSize=10`)
      .then(res => res.json())
      .then(setClientesData)
      .catch(() => {});
  };

  const cargarCanjes = (negocioId, page = 1) => {
    if (!negocioId) { setCanjesData(null); return; }
    fetch(`/api/canjes?negocioId=${negocioId}&page=${page}&pageSize=10`)
      .then(res => res.json())
      .then(setCanjesData)
      .catch(() => {});
  };

  const cargarPremios = (negocioId, page = 1) => {
    if (!negocioId) { setPremiosData(null); return; }
    fetch(`/api/premios?negocioId=${negocioId}&page=${page}&pageSize=10`)
      .then(res => res.json())
      .then(setPremiosData)
      .catch(() => {});
  };

  // Al cambiar de negocio, arrancar de nuevo desde la página 1 y desde Inicio
  useEffect(() => {
    setClientesPagina(1);
    setCanjesPagina(1);
    setPremiosPagina(1);
    setSeccionActiva('inicio');
  }, [negocioMostrado?.id]);

  useEffect(() => {
    cargarClientes(negocioMostrado?.id, clientesPagina);
  }, [negocioMostrado?.id, clientesPagina]);

  useEffect(() => {
    if (seccionActiva !== 'canjes') return;
    cargarCanjes(negocioMostrado?.id, canjesPagina);
  }, [negocioMostrado?.id, canjesPagina, seccionActiva]);

  useEffect(() => {
    if (seccionActiva !== 'premios') return;
    cargarPremios(negocioMostrado?.id, premiosPagina);
  }, [negocioMostrado?.id, premiosPagina, seccionActiva]);

  // Al entrar a Integraciones se precarga lo que ya está cargado
  // (tiendanubeAccessToken nunca viaja del backend, ese campo arranca vacío)
  useEffect(() => {
    if (seccionActiva !== 'integraciones') return;
    setFormIntegraciones({
      tiendanubeStoreId: negocioMostrado?.tiendanubeStoreId || '',
      tiendanubeAccessToken: '',
      slug: negocioMostrado?.slug || '',
      dragonfishBaseDeDatos: negocioMostrado?.dragonfishBaseDeDatos || '',
    });
  }, [negocioMostrado?.id, seccionActiva]);

  // Al entrar a Ajustes se precarga puntosXPeso; la contraseña arranca vacía
  useEffect(() => {
    if (seccionActiva !== 'ajustes') return;
    setFormPuntosXPeso(negocioMostrado?.puntosXPeso ? String(negocioMostrado.puntosXPeso) : '');
    setFormPuntosBienvenida(negocioMostrado?.puntosBienvenida !== undefined ? String(negocioMostrado.puntosBienvenida) : '0');
    setFormPassword({ actual: '', nueva: '', confirmar: '' });
  }, [negocioMostrado?.id, seccionActiva]);

  const pts = Math.floor((parseFloat(monto) || 0) / 1000);

  const sumarPuntos = async (negId) => {
    if (!monto || !clienteSeleccionado) { mostrarToast('error', 'Seleccioná un cliente y un monto'); return; }
    const negocio = isAdmin ? negocioActivo : negocioPropio;
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: clienteSeleccionado, monto: parseFloat(monto), negocioId: negocio.id })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudieron sumar los puntos');
        return;
      }
      mostrarToast('exito', `+${data.puntosASumados} puntos acreditados a ${negocio.clientes.find(c => c.id === clienteSeleccionado)?.nombre}`);
      setMonto('');
      setClienteSeleccionado('');
      cargarNegocios();
      cargarEstadisticas(negocio.id);
      cargarClientes(negocio.id, clientesPagina);
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al sumar los puntos. Probá de nuevo.');
    }
  };

  const agregarCliente = async () => {
    const negocio = isAdmin ? negocioActivo : negocioPropio;
    if (!nuevoCliente.nombre || !nuevoCliente.telefono || !nuevoCliente.email) {
      mostrarToast('error', 'Nombre, teléfono y email son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoCliente, negocioId: negocio.id })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo crear el cliente');
        return;
      }
      // Alert bloqueante a propósito (no toast): incluye la contraseña
      // generada, que hay que copiar antes de que desaparezca.
      alert(`✅ Cliente ${nuevoCliente.nombre} agregado!\n\nEmail: ${nuevoCliente.email}\nContraseña: ${data.passwordGenerada}\n\n(Guardá esta contraseña para pasársela al cliente)`);
      setNuevoCliente({ nombre: '', telefono: '', email: '' });
      setMostrarFormCliente(false);
      cargarNegocios();
      cargarEstadisticas(negocio.id);
      cargarClientes(negocio.id, 1);
      setClientesPagina(1);
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al crear el cliente. Probá de nuevo.');
    }
  };

  const crearNegocio = async () => {
    const { nombre, tipo, ciudad, emoji, email } = nuevoNegocio;
    if (!nombre || !tipo || !ciudad || !emoji || !email) {
      mostrarToast('error', 'Nombre, tipo, ciudad, emoji y email son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoNegocio)
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo crear el negocio');
        return;
      }
      // Alert bloqueante a propósito (no toast): incluye la contraseña
      // generada, que hay que copiar antes de que desaparezca.
      alert(`✅ Negocio ${nombre} creado!\n\nEmail: ${email}\nContraseña: ${data.passwordGenerada}\n\n(Guardá esta contraseña para pasársela al negocio)`);
      setNuevoNegocio({ nombre: '', tipo: '', ciudad: '', emoji: '', email: '' });
      setMostrarFormNegocio(false);
      cargarNegocios();
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al crear el negocio. Probá de nuevo.');
    }
  };

  const iniciarEdicionNegocio = (neg) => {
    setNegocioEditandoId(neg.id);
    setFormEdicionNegocio({ nombre: neg.nombre, tipo: neg.tipo, ciudad: neg.ciudad, emoji: neg.emoji, tema: { ...TEMA_DEFAULT, ...(neg.tema || {}) } });
  };

  const guardarEdicionNegocio = async () => {
    const { nombre, tipo, ciudad, emoji } = formEdicionNegocio;
    if (!nombre || !tipo || !ciudad || !emoji) {
      mostrarToast('error', 'Nombre, tipo, ciudad y emoji son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioEditandoId, ...formEdicionNegocio })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo editar el negocio');
        return;
      }
      mostrarToast('exito', 'Negocio actualizado');
      setNegocioEditandoId(null);
      cargarNegocios();
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al editar el negocio. Probá de nuevo.');
    }
  };

  const toggleNegocioActivo = async (neg) => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: neg.id, activo: !neg.activo })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo actualizar el negocio'}`);
        return;
      }
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al actualizar el negocio. Probá de nuevo.');
    }
  };

  // El admin vuelve de un negocio puntual a la grilla general
  const volverANegocios = () => {
    setNegocioActivo(null);
    setMostrarFormCliente(false);
    setSeccionActiva('inicio');
  };

  const crearPremio = async () => {
    const negocio = isAdmin ? negocioActivo : negocioPropio;
    const { nombre, puntos, emoji } = nuevoPremio;
    if (!nombre || !puntos || !emoji) {
      alert('Nombre, puntos y emoji son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/premios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevoPremio, negocioId: negocio.id })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo crear el premio'}`);
        return;
      }
      setNuevoPremio({ nombre: '', puntos: '', emoji: '' });
      setMostrarFormPremio(false);
      cargarPremios(negocio.id, premiosPagina);
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al crear el premio. Probá de nuevo.');
    }
  };

  const iniciarEdicionPremio = (p) => {
    setPremioEditandoId(p.id);
    setFormEdicionPremio({ nombre: p.nombre, puntos: p.puntos, emoji: p.emoji });
  };

  const guardarEdicionPremio = async () => {
    const { nombre, puntos, emoji } = formEdicionPremio;
    if (!nombre || !puntos || !emoji) {
      mostrarToast('error', 'Nombre, puntos y emoji son obligatorios');
      return;
    }
    try {
      const res = await fetch('/api/premios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: premioEditandoId, ...formEdicionPremio })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo editar el premio');
        return;
      }
      mostrarToast('exito', 'Premio actualizado');
      setPremioEditandoId(null);
      cargarPremios((isAdmin ? negocioActivo : negocioPropio)?.id, premiosPagina);
      cargarNegocios();
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al editar el premio. Probá de nuevo.');
    }
  };

  // Desactivar un premio no lo borra: lo saca de "Premios disponibles" del
  // cliente y de nuevos canjes, pero conserva el historial de canjes previos.
  const togglePremioActivo = async (p) => {
    try {
      const res = await fetch('/api/premios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, activo: !p.activo })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo actualizar el premio'}`);
        return;
      }
      cargarPremios((isAdmin ? negocioActivo : negocioPropio)?.id, premiosPagina);
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al actualizar el premio. Probá de nuevo.');
    }
  };

  const guardarIntegraciones = async () => {
    const negocio = negocioMostrado;
    const body = { id: negocio.id };
    // Solo se manda lo que se tipeó: si el Access Token queda en blanco no
    // hay que pisar el que ya está guardado.
    if (formIntegraciones.tiendanubeStoreId) body.tiendanubeStoreId = formIntegraciones.tiendanubeStoreId;
    if (formIntegraciones.tiendanubeAccessToken) body.tiendanubeAccessToken = formIntegraciones.tiendanubeAccessToken;
    if (formIntegraciones.slug) body.slug = formIntegraciones.slug;
    if (formIntegraciones.dragonfishBaseDeDatos) body.dragonfishBaseDeDatos = formIntegraciones.dragonfishBaseDeDatos;

    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      alert('✅ Integraciones actualizadas');
      setFormIntegraciones(f => ({ ...f, tiendanubeAccessToken: '' }));
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar las integraciones. Probá de nuevo.');
    }
  };

  // Genera (o regenera) el token secreto que usa el agente local de Dragon
  // Fish para autenticarse contra Fideliza. Se muestra una sola vez, igual
  // que una contraseña generada: no hay forma de volver a verlo después.
  // Acción separada de "Guardar integraciones" a propósito, para no
  // regenerar el token sin querer y cortar la conexión de un agente que ya
  // está corriendo.
  const generarTokenDragonfish = async () => {
    if (negocioMostrado?.dragonfishConectado && !confirm('Ya hay un token generado. Generar uno nuevo va a desconectar al agente que esté usando el actual hasta que lo actualices ahí también. ¿Continuar?')) {
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, dragonfishGenerarToken: true })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo generar el token'}`);
        return;
      }
      alert(`✅ Token generado, copialo ahora — no se vuelve a mostrar:\n\n${data.dragonfishAgentTokenGenerado}`);
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al generar el token. Probá de nuevo.');
    }
  };

  const guardarPuntosXPeso = async () => {
    if (!formPuntosXPeso || parseInt(formPuntosXPeso) <= 0) {
      alert('Puntos por peso tiene que ser un número entero mayor a 0');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, puntosXPeso: formPuntosXPeso })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      alert('✅ Puntos por peso actualizados');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarPuntosBienvenida = async () => {
    if (formPuntosBienvenida === '' || parseInt(formPuntosBienvenida) < 0) {
      alert('Puntos de bienvenida tiene que ser un número entero mayor o igual a 0');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, puntosBienvenida: formPuntosBienvenida })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      alert('✅ Puntos de bienvenida actualizados');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const cambiarPassword = async () => {
    const { actual, nueva, confirmar } = formPassword;
    if (!actual || !nueva || !confirmar) {
      mostrarToast('error', 'Completá los tres campos');
      return;
    }
    if (nueva !== confirmar) {
      mostrarToast('error', 'La nueva contraseña y su confirmación no coinciden');
      return;
    }
    try {
      const res = await fetch('/api/negocios/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordActual: actual, passwordNueva: nueva })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo cambiar la contraseña');
        return;
      }
      mostrarToast('exito', 'Contraseña actualizada');
      setFormPassword({ actual: '', nueva: '', confirmar: '' });
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al cambiar la contraseña. Probá de nuevo.');
    }
  };

  // El cliente canjea un premio para sí mismo (el backend ya valida que
  // tenga puntos suficientes y que el canje sea siempre a su propio nombre)
  const canjearPremio = async (premio) => {
    setCanjeandoId(premio.id);
    try {
      const res = await fetch('/api/canjes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premioId: premio.id })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo canjear el premio');
        return;
      }
      // Alert bloqueante a propósito (no toast): funciona como comprobante,
      // la clienta lo tiene que poder mostrar en el negocio, no que
      // desaparezca solo.
      alert(`✅ ¡Canjeaste "${premio.nombre}"! Mostrale esto al negocio para retirarlo.`);
      cargarNegocios();
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al canjear el premio.');
    } finally {
      setCanjeandoId(null);
    }
  };

  // Controles de "Anterior / Página X de Y / Siguiente", reutilizados en Clientes y Canjes
  const Paginador = ({ pagina, totalPages, onCambiar }) => {
    if (!totalPages || totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
        <button
          className="fid-btn-secondary"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina <= 1}
          style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, fontSize: 12, cursor: pagina <= 1 ? 'not-allowed' : 'pointer', opacity: pagina <= 1 ? 0.5 : 1 }}
        >← Anterior</button>
        <span style={{ fontSize: 12, color: tema.textoSecundario }}>Página {pagina} de {totalPages}</span>
        <button
          className="fid-btn-secondary"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina >= totalPages}
          style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, fontSize: 12, cursor: pagina >= totalPages ? 'not-allowed' : 'pointer', opacity: pagina >= totalPages ? 0.5 : 1 }}
        >Siguiente →</button>
      </div>
    );
  };

  // Ícono girando para estados de carga breves (listas, estadísticas).
  // Usa currentColor (heredado del `style.color` que se le pase) para andar
  // bien con cualquier tema de marca propia.
  const Spinner = ({ size = 16, color }) => (
    <span className="fid-spinner" style={{ width: size, height: size, color: color || tema.primario }} />
  );

  // Confirmación visual breve para acciones que se guardan bien o fallan.
  // Colores fijos (no atados a `tema`) para verse igual en el chrome del
  // Admin, que nunca se tematiza, y en los paneles de negocio/cliente.
  // No se usa para mensajes de éxito que hay que conservar (contraseña
  // generada al crear cliente/negocio, comprobante de canje) — esos siguen
  // siendo un alert() bloqueante a propósito, en vez de este toast que
  // desaparece solo.
  const mostrarToast = (tipo, mensaje) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ tipo, mensaje });
    toastTimeoutRef.current = setTimeout(() => setToast(null), tipo === 'error' ? 4000 : 2500);
  };

  const Toast = () => {
    if (!toast) return null;
    const exito = toast.tipo === 'exito';
    return (
      <div
        style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10,
          background: exito ? '#dcfce7' : '#fee2e2', color: exito ? '#15803d' : '#b91c1c',
          border: `1px solid ${exito ? '#86efac' : '#fca5a5'}`,
          fontSize: 14, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          maxWidth: '90vw'
        }}
        className="fid-toast"
      >
        {exito ? '✓' : '✗'} {toast.mensaje}
      </div>
    );
  };

  // Historial de canjes del negocio completo (pantalla nueva)
  const VistaCanjes = () => (
    <div style={{ padding: 24 }}>
      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Historial de canjes</div>
        {!canjesData && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tema.textoSecundario }}><Spinner size={14} /> Cargando...</div>}
        {canjesData && canjesData.items.length === 0 && <div style={{ fontSize: 13, color: tema.textoSecundario }}>Todavía no hay canjes.</div>}
        {canjesData?.items.map(c => (
          <div key={c.id} className="fid-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${tema.borde}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{c.premio.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.premio.nombre}</div>
              <div style={{ fontSize: 11, color: tema.textoSecundario }}>{c.cliente.nombre || c.cliente.email} · {new Date(c.createdAt).toLocaleDateString('es-AR')}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, background: tema.resaltado, color: tema.texto, padding: '4px 10px', borderRadius: 20 }}>
              {c.premio.puntos} pts
            </div>
          </div>
        ))}
        <Paginador pagina={canjesData?.page || 1} totalPages={canjesData?.totalPages} onCambiar={setCanjesPagina} />
      </div>
    </div>
  );

  // Listado completo de clientes del negocio (pantalla nueva)
  const VistaClientes = () => (
    <div style={{ padding: 24 }}>
      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clientes</div>
        {!clientesData && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tema.textoSecundario }}><Spinner size={14} /> Cargando...</div>}
        {clientesData && clientesData.items.length === 0 && <div style={{ fontSize: 13, color: tema.textoSecundario }}>Todavía no hay clientes.</div>}
        {clientesData?.items.map(c => (
          <div key={c.id} className="fid-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${tema.borde}` }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: tema.resaltado, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: tema.texto }}>
              {(c.nombre || c.email).slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre || c.email}</div>
              <div style={{ fontSize: 11, color: tema.textoSecundario }}>{c.email}{c.telefono ? ` · ${c.telefono}` : ''}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, background: tema.resaltado, color: tema.texto, padding: '4px 10px', borderRadius: 20 }}>
              {c.puntos} pts
            </div>
          </div>
        ))}
        <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
      </div>
    </div>
  );

  // Alta, edición y activar/desactivar premios del negocio (pantalla nueva)
  const VistaPremios = () => (
    <div style={{ padding: 24 }}>
      {mostrarFormPremio && (
        <div style={{ marginBottom: 20, background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.primario}`, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuevo premio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Nombre *</label>
              <input value={nuevoPremio.nombre} onChange={e => setNuevoPremio({...nuevoPremio, nombre: e.target.value})} placeholder="Café gratis" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Puntos *</label>
              <input type="number" value={nuevoPremio.puntos} onChange={e => setNuevoPremio({...nuevoPremio, puntos: e.target.value})} placeholder="100" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Emoji *</label>
              <input value={nuevoPremio.emoji} onChange={e => setNuevoPremio({...nuevoPremio, emoji: e.target.value})} placeholder="☕" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fid-btn-primary" onClick={crearPremio} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar premio</button>
            <button className="fid-btn-secondary" onClick={() => setMostrarFormPremio(false)} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Premios</div>
        {!premiosData && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tema.textoSecundario }}><Spinner size={14} /> Cargando...</div>}
        {premiosData && premiosData.items.length === 0 && <div style={{ fontSize: 13, color: tema.textoSecundario }}>Todavía no hay premios.</div>}
        {premiosData?.items.map(p => (
          <div key={p.id} className="fid-row-hover" style={{ padding: '10px 0', borderBottom: `1px solid ${tema.borde}`, opacity: p.activo ? 1 : 0.6 }}>
            {premioEditandoId === p.id ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px auto', gap: 10, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Nombre</label>
                  <input value={formEdicionPremio.nombre} onChange={e => setFormEdicionPremio({...formEdicionPremio, nombre: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Puntos</label>
                  <input type="number" value={formEdicionPremio.puntos} onChange={e => setFormEdicionPremio({...formEdicionPremio, puntos: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Emoji</label>
                  <input value={formEdicionPremio.emoji} onChange={e => setFormEdicionPremio({...formEdicionPremio, emoji: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="fid-btn-primary" onClick={guardarEdicionPremio} style={{ fontSize: 12, padding: '8px 14px', borderRadius: 6, border: 'none', background: tema.primario, color: tema.primarioTexto, cursor: 'pointer', fontWeight: 500 }}>Guardar</button>
                  <button className="fid-btn-secondary" onClick={() => setPremioEditandoId(null)} style={{ fontSize: 12, padding: '8px 14px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.textoSecundario, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}{!p.activo && <span style={{ marginLeft: 8, fontSize: 11, color: tema.textoSecundario }}>(desactivado)</span>}</div>
                  <div style={{ fontSize: 11, color: tema.textoSecundario }}>{p.puntos} puntos</div>
                </div>
                <button className="fid-btn-secondary" onClick={() => iniciarEdicionPremio(p)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.textoSecundario, cursor: 'pointer' }}>Editar</button>
                <button className="fid-btn-secondary" onClick={() => togglePremioActivo(p)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, color: p.activo ? '#ef4444' : '#16a34a', cursor: 'pointer' }}>{p.activo ? 'Desactivar' : 'Reactivar'}</button>
              </div>
            )}
          </div>
        ))}
        <Paginador pagina={premiosData?.page || 1} totalPages={premiosData?.totalPages} onCambiar={setPremiosPagina} />
      </div>
    </div>
  );

  // Badge "Conectada"/"No conectada" reutilizado en cada integración
  const BadgeConexion = ({ conectada }) => (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: conectada ? '#dcfce7' : '#f5f5f5', color: conectada ? '#16a34a' : '#999' }}>
      {conectada ? 'Conectada' : 'No conectada'}
    </span>
  );

  // Alta/edición de las integraciones del negocio (Tiendanube, Mercado Pago,
  // Dragon Fish)
  const VistaIntegraciones = () => (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 640 }}>
      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Tiendanube</div>
          <BadgeConexion conectada={negocioMostrado?.tiendanubeConectado} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Store ID</label>
            <input value={formIntegraciones.tiendanubeStoreId} onChange={e => setFormIntegraciones({...formIntegraciones, tiendanubeStoreId: e.target.value})} placeholder="123456" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Access Token</label>
            <input type="password" value={formIntegraciones.tiendanubeAccessToken} onChange={e => setFormIntegraciones({...formIntegraciones, tiendanubeAccessToken: e.target.value})} placeholder={negocioMostrado?.tiendanubeConectado ? '•••••••• (ya cargado)' : 'Pegar token acá'} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Mercado Pago</div>
          <BadgeConexion conectada={!!negocioMostrado?.slug} />
        </div>
        <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Identificador del negocio (slug)</label>
        <input value={formIntegraciones.slug} onChange={e => setFormIntegraciones({...formIntegraciones, slug: e.target.value})} placeholder="mi-negocio" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: tema.textoSecundario, marginTop: 6 }}>Solo minúsculas, números y guiones. Cambiarlo rompe links de pago ya compartidos.</div>
      </div>

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Dragon Fish</div>
          <BadgeConexion conectada={negocioMostrado?.dragonfishConectado} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Base de datos (nombre en Dragon Fish)</label>
          <input value={formIntegraciones.dragonfishBaseDeDatos} onChange={e => setFormIntegraciones({...formIntegraciones, dragonfishBaseDeDatos: e.target.value})} placeholder="PEPERINA" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <button className="fid-btn-secondary" onClick={generarTokenDragonfish} type="button" style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          {negocioMostrado?.dragonfishConectado ? 'Regenerar token del agente' : 'Generar token del agente'}
        </button>
        <div style={{ fontSize: 11, color: tema.textoSecundario, marginTop: 8 }}>El token se usa para configurar el agente local que corre en la PC del negocio — se muestra una sola vez al generarlo.</div>
      </div>

      <button className="fid-btn-primary" onClick={guardarIntegraciones} style={{ padding: '10px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar integraciones</button>
    </div>
  );

  // Cuenta del negocio: cambio de contraseña y configuración de puntos
  const VistaAjustes = () => (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 480 }}>
      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cuenta</div>
        <div style={{ fontSize: 13, color: tema.textoSecundario }}>Email de acceso: <strong>{session?.user?.email}</strong></div>
      </div>

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cambiar contraseña</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Contraseña actual</label>
          <input type="password" value={formPassword.actual} onChange={e => setFormPassword({...formPassword, actual: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Nueva contraseña</label>
            <input type="password" value={formPassword.nueva} onChange={e => setFormPassword({...formPassword, nueva: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Confirmar nueva contraseña</label>
            <input type="password" value={formPassword.confirmar} onChange={e => setFormPassword({...formPassword, confirmar: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button className="fid-btn-primary" onClick={cambiarPassword} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Cambiar contraseña</button>
      </div>

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Puntos por peso</div>
        <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Cuántos pesos gastados equivalen a 1 punto</label>
        <input type="number" min="1" value={formPuntosXPeso} onChange={e => setFormPuntosXPeso(e.target.value)} placeholder="1000" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
        <button className="fid-btn-primary" onClick={guardarPuntosXPeso} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar</button>
      </div>

      <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Bono de bienvenida</div>
        <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Puntos de regalo al registrarse un cliente nuevo (0 = sin bono)</label>
        <input type="number" min="0" value={formPuntosBienvenida} onChange={e => setFormPuntosBienvenida(e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
        <button className="fid-btn-primary" onClick={guardarPuntosBienvenida} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar</button>
      </div>
    </div>
  );

  // Ajustes del panel Admin: solo datos de cuenta de lectura por ahora, sin tema (el chrome del Admin nunca se tematiza)
  const VistaAjustesAdmin = () => (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Ajustes</div>
      </div>
      <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 480 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cuenta</div>
          <div style={{ fontSize: 13, color: '#555' }}>Email de acceso: <strong>{session?.user?.email}</strong></div>
        </div>
      </div>
    </div>
  );

  // Panel del negocio (compartido entre admin viendo un negocio y el negocio logueado)
  const PanelNegocio = ({ negocio, onVolver }) => (
    <div style={{ flex: 1, overflow: 'auto', background: tema.fondo, color: tema.texto }}>
      {tema.imagenPortada && (
        <img src={tema.imagenPortada} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: '14px 24px', background: tema.superficie, borderBottom: `1px solid ${tema.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, fontFamily: tema.fuenteTitulo }}>Bienvenida, {negocio.nombre} {negocio.emoji}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onVolver && <button className="fid-btn-secondary" onClick={onVolver} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, fontSize: 12, cursor: 'pointer' }}>← Volver</button>}
          {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && <button className="fid-btn-primary" onClick={() => setMostrarFormCliente(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 12, cursor: 'pointer' }}>+ Nuevo cliente</button>}
          {seccionActiva === 'premios' && <button className="fid-btn-primary" onClick={() => setMostrarFormPremio(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 12, cursor: 'pointer' }}>+ Nuevo premio</button>}
        </div>
      </div>

      {seccionActiva === 'canjes' && VistaCanjes()}
      {seccionActiva === 'clientes' && VistaClientes()}
      {seccionActiva === 'premios' && VistaPremios()}
      {seccionActiva === 'integraciones' && VistaIntegraciones()}
      {seccionActiva === 'ajustes' && VistaAjustes()}

      {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && mostrarFormCliente && (
        <div style={{ margin: '20px 24px 0', background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.primario}`, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agregar nuevo cliente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Nombre *</label>
              <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} placeholder="María González" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Teléfono *</label>
              <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} placeholder="2324123456" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Email (opcional)</label>
              <input value={nuevoCliente.email} onChange={e => setNuevoCliente({...nuevoCliente, email: e.target.value})} placeholder="maria@email.com" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fid-btn-primary" onClick={agregarCliente} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar cliente</button>
            <button className="fid-btn-secondary" onClick={() => setMostrarFormCliente(false)} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {seccionActiva === 'inicio' && <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Clientes activos</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.clientes?.length || 0}</div>
          </div>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Premios configurados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.premios?.length || 0}</div>
          </div>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Puntos en circulación</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.clientes?.reduce((a, c) => a + c.puntos, 0) || 0}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: tema.textoSecundario, fontWeight: 500, marginBottom: 8 }}>Este mes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Clientes activos</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas ? estadisticas.clientesActivos : <Spinner size={18} />}</div>
          </div>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Puntos otorgados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas ? estadisticas.puntosOtorgadosEsteMes : <Spinner size={18} />}</div>
          </div>
          <div style={{ background: tema.superficie, borderRadius: 12, padding: 16, border: `1px solid ${tema.borde}` }}>
            <div style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Canjes realizados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas ? estadisticas.canjesEsteMes : <Spinner size={18} />}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clientes</div>
              {!clientesData && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tema.textoSecundario }}><Spinner size={14} /> Cargando...</div>}
              {clientesData && clientesData.items.length === 0 && <div style={{ fontSize: 13, color: tema.textoSecundario }}>Aún no hay clientes</div>}
              {clientesData?.items.map(c => (
                <div key={c.id} className="fid-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${tema.borde}` }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: tema.resaltado, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: tema.texto }}>
                    {c.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.email}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, background: tema.resaltado, color: tema.texto, padding: '4px 10px', borderRadius: 20 }}>
                    {c.puntos} pts
                  </div>
                </div>
              ))}
              <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
            </div>
          </div>

          <div>
            <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Premios configurados</div>
              {negocio.premios?.map(p => (
                <div key={p.id} className="fid-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: tema.textoSecundario }}>{p.puntos} puntos</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: tema.superficie, borderRadius: 12, border: `1px solid ${tema.borde}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Registrar compra manual</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Cliente</label>
                <select value={clienteSeleccionado} onChange={e => setClienteSeleccionado(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13 }}>
                  <option value="">Seleccionar cliente...</option>
                  {negocio.clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.puntos} pts)</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: tema.textoSecundario, display: 'block', marginBottom: 4 }}>Monto de la compra</label>
                <input type="number" placeholder="$0" value={monto} onChange={e => setMonto(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: tema.texto, fontSize: 13 }} />
              </div>
              {pts > 0 && <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 12, fontWeight: 500 }}>+{pts} puntos a acreditar</div>}
              <button className="fid-btn-primary" onClick={sumarPuntos} style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Sumar puntos</button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );

  // Panel del cliente (vista mobile-friendly, solo lectura)
  const PanelCliente = () => {
    if (!clientePropio || !negocioDelCliente) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: '100vh', color: tema.textoSecundario, fontFamily: 'system-ui' }}>
          {negocios.length === 0 ? <><Spinner size={16} /> Cargando...</> : 'No encontramos tus datos de cliente.'}
        </div>
      );
    }

    const premiosDisponibles = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos >= p.puntos);
    const premiosBloqueados = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos < p.puntos);

    return (
      <div style={{ minHeight: '100vh', background: tema.fondo, color: tema.texto, fontFamily: 'system-ui', maxWidth: 480, margin: '0 auto' }}>
        {tema.imagenPortada && (
          <img src={tema.imagenPortada} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '20px 20px 16px', background: tema.superficie, borderBottom: `1px solid ${tema.borde}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: tema.fuenteTitulo }}>Hola, {clientePropio.nombre ? clientePropio.nombre.split(' ')[0] : clientePropio.email.split('@')[0]} 👋</div>
            <div style={{ fontSize: 12, color: tema.textoSecundario }}>{negocioDelCliente.nombre} {negocioDelCliente.emoji}</div>
          </div>
          <button className="fid-btn-secondary" onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: `1px solid ${tema.borde}`, background: tema.superficie, color: '#ef4444', cursor: 'pointer' }}>Salir</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ background: tema.primario, borderRadius: 16, padding: 24, color: tema.primarioTexto, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Tus puntos</div>
            <div style={{ fontSize: 40, fontWeight: 700, fontFamily: tema.fuenteTitulo }}>{clientePropio.puntos}</div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Premios disponibles</div>
          {premiosDisponibles.length === 0 && (
            <div style={{ fontSize: 13, color: tema.textoSecundario, marginBottom: 16 }}>Todavía no llegás a ningún premio.</div>
          )}
          {premiosDisponibles.map(p => (
            <div key={p.id} className="fid-card-hover" style={{ background: tema.superficie, border: '1px solid #22c55e', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: '#16a34a' }}>{p.puntos} puntos</div>
              </div>
              <button
                className="fid-btn-primary"
                onClick={() => canjearPremio(p)}
                disabled={canjeandoId === p.id}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: canjeandoId === p.id ? 'not-allowed' : 'pointer', opacity: canjeandoId === p.id ? 0.7 : 1 }}
              >
                {canjeandoId === p.id ? 'Canjeando...' : 'Canjear'}
              </button>
            </div>
          ))}

          <div style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 10px' }}>Próximos premios</div>
          {premiosBloqueados.map(p => (
            <div key={p.id} style={{ background: tema.superficie, border: `1px solid ${tema.borde}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, opacity: 0.7 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: tema.textoSecundario }}>Te faltan {p.puntos - clientePropio.puntos} puntos</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>

      {/* PANEL ADMIN */}
      {isAdmin && (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <div style={{ width: 210, background: '#fff', borderRight: '1px solid #eee', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>Fideliza</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Panel de administrador</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio', 'inicio'], ['🏪', 'Negocios', 'negocios'], ['👥', 'Clientes', 'clientes'], ['⭐', 'Puntos y canjes', 'canjes'], ['🔌', 'Integraciones', 'integraciones'], ['⚙️', 'Ajustes', 'ajustes']].map(([icon, label, id]) => {
                const activo = id === 'negocios' ? !negocioActivo : (!!id && seccionActiva === id);
                return (
                  <div
                    key={label}
                    className={id ? 'fid-sidebar-item' : undefined}
                    onClick={id ? () => (id === 'negocios' ? volverANegocios() : setSeccionActiva(id)) : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: activo ? '#6366f1' : '#555', background: activo ? '#eef2ff' : undefined, cursor: id ? 'pointer' : 'default', marginBottom: 2 }}
                  >
                    {icon} {label}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', fontSize: 12, color: '#999' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>C</div>
                {session?.user?.name} · Admin
              </div>
              <button className="fid-btn-secondary" onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#ef4444', cursor: 'pointer', width: '100%' }}>Cerrar sesión</button>
            </div>
          </div>

          {!negocioActivo && seccionActiva !== 'inicio' && seccionActiva !== 'negocios' && seccionActiva !== 'ajustes' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#999' }}>
              <div style={{ fontSize: 14 }}>Elegí un negocio para ver sus {seccionActiva}</div>
              <button className="fid-btn-primary" onClick={() => setSeccionActiva('negocios')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Ver negocios</button>
            </div>
          ) : !negocioActivo && seccionActiva === 'ajustes' ? (
            VistaAjustesAdmin()
          ) : !negocioActivo ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Inicio</div>
                <button className="fid-btn-secondary" onClick={() => setMostrarFormNegocio(true)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>+ Nuevo negocio</button>
              </div>
              {mostrarFormNegocio && (
                <div style={{ margin: '20px 24px 0', background: '#fff', borderRadius: 12, border: '1px solid #6366f1', padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuevo negocio</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Nombre *</label>
                      <input value={nuevoNegocio.nombre} onChange={e => setNuevoNegocio({...nuevoNegocio, nombre: e.target.value})} placeholder="Café Central" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Tipo *</label>
                      <input value={nuevoNegocio.tipo} onChange={e => setNuevoNegocio({...nuevoNegocio, tipo: e.target.value})} placeholder="Cafetería" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Ciudad *</label>
                      <input value={nuevoNegocio.ciudad} onChange={e => setNuevoNegocio({...nuevoNegocio, ciudad: e.target.value})} placeholder="Chacabuco" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Emoji *</label>
                      <input value={nuevoNegocio.emoji} onChange={e => setNuevoNegocio({...nuevoNegocio, emoji: e.target.value})} placeholder="☕" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Email *</label>
                      <input value={nuevoNegocio.email} onChange={e => setNuevoNegocio({...nuevoNegocio, email: e.target.value})} placeholder="negocio@email.com" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="fid-btn-primary" onClick={crearNegocio} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar negocio</button>
                    <button className="fid-btn-secondary" onClick={() => setMostrarFormNegocio(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Negocios activos</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{loading ? <Spinner size={18} color="#6366f1" /> : negocios.filter(n => n.activo).length}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Clientes registrados</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{loading ? <Spinner size={18} color="#6366f1" /> : negocios.reduce((acc, n) => acc + (n.clientes?.length || 0), 0)}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Puntos en circulación</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{loading ? <Spinner size={18} color="#6366f1" /> : negocios.reduce((acc, n) => acc + (n.clientes?.reduce((a, c) => a + c.puntos, 0) || 0), 0)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Mis negocios</div>
                {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#999' }}><Spinner size={14} color="#6366f1" /> Cargando...</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {negocios.map((neg, i) => (
                    <div key={neg.id} className="fid-card-hover" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 }}>
                      {negocioEditandoId === neg.id ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Editar negocio</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Nombre</label>
                              <input value={formEdicionNegocio.nombre} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, nombre: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Emoji</label>
                              <input value={formEdicionNegocio.emoji} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, emoji: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Tipo</label>
                              <input value={formEdicionNegocio.tipo} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tipo: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Ciudad</label>
                              <input value={formEdicionNegocio.ciudad} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, ciudad: e.target.value})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Colores de marca (panel del negocio y de sus clientes)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                            {[
                              ['fondo', 'Fondo'],
                              ['superficie', 'Tarjetas'],
                              ['borde', 'Bordes'],
                              ['texto', 'Texto'],
                              ['textoSecundario', 'Texto secund.'],
                              ['primario', 'Acento'],
                              ['primarioTexto', 'Texto s/ acento'],
                              ['resaltado', 'Resaltado (chips)'],
                            ].map(([clave, etiqueta]) => (
                              <div key={clave}>
                                <label style={{ fontSize: 10, color: '#555', display: 'block', marginBottom: 4 }}>{etiqueta}</label>
                                <input type="color" value={formEdicionNegocio.tema[clave]} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, [clave]: e.target.value}})} style={{ width: '100%', height: 28, padding: 0, borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer' }} />
                              </div>
                            ))}
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 10, color: '#555', display: 'block', marginBottom: 4 }}>Tipografía de títulos (ej: Georgia, serif)</label>
                            <input value={formEdicionNegocio.tema.fuenteTitulo} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, fuenteTitulo: e.target.value}})} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 10, color: '#555', display: 'block', marginBottom: 4 }}>Imagen de portada (URL, tipo muro de Facebook)</label>
                            <input value={formEdicionNegocio.tema.imagenPortada} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, imagenPortada: e.target.value}})} placeholder="https://..." style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="fid-btn-primary" onClick={guardarEdicionNegocio} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Guardar</button>
                            <button className="fid-btn-secondary" onClick={() => setNegocioEditandoId(null)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FBEAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{neg.emoji}</div>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: neg.activo ? '#dcfce7' : '#f3f4f6', color: neg.activo ? '#16a34a' : '#999', fontWeight: 500 }}>{neg.activo ? 'Activo' : 'Inactivo'}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{neg.nombre}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{neg.tipo} · {neg.ciudad}</div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                            <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.clientes?.length || 0}</strong> clientes</span>
                            <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.premios?.length || 0}</strong> premios</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="fid-btn-primary" onClick={() => { setNegocioActivo(neg); setMostrarFormCliente(false); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#eef2ff', color: '#6366f1', cursor: 'pointer' }}>Ver panel</button>
                            <button className="fid-btn-secondary" onClick={() => iniciarEdicionNegocio(neg)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Editar</button>
                            <button className="fid-btn-secondary" onClick={() => toggleNegocioActivo(neg)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: neg.activo ? '#ef4444' : '#16a34a', cursor: 'pointer' }}>{neg.activo ? 'Desactivar' : 'Reactivar'}</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            PanelNegocio({ negocio: negocioActivo, onVolver: volverANegocios })
          )}
        </div>
      )}

      {/* PANEL NEGOCIO */}
      {isNegocio && (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <div style={{ width: 210, background: tema.superficie, color: tema.texto, borderRight: `1px solid ${tema.borde}`, padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${tema.borde}` }}>
              <div style={{ fontSize: 17, fontWeight: 600, fontFamily: tema.fuenteTitulo }}>{negocioPropio?.nombre || session?.user?.name}</div>
              <div style={{ fontSize: 11, color: tema.textoSecundario, marginTop: 2 }}>Panel del negocio</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio', 'inicio'], ['👥', 'Mis clientes', 'clientes'], ['🎁', 'Premios', 'premios'], ['🔄', 'Canjes', 'canjes'], ['🔌', 'Integraciones', 'integraciones'], ['⚙️', 'Ajustes', 'ajustes']].map(([icon, label, id]) => (
                <div
                  key={label}
                  className={id ? 'fid-sidebar-item' : undefined}
                  onClick={id ? () => setSeccionActiva(id) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: seccionActiva === id ? tema.primario : tema.textoSecundario, background: seccionActiva === id ? tema.borde : undefined, cursor: id ? 'pointer' : 'default', marginBottom: 2 }}
                >
                  {icon} {label}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${tema.borde}`, fontSize: 12, color: tema.textoSecundario }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: tema.resaltado, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: tema.texto }}>
                  {session?.user?.name?.[0] || 'N'}
                </div>
                {session?.user?.name}
              </div>
              <button className="fid-btn-secondary" onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${tema.borde}`, background: tema.superficie, color: '#ef4444', cursor: 'pointer', width: '100%' }}>Cerrar sesión</button>
            </div>
          </div>

          {negocioPropio ? (
            PanelNegocio({ negocio: negocioPropio, onVolver: null })
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#999' }}>
              <Spinner size={16} /> Cargando tu negocio...
            </div>
          )}
        </div>
      )}

      {/* PANEL CLIENTE */}
      {isCliente && PanelCliente()}

      {/* Sin acceso */}
      {!isAdmin && !isNegocio && !isCliente && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, color: '#555' }}>No tenés acceso a este panel.</div>
          <button className="fid-btn-primary" onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cerrar sesión</button>
        </div>
      )}

      <Toast />
    </div>
  );
}