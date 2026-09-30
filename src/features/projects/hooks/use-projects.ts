"use client";

import { useCallback, useEffect, useState } from "react";
import { projectService } from "../services/browser-services";
import type { Project } from "../types/project";
import { PROJECT_STORAGE_KEY } from "../services/project-repository";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => projectService.list().then(
    (list) => { setProjects(list); setError(null); },
    (error: unknown) => { setError(error instanceof Error ? error.message : "Projects could not be loaded. Please retry."); },
  ).finally(() => setLoading(false)), []);
  useEffect(() => {
    void refresh();
    const changed = (event: StorageEvent) => { if (event.key === PROJECT_STORAGE_KEY || event.key === null) void refresh(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [refresh]);
  return { projects, loading, error, refresh };
}
