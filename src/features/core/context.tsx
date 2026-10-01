'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Project } from '../projects/types/project';
import { projectService } from '../projects/services/browser-services';
import { CoreService } from './service';
import { InMemoryCoreRepository } from './repository';
import { remoteCore } from './remote-client';
import {connectionDraft,defaultConnectionDraft,type ConnectionDraft} from './onboarding';
import {coreFormDrafts,defaultForms,type CoreForm} from './form-drafts';
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
  const [draft,setDraft]=useState<ConnectionDraft>({...defaultConnectionDraft});
  const [connectionToken,setConnectionToken]=useState('');
  const [draftError,setDraftError]=useState('');
  const [formDrafts,setForms]=useState(()=>coreFormDrafts(null));
  const formsRef=useRef(formDrafts);
  useEffect(()=>{let cancelled=false;Promise.resolve().then(()=>{if(cancelled)return;try{const value=sessionStorage.getItem('tastedev.studio.connection-draft.v1');if(value)setDraft(connectionDraft(JSON.parse(value)));const forms=sessionStorage.getItem('tastedev.studio.core-forms.v1:'+project.id);if(forms){const restored=coreFormDrafts(JSON.parse(forms));formsRef.current=restored;setForms(restored);}const stored=sessionStorage.getItem('tastedev.studio.core-selection.v1:'+project.id);if(stored){const v=JSON.parse(stored);if(v&&['agent','job','run'].includes(v.kind)&&typeof v.id==='string'&&v.id.length<200)select({kind:v.kind,id:v.id});else if(v&&['new-agent','new-job'].includes(v.kind))select({kind:v.kind});}}catch{setDraftError('Drafts could not be saved.');}});return()=>{cancelled=true;};},[project.id]);
  const setConnectionDraft=(value:ConnectionDraft)=>{setDraft(value);try{const safe=connectionDraft(value);if(safe.endpoint===value.endpoint)sessionStorage.setItem('tastedev.studio.connection-draft.v1',JSON.stringify(safe));}catch{setDraftError('Drafts could not be saved.');}};
  const selectPreserved=(value:Selection)=>{select(value);try{const key='tastedev.studio.core-selection.v1:'+project.id;if(value)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);}catch{setDraftError('Drafts could not be saved.');}};
  const setFormDraftField=(kind:CoreForm,key:string,value:string|boolean)=>{if(!Object.hasOwn(defaultForms[kind],key))return;const next=coreFormDrafts({...formsRef.current,[kind]:{...formsRef.current[kind],[key]:value}});formsRef.current=next;setForms(next);try{sessionStorage.setItem('tastedev.studio.core-forms.v1:'+project.id,JSON.stringify(next));}catch{setDraftError('Drafts could not be saved.');}};
  return { project, service, snapshot, selection, select:selectPreserved, message, setMessage,remote,connection:remoteCore,logs:remote?remoteCore.logs:{},connectionDraft:draft,setConnectionDraft,connectionToken,setConnectionToken,draftError,formDrafts,setFormDraftField };
}
const Context = createContext<ReturnType<typeof useCoreState> | null>(null);
export function CoreProvider({project,service=coreService,children}:{project:Project;service?:CoreService;children:React.ReactNode}) { const value=useCoreState(project,service);return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useCore(){const value=useContext(Context);if(!value)throw new Error('CoreProvider is required.');return value;}
