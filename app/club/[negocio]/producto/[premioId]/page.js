'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PackageX, CircleCheck, Info, ExternalLink, ArrowLeft } from 'lucide-react';
import { resolverTema, TEMA_DEFAULT, FUENTE_TEXTO } from '@/lib/tema';
import { formatearMiles } from '@/lib/clienteStats';

// Página intermedia del enlace de un premio: en vez de mandar directo a la
// tienda, consulta el stock en Tiendanube (app/api/enlaces/...) y muestra
// si el producto está disponible, sin stock (con otros colores del mismo
// producto y las alternativas que eligió el negocio, solo si tienen stock) o
// si no se pudo confirmar. Se abre desde el panel de la clienta, el cartel
// del cupón y el mail de canje.

const pesos = (n) => `$${formatearMiles(Math.round(Number(n)))}`;

function Tarjeta({ t, imagen, titulo, detalle, precio, url }) {
  return (
    <li style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${t.borde}` }}>
      {imagen ? (
        // Imágenes del CDN de la tienda: <img> simple, sin optimizar por Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagen} alt="" width={64} height={64} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0, background: t.superficie }} />
      ) : (
        <span aria-hidden="true" style={{ width: 64, height: 64, flexShrink: 0, background: t.superficie, border: `1px solid ${t.borde}` }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: t.fuenteTitulo, fontSize: 18, lineHeight: 1.25 }}>{titulo}</div>
        {detalle && <div style={{ fontSize: 14, color: t.textoSecundario, marginTop: 2 }}>{detalle}</div>}
        {precio != null && <div style={{ fontSize: 14, color: t.textoSecundario, marginTop: 2 }}>{pesos(precio)}</div>}
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="fid-btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', border: `1px solid ${t.texto}`, color: t.texto, textDecoration: 'none', fontSize: 14, flexShrink: 0 }}>
        Ver <ExternalLink size={14} aria-hidden="true" />
      </a>
    </li>
  );
}

export default function EnlaceProductoPage() {
  const { negocio, premioId } = useParams();
  const [datos, setDatos] = useState(null);
  const [noEncontrado, setNoEncontrado] = useState(false);

  useEffect(() => {
    fetch(`/api/enlaces/${encodeURIComponent(negocio)}/${encodeURIComponent(premioId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setDatos)
      .catch(() => setNoEncontrado(true));
  }, [negocio, premioId]);

  if (noEncontrado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE_TEXTO, background: TEMA_DEFAULT.fondo, color: TEMA_DEFAULT.textoSecundario, padding: 20, textAlign: 'center' }}>
        No encontramos este producto.
      </div>
    );
  }
  if (!datos) {
    return (
      <div role="status" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE_TEXTO, background: TEMA_DEFAULT.fondo, color: TEMA_DEFAULT.textoSecundario }}>
        Consultando el stock…
      </div>
    );
  }

  const t = resolverTema(datos.negocio.tema);
  const { enlace, premio } = datos;
  const producto = enlace.producto;
  const imagen = enlace.variante?.imagen ?? producto?.imagen;
  const hora = new Date(datos.consultadoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const aviso = (Icono, color, texto, detalle) => (
    <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 18px', background: t.superficie, border: `1px solid ${t.borde}`, borderLeft: `3px solid ${color}`, margin: '18px 0 0' }}>
      <span aria-hidden="true" style={{ display: 'flex', color, paddingTop: 1 }}><Icono size={20} /></span>
      <div>
        <div style={{ fontSize: 16, lineHeight: 1.4 }}>{texto}</div>
        {detalle && <div style={{ fontSize: 14, color: t.textoSecundario, marginTop: 4, lineHeight: 1.45 }}>{detalle}</div>}
      </div>
    </div>
  );
  const botonTienda = (texto) => (
    <a href={enlace.url} target="_blank" rel="noopener noreferrer" className="fid-btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 52, marginTop: 22, backgroundColor: t.primario, color: t.primarioTexto, fontSize: 16, fontWeight: 500, textDecoration: 'none', boxSizing: 'border-box' }}>
      {texto} <ExternalLink size={16} aria-hidden="true" />
    </a>
  );
  const nombreVariante = enlace.variante?.nombre;

  return (
    <div style={{ minHeight: '100vh', background: t.fondo, color: t.texto, fontFamily: FUENTE_TEXTO, display: 'flex', justifyContent: 'center' }}>
      <main style={{ width: '100%', maxWidth: 480, padding: '32px 20px 40px', boxSizing: 'border-box' }}>
        <Link href="/" className="fid-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: t.textoSecundario, textDecoration: 'none' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Volver a mi club
        </Link>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.textoSecundario, fontWeight: 500, marginTop: 22 }}>{datos.negocio.nombre} · Premio</div>
        <h1 style={{ fontFamily: t.fuenteTitulo, fontWeight: 400, fontSize: 32, lineHeight: 1.15, margin: '6px 0 0' }}>{premio.nombre}</h1>

        {producto && imagen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagen} alt={producto.nombre} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: 360, objectFit: 'cover', marginTop: 20, background: t.superficie, opacity: enlace.estado === 'sin_stock' ? 0.55 : 1 }} />
        )}
        {producto?.nombre && (
          <p style={{ margin: '14px 0 0', fontSize: 16 }}>
            {producto.nombre}{nombreVariante ? <span style={{ color: t.textoSecundario }}> · {nombreVariante}</span> : null}
          </p>
        )}

        {enlace.estado === 'disponible' && (
          <>
            {aviso(CircleCheck, '#15803d', 'Disponible en la tienda.')}
            {enlace.url && botonTienda('Ver en la tienda')}
          </>
        )}

        {enlace.estado === 'sin_stock' && (
          <>
            {aviso(PackageX, '#b45309', nombreVariante ? `Este producto se encuentra sin stock por el momento en ${nombreVariante}.` : 'Este producto se encuentra sin stock por el momento.')}

            {enlace.otrasVariantes.length > 0 && (
              <section style={{ marginTop: 28 }} aria-labelledby="otras-variantes">
                <h2 id="otras-variantes" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, color: t.textoSecundario, margin: 0 }}>Disponible en otros colores</h2>
                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, borderTop: `1px solid ${t.texto}` }}>
                  {enlace.otrasVariantes.map((v) => (
                    <Tarjeta key={v.id} t={t} imagen={v.imagen} titulo={v.nombre || producto?.nombre} detalle={v.nombre ? producto?.nombre : null} precio={v.precio} url={v.url} />
                  ))}
                </ul>
              </section>
            )}

            {enlace.alternativas.length > 0 && (
              <section style={{ marginTop: 28 }} aria-labelledby="alternativas">
                <h2 id="alternativas" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500, color: t.textoSecundario, margin: 0 }}>También te puede gustar</h2>
                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, borderTop: `1px solid ${t.texto}` }}>
                  {enlace.alternativas.map((a) => (
                    <Tarjeta key={`${a.productoId}:${a.varianteId ?? ''}`} t={t} imagen={a.imagen} titulo={a.nombre} detalle={a.variante} precio={a.precio} url={a.url} />
                  ))}
                </ul>
              </section>
            )}

            {enlace.otrasVariantes.length === 0 && enlace.alternativas.length === 0 && (
              <p style={{ fontSize: 15, color: t.textoSecundario, lineHeight: 1.5, marginTop: 18 }}>
                Por ahora no hay otras opciones con stock. Volvé a mirar en unos días: el stock se actualiza con la tienda.
              </p>
            )}
          </>
        )}

        {enlace.estado === 'desconocido' && (
          <>
            {aviso(Info, t.textoSecundario, 'No pudimos confirmar la disponibilidad en este momento.', 'La tienda te muestra el stock actualizado de cada color.')}
            {enlace.url && botonTienda('Ver en la tienda')}
          </>
        )}

        <p style={{ fontSize: 12, color: t.textoSecundario, marginTop: 28 }}>Stock consultado a las {hora}.</p>
      </main>
    </div>
  );
}
