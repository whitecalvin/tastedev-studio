'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFiles } from '../editor/session';
import { runtimeHosts } from '../runtime/hosts';
import { GitService } from './service';
const Context = createContext<GitService | null>(null);
function Session({ projectId, workspaceId, workspacePath, children }: { projectId: string; workspaceId: string | null; workspacePath: string | null; children: React.ReactNode }) {
  const [service] = useState(() => new GitService(runtimeHosts().git, { projectId, workspaceId, workspacePath }));
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; const timer = setTimeout(() => void service.refresh(), 0); return () => { clearTimeout(timer); mounted.current = false; queueMicrotask(() => { if (!mounted.current) service.dispose(); }); }; }, [service]);
  return <Context.Provider value={service}>{children}</Context.Provider>;
}
export function GitProvider({ projectId, workspacePath, children }: { projectId: string; workspacePath: string | null; children: React.ReactNode }) {
  const { connection } = useFiles();
  return <Session key={`${projectId}:${connection?.id ?? ''}`} projectId={projectId} workspaceId={connection?.id ?? null} workspacePath={workspacePath}>{children}</Session>;
}
export function useGit() { const service = useContext(Context); if (!service) throw new Error('Git provider required'); const state = useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot); return { service, state }; }

