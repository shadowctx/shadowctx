import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { workspaceRoutes } from './workspaces'

// ── Mock Supabase admin client ─────────────────────────────────────────────────

function makeChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    range: () => chain,
    single: () => Promise.resolve(result),
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  }
  // Make it awaitable directly
  Object.assign(chain, Promise.resolve({ ...result, count: result.count ?? null }))
  return chain
}

const USER_ID = 'user-1'
const WS_ID = 'ws-1'
const ENTRY_ID = 'entry-1'
const TAG_ID = 'tag-1'

function buildFromMock(queryResults: Map<string, any>) {
  return {
    from: (table: string) => {
      const key = table
      const result = queryResults.get(key) ?? { data: null, error: null }
      return makeChain(result)
    },
  }
}

async function buildTestServer(adminMock: any) {
  const server = Fastify({ logger: false })

  // Decorate with mocked supabase admin
  server.decorate('supabaseAdmin', adminMock)
  server.decorate('supabase', adminMock)
  server.decorateRequest('user', null)

  // Mock requireAuth: attach a fake user
  server.decorate('requireAuth', async (req: any) => {
    req.user = { id: USER_ID, email: 'test@example.com' }
  })

  await server.register(workspaceRoutes, { prefix: '/workspaces' })
  await server.ready()
  return server
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /workspaces', () => {
  it('creates a workspace and returns 201', async () => {
    const workspace = { id: WS_ID, name: 'Acme', slug: 'acme', description: null }
    let callCount = 0

    const adminMock = {
      from: (table: string) => {
        callCount++
        if (table === 'workspaces') {
          return makeChain({ data: workspace, error: null })
        }
        // workspace_members insert
        return makeChain({ data: { id: 'm-1' }, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'POST',
      url: '/workspaces',
      payload: { name: 'Acme', slug: 'acme' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).workspace.id).toBe(WS_ID)
  })

  it('returns 409 when slug is taken', async () => {
    const adminMock = {
      from: () => makeChain({ data: null, error: { message: 'dup', code: '23505' } }),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'POST',
      url: '/workspaces',
      payload: { name: 'Acme', slug: 'acme' },
    })

    expect(res.statusCode).toBe(409)
  })
})

describe('GET /workspaces', () => {
  it('returns list of workspaces for the user', async () => {
    const rows = [{ role: 'owner', workspace: { id: WS_ID, name: 'Acme' } }]
    const adminMock = {
      from: () => makeChain({ data: rows, error: null }),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'GET', url: '/workspaces' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.workspaces).toHaveLength(1)
    expect(body.workspaces[0].role).toBe('owner')
  })
})

describe('GET /workspaces/:id', () => {
  it('returns workspace when user is a member', async () => {
    const workspace = { id: WS_ID, name: 'Acme' }
    let callCount = 0

    const adminMock = {
      from: (table: string) => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'owner' }, error: null })
        return makeChain({ data: workspace, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'GET', url: `/workspaces/${WS_ID}` })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).workspace.id).toBe(WS_ID)
  })

  it('returns 403 when user is not a member', async () => {
    const adminMock = {
      from: () => makeChain({ data: null, error: { message: 'not found' } }),
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'GET', url: `/workspaces/${WS_ID}` })

    expect(res.statusCode).toBe(403)
  })
})

describe('PATCH /workspaces/:id', () => {
  it('updates workspace name when user is owner', async () => {
    const updated = { id: WS_ID, name: 'New Name' }
    let callCount = 0

    const adminMock = {
      from: (table: string) => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'owner' }, error: null })
        return makeChain({ data: updated, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'PATCH',
      url: `/workspaces/${WS_ID}`,
      payload: { name: 'New Name' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).workspace.name).toBe('New Name')
  })
})

describe('DELETE /workspaces/:id', () => {
  it('deletes workspace when user is owner', async () => {
    let callCount = 0
    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'owner' }, error: null })
        return makeChain({ data: null, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'DELETE', url: `/workspaces/${WS_ID}` })

    expect(res.statusCode).toBe(204)
  })
})

describe('GET /workspaces/:id/members', () => {
  it('returns members list', async () => {
    const members = [{ id: 'm-1', role: 'owner', joined_at: new Date().toISOString(), user: { id: USER_ID, email: 'test@example.com' } }]
    let callCount = 0

    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'owner' }, error: null })
        return makeChain({ data: members, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'GET', url: `/workspaces/${WS_ID}/members` })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).members).toHaveLength(1)
  })
})

describe('POST /workspaces/:id/tags', () => {
  it('creates a tag and returns 201', async () => {
    const tag = { id: TAG_ID, workspace_id: WS_ID, name: 'bug', color: '#ff0000' }
    let callCount = 0

    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: tag, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'POST',
      url: `/workspaces/${WS_ID}/tags`,
      payload: { name: 'bug', color: '#ff0000' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).tag.name).toBe('bug')
  })
})

describe('POST /workspaces/:id/entries', () => {
  it('creates an entry and returns 201', async () => {
    const entry = { id: ENTRY_ID, workspace_id: WS_ID, author_id: USER_ID, title: 'Test', body: '' }
    let callCount = 0

    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: entry, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'POST',
      url: `/workspaces/${WS_ID}/entries`,
      payload: { title: 'Test' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).entry.title).toBe('Test')
  })
})

describe('GET /workspaces/:id/entries', () => {
  it('returns paginated entries', async () => {
    const entries = [{ id: ENTRY_ID, title: 'Test', tags: [], author: {} }]
    let callCount = 0

    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: entries, error: null, count: 1 })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({ method: 'GET', url: `/workspaces/${WS_ID}/entries` })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.entries).toHaveLength(1)
    expect(body.total).toBe(1)
  })
})

describe('PATCH /workspaces/:id/entries/:entryId', () => {
  it('updates entry title when user is author', async () => {
    const updated = { id: ENTRY_ID, title: 'Updated', tags: [], author: {} }
    let callCount = 0

    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { author_id: USER_ID }, error: null })  // entry lookup
        if (callCount === 2) return makeChain({ data: { role: 'member' }, error: null })  // member check
        if (callCount === 3) return makeChain({ data: null, error: null })  // update
        return makeChain({ data: updated, error: null })  // refetch
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'PATCH',
      url: `/workspaces/${WS_ID}/entries/${ENTRY_ID}`,
      payload: { title: 'Updated' },
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('DELETE /workspaces/:id/entries/:entryId', () => {
  it('deletes entry when user is author', async () => {
    let callCount = 0
    const adminMock = {
      from: () => {
        callCount++
        if (callCount === 1) return makeChain({ data: { author_id: USER_ID }, error: null })
        if (callCount === 2) return makeChain({ data: { role: 'member' }, error: null })
        return makeChain({ data: null, error: null })
      },
    }

    const server = await buildTestServer(adminMock)
    const res = await server.inject({
      method: 'DELETE',
      url: `/workspaces/${WS_ID}/entries/${ENTRY_ID}`,
    })

    expect(res.statusCode).toBe(204)
  })
})
