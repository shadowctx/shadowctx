import Fastify from 'fastify'
import { supabasePlugin } from './plugins/supabase'
import { authPlugin } from './plugins/auth'
import { authRoutes } from './routes/auth'
import { workspaceRoutes } from './routes/workspaces'

export async function buildServer() {
  const server = Fastify({ logger: true })

  await server.register(supabasePlugin)
  await server.register(authPlugin)
  await server.register(authRoutes, { prefix: '/auth' })
  await server.register(workspaceRoutes, { prefix: '/workspaces' })

  server.get('/health', async () => ({ status: 'ok' }))

  return server
}
