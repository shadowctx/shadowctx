import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  ContextStore,
  Page,
  PageInput,
  SearchResult,
  ListOptions,
  Stats,
} from '@shadowctx/core'
import { generateEmbedding, pageEmbeddingText } from '@shadowctx/core'

export interface SupabaseStoreOptions {
  supabaseUrl: string
  supabaseServiceKey: string
  /** Optional user_id to scope reads/writes. Leave undefined for self-hosted (no auth). */
  userId?: string
}

export class SupabaseStore implements ContextStore {
  private client: SupabaseClient
  private userId: string | undefined

  constructor(opts: SupabaseStoreOptions) {
    this.client = createClient(opts.supabaseUrl, opts.supabaseServiceKey)
    this.userId = opts.userId
  }

  async save(input: PageInput): Promise<Page> {
    const embeddingText = pageEmbeddingText(input.title ?? null, input.content ?? null)
    const embedding = embeddingText ? await generateEmbedding(embeddingText) : null

    const row = {
      user_id: input.user_id ?? this.userId ?? null,
      type: input.type ?? 'page',
      url: input.url ?? null,
      title: input.title ?? null,
      content: input.content ?? null,
      html: input.html ?? null,
      note: input.note ?? null,
      tags: input.tags ?? [],
      source: input.source ?? 'api',
      metadata: input.metadata ?? {},
      ...(embedding ? { embedding: `[${embedding.join(',')}]` } : {}),
    }

    const { data, error } = await this.client
      .from('pages')
      .insert(row)
      .select()
      .single()

    if (error) throw new Error(`[SupabaseStore] save failed: ${error.message}`)
    return this.toPage(data)
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const embedding = await generateEmbedding(query)
    if (!embedding) {
      // Fallback: full-text search
      const { data, error } = await this.client
        .from('pages')
        .select('*')
        .textSearch('content', query, { type: 'websearch', config: 'english' })
        .limit(limit)

      if (error) throw new Error(`[SupabaseStore] fts search failed: ${error.message}`)
      return (data ?? []).map((row) => ({ page: this.toPage(row), similarity: 0 }))
    }

    const { data, error } = await this.client.rpc('search_pages', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count: limit,
      match_threshold: 0.3,
      p_user_id: this.userId ?? null,
    })

    if (error) throw new Error(`[SupabaseStore] semantic search failed: ${error.message}`)

    return (data ?? []).map((row: any) => ({
      page: this.toPage(row),
      similarity: row.similarity as number,
    }))
  }

  async get(id: string): Promise<Page | null> {
    const { data, error } = await this.client
      .from('pages')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`[SupabaseStore] get failed: ${error.message}`)
    return data ? this.toPage(data) : null
  }

  async list(opts: ListOptions = {}): Promise<Page[]> {
    let q = this.client.from('pages').select('*')

    if (this.userId) q = q.eq('user_id', this.userId)
    if (opts.source) q = q.eq('source', opts.source)
    if (opts.tag) q = q.contains('tags', JSON.stringify([opts.tag]))

    q = q
      .order('created_at', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 20) - 1)

    const { data, error } = await q
    if (error) throw new Error(`[SupabaseStore] list failed: ${error.message}`)
    return (data ?? []).map((row) => this.toPage(row))
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('pages').delete().eq('id', id)
    if (error) throw new Error(`[SupabaseStore] delete failed: ${error.message}`)
  }

  async getTags(): Promise<string[]> {
    const { data, error } = await this.client.from('pages').select('tags')
    if (error) throw new Error(`[SupabaseStore] getTags failed: ${error.message}`)

    const tagSet = new Set<string>()
    for (const row of data ?? []) {
      for (const tag of row.tags ?? []) tagSet.add(tag)
    }
    return Array.from(tagSet).sort()
  }

  async getStats(): Promise<Stats> {
    const { data, error, count } = await this.client
      .from('pages')
      .select('tags, created_at', { count: 'exact' })
      .order('created_at', { ascending: true })

    if (error) throw new Error(`[SupabaseStore] getStats failed: ${error.message}`)

    const rows = data ?? []
    const tagSet = new Set<string>()
    for (const row of rows) {
      for (const tag of row.tags ?? []) tagSet.add(tag)
    }

    return {
      total: count ?? rows.length,
      tags: Array.from(tagSet).sort(),
      oldest: rows[0]?.created_at ?? null,
      newest: rows[rows.length - 1]?.created_at ?? null,
    }
  }

  private toPage(row: any): Page {
    return {
      id: row.id,
      user_id: row.user_id ?? null,
      type: row.type ?? 'page',
      url: row.url ?? null,
      title: row.title ?? null,
      content: row.content ?? null,
      html: row.html ?? null,
      note: row.note ?? null,
      tags: row.tags ?? [],
      source: row.source ?? 'api',
      metadata: row.metadata ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
}
