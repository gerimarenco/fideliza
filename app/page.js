'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();
  const [negocios, setNegocios] = useState([]);
  const [negocioActivo, setNegocioActivo] = useState(null);
  const [tabCliente, setTabCliente] = useState('premios');
  const [monto, setMonto] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [loading, setLoading] = useState(true);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', telefono: '', email: '' });

  const cargarNegocios = () => {
    fetch('/api/negocios')
      .then(res => res.json())
      .then(data => {
        setNegocios(data);
        if (data.length > 0 && !negocioActivo) setNegocioActivo(data[0]);
        else if (negocioActivo) setNegocioActivo(data.find(n => n.id === negocioActivo.id) || data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargarNegocios(); }, []);

  const pts = Math.floor((parseFloat(monto) || 0) / 1000);

  const sumarPuntos = async () => {
    if (!monto || !clienteSeleccionado) { alert('Seleccioná un cliente y un monto'); return; }
    const res = await fetch('/api/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: clienteSeleccionado, monto: parseFloat(monto), negocioId: negocioActivo.id })
    });
    const data = await res.json();
    alert(`✅ +${data.puntosASumados} puntos acreditados a ${negocioActivo.clientes.find(c => c.id === clienteSeleccionado)?.nombre}!`);
    setMonto('');
    setClienteSeleccionado('');
    cargarNegocios();
  };

  const agregarCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.telefono) { alert('Nombre y teléfono son obligatorios'); return; }
    await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuevoCliente, negocioId: negocioActivo.id })
    });
    alert(`✅ Cliente ${nuevoCliente.nombre} agregado!`);
    setNuevoCliente({ nombre: '', telefono: '', email: '' });
    setMostrarFormCliente(false);
    cargarNegocios();
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', fontSize: 16, color: '#555' }}>
      Cargando Fideliza...
    </div>
  );

  const isAdmin = session?.user?.role === 'admin';

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>

      {/* PANEL ADMIN */}
      {isAdmin && (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <div style={{ width: 210, background: '#fff', borderRight: '1px solid #eee', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>Fideliza</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Panel de administración</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio'], ['🏪', 'Negocios'], ['👥', 'Clientes'], ['⭐', 'Puntos y canjes'], ['🔌', 'Integraciones'], ['⚙️', 'Ajustes']].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: label === 'Inicio' ? '#6366f1' : '#555', background: label === 'Inicio' ? '#eef2ff' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                  {icon} {label}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', fontSize: 12, color: '#999' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>C</div>
                {session?.user?.name} · Admin
              </div>
              <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#ef4444', cursor: 'pointer', width: '100%' }}>Cerrar sesión</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Inicio</div>
              <button style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 13, cursor: 'pointer' }}>+ Nuevo negocio</button>
            </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {negocios.map((neg, i) => (
                  <div key={neg.id} style={{ background: '#fff', border: `1px solid ${i === 0 ? '#6366f1' : '#eee'}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: i === 0 ? '#FBEAF0' : '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{neg.emoji}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontWeight: 500 }}>Activo</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{neg.nombre}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{neg.tipo} · {neg.ciudad}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                      <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.clientes?.length || 0}</strong> clientes</span>
                      <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.premios?.length || 0}</strong> premios</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => setNegocioActivo(neg)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#eef2ff', color: '#6366f1', cursor: 'pointer' }}>Ver panel</button>
                      <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>

              {negocioActivo && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #6366f1', padding: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Panel de {negocioActivo.nombre}</div>

                  <button onClick={() => setMostrarFormCliente(!mostrarFormCliente)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, cursor: 'pointer', marginBottom: 16 }}>+ Nuevo cliente</button>

                  {mostrarFormCliente && (
                    <div style={{ background: '#f9f9f9', borderRadius: 10, padding: 16, marginBottom: 16 }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Clientes</div>
                      {negocioActivo.clientes?.length === 0 && <div style={{ fontSize: 13, color: '#999' }}>Aún no hay clientes</div>}
                      {negocioActivo.clientes?.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>
                            {c.nombre.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>{c.telefono}</div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 500, background: '#eef2ff', color: '#6366f1', padding: '2px 8px', borderRadius: 20 }}>{c.puntos} pts</div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Registrar compra manual</div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Cliente</label>
                        <select value={clienteSeleccionado} onChange={e => setClienteSeleccionado(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                          <option value="">Seleccionar cliente...</option>
                          {negocioActivo.clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.puntos} pts)</option>)}
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANEL NO ADMIN - mensaje temporal */}
      {!isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, color: '#555' }}>No tenés acceso a este panel.</div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}