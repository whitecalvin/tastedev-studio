import {AIError,type AIProvider} from '../src/features/ai/domain.ts';
import {managedConnections,aiRoute,type ManagedAIConnection} from '../src/features/ai/routing.ts';
export interface RegisteredAIConnection {metadata:ManagedAIConnection;provider:AIProvider;projects?:readonly string[]}
// 연결 정보는 Core에서만 관리하고 공개 목록에는 인증값을 포함하지 않는다.
export class AIConnectionRegistry {
 private entries:RegisteredAIConnection[];
 constructor(entries:RegisteredAIConnection[]){const metadata=managedConnections(entries.map(e=>e.metadata));this.entries=entries.map((e,i)=>({...e,metadata:metadata[i],projects:e.projects?[...e.projects]:undefined}));}
 list(projectId:string){return this.entries.filter(e=>!e.projects||e.projects.includes(projectId)).map(e=>({...e.metadata}));}
 resolve(value:unknown,projectId:string):AIProvider{
  const route=aiRoute(value),entry=this.entries.find(e=>e.metadata.id===route.connectionId&&(!e.projects||e.projects.includes(projectId)));
  if(!entry||entry.metadata.adapter!==route.adapter||entry.metadata.model!==route.model)throw new AIError('unavailable');
  return entry.provider;
 }
}
