import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { SupabaseStore } from '@shadowctx/store-supabase'
import type { ContextStore } from '@shadowctx/core'

declare module 'fastify' {
  interface FastifyInstance {
    store: ContextStore
  }
}

export const storePlugin = fp(async (server: FastifyInstance) => {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  }

  server.decorate(
    'store',
    new SupabaseStore({
      supabaseUrl: url,
      supabaseServiceKey: serviceKey,
      // In SaaS mode a userId would be resolved per-request; for self-hosted leave undefined
    })
  )
})
