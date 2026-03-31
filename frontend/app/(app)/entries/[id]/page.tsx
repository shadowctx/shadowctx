"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/lib/workspace-context";
import { getEntry, deleteEntry, type Entry } from "@/lib/api";

function TagPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-900/50 text-indigo-300 border border-indigo-800">
      {name}
    </span>
  );
}

export default function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!workspace || !id) return;
    setLoading(true);
    getEntry(workspace.id, id)
      .then((data) => setEntry(data))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load entry"
        );
      })
      .finally(() => setLoading(false));
  }, [workspace, id]);

  async function handleDelete() {
    if (!workspace || !entry) return;
    setDeleting(true);
    try {
      await deleteEntry(workspace.id, entry.id);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const formattedDate = entry
    ? new Date(entry.createdAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="h-8 bg-gray-800 rounded w-3/4" />
          <div className="h-4 bg-gray-800 rounded w-1/2" />
          <div className="h-64 bg-gray-900 rounded-xl mt-6" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl px-5 py-4 mb-4">
          {error}
        </div>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">
          &larr; Back to dashboard
        </Link>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="max-w-2xl">
      {/* Back */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          All entries
        </Link>
      </div>

      {/* Title & Meta */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 leading-snug mb-3">
          {entry.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {entry.author?.displayName ||
              entry.author?.email?.split("@")[0] ||
              "Unknown"}
          </span>
          <span className="text-gray-700">·</span>
          <span className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {formattedDate}
          </span>
        </div>

        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {entry.tags.map((tag) => (
              <TagPill key={tag.id} name={tag.name} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 mb-6" />

      {/* Body */}
      <div className="prose-dark text-sm">
        {entry.body ? (
          <ReactMarkdown>{entry.body}</ReactMarkdown>
        ) : (
          <p className="text-gray-500 italic">No content.</p>
        )}
      </div>

      <div className="border-t border-gray-800 mt-8 pt-6 flex items-center gap-3">
        <Link
          href={`/entries/${entry.id}/edit`}
          className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit
        </Link>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 bg-red-950/50 hover:bg-red-900/60 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-lg border border-red-900/50 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Are you sure?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
