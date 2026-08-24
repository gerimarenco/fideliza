'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

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
  const [formEdicionNegocio, setFormEdicionNegocio] = useState({ nombre: '', tipo: '', ciudad: '', emoji: '' });
  const [clientePropio, setClientePropio] = useState(null);
  const [negocioDelCliente, setNegocioDelCliente] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [generandoPago, setGenerandoPago] = useState(false);
  const [canjeandoId, setCanjeandoId] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [clientesPagina, setClientesPagina] = useState(1);
  const [clientesData, setClientesData] = useState(null);
  const [canjesPagina, setCanjesPagina] = useState(1);
  const [canjesData, setCanjesData] = useState(null);

  const isAdmin = session?.user?.role === 'admin';
  const isNegocio = session?.user?.role === 'negocio';
  const isCliente = session?.user?.role === 'cliente';

  const negocioMostrado = isAdmin ? negocioActivo : (isNegocio ? negocioPropio : null);

  const cargarNegocios = () => {
    fetch('/api/negocios')
      .then(res => res.json())
      .then(data => {
        setNegocios(data);
        if (isAdmin) {
          if (data.length > 0 && !negocioActivo) setNegocioActivo(data[0]);
          else if (negocioActivo) setNegocioActivo(data.find(n => n.id === negocioActivo.id) || data[0]);
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
    if (session) cargarNegocios();
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

  // Al cambiar de negocio, arrancar de nuevo desde la página 1 y desde Inicio
  useEffect(() => {
    setClientesPagina(1);
    setCanjesPagina(1);
    setSeccionActiva('inicio');
  }, [negocioMostrado?.id]);

  useEffect(() => {
    cargarClientes(negocioMostrado?.id, clientesPagina);
  }, [negocioMostrado?.id, clientesPagina]);

  useEffect(() => {
    if (seccionActiva !== 'canjes') return;
    cargarCanjes(negocioMostrado?.id, canjesPagina);
  }, [negocioMostrado?.id, canjesPagina, seccionActiva]);

  const pts = Math.floor((parseFloat(monto) || 0) / 1000);

  const sumarPuntos = async (negId) => {
    if (!monto || !clienteSeleccionado) { alert('Seleccioná un cliente y un monto'); return; }
    const negocio = isAdmin ? negocioActivo : negocioPropio;
    const res = await fetch('/api/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: clienteSeleccionado, monto: parseFloat(monto), negocioId: negocio.id })
    });
    const data = await res.json();
    alert(`✅ +${data.puntosASumados} puntos acreditados a ${negocio.clientes.find(c => c.id === clienteSeleccionado)?.nombre}!`);
    setMonto('');
    setClienteSeleccionado('');
    cargarNegocios();
    cargarEstadisticas(negocio.id);
    cargarClientes(negocio.id, clientesPagina);
  };

  const agregarCliente = async () => {
    const negocio = isAdmin ? negocioActivo : negocioPropio;
    if (!nuevoCliente.nombre || !nuevoCliente.telefono || !nuevoCliente.email) {
      alert('Nombre, teléfono y email son obligatorios');
      return;
    }
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevoCliente, negocioId: negocio.id })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`❌ Error: ${data.error || 'no se pudo crear el cliente'}`);
      return;
    }
    alert(`✅ Cliente ${nuevoCliente.nombre} agregado!\n\nEmail: ${nuevoCliente.email}\nContraseña: ${data.passwordGenerada}\n\n(Guardá esta contraseña para pasársela al cliente)`);
    setNuevoCliente({ nombre: '', telefono: '', email: '' });
    setMostrarFormCliente(false);
    cargarNegocios();
    cargarEstadisticas(negocio.id);
    cargarClientes(negocio.id, 1);
    setClientesPagina(1);
  };

  const crearNegocio = async () => {
    const { nombre, tipo, ciudad, emoji, email } = nuevoNegocio;
    if (!nombre || !tipo || !ciudad || !emoji || !email) {
      alert('Nombre, tipo, ciudad, emoji y email son obligatorios');
      return;
    }
    const res = await fetch('/api/negocios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoNegocio)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`❌ Error: ${data.error || 'no se pudo crear el negocio'}`);
      return;
    }
    alert(`✅ Negocio ${nombre} creado!\n\nEmail: ${email}\nContraseña: ${data.passwordGenerada}\n\n(Guardá esta contraseña para pasársela al negocio)`);
    setNuevoNegocio({ nombre: '', tipo: '', ciudad: '', emoji: '', email: '' });
    setMostrarFormNegocio(false);
    cargarNegocios();
  };

  const iniciarEdicionNegocio = (neg) => {
    setNegocioEditandoId(neg.id);
    setFormEdicionNegocio({ nombre: neg.nombre, tipo: neg.tipo, ciudad: neg.ciudad, emoji: neg.emoji });
  };

  const guardarEdicionNegocio = async () => {
    const { nombre, tipo, ciudad, emoji } = formEdicionNegocio;
    if (!nombre || !tipo || !ciudad || !emoji) {
      alert('Nombre, tipo, ciudad y emoji son obligatorios');
      return;
    }
    const res = await fetch('/api/negocios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: negocioEditandoId, ...formEdicionNegocio })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`❌ Error: ${data.error || 'no se pudo editar el negocio'}`);
      return;
    }
    setNegocioEditandoId(null);
    cargarNegocios();
  };

  // El admin vuelve de un negocio puntual a la grilla general
  const volverANegocios = () => {
    setNegocioActivo(null);
    setMostrarFormCliente(false);
    setSeccionActiva('inicio');
  };

  // Genera el link de pago de Mercado Pago y redirige al cliente ahí
  const iniciarPago = async () => {
    if (!montoPago || parseFloat(montoPago) <= 0) {
      alert('Ingresá un monto válido');
      return;
    }
    if (!negocioDelCliente?.slug) {
      alert('Este negocio todavía no tiene pagos online configurados.');
      return;
    }
    setGenerandoPago(true);
    try {
      const res = await fetch('/api/mercadopago/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocioSlug: negocioDelCliente.slug,
          clienteId: clientePropio.id,
          monto: parseFloat(montoPago),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo generar el pago'}`);
        setGenerandoPago(false);
        return;
      }
      window.location.href = data.init_point;
    } catch (err) {
      alert('❌ Ocurrió un error al generar el pago.');
      setGenerandoPago(false);
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
        alert(`❌ ${data.error || 'No se pudo canjear el premio'}`);
        return;
      }
      alert(`✅ ¡Canjeaste "${premio.nombre}"! Mostrale esto al negocio para retirarlo.`);
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al canjear el premio.');
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
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina <= 1}
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #eee', background: '#fff', fontSize: 12, cursor: pagina <= 1 ? 'not-allowed' : 'pointer', opacity: pagina <= 1 ? 0.5 : 1 }}
        >← Anterior</button>
        <span style={{ fontSize: 12, color: '#555' }}>Página {pagina} de {totalPages}</span>
        <button
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina >= totalPages}
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #eee', background: '#fff', fontSize: 12, cursor: pagina >= totalPages ? 'not-allowed' : 'pointer', opacity: pagina >= totalPages ? 0.5 : 1 }}
        >Siguiente →</button>
      </div>
    );
  };

  // Historial de canjes del negocio completo (pantalla nueva)
  const VistaCanjes = () => (
    <div style={{ padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Historial de canjes</div>
        {!canjesData && <div style={{ fontSize: 13, color: '#999' }}>Cargando...</div>}
        {canjesData && canjesData.items.length === 0 && <div style={{ fontSize: 13, color: '#999' }}>Todavía no hay canjes.</div>}
        {canjesData?.items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{c.premio.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.premio.nombre}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{c.cliente.nombre || c.cliente.email} · {new Date(c.createdAt).toLocaleDateString('es-AR')}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, background: '#eef2ff', color: '#6366f1', padding: '4px 10px', borderRadius: 20 }}>
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
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clientes</div>
        {!clientesData && <div style={{ fontSize: 13, color: '#999' }}>Cargando...</div>}
        {clientesData && clientesData.items.length === 0 && <div style={{ fontSize: 13, color: '#999' }}>Todavía no hay clientes.</div>}
        {clientesData?.items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
              {(c.nombre || c.email).slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre || c.email}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{c.email}{c.telefono ? ` · ${c.telefono}` : ''}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, background: '#eef2ff', color: '#6366f1', padding: '4px 10px', borderRadius: 20 }}>
              {c.puntos} pts
            </div>
          </div>
        ))}
        <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
      </div>
    </div>
  );

  // Panel del negocio (compartido entre admin viendo un negocio y el negocio logueado)
  const PanelNegocio = ({ negocio, onVolver }) => (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Bienvenida, {negocio.nombre} {negocio.emoji}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onVolver && <button onClick={onVolver} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 12, cursor: 'pointer' }}>← Volver</button>}
          {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && <button onClick={() => setMostrarFormCliente(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, cursor: 'pointer' }}>+ Nuevo cliente</button>}
        </div>
      </div>

      {seccionActiva === 'canjes' && <VistaCanjes />}
      {seccionActiva === 'clientes' && <VistaClientes />}

      {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && mostrarFormCliente && (
        <div style={{ margin: '20px 24px 0', background: '#fff', borderRadius: 12, border: '1px solid #6366f1', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agregar nuevo cliente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Nombre *</label>
              <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} placeholder="María González" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Teléfono *</label>
              <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} placeholder="2324123456" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Email (opcional)</label>
              <input value={nuevoCliente.email} onChange={e => setNuevoCliente({...nuevoCliente, email: e.target.value})} placeholder="maria@email.com" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={agregarCliente} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar cliente</button>
            <button onClick={() => setMostrarFormCliente(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {seccionActiva === 'inicio' && <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Clientes activos</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.clientes?.length || 0}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Premios configurados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.premios?.length || 0}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Puntos en circulación</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{negocio.clientes?.reduce((a, c) => a + c.puntos, 0) || 0}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#999', fontWeight: 500, marginBottom: 8 }}>Este mes</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Clientes activos</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas?.clientesActivos ?? '—'}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Puntos otorgados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas?.puntosOtorgadosEsteMes ?? '—'}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Canjes realizados</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{estadisticas?.canjesEsteMes ?? '—'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clientes</div>
              {clientesData && clientesData.items.length === 0 && <div style={{ fontSize: 13, color: '#999' }}>Aún no hay clientes</div>}
              {clientesData?.items.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                    {c.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.email}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, background: '#eef2ff', color: '#6366f1', padding: '4px 10px', borderRadius: 20 }}>
                    {c.puntos} pts
                  </div>
                </div>
              ))}
              <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
            </div>
          </div>

          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Premios configurados</div>
              {negocio.premios?.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{p.puntos} puntos</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Registrar compra manual</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Cliente</label>
                <select value={clienteSeleccionado} onChange={e => setClienteSeleccionado(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                  <option value="">Seleccionar cliente...</option>
                  {negocio.clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.puntos} pts)</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Monto de la compra</label>
                <input type="number" placeholder="$0" value={monto} onChange={e => setMonto(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
              </div>
              {pts > 0 && <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 12, fontWeight: 500 }}>+{pts} puntos a acreditar</div>}
              <button onClick={sumarPuntos} style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Sumar puntos</button>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#999', fontFamily: 'system-ui' }}>
          No encontramos tus datos de cliente.
        </div>
      );
    }

    const premiosDisponibles = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos >= p.puntos);
    const premiosBloqueados = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos < p.puntos);
    const ptsAGanar = Math.floor((parseFloat(montoPago) || 0) / (negocioDelCliente.puntosXPeso || 1000));

    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ padding: '20px 20px 16px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Hola, {clientePropio.nombre ? clientePropio.nombre.split(' ')[0] : clientePropio.email.split('@')[0]} 👋</div>
            <div style={{ fontSize: 12, color: '#999' }}>{negocioDelCliente.nombre} {negocioDelCliente.emoji}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #eee', background: '#fff', color: '#ef4444', cursor: 'pointer' }}>Salir</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ background: '#6366f1', borderRadius: 16, padding: 24, color: '#fff', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Tus puntos</div>
            <div style={{ fontSize: 40, fontWeight: 700 }}>{clientePropio.puntos}</div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Cargar puntos con Mercado Pago</div>
            <input
              type="number"
              placeholder="Monto de tu compra"
              value={montoPago}
              onChange={e => setMontoPago(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }}
            />
            {ptsAGanar > 0 && (
              <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 10, fontWeight: 500 }}>+{ptsAGanar} puntos a sumar</div>
            )}
            <button
              onClick={iniciarPago}
              disabled={generandoPago}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#009ee3', color: '#fff', fontSize: 14, fontWeight: 600, cursor: generandoPago ? 'not-allowed' : 'pointer', opacity: generandoPago ? 0.7 : 1 }}
            >
              {generandoPago ? 'Generando link de pago...' : 'Pagar con Mercado Pago'}
            </button>
          </div>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Premios disponibles</div>
          {premiosDisponibles.length === 0 && (
            <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>Todavía no llegás a ningún premio.</div>
          )}
          {premiosDisponibles.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #22c55e', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: '#16a34a' }}>{p.puntos} puntos</div>
              </div>
              <button
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
            <div key={p.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, opacity: 0.7 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: '#999' }}>Te faltan {p.puntos - clientePropio.puntos} puntos</div>
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
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Panel del negocio</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio', 'inicio'], ['🏪', 'Negocios', 'negocios'], ['👥', 'Clientes', 'clientes'], ['⭐', 'Puntos y canjes', 'canjes'], ['🔌', 'Integraciones', null], ['⚙️', 'Ajustes', null]].map(([icon, label, id]) => {
                const activo = id === 'negocios' ? !negocioActivo : (!!id && seccionActiva === id);
                return (
                  <div
                    key={label}
                    onClick={id ? () => (id === 'negocios' ? volverANegocios() : setSeccionActiva(id)) : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: activo ? '#6366f1' : '#555', background: activo ? '#eef2ff' : 'transparent', cursor: id ? 'pointer' : 'default', marginBottom: 2 }}
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
              <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#ef4444', cursor: 'pointer', width: '100%' }}>Cerrar sesión</button>
            </div>
          </div>

          {!negocioActivo ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Inicio</div>
                <button onClick={() => setMostrarFormNegocio(true)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>+ Nuevo negocio</button>
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
                    <button onClick={crearNegocio} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Guardar negocio</button>
                    <button onClick={() => setMostrarFormNegocio(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Negocios activos</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{negocios.length}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Clientes registrados</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{negocios.reduce((acc, n) => acc + (n.clientes?.length || 0), 0)}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Puntos en circulación</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{negocios.reduce((acc, n) => acc + (n.clientes?.reduce((a, c) => a + c.puntos, 0) || 0), 0)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Mis negocios</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {negocios.map((neg, i) => (
                    <div key={neg.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 }}>
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
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={guardarEdicionNegocio} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Guardar</button>
                            <button onClick={() => setNegocioEditandoId(null)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FBEAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{neg.emoji}</div>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontWeight: 500 }}>Activo</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{neg.nombre}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{neg.tipo} · {neg.ciudad}</div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                            <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.clientes?.length || 0}</strong> clientes</span>
                            <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.premios?.length || 0}</strong> premios</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={() => { setNegocioActivo(neg); setMostrarFormCliente(false); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#eef2ff', color: '#6366f1', cursor: 'pointer' }}>Ver panel</button>
                            <button onClick={() => iniciarEdicionNegocio(neg)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Editar</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <PanelNegocio negocio={negocioActivo} onVolver={volverANegocios} />
          )}
        </div>
      )}

      {/* PANEL NEGOCIO */}
      {isNegocio && (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <div style={{ width: 210, background: '#fff', borderRight: '1px solid #eee', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{negocioPropio?.nombre || session?.user?.name}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Panel del negocio</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio', 'inicio'], ['👥', 'Mis clientes', 'clientes'], ['🎁', 'Premios', null], ['🔄', 'Canjes', 'canjes'], ['🔌', 'Integraciones', null]].map(([icon, label, id]) => (
                <div
                  key={label}
                  onClick={id ? () => setSeccionActiva(id) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: seccionActiva === id ? '#6366f1' : '#555', background: seccionActiva === id ? '#eef2ff' : 'transparent', cursor: id ? 'pointer' : 'default', marginBottom: 2 }}
                >
                  {icon} {label}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', fontSize: 12, color: '#999' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>
                  {session?.user?.name?.[0] || 'N'}
                </div>
                {session?.user?.name}
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#ef4444', cursor: 'pointer', width: '100%' }}>Cerrar sesión</button>
            </div>
          </div>

          {negocioPropio ? (
            <PanelNegocio negocio={negocioPropio} onVolver={null} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              Cargando tu negocio...
            </div>
          )}
        </div>
      )}

      {/* PANEL CLIENTE */}
      {isCliente && <PanelCliente />}

      {/* Sin acceso */}
      {!isAdmin && !isNegocio && !isCliente && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, color: '#555' }}>No tenés acceso a este panel.</div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}