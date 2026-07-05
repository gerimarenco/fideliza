const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const duplicadoId = 'cmr8ee7iu0000d7w9pputug6d'
  const originalId = 'cmr158szt0000kot7v8xm3gv6'
  
  // Borrar premios del duplicado
  await p.premio.deleteMany({ where: { negocioId: duplicadoId } })
  
  // Borrar clientes del duplicado
  await p.cliente.deleteMany({ where: { negocioId: duplicadoId } })
  
  // Borrar el negocio duplicado
  await p.negocio.delete({ where: { id: duplicadoId } })
  
  // Agregar email y password al original
  await p.negocio.update({
    where: { id: originalId },
    data: { email: 'peperina@fideliza.com', password: 'peperina123' }
  })
  
  console.log('Listo!')
  await p.$disconnect()
}

main().catch(console.error)