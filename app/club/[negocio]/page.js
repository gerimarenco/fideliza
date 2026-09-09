'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// Paso intermedio antes de /registro/[negocio]: pensada para linkear desde
// afuera de Retornar (ej. un ítem de menú en la tienda online del negocio)
// en vez de mandar directo al formulario a alguien que todavía no sabe qué
// es "Club X" — mismo motivo por el que Peperina pidió esto (ver
// docs/tareas-futuras.md, ítem 7).
export default function ClubLandingPage() {
  const params = useParams();
  const negocio = params.negocio;
  const [datosNegocio, setDatosNegocio] = useState(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    fetch(`/api/registro/${negocio}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDatosNegocio)
      .catch(() => setNoEncontrado(true));
  }, [negocio]);

  const primario = datosNegocio?.temaPrimario || '#6366f1';
  const primarioTexto = datosNegocio?.temaPrimarioTexto || '#ffffff';

  if (noEncontrado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#6b7280', padding: 20, textAlign: 'center' }}>
        No encontramos ese club.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {datosNegocio?.temaImagenPortada && (
        <img src={datosNegocio.temaImagenPortada} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover' }} />
      )}

      <div style={{ width: '100%', maxWidth: 420, padding: '32px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>
          {datosNegocio ? `${datosNegocio.nombre} ${datosNegocio.emoji || ''}`.trim() : (
            <span style={{ textTransform: 'capitalize' }}>{negocio}</span>
          )}
        </h1>

        <p style={{ color: '#4b5563', fontSize: 15, lineHeight: 1.5, marginBottom: 28 }}>
          {datosNegocio?.mensajeRegistro || 'Sumá puntos con cada compra y canjealos por premios exclusivos.'}
        </p>

        <div style={{ display: 'grid', gap: 14, textAlign: 'left', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: '14px 16px', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 22 }}>🛍️</span>
            <span style={{ fontSize: 14, color: '#374151' }}>Sumás puntos automáticamente con cada compra</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: '14px 16px', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 22 }}>🎁</span>
            <span style={{ fontSize: 14, color: '#374151' }}>Los canjeás por premios exclusivos</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', padding: '14px 16px', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 22 }}>🎂</span>
            <span style={{ fontSize: 14, color: '#374151' }}>Sorpresas especiales, como en tu cumpleaños</span>
          </div>
        </div>

        <a
          href={`/registro/${negocio}`}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px',
            borderRadius: 10,
            backgroundColor: primario,
            color: primarioTexto,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Registrarme
        </a>

        <a href="/login" style={{ display: 'block', marginTop: 16, fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
          ¿Ya tenés cuenta? Iniciá sesión
        </a>
      </div>
    </div>
  );
}
