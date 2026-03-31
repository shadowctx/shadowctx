import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

export interface ExtractedPage {
  title: string | null
  content: string | null
  html: string | null
}

/**
 * Extract clean title + text content from raw HTML using Readability.
 * Returns nulls for fields that could not be extracted.
 */
export function extractFromHtml(html: string, url?: string): ExtractedPage {
  try {
    const dom = new JSDOM(html, { url: url ?? 'https://example.com' })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article) {
      return { title: null, content: null, html }
    }

    return {
      title: article.title || null,
      content: article.textContent?.trim() || null,
      html: article.content || html,
    }
  } catch (err) {
    console.error('[extraction] Readability parse failed:', err)
    return { title: null, content: null, html }
  }
}

/**
 * Fetch a URL and extract its content.
 * Returns nulls if the fetch or extraction fails.
 */
export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ShadowCTX/0.1 context-saver' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.error(`[extraction] Fetch failed ${res.status} for ${url}`)
      return { title: null, content: null, html: null }
    }

    const html = await res.text()
    return extractFromHtml(html, url)
  } catch (err) {
    console.error('[extraction] Fetch error:', err)
    return { title: null, content: null, html: null }
  }
}
