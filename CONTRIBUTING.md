# Contributing to ShadowCTX

Thanks for your interest in contributing. ShadowCTX is a personal AI context tool — a browser extension, MCP server, and CLI that lets you save web pages to a searchable knowledge base any AI can query.

---

## Setup

**Requirements:** Node.js 20+, pnpm 9+

```bash
git clone https://github.com/shadowctx/shadowctx
cd shadowctx
pnpm install       # installs all workspace deps
pnpm build         # builds all 7 packages in dependency order
```

## Running locally

The easiest way to develop is with SQLite mode — no external services needed:

```bash
# Copy and fill in your env
cp .env.example .env
# Set STORE=sqlite, OPENAI_API_KEY=sk-... (needed for embeddings)

# Start the local API server
cd packages/server
pnpm dev           # Fastify on http://localhost:3000

# In another terminal, test the CLI
cd packages/cli
pnpm build
node dist/index.js save https://example.com
node dist/index.js search "example"
```

For the MCP server:

```bash
cd packages/mcp
pnpm build
# Add to claude_desktop_config.json:
# "command": "node", "args": ["/path/to/packages/mcp/dist/index.js"]
```

For the Chrome extension: `cd packages/extension && pnpm build`, then load `dist/` as an unpacked extension at `chrome://extensions`.

## Running tests

```bash
pnpm test          # runs Vitest across all packages
pnpm test --filter @shadowctx/server   # one package only
```

The E2E smoke test in `packages/server/tests/smoke.test.ts` uses an in-memory SQLite store — no external services needed.

## Package overview

| Package | Purpose |
|---|---|
| `packages/core` | `ContextStore` interface, shared types, embeddings, Readability extraction |
| `packages/store-sqlite` | SQLite implementation of `ContextStore` (self-hosted, no auth) |
| `packages/store-supabase` | Supabase/pgvector implementation (SaaS, multi-user) |
| `packages/server` | Fastify REST API server — wraps any `ContextStore` |
| `packages/mcp` | MCP stdio server — exposes `ContextStore` as MCP tools/resources |
| `packages/cli` | `ctx` binary — CLI wrapper around `ContextStore` |
| `packages/extension` | Chrome Manifest V3 extension — one-click page save |
| `packages/web` | Landing page (Astro + Tailwind, deploys to Vercel) |

The key abstraction is `ContextStore` in `packages/core/src/store.ts`. All surfaces (MCP, CLI, extension) depend only on this interface — they are backend-agnostic.

## Pull request etiquette

- **Small PRs win.** One feature or fix per PR. If it touches more than ~300 lines, split it.
- **Write tests** for anything non-trivial. The smoke test pattern in `packages/server/tests/` is a good template.
- **Conventional commits:** `feat:`, `fix:`, `chore:`, `docs:` prefixes. Keep the subject line under 72 characters.
- **No console.log in library code.** Use `process.stderr.write` in the CLI; libraries should throw or return errors.
- **Don't add dependencies lightly.** Each new dep is a maintenance burden. If it can be done in 10 lines of vanilla TypeScript, do that.
- **Update the relevant README section** if your change affects setup or usage.

## Good first issues

Issues labelled [`good first issue`](https://github.com/shadowctx/shadowctx/labels/good%20first%20issue) are self-contained and well-scoped. Good places to start:

- Adding a new output format to `ctx search` (e.g. `--format markdown`)
- Writing a Cursor rules file variant in `skills/`
- Improving error messages in the CLI
- Adding a `ctx delete <id>` command

## Questions and feature requests

Use [GitHub Discussions](https://github.com/shadowctx/shadowctx/discussions) for questions, ideas, and general discussion. Issues are for bugs and concrete feature requests only.
