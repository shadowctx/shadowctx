import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Entry {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  authorId: string;
  author?: { id: string; email: string; displayName?: string };
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  workspaceId: string;
  role: "owner" | "admin" | "member";
  user?: { id: string; email: string; displayName?: string };
  joinedAt: string;
}

export interface SearchResult {
  entry: Entry;
  score: number;
  mode?: string;
}

export interface ApiError {
  message: string;
  status: number;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body.error || message;
    } catch {
      // ignore parse errors
    }
    const err: ApiError = { message, status: res.status };
    throw err;
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function apiSignUp(
  email: string,
  password: string,
  displayName?: string
) {
  return request<{ user: unknown; session: unknown }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function apiSignIn(email: string, password: string) {
  return request<{ user: unknown; session: unknown; token?: string }>(
    "/auth/signin",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
}

export async function apiSignOut() {
  return request<void>("/auth/signout", { method: "POST" });
}

export async function apiGetMe() {
  return request<{ id: string; email: string; displayName?: string }>(
    "/auth/me"
  );
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export async function getWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>("/workspaces");
}

export async function getWorkspace(id: string): Promise<Workspace> {
  return request<Workspace>(`/workspaces/${id}`);
}

export async function createWorkspace(data: {
  name: string;
  slug?: string;
}): Promise<Workspace> {
  return request<Workspace>("/workspaces", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateWorkspace(
  id: string,
  data: Partial<{ name: string; slug: string }>
): Promise<Workspace> {
  return request<Workspace>(`/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  return request<void>(`/workspaces/${id}`, { method: "DELETE" });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(workspaceId: string): Promise<Member[]> {
  return request<Member[]>(`/workspaces/${workspaceId}/members`);
}

export async function inviteMember(
  workspaceId: string,
  data: { email: string; role?: string }
): Promise<Member> {
  return request<Member>(`/workspaces/${workspaceId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeMember(
  workspaceId: string,
  userId: string
): Promise<void> {
  return request<void>(`/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
  });
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export async function getTags(workspaceId: string): Promise<Tag[]> {
  return request<Tag[]>(`/workspaces/${workspaceId}/tags`);
}

export async function createTag(
  workspaceId: string,
  data: { name: string; color?: string }
): Promise<Tag> {
  return request<Tag>(`/workspaces/${workspaceId}/tags`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTag(
  workspaceId: string,
  tagId: string
): Promise<void> {
  return request<void>(`/workspaces/${workspaceId}/tags/${tagId}`, {
    method: "DELETE",
  });
}

// ─── Entries ──────────────────────────────────────────────────────────────────

export async function getEntries(
  workspaceId: string,
  params?: { limit?: number; offset?: number }
): Promise<Entry[]> {
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()}`
    : "";
  return request<Entry[]>(`/workspaces/${workspaceId}/entries${qs}`);
}

export async function getEntry(
  workspaceId: string,
  entryId: string
): Promise<Entry> {
  return request<Entry>(`/workspaces/${workspaceId}/entries/${entryId}`);
}

export async function createEntry(
  workspaceId: string,
  data: { title: string; body: string; tagIds?: string[] }
): Promise<Entry> {
  return request<Entry>(`/workspaces/${workspaceId}/entries`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEntry(
  workspaceId: string,
  entryId: string,
  data: Partial<{ title: string; body: string; tagIds: string[] }>
): Promise<Entry> {
  return request<Entry>(`/workspaces/${workspaceId}/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteEntry(
  workspaceId: string,
  entryId: string
): Promise<void> {
  return request<void>(`/workspaces/${workspaceId}/entries/${entryId}`, {
    method: "DELETE",
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchEntries(
  workspaceId: string,
  query: string,
  mode?: string
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (mode) params.set("mode", mode);
  return request<SearchResult[]>(
    `/workspaces/${workspaceId}/search?${params.toString()}`
  );
}
