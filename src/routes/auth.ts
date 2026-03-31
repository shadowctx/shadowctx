import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

interface SignUpBody {
  email: string
  password: string
  displayName?: string
}

interface SignInBody {
  email: string
  password: string
}

interface RefreshBody {
  refreshToken: string
}

export async function authRoutes(server: FastifyInstance) {
  // POST /auth/signup
  server.post<{ Body: SignUpBody }>(
    '/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SignUpBody }>, reply: FastifyReply) => {
      const { email, password, displayName } = request.body

      const { data, error } = await server.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName ?? null },
        },
      })

      if (error) {
        return reply.status(400).send({ error: error.message })
      }

      return reply.status(201).send({
        user: data.user,
        session: data.session,
      })
    }
  )

  // POST /auth/signin
  server.post<{ Body: SignInBody }>(
    '/signin',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SignInBody }>, reply: FastifyReply) => {
      const { email, password } = request.body

      const { data, error } = await server.supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return reply.status(401).send({ error: error.message })
      }

      return reply.send({
        user: data.user,
        session: data.session,
      })
    }
  )

  // POST /auth/signout
  server.post(
    '/signout',
    { preHandler: [server.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.headers.authorization!.slice(7)
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      )

      const { error } = await client.auth.signOut()
      if (error) {
        return reply.status(400).send({ error: error.message })
      }

      return reply.status(204).send()
    }
  )

  // POST /auth/refresh
  server.post<{ Body: RefreshBody }>(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
      const { refreshToken } = request.body

      const { data, error } = await server.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      })

      if (error) {
        return reply.status(401).send({ error: error.message })
      }

      return reply.send({
        user: data.user,
        session: data.session,
      })
    }
  )

  // GET /auth/me — returns current user
  server.get(
    '/me',
    { preHandler: [server.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ user: request.user })
    }
  )
}
