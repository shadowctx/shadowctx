import Fastify from 'fastify'
import { storePlugin } from './plugins/store.js'
import { pagesRoutes } from './routes/pages.js'

export async function buildServer() {
  const server = Fastify({ logger: true })

  await server.register(storePlugin)
  await server.register(pagesRoutes, { prefix: '/pages' })

  server.get('/health', async () => ({ status: 'ok' }))

  return server
}
