import Fastify from 'fastify'
import { supabasePlugin } from './plugins/supabase'
import { authPlugin } from './plugins/auth'
import { authRoutes } from './routes/auth'

export async function buildServer() {
  const server = Fastify({ logger: true })

  await server.register(supabasePlugin)
  await server.register(authPlugin)
  await server.register(authRoutes, { prefix: '/auth' })

  server.get('/health', async () => ({ status: 'ok' }))

  return server
}
