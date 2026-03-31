import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createClient, User } from '@supabase/supabase-js'

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null
  }
}

export const authPlugin = fp(async (server: FastifyInstance) => {
  // Attach user to every request if a Bearer token is present
  server.decorateRequest('user', null)

  server.addHook('onRequest', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return

    const token = authHeader.slice(7)
    const url = process.env.SUPABASE_URL!
    const anonKey = process.env.SUPABASE_ANON_KEY!

    // Create a per-request client scoped to the user's JWT
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error } = await client.auth.getUser()
    if (!error && user) {
      request.user = user
    }
  })

  // Prehandler helper registered as a named middleware
  server.decorate(
    'requireAuth',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }
    }
  )
})

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
