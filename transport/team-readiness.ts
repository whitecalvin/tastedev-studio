import {teamReadiness,authenticationReadiness,type TeamReadinessReport} from '../src/features/orchestration/team-readiness.ts';
import type {TeamWorkOverview} from '../src/features/orchestration/team-intent.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {Agent} from '../src/features/core/domain.ts';
import {teamId} from '../src/features/orchestration/team-intent.ts';
import {CoreError} from '../src/features/core/domain.ts';
import type {AIConnectionRegistry} from './ai-connections.ts';
export interface TeamReadinessBridge {work(project:string):TeamWorkOverview;graph(project:string):GraphOverview;agents(project:string):Agent[];connections:AIConnectionRegistry;verifySource(project:string):Promise<unknown>;authorize(actor:string,project:string,action:'read'|'run'|'approve'):void}
/** Inspection sends no source or prompt and starts no job. Results never authorize later writes. */
export async function inspectTeamReadiness(bridge:TeamReadinessBridge,project:string,intentId:string,actor:string):Promise<TeamReadinessReport> {
  bridge.authorize(actor,project,'read');if(!teamId(intentId))throw new CoreError('Invalid intent identity.');
  const work=bridge.work(project),graph=bridge.graph(project),report=teamReadiness(work,graph,bridge.agents(project),bridge.connections.list(project),intentId);
  for(const permission of ['run','approve'] as const){try{bridge.authorize(actor,project,permission);report.checks.push({id:'permission-'+permission,category:'permission',status:'passed',message:permission==='run'?'Execution permission available.':'Approval permission available.',location:'permissions'});}catch{report.checks.push({id:'permission-'+permission,category:'permission',status:'blocked',message:permission==='run'?'Execution permission required.':'Approval permission required.',location:'permissions'});}}
  if(graph.definition?.source)try{await bridge.verifySource(project);}catch{report.checks.push({id:'source-integrity',category:'source',status:'blocked',message:'Published Source verification failed. Republish the current Source.','location':'source'});}
  const routes=new Map<string,Promise<ReturnType<typeof authenticationReadiness>>>();
  for(const check of report.checks.filter(c=>c.category==='ai'&&c.status==='passed')){
    const route=graph.definition?.aiTasks?.[check.nodeId!]?.route;if(!route)continue;
    const key=JSON.stringify(route);
    if(!routes.has(key))routes.set(key,(async()=>{const provider=bridge.connections.resolve(route,project);if(!provider.inspect)return{status:'warning' as const,message:'Credential configured; authentication not verified.'};return authenticationReadiness(await provider.inspect(AbortSignal.timeout(10000)));})());
    try{Object.assign(check,await routes.get(key)!);}catch{check.status='blocked';check.message='AI connection inspection failed.';}
  }
  // Recheck project authority and inputs after asynchronous authentication/source inspection.
  bridge.authorize(actor,project,'read');const current=bridge.work(project),definition=bridge.graph(project).definition;
  if(current.revision!==report.workspaceRevision||definition?.revision!==report.graphRevision||definition?.inputChecksum!==report.inputChecksum)report.checks.push({id:'stale',category:'assignment',status:'blocked',message:'Inputs changed during inspection. Check again.',location:'assignment'});
  const fresh=teamReadiness(current,bridge.graph(project),bridge.agents(project),bridge.connections.list(project),intentId);
  for(const check of fresh.checks.filter(c=>['agent','execution','assignment','intent'].includes(c.category))){const previous=report.checks.find(c=>c.id===check.id);if(previous)Object.assign(previous,check);else report.checks.push(check);}
  report.ready=!report.checks.some(c=>c.status==='blocked');return report;
}
