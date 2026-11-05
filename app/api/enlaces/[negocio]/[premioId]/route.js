import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { nombreClub } from '@/lib/nombreClub'
import { linkSeguro } from '@/lib/guiaCupon'
import { enlaceDePremio } from '@/lib/disponibilidad'

// Página intermedia del enlace de un premio (app/club/[negocio]/producto/
// [premioId]): si el producto tiene stock en Tiendanube, con qué variantes,
// y si no, las alternativas con stock. Pública como la página del club (se
// abre desde el panel, el cartel del cupón y el mail): solo datos públicos
// de la tienda y del premio, nada de la clienta. Solo lee Tiendanube.
export async function GET(request, { params }) {
  const { negocio: slug, premioId } = await params
  const negocio = await prisma.negocio.findUnique({
    where: { slug },
    select: { id: true, nombre: true, activo: true, sitioWeb: true, tema: true, tiendanubeStoreId: true, tiendanubeAccessToken: true },
  })
  const premio = negocio?.activo
    ? await prisma.premio.findFirst({
        where: { id: premioId, negocioId: negocio.id, activo: true, tiendanubeProductoId: { not: null } },
        select: {
          id: true, nombre: true, puntos: true, tiendanubeProductoId: true, tiendanubeVarianteId: true, tiendanubeProductoUrl: true,
          alternativas: { orderBy: { orden: 'asc' }, select: { tiendanubeProductoId: true, tiendanubeVarianteId: true } },
        },
      })
    : null
  if (!premio) return NextResponse.json({ error: 'No encontramos este producto.' }, { status: 404 })

  const enlace = await enlaceDePremio(premio, negocio)
  // Si no se pudo confirmar nada, el botón a la tienda usa el link cargado en
  // el premio (decisión de Genaro: con aviso, sin decir que hay stock).
  if (!enlace.url) enlace.url = linkSeguro(premio.tiendanubeProductoUrl)

  const tema = Object.fromEntries(
    ['fondo', 'superficie', 'borde', 'texto', 'textoSecundario', 'primario', 'primarioTexto', 'resaltado', 'fuenteTitulo']
      .filter((clave) => typeof negocio.tema?.[clave] === 'string')
      .map((clave) => [clave, negocio.tema[clave]])
  )
  return NextResponse.json(
    {
      negocio: { nombre: nombreClub(negocio.nombre), sitioWeb: linkSeguro(negocio.sitioWeb), tema },
      premio: { id: premio.id, nombre: premio.nombre, puntos: premio.puntos },
      enlace,
      consultadoEn: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
