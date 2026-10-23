'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ShoppingBag, Gift, Cake } from 'lucide-react';
import { resolverTema, TEMA_DEFAULT, FUENTE_TEXTO } from '@/lib/tema';
import { formatearMiles } from '@/lib/clienteStats';

// Paso intermedio antes de /registro/[negocio]: pensada para linkear desde
// afuera de Retornar (ej. un ítem de menú en la tienda online del negocio)
// en vez de mandar directo al formulario a alguien que todavía no sabe qué
// es "Club X" — mismo motivo por el que Peperina pidió esto (ver
// docs/tareas-futuras.md, ítem 7).
export default function ClubLandingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const negocio = params.negocio;
  // Link de invitación de otra clienta -- se reenvía tal cual al botón de
  // registro, para que llegue hasta donde el backend realmente lo procesa.
  const codigoReferido = searchParams.get('ref');
  const [datosNegocio, setDatosNegocio] = useState(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    fetch(`/api/registro/${negocio}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDatosNegocio)
      .catch(() => setNoEncontrado(true));
  }, [negocio]);

  if (noEncontrado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE_TEXTO, background: TEMA_DEFAULT.fondo, color: TEMA_DEFAULT.textoSecundario, padding: 20, textAlign: 'center' }}>
        No encontramos ese club.
      </div>
    );
  }

  // Mientras no llegan los colores reales del negocio, no se dibuja nada con
  // color -- antes se mostraba un instante con el color por defecto de toda
  // la app y después "saltaba" al color real (marrón en Peperina), un flash
  // que se notaba y quedaba feo.
  if (!datosNegocio) {
    return <div style={{ minHeight: '100vh', backgroundColor: TEMA_DEFAULT.fondo }} />;
  }

  // datosNegocio.tema trae la paleta completa; temaPrimario/temaPrimarioTexto
  // quedan por compatibilidad con el widget embebible (public/widget.js).
  const t = resolverTema({ primario: datosNegocio.temaPrimario, primarioTexto: datosNegocio.temaPrimarioTexto, ...(datosNegocio.tema || {}) });
  const beneficios = [
    [ShoppingBag, 'Sumás puntos con cada compra, en el local y online'],
    [Gift, 'Los canjeás por premios y prendas seleccionadas'],
    [Cake, 'Te esperan beneficios y sorpresas especiales'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: t.fondo, color: t.texto, fontFamily: FUENTE_TEXTO, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {t.imagenPortada && (
        <img src={t.imagenPortada} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover' }} />
      )}

      <main style={{ width: '100%', maxWidth: 440, padding: '44px 24px 40px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textoSecundario, fontWeight: 500 }}>{datosNegocio.nombre}</div>
        <h1 style={{ fontFamily: t.fuenteTitulo, fontWeight: 400, fontSize: 38, lineHeight: 1.12, letterSpacing: '-0.01em', margin: '8px 0 14px' }}>
          Tus compras ahora también tienen recompensa
        </h1>

        <p style={{ color: t.textoSecundario, fontSize: 16, lineHeight: 1.55, margin: '0 0 28px' }}>
          Sumá 1 punto por cada ${formatearMiles(datosNegocio.puntosXPeso ?? 100)} de compra en el local y en nuestra tienda online.
        </p>

        <ul style={{ listStyle: 'none', margin: '0 0 32px', padding: 0, borderTop: `1px solid ${t.texto}` }}>
          {beneficios.map(([Icono, texto]) => (
            <li key={texto} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '15px 0', borderBottom: `1px solid ${t.borde}`, fontSize: 15 }}>
              <span aria-hidden="true" style={{ color: t.primarioLegible, display: 'flex', flexShrink: 0 }}><Icono size={20} /></span>
              {texto}
            </li>
          ))}
        </ul>

        <a
          href={codigoReferido ? `/registro/${negocio}?ref=${encodeURIComponent(codigoReferido)}` : `/registro/${negocio}`}
          className="fid-btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, borderRadius: 2, backgroundColor: t.primario, color: t.primarioTexto, fontSize: 16, fontWeight: 500, textDecoration: 'none', boxSizing: 'border-box' }}
        >
          Sumarme al club
        </a>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: t.textoSecundario }}>
          ¿Ya tenés cuenta? <a href="/login" className="fid-link" style={{ color: t.texto }}>Iniciá sesión</a>
        </p>
      </main>
    </div>
  );
}
