import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateEmbedding, entryEmbeddingText } from '../lib/embeddings'

interface SearchParams { id: string }
interface SearchQuery { q: string; limit?: number }

export async function searchRoutes(server: FastifyInstance) {
  const auth = { preHandler: [server.requireAuth] }

  /**
   * GET /workspaces/:id/search?q=:query[&limit=20]
   *
   * Combined full-text + semantic search within a workspace.
   * Results are ranked: FTS rank weighted 2x + cosine similarity.
   * Falls back to FTS-only when embedding is unavailable (no API key or OpenAI error).
   */
  server.get<{ Params: SearchParams; Querystring: SearchQuery }>(
    '/:id/search',
    {
      ...auth,
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 1, maxLength: 500 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Params: SearchParams; Querystring: SearchQuery }>, reply: FastifyReply) => {
      const userId = req.user!.id
      const { id: workspaceId } = req.params
      const { q, limit = 20 } = req.query

      // Verify membership
      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single()

      if (!self) return reply.status(403).send({ error: 'Not a member' })

      // Generate query embedding (non-blocking on failure)
      const embedding = await generateEmbedding(q)

      if (embedding) {
        // Combined search via Postgres RPC
        const embeddingStr = `[${embedding.join(',')}]`
        const { data, error } = await server.supabaseAdmin.rpc('search_entries', {
          ws_id: workspaceId,
          query_text: q,
          query_embedding: embeddingStr,
          match_count: limit,
        })

        if (error) {
          console.error('[search] RPC error:', error.message)
          return reply.status(500).send({ error: 'Search failed' })
        }

        const results = await enrichWithTags(server, data ?? [])
        return reply.send({ results, query: q, mode: 'combined' })
      }

      // Fallback: FTS only (when OPENAI_API_KEY is missing or embedding failed)
      const { data: ftsData, error: ftsErr } = await server.supabaseAdmin
        .from('entries')
        .select('*, tags:entry_tags(tag:tags(id, name, color)), author:users(id, email, display_name)')
        .eq('workspace_id', workspaceId)
        .textSearch('title', q, { type: 'websearch', config: 'english' })
        .limit(limit)

      if (ftsErr) return reply.status(500).send({ error: 'Search failed' })

      const results = (ftsData ?? []).map((entry: any) => ({
        ...entry,
        fts_rank: null,
        semantic_score: null,
        combined_score: null,
      }))

      return reply.send({ results, query: q, mode: 'fts_only' })
    }
  )
}

async function enrichWithTags(server: FastifyInstance, entries: any[]): Promise<any[]> {
  if (entries.length === 0) return []

  const entryIds = entries.map((e: any) => e.id)
  const { data: tagData } = await server.supabaseAdmin
    .from('entry_tags')
    .select('entry_id, tag:tags(id, name, color)')
    .in('entry_id', entryIds)

  const tagsByEntry = new Map<string, any[]>()
  for (const row of tagData ?? []) {
    const existing = tagsByEntry.get(row.entry_id) ?? []
    existing.push(row.tag)
    tagsByEntry.set(row.entry_id, existing)
  }

  return entries.map((e: any) => ({
    ...e,
    embedding: undefined, // omit raw embedding from response
    tags: tagsByEntry.get(e.id) ?? [],
  }))
}
