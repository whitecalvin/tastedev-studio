import type {GraphOverview} from './execution.ts';

/** 이전 Core 세션의 응답은 조회와 실행 조작에 재사용하지 않는다. */
export function sessionGraphOverview(overview:GraphOverview|null,loadedSession:number,currentSession:number,projectId:string,connected:boolean):GraphOverview|null {
 if(!connected||loadedSession!==currentSession||!overview)return null;
 if(overview.definition&&(overview.definition.projectId!==projectId||overview.definition.graph.projectId!==projectId))return null;
 if(overview.executions.some(execution=>execution.projectId!==projectId))return null;
 return overview;
}
