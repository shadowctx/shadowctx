import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateEmbedding, entryEmbeddingText } from '../lib/embeddings'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkspaceParams { id: string }
interface MemberParams { id: string; userId: string }
interface TagParams { id: string; tagId: string }
interface EntryParams { id: string; entryId: string }

interface CreateWorkspaceBody { name: string; slug: string; description?: string }
interface UpdateWorkspaceBody { name?: string; description?: string }

interface InviteMemberBody { email: string; role?: 'owner' | 'admin' | 'member' }

interface CreateTagBody { name: string; color?: string }

interface CreateEntryBody { title: string; body?: string; tagIds?: string[] }
interface UpdateEntryBody { title?: string; body?: string; tagIds?: string[] }

interface EntryListQuery { tagId?: string; limit?: number; offset?: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

const authOpts = { preHandler: [] as ((req: FastifyRequest, rep: FastifyReply) => Promise<void>)[] }

export async function workspaceRoutes(server: FastifyInstance) {
  const auth = { preHandler: [server.requireAuth] }

  // ── Workspaces ──────────────────────────────────────────────────────────────

  // POST /workspaces
  server.post<{ Body: CreateWorkspaceBody }>(
    '/',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            slug: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[a-z0-9-]+$' },
            description: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { name, slug, description } = req.body

      // Create workspace (using admin client to bypass RLS for creation, then add member)
      const { data: workspace, error: wsErr } = await server.supabaseAdmin
        .from('workspaces')
        .insert({ name, slug, description: description ?? null, created_by: userId })
        .select()
        .single()

      if (wsErr) {
        if (wsErr.code === '23505') {
          return reply.status(409).send({ error: 'Slug already taken' })
        }
        return reply.status(400).send({ error: wsErr.message })
      }

      // Add creator as owner
      const { error: memberErr } = await server.supabaseAdmin
        .from('workspace_members')
        .insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })

      if (memberErr) {
        return reply.status(500).send({ error: 'Failed to add owner membership' })
      }

      return reply.status(201).send({ workspace })
    }
  )

  // GET /workspaces
  server.get('/', auth, async (req, reply) => {
    const userId = req.user!.id

    const { data, error } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role, workspace:workspaces(*)')
      .eq('user_id', userId)

    if (error) return reply.status(500).send({ error: error.message })

    const workspaces = (data ?? []).map((row: any) => ({ ...row.workspace, role: row.role }))
    return reply.send({ workspaces })
  })

  // GET /workspaces/:id
  server.get<{ Params: WorkspaceParams }>('/:id', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params

    const { data: member, error: memberErr } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (memberErr || !member) return reply.status(403).send({ error: 'Not a member' })

    const { data: workspace, error } = await server.supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !workspace) return reply.status(404).send({ error: 'Workspace not found' })

    return reply.send({ workspace: { ...workspace, role: member.role } })
  })

  // PATCH /workspaces/:id
  server.patch<{ Params: WorkspaceParams; Body: UpdateWorkspaceBody }>(
    '/:id',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            description: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id } = req.params

      const { data: member } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!member || !['owner', 'admin'].includes(member.role)) {
        return reply.status(403).send({ error: 'Only owners and admins can update' })
      }

      const updates: Record<string, unknown> = {}
      if (req.body.name !== undefined) updates.name = req.body.name
      if (req.body.description !== undefined) updates.description = req.body.description

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' })
      }

      const { data: workspace, error } = await server.supabaseAdmin
        .from('workspaces')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return reply.status(400).send({ error: error.message })

      return reply.send({ workspace })
    }
  )

  // DELETE /workspaces/:id
  server.delete<{ Params: WorkspaceParams }>('/:id', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params

    const { data: member } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!member || member.role !== 'owner') {
      return reply.status(403).send({ error: 'Only owners can delete workspaces' })
    }

    const { error } = await server.supabaseAdmin.from('workspaces').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(204).send()
  })

  // ── Members ─────────────────────────────────────────────────────────────────

  // GET /workspaces/:id/members
  server.get<{ Params: WorkspaceParams }>('/:id/members', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!self) return reply.status(403).send({ error: 'Not a member' })

    const { data, error } = await server.supabaseAdmin
      .from('workspace_members')
      .select('id, role, joined_at, user:users(id, email, display_name, avatar_url)')
      .eq('workspace_id', id)

    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({ members: data ?? [] })
  })

  // POST /workspaces/:id/members — invite by email
  server.post<{ Params: WorkspaceParams; Body: InviteMemberBody }>(
    '/:id/members',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['owner', 'admin', 'member'] },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id } = req.params
      const { email, role = 'member' } = req.body

      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!self || !['owner', 'admin'].includes(self.role)) {
        return reply.status(403).send({ error: 'Only owners and admins can invite members' })
      }

      // Lookup user by email
      const { data: targetUser } = await server.supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!targetUser) {
        return reply.status(404).send({ error: 'User not found. They must sign up first.' })
      }

      const { data: member, error } = await server.supabaseAdmin
        .from('workspace_members')
        .insert({ workspace_id: id, user_id: targetUser.id, role })
        .select('id, role, joined_at, user:users(id, email, display_name)')
        .single()

      if (error) {
        if (error.code === '23505') {
          return reply.status(409).send({ error: 'User is already a member' })
        }
        return reply.status(400).send({ error: error.message })
      }

      return reply.status(201).send({ member })
    }
  )

  // DELETE /workspaces/:id/members/:userId
  server.delete<{ Params: MemberParams }>('/:id/members/:userId', auth, async (req, reply) => {
    const requestingUserId = req.user!.id
    const { id, userId: targetUserId } = req.params

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', requestingUserId)
      .single()

    // Allow self-removal or owner/admin removal
    if (!self) return reply.status(403).send({ error: 'Not a member' })
    if (requestingUserId !== targetUserId && !['owner', 'admin'].includes(self.role)) {
      return reply.status(403).send({ error: 'Only owners and admins can remove members' })
    }

    const { error } = await server.supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', targetUserId)

    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(204).send()
  })

  // ── Tags ─────────────────────────────────────────────────────────────────────

  // GET /workspaces/:id/tags
  server.get<{ Params: WorkspaceParams }>('/:id/tags', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id } = req.params

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!self) return reply.status(403).send({ error: 'Not a member' })

    const { data, error } = await server.supabaseAdmin
      .from('tags')
      .select('*')
      .eq('workspace_id', id)
      .order('name')

    if (error) return reply.status(500).send({ error: error.message })

    return reply.send({ tags: data ?? [] })
  })

  // POST /workspaces/:id/tags
  server.post<{ Params: WorkspaceParams; Body: CreateTagBody }>(
    '/:id/tags',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 50 },
            color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id } = req.params
      const { name, color } = req.body

      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!self) return reply.status(403).send({ error: 'Not a member' })

      const { data: tag, error } = await server.supabaseAdmin
        .from('tags')
        .insert({ workspace_id: id, name, color: color ?? null })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return reply.status(409).send({ error: 'Tag name already exists in this workspace' })
        }
        return reply.status(400).send({ error: error.message })
      }

      return reply.status(201).send({ tag })
    }
  )

  // DELETE /workspaces/:id/tags/:tagId
  server.delete<{ Params: TagParams }>('/:id/tags/:tagId', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id, tagId } = req.params

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!self || !['owner', 'admin'].includes(self.role)) {
      return reply.status(403).send({ error: 'Only owners and admins can delete tags' })
    }

    const { error } = await server.supabaseAdmin
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('workspace_id', id)

    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(204).send()
  })

  // ── Entries ──────────────────────────────────────────────────────────────────

  // GET /workspaces/:id/entries
  server.get<{ Params: WorkspaceParams; Querystring: EntryListQuery }>(
    '/:id/entries',
    {
      ...auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            tagId: { type: 'string', format: 'uuid' },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id } = req.params
      const { tagId, limit = 20, offset = 0 } = req.query

      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!self) return reply.status(403).send({ error: 'Not a member' })

      let query = server.supabaseAdmin
        .from('entries')
        .select('*, tags:entry_tags(tag:tags(id, name, color)), author:users(id, email, display_name)', { count: 'exact' })
        .eq('workspace_id', id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (tagId) {
        // Filter entries that have this tag
        const { data: entryIds } = await server.supabaseAdmin
          .from('entry_tags')
          .select('entry_id')
          .eq('tag_id', tagId)

        const ids = (entryIds ?? []).map((r: any) => r.entry_id)
        if (ids.length === 0) return reply.send({ entries: [], total: 0 })

        query = query.in('id', ids)
      }

      const { data, error, count } = await query

      if (error) return reply.status(500).send({ error: error.message })

      return reply.send({ entries: data ?? [], total: count ?? 0 })
    }
  )

  // POST /workspaces/:id/entries
  server.post<{ Params: WorkspaceParams; Body: CreateEntryBody }>(
    '/:id/entries',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 500 },
            body: { type: 'string', default: '' },
            tagIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id } = req.params
      const { title, body = '', tagIds = [] } = req.body

      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!self) return reply.status(403).send({ error: 'Not a member' })

      const { data: entry, error } = await server.supabaseAdmin
        .from('entries')
        .insert({ workspace_id: id, author_id: userId, title, body })
        .select()
        .single()

      if (error) return reply.status(400).send({ error: error.message })

      if (tagIds.length > 0) {
        const tagLinks = tagIds.map((tagId: string) => ({ entry_id: entry.id, tag_id: tagId }))
        await server.supabaseAdmin.from('entry_tags').insert(tagLinks)
      }

      // Generate embedding asynchronously — don't block the response
      generateEmbedding(entryEmbeddingText(title, body)).then((embedding) => {
        if (embedding) {
          server.supabaseAdmin
            .from('entries')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', entry.id)
            .then(({ error: embErr }) => {
              if (embErr) console.error('[entries] Failed to save embedding:', embErr.message)
            })
        }
      })

      return reply.status(201).send({ entry })
    }
  )

  // GET /workspaces/:id/entries/:entryId
  server.get<{ Params: EntryParams }>('/:id/entries/:entryId', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id, entryId } = req.params

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!self) return reply.status(403).send({ error: 'Not a member' })

    const { data: entry, error } = await server.supabaseAdmin
      .from('entries')
      .select('*, tags:entry_tags(tag:tags(id, name, color)), author:users(id, email, display_name)')
      .eq('id', entryId)
      .eq('workspace_id', id)
      .single()

    if (error || !entry) return reply.status(404).send({ error: 'Entry not found' })

    return reply.send({ entry })
  })

  // PATCH /workspaces/:id/entries/:entryId
  server.patch<{ Params: EntryParams; Body: UpdateEntryBody }>(
    '/:id/entries/:entryId',
    {
      ...auth,
      schema: {
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 500 },
            body: { type: 'string' },
            tagIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 20 },
          },
        },
      },
    },
    async (req, reply) => {
      const userId = req.user!.id
      const { id, entryId } = req.params

      // Verify entry exists and user is author or admin
      const { data: entry } = await server.supabaseAdmin
        .from('entries')
        .select('author_id, title, body')
        .eq('id', entryId)
        .eq('workspace_id', id)
        .single()

      if (!entry) return reply.status(404).send({ error: 'Entry not found' })

      const { data: self } = await server.supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', userId)
        .single()

      if (!self) return reply.status(403).send({ error: 'Not a member' })
      if (entry.author_id !== userId && !['owner', 'admin'].includes(self.role)) {
        return reply.status(403).send({ error: 'Only the author or admins can edit entries' })
      }

      const updates: Record<string, unknown> = {}
      if (req.body.title !== undefined) updates.title = req.body.title
      if (req.body.body !== undefined) updates.body = req.body.body

      if (Object.keys(updates).length > 0) {
        const { error } = await server.supabaseAdmin
          .from('entries')
          .update(updates)
          .eq('id', entryId)

        if (error) return reply.status(400).send({ error: error.message })

        // Regenerate embedding when title or body changes
        if (updates.title !== undefined || updates.body !== undefined) {
          const newTitle = (updates.title as string | undefined) ?? (entry as any).title ?? ''
          const newBody = (updates.body as string | undefined) ?? (entry as any).body ?? ''
          generateEmbedding(entryEmbeddingText(newTitle, newBody)).then((embedding) => {
            if (embedding) {
              server.supabaseAdmin
                .from('entries')
                .update({ embedding: JSON.stringify(embedding) })
                .eq('id', entryId)
                .then(({ error: embErr }) => {
                  if (embErr) console.error('[entries] Failed to update embedding:', embErr.message)
                })
            }
          })
        }
      }

      // Update tags if provided
      if (req.body.tagIds !== undefined) {
        await server.supabaseAdmin.from('entry_tags').delete().eq('entry_id', entryId)
        if (req.body.tagIds.length > 0) {
          const tagLinks = req.body.tagIds.map((tagId: string) => ({ entry_id: entryId, tag_id: tagId }))
          await server.supabaseAdmin.from('entry_tags').insert(tagLinks)
        }
      }

      const { data: updated } = await server.supabaseAdmin
        .from('entries')
        .select('*, tags:entry_tags(tag:tags(id, name, color)), author:users(id, email, display_name)')
        .eq('id', entryId)
        .single()

      return reply.send({ entry: updated })
    }
  )

  // DELETE /workspaces/:id/entries/:entryId
  server.delete<{ Params: EntryParams }>('/:id/entries/:entryId', auth, async (req, reply) => {
    const userId = req.user!.id
    const { id, entryId } = req.params

    const { data: entry } = await server.supabaseAdmin
      .from('entries')
      .select('author_id')
      .eq('id', entryId)
      .eq('workspace_id', id)
      .single()

    if (!entry) return reply.status(404).send({ error: 'Entry not found' })

    const { data: self } = await server.supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', id)
      .eq('user_id', userId)
      .single()

    if (!self) return reply.status(403).send({ error: 'Not a member' })
    if (entry.author_id !== userId && !['owner', 'admin'].includes(self.role)) {
      return reply.status(403).send({ error: 'Only the author or admins can delete entries' })
    }

    const { error } = await server.supabaseAdmin.from('entries').delete().eq('id', entryId)
    if (error) return reply.status(500).send({ error: error.message })

    return reply.status(204).send()
  })
}
