# ShadowCTX — Maintenance Reference

> **Purpose:** Single source of truth for ops, infra, accounts, and architecture.
> **Update policy:** Any agent or developer who changes infra, accounts, domains, or adds/removes components MUST update this file in the same commit/PR. Keep entries factual and concise.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Hosting & Deployment](#hosting--deployment)
4. [Database](#database)
5. [Accounts & Services](#accounts--services)
6. [Domains](#domains)
7. [Environment Variables](#environment-variables)
8. [Local Development](#local-development)
9. [CI/CD](#cicd)
10. [Pending Engineering Tasks](#pending-engineering-tasks)
11. [Update Procedure](#update-procedure)

---

## Project Overview

**ShadowCTX** is a modular, backend-agnostic personal AI context tool.
It captures web pages, notes, and decisions (via Chrome extension or CLI), stores them with optional semantic embeddings, and exposes them to AI assistants via MCP, a REST API, or CLI.

- **License:** MIT
- **GitHub org:** https://github.com/shadowctx
- **GitHub repo:** https://github.com/shadowctx/shadowctx (live — pushed 2026-03-31)
- **Landing page:** https://shadowctx.com (live — domain connected to `_default` Vercel project 2026-03-31)

---

## Monorepo Structure

Managed with **pnpm workspaces** (pnpm v9). All packages live under `packages/`.

| Package | Path | Description |
|---------|------|-------------|
| `@shadowctx/core` | `packages/core/` | Core abstractions — `ContextStore` interface, types, embeddings, HTML extraction |
| `@shadowctx/store-sqlite` | `packages/store-sqlite/` | SQLite implementation of `ContextStore` (self-hosted) |
| `@shadowctx/store-supabase` | `packages/store-supabase/` | Supabase + pgvector implementation (cloud) |
| `@shadowctx/server` | `packages/server/` | Fastify REST API server; wraps `ContextStore`, port 3000 |
| `@shadowctx/cli` | `packages/cli/` | CLI tool (`ctx save`, `ctx search`) |
| `@shadowctx/mcp` | `packages/mcp/` | MCP server for AI assistants (Claude Desktop, Cursor, Windsurf) |
| `@shadowctx/extension` | `packages/extension/` | Chrome Manifest V3 extension — one-click page save |
| `@shadowctx/web` | `packages/web/` | Astro + Tailwind landing page; deployed to Vercel |

All packages depend only on `@shadowctx/core` — fully backend-agnostic.

---

## Hosting & Deployment

### Landing Page — Vercel (`shadowctx-app` project)

- **Service:** Vercel
- **Vercel project name:** `shadowctx-app` (renamed from `_default` 2026-03-31 — [SHA-23](/SHA/issues/SHA-23))
- **Vercel project ID:** `prj_830ihTAVUAyZlKGzeUnMKSBWVM7T`
- **Current live URL:** https://shadowctx-app.vercel.app/ (after rename)
- **Live URL:** https://shadowctx.com (connected 2026-03-31; also `www.shadowctx.com`)
- **Deployed package:** `packages/web` (Astro static site)
- **Build command:** `pnpm --filter @shadowctx/web build`
- **Output directory:** `packages/web/dist`
- **Install command:** `pnpm install --ignore-scripts`
- **GitHub integration:** Connected — `shadowctx/shadowctx` linked 2026-03-31; auto-deploy on push to `main` is active ([SHA-22](/SHA/issues/SHA-22))
- **Config file:** `vercel.json`

### Server — Docker / Self-Hosted

- **Dockerfile:** `packages/server/Dockerfile` (multi-stage, Node 20 slim + pnpm 9)
- **Docker Compose:** `docker-compose.yml` at project root
- **Port:** `3000`
- **Persistent storage volume:** `/data` (maps to `./data` on host)
- **Default backend:** SQLite at `/data/shadowctx.db`

```bash
# Start self-hosted instance
docker compose up -d
```

---

## Database

### Cloud — Supabase + PostgreSQL

| Field | Value |
|-------|-------|
| Project name | `shadowctx` |
| Project ID | `wrqbwyyntobqygjmnmtx` |
| Project URL | `https://wrqbwyyntobqygjmnmtx.supabase.co` |
| Database | PostgreSQL with `pgvector` extension |
| Tables | `pages` (single table as of 2026-03-31) |
| Embedding dimensions | 1536 (OpenAI `text-embedding-3-small`) |
| Semantic search function | `search_pages()` — cosine similarity via ivfflat index |
| Auth | Supabase Auth (row-level security; users see only their own pages) |
| Migrations directory | `supabase/migrations/` |

### Self-Hosted — SQLite

- Library: `better-sqlite3`
- Default path: `/data/shadowctx.db` (Docker volume) or in-memory
- Embeddings: JS cosine similarity (no pgvector needed)
- Activate: set `STORE=sqlite` in environment

---

## Accounts & Services

| Service | Purpose | Notes |
|---------|---------|-------|
| **Supabase** | Cloud DB + Auth + pgvector | Project: `shadowctx` (`wrqbwyyntobqygjmnmtx`). Credentials: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **OpenAI** | Semantic embeddings (`text-embedding-3-small`) | Optional; embeddings disabled without `OPENAI_API_KEY` |
| **Vercel** | Landing page hosting | One project: `shadowctx-app` (`prj_830ihTAVUAyZlKGzeUnMKSBWVM7T`, renamed from `_default` 2026-03-31). Old orphaned `shadowctx-app` project deleted 2026-03-31 ([SHA-23](/SHA/issues/SHA-23)) |
| **GitHub** | Source control + issue tracking | Org: https://github.com/shadowctx — Repo: https://github.com/shadowctx/shadowctx |
| **shadowctx.com** | Primary domain | Purchased via Vercel; connected to `_default` project (live 2026-03-31) |

---

## Domains

| Domain | Purpose | Where managed | Status |
|--------|---------|---------------|--------|
| `shadowctx.com` | Primary landing page | Purchased via Vercel (DNS managed there) | **Live** — connected to `_default` Vercel project (2026-03-31) |
| `www.shadowctx.com` | www redirect | Purchased via Vercel (DNS managed there) | **Live** — connected to `_default` Vercel project (2026-03-31) |

---

## Environment Variables

Reference file: `.env.example` at project root.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 3000) | Server listen port |
| `HOST` | No (default: 0.0.0.0) | Server bind address |
| `SUPABASE_URL` | Cloud mode | Supabase project URL (`https://wrqbwyyntobqygjmnmtx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Cloud mode | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud mode (server) | Supabase service role key (server-side only, never expose to client) |
| `OPENAI_API_KEY` | Optional | Enables semantic embeddings |
| `STORE` | No (default: supabase) | Set to `sqlite` for SQLite backend |

---

## Local Development

Prerequisites: Node.js ≥ 20, pnpm 9.

```bash
# Clone (once repo is pushed — see Pending Engineering Tasks)
git clone https://github.com/shadowctx/shadowctx
cd shadowctx
pnpm install

# Build all packages
pnpm build

# Run server in dev mode (SQLite, no external services)
STORE=sqlite pnpm dev

# Run tests
pnpm test

# Type-check
pnpm typecheck
```

See `CONTRIBUTING.md` for full contributor guide.

---

## CI/CD

- **Platform:** GitHub Actions (`.github/workflows/ci.yml` — added 2026-03-31)
- **Trigger:** push or PR to `main`
- **Steps:** checkout → pnpm 9 setup → Node 20 setup (with pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → `pnpm typecheck`
- **Issue templates:** `.github/ISSUE_TEMPLATE/` (bug report, feature request)
- **Vercel auto-deploy:** Active — triggers on `main` branch pushes; GitHub integration connected 2026-03-31 ([SHA-22](/SHA/issues/SHA-22))

---

## Pending Engineering Tasks

These items are **not yet done** and should be tracked as issues.

| # | Task | Priority | Notes |
|---|------|----------|-------|
| 2 | Connect `shadowctx.com` to Vercel `_default` project | High | In Vercel dashboard, go to `_default` project → Settings → Domains → add `shadowctx.com`. DNS is already managed via Vercel so the records can be auto-configured. |
| 5 | Set up GitHub Actions CI | Low | Add `.github/workflows/ci.yml` to run `pnpm build && pnpm test && pnpm typecheck` on every PR. |

---

## Update Procedure

**When to update this file:**

- A new service or account is added/removed
- Deployment targets change (new domain, new hosting platform)
- Database schema changes significantly (new table, migration applied)
- A new package is added to or removed from the monorepo
- Environment variables are added or deprecated
- Any infrastructure credential is rotated (update the variable name/description, never the value itself)
- A Pending Engineering Task is completed (move it to the relevant section, remove from the table)

**Who updates it:** Any agent or developer making the relevant change. Include the `maintenance.md` update in the same commit as the change.

**Format:** Keep entries in the existing tables. Add new sections as needed. Supersede outdated rows rather than deleting them (add a "Deprecated" note).

---

*Last updated: 2026-03-31 by Engineer agent ([SHA-22](/SHA/issues/SHA-22) — connected `shadowctx/shadowctx` GitHub repo to `shadowctx-app` Vercel project; auto-deploy on `main` now active)*
