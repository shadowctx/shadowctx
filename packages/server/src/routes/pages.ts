import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { fetchAndExtract } from '@shadowctx/core'
import type { PageInput, ListOptions } from '@shadowctx/core'

interface SaveBody {
  url?: string
  title?: string
  content?: string
  html?: string
  note?: string
  tags?: string[]
  source?: PageInput['source']
  metadata?: Record<string, unknown>
  fetch?: boolean  // if true and url provided, auto-fetch + extract
}

interface GetParams { id: string }
interface ListQuery { limit?: number; offset?: number; tag?: string; source?: string }
interface DeleteParams { id: string }

export async function pagesRoutes(server: FastifyInstance) {
  /**
   * POST /pages
   * Save a page. If body.fetch === true and a URL is provided, content is fetched + extracted.
   */
  server.post<{ Body: SaveBody }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            url:      { type: 'string' },
            title:    { type: 'string' },
            content:  { type: 'string' },
            html:     { type: 'string' },
            note:     { type: 'string' },
            tags:     { type: 'array', items: { type: 'string' } },
            source:   { type: 'string', enum: ['extension', 'cli', 'mobile', 'api'] },
            metadata: { type: 'object' },
            fetch:    { type: 'boolean' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: SaveBody }>, reply: FastifyReply) => {
      let { url, title, content, html, note, tags, source, metadata, fetch: doFetch } = req.body

      if (doFetch && url && !content) {
        const extracted = await fetchAndExtract(url)
        title = title ?? extracted.title ?? undefined
        content = content ?? extracted.content ?? undefined
        html = html ?? extracted.html ?? undefined
      }

      const page = await server.store.save({
        url, title, content, html, note, tags,
        source: source ?? 'api',
        metadata,
      })

      return reply.status(201).send(page)
    }
  )

  /**
   * GET /pages
   * List saved pages with optional filtering.
   */
  server.get<{ Querystring: ListQuery }>(
    '/',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit:  { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            tag:    { type: 'string' },
            source: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      const opts: ListOptions = {
        limit: req.query.limit,
        offset: req.query.offset,
        tag: req.query.tag,
        source: req.query.source as ListOptions['source'],
      }
      const pages = await server.store.list(opts)
      return reply.send({ pages })
    }
  )

  /**
   * GET /pages/search?q=query[&limit=10]
   */
  server.get<{ Querystring: { q: string; limit?: number } }>(
    '/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q:     { type: 'string', minLength: 1, maxLength: 500 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Querystring: { q: string; limit?: number } }>, reply: FastifyReply) => {
      const results = await server.store.search(req.query.q, req.query.limit ?? 10)
      return reply.send({ results, query: req.query.q })
    }
  )

  /**
   * GET /pages/tags
   */
  server.get('/tags', async (_req, reply) => {
    const tags = await server.store.getTags()
    return reply.send({ tags })
  })

  /**
   * GET /pages/stats
   */
  server.get('/stats', async (_req, reply) => {
    const stats = await server.store.getStats()
    return reply.send(stats)
  })

  /**
   * GET /pages/:id
   */
  server.get<{ Params: GetParams }>(
    '/:id',
    async (req: FastifyRequest<{ Params: GetParams }>, reply: FastifyReply) => {
      const page = await server.store.get(req.params.id)
      if (!page) return reply.status(404).send({ error: 'Not found' })
      return reply.send(page)
    }
  )

  /**
   * DELETE /pages/:id
   */
  server.delete<{ Params: DeleteParams }>(
    '/:id',
    async (req: FastifyRequest<{ Params: DeleteParams }>, reply: FastifyReply) => {
      await server.store.delete(req.params.id)
      return reply.status(204).send()
    }
  )
}
