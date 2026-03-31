import fp from 'fastify-plugin'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient
    supabaseAdmin: SupabaseClient
  }
}

export const supabasePlugin = fp(async (server: FastifyInstance) => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  // Public client (respects RLS)
  server.decorate('supabase', createClient(url, anonKey))

  // Admin client (bypasses RLS — use only in trusted server-side paths)
  server.decorate('supabaseAdmin', createClient(url, serviceKey))
})
