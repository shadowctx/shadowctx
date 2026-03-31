"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { searchEntries, type SearchResult } from "@/lib/api";

function TagPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
      {name}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "text-green-400 bg-green-900/30 border-green-800"
      : pct >= 40
        ? "text-yellow-400 bg-yellow-900/30 border-yellow-800"
        : "text-gray-400 bg-gray-800 border-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${color}`}
    >
      {pct}%
    </span>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { workspace } = useWorkspace();

  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [mode, setMode] = useState<"combined" | "fts_only">("combined");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      if (!workspace || !q.trim()) return;
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const data = await searchEntries(workspace.id, q.trim(), mode);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [workspace, mode]
  );

  // Auto-search when initial query param is present and workspace loads
  useEffect(() => {
    if (initialQ && workspace) {
      doSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const params = new URLSearchParams({ q: query.trim() });
    router.replace(`/search?${params.toString()}`);
    doSearch(query.trim());
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Search</h1>
        <p className="text-sm text-gray-500">
          Full-text and semantic search across all entries in{" "}
          <span className="text-gray-400">{workspace?.name ?? "your workspace"}</span>
          .
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for decisions, context, incidents…"
            autoFocus
            className="w-full bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 rounded-xl pl-10 pr-28 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Mode:</span>
          {(["combined", "fts_only"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-indigo-700 text-indigo-100"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {m === "combined" ? "Combined" : "FTS only"}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl px-5 py-4 mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse"
            >
              <div className="h-4 bg-gray-800 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-800 rounded w-full mb-2" />
              <div className="h-3 bg-gray-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-300 mb-2">
            No results found
          </h3>
          <p className="text-sm text-gray-500">
            Try different keywords or switch to FTS only mode.
          </p>
        </div>
      ) : !searched ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500">
            Enter a query above to search your workspace entries.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-medium mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} in{" "}
            <span className="text-indigo-500">{mode}</span> mode
          </p>
          {results.map((result) => {
            const entry = result.entry;
            const snippet = entry.body
              .slice(0, 200)
              .replace(/[#*`_\[\]]/g, "");
            const hasMore = entry.body.length > 200;
            const date = new Date(entry.createdAt).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" }
            );

            return (
              <Link
                key={entry.id}
                href={`/entries/${entry.id}`}
                className="block group"
              >
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all duration-150">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-base font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors leading-snug">
                      {entry.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ScoreBadge score={result.score} />
                      <span className="text-xs text-gray-500">{date}</span>
                    </div>
                  </div>

                  {entry.body && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-3 font-mono">
                      {snippet}
                      {hasMore && <span className="text-gray-600">…</span>}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {entry.tags?.slice(0, 5).map((tag) => (
                      <TagPill key={tag.id} name={tag.name} />
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">Loading search…</span>
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
