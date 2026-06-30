const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const peperina = await prisma.negocio.create({
    data: {
      nombre: 'Peperina',
      tipo: 'Indumentaria femenina',
      ciudad: 'Mercedes, Bs As',
      emoji: '👗',
      puntosXPeso: 1000,
      premios: {
        create: [
          { nombre: 'Pañuelo sorpresa', puntos: 100, emoji: '🎀' },
          { nombre: 'Vale descuento 10%', puntos: 100, emoji: '🏷️' },
          { nombre: 'Orden de compra $30.000', puntos: 500, emoji: '🛍️' },
          { nombre: '2x1 en toda la tienda', puntos: 1000, emoji: '✨' },
        ]
      }
    }
  })
  console.log('Peperina creada:', peperina)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())