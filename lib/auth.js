import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/db'
import { verifyPassword, hashPassword } from '@/lib/password'

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
      async authorize(credentials) {
        if (process.env.ADMIN_PASSWORD_HASH && credentials.email === process.env.ADMIN_EMAIL) {
          const { valid } = await verifyPassword(credentials.password, process.env.ADMIN_PASSWORD_HASH)
          if (valid) {
            return { id: 'admin', name: 'Cecilia', email: credentials.email, role: 'admin' }
          }
        }

        const negocio = await prisma.negocio.findFirst({
          where: { email: credentials.email }
        })

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

        const cliente = await prisma.cliente.findFirst({
          where: { email: credentials.email }
        })

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
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true

      if (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL) {
        user.id = 'admin'
        user.role = 'admin'
        return true
      }

      const negocio = await prisma.negocio.findFirst({ where: { email: user.email } })
      if (negocio) {
        user.id = negocio.id
        user.name = negocio.nombre
        user.role = 'negocio'
        return true
      }

      const cliente = await prisma.cliente.findFirst({ where: { email: user.email } })
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
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET
}
