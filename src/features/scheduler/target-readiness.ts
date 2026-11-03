import type {Schedule} from './domain.ts';
import type {GraphOverview} from '../orchestration/execution.ts';
export function scheduleTargetReadiness(schedule:Schedule,projectId:string,connected:boolean,overview:GraphOverview|null){
 const target=schedule.graph;
 if(!target)return {status:'protocol' as const};
 if(schedule.projectId!==projectId||!connected||!overview)return {status:'unverified' as const};
 const d=overview.definition;
 if(!d||d.graph.projectId!==projectId||d.revision!==target.revision||d.checksum!==target.checksum||!d.graph.nodes.some(n=>n.id===target.entryNodeId&&['task','approval'].includes(n.kind))||d.graph.edges.some(e=>e.to===target.entryNodeId&&e.relation==='success'))return {status:'stale' as const};
 const active=overview.executions.filter(e=>e.projectId===projectId&&['running','paused','cancelling'].includes(e.status));
 return {status:active.length?'overlap' as const:'matched' as const,source:d.source?.snapshotId??null,checksum:d.source?.checksum??null,active:active.map(e=>({id:e.id,status:e.status})),executionAuthorized:false};
}
