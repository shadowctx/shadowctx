"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getWorkspaces, type Workspace } from "@/lib/api";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  setActiveWorkspace: (w: Workspace) => void;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getWorkspaces();
      setWorkspaces(list);

      if (list.length === 0) {
        router.push("/workspaces/new");
        return;
      }

      // Try to restore last active workspace from localStorage
      const savedId =
        typeof window !== "undefined"
          ? localStorage.getItem("activeWorkspaceId")
          : null;

      const found = savedId ? list.find((w) => w.id === savedId) : null;
      const active = found ?? list[0];
      setWorkspace(active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load workspaces";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function setActiveWorkspace(w: Workspace) {
    setWorkspace(w);
    if (typeof window !== "undefined") {
      localStorage.setItem("activeWorkspaceId", w.id);
    }
  }

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces,
        loading,
        error,
        setActiveWorkspace,
        refresh: load,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
