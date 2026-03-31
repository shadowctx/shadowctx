#!/usr/bin/env node
/**
 * ctx — ShadowCTX CLI
 *
 * Usage:
 *   ctx save <url> [--tag <tag>] [--note <note>]
 *   ctx search <query> [--json] [--limit N]
 *   ctx list [--limit N] [--tag <tag>] [--json]
 *   ctx get <id> [--json]
 *
 * Config (env vars):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { SupabaseStore } from '@shadowctx/store-supabase'
import { fetchAndExtract } from '@shadowctx/core'

function createStore() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(1)
  }
  return new SupabaseStore({ supabaseUrl: url, supabaseServiceKey: key })
}

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(argv[i])
    }
  }
  return { positional, flags }
}

async function main() {
  const argv = process.argv.slice(2)
  const { positional, flags } = parseArgs(argv)
  const [command, ...rest] = positional

  const store = createStore()

  switch (command) {
    case 'save': {
      const url = rest[0]
      if (!url) {
        console.error('Usage: ctx save <url> [--tag <tag>] [--note <note>]')
        process.exit(1)
      }

      console.error(`Fetching ${url} ...`)
      const extracted = await fetchAndExtract(url)

      const page = await store.save({
        url,
        title: extracted.title ?? undefined,
        content: extracted.content ?? undefined,
        html: extracted.html ?? undefined,
        note: typeof flags.note === 'string' ? flags.note : undefined,
        tags: typeof flags.tag === 'string' ? [flags.tag] : [],
        source: 'cli',
      })

      console.log(`Saved: ${page.id}`)
      console.log(`Title: ${page.title ?? '(none)'}`)
      if (page.tags.length) console.log(`Tags:  ${page.tags.join(', ')}`)
      break
    }

    case 'search': {
      const query = rest.join(' ')
      if (!query) {
        console.error('Usage: ctx search <query> [--json] [--limit N]')
        process.exit(1)
      }
      const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 10
      const results = await store.search(query, limit)

      if (flags.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const { page, similarity } of results) {
          console.log(`\n[${(similarity * 100).toFixed(1)}%] ${page.title ?? '(no title)'}`)
          if (page.url) console.log(`  URL: ${page.url}`)
          if (page.content) console.log(`  ${page.content.slice(0, 200).replace(/\n/g, ' ')} ...`)
        }
      }
      break
    }

    case 'list': {
      const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 20
      const tag = typeof flags.tag === 'string' ? flags.tag : undefined
      const pages = await store.list({ limit, tag })

      if (flags.json) {
        console.log(JSON.stringify(pages, null, 2))
      } else {
        for (const p of pages) {
          console.log(`${p.id.slice(0, 8)}  ${p.title ?? '(no title)'}  ${p.url ?? ''}`)
        }
      }
      break
    }

    case 'get': {
      const id = rest[0]
      if (!id) {
        console.error('Usage: ctx get <id> [--json]')
        process.exit(1)
      }
      const page = await store.get(id)
      if (!page) {
        console.error(`Not found: ${id}`)
        process.exit(1)
      }
      console.log(flags.json ? JSON.stringify(page, null, 2) : page.content ?? '(no content)')
      break
    }

    default:
      console.log(`ctx — ShadowCTX CLI

Usage:
  ctx save <url> [--tag <tag>] [--note <note>]
  ctx search <query> [--json] [--limit N]
  ctx list [--limit N] [--tag <tag>] [--json]
  ctx get <id> [--json]`)
      break
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
