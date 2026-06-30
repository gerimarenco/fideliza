'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [vista, setVista] = useState('admin');
  const [negocios, setNegocios] = useState([]);
  const [negocioActivo, setNegocioActivo] = useState(null);
  const [clienteActivo, setClienteActivo] = useState(null);
  const [tabCliente, setTabCliente] = useState('premios');
  const [monto, setMonto] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/negocios')
      .then(res => res.json())
      .then(data => {
        setNegocios(data);
        if (data.length > 0) setNegocioActivo(data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pts = Math.floor((parseFloat(monto) || 0) / 1000);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', fontSize: 16, color: '#555' }}>
      Cargando Fideliza...
    </div>
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
      
      {/* Selector de vista (demo) */}
      <div style={{ background: '#1a1a1a', padding: '10px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: 12, marginRight: 8 }}>Ver como:</span>
        {['admin', 'negocio', 'cliente'].map(v => (
          <button key={v} onClick={() => setVista(v)} style={{
            padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            background: vista === v ? '#6366f1' : '#333', color: vista === v ? '#fff' : '#aaa'
          }}>
            {v === 'admin' ? '👤 Admin' : v === 'negocio' ? '🏪 Negocio' : '🙋 Cliente'}
          </button>
        ))}
      </div>

      {/* PANEL ADMIN */}
      {vista === 'admin' && (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 41px)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#6366f1' }}>C</div>
                Cecilia · Admin
              </div>
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
                      <button onClick={() => { setNegocioActivo(neg); setVista('negocio'); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#eef2ff', color: '#6366f1', cursor: 'pointer' }}>Ver panel</button>
                      <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL NEGOCIO */}
      {vista === 'negocio' && negocioActivo && (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 41px)' }}>
          <div style={{ width: 210, background: '#fff', borderRight: '1px solid #eee', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{negocioActivo.nombre}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Panel del negocio</div>
            </div>
            <div style={{ padding: '12px 8px', flex: 1 }}>
              {[['🏠', 'Inicio'], ['👥', 'Mis clientes'], ['🎁', 'Premios'], ['🔄', 'Canjes'], ['➕', 'Registrar compra'], ['🔌', 'Integraciones']].map(([icon, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, fontSize: 14, color: label === 'Inicio' ? '#6366f1' : '#555', background: label === 'Inicio' ? '#eef2ff' : 'transparent', cursor: 'pointer', marginBottom: 2 }}>
                  {icon} {label}
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', fontSize: 12 }}>
              <div style={{ color: '#555' }}>Mercado Pago · Tiendanube</div>
              <div style={{ color: '#22c55e', marginTop: 2 }}>● Conectado</div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Bienvenida, {negocioActivo.nombre}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setVista('admin')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #eee', background: '#fff', fontSize: 12, cursor: 'pointer' }}>← Volver</button>
                <button style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, cursor: 'pointer' }}>+ Registrar compra</button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Clientes activos</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{negocioActivo.clientes?.length || 0}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Premios configurados</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{negocioActivo.premios?.length || 0}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>Puntos por cada $1.000</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>1 pt</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Premios configurados</div>
                    {negocioActivo.premios?.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>{p.puntos} puntos</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Registrar compra manual</div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Cliente</label>
                      <select style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                        <option>Seleccionar cliente...</option>
                        {negocioActivo.clientes?.map(c => <option key={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Monto de la compra</label>
                      <input type="number" placeholder="$0" value={monto} onChange={e => setMonto(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                    </div>
                    {pts > 0 && <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 12, fontWeight: 500 }}>+{pts} puntos a acreditar</div>}
                    <button style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Sumar puntos</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL CLIENTE */}
      {vista === 'cliente' && negocioActivo && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', background: '#f5f5f5', minHeight: 'calc(100vh - 41px)' }}>
          <div style={{ width: 360, background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FBEAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{negocioActivo.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{negocioActivo.nombre}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{negocioActivo.tipo}</div>
                </div>
                <div style={{ fontSize: 20, cursor: 'pointer' }}>🔔</div>
              </div>

              <div style={{ background: '#6366f1', borderRadius: 16, padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }}></div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Tus puntos</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#fff', lineHeight: 1 }}>0</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>$0 en compras acumuladas</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 10, fontWeight: 500 }}>Tu nombre acá</div>
              </div>

              <div style={{ display: 'flex', borderBottom: '1px solid #eee', marginBottom: 16 }}>
                {['premios', 'historial'].map(tab => (
                  <div key={tab} onClick={() => setTabCliente(tab)} style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 13, cursor: 'pointer', color: tabCliente === tab ? '#6366f1' : '#999', borderBottom: tabCliente === tab ? '2px solid #6366f1' : '2px solid transparent', fontWeight: tabCliente === tab ? 600 : 400 }}>
                    {tab === 'premios' ? 'Premios' : 'Historial'}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, padding: '0 20px 20px', overflowY: 'auto' }}>
              {tabCliente === 'premios' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Premios disponibles</div>
                  {negocioActivo.premios?.map(p => (
                    <div key={p.id} style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
                      <div style={{ fontSize: 24 }}>{p.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{p.puntos} puntos necesarios</div>
                      </div>
                      <span style={{ fontSize: 16 }}>🔒</span>
                    </div>
                  ))}
                </>
              )}

              {tabCliente === 'historial' && (
                <div style={{ fontSize: 13, color: '#999', textAlign: 'center', marginTop: 40 }}>
                  Aún no hay movimientos registrados
                </div>
              )}
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid #eee' }}>
              {[['⭐', 'Puntos'], ['🎁', 'Premios'], ['🕐', 'Historial'], ['👤', 'Perfil']].map(([icon, label]) => (
                <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0', fontSize: 10, color: label === 'Puntos' ? '#6366f1' : '#999', cursor: 'pointer' }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>{label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}