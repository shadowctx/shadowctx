import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type {
  ContextStore,
  Page,
  PageInput,
  SearchResult,
  ListOptions,
  Stats,
} from '@shadowctx/core'
import { generateEmbedding, pageEmbeddingText } from '@shadowctx/core'

export interface SqliteStoreOptions {
  /** Path to the SQLite database file. Defaults to './shadowctx.db' */
  dbPath?: string
  /** Optional user_id to scope reads/writes. Leave undefined for self-hosted (no auth). */
  userId?: string
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS pages (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL DEFAULT 'page',
    url TEXT,
    title TEXT,
    content TEXT,
    html TEXT,
    note TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    embedding TEXT,
    source TEXT NOT NULL DEFAULT 'api',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`

export class SqliteStore implements ContextStore {
  private db: Database.Database
  private userId: string | undefined

  constructor(opts: SqliteStoreOptions = {}) {
    this.db = new Database(opts.dbPath ?? './shadowctx.db')
    this.userId = opts.userId
    this.db.pragma('journal_mode = WAL')
    this.db.exec(CREATE_TABLE)
  }

  async save(input: PageInput): Promise<Page> {
    const embeddingText = pageEmbeddingText(input.title ?? null, input.content ?? null)
    const embedding = embeddingText ? await generateEmbedding(embeddingText) : null

    const now = new Date().toISOString()
    const id = randomUUID()

    const row = {
      id,
      user_id: input.user_id ?? this.userId ?? null,
      type: input.type ?? 'page',
      url: input.url ?? null,
      title: input.title ?? null,
      content: input.content ?? null,
      html: input.html ?? null,
      note: input.note ?? null,
      tags: JSON.stringify(input.tags ?? []),
      embedding: embedding ? JSON.stringify(embedding) : null,
      source: input.source ?? 'api',
      metadata: JSON.stringify(input.metadata ?? {}),
      created_at: now,
      updated_at: now,
    }

    const stmt = this.db.prepare(`
      INSERT INTO pages (id, user_id, type, url, title, content, html, note, tags, embedding, source, metadata, created_at, updated_at)
      VALUES (@id, @user_id, @type, @url, @title, @content, @html, @note, @tags, @embedding, @source, @metadata, @created_at, @updated_at)
    `)
    stmt.run(row)

    return this.toPage({ ...row, tags: input.tags ?? [], metadata: input.metadata ?? {} })
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const queryEmbedding = await generateEmbedding(query)

    if (!queryEmbedding) {
      // Fallback: simple substring match on title and content
      const rows = this.db
        .prepare(
          `SELECT * FROM pages WHERE (title LIKE ? OR content LIKE ?) ORDER BY created_at DESC LIMIT ?`
        )
        .all(`%${query}%`, `%${query}%`, limit) as RawRow[]
      return rows.map((row) => ({ page: this.toPage(row), similarity: 0 }))
    }

    // Load all rows with embeddings and compute cosine similarity in JS
    let q = `SELECT * FROM pages`
    const params: unknown[] = []
    if (this.userId) {
      q += ` WHERE user_id = ?`
      params.push(this.userId)
    }
    const rows = this.db.prepare(q).all(...params) as RawRow[]

    const scored: SearchResult[] = []
    for (const row of rows) {
      if (!row.embedding) continue
      const vec: number[] = JSON.parse(row.embedding as string)
      const sim = cosineSimilarity(queryEmbedding, vec)
      if (sim > 0) scored.push({ page: this.toPage(row), similarity: sim })
    }

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  async get(id: string): Promise<Page | null> {
    const row = this.db.prepare(`SELECT * FROM pages WHERE id = ?`).get(id) as RawRow | undefined
    return row ? this.toPage(row) : null
  }

  async list(opts: ListOptions = {}): Promise<Page[]> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (this.userId) {
      conditions.push(`user_id = ?`)
      params.push(this.userId)
    }
    if (opts.source) {
      conditions.push(`source = ?`)
      params.push(opts.source)
    }
    if (opts.tag) {
      // JSON array contains tag — use json_each for reliable matching
      conditions.push(
        `EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)`
      )
      params.push(opts.tag)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = opts.limit ?? 20
    const offset = opts.offset ?? 0

    const rows = this.db
      .prepare(`SELECT * FROM pages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as RawRow[]

    return rows.map((row) => this.toPage(row))
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM pages WHERE id = ?`).run(id)
  }

  async getTags(): Promise<string[]> {
    const rows = this.db.prepare(`SELECT tags FROM pages`).all() as { tags: string }[]
    const tagSet = new Set<string>()
    for (const row of rows) {
      const tags: string[] = JSON.parse(row.tags)
      for (const tag of tags) tagSet.add(tag)
    }
    return Array.from(tagSet).sort()
  }

  async getStats(): Promise<Stats> {
    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total, MIN(created_at) as oldest, MAX(created_at) as newest FROM pages`)
      .get() as { total: number; oldest: string | null; newest: string | null }

    const tagRows = this.db.prepare(`SELECT tags FROM pages`).all() as { tags: string }[]
    const tagSet = new Set<string>()
    for (const row of tagRows) {
      const tags: string[] = JSON.parse(row.tags)
      for (const tag of tags) tagSet.add(tag)
    }

    return {
      total: countRow.total,
      tags: Array.from(tagSet).sort(),
      oldest: countRow.oldest,
      newest: countRow.newest,
    }
  }

  /** Close the underlying SQLite connection. */
  close(): void {
    this.db.close()
  }

  private toPage(row: RawRow | Record<string, unknown>): Page {
    return {
      id: row.id as string,
      user_id: (row.user_id as string | null) ?? null,
      type: (row.type as Page['type']) ?? 'page',
      url: (row.url as string | null) ?? null,
      title: (row.title as string | null) ?? null,
      content: (row.content as string | null) ?? null,
      html: (row.html as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      tags: Array.isArray(row.tags)
        ? (row.tags as string[])
        : JSON.parse((row.tags as string) ?? '[]'),
      source: (row.source as Page['source']) ?? 'api',
      metadata:
        typeof row.metadata === 'object' && !Array.isArray(row.metadata) && row.metadata !== null
          ? (row.metadata as Record<string, unknown>)
          : JSON.parse((row.metadata as string) ?? '{}'),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }
  }
}

interface RawRow {
  id: string
  user_id: string | null
  type: string
  url: string | null
  title: string | null
  content: string | null
  html: string | null
  note: string | null
  tags: string
  embedding: string | null
  source: string
  metadata: string
  created_at: string
  updated_at: string
}
