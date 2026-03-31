"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { getTags, createEntry, createTag, type Tag } from "@/lib/api";

export default function NewEntryPage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setLoadingTags(true);
    getTags(workspace.id)
      .then((data) => setTags(data))
      .catch(() => {})
      .finally(() => setLoadingTags(false));
  }, [workspace]);

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleCreateTag() {
    if (!workspace || !newTagName.trim()) return;
    setCreatingTag(true);
    try {
      const tag = await createTag(workspace.id, { name: newTagName.trim() });
      setTags((prev) => [...prev, tag]);
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setNewTagName("");
    } catch {
      // silently fail tag creation
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const entry = await createEntry(workspace.id, {
        title: title.trim(),
        body,
        tagIds: selectedTagIds,
      });
      router.push(`/entries/${entry.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create entry";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg
            className="w-5 h-5"
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
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-100">New Entry</h1>
          <p className="text-sm text-gray-500">
            Capture context for{" "}
            <span className="text-gray-400">{workspace?.name ?? "…"}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Why we switched from Redis to Postgres for job queues"
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="body"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Body{" "}
            <span className="text-gray-600 font-normal">(Markdown supported)</span>
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`## Context\n\nDescribe the decision, problem, or insight here...\n\n## Why\n\n...\n\n## Alternatives considered\n\n...`}
            rows={16}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Tags
          </label>

          {loadingTags ? (
            <p className="text-xs text-gray-500">Loading tags…</p>
          ) : (
            <div className="space-y-3">
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-indigo-900/30 text-indigo-400 border-indigo-800 hover:border-indigo-600"
                        }`}
                      >
                        {selected && (
                          <svg
                            className="w-3 h-3 mr-1.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Add new tag inline */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                  placeholder="Create new tag…"
                  className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || creatingTag}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 text-sm px-3 py-2 rounded-lg transition-colors"
                >
                  {creatingTag ? "…" : "Add"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !workspace}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? "Saving…" : "Save entry"}
          </button>
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
