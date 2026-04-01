# ShadowCTX — Claude Code Skill

Use the `ctx` CLI to search your personal context store whenever the user references something they may have saved.

## When to use

- User mentions "I saved", "I bookmarked", "I read something about", "look up in my context"
- User asks about a topic and you want to check for relevant saved pages
- Before answering a question about a URL the user may have previously saved

## How to use

```bash
# Search saved pages
ctx search "query" --json --limit 5

# List recent saves
ctx list --limit 10 --json

# Get full content of a specific page
ctx get <id> --json
```

## Setup

1. Install: `npm install -g @shadowctx/cli`
2. Set env vars:
   ```
   export SUPABASE_URL=https://your-project.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your-key
   export OPENAI_API_KEY=your-key   # optional, enables semantic search
   ```
3. Test: `ctx list --limit 3`

## Output format

`ctx search` returns JSON with fields: `page.id`, `page.title`, `page.url`, `page.content`, `similarity`.

Prefer results with `similarity > 0.7` as highly relevant. Results with `similarity > 0.5` may be useful context.
