import type { Page, PageInput, SearchResult, ListOptions, Stats } from './types.js'

export interface ContextStore {
  /** Save a page to the store. Embedding is generated internally. */
  save(page: PageInput): Promise<Page>

  /** Semantic search across saved pages. */
  search(query: string, limit?: number): Promise<SearchResult[]>

  /** Get a page by ID. Returns null if not found. */
  get(id: string): Promise<Page | null>

  /** List pages with optional filtering. */
  list(opts?: ListOptions): Promise<Page[]>

  /** Delete a page by ID. */
  delete(id: string): Promise<void>

  /** Return all distinct tags. */
  getTags(): Promise<string[]>

  /** Return aggregate stats. */
  getStats(): Promise<Stats>
}
