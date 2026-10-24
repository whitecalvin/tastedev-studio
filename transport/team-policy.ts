import {CoreError} from '../src/features/core/domain.ts';
import {teamId} from '../src/features/orchestration/team-intent.ts';
import {defaultTeamPolicy,validateTeamPolicy,type TeamPolicyOverview,type TeamExecutionPolicy} from '../src/features/orchestration/team-policy.ts';
import type {GraphExecution,GraphOverview} from '../src/features/orchestration/execution.ts';
import type {TaskAIRequest} from '../src/features/orchestration/task-ai.ts';
import type {GraphPersistence} from './graph-execution.ts';
interface PolicyState {version:1;projects:{projectId:string;revision:number;policy:TeamExecutionPolicy;grants:TeamPolicyOverview['grants']}[]}
export class TeamPolicy {
  private state:PolicyState={version:1,projects:[]};private persistence?:GraphPersistence;private graph:(project:string)=>GraphOverview;private authority:(actor:string,project:string,permission:'read'|'approve')=>void;
  constructor(graph:(project:string)=>GraphOverview,persistence?:GraphPersistence,authority:(actor:string,project:string,permission:'read'|'approve')=>void=()=>{}){this.graph=graph;this.persistence=persistence;this.authority=authority;const saved=persistence?.load();if(saved){this.validate(saved as PolicyState);this.state=structuredClone(saved as PolicyState);}}
  private validate(s:PolicyState){if(s.version!==1||!Array.isArray(s.projects)||s.projects.length>100||new Set(s.projects.map(p=>p.projectId)).size!==s.projects.length)throw new CoreError('Invalid saved team policy; preserved.');for(const p of s.projects){validateTeamPolicy(p.policy);if(!teamId(p.projectId)||!Number.isSafeInteger(p.revision)||p.revision<0||!Array.isArray(p.grants)||p.grants.length>1000||new Set(p.grants.map(g=>g.id)).size!==p.grants.length||p.grants.some(g=>![g.id,g.executionId,g.activationId].every(teamId)||!Number.isSafeInteger(g.reservedRequests)||g.reservedRequests<1||g.reservedRequests>12||!Number.isFinite(Date.parse(g.at))))throw new CoreError('Invalid saved AI grants; preserved.');}}
  overview(project:string):TeamPolicyOverview{const p=this.state.projects.find(p=>p.projectId===project);return{revision:p?.revision??0,durable:!!this.persistence,policy:structuredClone(p?.policy??defaultTeamPolicy),grants:structuredClone(p?.grants??[])};}
  private commit(project:string,change:(p:PolicyState['projects'][number])=>void){const next=structuredClone(this.state);let p=next.projects.find(p=>p.projectId===project);if(!p){p={projectId:project,revision:0,policy:structuredClone(defaultTeamPolicy),grants:[]};next.projects.push(p);}change(p);p.revision++;this.validate(next);this.persistence?.save(next);this.state=next;}
  request(project:string,action:string,input:unknown,actor:string){this.authority(actor,project,action==='list'?'read':'approve');if(action==='list')return this.overview(project);if(action!=='save')throw new CoreError('Invalid team policy action.');const i=input as {revision:number;policy:unknown};if(i?.revision!==this.overview(project).revision)throw new CoreError('AI policy changed. Refresh before saving.');if(this.graph(project).executions.some(e=>e.activations.some(a=>a.status==='ai-running')))throw new CoreError('Wait for active AI analysis before changing policy.');const policy=validateTeamPolicy(i.policy);this.commit(project,p=>p.policy=policy);return this.overview(project);}
  authorize(project:string,plan:TaskAIRequest,execution:GraphExecution,activationId:string,leaseId:string){
    if(!execution.team&&!execution.factory?.intent)return;
    const current=this.overview(project),p=current.policy;
    if(plan.projectId!==project||execution.projectId!==project||plan.budget.maxProviderRequests>p.maxProviderRequests||plan.budget.timeoutMs>p.timeoutSeconds*1000||p.allowedConnections.length&&!p.allowedConnections.includes(plan.route.connectionId)||p.allowedModels.length&&!p.allowedModels.includes(plan.route.model))throw new CoreError('AI configuration exceeds the approved team policy.');
    if(this.graph(project).executions.flatMap(e=>e.activations).filter(a=>a.status==='ai-running').length>=p.maximumConcurrent)throw new CoreError('Team AI concurrency limit reached.');
    const used=current.grants.filter(g=>g.executionId===execution.id).reduce((n,g)=>n+g.reservedRequests,0);
    if(used+plan.budget.maxProviderRequests>p.executionRequestBudget)throw new CoreError('Team AI execution request budget exhausted.');
    if(current.grants.length>=1000)throw new CoreError('AI grant history capacity reached.');
    // Reserve the maximum request count before issuing the Graph lease. Failure never grants extra budget.
    this.commit(project,p=>p.grants.push({id:leaseId,executionId:execution.id,activationId,reservedRequests:plan.budget.maxProviderRequests,at:new Date().toISOString()}));
  }
}
