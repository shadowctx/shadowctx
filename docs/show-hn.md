# Show HN Draft

**Title:** Show HN: ShadowCTX – open source MCP server + CLI that gives any AI access to your saved web pages

---

**Post body:**

I built ShadowCTX because I kept running into the same problem: I'd read something useful — a benchmark comparison, an architecture post, a product teardown — and two days later when I'm talking to Claude about a related problem, it has no idea that article exists. I'd have to find it, re-read it, paste the relevant bits, and suddenly I'm doing the AI's context management by hand. That's backwards.

ShadowCTX is a browser extension + MCP server + CLI that captures pages as you browse and makes them queryable by any AI. You click the extension icon on a page (or run `ctx save <url>` from your terminal), the content gets extracted via Readability, embedded with OpenAI's text-embedding-3-small, and stored locally in SQLite. From there, any MCP-compatible client — Claude Desktop, Cursor, Windsurf — can call `search_context("transformer architecture")` and get back the pages you actually saved on that topic, ranked by semantic similarity via cosine distance.

The CLI surface matters as much as the MCP one. Every coding agent can run shell commands. So if you're using Claude Code and ask "search my context for that React library comparison I saved," the agent just runs `ctx search "react component library comparison" --json` and parses the output. No MCP config required. It Just Works.

The stack: TypeScript monorepo with pnpm workspaces. `packages/core` defines a `ContextStore` interface — `save`, `search`, `get`, `list`, `delete`, `getTags`, `getStats`. Two implementations: `SqliteStore` (local, zero config) and `SupabaseStore` (cloud, pgvector, multi-device). The MCP server, CLI, and Chrome extension all depend only on the interface, so they're fully backend-agnostic. Docker Compose gets you running in one command with the SQLite backend.

It's early — the Chrome extension works but isn't on the Web Store yet, and embeddings require an OpenAI key (local embedding model is on the roadmap). But the core loop works: browse, save, ask.

MIT license, self-hosted, no accounts needed for the local version.

GitHub: https://github.com/shadowctx/shadowctx

---

## Posting notes

- Post Tue–Thu, 8–9am ET for best HN traction
- Be in comments for the first 2–3 hours
- Lead with the problem in any replies, not features
- Don't defend — acknowledge limitations openly (no Web Store yet, OpenAI key required)
- Good subreddits for cross-post: r/selfhosted, r/ClaudeAI, r/artificial, r/LocalLLaMA
