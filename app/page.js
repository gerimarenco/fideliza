'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { nombreClub } from '@/lib/nombreClub';
import { esCumpleanosHoy, diasHastaProximoCumpleanos } from '@/lib/cumpleanos';
import { descripcionNiveles, formatearMiles } from '@/lib/clienteStats';
import { fechaCorta } from '@/lib/csv';
import { calcularPuntosPorCompra } from '@/lib/puntos';
import { estadoAgente, textoTiempo } from '@/lib/estadoAgente';
import { ICONOS_PREMIO, IconoPremio } from '@/lib/premioIconos';
import { TEMA_DEFAULT, FUENTE_TEXTO, resolverTema } from '@/lib/tema';
import {
  Home as HomeIcon, Store, Users, Gift, Star, RefreshCw, Plug, Settings, LogOut, Shield,
  AlertTriangle, MessageCircle, ScrollText, KeyRound, ClipboardList, Cake,
  ShoppingBag, Hourglass, Link as LinkIcon, Ticket, Info, Mail, Menu, Download,
  ArrowRight, Check, X,
} from 'lucide-react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "Miércoles 22 de octubre" sin toLocaleDateString (ver el comentario de
// formatearMiles en lib/clienteStats.js sobre los locales del runtime).
function fechaLarga(fecha = new Date()) {
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

// "Hoy" / "Ayer" / "Hace N días" para la última actividad de un cliente en
// VistaClientes — más legible que una fecha pelada para detectar de un
// vistazo quién dejó de comprar.
function formatearFechaRelativa(fechaIso) {
  if (!fechaIso) return 'Sin actividad';
  const dias = Math.floor((Date.now() - new Date(fechaIso).getTime()) / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'Hace 1 mes' : `Hace ${meses} meses`;
}

// Solo un color por rango de días sin comprar, para que la columna de
// actividad avise a simple vista sin tener que leer el número (mismo
// espíritu que el cartel rojo "hace 42 días que no vuelve" del ejemplo que
// mandó Cecilia). Tonos oscuros para que se lean como texto chico sobre
// fondos claros.
function colorInactividad(dias, neutro) {
  if (dias == null) return neutro;
  if (dias >= 60) return '#b91c1c';
  if (dias >= 30) return '#a16207';
  return '#15803d';
}

// Reglas de puntos del panel del cliente ("Cómo funcionan los puntos" en el
// menú) armadas a partir de la configuración real del negocio, en vez de
// texto fijo -- así nunca queda desactualizado si Peperina (o cualquier
// otro negocio) cambia puntosXPeso, el regalo de cumpleaños o el
// vencimiento desde Ajustes.
function reglasDePuntos(negocio, club) {
  const reglas = [{ Icono: ShoppingBag, texto: `Ganás 1 punto por cada $${formatearMiles(negocio.puntosXPeso)} que gastás en ${club}.` }];
  if (negocio.regaloCumpleanosPuntos) {
    reglas.push({ Icono: Cake, texto: `El día de tu cumpleaños te regalamos ${negocio.regaloCumpleanosPuntos} puntos.` });
  }
  if (negocio.vencimientoPuntosMeses) {
    reglas.push({ Icono: Hourglass, texto: `Cada compra suma puntos que valen por ${negocio.vencimientoPuntosMeses} meses desde que los ganaste: si no los usás a tiempo, esos puntos vencen (siempre se gastan primero los más viejos). Te avisamos por mail antes de que venzan.` });
  }
  reglas.push({ Icono: Gift, texto: 'Cuando llegás al puntaje de un premio, ya lo podés canjear desde esta misma pantalla.' });
  return reglas;
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
  const [mostrarMenuCliente, setMostrarMenuCliente] = useState(false);
  // null | 'info' | 'password' | 'bases' | 'movimientos' | 'referidos' — qué modal del menú del cliente está abierto
  const [modalCliente, setModalCliente] = useState(null);
  const [movimientosClientePagina, setMovimientosClientePagina] = useState(1);
  const [movimientosClienteData, setMovimientosClienteData] = useState(null);
  const [referidosData, setReferidosData] = useState(null);
  const [referidoCopiado, setReferidoCopiado] = useState(false);
  const [canjeandoId, setCanjeandoId] = useState(null);
  const [saludoCumpleCerrado, setSaludoCumpleCerrado] = useState(false);
  const [toast, setToast] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);
  const [seccionActiva, setSeccionActiva] = useState('inicio');
  const [clientesPagina, setClientesPagina] = useState(1);
  const [clientesData, setClientesData] = useState(null);
  const [clientesBusqueda, setClientesBusqueda] = useState('');
  const [clientesBusquedaDebounced, setClientesBusquedaDebounced] = useState('');
  const [clientesNivelFiltro, setClientesNivelFiltro] = useState('');
  const [clienteExpandidoId, setClienteExpandidoId] = useState(null);
  const [premioParaCanjear, setPremioParaCanjear] = useState('');
  const [canjeandoClienteId, setCanjeandoClienteId] = useState(null);
  const [mostrarInfoNiveles, setMostrarInfoNiveles] = useState(false);
  const [canjesPagina, setCanjesPagina] = useState(1);
  const [reintentandoCuponId, setReintentandoCuponId] = useState(null);
  const [canjesData, setCanjesData] = useState(null);
  const [premiosPagina, setPremiosPagina] = useState(1);
  const [premiosData, setPremiosData] = useState(null);
  const [mostrarFormPremio, setMostrarFormPremio] = useState(false);
  const [nuevoPremio, setNuevoPremio] = useState({ nombre: '', puntos: '', emoji: '', tiendanubeProductoId: '', tiendanubeProductoUrl: '', tiendanubeDescuentoPorcentaje: '', tiendanubeDescuentoMonto: '', tiendanubeDescuentoMontoMinimo: '' });
  const [premioEditandoId, setPremioEditandoId] = useState(null);
  const [formEdicionPremio, setFormEdicionPremio] = useState({ nombre: '', puntos: '', emoji: '', tiendanubeProductoId: '', tiendanubeProductoUrl: '', tiendanubeDescuentoPorcentaje: '', tiendanubeDescuentoMonto: '', tiendanubeDescuentoMontoMinimo: '' });
  const [formIntegraciones, setFormIntegraciones] = useState({ tiendanubeStoreId: '', tiendanubeAccessToken: '', slug: '', dragonfishBaseDeDatos: '' });
  const [formPassword, setFormPassword] = useState({ actual: '', nueva: '', confirmar: '' });
  const [formPuntosXPeso, setFormPuntosXPeso] = useState('');
  const [formMensajeRegistro, setFormMensajeRegistro] = useState('');
  const [formRegaloCumpleanos, setFormRegaloCumpleanos] = useState('');
  const [formPuntosReferido, setFormPuntosReferido] = useState('');
  const [formVencimientoPuntos, setFormVencimientoPuntos] = useState('');
  const [formSitioWeb, setFormSitioWeb] = useState('');
  const [formSoporte, setFormSoporte] = useState({ email: '', whatsapp: '' });
  const [formBasesCondiciones, setFormBasesCondiciones] = useState('');
  const [formTema, setFormTema] = useState({ ...TEMA_DEFAULT });

  const isAdmin = session?.user?.role === 'admin';
  const isNegocio = session?.user?.role === 'negocio';
  const isCliente = session?.user?.role === 'cliente';

  const negocioMostrado = isAdmin ? negocioActivo : (isNegocio ? negocioPropio : null);
  // Marca propia del negocio (ej. Peperina): si no tiene tema cargado, usa la
  // paleta clara por defecto. Solo afecta su propio panel y el de sus
  // clientes, nunca el chrome general del Admin.
  const tema = resolverTema((isCliente ? negocioDelCliente : negocioMostrado)?.tema);

  // Estilos compartidos de la dirección "Editorial": títulos en serif,
  // etiquetas en versalitas, líneas finas en vez de tarjetas, esquinas casi
  // rectas. Todo sale de `tema`, así cada negocio conserva su marca.
  const ui = {
    titulo: (tamano = 40) => ({ fontFamily: tema.fuenteTitulo, fontWeight: 400, fontSize: tamano, lineHeight: 1.1, letterSpacing: '-0.01em', margin: 0 }),
    etiqueta: { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: tema.textoSecundario, fontWeight: 500 },
    label: { fontSize: 13, color: tema.textoSecundario, display: 'block', marginBottom: 6 },
    ayuda: { fontSize: 13, color: tema.textoSecundario, lineHeight: 1.5, margin: '0 0 12px' },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${tema.bordeCampo}`, borderRadius: 2, background: tema.superficie, color: tema.texto, fontSize: 14, boxSizing: 'border-box' },
    botonPrimario: { padding: '0 18px', minHeight: 42, borderRadius: 2, border: 'none', background: tema.primario, color: tema.primarioTexto, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
    botonSecundario: { padding: '0 18px', minHeight: 42, borderRadius: 2, border: `1px solid ${tema.texto}`, background: 'transparent', color: tema.texto, fontSize: 14, cursor: 'pointer' },
    botonChico: { padding: '6px 12px', minHeight: 32, borderRadius: 2, border: `1px solid ${tema.borde}`, background: 'transparent', color: tema.texto, fontSize: 13, cursor: 'pointer' },
    botonTexto: { padding: 0, border: 'none', background: 'none', color: tema.texto, fontSize: 13, cursor: 'pointer' },
    seccion: { borderTop: `1px solid ${tema.texto}`, paddingTop: 18 },
    numero: { fontVariantNumeric: 'tabular-nums' },
  };

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

  const cargarClientes = (negocioId, page = 1, busqueda = '', nivel = '') => {
    if (!negocioId) { setClientesData(null); return; }
    const q = busqueda.trim() ? `&q=${encodeURIComponent(busqueda.trim())}` : '';
    const n = nivel ? `&nivel=${encodeURIComponent(nivel)}` : '';
    fetch(`/api/clientes?negocioId=${negocioId}&page=${page}&pageSize=10${q}${n}`)
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

  const cargarMovimientosCliente = (page = 1) => {
    fetch(`/api/clientes/movimientos?page=${page}&pageSize=15`)
      .then(res => res.json())
      .then(setMovimientosClienteData)
      .catch(() => {});
  };

  const cargarReferidos = () => {
    fetch('/api/clientes/referidos')
      .then(res => res.json())
      .then(setReferidosData)
      .catch(() => {});
  };

  // Al cambiar de negocio, arrancar de nuevo desde la página 1 y desde Inicio
  useEffect(() => {
    setClientesPagina(1);
    setClientesBusqueda('');
    setClientesNivelFiltro('');
    setCanjesPagina(1);
    setPremiosPagina(1);
    setSeccionActiva('inicio');
  }, [negocioMostrado?.id]);

  // El buscador se debounce (300ms) para no pegarle a la base en cada
  // tecla -- y cada búsqueda nueva vuelve a la página 1, porque el
  // resultado filtrado ya no tiene por qué tener la misma cantidad de
  // páginas que la lista completa.
  useEffect(() => {
    const id = setTimeout(() => setClientesBusquedaDebounced(clientesBusqueda), 300);
    return () => clearTimeout(id);
  }, [clientesBusqueda]);

  useEffect(() => {
    setClientesPagina(1);
  }, [clientesBusquedaDebounced, clientesNivelFiltro]);

  useEffect(() => {
    cargarClientes(negocioMostrado?.id, clientesPagina, clientesBusquedaDebounced, clientesNivelFiltro);
  }, [negocioMostrado?.id, clientesPagina, clientesBusquedaDebounced, clientesNivelFiltro]);

  // clientesData también alimenta la vista previa de Inicio (mismo estado,
  // ver VistaClientes e Inicio más abajo) -- sin esto, una búsqueda que
  // quedó cargada al salir de la sección Clientes seguiría filtrando esa
  // vista previa sin ningún indicio visible de por qué.
  useEffect(() => {
    if (seccionActiva !== 'clientes') setClientesBusqueda('');
  }, [seccionActiva]);

  useEffect(() => {
    if (seccionActiva !== 'canjes') return;
    cargarCanjes(negocioMostrado?.id, canjesPagina);
  }, [negocioMostrado?.id, canjesPagina, seccionActiva]);

  useEffect(() => {
    if (seccionActiva !== 'premios' && seccionActiva !== 'clientes') return;
    // En "Clientes" siempre se pide la página 1 (no premiosPagina, que es
    // la paginación propia de la pantalla "Premios") -- acá los premios
    // sirven para el selector de "Canjear premio" de cada cliente, no para
    // mostrarlos paginados.
    cargarPremios(negocioMostrado?.id, seccionActiva === 'premios' ? premiosPagina : 1);
  }, [negocioMostrado?.id, premiosPagina, seccionActiva]);

  useEffect(() => {
    if (modalCliente !== 'movimientos') return;
    cargarMovimientosCliente(movimientosClientePagina);
  }, [modalCliente, movimientosClientePagina]);

  useEffect(() => {
    if (modalCliente !== 'referidos') return;
    setReferidoCopiado(false);
    cargarReferidos();
  }, [modalCliente]);

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

  // Al entrar a Ajustes se precarga puntosXPeso y el mensaje de registro; la
  // contraseña arranca vacía
  useEffect(() => {
    if (seccionActiva !== 'ajustes') return;
    setFormPuntosXPeso(negocioMostrado?.puntosXPeso ? String(negocioMostrado.puntosXPeso) : '');
    setFormMensajeRegistro(negocioMostrado?.mensajeRegistro || '');
    setFormRegaloCumpleanos(negocioMostrado?.regaloCumpleanosPuntos ? String(negocioMostrado.regaloCumpleanosPuntos) : '');
    setFormPuntosReferido(negocioMostrado?.puntosReferido ? String(negocioMostrado.puntosReferido) : '');
    setFormVencimientoPuntos(negocioMostrado?.vencimientoPuntosMeses ? String(negocioMostrado.vencimientoPuntosMeses) : '');
    setFormSitioWeb(negocioMostrado?.sitioWeb || '');
    setFormSoporte({ email: negocioMostrado?.soporteEmail || '', whatsapp: negocioMostrado?.soporteWhatsapp || '' });
    setFormBasesCondiciones(negocioMostrado?.basesCondiciones || '');
    setFormTema({ ...TEMA_DEFAULT, ...(negocioMostrado?.tema || {}) });
    setFormPassword({ actual: '', nueva: '', confirmar: '' });
  }, [negocioMostrado?.id, seccionActiva]);

  const pts = calcularPuntosPorCompra(parseFloat(monto) || 0, negocioMostrado?.puntosXPeso || 1000);

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
      const clienteAcreditado = negocio.clientes.find(c => c.id === clienteSeleccionado);
      mostrarToast('exito', `+${data.puntosASumados} puntos acreditados a ${clienteAcreditado?.nombre || clienteAcreditado?.email}`);
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
      setNuevoPremio({ nombre: '', puntos: '', emoji: '', tiendanubeProductoId: '', tiendanubeProductoUrl: '', tiendanubeDescuentoPorcentaje: '', tiendanubeDescuentoMonto: '', tiendanubeDescuentoMontoMinimo: '' });
      setMostrarFormPremio(false);
      cargarPremios(negocio.id, premiosPagina);
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al crear el premio. Probá de nuevo.');
    }
  };

  const iniciarEdicionPremio = (p) => {
    setPremioEditandoId(p.id);
    setFormEdicionPremio({
      nombre: p.nombre,
      puntos: p.puntos,
      emoji: p.emoji,
      tiendanubeProductoId: p.tiendanubeProductoId || '',
      tiendanubeProductoUrl: p.tiendanubeProductoUrl || '',
      tiendanubeDescuentoPorcentaje: p.tiendanubeDescuentoPorcentaje || '',
      tiendanubeDescuentoMonto: p.tiendanubeDescuentoMonto || '',
      tiendanubeDescuentoMontoMinimo: p.tiendanubeDescuentoMontoMinimo || '',
    });
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
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarRegaloCumpleanos = async () => {
    if (formRegaloCumpleanos && parseInt(formRegaloCumpleanos) <= 0) {
      alert('Los puntos de regalo de cumpleaños tienen que ser mayores a 0 (o vacío para desactivarlo)');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, regaloCumpleanosPuntos: formRegaloCumpleanos || null })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarPuntosReferido = async () => {
    if (formPuntosReferido && parseInt(formPuntosReferido) <= 0) {
      alert('Los puntos por referido tienen que ser mayores a 0 (o vacío para desactivarlo)');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, puntosReferido: formPuntosReferido || null })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarVencimientoPuntos = async () => {
    if (formVencimientoPuntos && parseInt(formVencimientoPuntos) <= 0) {
      alert('Los meses para el vencimiento tienen que ser mayores a 0 (o vacío para desactivarlo)');
      return;
    }
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, vencimientoPuntosMeses: formVencimientoPuntos || null })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarMensajeRegistro = async () => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, mensajeRegistro: formMensajeRegistro })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarSitioWeb = async () => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, sitioWeb: formSitioWeb })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarSoporte = async () => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, soporteEmail: formSoporte.email, soporteWhatsapp: formSoporte.whatsapp })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarBasesCondiciones = async () => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, basesCondiciones: formBasesCondiciones })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
      cargarNegocios();
    } catch (err) {
      alert('❌ Ocurrió un error al guardar. Probá de nuevo.');
    }
  };

  const guardarTema = async () => {
    try {
      const res = await fetch('/api/negocios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: negocioMostrado.id, tema: formTema })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`❌ Error: ${data.error || 'no se pudo guardar'}`);
        return;
      }
      mostrarToast('exito', 'Guardado');
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
      const res = await fetch(isCliente ? '/api/clientes/password' : '/api/negocios/password', {
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
      if (isCliente) setModalCliente(null);
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
      // la clienta lo tiene que poder mostrar en el negocio o anotarse el
      // código del cupón, no que desaparezca solo.
      if (data.tiendanubeCuponCodigo) {
        const linkProducto = data.tiendanubeProductoUrl ? `\n\nProducto: ${data.tiendanubeProductoUrl}` : '';
        alert(`✅ ¡Canjeaste "${premio.nombre}"!\n\nTu cupón de Tiendanube: ${data.tiendanubeCuponCodigo}\n\nUsalo en el checkout de la tienda — es de un solo uso.${linkProducto}`);
      } else if (data.tiendanubeCuponError) {
        alert(`✅ ¡Canjeaste "${premio.nombre}"! Hubo un problema generando el cupón automáticamente. Contactá al negocio para que te lo entregue.`);
      } else {
        alert(`✅ ¡Canjeaste "${premio.nombre}"! Mostrale esto al negocio para retirarlo.`);
      }
      cargarNegocios();
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al canjear el premio.');
    } finally {
      setCanjeandoId(null);
    }
  };

  // El negocio canjea un premio a nombre de un cliente (atención
  // presencial sin que la clienta tenga que usar su propio panel) -- mismo
  // endpoint que canjearPremio, el backend ya autoriza a un negocio a
  // canjear premios propios para clientes propios (ver app/api/canjes).
  const canjearPremioParaCliente = async (cliente) => {
    const premioId = premioParaCanjear;
    if (!premioId) return;
    const premio = (premiosData?.items || []).find(p => p.id === premioId);
    setCanjeandoClienteId(cliente.id);
    try {
      const res = await fetch('/api/canjes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premioId, clienteId: cliente.id })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo canjear el premio');
        return;
      }
      const nombreCliente = cliente.nombre || cliente.email;
      // Alert bloqueante a propósito, mismo criterio que canjearPremio: si
      // se generó un cupón de Tiendanube, alguien lo tiene que poder leer
      // y anotar con calma, no que desaparezca solo como un toast.
      if (data.tiendanubeCuponCodigo) {
        alert(`✅ Canjeaste "${premio?.nombre}" para ${nombreCliente}.\n\nCupón de Tiendanube: ${data.tiendanubeCuponCodigo}\n\nEs de un solo uso.`);
      } else if (data.tiendanubeCuponError) {
        alert(`✅ Canjeaste "${premio?.nombre}" para ${nombreCliente}. Hubo un problema generando el cupón automáticamente — entregale el descuento a mano.`);
      } else {
        alert(`✅ Canjeaste "${premio?.nombre}" para ${nombreCliente}.`);
      }
      setPremioParaCanjear('');
      cargarClientes(negocioMostrado?.id, clientesPagina, clientesBusquedaDebounced, clientesNivelFiltro);
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error al canjear el premio.');
    } finally {
      setCanjeandoClienteId(null);
    }
  };

  // Controles de "Anterior / Página X de Y / Siguiente", reutilizados en Clientes y Canjes
  const Paginador = ({ pagina, totalPages, onCambiar }) => {
    if (!totalPages || totalPages <= 1) return null;
    const boton = (deshabilitado) => ({ ...ui.botonChico, cursor: deshabilitado ? 'not-allowed' : 'pointer', opacity: deshabilitado ? 0.45 : 1 });
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
        <button type="button" className="fid-btn-secondary" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} style={boton(pagina <= 1)}>Anterior</button>
        <span style={{ fontSize: 13, color: tema.textoSecundario }}>Página {pagina} de {totalPages}</span>
        <button type="button" className="fid-btn-secondary" onClick={() => onCambiar(pagina + 1)} disabled={pagina >= totalPages} style={boton(pagina >= totalPages)}>Siguiente</button>
      </div>
    );
  };

  // Ícono girando para estados de carga breves (listas, estadísticas).
  // Usa currentColor (heredado del `style.color` que se le pase) para andar
  // bien con cualquier tema de marca propia.
  const Spinner = ({ size = 16, color }) => (
    <span className="fid-spinner" style={{ width: size, height: size, color: color || tema.primario }} />
  );

  // Grilla para elegir el ícono de un premio (ver lib/premioIconos.js) en vez
  // de tipear un emoji a mano.
  const SelectorIconoPremio = ({ value, onChange }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {ICONOS_PREMIO.map(({ clave, Icono }) => (
        <button
          key={clave}
          type="button"
          onClick={() => onChange(clave)}
          title={clave}
          style={{
            width: 36,
            height: 36,
            borderRadius: 2,
            border: `1px solid ${value === clave ? tema.primario : tema.borde}`,
            background: value === clave ? tema.primario : tema.superficie,
            color: value === clave ? tema.primarioTexto : tema.texto,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icono size={16} strokeWidth={2} />
        </button>
      ))}
    </div>
  );

  // Confirmación visual breve para acciones que se guardan bien o fallan.
  // Colores fijos (no atados a `tema`) para verse igual en el chrome del
  // Admin, que nunca se tematiza, y en los paneles de negocio/cliente.
  // No se usa para mensajes de éxito que hay que conservar (contraseña
  // generada al crear cliente/negocio, comprobante de canje) — esos siguen
  // siendo un alert() bloqueante a propósito, en vez de este toast que
  // desaparece solo.
  // El cierre automático va en un efecto (no en un ref): cada toast nuevo es
  // un objeto nuevo, así que reinicia el plazo igual que antes.
  const mostrarToast = (tipo, mensaje) => setToast({ tipo, mensaje });
  useEffect(() => {
    if (!toast) return;
    const plazo = setTimeout(() => setToast(null), toast.tipo === 'error' ? 4000 : 2500);
    return () => clearTimeout(plazo);
  }, [toast]);

  // Escape cierra el menú y las ventanas que estén abiertas (el teclado no
  // tenía forma de salir de una ventana sin llegar hasta su botón).
  useEffect(() => {
    const alApretar = (e) => {
      if (e.key !== 'Escape') return;
      setModalCliente(null);
      setMostrarMenuCliente(false);
      setMostrarInfoNiveles(false);
    };
    window.addEventListener('keydown', alApretar);
    return () => window.removeEventListener('keydown', alApretar);
  }, []);

  // Resultado del OAuth2 de Tiendanube (ver app/api/tiendanube/callback,
  // que redirige de vuelta acá con esto en la URL) — se muestra una vez
  // como toast y se limpia de la URL para que no reaparezca en un refresh.
  useEffect(() => {
    const resultado = new URLSearchParams(window.location.search).get('tiendanube');
    if (!resultado) return;
    const mensajes = {
      conectado: ['exito', 'Tiendanube conectado correctamente'],
      'conectado-sin-webhook': ['error', 'Tiendanube conectado, pero no se pudo confirmar el aviso automático de pedidos pagados — avisale a soporte'],
      error: ['error', 'No se pudo conectar con Tiendanube. Probá de nuevo.'],
      'ya-conectada': ['error', 'Esa tienda de Tiendanube ya está conectada a otro negocio'],
    };
    const [tipo, mensaje] = mensajes[resultado] || ['error', 'No se pudo conectar con Tiendanube'];
    mostrarToast(tipo, mensaje);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const Toast = () => {
    if (!toast) return null;
    const exito = toast.tipo === 'exito';
    return (
      <div
        role={exito ? 'status' : 'alert'}
        style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderRadius: 2,
          background: exito ? '#17191b' : '#7f1d1d', color: '#ffffff',
          fontSize: 14, fontFamily: FUENTE_TEXTO, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          maxWidth: '90vw'
        }}
        className="fid-toast"
      >
        {exito ? <Check size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />} {toast.mensaje}
      </div>
    );
  };

  // El cupón de Tiendanube de un canje que falló al canjear (los puntos ya
  // se descontaron en ese momento; esto solo genera el cupón que faltó).
  const reintentarCupon = async (canjeId) => {
    setReintentandoCuponId(canjeId);
    try {
      const res = await fetch('/api/canjes/reintentar-cupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canjeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast('error', data.error || 'No se pudo generar el cupón');
      } else {
        mostrarToast('exito', `Cupón generado: ${data.tiendanubeCuponCodigo}`);
      }
      cargarCanjes(negocioMostrado?.id, canjesPagina);
    } catch (err) {
      mostrarToast('error', 'Ocurrió un error. Probá de nuevo.');
    } finally {
      setReintentandoCuponId(null);
    }
  };

  // Mensajes de "cargando" y de lista vacía, iguales en todas las pantallas.
  const Cargando = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: tema.textoSecundario, padding: '14px 0' }}><Spinner size={14} /> Cargando...</div>
  );
  const Vacio = ({ children }) => (
    <p style={{ fontSize: 14, color: tema.textoSecundario, lineHeight: 1.5, margin: 0, padding: '14px 0' }}>{children}</p>
  );

  // Título de un bloque dentro de una pantalla (línea fina arriba, serif).
  const TituloBloque = ({ children, accion }) => (
    <div style={{ ...ui.seccion, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
      <h2 style={ui.titulo(24)}>{children}</h2>
      {accion}
    </div>
  );

  // Historial de canjes del negocio completo
  const VistaCanjes = () => (
    <div>
      {!canjesData && <Cargando />}
      {canjesData && canjesData.items.length === 0 && <Vacio>Todavía no hay canjes. Cuando una clienta canjee un premio (desde su panel o acá en el local), aparece en esta lista con su cupón si es para la tienda online.</Vacio>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: canjesData?.items.length ? `1px solid ${tema.texto}` : 'none' }}>
        {canjesData?.items.map(c => (
          <li key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: `1px solid ${tema.borde}` }}>
            <span aria-hidden="true" style={{ display: 'flex', color: tema.primarioLegible, paddingTop: 4 }}><IconoPremio nombre={c.premio.emoji} size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 19, lineHeight: 1.25 }}>{c.premio.nombre}</div>
              <div style={{ fontSize: 13, color: tema.textoSecundario, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente.nombre || c.cliente.email} · {new Date(c.createdAt).toLocaleDateString('es-AR')}</div>
              {c.tiendanubeCuponCodigo && <div style={{ fontSize: 13, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Ticket size={13} aria-hidden="true" /> Cupón <strong style={{ letterSpacing: '0.04em' }}>{c.tiendanubeCuponCodigo}</strong></div>}
              {c.tiendanubeCuponError && !c.tiendanubeCuponCodigo && (
                <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <AlertTriangle size={13} aria-hidden="true" /> {c.tiendanubeCuponError}
                  <button
                    type="button"
                    className="fid-btn-secondary"
                    onClick={() => reintentarCupon(c.id)}
                    disabled={reintentandoCuponId === c.id}
                    style={{ ...ui.botonChico, cursor: reintentandoCuponId === c.id ? 'wait' : 'pointer' }}
                  >
                    {reintentandoCuponId === c.id ? 'Reintentando...' : 'Reintentar cupón'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ ...ui.numero, fontSize: 15, flexShrink: 0, paddingTop: 3 }}>−{formatearMiles(c.premio.puntos)}</div>
          </li>
        ))}
      </ul>
      <Paginador pagina={canjesData?.page || 1} totalPages={canjesData?.totalPages} onCambiar={setCanjesPagina} />
    </div>
  );

  // Link de WhatsApp con un mensaje sugerido a partir de datos reales del
  // cliente (cuánto le falta para el próximo premio que todavía no puede
  // pagar) — wa.me no necesita ninguna cuenta ni API key: el negocio lo
  // revisa y lo manda desde su propio WhatsApp. El número se usa tal cual
  // está cargado (solo se le sacan los caracteres que no son dígitos): si
  // no abre el chat esperado, hay que revisar cómo lo cargó esa clienta en
  // particular al registrarse.
  const armarLinkWhatsapp = (c) => {
    if (!c.telefono) return null;
    const numero = c.telefono.replace(/\D/g, '');
    const club = nombreClub(negocioMostrado?.nombre || '');
    const proximoPremio = (premiosData?.items || [])
      .filter(p => p.activo && p.puntos > c.puntos)
      .sort((a, b) => a.puntos - b.puntos)[0];

    // Sin el ícono del premio: Premio.emoji ahora guarda una clave interna
    // ("gift", "percent"...), no un emoji que se pueda pegar en un mensaje.
    const mensaje = proximoPremio
      ? `¡Hola${c.nombre ? ' ' + c.nombre : ''}! Te faltan ${proximoPremio.puntos - c.puntos} puntos en ${club} para canjear "${proximoPremio.nombre}". ¡Te esperamos en tu próxima compra!`
      : `¡Hola${c.nombre ? ' ' + c.nombre : ''}! Tenés ${c.puntos} puntos acumulados en ${club}. ¡Vení a canjearlos!`;

    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  };

  const VistaClientes = () => (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px', minWidth: 0 }}>
          <span style={ui.label}>Buscar por nombre, email o celular</span>
          <input
            type="search"
            value={clientesBusqueda}
            onChange={e => setClientesBusqueda(e.target.value)}
            placeholder="Ej. Lucía"
            style={{ ...ui.input, border: 'none', borderBottom: `1px solid ${tema.texto}`, background: 'transparent', padding: '10px 0', fontSize: 16 }}
          />
        </label>
        <label style={{ flex: '0 1 200px' }}>
          <span style={ui.label}>Nivel</span>
          <select value={clientesNivelFiltro} onChange={e => setClientesNivelFiltro(e.target.value)} style={ui.input}>
            <option value="">Todos los niveles</option>
            <option value="bronce">Bronce</option>
            <option value="plata">Plata</option>
            <option value="oro">Oro</option>
            <option value="diamante">Diamante</option>
            <option value="vip">VIP</option>
          </select>
        </label>
        <a
          href={`/api/clientes/exportar?negocioId=${negocioMostrado?.id}${clientesBusquedaDebounced.trim() ? `&q=${encodeURIComponent(clientesBusquedaDebounced.trim())}` : ''}${clientesNivelFiltro ? `&nivel=${encodeURIComponent(clientesNivelFiltro)}` : ''}`}
          className="fid-btn-secondary"
          style={{ ...ui.botonSecundario, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          <Download size={15} aria-hidden="true" /> Exportar
        </a>
        <div style={{ position: 'relative' }}>
          {/* onClick en vez de title: los tooltips nativos no se pueden
              "tocar" en celular (no hay hover en touch) — con esto anda
              igual con mouse o con el dedo. */}
          <button type="button" onClick={() => setMostrarInfoNiveles(v => !v)} aria-expanded={mostrarInfoNiveles} style={{ ...ui.botonTexto, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 42, color: tema.textoSecundario }}>
            <Info size={15} aria-hidden="true" /> Cómo se calculan los niveles
          </button>
          {mostrarInfoNiveles && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 10, background: tema.superficie, border: `1px solid ${tema.texto}`, padding: '14px 16px', fontSize: 13, color: tema.texto, minWidth: 250, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Según los puntos ganados en total (no el saldo):</div>
              {descripcionNiveles().split('\n').map((linea, i) => <div key={i}>{linea}</div>)}
              <button type="button" onClick={() => setMostrarInfoNiveles(false)} className="fid-link" style={{ ...ui.botonTexto, marginTop: 8 }}>Cerrar</button>
            </div>
          )}
        </div>
      </div>

      {!clientesData && <Cargando />}
      {clientesData && clientesData.items.length === 0 && (
        <Vacio>
          {clientesBusqueda.trim() || clientesNivelFiltro ? 'No encontramos clientes que coincidan con ese filtro.' : 'Todavía no hay clientes. Se suman cuando se registran desde el link o el QR del club.'}
        </Vacio>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: clientesData?.items.length ? `1px solid ${tema.texto}` : 'none' }}>
        {clientesData?.items.map(c => {
          const s = c.stats || {};
          const dias = s.ultimaActividad ? Math.floor((Date.now() - new Date(s.ultimaActividad).getTime()) / (1000 * 60 * 60 * 24)) : null;
          const expandido = clienteExpandidoId === c.id;
          const linkWhatsapp = armarLinkWhatsapp(c);
          return (
            <li key={c.id} style={{ borderBottom: `1px solid ${tema.borde}` }}>
              <button
                type="button"
                className="fid-row-hover"
                aria-expanded={expandido}
                onClick={() => { setClienteExpandidoId(expandido ? null : c.id); setPremioParaCanjear(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 4px', width: '100%', border: 'none', background: 'transparent', color: tema.texto, textAlign: 'left', cursor: 'pointer' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: tema.fuenteTitulo, fontSize: 19, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre || c.email}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: tema.textoSecundario, minWidth: 0 }}>
                    {s.nivel && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: s.nivel.color }} />{s.nivel.nombre} ·
                      </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}{c.telefono ? ` · ${c.telefono}` : ''}</span>
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', ...ui.numero, fontSize: 16 }}>{formatearMiles(c.puntos)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: colorInactividad(dias, tema.textoSecundario) }}>{formatearFechaRelativa(s.ultimaActividad)}</span>
                </span>
              </button>

              {expandido && (
                <div style={{ padding: '4px 4px 20px', display: 'grid', gap: 14 }}>
                  <div style={{ fontSize: 13, color: tema.textoSecundario }}>
                    Cliente desde {new Date(c.createdAt).toLocaleDateString('es-AR')}
                    {s.fechaPrimeraCompra && ` · Primera compra: ${new Date(s.fechaPrimeraCompra).toLocaleDateString('es-AR')}`}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: `1px solid ${tema.borde}`, borderBottom: `1px solid ${tema.borde}` }}>
                    {[
                      ['Compras registradas', s.comprasRegistradas ?? 0],
                      ['Frecuencia habitual', s.frecuenciaPromedioDias ? `Cada ${s.frecuenciaPromedioDias} días` : '—'],
                      ['Ticket promedio', s.ticketPromedio ? `$${formatearMiles(s.ticketPromedio)}` : '—'],
                    ].map(([etiqueta, valor]) => (
                      <div key={etiqueta} style={{ flex: '1 1 140px', padding: '10px 12px 10px 0' }}>
                        <div style={ui.etiqueta}>{etiqueta}</div>
                        <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 22, marginTop: 2 }}>{valor}</div>
                      </div>
                    ))}
                  </div>

                  {dias != null && dias >= 30 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#9a3412', borderLeft: '2px solid #c2410c', paddingLeft: 10 }}>
                      <AlertTriangle size={15} aria-hidden="true" /> {s.frecuenciaPromedioDias ? `Solía comprar cada ${s.frecuenciaPromedioDias} días. ` : ''}Hace {dias} días que no vuelve.
                    </div>
                  )}

                  {linkWhatsapp ? (
                    <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="fid-btn-secondary" style={{ ...ui.botonSecundario, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', width: 'fit-content' }}>
                      <MessageCircle size={15} aria-hidden="true" /> Escribirle por WhatsApp
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: tema.textoSecundario }}>Sin celular cargado — no se le puede mandar WhatsApp.</div>
                  )}

                  {/* Canje presencial: la empleada elige el premio y lo
                      confirma acá mismo, sin que la clienta necesite su
                      propio celular -- mismo endpoint que usa la clienta
                      desde su panel (POST /api/canjes), el backend ya
                      valida puntos suficientes y descuenta automáticamente. */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <span style={ui.label}>Canjear un premio en el local</span>
                      <select value={premioParaCanjear} onChange={e => setPremioParaCanjear(e.target.value)} style={ui.input}>
                        <option value="">Elegí un premio...</option>
                        {(premiosData?.items || []).filter(p => p.activo).map(p => (
                          <option key={p.id} value={p.id} disabled={p.puntos > c.puntos}>
                            {p.nombre} — {p.puntos} pts{p.puntos > c.puntos ? ' (puntos insuficientes)' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="fid-btn-primary"
                      onClick={() => canjearPremioParaCliente(c)}
                      disabled={!premioParaCanjear || canjeandoClienteId === c.id}
                      style={{ ...ui.botonPrimario, cursor: (!premioParaCanjear || canjeandoClienteId === c.id) ? 'not-allowed' : 'pointer', opacity: (!premioParaCanjear || canjeandoClienteId === c.id) ? 0.5 : 1 }}
                    >
                      {canjeandoClienteId === c.id ? 'Canjeando...' : 'Canjear'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
    </div>
  );

  // Campos de Tiendanube de un premio (alta y edición usan los mismos).
  const camposTiendanubePremio = (form, setForm) => (
    <>
      <p style={{ ...ui.ayuda, gridColumn: '1 / -1', margin: '6px 0 0' }}>Tienda online (opcional): completá el ID de producto para un premio que da un producto puntual, el % de descuento para uno de descuento en toda la tienda, o descuento fijo + compra mínima (ej. $70.000 en compras desde $140.000). No hace falta cargar ninguno.</p>
      <label><span style={ui.label}>ID de producto</span><input value={form.tiendanubeProductoId} onChange={e => setForm({ ...form, tiendanubeProductoId: e.target.value })} placeholder="123456789" style={ui.input} /></label>
      <label><span style={ui.label}>URL del producto</span><input value={form.tiendanubeProductoUrl} onChange={e => setForm({ ...form, tiendanubeProductoUrl: e.target.value })} placeholder="https://peperina.com/productos/..." style={ui.input} /></label>
      <label><span style={ui.label}>% de descuento</span><input type="number" value={form.tiendanubeDescuentoPorcentaje} onChange={e => setForm({ ...form, tiendanubeDescuentoPorcentaje: e.target.value })} placeholder="10" style={ui.input} /></label>
      <label><span style={ui.label}>Descuento fijo ($)</span><input type="number" value={form.tiendanubeDescuentoMonto} onChange={e => setForm({ ...form, tiendanubeDescuentoMonto: e.target.value })} placeholder="70000" style={ui.input} /></label>
      <label><span style={ui.label}>Compra mínima ($)</span><input type="number" value={form.tiendanubeDescuentoMontoMinimo} onChange={e => setForm({ ...form, tiendanubeDescuentoMontoMinimo: e.target.value })} placeholder="140000" style={ui.input} /></label>
    </>
  );

  // Alta, edición y activar/desactivar premios del negocio
  const VistaPremios = () => (
    <div>
      {mostrarFormPremio && (
        <div style={{ marginBottom: 36 }}>
          <TituloBloque>Nuevo premio</TituloBloque>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '12px 0 14px' }}>
            <label><span style={ui.label}>Nombre *</span><input value={nuevoPremio.nombre} onChange={e => setNuevoPremio({...nuevoPremio, nombre: e.target.value})} placeholder="Pañuelo de seda" style={ui.input} /></label>
            <label><span style={ui.label}>Puntos *</span><input type="number" value={nuevoPremio.puntos} onChange={e => setNuevoPremio({...nuevoPremio, puntos: e.target.value})} placeholder="5000" style={ui.input} /></label>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={ui.label}>Ícono *</span>
            <SelectorIconoPremio value={nuevoPremio.emoji} onChange={clave => setNuevoPremio({...nuevoPremio, emoji: clave})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
            {camposTiendanubePremio(nuevoPremio, setNuevoPremio)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="fid-btn-primary" onClick={crearPremio} style={ui.botonPrimario}>Guardar premio</button>
            <button type="button" className="fid-btn-secondary" onClick={() => setMostrarFormPremio(false)} style={ui.botonSecundario}>Cancelar</button>
          </div>
        </div>
      )}

      {!premiosData && <Cargando />}
      {premiosData && premiosData.items.length === 0 && <Vacio>Todavía no hay premios. Creá el primero con &quot;Nuevo premio&quot;: las clientas lo ven en su panel con cuántos puntos les faltan.</Vacio>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: premiosData?.items.length ? `1px solid ${tema.texto}` : 'none' }}>
        {premiosData?.items.map(p => (
          <li key={p.id} style={{ padding: '14px 0', borderBottom: `1px solid ${tema.borde}` }}>
            {premioEditandoId === p.id ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <label><span style={ui.label}>Nombre</span><input value={formEdicionPremio.nombre} onChange={e => setFormEdicionPremio({...formEdicionPremio, nombre: e.target.value})} style={ui.input} /></label>
                  <label><span style={ui.label}>Puntos</span><input type="number" value={formEdicionPremio.puntos} onChange={e => setFormEdicionPremio({...formEdicionPremio, puntos: e.target.value})} style={ui.input} /></label>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <span style={ui.label}>Ícono</span>
                  <SelectorIconoPremio value={formEdicionPremio.emoji} onChange={clave => setFormEdicionPremio({...formEdicionPremio, emoji: clave})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
                  {camposTiendanubePremio(formEdicionPremio, setFormEdicionPremio)}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="fid-btn-primary" onClick={guardarEdicionPremio} style={ui.botonPrimario}>Guardar</button>
                  <button type="button" className="fid-btn-secondary" onClick={() => setPremioEditandoId(null)} style={ui.botonSecundario}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, opacity: p.activo ? 1 : 0.55 }}>
                <span aria-hidden="true" style={{ display: 'flex', color: tema.primarioLegible, paddingTop: 4 }}><IconoPremio nombre={p.emoji} size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 19, lineHeight: 1.25 }}>{p.nombre}{!p.activo && <span style={{ marginLeft: 8, fontFamily: FUENTE_TEXTO, fontSize: 12, color: tema.textoSecundario }}>Desactivado</span>}</div>
                  <div style={{ fontSize: 13, color: tema.textoSecundario, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 }}>
                    <span style={ui.numero}>{formatearMiles(p.puntos)} puntos</span>
                    {p.tiendanubeProductoId && <span>· con precio de la tienda online</span>}
                    {p.tiendanubeProductoUrl && (
                      <span>· <a href={p.tiendanubeProductoUrl} target="_blank" rel="noopener noreferrer" className="fid-link" style={{ color: tema.textoSecundario, display: 'inline-flex', alignItems: 'center', gap: 3 }}><LinkIcon size={12} aria-hidden="true" /> ver producto</a></span>
                    )}
                    {p.tiendanubeDescuentoPorcentaje ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>· <Ticket size={12} aria-hidden="true" /> cupón {p.tiendanubeDescuentoPorcentaje}%</span> : null}
                    {p.tiendanubeDescuentoMonto ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>· <Ticket size={12} aria-hidden="true" /> cupón ${formatearMiles(p.tiendanubeDescuentoMonto)}{p.tiendanubeDescuentoMontoMinimo ? ` (compra mín. $${formatearMiles(p.tiendanubeDescuentoMontoMinimo)})` : ''}</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, paddingTop: 4 }}>
                  <button type="button" className="fid-link" onClick={() => iniciarEdicionPremio(p)} style={ui.botonTexto}>Editar</button>
                  <button type="button" className="fid-link" onClick={() => togglePremioActivo(p)} style={{ ...ui.botonTexto, color: p.activo ? '#b91c1c' : '#15803d' }}>{p.activo ? 'Desactivar' : 'Reactivar'}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Paginador pagina={premiosData?.page || 1} totalPages={premiosData?.totalPages} onCambiar={setPremiosPagina} />
    </div>
  );

  // Estado "Conectada"/"No conectada" reutilizado en cada integración
  const BadgeConexion = ({ conectada }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: conectada ? '#15803d' : tema.textoSecundario }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: conectada ? '#16a34a' : tema.borde }} />
      {conectada ? 'Conectada' : 'No conectada'}
    </span>
  );

  // Una línea sobre el agente de la caja: la usan Integraciones (detallada)
  // e Inicio (resumida).
  const estadoCaja = (negocio) => {
    const { estado, minutos } = estadoAgente(negocio?.dragonfishUltimoContacto);
    const colores = { activo: '#16a34a', demorado: '#d97706', sin_conexion: '#dc2626', nunca: tema.borde };
    const textos = {
      activo: `Agente funcionando — último contacto ${textoTiempo(minutos)}.`,
      demorado: `El agente no se reporta ${textoTiempo(minutos)}. Puede ser un corte de internet momentáneo.`,
      sin_conexion: `El agente no se reporta ${textoTiempo(minutos)}. Si la PC del local está prendida, revisá que el agente esté corriendo (ver guía).`,
      nunca: 'El agente todavía no se conectó nunca con este token.',
    };
    const cortos = {
      activo: `reportó ${textoTiempo(minutos)}`,
      demorado: `sin reportar ${textoTiempo(minutos)}`,
      sin_conexion: `sin reportar ${textoTiempo(minutos)}`,
      nunca: 'todavía no se conectó',
    };
    return { color: colores[estado], texto: textos[estado], corto: cortos[estado] };
  };

  // Alta/edición de las integraciones del negocio (Tiendanube, Mercado Pago,
  // Dragon Fish)
  const VistaIntegraciones = () => (
    <div style={{ display: 'grid', gap: 40, maxWidth: 680 }}>
      <section>
        <TituloBloque accion={<BadgeConexion conectada={negocioMostrado?.tiendanubeConectado} />}>Tienda online (Tiendanube)</TituloBloque>
        {negocioMostrado?.tiendanubeOAuthDisponible && (
          <div style={{ margin: '12px 0 16px' }}>
            <a href={`/api/tiendanube/conectar?negocioId=${negocioMostrado?.id}`} className="fid-btn-secondary" style={{ ...ui.botonSecundario, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              {negocioMostrado?.tiendanubeConectado ? 'Reconectar con Tiendanube' : 'Conectar con Tiendanube'}
            </a>
            <p style={{ ...ui.ayuda, marginTop: 8 }}>Te lleva a Tiendanube para autorizar el acceso — no hace falta pegar el token a mano.</p>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
          <label><span style={ui.label}>Store ID {negocioMostrado?.tiendanubeOAuthDisponible && '(o conectá arriba)'}</span><input value={formIntegraciones.tiendanubeStoreId} onChange={e => setFormIntegraciones({...formIntegraciones, tiendanubeStoreId: e.target.value})} placeholder="123456" style={ui.input} /></label>
          <label><span style={ui.label}>Access Token</span><input type="password" value={formIntegraciones.tiendanubeAccessToken} onChange={e => setFormIntegraciones({...formIntegraciones, tiendanubeAccessToken: e.target.value})} placeholder={negocioMostrado?.tiendanubeConectado ? '•••••••• (ya cargado)' : 'Pegar token acá'} style={ui.input} /></label>
        </div>
      </section>

      <section>
        <TituloBloque accion={<BadgeConexion conectada={!!negocioMostrado?.slug} />}>Mercado Pago</TituloBloque>
        <label style={{ display: 'block', marginTop: 12 }}><span style={ui.label}>Identificador del negocio (slug)</span><input value={formIntegraciones.slug} onChange={e => setFormIntegraciones({...formIntegraciones, slug: e.target.value})} placeholder="mi-negocio" style={ui.input} /></label>
        <p style={{ ...ui.ayuda, marginTop: 8 }}>Solo minúsculas, números y guiones. Cambiarlo rompe links de pago ya compartidos.</p>
      </section>

      <section>
        <TituloBloque accion={<BadgeConexion conectada={negocioMostrado?.dragonfishConectado} />}>Caja del local (Dragon Fish)</TituloBloque>
        <label style={{ display: 'block', margin: '12px 0 14px' }}><span style={ui.label}>Base de datos (nombre en Dragon Fish)</span><input value={formIntegraciones.dragonfishBaseDeDatos} onChange={e => setFormIntegraciones({...formIntegraciones, dragonfishBaseDeDatos: e.target.value})} placeholder="PEPERINA" style={ui.input} /></label>
        {negocioMostrado?.dragonfishConectado && (() => {
          const caja = estadoCaja(negocioMostrado);
          return (
            <div role="status" style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: caja.color, flexShrink: 0, marginTop: 7 }} />
                <span>{caja.texto}</span>
              </div>
              {negocioMostrado?.dragonfishPendientes > 0 && (
                <div style={{ color: tema.textoSecundario, marginTop: 4, marginLeft: 16 }}>
                  {negocioMostrado.dragonfishPendientes === 1 ? '1 venta esperando que el agente la procese.' : `${negocioMostrado.dragonfishPendientes} ventas esperando que el agente las procese.`}
                </div>
              )}
            </div>
          );
        })()}
        <button type="button" className="fid-btn-secondary" onClick={generarTokenDragonfish} style={ui.botonSecundario}>
          {negocioMostrado?.dragonfishConectado ? 'Regenerar token del agente' : 'Generar token del agente'}
        </button>
        <p style={{ ...ui.ayuda, marginTop: 8 }}>El token se usa para configurar el agente que corre en la PC del local — se muestra una sola vez al generarlo.</p>
      </section>

      <div><button type="button" className="fid-btn-primary" onClick={guardarIntegraciones} style={ui.botonPrimario}>Guardar integraciones</button></div>
    </div>
  );

  // Un bloque de Ajustes: título, explicación, el campo y su botón Guardar.
  // Se llama como función (no como <Componente/>) para que los inputs no
  // pierdan el foco al tipear.
  const bloqueAjuste = (titulo, descripcion, campo, onGuardar, textoBoton = 'Guardar') => (
    <section>
      <TituloBloque>{titulo}</TituloBloque>
      {descripcion && <p style={{ ...ui.ayuda, marginTop: 8 }}>{descripcion}</p>}
      <div style={{ marginBottom: 14, marginTop: descripcion ? 0 : 12 }}>{campo}</div>
      <button type="button" className="fid-btn-primary" onClick={onGuardar} style={ui.botonPrimario}>{textoBoton}</button>
    </section>
  );

  // Cuenta del negocio: cambio de contraseña y configuración de puntos
  const VistaAjustes = () => (
    <div style={{ display: 'grid', gap: 40, maxWidth: 640 }}>
      <section>
        <TituloBloque>Cuenta</TituloBloque>
        <p style={{ fontSize: 14, color: tema.textoSecundario, margin: '10px 0 0' }}>Email de acceso: <strong style={{ color: tema.texto }}>{session?.user?.email}</strong></p>
      </section>

      {bloqueAjuste('Puntos por compra', 'Cuántos pesos gastados equivalen a 1 punto.', (
        <input type="number" min="1" aria-label="Pesos por punto" value={formPuntosXPeso} onChange={e => setFormPuntosXPeso(e.target.value)} placeholder="1000" style={ui.input} />
      ), guardarPuntosXPeso)}

      {bloqueAjuste('Regalo de cumpleaños', 'Puntos que se acreditan solos el día del cumpleaños de cada cliente (necesita que haya cargado su fecha de nacimiento al registrarse). Dejalo vacío para desactivarlo.', (
        <input type="number" min="1" aria-label="Puntos de regalo de cumpleaños" value={formRegaloCumpleanos} onChange={e => setFormRegaloCumpleanos(e.target.value)} placeholder="Desactivado" style={ui.input} />
      ), guardarRegaloCumpleanos)}

      {bloqueAjuste('Programa de referidos', 'Puntos que ganan tanto quien invita como la persona invitada cuando esta hace su primera compra (mismo monto para las dos). Cada cliente tiene su propio link para compartir, en “Referí a una amiga” desde su panel. Dejalo vacío para desactivarlo.', (
        <input type="number" min="1" aria-label="Puntos por referido" value={formPuntosReferido} onChange={e => setFormPuntosReferido(e.target.value)} placeholder="Desactivado" style={ui.input} />
      ), guardarPuntosReferido)}

      {bloqueAjuste('Vencimiento de puntos', 'Meses sin usar los puntos de una compra para que esa compra venza (cada compra vence por separado, según su propia fecha). Dejalo vacío para desactivarlo.', (
        <input type="number" min="1" aria-label="Meses hasta el vencimiento" value={formVencimientoPuntos} onChange={e => setFormVencimientoPuntos(e.target.value)} placeholder="Desactivado" style={ui.input} />
      ), guardarVencimientoPuntos)}

      <section>
        <TituloBloque>Colores de marca</TituloBloque>
        <p style={{ ...ui.ayuda, marginTop: 8 }}>Así se ve tu panel y el de tus clientas. Se aplican cuando tocás &quot;Guardar&quot;. Si alguna combinación no se lee bien, el panel oscurece un poco ese color al mostrarlo (lo que guardás no cambia).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
          {[
            ['fondo', 'Fondo'],
            ['superficie', 'Superficies'],
            ['borde', 'Líneas'],
            ['texto', 'Texto'],
            ['textoSecundario', 'Texto secundario'],
            ['primario', 'Acento'],
            ['primarioTexto', 'Texto sobre acento'],
            ['resaltado', 'Resaltado'],
          ].map(([clave, etiqueta]) => (
            <label key={clave}>
              <span style={{ ...ui.label, fontSize: 12 }}>{etiqueta}</span>
              <input type="color" value={formTema[clave]} onChange={e => setFormTema({...formTema, [clave]: e.target.value})} style={{ width: '100%', height: 34, padding: 0, borderRadius: 2, border: `1px solid ${tema.borde}`, cursor: 'pointer' }} />
            </label>
          ))}
        </div>
        <label style={{ display: 'block', marginBottom: 14 }}><span style={ui.label}>Tipografía de títulos (ej: Georgia, serif)</span><input value={formTema.fuenteTitulo} onChange={e => setFormTema({...formTema, fuenteTitulo: e.target.value})} style={ui.input} /></label>
        <label style={{ display: 'block', marginBottom: 14 }}><span style={ui.label}>Imagen de portada (URL)</span><input value={formTema.imagenPortada} onChange={e => setFormTema({...formTema, imagenPortada: e.target.value})} placeholder="https://..." style={ui.input} /></label>
        <button type="button" className="fid-btn-primary" onClick={guardarTema} style={ui.botonPrimario}>Guardar</button>
      </section>

      {bloqueAjuste('Mensaje de bienvenida', 'Se muestra en la página del club (la del QR y el link para sumarse) y en la pantalla de registro. Dejalo vacío para usar el texto genérico.', (
        <textarea maxLength={300} rows={3} aria-label="Mensaje de bienvenida" value={formMensajeRegistro} onChange={e => setFormMensajeRegistro(e.target.value)} placeholder="Ej: ¡Sumate y a las 6 hamburguesas la 7ma es gratis!" style={{ ...ui.input, resize: 'vertical' }} />
      ), guardarMensajeRegistro)}

      {bloqueAjuste('Sitio web', 'Tu tienda online u otro sitio propio — aparece como link en el panel de tus clientes. Dejalo vacío para no mostrar nada.', (
        <input type="url" aria-label="Sitio web" value={formSitioWeb} onChange={e => setFormSitioWeb(e.target.value)} placeholder="https://tu-tienda.com" style={ui.input} />
      ), guardarSitioWeb)}

      {bloqueAjuste('Contacto de soporte', 'Dónde te escriben tus clientas si tienen una duda (aparece en el menú de su panel). Podés cargar uno, los dos, o ninguno — si no cargás nada, la opción no se muestra.', (
        <div style={{ display: 'grid', gap: 12 }}>
          <label htmlFor="soporte-email"><span style={ui.label}>Email</span><input id="soporte-email" type="email" value={formSoporte.email} onChange={e => setFormSoporte({ ...formSoporte, email: e.target.value })} placeholder="hola@tunegocio.com" style={ui.input} /></label>
          <label htmlFor="soporte-whatsapp"><span style={ui.label}>WhatsApp (con código de país y área, ej. 5492324123456)</span><input id="soporte-whatsapp" type="tel" inputMode="numeric" value={formSoporte.whatsapp} onChange={e => setFormSoporte({ ...formSoporte, whatsapp: e.target.value })} placeholder="5492324123456" style={ui.input} /></label>
        </div>
      ), guardarSoporte)}

      {bloqueAjuste('Bases y condiciones', 'El texto legal del programa de puntos que ve tu clienta en "Bases y condiciones" (menú de su panel). Dejalo vacío si todavía no lo tenés — se le va a avisar que falta cargarlo.', (
        <textarea rows={10} aria-label="Bases y condiciones" value={formBasesCondiciones} onChange={e => setFormBasesCondiciones(e.target.value)} placeholder={'Ej: 1. ¿Qué es el Club?\n\nEs nuestro programa de beneficios...'} style={{ ...ui.input, resize: 'vertical' }} />
      ), guardarBasesCondiciones)}

      <section>
        <TituloBloque>Cambiar contraseña</TituloBloque>
        <div style={{ display: 'grid', gap: 12, margin: '12px 0 14px' }}>
          <label><span style={ui.label}>Contraseña actual</span><input type="password" value={formPassword.actual} onChange={e => setFormPassword({...formPassword, actual: e.target.value})} style={ui.input} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label><span style={ui.label}>Nueva contraseña</span><input type="password" value={formPassword.nueva} onChange={e => setFormPassword({...formPassword, nueva: e.target.value})} style={ui.input} /></label>
            <label><span style={ui.label}>Confirmar nueva contraseña</span><input type="password" value={formPassword.confirmar} onChange={e => setFormPassword({...formPassword, confirmar: e.target.value})} style={ui.input} /></label>
          </div>
        </div>
        <button type="button" className="fid-btn-primary" onClick={cambiarPassword} style={ui.botonPrimario}>Cambiar contraseña</button>
      </section>
    </div>
  );

  // Ajustes del panel Admin: solo datos de cuenta de lectura por ahora.
  const VistaAjustesAdmin = () => (
    <div className="fid-contenido">
      <h1 className="fid-titulo-seccion" style={{ ...uiAdmin.titulo(44), marginBottom: 24 }}>Ajustes</h1>
      <div style={{ borderTop: `1px solid ${admin.texto}`, paddingTop: 16, maxWidth: 560 }}>
        <div style={uiAdmin.etiqueta}>Cuenta</div>
        <p style={{ fontSize: 15, margin: '6px 0 0' }}>Email de acceso: <strong>{session?.user?.email}</strong></p>
      </div>
    </div>
  );

  const TITULOS_SECCION = {
    inicio: 'Hoy en el club',
    clientes: 'Clientes',
    premios: 'Premios',
    canjes: 'Canjes',
    integraciones: 'Integraciones',
    ajustes: 'Ajustes',
  };

  // Panel del negocio (compartido entre admin viendo un negocio y el negocio logueado)
  const PanelNegocio = ({ negocio, onVolver }) => (
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', background: tema.fondo, color: tema.texto, fontFamily: FUENTE_TEXTO }}>
      {/* Solo aparece cuando lo abre un admin (onVolver viene de la barra
          superior de admin, nunca del propio negocio logueado) -- en tinta
          de Retornar, para que quede claro que es "modo admin" sin importar
          el tema propio de este negocio. */}
      {onVolver && (
        <div style={{ padding: '8px 40px', background: admin.texto, color: admin.fondo, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Shield size={14} aria-hidden="true" /> Estás viendo el panel de {negocio.nombre} como administrador.
          <button type="button" onClick={onVolver} className="fid-link" style={{ ...ui.botonTexto, color: admin.fondo, marginLeft: 'auto' }}>Volver a negocios</button>
        </div>
      )}
      {tema.imagenPortada && (
        <img src={tema.imagenPortada} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
      )}
      <div className="fid-contenido">
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: tema.textoSecundario }}>{fechaLarga()}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
            <h1 className="fid-titulo-seccion" style={ui.titulo(48)}>{TITULOS_SECCION[seccionActiva] || 'Hoy en el club'}</h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && <button type="button" className="fid-btn-secondary" onClick={() => setMostrarFormCliente(true)} style={ui.botonSecundario}>Nuevo cliente</button>}
              {seccionActiva === 'premios' && <button type="button" className="fid-btn-primary" onClick={() => setMostrarFormPremio(true)} style={ui.botonPrimario}>Nuevo premio</button>}
            </div>
          </div>
        </header>

        {(seccionActiva === 'inicio' || seccionActiva === 'clientes') && mostrarFormCliente && (
          <div style={{ marginBottom: 36 }}>
            <TituloBloque>Agregar un cliente</TituloBloque>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, margin: '12px 0 14px' }}>
              <label><span style={ui.label}>Nombre *</span><input value={nuevoCliente.nombre} onChange={e => setNuevoCliente({...nuevoCliente, nombre: e.target.value})} placeholder="María González" style={ui.input} /></label>
              <label><span style={ui.label}>Teléfono *</span><input value={nuevoCliente.telefono} onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} placeholder="2324123456" style={ui.input} /></label>
              <label><span style={ui.label}>Email *</span><input value={nuevoCliente.email} onChange={e => setNuevoCliente({...nuevoCliente, email: e.target.value})} placeholder="maria@email.com" style={ui.input} /></label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="fid-btn-primary" onClick={agregarCliente} style={ui.botonPrimario}>Guardar cliente</button>
              <button type="button" className="fid-btn-secondary" onClick={() => setMostrarFormCliente(false)} style={ui.botonSecundario}>Cancelar</button>
            </div>
          </div>
        )}

        {seccionActiva === 'canjes' && VistaCanjes()}
        {seccionActiva === 'clientes' && VistaClientes()}
        {seccionActiva === 'premios' && VistaPremios()}
        {seccionActiva === 'integraciones' && VistaIntegraciones()}
        {seccionActiva === 'ajustes' && VistaAjustes()}

        {seccionActiva === 'inicio' && (
          <div>
            <div className="fid-kpis" style={{ borderTop: `1px solid ${tema.texto}`, borderBottom: `1px solid ${tema.borde}`, marginBottom: 40 }}>
              {[
                ['Clientes', formatearMiles(negocio.clientes?.length || 0), estadisticas?.clientesConCompraEsteMes != null ? `${formatearMiles(estadisticas.clientesConCompraEsteMes)} compraron este mes` : null],
                ['Puntos de este mes', estadisticas ? formatearMiles(estadisticas.puntosOtorgadosEsteMes) : null, 'otorgados'],
                ['Canjes de este mes', estadisticas ? formatearMiles(estadisticas.canjesEsteMes) : null, `${negocio.premios?.length || 0} premios activos`],
                ['Puntos en circulación', formatearMiles(negocio.clientes?.reduce((a, c) => a + c.puntos, 0) || 0), 'saldo de todas las clientas'],
              ].map(([etiqueta, valor, nota]) => (
                <div key={etiqueta} style={{ padding: '18px 20px 18px 0' }}>
                  <div style={ui.etiqueta}>{etiqueta}</div>
                  <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 46, lineHeight: 1.1, marginTop: 4, ...ui.numero }}>{valor ?? <Spinner size={18} />}</div>
                  {nota && <div style={{ fontSize: 13, color: tema.textoSecundario, marginTop: 2 }}>{nota}</div>}
                </div>
              ))}
            </div>

            <div className="fid-dos-columnas">
              <section>
                <TituloBloque accion={<button type="button" className="fid-link" onClick={() => setSeccionActiva('clientes')} style={ui.botonTexto}>Ver todos</button>}>Clientes</TituloBloque>
                {!clientesData && <Cargando />}
                {clientesData && clientesData.items.length === 0 && <Vacio>Todavía no hay clientes. Se suman cuando se registran desde el link o el QR del club.</Vacio>}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {clientesData?.items.map(c => (
                    <li key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '12px 0', borderBottom: `1px solid ${tema.borde}` }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre || c.email}</span>
                      <span style={{ fontFamily: tema.fuenteTitulo, fontSize: 18, ...ui.numero }}>{formatearMiles(c.puntos)}</span>
                    </li>
                  ))}
                </ul>
                <Paginador pagina={clientesData?.page || 1} totalPages={clientesData?.totalPages} onCambiar={setClientesPagina} />
              </section>

              <div style={{ display: 'grid', gap: 40 }}>
                <section>
                  <TituloBloque>Cargar una compra</TituloBloque>
                  <p style={{ ...ui.ayuda, marginTop: 8 }}>Para una venta que no pasó por la caja ni por la tienda online.</p>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <span style={ui.label}>Cliente</span>
                    <select value={clienteSeleccionado} onChange={e => setClienteSeleccionado(e.target.value)} style={ui.input}>
                      <option value="">Elegí un cliente...</option>
                      {negocio.clientes?.map(c => <option key={c.id} value={c.id}>{c.nombre ? `${c.nombre} (${c.email})` : c.email} — {c.puntos} pts</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <span style={ui.label}>Monto de la compra</span>
                    <input type="number" placeholder="$0" value={monto} onChange={e => setMonto(e.target.value)} style={ui.input} />
                  </label>
                  {pts > 0 && <div style={{ fontSize: 14, color: tema.primarioLegible, marginBottom: 12 }}>Se van a acreditar <strong>{formatearMiles(pts)} puntos</strong>.</div>}
                  <button type="button" className="fid-btn-primary" onClick={sumarPuntos} style={{ ...ui.botonPrimario, width: '100%' }}>Sumar puntos</button>
                </section>

                <section>
                  <TituloBloque accion={<button type="button" className="fid-link" onClick={() => setSeccionActiva('premios')} style={ui.botonTexto}>Editar</button>}>Premios</TituloBloque>
                  {!negocio.premios?.length && <Vacio>Todavía no hay premios activos.</Vacio>}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {negocio.premios?.map(p => (
                      <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${tema.borde}` }}>
                        <span aria-hidden="true" style={{ display: 'flex', color: tema.primarioLegible }}><IconoPremio nombre={p.emoji} size={16} /></span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{p.nombre}</span>
                        <span style={{ fontSize: 14, color: tema.textoSecundario, ...ui.numero }}>{formatearMiles(p.puntos)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            {(negocio.dragonfishConectado || negocio.tiendanubeConectado) && (
              <p style={{ fontSize: 13, color: tema.textoSecundario, borderTop: `1px solid ${tema.borde}`, paddingTop: 14, marginTop: 40, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {negocio.dragonfishConectado && (() => {
                  const caja = estadoCaja(negocio);
                  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: caja.color }} />Caja: {caja.corto}{negocio.dragonfishPendientes > 0 ? `, ${negocio.dragonfishPendientes} ${negocio.dragonfishPendientes === 1 ? 'venta esperando' : 'ventas esperando'}` : ''}</span>;
                })()}
                {negocio.dragonfishConectado && negocio.tiendanubeConectado && <span aria-hidden="true">·</span>}
                {negocio.tiendanubeConectado && <span>Tienda online: conectada</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Panel del cliente (pensado primero para el celular)
  const PanelCliente = () => {
    if (!clientePropio || !negocioDelCliente) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: '100vh', color: tema.textoSecundario, fontFamily: FUENTE_TEXTO }}>
          {negocios.length === 0 ? <><Spinner size={16} /> Cargando...</> : 'No encontramos tus datos de cliente.'}
        </div>
      );
    }

    const premiosDisponibles = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos >= p.puntos);
    const premiosBloqueados = (negocioDelCliente.premios || []).filter(p => clientePropio.puntos < p.puntos);
    // El premio más cercano que todavía no le alcanza (premios ya viene
    // ordenado de menor a mayor puntaje desde el backend).
    const proximoPremio = premiosBloqueados[0];
    const primerNombre = clientePropio.nombre ? clientePropio.nombre.split(' ')[0] : clientePropio.email.split('@')[0];

    // Mismo criterio (mes/día en UTC) que netlify/functions/regalo-cumpleanos.mjs,
    // para que el cartel coincida con el día real en que se acreditan los
    // puntos — no depende de la zona horaria del navegador de la clienta.
    const hoy = new Date();
    const esCumpleanos = clientePropio.fechaNacimiento && esCumpleanosHoy(clientePropio.fechaNacimiento, hoy);
    // Contador de anticipación (no el día en sí, ese ya tiene su propio
    // cartel abajo): solo dentro del último mes antes de la fecha, para no
    // ser un dato de fondo todo el año.
    const diasParaCumple = clientePropio.fechaNacimiento ? diasHastaProximoCumpleanos(clientePropio.fechaNacimiento, hoy) : null;
    const mostrarContadorCumple = negocioDelCliente.regaloCumpleanosPuntos && diasParaCumple != null && diasParaCumple > 0 && diasParaCumple <= 30;

    const itemMenu = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', fontSize: 15, border: 'none', borderBottom: `1px solid ${tema.borde}`, background: 'transparent', color: tema.texto, textDecoration: 'none', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' };
    const abrirModal = (cual) => { setModalCliente(cual); setMostrarMenuCliente(false); };

    // Ventana modal del panel de la clienta (movimientos, reglas, etc.)
    const modal = (titulo, contenido, { ancho = 420, textoBoton = 'Cerrar', onBoton = () => setModalCliente(null) } = {}) => (
      <div onClick={() => setModalCliente(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(23,25,27,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
        <div role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()} style={{ background: tema.superficie, color: tema.texto, borderRadius: 2, padding: '24px 22px 20px', maxWidth: ancho, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: FUENTE_TEXTO }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <h2 style={ui.titulo(26)}>{titulo}</h2>
            <button type="button" aria-label="Cerrar" onClick={() => setModalCliente(null)} style={{ ...ui.botonTexto, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={18} /></button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>{contenido}</div>
          <button type="button" onClick={onBoton} className="fid-btn-primary" style={{ ...ui.botonPrimario, width: '100%', marginTop: 16, flexShrink: 0, minHeight: 46 }}>{textoBoton}</button>
        </div>
      </div>
    );

    return (
      <div style={{ minHeight: '100vh', background: tema.fondo, color: tema.texto, fontFamily: FUENTE_TEXTO, fontSize: 15, lineHeight: 1.5 }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {tema.imagenPortada && (
            <img src={tema.imagenPortada} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
          )}
          <header style={{ padding: '26px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div>
              <div style={ui.etiqueta}>{nombreClub(negocioDelCliente.nombre)}</div>
              <h1 style={{ ...ui.titulo(30), marginTop: 2 }}>Hola, {primerNombre}</h1>
            </div>
            <button
              type="button"
              onClick={() => setMostrarMenuCliente(v => !v)}
              aria-label="Menú"
              aria-expanded={mostrarMenuCliente}
              style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${tema.borde}`, borderRadius: 2, color: tema.texto, cursor: 'pointer', flexShrink: 0 }}
            >
              {mostrarMenuCliente ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
            {mostrarMenuCliente && (
              <nav aria-label="Opciones" style={{ position: 'absolute', top: '100%', right: 24, left: 24, marginTop: 8, zIndex: 20, background: tema.superficie, border: `1px solid ${tema.texto}`, boxShadow: '0 12px 28px rgba(23,25,27,0.12)' }}>
                {negocioDelCliente.puntosReferido && (
                  <button type="button" className="fid-row-hover" onClick={() => abrirModal('referidos')} style={itemMenu}><Gift size={17} aria-hidden="true" /> Referí a una amiga</button>
                )}
                <button type="button" className="fid-row-hover" onClick={() => { setMovimientosClientePagina(1); abrirModal('movimientos'); }} style={itemMenu}><ScrollText size={17} aria-hidden="true" /> Mis movimientos</button>
                <button type="button" className="fid-row-hover" onClick={() => abrirModal('info')} style={itemMenu}><Info size={17} aria-hidden="true" /> Cómo funcionan los puntos</button>
                <button type="button" className="fid-row-hover" onClick={() => abrirModal('bases')} style={itemMenu}><ClipboardList size={17} aria-hidden="true" /> Bases y condiciones</button>
                {negocioDelCliente.soporteWhatsapp && (
                  <a href={`https://wa.me/${negocioDelCliente.soporteWhatsapp}`} target="_blank" rel="noopener noreferrer" onClick={() => setMostrarMenuCliente(false)} className="fid-row-hover" style={itemMenu}><MessageCircle size={17} aria-hidden="true" /> Escribinos por WhatsApp</a>
                )}
                {negocioDelCliente.soporteEmail && (
                  <a href={`mailto:${negocioDelCliente.soporteEmail}`} onClick={() => setMostrarMenuCliente(false)} className="fid-row-hover" style={itemMenu}><Mail size={17} aria-hidden="true" /> Escribinos por mail</a>
                )}
                <button type="button" className="fid-row-hover" onClick={() => abrirModal('password')} style={itemMenu}><KeyRound size={17} aria-hidden="true" /> Cambiar contraseña</button>
                <button type="button" className="fid-row-hover" onClick={() => signOut({ callbackUrl: '/login' })} style={{ ...itemMenu, borderBottom: 'none', color: '#b91c1c' }}><LogOut size={17} aria-hidden="true" /> Cerrar sesión</button>
              </nav>
            )}
          </header>

          {modalCliente === 'referidos' && (() => {
            const link = referidosData?.codigo
              ? `${window.location.origin}/club/${negocioDelCliente.slug}?ref=${referidosData.codigo}`
              : null;
            const mensaje = `¡Hola! Te invito a sumarte a ${nombreClub(negocioDelCliente.nombre)} — sumá puntos con tus compras y canjealos por premios. Entrá acá: ${link || ''}`;
            return modal('Referí a una amiga', (
              <>
                <p style={{ fontSize: 15, color: tema.textoSecundario, margin: '0 0 16px' }}>
                  Cuando tu amiga se registre con tu link y haga su primera compra, las dos ganan {negocioDelCliente.puntosReferido} puntos.
                </p>
                {!referidosData && <Cargando />}
                {referidosData && (
                  <>
                    <div style={{ background: tema.fondo, border: `1px solid ${tema.borde}`, padding: '10px 12px', fontSize: 14, wordBreak: 'break-all', marginBottom: 12 }}>
                      {link}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(link); setReferidoCopiado(true); }}
                        className="fid-btn-secondary"
                        style={{ ...ui.botonSecundario, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        {referidoCopiado ? <><Check size={15} aria-hidden="true" /> Copiado</> : 'Copiar link'}
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fid-btn-secondary"
                        style={{ ...ui.botonSecundario, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}
                      >
                        <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                      </a>
                    </div>
                    <p style={{ fontSize: 14, color: tema.textoSecundario, textAlign: 'center', margin: 0 }}>
                      {referidosData.totalReferidos > 0
                        ? `Ya invitaste a ${referidosData.totalReferidos} ${referidosData.totalReferidos === 1 ? 'amiga que compró' : 'amigas que compraron'}.`
                        : 'Todavía no invitaste a nadie que haya comprado.'}
                    </p>
                  </>
                )}
              </>
            ), { ancho: 400 });
          })()}

          {modalCliente === 'movimientos' && modal('Mis movimientos', (
            <>
              {!movimientosClienteData && <Cargando />}
              {movimientosClienteData && movimientosClienteData.items.length === 0 && <Vacio>Todavía no tenés movimientos. Tus compras, canjes y regalos van a aparecer acá.</Vacio>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {movimientosClienteData?.items.map((m) => (
                  <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${tema.borde}` }}>
                    <span aria-hidden="true" style={{ display: 'flex', color: tema.textoSecundario }}>
                      {m.tipo === 'canje' ? <IconoPremio nombre={m.premioIcono} size={18} /> : m.tipo === 'vencimiento' ? <Hourglass size={18} /> : m.tipo === 'cumpleanos' ? <Cake size={18} /> : m.tipo === 'referido' ? <Gift size={18} /> : <ShoppingBag size={18} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15 }}>{m.descripcion}</div>
                      <div style={{ fontSize: 13, color: tema.textoSecundario }}>{new Date(m.fecha).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div style={{ fontSize: 15, ...ui.numero, color: m.puntos >= 0 ? '#15803d' : tema.texto }}>
                      {m.puntos >= 0 ? '+' : '−'}{formatearMiles(Math.abs(m.puntos))}
                    </div>
                  </li>
                ))}
              </ul>
              <Paginador pagina={movimientosClienteData?.page || 1} totalPages={movimientosClienteData?.totalPages} onCambiar={setMovimientosClientePagina} />
            </>
          ))}

          {modalCliente === 'info' && modal('Cómo funcionan los puntos', (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {reglasDePuntos(negocioDelCliente, nombreClub(negocioDelCliente.nombre)).map(({ Icono, texto }, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, fontSize: 15, lineHeight: 1.5, padding: '10px 0', borderBottom: `1px solid ${tema.borde}` }}>
                  <span aria-hidden="true" style={{ display: 'flex', color: tema.primarioLegible, paddingTop: 3 }}><Icono size={17} /></span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
          ), { ancho: 400, textoBoton: 'Entendido' })}

          {modalCliente === 'bases' && modal(`Bases y condiciones`, (
            negocioDelCliente.basesCondiciones ? (
              <div style={{ fontSize: 14, color: tema.textoSecundario, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{negocioDelCliente.basesCondiciones}</div>
            ) : (
              <Vacio>Este negocio todavía no cargó sus bases y condiciones.</Vacio>
            )
          ))}

          {modalCliente === 'password' && modal('Cambiar contraseña', (
            <div style={{ display: 'grid', gap: 12 }}>
              <label><span style={ui.label}>Contraseña actual</span><input type="password" value={formPassword.actual} onChange={e => setFormPassword({ ...formPassword, actual: e.target.value })} style={{ ...ui.input, background: tema.fondo }} /></label>
              <label><span style={ui.label}>Nueva contraseña</span><input type="password" value={formPassword.nueva} onChange={e => setFormPassword({ ...formPassword, nueva: e.target.value })} style={{ ...ui.input, background: tema.fondo }} /></label>
              <label><span style={ui.label}>Confirmar nueva contraseña</span><input type="password" value={formPassword.confirmar} onChange={e => setFormPassword({ ...formPassword, confirmar: e.target.value })} style={{ ...ui.input, background: tema.fondo }} /></label>
            </div>
          ), { ancho: 360, textoBoton: 'Guardar', onBoton: cambiarPassword })}

          <main style={{ padding: '0 24px 40px' }}>
            {esCumpleanos && negocioDelCliente.regaloCumpleanosPuntos && !saludoCumpleCerrado && (
              <div role="status" style={{ position: 'relative', marginTop: 22, padding: '16px 44px 16px 16px', background: tema.primario, color: tema.primarioTexto, display: 'flex', gap: 12 }}>
                <Cake size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 1.2 }}>¡Feliz cumpleaños, {primerNombre}!</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>Que tengas un lindo día. Te regalamos {negocioDelCliente.regaloCumpleanosPuntos} puntos.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaludoCumpleCerrado(true)}
                  aria-label="Cerrar"
                  style={{ position: 'absolute', top: 6, right: 6, width: 36, height: 36, border: 'none', background: 'transparent', color: tema.primarioTexto, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><X size={16} /></button>
              </div>
            )}
            {mostrarContadorCumple && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 14, color: tema.texto }}>
                <Cake size={18} aria-hidden="true" style={{ color: tema.primarioLegible, flexShrink: 0 }} />
                <span>{diasParaCumple === 1 ? 'Mañana' : `Faltan ${diasParaCumple} días`} es tu cumpleaños — vas a sumar {negocioDelCliente.regaloCumpleanosPuntos} puntos de regalo.</span>
              </div>
            )}

            {/* Bloque de puntos: el número grande, el nivel y la barra hacia
                el próximo premio. El fondo usa el color "resaltado" de la
                marca del negocio (el rosa de Peperina, por ejemplo), para
                darle un poco de color sin perder la sobriedad del resto. */}
            <section aria-label="Tus puntos" style={{ marginTop: 22, background: tema.resaltado, borderTop: `2px solid ${tema.primario}`, padding: '22px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: tema.fuenteTitulo, fontSize: 68, lineHeight: 1, letterSpacing: '-0.03em', ...ui.numero }}>{formatearMiles(clientePropio.puntos)}</span>
                <span style={{ fontSize: 15, color: tema.textoSecundario }}>puntos</span>
              </div>
              {clientePropio.nivel && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: tema.fuenteTitulo, fontStyle: 'italic', fontSize: 19, color: tema.primarioLegible }}>Nivel {clientePropio.nivel}</span>
                  {clientePropio.proximoNivel && (
                    <span style={{ fontSize: 13, color: tema.textoSecundario }}>· {formatearMiles(clientePropio.proximoNivel.faltan)} puntos más para {clientePropio.proximoNivel.nombre}</span>
                  )}
                </div>
              )}
              {clientePropio.puntosPorVencer && (
                <p style={{ margin: '12px 0 0', fontSize: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Hourglass size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: tema.primarioLegible }} />
                  <span><strong>{formatearMiles(clientePropio.puntosPorVencer.puntos)} puntos</strong> vencen el {fechaCorta(clientePropio.puntosPorVencer.fecha).slice(0, 5)}. {premiosDisponibles.length > 0 ? 'Canjealos por un premio antes de esa fecha para no perderlos.' : 'Si llegás a un premio antes de esa fecha, podés usarlos.'}</span>
                </p>
              )}
              {proximoPremio ? (
                <>
                  <p style={{ margin: '14px 0 8px', fontSize: 15 }}>Te faltan <strong>{formatearMiles(proximoPremio.puntos - clientePropio.puntos)} puntos</strong> para {proximoPremio.nombre}.</p>
                  <div
                    role="progressbar"
                    aria-label={`Avance hacia ${proximoPremio.nombre}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round((clientePropio.puntos / proximoPremio.puntos) * 100))}
                    style={{ height: 4, background: tema.fondo }}
                  >
                    <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, Math.round((clientePropio.puntos / proximoPremio.puntos) * 100)))}%`, background: tema.primario }} />
                  </div>
                </>
              ) : (negocioDelCliente.premios || []).length > 0 && (
                <p style={{ margin: '14px 0 0', fontSize: 15 }}>Ya te alcanza para cualquier premio del club.</p>
              )}
            </section>

            <section style={{ marginTop: 30 }}>
              <h2 style={{ ...ui.etiqueta, margin: 0 }}>Podés canjear ahora</h2>
              {premiosDisponibles.length === 0 && (
                <Vacio>Todavía no llegás a ningún premio. Cada compra suma: mirá abajo cuánto te falta.</Vacio>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {premiosDisponibles.map(p => (
                  <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: `1px solid ${tema.borde}` }}>
                    <span aria-hidden="true" style={{ display: 'flex', color: tema.primarioLegible }}><IconoPremio nombre={p.emoji} size={20} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* "Click en un premio → lleva al producto en Tiendanube" (Grupo 7): solo
                          clickeable cuando el negocio cargó una URL de producto para este premio. */}
                      {p.tiendanubeProductoUrl ? (
                        <a href={p.tiendanubeProductoUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 1.25, color: tema.texto, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{p.nombre} <LinkIcon size={13} aria-label="ver producto" /></a>
                      ) : (
                        <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 1.25 }}>{p.nombre}</div>
                      )}
                      <div style={{ fontSize: 13, color: tema.textoSecundario, ...ui.numero }}>{formatearMiles(p.puntos)} puntos</div>
                    </div>
                    <button
                      type="button"
                      className="fid-btn-primary"
                      onClick={() => canjearPremio(p)}
                      disabled={canjeandoId === p.id}
                      style={{ ...ui.botonPrimario, minHeight: 44, flexShrink: 0, cursor: canjeandoId === p.id ? 'not-allowed' : 'pointer', opacity: canjeandoId === p.id ? 0.7 : 1 }}
                    >
                      {canjeandoId === p.id ? 'Canjeando...' : 'Canjear'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {premiosBloqueados.length > 0 && (
              <section style={{ marginTop: 30 }}>
                <h2 style={{ ...ui.etiqueta, margin: 0 }}>Próximos premios</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {premiosBloqueados.map(p => {
                    const avance = Math.max(2, Math.min(100, Math.round((clientePropio.puntos / p.puntos) * 100)));
                    return (
                      <li key={p.id} style={{ padding: '14px 0 16px', borderBottom: `1px solid ${tema.borde}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                          {p.tiendanubeProductoUrl ? (
                            <a href={p.tiendanubeProductoUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 1.25, color: tema.texto, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>{p.nombre} <LinkIcon size={13} aria-label="ver producto" /></a>
                          ) : (
                            <span style={{ fontFamily: tema.fuenteTitulo, fontSize: 20, lineHeight: 1.25, minWidth: 0 }}>{p.nombre}</span>
                          )}
                          <span style={{ fontSize: 14, color: tema.textoSecundario, flexShrink: 0, ...ui.numero }}>{formatearMiles(p.puntos)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: tema.textoSecundario, margin: '2px 0 8px' }}>Te faltan {formatearMiles(p.puntos - clientePropio.puntos)} puntos</div>
                        <div role="progressbar" aria-label={`Avance hacia ${p.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} style={{ height: 2, background: tema.borde }}>
                          <div style={{ height: '100%', width: `${avance}%`, background: tema.primario }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {negocioDelCliente.sitioWeb && (
              <a
                href={negocioDelCliente.sitioWeb}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, paddingTop: 14, borderTop: `1px solid ${tema.borde}`, fontSize: 15, color: tema.texto, textDecoration: 'none' }}
              >
                <span>Visitar {negocioDelCliente.nombre}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </main>
        </div>
      </div>
    );
  };

  // Paleta propia del panel de admin: la de Retornar (papel, tinta y verde),
  // fija, sin depender de ningún negocio. Se distingue del panel de un
  // negocio por la estructura (barra superior con la marca Retornar en vez
  // de barra lateral con la marca del negocio), no por un color que compita
  // con el de cada marca.
  const admin = {
    fondo: '#f8f8f5',
    superficie: '#ffffff',
    borde: '#dadbd6',
    texto: '#17191b',
    textoSecundario: '#55595e',
    acento: '#1e5b45',
  };
  const uiAdmin = {
    titulo: (tamano = 40) => ({ fontFamily: 'var(--font-titulo), Georgia, serif', fontWeight: 400, fontSize: tamano, lineHeight: 1.1, letterSpacing: '-0.01em', margin: 0 }),
    etiqueta: { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: admin.textoSecundario, fontWeight: 500 },
    label: { fontSize: 13, color: admin.textoSecundario, display: 'block', marginBottom: 6 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 2, border: `1px solid ${admin.borde}`, background: admin.superficie, color: admin.texto, fontSize: 14, boxSizing: 'border-box' },
    botonPrimario: { padding: '0 18px', minHeight: 42, borderRadius: 2, border: 'none', background: admin.texto, color: admin.fondo, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
    botonSecundario: { padding: '0 18px', minHeight: 42, borderRadius: 2, border: `1px solid ${admin.texto}`, background: 'transparent', color: admin.texto, fontSize: 14, cursor: 'pointer' },
    botonTexto: { padding: 0, border: 'none', background: 'none', color: admin.texto, fontSize: 14, cursor: 'pointer' },
  };

  // Estado de la caja de un negocio para la tabla del admin.
  const cajaAdmin = (neg) => {
    if (!neg.dragonfishConectado) return { texto: '—', color: admin.textoSecundario };
    const { estado, minutos } = estadoAgente(neg.dragonfishUltimoContacto);
    if (estado === 'activo') return { texto: `Reportó ${textoTiempo(minutos)}`, color: '#15803d' };
    if (estado === 'nunca') return { texto: 'Nunca se conectó', color: admin.textoSecundario };
    return { texto: `Sin reportar ${textoTiempo(minutos)}`, color: estado === 'demorado' ? '#a16207' : '#b91c1c' };
  };

  return (
    <div style={{ fontFamily: FUENTE_TEXTO, minHeight: '100vh', background: isAdmin ? admin.fondo : tema.fondo }}>

      {/* PANEL ADMIN */}
      {isAdmin && (
        <div style={{ minHeight: '100vh', background: admin.fondo, color: admin.texto }}>
          {/* Sin sidebar a propósito: la navegación es una barra horizontal
              arriba de todo, con la marca Retornar -- Genaro sentía que una
              sidebar con la misma lista de secciones se parecía demasiado,
              en estructura, a la del panel del negocio. */}
          <header style={{ borderBottom: `1px solid ${admin.texto}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 40px 6px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontStyle: 'italic', fontSize: 28, lineHeight: 1 }}>Retornar</span>
                <span style={uiAdmin.etiqueta}>Administración</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: admin.textoSecundario }}>
                <span className="fid-admin-nav-label">{fechaLarga()}</span>
                <span className="fid-admin-nav-label">{session?.user?.name}</span>
                <button type="button" className="fid-link" onClick={() => signOut({ callbackUrl: '/login' })} style={{ ...uiAdmin.botonTexto, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogOut size={14} aria-hidden="true" /> Salir</button>
              </div>
            </div>
            <nav aria-label="Secciones" style={{ display: 'flex', gap: 4, padding: '0 28px', overflowX: 'auto' }}>
              {[[HomeIcon, 'Inicio', 'inicio'], [Store, 'Negocios', 'negocios'], [Users, 'Clientes', 'clientes'], [Gift, 'Premios', 'premios'], [Star, 'Puntos y canjes', 'canjes'], [Plug, 'Integraciones', 'integraciones'], [Settings, 'Ajustes', 'ajustes']].map(([Icono, label, id]) => {
                const activo = id === 'negocios' ? !negocioActivo && seccionActiva !== 'ajustes' : (!!id && seccionActiva === id && (id === 'ajustes' || !!negocioActivo));
                return (
                  <button
                    type="button"
                    key={label}
                    className="fid-admin-nav-item"
                    aria-label={label}
                    aria-current={activo ? 'page' : undefined}
                    onClick={() => (id === 'negocios' ? volverANegocios() : setSeccionActiva(id))}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 10px', fontSize: 14, border: 'none', background: 'none', color: activo ? admin.texto : admin.textoSecundario, fontWeight: activo ? 600 : 400, borderBottom: activo ? `2px solid ${admin.texto}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <Icono size={14} aria-hidden="true" /> <span className="fid-admin-nav-label">{label}</span>
                  </button>
                );
              })}
            </nav>
          </header>

          {!negocioActivo && seccionActiva !== 'inicio' && seccionActiva !== 'negocios' && seccionActiva !== 'ajustes' ? (
            <div className="fid-contenido" style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16, paddingTop: 48 }}>
              <h1 className="fid-titulo-seccion" style={uiAdmin.titulo(40)}>Elegí un negocio</h1>
              <p style={{ fontSize: 15, color: admin.textoSecundario, margin: 0 }}>Para ver sus {seccionActiva === 'canjes' ? 'puntos y canjes' : seccionActiva}, primero abrí su panel desde la lista de negocios.</p>
              <button type="button" className="fid-btn-primary" onClick={() => setSeccionActiva('negocios')} style={uiAdmin.botonPrimario}>Ver negocios</button>
            </div>
          ) : !negocioActivo && seccionActiva === 'ajustes' ? (
            VistaAjustesAdmin()
          ) : !negocioActivo ? (
            <div className="fid-contenido">
              <h1 className="fid-titulo-seccion" style={uiAdmin.titulo(52)}>Resumen</h1>
              <p style={{ fontSize: 16, color: admin.textoSecundario, margin: '10px 0 28px' }}>
                {loading ? 'Cargando...' : `${negocios.filter(n => n.activo).length === 1 ? 'Un negocio en marcha' : `${negocios.filter(n => n.activo).length} negocios en marcha`}.`}
              </p>
              <div className="fid-kpis" style={{ borderTop: `1px solid ${admin.borde}`, borderBottom: `1px solid ${admin.borde}`, marginBottom: 44 }}>
                {[
                  ['Negocios activos', negocios.filter(n => n.activo).length],
                  ['Clientes registrados', negocios.reduce((acc, n) => acc + (n.clientes?.length || 0), 0)],
                  ['Puntos en circulación', negocios.reduce((acc, n) => acc + (n.clientes?.reduce((a, c) => a + c.puntos, 0) || 0), 0)],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} style={{ padding: '18px 20px 18px 0' }}>
                    <div style={uiAdmin.etiqueta}>{etiqueta}</div>
                    <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontSize: 50, lineHeight: 1.1, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{loading ? <Spinner size={16} color={admin.acento} /> : formatearMiles(valor)}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <h2 style={uiAdmin.titulo(30)}>Negocios</h2>
                <button type="button" className="fid-btn-primary" onClick={() => setMostrarFormNegocio(true)} style={uiAdmin.botonPrimario}>Dar de alta un negocio</button>
              </div>

              {mostrarFormNegocio && (
                <div style={{ borderTop: `1px solid ${admin.texto}`, padding: '16px 0 28px' }}>
                  <div style={{ ...uiAdmin.etiqueta, marginBottom: 12 }}>Nuevo negocio</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 90px 1fr', gap: 14, marginBottom: 14 }}>
                    <label><span style={uiAdmin.label}>Nombre *</span><input value={nuevoNegocio.nombre} onChange={e => setNuevoNegocio({...nuevoNegocio, nombre: e.target.value})} placeholder="Café Central" style={uiAdmin.input} /></label>
                    <label><span style={uiAdmin.label}>Tipo *</span><input value={nuevoNegocio.tipo} onChange={e => setNuevoNegocio({...nuevoNegocio, tipo: e.target.value})} placeholder="Cafetería" style={uiAdmin.input} /></label>
                    <label><span style={uiAdmin.label}>Ciudad *</span><input value={nuevoNegocio.ciudad} onChange={e => setNuevoNegocio({...nuevoNegocio, ciudad: e.target.value})} placeholder="Chacabuco" style={uiAdmin.input} /></label>
                    <label><span style={uiAdmin.label}>Emoji *</span><input value={nuevoNegocio.emoji} onChange={e => setNuevoNegocio({...nuevoNegocio, emoji: e.target.value})} placeholder="☕" style={uiAdmin.input} /></label>
                    <label><span style={uiAdmin.label}>Email *</span><input value={nuevoNegocio.email} onChange={e => setNuevoNegocio({...nuevoNegocio, email: e.target.value})} placeholder="negocio@email.com" style={uiAdmin.input} /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="fid-btn-primary" onClick={crearNegocio} style={uiAdmin.botonPrimario}>Guardar negocio</button>
                    <button type="button" className="fid-btn-secondary" onClick={() => setMostrarFormNegocio(false)} style={uiAdmin.botonSecundario}>Cancelar</button>
                  </div>
                </div>
              )}

              {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: admin.textoSecundario, padding: '12px 0' }}><Spinner size={14} color={admin.acento} /> Cargando...</div>}
              {/* overflowX + minWidth en vez de achicar las columnas: en
                  celular se scrollea el ancho de la tabla en vez de
                  amontonar las columnas o cortar contenido afuera de la
                  pantalla. */}
              <div style={{ overflowX: 'auto', borderTop: `1px solid ${admin.texto}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 0.8fr 0.8fr 1.4fr 1.6fr', minWidth: 760, padding: '10px 0', ...uiAdmin.etiqueta, borderBottom: `1px solid ${admin.borde}` }}>
                  <div>Negocio</div><div>Estado</div><div>Clientes</div><div>Premios</div><div>Caja</div><div><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Acciones</span></div>
                </div>
                {negocios.map((neg) => (
                  <div key={neg.id} className={negocioEditandoId === neg.id ? undefined : 'fid-row-hover'} style={{ padding: '14px 0', borderBottom: `1px solid ${admin.borde}` }}>
                    {negocioEditandoId === neg.id ? (
                      <>
                        <div style={{ ...uiAdmin.titulo(24), marginBottom: 14 }}>Editar {neg.nombre}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12, marginBottom: 12 }}>
                          <label><span style={uiAdmin.label}>Nombre</span><input value={formEdicionNegocio.nombre} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, nombre: e.target.value})} style={uiAdmin.input} /></label>
                          <label><span style={uiAdmin.label}>Emoji</span><input value={formEdicionNegocio.emoji} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, emoji: e.target.value})} style={uiAdmin.input} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                          <label><span style={uiAdmin.label}>Tipo</span><input value={formEdicionNegocio.tipo} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tipo: e.target.value})} style={uiAdmin.input} /></label>
                          <label><span style={uiAdmin.label}>Ciudad</span><input value={formEdicionNegocio.ciudad} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, ciudad: e.target.value})} style={uiAdmin.input} /></label>
                        </div>
                        <div style={{ ...uiAdmin.etiqueta, marginBottom: 8 }}>Colores de marca (panel del negocio y de sus clientes)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                          {[
                            ['fondo', 'Fondo'],
                            ['superficie', 'Superficies'],
                            ['borde', 'Líneas'],
                            ['texto', 'Texto'],
                            ['textoSecundario', 'Texto secundario'],
                            ['primario', 'Acento'],
                            ['primarioTexto', 'Texto sobre acento'],
                            ['resaltado', 'Resaltado'],
                          ].map(([clave, etiqueta]) => (
                            <label key={clave}>
                              <span style={{ ...uiAdmin.label, fontSize: 12 }}>{etiqueta}</span>
                              <input type="color" value={formEdicionNegocio.tema[clave]} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, [clave]: e.target.value}})} style={{ width: '100%', height: 34, padding: 0, borderRadius: 2, border: `1px solid ${admin.borde}`, cursor: 'pointer' }} />
                            </label>
                          ))}
                        </div>
                        <label style={{ display: 'block', marginBottom: 12 }}><span style={uiAdmin.label}>Tipografía de títulos (ej: Georgia, serif)</span><input value={formEdicionNegocio.tema.fuenteTitulo} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, fuenteTitulo: e.target.value}})} style={uiAdmin.input} /></label>
                        <label style={{ display: 'block', marginBottom: 14 }}><span style={uiAdmin.label}>Imagen de portada (URL)</span><input value={formEdicionNegocio.tema.imagenPortada} onChange={e => setFormEdicionNegocio({...formEdicionNegocio, tema: {...formEdicionNegocio.tema, imagenPortada: e.target.value}})} placeholder="https://..." style={uiAdmin.input} /></label>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button type="button" className="fid-btn-primary" onClick={guardarEdicionNegocio} style={uiAdmin.botonPrimario}>Guardar</button>
                          <button type="button" className="fid-btn-secondary" onClick={() => setNegocioEditandoId(null)} style={uiAdmin.botonSecundario}>Cancelar</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 0.8fr 0.8fr 1.4fr 1.6fr', minWidth: 760, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontSize: 20, lineHeight: 1.2 }}>{neg.nombre}</div>
                          <div style={{ fontSize: 13, color: admin.textoSecundario }}>{neg.tipo} · {neg.ciudad}</div>
                        </div>
                        <div style={{ fontSize: 14, color: neg.activo ? '#15803d' : admin.textoSecundario }}>{neg.activo ? 'Activo' : 'Inactivo'}</div>
                        <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatearMiles(neg.clientes?.length || 0)}</div>
                        <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{neg.premios?.length || 0}</div>
                        <div style={{ fontSize: 14, color: cajaAdmin(neg).color }}>{cajaAdmin(neg).texto}</div>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
                          <button type="button" className="fid-link" onClick={() => { setNegocioActivo(neg); setMostrarFormCliente(false); }} style={{ ...uiAdmin.botonTexto, fontWeight: 600 }}>Ver panel</button>
                          <button type="button" className="fid-link" onClick={() => iniciarEdicionNegocio(neg)} style={uiAdmin.botonTexto}>Editar</button>
                          <button type="button" className="fid-link" onClick={() => toggleNegocioActivo(neg)} style={{ ...uiAdmin.botonTexto, color: neg.activo ? '#b91c1c' : '#15803d' }}>{neg.activo ? 'Desactivar' : 'Reactivar'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            PanelNegocio({ negocio: negocioActivo, onVolver: volverANegocios })
          )}
        </div>
      )}

      {/* PANEL NEGOCIO */}
      {isNegocio && (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FUENTE_TEXTO }}>
          <aside className="fid-panel-sidebar" style={{ width: 232, flexShrink: 0, background: tema.superficie, color: tema.texto, borderRight: `1px solid ${tema.borde}`, padding: '28px 0 20px', display: 'flex', flexDirection: 'column' }}>
            <div className="fid-sidebar-header" style={{ padding: '0 24px 22px' }}>
              <div style={{ fontFamily: tema.fuenteTitulo, fontSize: 28, lineHeight: 1.1 }}>{negocioPropio?.nombre || session?.user?.name}</div>
              <div style={{ ...ui.etiqueta, marginTop: 6 }}>Panel del club</div>
            </div>
            <nav aria-label="Secciones" className="fid-sidebar-nav" style={{ padding: '8px 0', flex: 1 }}>
              {[[HomeIcon, 'Inicio', 'inicio'], [Users, 'Clientes', 'clientes'], [Gift, 'Premios', 'premios'], [RefreshCw, 'Canjes', 'canjes'], [Plug, 'Integraciones', 'integraciones'], [Settings, 'Ajustes', 'ajustes']].map(([Icono, label, id]) => {
                const activo = seccionActiva === id;
                return (
                  <button
                    type="button"
                    key={label}
                    className="fid-sidebar-item"
                    aria-label={label}
                    aria-current={activo ? 'page' : undefined}
                    onClick={() => setSeccionActiva(id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 24px', fontSize: 15, border: 'none', borderLeft: `2px solid ${activo ? tema.primario : 'transparent'}`, background: 'transparent', color: activo ? tema.texto : tema.textoSecundario, fontWeight: activo ? 600 : 400, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <Icono size={16} aria-hidden="true" /> <span className="fid-sidebar-label">{label}</span>
                  </button>
                );
              })}
            </nav>
            <div style={{ padding: '16px 24px 0', borderTop: `1px solid ${tema.borde}`, fontSize: 13, color: tema.textoSecundario }}>
              <div className="fid-sidebar-header" style={{ marginBottom: 10, lineHeight: 1.5 }}>
                Con la tecnología de <span style={{ fontFamily: 'var(--font-titulo), Georgia, serif', fontStyle: 'italic', color: tema.texto }}>Retornar</span>
              </div>
              <button type="button" className="fid-link" aria-label="Cerrar sesión" onClick={() => signOut({ callbackUrl: '/login' })} style={{ ...ui.botonTexto, display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c' }}><LogOut size={14} aria-hidden="true" /> <span className="fid-sidebar-label">Cerrar sesión</span></button>
            </div>
          </aside>

          {negocioPropio ? (
            PanelNegocio({ negocio: negocioPropio, onVolver: null })
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: tema.textoSecundario }}>
              <Spinner size={16} /> Cargando tu negocio...
            </div>
          )}
        </div>
      )}

      {/* PANEL CLIENTE */}
      {isCliente && PanelCliente()}

      {/* Sin acceso */}
      {!isAdmin && !isNegocio && !isCliente && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, color: TEMA_DEFAULT.texto }}>
          <div style={{ fontSize: 16 }}>No tenés acceso a este panel.</div>
          <button type="button" className="fid-btn-primary" onClick={() => signOut({ callbackUrl: '/login' })} style={ui.botonPrimario}>Cerrar sesión</button>
        </div>
      )}

      <Toast />
    </div>
  );
}
