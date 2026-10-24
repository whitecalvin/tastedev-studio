import type {TeamWorkOverview} from './team-intent.ts';
import type {GraphOverview} from './execution.ts';
import type {ManagedAIConnection} from '../ai/routing.ts';
import type {Agent} from '../core/domain.ts';
import type {AIConnectionStatus} from '../ai/connection-status.ts';

export interface TeamReadinessCheck {id:string;category:'intent'|'assignment'|'source'|'agent'|'ai'|'permission'|'storage'|'execution';status:'passed'|'blocked'|'warning';message:string;nodeId?:string;location:'intent'|'assignment'|'agents'|'ai'|'source'|'permissions'|'execution'|'storage'}
export interface TeamReadinessReport {projectId:string;intentId:string;intentVersion:number;workspaceRevision:number;graphRevision?:number;inputChecksum?:string;checkedAt:string;ready:boolean;checks:TeamReadinessCheck[];modelExecuted:false}
export function teamReadiness(work:TeamWorkOverview,graph:GraphOverview,agents:Agent[],connections:ManagedAIConnection[],intentId:string,now=new Date().toISOString()):TeamReadinessReport {
  const intent=work.intents.find(i=>i.id===intentId),assignment=work.assignments.find(a=>a.intentId===intentId),d=graph.definition;
  const checks:TeamReadinessCheck[]=[],add=(id:string,category:TeamReadinessCheck['category'],status:TeamReadinessCheck['status'],message:string,location:TeamReadinessCheck['location'],nodeId?:string)=>checks.push({id,category,status,message,location,...(nodeId?{nodeId}:{})});
  add('intent','intent',intent?.ready?'passed':'blocked',intent?.ready?'Work intent is ready.':'Review and mark the work intent ready.','intent');
  add('storage','storage',work.durable?'passed':'warning',work.durable?'Saved in Core':'Core is using memory storage. Changes will not survive restart.','storage');
  const fresh=!!intent&&!!assignment&&!!d&&assignment.intentVersion===intent.version&&assignment.graphRevision===d.revision&&assignment.inputChecksum===d.inputChecksum;
  add('assignment','assignment',fresh?'passed':'blocked',fresh?'Assignment matches the published graph.':'Review the current role assignment.','assignment',assignment?.roleNodeId);
  for(const [n,reason] of (work.waiting.find(w=>w.intentId===intentId)?.reasons??[]).entries())add('waiting-'+n,'assignment','blocked',reason,'assignment',assignment?.taskNodeId);
  add('source','source',d?.source?'passed':'blocked',d?.source?'Published Source is available.':'Publish the saved graph and source first.','source');
  if(assignment){const a=agents.find(a=>a.id===assignment.agentId),available=a&&(a.status==='online'||a.status==='idle');add('agent','agent',available?'passed':'blocked',available?'Assigned Agent is available.':a?.status==='busy'?'Agent is busy.':'Agent is unavailable.','agents',assignment.agentNodeId);}
  const targets=new Set([assignment?.taskNodeId,...(intent?.responsibility==='implementation'?d?.graph.nodes.filter(n=>n.kind==='task'&&n.teamRole==='review').map(n=>n.id)??[]:[])]);
  for(const id of targets){if(!id)continue;const plan=d?.aiTasks?.[id],route=plan?.route,available=route&&connections.some(c=>c.id===route.connectionId&&c.adapter===route.adapter&&c.model===route.model);add('ai-'+id,'ai',available?'passed':'blocked',available?'Managed AI route is available.':'Review the AI profile, model and connection.','ai',id);}
  if(graph.executions.some(e=>['running','paused','cancelling'].includes(e.status)))add('execution','execution','blocked','Waiting for the active project graph.','execution');
  return{projectId:work.projectId,intentId,intentVersion:intent?.version??0,workspaceRevision:work.revision,graphRevision:d?.revision,inputChecksum:d?.inputChecksum,checkedAt:now,ready:!checks.some(c=>c.status==='blocked'),checks,modelExecuted:false};
}
export function authenticationReadiness(status:AIConnectionStatus):Pick<TeamReadinessCheck,'status'|'message'> {
  return status.authentication==='missing'?{status:'blocked',message:'AI authentication required.'}:status.authentication==='authenticated'?{status:'passed',message:'ChatGPT account available.'}:{status:'warning',message:'Credential configured; authentication not verified.'};
}
