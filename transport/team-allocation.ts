import {TeamAccess,TeamAccessError} from './team-access.ts';
import {activeRun,type Job,type Run} from '../src/features/core/domain.ts';
import {defaultStrategy,type SchedulingStrategy} from '../src/features/core/matcher.ts';

/** Quotas inspect the same synchronous transaction as insertion/assignment. */
export class TeamAllocation {
 constructor(privateAccess:TeamAccess,history:()=>{jobs:Job[];runs:Run[]}){this.access=privateAccess;this.history=history;}
 private access:TeamAccess;private history:()=>{jobs:Job[];runs:Run[]};
 admit(projectId:string,actor:string|undefined,jobs:Job[]){
  const limits=this.access.limits(projectId),queued=jobs.filter(j=>j.status==='queued');
  if(queued.length>=128)throw new TeamAccessError('TEAM_GLOBAL_QUEUE_LIMIT');
  if(queued.filter(j=>j.projectId===projectId).length>=limits.queued||queued.filter(j=>j.createdBy===(actor??'system')).length>=limits.userQueued)throw new TeamAccessError('TEAM_QUEUE_LIMIT');
 }
 eligible(job:Job,runs:Run[],jobs:Job[]){
  const limits=this.access.limits(job.projectId),active=runs.filter(activeRun),actor=job.createdBy??'system';
  return active.filter(r=>r.projectId===job.projectId).length<limits.active&&active.filter(r=>(jobs.find(j=>j.id===r.jobId)?.createdBy??'system')===actor).length<limits.userActive;
 }
 readonly strategy:SchedulingStrategy={agents:defaultStrategy.agents,jobs:jobs=>{
  const state=this.history(),lastProject=new Map<string,string>(),lastUser=new Map<string,string>();
  for(const run of state.runs){const job=state.jobs.find(j=>j.id===run.jobId);if(!job)continue;const stamp=run.createdAt,actor=job.createdBy??'system';if(stamp>(lastProject.get(job.projectId)??''))lastProject.set(job.projectId,stamp);if(stamp>(lastUser.get(actor)??''))lastUser.set(actor,stamp);}
  // A client's priority cannot indefinitely overtake another ready tenant/user.
  return [...jobs].sort((a,b)=>(lastProject.get(a.projectId)??'').localeCompare(lastProject.get(b.projectId)??'')||(lastUser.get(a.createdBy??'system')??'').localeCompare(lastUser.get(b.createdBy??'system')??'')||a.queuedAt.localeCompare(b.queuedAt)||a.id.localeCompare(b.id));
 }};
}
