'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { Project } from '../projects/types/project';
import { projectService } from '../projects/services/browser-services';
import { CoreService } from './service';
import { InMemoryCoreRepository } from './repository';
import { remoteCore } from './remote-client';
export const coreService = new CoreService(new InMemoryCoreRepository(), projectService);
type Selection = { kind: 'agent' | 'job' | 'run'; id: string } | { kind: 'new-agent' | 'new-job' } | null;
function useCoreState(project: Project, local: CoreService) {
  useSyncExternalStore(remoteCore.repository.subscribe,remoteCore.repository.revision,()=>0);
  const remote=local===coreService&&remoteCore.enabled;
  const service=remote?remoteCore:local;
  useSyncExternalStore(service.repository.subscribe, service.repository.revision, () => 0);
  useEffect(()=>{if(remote)remoteCore.setProject(project);},[project,remote]);
  const snapshot = service.snapshot(project.id);
  const [selection, select] = useState<Selection>(null);
  const [message, setMessage] = useState('');
  return { project, service, snapshot, selection, select, message, setMessage,remote,connection:remoteCore,logs:remote?remoteCore.logs:{} };
}
const Context = createContext<ReturnType<typeof useCoreState> | null>(null);
export function CoreProvider({project,service=coreService,children}:{project:Project;service?:CoreService;children:React.ReactNode}) { const value=useCoreState(project,service);return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useCore(){const value=useContext(Context);if(!value)throw new Error('CoreProvider is required.');return value;}
