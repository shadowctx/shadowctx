import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { searchRoutes } from './search'

// Mock the embeddings module
vi.mock('../lib/embeddings', () => ({
  generateEmbedding: vi.fn(),
  entryEmbeddingText: (title: string, body: string) => `${title}\n\n${body}`,
}))

import { generateEmbedding } from '../lib/embeddings'

const USER_ID = 'user-1'
const WS_ID = 'ws-1'

function makeChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    textSearch: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(result),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ ...result, count: result.count ?? null }).then(resolve, reject),
  }
  Object.assign(chain, Promise.resolve({ ...result, count: result.count ?? null }))
  return chain
}

async function buildTestServer(adminMock: any) {
  const server = Fastify({ logger: false })
  server.decorate('supabaseAdmin', adminMock)
  server.decorate('supabase', adminMock)
  server.decorateRequest('user', null)
  server.decorate('requireAuth', async (req: any) => {
    req.user = { id: USER_ID, email: 'test@example.com' }
  })
  await server.register(searchRoutes, { prefix: '/workspaces' })
  await server.ready()
  return server
}

describe('GET /workspaces/:id/search', () => {
  beforeEach(() => {
    vi.mocked(generateEmbedding).mockReset()
  })

  it('returns combined results when embedding is available', async () => {
    const mockEmbedding = new Array(1536).fill(0.1)
    vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding)

    const rpcResults = [
      { id: 'e-1', title: 'Fix bug', body: 'Fixed a race condition', fts_rank: 0.8, semantic_score: 0.9, combined_score: 2.5 },
    ]
    const tagData: any[] = []
    let callCount = 0

    const adminMock = {
      from: (table: string) => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null }) // membership
        return makeChain({ data: tagData, error: null }) // entry_tags
      },
      rpc: () => Promise.resolve({ data: rpcResults, error: null }),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'GET',
      url: `/workspaces/${WS_ID}/search?q=race+condition`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.mode).toBe('combined')
    expect(body.results).toHaveLength(1)
    expect(body.results[0].title).toBe('Fix bug')
    expect(body.query).toBe('race condition')
  })

  it('falls back to FTS when embedding is unavailable', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(null)

    const ftsResults = [
      { id: 'e-2', title: 'Deploy notes', body: 'Deployment checklist', tags: [], author: {} },
    ]
    let callCount = 0

    const adminMock = {
      from: (table: string) => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: ftsResults, error: null })
      },
      rpc: vi.fn(),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'GET',
      url: `/workspaces/${WS_ID}/search?q=deploy`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.mode).toBe('fts_only')
    expect(body.results).toHaveLength(1)
    expect(adminMock.rpc).not.toHaveBeenCalled()
  })

  it('returns empty results gracefully', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(null)

    let callCount = 0
    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: [], error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'GET',
      url: `/workspaces/${WS_ID}/search?q=nonexistent`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.results).toHaveLength(0)
  })

  it('returns 403 when user is not a workspace member', async () => {
    vi.mocked(generateEmbedding).mockResolvedValue(null)

    const adminMock = {
      from: () => makeChain({ data: null, error: { message: 'not found' } }),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'GET',
      url: `/workspaces/${WS_ID}/search?q=anything`,
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns 400 when q is missing', async () => {
    const adminMock = { from: () => makeChain({ data: null, error: null }) }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'GET',
      url: `/workspaces/${WS_ID}/search`,
    })

    expect(res.statusCode).toBe(400)
  })
})
