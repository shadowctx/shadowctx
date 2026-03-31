"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { getEntries, type Entry } from "@/lib/api";

function TagPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
      {name}
    </span>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const snippet = entry.body.slice(0, 180).replace(/[#*`_\[\]]/g, "");
  const hasMore = entry.body.length > 180;
  const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link href={`/entries/${entry.id}`} className="block group">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:bg-gray-900/80 transition-all duration-150">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-base font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors leading-snug">
            {entry.title}
          </h3>
          <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">{date}</span>
        </div>

        {entry.body && (
          <p className="text-sm text-gray-400 leading-relaxed mb-3 font-mono">
            {snippet}
            {hasMore && (
              <span className="text-gray-600">…</span>
            )}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {entry.tags?.slice(0, 5).map((tag) => (
              <TagPill key={tag.id} name={tag.name} />
            ))}
          </div>
          {entry.author && (
            <span className="text-xs text-gray-600 flex-shrink-0">
              {entry.author.displayName ||
                entry.author.email?.split("@")[0] ||
                "Unknown"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { workspace, loading: wsLoading } = useWorkspace();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadEntries = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEntries(workspace.id, { limit: 20 });
      setEntries(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load entries";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (workspace) {
      loadEntries();
    }
  }, [workspace, loadEntries]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  if (wsLoading) {
    return (
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
          <span className="text-sm">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {workspace?.name
              ? `Recent context from ${workspace.name}`
              : "Loading…"}
          </p>
        </div>
        <Link
          href="/entries/new"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Entry
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries… (press Enter)"
            className="w-full bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>
      </form>

      {/* Content */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl px-5 py-4 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
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
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-300 mb-2">
            No entries yet
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            Start capturing engineering context for your team.
          </p>
          <Link
            href="/entries/new"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create first entry
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 mb-4 uppercase tracking-wider font-medium">
            {entries.length} recent {entries.length === 1 ? "entry" : "entries"}
          </p>
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
