#!/usr/bin/env node
/**
 * ShadowCTX MCP Server — stdio transport
 *
 * Exposes ContextStore as MCP tools and resources so any MCP-compatible AI
 * (Claude Desktop, Cursor, etc.) can search and browse your saved pages.
 *
 * Tools:
 *   search_context(query, limit?)   — semantic search across saved pages
 *   get_context(id)                 — full content of a page
 *   list_recent(limit?)             — last N saved items
 *   list_by_tag(tag)                — items with specific tag
 *   get_stats()                     — total items, tags, date range
 *
 * Resources:
 *   context://recent                — last 10 items
 *   context://tags                  — all tags
 *
 * TODO: Full implementation in SHA-12.
 * This stub wires up the server skeleton so the package builds and the binary
 * entry point exists. Replace the placeholder handlers with real ContextStore
 * calls once the MCP SDK integration is confirmed.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { SupabaseStore } from '@shadowctx/store-supabase'

function createStore() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return new SupabaseStore({ supabaseUrl: url, supabaseServiceKey: key })
}

async function main() {
  const store = createStore()

  const server = new Server(
    { name: 'shadowctx', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {} } }
  )

  // --- Tools ---

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_context',
        description: 'Semantic search across your saved pages',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default 10)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_context',
        description: 'Get the full content of a saved page by ID',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      {
        name: 'list_recent',
        description: 'List the most recently saved pages',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', description: 'Max results (default 10)' } },
        },
      },
      {
        name: 'list_by_tag',
        description: 'List pages with a specific tag',
        inputSchema: {
          type: 'object',
          properties: { tag: { type: 'string' } },
          required: ['tag'],
        },
      },
      {
        name: 'get_stats',
        description: 'Get statistics about your saved context (total items, tags, date range)',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    switch (name) {
      case 'search_context': {
        const results = await store.search(args!.query as string, (args!.limit as number) ?? 10)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                results.map((r) => ({
                  id: r.page.id,
                  title: r.page.title,
                  url: r.page.url,
                  similarity: r.similarity,
                  snippet: r.page.content?.slice(0, 300),
                })),
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_context': {
        const page = await store.get(args!.id as string)
        if (!page) return { content: [{ type: 'text', text: 'Not found' }] }
        return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }] }
      }

      case 'list_recent': {
        const pages = await store.list({ limit: (args!.limit as number) ?? 10 })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                pages.map((p) => ({ id: p.id, title: p.title, url: p.url, created_at: p.created_at })),
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_by_tag': {
        const pages = await store.list({ tag: args!.tag as string })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                pages.map((p) => ({ id: p.id, title: p.title, url: p.url })),
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_stats': {
        const stats = await store.getStats()
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  })

  // --- Resources ---

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'context://recent',
        name: 'Recent saved pages',
        description: 'Last 10 items saved to your context store',
        mimeType: 'application/json',
      },
      {
        uri: 'context://tags',
        name: 'All tags',
        description: 'All distinct tags across your saved pages',
        mimeType: 'application/json',
      },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params

    if (uri === 'context://recent') {
      const pages = await store.list({ limit: 10 })
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              pages.map((p) => ({ id: p.id, title: p.title, url: p.url, created_at: p.created_at })),
              null,
              2
            ),
          },
        ],
      }
    }

    if (uri === 'context://tags') {
      const tags = await store.getTags()
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(tags) }],
      }
    }

    throw new Error(`Unknown resource: ${uri}`)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('[mcp] Fatal:', err)
  process.exit(1)
})
