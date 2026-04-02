#!/usr/bin/env node
/**
 * ctx — ShadowCTX CLI
 *
 * Usage:
 *   ctx init                              — first-run setup wizard
 *   ctx save <url> [--tag <tag>] [--note <note>]
 *   ctx search <query> [--json] [--limit N]
 *   ctx list [--limit N] [--tag <tag>] [--json]
 *   ctx get <id> [--json]
 */

import * as os from 'os'
import * as path from 'path'
import * as readline from 'readline'
import { SupabaseStore } from '@shadowctx/store-supabase'
import { SqliteStore } from '@shadowctx/store-sqlite'
import { fetchAndExtract } from '@shadowctx/core'
import { loadConfig, saveConfig } from './config'
import { cloudSignup, cloudLogin } from './auth'

function createStore() {
  const cfg = loadConfig()
  if (!cfg) {
    console.error('ShadowCTX is not set up. Run: ctx init')
    process.exit(1)
  }

  if (cfg.backend === 'sqlite') {
    return new SqliteStore({ dbPath: cfg.dbPath })
  }

  // supabase backend
  const url = process.env.SUPABASE_URL ?? 'https://wrqbwyyntobqygjmnmtx.supabase.co'
  return new SupabaseStore({
    supabaseUrl: url,
    supabaseServiceKey: cfg.accessToken,
    userId: cfg.userId,
  })
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

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function runInit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log('\nWelcome to ShadowCTX!\n')
  console.log('Choose a backend:')
  console.log('  1) Local  — SQLite database on this machine (recommended)')
  console.log('  2) Cloud  — ShadowCTX hosted Supabase (requires account)')
  console.log()

  let choice = ''
  while (choice !== '1' && choice !== '2') {
    choice = (await prompt(rl, 'Enter 1 or 2: ')).trim()
  }

  if (choice === '1') {
    const defaultPath = path.join(os.homedir(), '.local', 'share', 'shadowctx', 'db.sqlite')
    const input = (await prompt(rl, `SQLite path [${defaultPath}]: `)).trim()
    const dbPath = input || defaultPath
    saveConfig({ backend: 'sqlite', dbPath })
    console.log(`\nSaved config. Database will be created at: ${dbPath}`)
    console.log('Run `ctx save <url>` to start saving context.\n')
  } else {
    console.log('\nCloud sign-in options:')
    console.log('  1) Magic link (enter email, click link in email)')
    console.log('  2) Email + password')
    let authChoice = ''
    while (authChoice !== '1' && authChoice !== '2') {
      authChoice = (await prompt(rl, 'Enter 1 or 2: ')).trim()
    }

    const email = (await prompt(rl, 'Email: ')).trim()

    if (authChoice === '1') {
      await cloudSignup(email)
      console.log(`\nMagic link sent to ${email}. Check your inbox, then re-run ctx init to sign in with password after setting one, or use ctx auth verify <token> (coming soon).\n`)
    } else {
      const password = (await prompt(rl, 'Password: ')).trim()
      const result = await cloudLogin(email, password)
      saveConfig({
        backend: 'supabase',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
      })
      console.log('\nSigned in successfully! Config saved.')
      console.log('Run `ctx save <url>` to start saving context.\n')
    }
  }

  rl.close()
}

async function main() {
  const argv = process.argv.slice(2)
  const { positional, flags } = parseArgs(argv)
  const [command, ...rest] = positional

  if (command === 'init') {
    await runInit()
    return
  }

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
  ctx init                              Set up ShadowCTX (run this first)
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
