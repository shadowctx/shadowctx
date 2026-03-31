const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings'
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Generate a 1536-dim embedding for the given text via OpenAI text-embedding-3-small.
 * Returns null (and logs the error) if the API call fails — callers should not
 * block writes on embedding failures.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('[embeddings] OPENAI_API_KEY not set — skipping embedding generation')
    return null
  }

  const trimmed = text.trim().slice(0, 8192) // stay well within token limit
  if (!trimmed) return null

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: trimmed,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[embeddings] OpenAI API error ${res.status}: ${body}`)
      return null
    }

    const json = await res.json() as { data: { embedding: number[] }[] }
    return json.data[0]?.embedding ?? null
  } catch (err) {
    console.error('[embeddings] Fetch failed:', err)
    return null
  }
}

/**
 * Build the text to embed from an entry's title and body.
 */
export function entryEmbeddingText(title: string, body: string): string {
  return `${title}\n\n${body}`.trim()
}
