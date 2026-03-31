export type PageType = 'page' | 'text' | 'image' | 'file' | 'highlight'
export type PageSource = 'extension' | 'cli' | 'mobile' | 'api'

export interface Page {
  id: string
  user_id: string | null
  type: PageType
  url: string | null
  title: string | null
  content: string | null
  html: string | null
  note: string | null
  tags: string[]
  source: PageSource
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PageInput {
  user_id?: string | null
  type?: PageType
  url?: string | null
  title?: string | null
  content?: string | null
  html?: string | null
  note?: string | null
  tags?: string[]
  source?: PageSource
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  page: Page
  similarity: number
}

export interface ListOptions {
  limit?: number
  offset?: number
  tag?: string
  source?: PageSource
}

export interface Stats {
  total: number
  tags: string[]
  oldest: string | null
  newest: string | null
}
