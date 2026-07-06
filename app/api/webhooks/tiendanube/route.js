import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    
    // Tiendanube nos avisa de una nueva orden pagada
    if (body.event === 'order/paid') {
      const orden = body.order
      const email = orden.contact_email
      const total = parseFloat(orden.total)
      const negocioId = request.nextUrl.searchParams.get('negocioId')
      
      if (!negocioId || !email || !total) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
      }
      
      // Buscar el cliente por email
      const cliente = await prisma.cliente.findFirst({
        where: { email, negocioId }
      })
      
      if (!cliente) {
        return NextResponse.json({ message: 'Cliente no registrado en Fideliza' }, { status: 200 })
      }
      
      // Calcular puntos
      const negocio = await prisma.negocio.findUnique({ where: { id: negocioId } })
      const puntos = Math.floor(total / negocio.puntosXPeso)
      
      // Sumar puntos
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { puntos: { increment: puntos } }
      })
      
      return NextResponse.json({ success: true, puntosAcreditados: puntos })
    }
    
    return NextResponse.json({ message: 'Evento ignorado' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}