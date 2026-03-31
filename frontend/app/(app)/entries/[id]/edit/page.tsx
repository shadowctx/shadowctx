"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getEntry,
  getTags,
  updateEntry,
  createTag,
  type Entry,
  type Tag,
} from "@/lib/api";

export default function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace || !id) return;

    Promise.all([getEntry(workspace.id, id), getTags(workspace.id)])
      .then(([entryData, tagData]) => {
        setEntry(entryData);
        setTitle(entryData.title);
        setBody(entryData.body);
        setTags(tagData);
        setSelectedTagIds(entryData.tags?.map((t) => t.id) ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load entry");
      })
      .finally(() => setLoading(false));
  }, [workspace, id]);

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
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
      // silently ignore
    } finally {
      setCreatingTag(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !entry) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateEntry(workspace.id, entry.id, {
        title: title.trim(),
        body,
        tagIds: selectedTagIds,
      });
      router.push(`/entries/${entry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl animate-pulse space-y-4">
        <div className="h-6 bg-gray-800 rounded w-1/3" />
        <div className="h-10 bg-gray-800 rounded" />
        <div className="h-64 bg-gray-900 rounded-xl" />
      </div>
    );
  }

  if (error && !entry) {
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

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href={`/entries/${id}`}
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
          <h1 className="text-xl font-bold text-gray-100">Edit Entry</h1>
          <p className="text-sm text-gray-500 truncate max-w-sm">{entry?.title}</p>
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
            rows={16}
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Tags
          </label>
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
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !workspace}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/entries/${id}`}
            className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
