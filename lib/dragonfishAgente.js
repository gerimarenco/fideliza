import { prisma } from '@/lib/db'

// Autenticación del agente local de Dragon Fish: no es un usuario logueado
// (no pasa por NextAuth), se identifica con el token secreto propio del
// negocio (Negocio.dragonfishAgentToken), generado desde "Integraciones".
export async function autenticarAgente(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return prisma.negocio.findUnique({ where: { dragonfishAgentToken: token } })
}
