import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { leerProducto, resumenProducto, estadoEnlace, urlProducto } from '@/lib/disponibilidad'

// "Enlace y alternativas" de un premio (Premios, en el panel del negocio):
// a qué producto y color apunta y hasta 3 productos alternativos para cuando
// se agote. Solo el negocio dueño o el admin. Lee Tiendanube; nunca cambia
// productos, precios ni stock.

const MAXIMO_ALTERNATIVAS = 3
const ID_VALIDO = /^\d{1,20}$/

async function premioAutorizado(params) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const { id } = await params
  const premio = await prisma.premio.findUnique({
    where: { id },
    include: {
      alternativas: { orderBy: { orden: 'asc' } },
      negocio: { select: { id: true, tiendanubeStoreId: true, tiendanubeAccessToken: true } },
    },
  })
  if (!premio || (rol === 'negocio' && premio.negocioId !== session.user.id)) {
    return { error: NextResponse.json({ error: 'Premio no encontrado' }, { status: 404 }) }
  }
  if (!premio.negocio.tiendanubeStoreId || !premio.negocio.tiendanubeAccessToken) {
    return { error: NextResponse.json({ error: 'Conectá Tiendanube para elegir productos.' }, { status: 400 }) }
  }
  return { premio }
}

// Producto leído en el momento, con el estado de cada variante.
async function detalle(negocio, productoId, varianteId, nombreGuardado) {
  const lectura = await leerProducto(negocio, productoId, { edadMaximaMs: 0, timeoutMs: 6000 })
  if (!lectura.producto) {
    return { productoId, varianteId: varianteId ?? null, nombre: nombreGuardado ?? null, estado: lectura.error === 'no_existe' ? 'no_existe' : 'desconocido', variantes: [] }
  }
  const e = estadoEnlace(lectura.producto, varianteId)
  const r = resumenProducto(lectura.producto)
  return {
    productoId,
    varianteId: varianteId ?? null,
    nombre: r.nombre,
    imagen: r.imagen,
    url: e.variante?.url ?? r.url,
    estado: e.estado,
    motivo: e.motivo ?? null,
    variantes: r.variantes.map(({ id, nombre, precio, estado }) => ({ id, nombre, precio, estado })),
  }
}

export async function GET(request, { params }) {
  const { premio, error } = await premioAutorizado(params)
  if (error) return error
  const negocio = premio.negocio
  const [principal, ...alternativas] = await Promise.all([
    premio.tiendanubeProductoId ? detalle(negocio, premio.tiendanubeProductoId, premio.tiendanubeVarianteId) : null,
    ...premio.alternativas.map((a) => detalle(negocio, a.tiendanubeProductoId, a.tiendanubeVarianteId, a.nombre)),
  ])
  return NextResponse.json({ premio: { id: premio.id, nombre: premio.nombre }, principal, alternativas, maximo: MAXIMO_ALTERNATIVAS })
}

// Normaliza { productoId, varianteId } que manda el panel.
function enlaceDe(valor) {
  const productoId = valor?.productoId == null ? '' : String(valor.productoId).trim()
  const varianteId = valor?.varianteId == null || valor.varianteId === '' ? null : String(valor.varianteId).trim()
  if (!ID_VALIDO.test(productoId) || (varianteId !== null && !ID_VALIDO.test(varianteId))) return null
  return { productoId, varianteId }
}

// Guarda producto + color del premio y sus alternativas. Cada producto se
// comprueba en Tiendanube (que exista y que la variante sea suya); si la
// tienda no responde, no se guarda nada.
export async function PUT(request, { params }) {
  const { premio, error } = await premioAutorizado(params)
  if (error) return error
  const body = await request.json().catch(() => ({}))

  const principal = enlaceDe(body.principal)
  if (!principal) return NextResponse.json({ error: 'Elegí el producto del premio.' }, { status: 400 })
  if (!Array.isArray(body.alternativas ?? [])) return NextResponse.json({ error: 'Alternativas inválidas.' }, { status: 400 })
  const alternativas = (body.alternativas ?? []).map(enlaceDe)
  if (alternativas.some((a) => !a)) return NextResponse.json({ error: 'Alguna alternativa no tiene un producto válido.' }, { status: 400 })
  if (alternativas.length > MAXIMO_ALTERNATIVAS) return NextResponse.json({ error: `Como mucho ${MAXIMO_ALTERNATIVAS} alternativas.` }, { status: 400 })
  if (alternativas.some((a) => a.productoId === principal.productoId)) {
    return NextResponse.json({ error: 'Una alternativa no puede ser el mismo producto del premio: sus otros colores ya se muestran solos.' }, { status: 400 })
  }
  if (new Set(alternativas.map((a) => `${a.productoId}:${a.varianteId ?? ''}`)).size !== alternativas.length) {
    return NextResponse.json({ error: 'Hay alternativas repetidas.' }, { status: 400 })
  }

  const negocio = premio.negocio
  const lecturas = await Promise.all([principal, ...alternativas].map((e) => leerProducto(negocio, e.productoId, { edadMaximaMs: 0, timeoutMs: 6000 })))
  const fallida = lecturas.findIndex((l) => !l.producto)
  if (fallida !== -1) {
    const quien = fallida === 0 ? 'El producto del premio' : `La alternativa ${fallida}`
    return lecturas[fallida].error === 'no_existe'
      ? NextResponse.json({ error: `${quien} no existe en la tienda.` }, { status: 400 })
      : NextResponse.json({ error: 'No se pudo consultar Tiendanube. No se guardó nada: probá de nuevo en unos minutos.' }, { status: 503 })
  }
  const enlaces = [principal, ...alternativas]
  for (let i = 0; i < enlaces.length; i++) {
    const { varianteId } = enlaces[i]
    if (varianteId && !lecturas[i].producto.variants.some((v) => String(v.id) === varianteId)) {
      return NextResponse.json({ error: `${i === 0 ? 'El color elegido del premio' : `El color de la alternativa ${i}`} no es de ese producto.` }, { status: 400 })
    }
  }
  const nombreDe = (i) => {
    const r = resumenProducto(lecturas[i].producto)
    const v = enlaces[i].varianteId ? r.variantes.find((x) => x.id === enlaces[i].varianteId) : null
    return [r.nombre, v?.nombre].filter(Boolean).join(' — ').slice(0, 200) || null
  }

  const url = urlProducto(lecturas[0].producto)
  await prisma.$transaction([
    prisma.premio.update({
      where: { id: premio.id },
      data: {
        tiendanubeProductoId: principal.productoId,
        tiendanubeVarianteId: principal.varianteId,
        // El link sale de Tiendanube: así producto y link no pueden apuntar a
        // cosas distintas.
        ...(url ? { tiendanubeProductoUrl: url } : {}),
      },
    }),
    prisma.premioAlternativa.deleteMany({ where: { premioId: premio.id } }),
    prisma.premioAlternativa.createMany({
      data: alternativas.map((a, i) => ({ premioId: premio.id, orden: i, tiendanubeProductoId: a.productoId, tiendanubeVarianteId: a.varianteId, nombre: nombreDe(i + 1) })),
    }),
  ])
  return NextResponse.json({ ok: true })
}
