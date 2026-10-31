// Datos ficticios para las pruebas E2E contra una base local descartable
// (nunca producción: entorno.mjs corta si DATABASE_URL no es local y de
// prueba). VACÍA todas las tablas antes de cargar. Usa la paleta de Peperina
// que ya está en el repo (prisma/migrations/20260826130317_tema_peperina_paleta_real).
import './entorno.mjs'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
await prisma.$executeRawUnsafe('TRUNCATE "Canje","MovimientoPuntos","Premio","FacturaPendiente","WebhookEvento","PasswordResetToken","Cliente","Negocio" CASCADE')

const negocio = await prisma.negocio.create({
  data: {
    nombre: 'Peperina', tipo: 'Ropa', ciudad: 'Mercedes', emoji: '👗', slug: 'peperina',
    email: 'negocio@prueba.test', password: await bcrypt.hash('negocio-123', 10), puntosXPeso: 100,
    dragonfishBaseDeDatos: 'PRUEBA', dragonfishAgentToken: 'token-agente-prueba', dragonfishUltimoContacto: new Date(Date.now() - 60_000),
    tiendanubeStoreId: '1', tiendanubeAccessToken: 'token-falso',
    regaloCumpleanosPuntos: 500, vencimientoPuntosMeses: 12, sitioWeb: 'https://peperina.com.ar',
    soporteWhatsapp: '5492324000000',
    tema: { fondo: '#F6EFE9', superficie: '#ffffff', borde: '#EBDAC6', texto: '#221f1a', textoSecundario: '#A99886', primario: '#877152', primarioTexto: '#F6EFE9', resaltado: '#F4D9D1', fuenteTitulo: 'Georgia, "Times New Roman", serif' },
  },
})
await prisma.negocio.create({
  data: { nombre: 'Club de demostración', tipo: 'Demo', ciudad: '—', emoji: '⭐', email: 'demo@prueba.test', password: await bcrypt.hash('demo-123', 10), puntosXPeso: 100 },
})

const premios = {}
for (const [nombre, puntos, emoji, extra] of [
  ['10% en toda la tienda', 2500, 'percent', { tiendanubeDescuentoPorcentaje: 10 }],
  ['Pañuelo de seda', 5000, 'gift', { tiendanubeProductoId: '123', tiendanubeProductoUrl: 'https://peperina.com.ar/productos/panuelo' }],
  ['$70.000 de descuento', 12500, 'ticket', { tiendanubeDescuentoMonto: 70000, tiendanubeDescuentoMontoMinimo: 140000 }],
]) premios[nombre] = await prisma.premio.create({ data: { nombre, puntos, emoji, negocioId: negocio.id, ...extra } })

const dia = 86400000
const clientas = [
  ['Lucía Fernández', 'lucia@prueba.test', 3420, 5200, 0],
  ['Paula Medina', 'paula@prueba.test', 4150, 9100, 38],
  ['Martina Sosa', 'martina@prueba.test', 1200, 8600, 0],
  ['Carla Ruiz', 'carla@prueba.test', 180, 180, 0],
  ['Sofía Benítez', 'sofia@prueba.test', 2940, 3400, 6],
  ['Valentina Ríos', 'valentina@prueba.test', 2300, 2300, 47],
  ['Julieta Gómez', 'julieta@prueba.test', 95, 95, 0],
]
const pass = await bcrypt.hash('clienta-123', 10)
const ids = {}
for (const [nombre, email, puntos, ganados, diasSinVenir] of clientas) {
  const c = await prisma.cliente.create({ data: { nombre, email, password: pass, puntos, negocioId: negocio.id, telefono: '2324555000' } })
  ids[nombre] = c.id
  // dos compras para que haya frecuencia y ticket promedio
  const mitad = Math.floor(ganados / 2)
  await prisma.movimientoPuntos.create({ data: { clienteId: c.id, negocioId: negocio.id, puntos: mitad, origen: 'dragonfish', createdAt: new Date(Date.now() - (diasSinVenir + 30) * dia) } })
  await prisma.movimientoPuntos.create({ data: { clienteId: c.id, negocioId: negocio.id, puntos: ganados - mitad, origen: 'tiendanube', createdAt: new Date(Date.now() - diasSinVenir * dia) } })
}
await prisma.canje.create({ data: { clienteId: ids['Martina Sosa'], premioId: premios['Pañuelo de seda'].id, tiendanubeCuponCodigo: 'RETORNAR-AB12CD34' } })
await prisma.canje.create({ data: { clienteId: ids['Paula Medina'], premioId: premios['10% en toda la tienda'].id, tiendanubeCuponError: 'Tiendanube no respondió a tiempo' } })
await prisma.movimientoPuntos.create({ data: { clienteId: ids['Martina Sosa'], negocioId: negocio.id, puntos: -5000, origen: 'canje' } })
console.log('ok')
await prisma.$disconnect()
