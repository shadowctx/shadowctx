# ShadowCTX

> Your AI has no memory of what you browse.

ShadowCTX is a personal AI context tool that captures pages, notes, and decisions as you work — and lets you search them semantically later. It runs locally, stores everything in SQLite, and exposes a REST API that your AI assistants can query.

---

## Architecture

```
┌─────────────────┐   ┌──────────────────┐   ┌───────────────────┐
│  Chrome          │   │  CLI (ctx)       │   │  MCP Server       │
│  Extension       │   │  npm i -g        │   │  (Claude/Cursor)  │
│  (packages/      │   │  shadowctx       │   │  packages/mcp     │
│   extension)     │   │  packages/cli    │   │                   │
└────────┬─────────┘   └────────┬─────────┘   └─────────┬─────────┘
         │                      │                        │
         └──────────────────────┼────────────────────────┘
                                ▼
              ┌─────────────────────────────────┐
              │   REST API (packages/server)     │
              │   Fastify · POST /pages          │
              │              GET  /pages/search  │
              └─────────────────┬───────────────┘
                                │
              ┌─────────────────┴───────────────┐
              │  ContextStore interface          │
              ├──────────────────────────────────┤
              │  SqliteStore (self-hosted)        │
              │  SupabaseStore (cloud/SaaS)       │
              └──────────────────────────────────┘
```

| Package | Description |
|---|---|
| `packages/core` | `ContextStore` interface, types, embeddings, HTML extraction |
| `packages/store-sqlite` | SQLite backend with JS cosine similarity |
| `packages/store-supabase` | Supabase + pgvector backend |
| `packages/server` | Fastify REST API server |
| `packages/cli` | `ctx` CLI — `ctx save <url>`, `ctx search <query>` |
| `packages/mcp` | MCP server for AI assistants (Claude, Cursor) |
| `packages/extension` | Chrome Extension (Manifest V3) |

---

## Quick Start

### Self-hosted (Docker — recommended)

```bash
docker compose up
```

That's it. The API is available at `http://localhost:3000`.

Pages are stored in `./data/shadowctx.db` (mounted into the container).

### CLI

```bash
npm install -g @shadowctx/cli

# Save a page (fetches + extracts content automatically)
ctx save https://example.com/article --tag ai --note "good reference"

# Search saved pages
ctx search "transformer architecture"
```

Set `SHADOWCTX_API_URL` (default `http://localhost:3000`) and optionally `OPENAI_API_KEY` for semantic search.

### MCP (AI Assistants)

Add to your Claude / Cursor config:

```json
{
  "mcpServers": {
    "shadowctx": {
      "command": "npx",
      "args": ["-y", "@shadowctx/mcp"],
      "env": {
        "SHADOWCTX_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Chrome Extension

1. Build: `cd packages/extension && pnpm build`
2. Load `packages/extension/dist` as an unpacked extension in `chrome://extensions`
3. Point it at `http://localhost:3000` in the extension popup

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/pages` | Save a page |
| `GET` | `/pages` | List pages (`limit`, `offset`, `tag`, `source`) |
| `GET` | `/pages/search?q=` | Semantic + keyword search |
| `GET` | `/pages/tags` | All tags |
| `GET` | `/pages/stats` | Total pages, date range |
| `GET` | `/pages/:id` | Get a single page |
| `DELETE` | `/pages/:id` | Delete a page |
| `GET` | `/health` | Health check |

**Save a page (POST /pages):**

```json
{
  "url": "https://example.com",
  "title": "Optional override",
  "note": "Why I saved this",
  "tags": ["ai", "research"],
  "fetch": true
}
```

Set `"fetch": true` to have the server fetch and extract content from the URL automatically.

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the API server in dev mode (SQLite, no config needed)
STORE=sqlite pnpm dev

# Run all tests
pnpm test
```

### Environment Variables (server)

| Variable | Default | Description |
|---|---|---|
| `STORE` | `supabase` | Backend: `sqlite` or `supabase` |
| `DB_PATH` | `./shadowctx.db` | SQLite file path (when `STORE=sqlite`) |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `127.0.0.1` | Host to bind to |
| `SUPABASE_URL` | — | Required when `STORE=supabase` |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Required when `STORE=supabase` |
| `OPENAI_API_KEY` | — | Optional; enables semantic search |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, package overview, and PR guidelines.

## License

[MIT](./LICENSE)
