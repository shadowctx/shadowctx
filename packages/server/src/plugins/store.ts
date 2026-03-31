import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import type { ContextStore } from '@shadowctx/core'

declare module 'fastify' {
  interface FastifyInstance {
    store: ContextStore
  }
}

export const storePlugin = fp(async (server: FastifyInstance) => {
  const backend = process.env.STORE ?? 'supabase'

  let store: ContextStore

  if (backend === 'sqlite') {
    const { SqliteStore } = await import('@shadowctx/store-sqlite')
    store = new SqliteStore({ dbPath: process.env.DB_PATH ?? './shadowctx.db' })
  } else {
    const { SupabaseStore } = await import('@shadowctx/store-supabase')
    const url = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      throw new Error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    }
    store = new SupabaseStore({ supabaseUrl: url, supabaseServiceKey: serviceKey })
  }

  server.decorate('store', store)
})
