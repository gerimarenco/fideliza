import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/password'
import { filtroEmail, mismoEmail, normalizarEmail } from '@/lib/identidad'
import { hashEmailLogin, hashIpLogin, ipDeEncabezados, loginBloqueado, inicioVentana } from '@/lib/limiteLogin'

// Usuario y contraseña contra el admin (variables de entorno), negocios y
// clientes. Devuelve el usuario de la sesión o null.
async function verificarCredenciales(credentials) {
  if (process.env.ADMIN_PASSWORD_HASH && mismoEmail(credentials.email, process.env.ADMIN_EMAIL)) {
    const { valid } = await verifyPassword(credentials.password, process.env.ADMIN_PASSWORD_HASH)
    if (valid) {
      return { id: 'admin', name: 'Cecilia', email: credentials.email, role: 'admin' }
    }
  }

  // Antes se buscaba primero en Negocio y recién si no matcheaba se
  // buscaba en Cliente -- dos consultas seguidas (una siempre en
  // falso para el caso más común, un login de cliente) en vez de al
  // mismo tiempo. Se buscan juntas para no sumar esa demora extra en
  // cada login/registro.
  const [negocio, cliente] = await Promise.all([
    prisma.negocio.findFirst({ where: { email: filtroEmail(credentials.email) } }),
    prisma.cliente.findFirst({ where: { email: filtroEmail(credentials.email) } })
  ])

  if (negocio?.password) {
    const { valid, needsRehash } = await verifyPassword(credentials.password, negocio.password)
    if (valid) {
      if (needsRehash) {
        await prisma.negocio.update({
          where: { id: negocio.id },
          data: { password: await hashPassword(credentials.password) }
        })
      }
      return { id: negocio.id, name: negocio.nombre, email: credentials.email, role: 'negocio' }
    }
  }

  if (cliente?.password) {
    const { valid, needsRehash } = await verifyPassword(credentials.password, cliente.password)
    if (valid) {
      if (needsRehash) {
        await prisma.cliente.update({
          where: { id: cliente.id },
          data: { password: await hashPassword(credentials.password) }
        })
      }
      return { id: cliente.id, name: cliente.nombre, email: credentials.email, role: 'cliente' }
    }
  }

  return null
}

export const authOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        })]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!normalizarEmail(credentials?.email) || !credentials?.password) return null

        // Límite de intentos (ver lib/limiteLogin.js). El intento se registra
        // ANTES de contar: si se contara primero, muchos pedidos simultáneos
        // verían todos "menos de 10" y pasarían juntos. Si la tabla no
        // respondiera, se sigue sin límite antes que dejar a todos sin entrar.
        const claves = { emailHash: hashEmailLogin(credentials.email), ipHash: hashIpLogin(ipDeEncabezados(req?.headers)) }
        try {
          const intento = await prisma.intentoLogin.create({ data: claves })
          const desde = inicioVentana()
          const [intentosCuenta, intentosConexion] = await Promise.all([
            prisma.intentoLogin.count({ where: { ...claves, createdAt: { gte: desde } } }),
            prisma.intentoLogin.count({ where: { ipHash: claves.ipHash, createdAt: { gte: desde } } }),
          ])
          if (loginBloqueado(intentosCuenta, intentosConexion)) {
            // El intento bloqueado no se guarda: así la espera es de 15
            // minutos desde el último fallo real, y la tabla no crece al
            // ritmo de quien insiste.
            await prisma.intentoLogin.delete({ where: { id: intento.id } })
            throw new Error('DEMASIADOS_INTENTOS')
          }
        } catch (error) {
          if (error.message === 'DEMASIADOS_INTENTOS') throw error
          console.error('Límite de login: no se pudo consultar', error.message)
        }

        const usuario = await verificarCredenciales(credentials)
        try {
          if (usuario) {
            // Quien sabe la contraseña limpia los fallos de su cuenta.
            await prisma.intentoLogin.deleteMany({ where: { emailHash: claves.emailHash } })
          } else {
            // Los intentos viejos ya no cuentan para nada.
            await prisma.intentoLogin.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
          }
        } catch (error) {
          console.error('Límite de login: no se pudo actualizar', error.message)
        }
        return usuario
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true

      if (process.env.ADMIN_EMAIL && mismoEmail(user.email, process.env.ADMIN_EMAIL)) {
        user.id = 'admin'
        user.role = 'admin'
        return true
      }

      const negocio = await prisma.negocio.findFirst({ where: { email: filtroEmail(user.email) } })
      if (negocio) {
        user.id = negocio.id
        user.name = negocio.nombre
        user.role = 'negocio'
        return true
      }

      const cliente = await prisma.cliente.findFirst({ where: { email: filtroEmail(user.email) } })
      if (cliente) {
        user.id = cliente.id
        user.name = cliente.nombre
        user.role = 'cliente'
        return true
      }

      return false
    },
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id }
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role
      session.user.id = token.id
      return session
    }
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET
}
