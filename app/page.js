'use client';

import { useState } from 'react';

const negocios = [
  {
    id: 1,
    nombre: 'Peperina',
    tipo: 'Indumentaria femenina',
    ciudad: 'Mercedes, Bs As',
    emoji: '👗',
    activo: true,
    clientes: 34,
    puntos: 12500,
    canjes: 8,
    premios: [
      { id: 1, nombre: 'Pañuelo sorpresa', puntos: 100, emoji: '🎀' },
      { id: 2, nombre: 'Vale descuento 10%', puntos: 100, emoji: '🏷️' },
      { id: 3, nombre: 'Orden de compra $30.000', puntos: 500, emoji: '🛍️' },
      { id: 4, nombre: '2x1 en toda la tienda', puntos: 1000, emoji: '✨' },
    ],
  },
  {
    id: 2,
    nombre: 'Café del Centro',
    tipo: 'Cafetería',
    ciudad: 'Mercedes, Bs As',
    emoji: '☕',
    activo: true,
    clientes: 13,
    puntos: 5840,
    canjes: 2,
    premios: [
      { id: 1, nombre: 'Café gratis', puntos: 50, emoji: '☕' },
      { id: 2, nombre: 'Medialunas x4', puntos: 100, emoji: '🥐' },
      { id: 3, nombre: 'Almuerzo para 2', puntos: 500, emoji: '🍽️' },
    ],
  },
];

const clientesEjemplo = [
  { id: 1, nombre: 'María González', telefono: '+54 9 2324 ***890', puntos: 234, negocioId: 1 },
  { id: 2, nombre: 'Laura Fernández', telefono: '+54 9 2324 ***441', puntos: 180, negocioId: 1 },
  { id: 3, nombre: 'Sofía Rodríguez', telefono: '+54 9 2324 ***762', puntos: 98, negocioId: 1 },
];

export default function Home() {
  const [vista, setVista] = useState('admin'); // admin | negocio | cliente
  const [negocioActivo, setNegocioActivo] = useState(negocios[0]);
  const [clienteActivo, setClienteActivo] = useState(clientesEjemplo[0]);
  const [tabCliente, setTabCliente] = useState('premios');
  const [monto, setMonto] = useState('');

  const pts = Math.floor((parseFloat(monto) || 0) / 1000);

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
                {[['Negocios activos', '2', '+1 este mes'], ['Clientes registrados', '47', '+12 esta semana'], ['Puntos en circulación', '18.340', 'en todos los negocios']].map(([label, value, sub]) => (
                  <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{value}</div>
                    <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Mis negocios</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {negocios.map(neg => (
                  <div key={neg.id} style={{ background: '#fff', border: `1px solid ${neg.id === 1 ? '#6366f1' : '#eee'}`, borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: neg.id === 1 ? '#FBEAF0' : '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{neg.emoji}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontWeight: 500 }}>Activo</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{neg.nombre}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{neg.tipo} · {neg.ciudad}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                      <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.clientes}</strong> clientes</span>
                      <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.puntos.toLocaleString()}</strong> pts</span>
                      <span style={{ fontSize: 12, color: '#555' }}><strong>{neg.canjes}</strong> canjes</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => { setNegocioActivo(neg); setVista('negocio'); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#eef2ff', color: '#6366f1', cursor: 'pointer' }}>Ver panel</button>
                      <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #eee', background: '#fff', color: '#555', cursor: 'pointer' }}>Editar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Actividad reciente</div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
                {[
                  { color: '#22c55e', texto: 'María González canjeó 100 pts — Vale descuento 10% en Peperina', tiempo: 'hace 20 min' },
                  { color: '#6366f1', texto: 'Laura Fernández acumuló 34 pts por compra de $34.000 en Peperina', tiempo: 'hace 1 h' },
                  { color: '#6366f1', texto: 'Carlos Ruiz acumuló 12 pts por compra de $12.000 en Café del Centro', tiempo: 'hace 3 h' },
                  { color: '#22c55e', texto: 'Ana Torres se registró como cliente en Café del Centro', tiempo: 'ayer' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid #f5f5f5' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }}></div>
                    <div style={{ flex: 1, fontSize: 13, color: '#555' }}>{item.texto}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{item.tiempo}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL NEGOCIO */}
      {vista === 'negocio' && (
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
                {[['Clientes activos', negocioActivo.clientes, '+4 este mes'], ['Puntos en circulación', negocioActivo.puntos.toLocaleString(), '$' + (negocioActivo.puntos * 1000).toLocaleString() + ' en compras'], ['Canjes realizados', negocioActivo.canjes, '2 pendientes']].map(([label, value, sub]) => (
                  <div key={label} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #eee' }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Clientes recientes</div>
                    {clientesEjemplo.filter(c => c.negocioId === negocioActivo.id).map(c => (
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

                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Canjes pendientes <span style={{ fontSize: 11, background: '#fef9c3', color: '#ca8a04', padding: '2px 8px', borderRadius: 20 }}>2</span>
                    </div>
                    {[{ nombre: 'Vale descuento 10%', cliente: 'María González', pts: 100 }, { nombre: 'Orden de compra $30.000', cliente: 'Laura Fernández', pts: 500 }].map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i === 0 ? '1px solid #f5f5f5' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13 }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>{c.cliente} · {c.pts} pts</div>
                        </div>
                        <button style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#16a34a', cursor: 'pointer' }}>Entregar</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #eee', padding: 20, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Premios configurados</div>
                    {negocioActivo.premios.map(p => (
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
                      <select style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                        <option>Seleccionar cliente...</option>
                        {clientesEjemplo.filter(c => c.negocioId === negocioActivo.id).map(c => <option key={c.id}>{c.nombre}</option>)}
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
      {vista === 'cliente' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', background: '#f5f5f5', minHeight: 'calc(100vh - 41px)' }}>
          <div style={{ width: 360, background: '#fff', borderRadius: 24, overflow: 'hidden', border: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FBEAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👗</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Peperina</div>
                  <div style={{ fontSize: 11, color: '#999' }}>Indumentaria femenina</div>
                </div>
                <div style={{ fontSize: 20, cursor: 'pointer' }}>🔔</div>
              </div>

              <div style={{ background: '#6366f1', borderRadius: 16, padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }}></div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Tus puntos</div>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{clienteActivo.puntos}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>${(clienteActivo.puntos * 1000).toLocaleString()} en compras acumuladas</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 10, fontWeight: 500 }}>{clienteActivo.nombre}</div>
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
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 6 }}>
                      <span>Progreso al siguiente premio</span>
                      <span>{clienteActivo.puntos} / 500 pts</span>
                    </div>
                    <div style={{ height: 6, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((clienteActivo.puntos / 500) * 100, 100)}%`, background: '#6366f1', borderRadius: 3 }}></div>
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
                      Te faltan <strong style={{ color: '#6366f1' }}>{Math.max(500 - clienteActivo.puntos, 0)} pts</strong> para la orden de compra $30.000
                    </div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Disponibles para canjear</div>
                  {negocioActivo.premios.filter(p => p.puntos <= clienteActivo.puntos).map(p => (
                    <div key={p.id} style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 24 }}>{p.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#16a34a' }}>{p.puntos} puntos · ¡Ya podés canjear!</div>
                      </div>
                      <button style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer' }}>Canjear</button>
                    </div>
                  ))}

                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, marginTop: 16 }}>Próximos premios</div>
                  {negocioActivo.premios.filter(p => p.puntos > clienteActivo.puntos).map(p => (
                    <div key={p.id} style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.7 }}>
                      <div style={{ fontSize: 24 }}>{p.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{p.puntos} puntos · te faltan {p.puntos - clienteActivo.puntos}</div>
                      </div>
                      <span style={{ fontSize: 16 }}>🔒</span>
                    </div>
                  ))}
                </>
              )}

              {tabCliente === 'historial' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Movimientos recientes</div>
                  {[
                    { tipo: 'suma', desc: 'Compra en tienda', fecha: 'hoy, 15:32', pts: 34 },
                    { tipo: 'canje', desc: 'Canje: Vale descuento 10%', fecha: 'ayer, 11:15', pts: -100 },
                    { tipo: 'suma', desc: 'Compra en Tiendanube', fecha: '20 jun, 19:04', pts: 85 },
                    { tipo: 'suma', desc: 'Compra con Mercado Pago', fecha: '15 jun, 10:30', pts: 62 },
                    { tipo: 'suma', desc: 'Compra en tienda', fecha: '10 jun, 14:20', pts: 48 },
                  ].map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.tipo === 'suma' ? '#22c55e' : '#6366f1', flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: '#1a1a1a' }}>{h.desc}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{h.fecha}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: h.pts > 0 ? '#22c55e' : '#6366f1' }}>{h.pts > 0 ? '+' : ''}{h.pts} pts</div>
                    </div>
                  ))}
                </>
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