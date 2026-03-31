"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  updateWorkspace,
  getMembers,
  inviteMember,
  removeMember,
  type Member,
} from "@/lib/api";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-900/50 text-amber-300 border border-amber-800",
  admin: "bg-blue-900/50 text-blue-300 border border-blue-800",
  member: "bg-gray-800 text-gray-400 border border-gray-700",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? ROLE_COLORS.member}`}
    >
      {role}
    </span>
  );
}

export default function SettingsPage() {
  const { workspace, refresh } = useWorkspace();

  // Workspace name editing
  const [wsName, setWsName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  // Members
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Remove
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) {
      setWsName(workspace.name);
    }
  }, [workspace]);

  const loadMembers = useCallback(async () => {
    if (!workspace) return;
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const data = await getMembers(workspace.id);
      setMembers(data);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : "Failed to load members"
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [workspace]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !wsName.trim()) return;
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);
    try {
      await updateWorkspace(workspace.id, { name: wsName.trim() });
      await refresh();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      setNameError(
        err instanceof Error ? err.message : "Failed to update workspace"
      );
    } finally {
      setSavingName(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      await inviteMember(workspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
      await loadMembers();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to invite member"
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!workspace) return;
    setRemovingId(userId);
    try {
      await removeMember(workspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      // silently ignore
    } finally {
      setRemovingId(null);
    }
  }

  const myRole = members.find((m) => m.role === "owner")?.role;
  const canManageMembers = myRole === "owner" || myRole === "admin";

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-100 mb-1">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your workspace configuration and team members.
        </p>
      </div>

      {/* Workspace Info */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Workspace
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <form onSubmit={handleSaveName} className="space-y-4">
            {nameError && (
              <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                {nameError}
              </div>
            )}
            {nameSaved && (
              <div className="bg-green-950/50 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3">
                Workspace name updated.
              </div>
            )}

            <div>
              <label
                htmlFor="wsName"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Workspace name
              </label>
              <input
                id="wsName"
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Workspace ID
              </label>
              <p className="text-sm font-mono text-gray-500 bg-gray-800 rounded-lg px-4 py-2.5 border border-gray-700">
                {workspace?.id ?? "—"}
              </p>
            </div>

            <button
              type="submit"
              disabled={savingName || !wsName.trim() || wsName === workspace?.name}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {savingName ? "Saving…" : "Save name"}
            </button>
          </form>
        </div>
      </section>

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Members
        </h2>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4">
          {loadingMembers ? (
            <div className="px-6 py-8 text-center">
              <div className="text-sm text-gray-500">Loading members…</div>
            </div>
          ) : membersError ? (
            <div className="px-6 py-4 text-sm text-red-400">{membersError}</div>
          ) : members.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">
              No members found.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {members.map((member) => {
                const name =
                  member.user?.displayName ||
                  member.user?.email?.split("@")[0] ||
                  "Unknown";
                const email = member.user?.email ?? "";
                const isOwner = member.role === "owner";

                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-semibold text-indigo-200 flex-shrink-0">
                        {(name[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">
                          {name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <RoleBadge role={member.role} />
                      {canManageMembers && !isOwner && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          disabled={removingId === member.userId}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Remove member"
                        >
                          {removingId === member.userId ? (
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
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
                          ) : (
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
                                d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invite form */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Invite member
          </h3>

          <form onSubmit={handleInvite} className="space-y-4">
            {inviteError && (
              <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="bg-green-950/50 border border-green-800 text-green-300 text-sm rounded-lg px-4 py-3">
                Member invited successfully.
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="colleague@company.com"
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "admin" | "member")
                }
                className="bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {inviting ? "Inviting…" : "Send invite"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
