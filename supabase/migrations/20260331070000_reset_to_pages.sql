-- ShadowCTX schema reset: replace B2B team tables with personal pages table
-- Drops workspaces/members/entries/tags schema and installs the personal pages table.

-- Drop old tables (order matters for FK constraints)
DROP TABLE IF EXISTS public.entry_tags;
DROP TABLE IF EXISTS public.tags;
DROP TABLE IF EXISTS public.entries;
DROP TABLE IF EXISTS public.workspace_members;
DROP TABLE IF EXISTS public.workspaces;
DROP TABLE IF EXISTS public.users;

-- Drop old functions
DROP FUNCTION IF EXISTS public.search_entries;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Ensure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Personal pages table
CREATE TABLE public.pages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,  -- nullable for self-hosted (no auth)
  type        TEXT        NOT NULL DEFAULT 'page'
                          CHECK (type IN ('page', 'text', 'image', 'file', 'highlight')),
  url         TEXT,
  title       TEXT,
  content     TEXT,               -- clean extracted text (via Readability)
  html        TEXT,               -- raw/cleaned HTML (optional storage)
  note        TEXT,               -- user-added annotation
  tags        JSONB       NOT NULL DEFAULT '[]',
  embedding   VECTOR(1536),       -- OpenAI text-embedding-3-small (1536 dims)
  source      TEXT        NOT NULL DEFAULT 'extension'
                          CHECK (source IN ('extension', 'cli', 'mobile', 'api')),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pages_user_id    ON public.pages (user_id);
CREATE INDEX idx_pages_source     ON public.pages (source);
CREATE INDEX idx_pages_created_at ON public.pages (created_at DESC);
-- Approximate nearest-neighbour index for semantic search (switch to hnsw at scale)
CREATE INDEX idx_pages_embedding  ON public.pages USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Row-level security
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Each user can only access their own pages (self-hosted rows where user_id IS NULL are unrestricted)
CREATE POLICY "users see own pages" ON public.pages
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());

-- Semantic search function
CREATE OR REPLACE FUNCTION search_pages(
  query_embedding VECTOR(1536),
  match_count      INT     DEFAULT 10,
  match_threshold  FLOAT   DEFAULT 0.5,
  p_user_id        UUID    DEFAULT NULL
)
RETURNS TABLE (
  id         UUID,
  url        TEXT,
  title      TEXT,
  content    TEXT,
  note       TEXT,
  tags       JSONB,
  source     TEXT,
  metadata   JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.url,
    p.title,
    p.content,
    p.note,
    p.tags,
    p.source,
    p.metadata,
    (1.0 - (p.embedding <=> query_embedding))::FLOAT AS similarity,
    p.created_at
  FROM public.pages p
  WHERE
    p.embedding IS NOT NULL
    AND (p_user_id IS NULL OR p.user_id = p_user_id OR p.user_id IS NULL)
    AND (1.0 - (p.embedding <=> query_embedding)) >= match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
