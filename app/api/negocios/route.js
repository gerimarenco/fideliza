import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomBytes } from 'crypto'

// Nunca incluir password/tiendanubeAccessToken tal cual acá: esta respuesta
// viaja al navegador de negocio y cliente. tiendanubeAccessToken se selecciona
// solo para calcular tiendanubeConectado y se descarta antes de responder.
const NEGOCIO_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  ciudad: true,
  emoji: true,
  activo: true,
  puntosXPeso: true,
  tema: true,
  slug: true,
  mensajeRegistro: true,
  tiendanubeStoreId: true,
  tiendanubeAccessToken: true,
  dragonfishBaseDeDatos: true,
  dragonfishAgentToken: true,
  clientes: {
    select: { id: true, nombre: true, email: true, puntos: true }
  },
  premios: {
    where: { activo: true },
    select: { id: true, nombre: true, puntos: true, emoji: true }
  },
}

// Formato del slug: minúsculas, números y guiones simples, sin espacios ni
// guiones al principio/final (va en la URL pública de pagos).
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Tokens de color que un negocio puede personalizar (branding propio, ej.
// Peperina). Lo que no venga acá usa la paleta clara por defecto de la app.
const TEMA_CLAVES_COLOR = ['fondo', 'superficie', 'borde', 'texto', 'textoSecundario', 'primario', 'primarioTexto', 'resaltado']
const TEMA_CLAVES_TEXTO = ['fuenteTitulo']
const TEMA_CLAVES_URL = ['imagenPortada']
// Los únicos largos válidos de un hex color CSS son 3, 4, 6 u 8 dígitos
// (RGB, RGBA corto, RGB, RGBA) — 5 y 7 no son válidos y el navegador los
// ignora en silencio, dejando el color anterior o el heredado.
const COLOR_HEX_VALIDO = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const URL_HTTP_VALIDA = /^https?:\/\/.+/

function validarTema(tema) {
  if (tema === null) return true
  if (typeof tema !== 'object' || Array.isArray(tema)) return false
  return Object.entries(tema).every(([clave, valor]) => {
    if (TEMA_CLAVES_COLOR.includes(clave)) return COLOR_HEX_VALIDO.test(valor)
    if (TEMA_CLAVES_TEXTO.includes(clave)) return typeof valor === 'string' && valor.length > 0 && valor.length <= 200
    // La imagen de portada es opcional: string vacío significa "sin imagen".
    if (TEMA_CLAVES_URL.includes(clave)) return typeof valor === 'string' && (valor === '' || (valor.length <= 500 && URL_HTTP_VALIDA.test(valor)))
    return false
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let where
  if (session.user.role === 'admin') {
    where = {}
  } else if (session.user.role === 'negocio') {
    where = { id: session.user.id }
  } else if (session.user.role === 'cliente') {
    where = { clientes: { some: { id: session.user.id } } }
  } else {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const negocios = await prisma.negocio.findMany({ where, select: NEGOCIO_SELECT })
  const negociosSeguros = negocios.map(({ tiendanubeAccessToken, dragonfishAgentToken, ...negocio }) => ({
    ...negocio,
    tiendanubeConectado: !!tiendanubeAccessToken,
    dragonfishConectado: !!dragonfishAgentToken,
  }))
  return NextResponse.json(negociosSeguros)
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.nombre || !body.tipo || !body.ciudad || !body.emoji || !body.email) {
    return NextResponse.json({ error: 'Nombre, tipo, ciudad, emoji y email son obligatorios' }, { status: 400 })
  }

  const passwordGenerada = Math.random().toString(36).slice(-8)

  let negocioCreado
  try {
    negocioCreado = await prisma.negocio.create({
      data: {
        nombre: body.nombre,
        tipo: body.tipo,
        ciudad: body.ciudad,
        emoji: body.emoji,
        email: body.email,
        password: await hashPassword(passwordGenerada),
      }
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un negocio con ese email' }, { status: 409 })
    }
    throw error
  }

  const { password, ...negocio } = negocioCreado

  // passwordGenerada va en texto plano en la respuesta: el admin la
  // necesita para pasársela al negocio. El hash (password) se descarta acá,
  // en la base queda solo el hash.
  return NextResponse.json({ ...negocio, passwordGenerada })
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'El id del negocio es obligatorio' }, { status: 400 })
  }

  const esAdmin = session?.user?.role === 'admin'
  const esElMismoNegocio = session?.user?.role === 'negocio' && session.user.id === body.id

  if (!esAdmin && !esElMismoNegocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const data = {
    tiendanubeStoreId: body.tiendanubeStoreId,
    tiendanubeAccessToken: body.tiendanubeAccessToken,
  }

  // BaseDeDatos es el nombre con el que Dragon Fish identifica la base del
  // negocio (viaja tal cual en el webhook) — no es secreto, mismo criterio
  // que tiendanubeStoreId.
  if (body.dragonfishBaseDeDatos !== undefined) {
    data.dragonfishBaseDeDatos = body.dragonfishBaseDeDatos
  }

  // El token del agente lo generamos nosotros (no lo manda Dragon Fish): se
  // muestra una sola vez en la respuesta, igual que una contraseña generada,
  // para que quien configure el agente local lo copie ahí.
  let dragonfishAgentTokenGenerado
  if (body.dragonfishGenerarToken) {
    dragonfishAgentTokenGenerado = randomBytes(24).toString('hex')
    data.dragonfishAgentToken = dragonfishAgentTokenGenerado
  }

  // El slug habilita Mercado Pago (va en la URL pública de pagos): igual que
  // las credenciales de Tiendanube, lo puede cargar el admin o el propio
  // negocio.
  if (body.slug !== undefined) {
    if (!SLUG_VALIDO.test(body.slug)) {
      return NextResponse.json({ error: 'El identificador solo puede tener minúsculas, números y guiones simples, sin espacios' }, { status: 400 })
    }
    data.slug = body.slug
  }

  // Cuántos pesos gastados equivalen a 1 punto: lo edita el admin o el
  // propio negocio, igual que el resto de la configuración de la cuenta.
  if (body.puntosXPeso !== undefined) {
    const puntosXPeso = parseInt(body.puntosXPeso)
    if (!Number.isInteger(puntosXPeso) || puntosXPeso <= 0) {
      return NextResponse.json({ error: 'Puntos por peso tiene que ser un número entero mayor a 0' }, { status: 400 })
    }
    data.puntosXPeso = puntosXPeso
  }

  // Mensaje/promoción propia de la pantalla pública de auto-registro — a
  // diferencia de tiendanubeStoreId/dragonfishBaseDeDatos, acá sí hace falta
  // poder vaciarlo (dejarlo en null), así que se acepta string vacío tal
  // cual en vez de tratarlo como "no tocar este campo".
  if (body.mensajeRegistro !== undefined) {
    const mensajeRegistro = String(body.mensajeRegistro).trim()
    if (mensajeRegistro.length > 300) {
      return NextResponse.json({ error: 'El mensaje no puede superar los 300 caracteres' }, { status: 400 })
    }
    data.mensajeRegistro = mensajeRegistro || null
  }

  // Nombre/tipo/ciudad/emoji/activo son datos administrativos del negocio:
  // solo el admin los edita (el negocio, desde su propio panel, solo carga
  // integraciones). Desactivar es borrado lógico, igual que Premio.activo:
  // no borra clientes/premios/canjes históricos, solo lo saca de circulación.
  if (esAdmin) {
    if (body.nombre !== undefined) data.nombre = body.nombre
    if (body.tipo !== undefined) data.tipo = body.tipo
    if (body.ciudad !== undefined) data.ciudad = body.ciudad
    if (body.emoji !== undefined) data.emoji = body.emoji
    if (body.activo !== undefined) data.activo = !!body.activo
    if (body.tema !== undefined) {
      if (!validarTema(body.tema)) {
        return NextResponse.json({ error: 'El tema tiene un formato inválido' }, { status: 400 })
      }
      data.tema = body.tema
    }
  }

  let negocio
  try {
    negocio = await prisma.negocio.update({ where: { id: body.id }, data })
  } catch (error) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ese identificador ya está en uso por otro negocio' }, { status: 409 })
    }
    throw error
  }

  const { password, tiendanubeAccessToken, dragonfishAgentToken, ...negocioSeguro } = negocio
  return NextResponse.json({
    ...negocioSeguro,
    tiendanubeConectado: !!tiendanubeAccessToken,
    dragonfishConectado: !!dragonfishAgentToken,
    ...(dragonfishAgentTokenGenerado ? { dragonfishAgentTokenGenerado } : {}),
  })
}
