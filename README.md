# ShadowCTX

> Engineering context platform — capture the *why* behind decisions, incidents, and changes. Search it later.

**Production:** https://shadowctx-app.vercel.app

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), Tailwind CSS, deployed on Vercel |
| Backend API | Fastify + TypeScript, Node.js |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (email+password, JWT) |
| Semantic Search | OpenAI `text-embedding-3-small` + pgvector cosine similarity |

---

## Repo Structure

```
shadowctx-api/          ← Fastify backend (this root)
  src/
    plugins/            ← Supabase client + JWT auth middleware
    routes/             ← auth, workspaces, entries, tags, members, search
    lib/                ← OpenAI embeddings helper
  supabase/migrations/  ← Applied DB migrations
  frontend/             ← Next.js 16 frontend
    app/
      (auth)/           ← signin, signup pages
      (app)/            ← authenticated app: dashboard, entries, search, settings
    lib/                ← Supabase SSR clients, API client, workspace context
```

---

## Local Setup

### Backend API

```bash
# 1. Install deps
npm install

# 2. Copy env and fill in secrets
cp .env.example .env

# 3. Run dev server (port 3000)
npm run dev
```

**Required env vars (`.env`):**
```
SUPABASE_URL=https://wrqbwyyntobqygjmnmtx.supabase.co
SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase dashboard>
OPENAI_API_KEY=<your OpenAI API key>
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in .env.local, then:
npm run dev   # http://localhost:3001
```

**Required env vars (`frontend/.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=https://wrqbwyyntobqygjmnmtx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Supabase

- **Project:** `wrqbwyyntobqygjmnmtx` (us-east-1, ACTIVE)
- **Extensions:** `pgvector` enabled
- **Schema:** `users`, `workspaces`, `workspace_members`, `entries` (embedding `vector(1536)`), `tags`, `entry_tags`
- **RLS:** Full workspace isolation — users can only access data in workspaces they belong to
- **Migrations:** `supabase/migrations/` — two applied migrations + search function

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Create account |
| POST | `/auth/signin` | Sign in, returns JWT |
| POST | `/auth/signout` | Sign out |
| GET | `/auth/me` | Current user |
| GET | `/workspaces` | List user's workspaces |
| POST | `/workspaces` | Create workspace |
| GET | `/workspaces/:id` | Workspace detail |
| PATCH | `/workspaces/:id` | Update workspace |
| DELETE | `/workspaces/:id` | Delete workspace (owner only) |
| GET | `/workspaces/:id/members` | List members |
| POST | `/workspaces/:id/members` | Invite member by email |
| DELETE | `/workspaces/:id/members/:userId` | Remove member |
| GET | `/workspaces/:id/tags` | List tags |
| POST | `/workspaces/:id/tags` | Create tag |
| DELETE | `/workspaces/:id/tags/:tagId` | Delete tag |
| GET | `/workspaces/:id/entries` | List entries (paginated, filterable by tag) |
| POST | `/workspaces/:id/entries` | Create entry |
| GET | `/workspaces/:id/entries/:id` | Entry detail |
| PATCH | `/workspaces/:id/entries/:id` | Update entry |
| DELETE | `/workspaces/:id/entries/:id` | Delete entry |
| GET | `/workspaces/:id/search?q=` | Combined FTS + semantic search |

---

## Tests

```bash
npm test        # Run all backend tests (18 tests)
npm run typecheck
```

---

## Deploy

**Frontend (Vercel):** Auto-deploys on push to `main` via Vercel CI. Set env vars in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL` — URL of your deployed Fastify API
