-- Combined full-text + semantic search function for ShadowCTX
-- For MVP (<10k entries) sequential scans are acceptable.
-- When entries exceed 10k rows, add: CREATE INDEX ON entries USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION search_entries(
  ws_id UUID,
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  workspace_id UUID,
  author_id UUID,
  title TEXT,
  body TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  fts_rank FLOAT,
  semantic_score FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH fts AS (
    SELECT
      e.id,
      ts_rank(
        to_tsvector('english', e.title || ' ' || e.body),
        websearch_to_tsquery('english', query_text)
      ) AS rank
    FROM public.entries e
    WHERE
      e.workspace_id = ws_id
      AND to_tsvector('english', e.title || ' ' || e.body)
          @@ websearch_to_tsquery('english', query_text)
  ),
  semantic AS (
    SELECT
      e.id,
      (1.0 - (e.embedding <=> query_embedding))::FLOAT AS score
    FROM public.entries e
    WHERE
      e.workspace_id = ws_id
      AND e.embedding IS NOT NULL
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count
  ),
  combined AS (
    SELECT
      COALESCE(f.id, s.id) AS cid,
      COALESCE(f.rank, 0)::FLOAT  AS fts,
      COALESCE(s.score, 0)::FLOAT AS sem,
      (COALESCE(f.rank, 0) * 2.0 + COALESCE(s.score, 0))::FLOAT AS combined
    FROM fts f
    FULL OUTER JOIN semantic s ON f.id = s.id
  )
  SELECT
    e.id, e.workspace_id, e.author_id, e.title, e.body, e.embedding,
    e.created_at, e.updated_at,
    c.fts, c.sem, c.combined
  FROM combined c
  JOIN public.entries e ON c.cid = e.id
  ORDER BY c.combined DESC
  LIMIT match_count;
END;
$$;
