import {randomUUID} from 'node:crypto';
import {CoreError} from '../src/features/core/domain.ts';
import {factoryConflicts,factoryContext,pathContains,validateFactoryContract,validateFactoryDefinition,type FactoryContract,type FactoryOverview,type FactoryTask} from '../src/features/orchestration/factory.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';
import type {GraphPersistence} from './graph-execution.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';

export interface FactoryBridge {
  validateAcceptance?:(contract:FactoryContract,executionId:string)=>void;
  validateContract?:(contract:FactoryContract)=>void;
  overview(project:string):GraphOverview;
  request(project:string,action:string,input:unknown,actor:string):Promise<GraphOverview>;
  analysis(project:string,id:string):AnalysisRecord|undefined;
  attempt(project:string,id:string):FixAttempt|undefined;
}
type Authority=(actor:string,project:string,action:'read'|'run'|'approve'|'cancel'|'history-write')=>void;
const holding=(t:FactoryTask)=>['launching','running','review','cancelling'].includes(t.status)||t.status==='paused'&&t.attempts.length>0;
const fail=(message:string):never=>{throw new CoreError('Factory: '+message);};
/** One Core writer, durable launch intent, idempotent Graph identity, no model-owned state. */
export class SoftwareFactory {
  private tasks:FactoryTask[]=[];
  private serial:Promise<unknown>=Promise.resolve();
  private bridge:FactoryBridge;
  private persistence?:GraphPersistence;
  private authority:Authority;
  private now:()=>number;
  readonly maximumParallel=2;
  private validateDefinition(c:FactoryContract){validateFactoryDefinition(c,this.bridge.overview(c.projectId).definition);this.bridge.validateContract?.(c);}
  constructor(bridge:FactoryBridge,persistence?:GraphPersistence,authority:Authority=()=>{},now=Date.now){
    this.bridge=bridge;this.persistence=persistence;this.authority=authority;this.now=now;
    const saved=persistence?.load() as {version:number;tasks:FactoryTask[]}|undefined;
    if(saved){
      if(saved.version!==1||!Array.isArray(saved.tasks)||saved.tasks.length>500)fail('Invalid durable state; preserved.');
      const keys=new Set<string>();
      for(const task of saved.tasks){const c=validateFactoryContract(task.contract,task.contract.projectId),key=c.projectId+'/'+c.taskId;if(keys.has(key)||!Number.isSafeInteger(task.version)||task.version<1||!['draft','queued','launching','running','review','completed','failed','paused','cancelling','cancelled'].includes(task.status)||typeof task.actor!=='string'||!Array.isArray(task.attempts)||task.attempts.length>c.maxAttempts||!Number.isFinite(Date.parse(task.createdAt))||task.deadline!==undefined&&!Number.isFinite(Date.parse(task.deadline))||task.attempts.some(a=>!/^factory-[a-f0-9-]{36}$/.test(a.executionId)||!Number.isFinite(Date.parse(a.startedAt))))fail('Invalid durable task; preserved.');keys.add(key);}
      this.tasks=structuredClone(saved.tasks);
      this.commit(next=>{for(const task of next)if(['queued','launching','running'].includes(task.status)){task.status='paused';task.reason='Core restarted. Review and resume; no work was replayed.';task.version++;}});
    }
  }
  private locked<T>(fn:()=>T|Promise<T>):Promise<T>{const result=this.serial.then(fn);this.serial=result.catch(()=>{});return result;}
  private commit(change:(next:FactoryTask[])=>void){const next=structuredClone(this.tasks);change(next);if(JSON.stringify(next)===JSON.stringify(this.tasks))return;this.persistence?.save({version:1,tasks:next});this.tasks=next;}
  private task(project:string,id:string){return this.tasks.find(t=>t.contract.projectId===project&&t.contract.taskId===id)??fail('Task not found in project.');}
  private update(task:FactoryTask,change:(target:FactoryTask)=>void){this.commit(next=>{const target=next.find(t=>t.contract.projectId===task.contract.projectId&&t.contract.taskId===task.contract.taskId)!;change(target);target.version++;});}
  overview(project:string):FactoryOverview{return {tasks:structuredClone(this.tasks.filter(t=>t.contract.projectId===project).map(t=>({...t,actor:'',attempts:t.attempts.map(a=>({...a,reviewedBy:undefined}))}))),durable:!!this.persistence,maximumParallel:this.maximumParallel};}
  request(project:string,action:string,input:unknown,actor:string){return this.locked(async()=>{
    const permission=action==='list'?'read':['create','create-plan'].includes(action)?'history-write':action==='cancel'?'cancel':action==='review'?'approve':'run';this.authority(actor,project,permission);
    if(action==='list')return this.overview(project);
    const i=input as {taskId:string;version:number;contract:FactoryContract;accepted?:boolean;notes?:string};
    if(action==='create-plan'){
      const values=(input as {contracts:unknown[]})?.contracts;
      if(!Array.isArray(values)||!values.length||values.length>8)fail('Invalid plan batch.');
      const batch=values.map(value=>validateFactoryContract(value,project));
      if(new Set(batch.map(c=>c.taskId)).size!==batch.length)fail('Duplicate task in plan.');
      const preceding=new Set<string>();
      for(const contract of batch){
        this.validateDefinition(contract);
        for(const dep of contract.dependencies){this.authority(actor,dep.projectId,'read');if(dep.projectId!==project||!preceding.has(dep.taskId))this.task(dep.projectId,dep.taskId);}
        const old=this.tasks.find(t=>t.contract.projectId===project&&t.contract.taskId===contract.taskId);
        if(old&&JSON.stringify(old.contract)!==JSON.stringify(contract))fail('Plan identity conflict.');preceding.add(contract.taskId);
      }
      this.commit(next=>{for(const contract of batch)if(!next.some(t=>t.contract.projectId===project&&t.contract.taskId===contract.taskId)){if(next.length>=500)fail('Task capacity reached.');next.push({contract,version:1,status:'draft',actor,createdAt:new Date(this.now()).toISOString(),attempts:[]});}});
    }else if(action==='create'){
      const contract=validateFactoryContract(i?.contract,project);this.validateDefinition(contract);
      for(const dep of contract.dependencies){this.authority(actor,dep.projectId,'read');this.task(dep.projectId,dep.taskId);}
      const old=this.tasks.find(t=>t.contract.projectId===project&&t.contract.taskId===contract.taskId);
      if(old){if(JSON.stringify(old.contract)!==JSON.stringify(contract))fail('Task identity conflicts with a different contract.');return this.overview(project);}
      this.commit(next=>{if(next.length>=500)fail('Task capacity reached.');next.push({contract,version:1,status:'draft',actor,createdAt:new Date(this.now()).toISOString(),attempts:[]});});
    }else{
      const task=this.task(project,i?.taskId);if(task.version!==i.version)fail('Task changed. Refresh before continuing.');
      if(action==='queue'){
        if(task.status!=='draft')fail('Only a draft can be approved for the queue.');
        this.validateDefinition(task.contract);
        this.update(task,t=>{t.status='queued';t.actor=actor;t.deadline=new Date(this.now()+t.contract.timeoutMinutes*60000).toISOString();delete t.reason;});
      }else if(action==='resume'){
        if(task.status!=='paused')fail('Task is not paused.');
        this.validateDefinition(task.contract);
        const executionId=task.attempts.at(-1)?.executionId,execution=this.bridge.overview(project).executions.find(e=>e.id===executionId);
        if(execution?.status==='paused')await this.bridge.request(project,'resume',{executionId},actor);
        this.update(task,t=>{t.actor=actor;t.status=executionId?'launching':'queued';delete t.reason;});
      }else if(action==='retry'){
        this.bridge.validateContract?.(task.contract);
        if(task.status!=='failed'||task.attempts.length>=task.contract.maxAttempts||!i.notes?.trim()||i.notes.length>1000)fail('Retry needs a failure reason and remaining attempt budget.');
        const executionId=task.attempts.at(-1)?.executionId,execution=this.bridge.overview(project).executions.find(e=>e.id===executionId);
        if(!execution||execution.status!=='failed')fail('Failed graph unavailable.');
        const failed=execution!.activations.findLast(a=>a.status==='failed');if(!failed)fail('No failed activation to resume.');
        // Graph retry preserves successful nodes; record intent before the remote boundary.
        this.update(task,t=>{t.status='launching';t.actor=actor;t.reason=i.notes;t.attempts.push({executionId:executionId!,startedAt:new Date(this.now()).toISOString()});});
        await this.bridge.request(project,'retry-failed',{executionId,activationId:failed!.id},actor);
      }else if(action==='review'){
        this.authority(actor,project,'run');
        if(task.status!=='review'||typeof i.accepted!=='boolean'||!i.notes?.trim()||i.notes.length>1000)fail('Review needs an explicit disposition and notes.');
        this.reviewEvidence(task);
        if(i.accepted)this.bridge.validateAcceptance?.(task.contract,task.attempts.at(-1)!.executionId);
        this.update(task,t=>{t.status=i.accepted?'completed':'failed';t.reason=i.notes;const a=t.attempts.at(-1)!;a.disposition=i.accepted?'accepted':'changes';a.notes=i.notes;a.reviewedBy=actor;a.finishedAt=new Date(this.now()).toISOString();});
      }else if(action==='cancel'){
        if(['completed','cancelled'].includes(task.status))fail('Task already finished.');
        this.update(task,t=>{t.status=t.attempts.length?'cancelling':'cancelled';t.actor=actor;});
      }else fail('Unknown action.');
    }
    await this.advance();return this.overview(project);
  }).catch(error=>{if(error instanceof Error&&error.message.startsWith('Factory: '))throw new CoreError(error.message);throw error;});}
  private reviewEvidence(task:FactoryTask){
    const c=task.contract,e=this.bridge.overview(c.projectId).executions.find(e=>e.id===task.attempts.at(-1)?.executionId);
    if(!e||e.status!=='passed')fail('Graph has not passed.');
    const implementation=e!.activations.findLast(a=>a.nodeId===c.implementationNodeId&&a.status==='passed'),review=e!.activations.findLast(a=>a.nodeId===c.reviewNodeId&&a.status==='passed');
    const attempt=implementation?.fixAttemptId?this.bridge.attempt(c.projectId,implementation.fixAttemptId):undefined,record=review?.analysisId?this.bridge.analysis(c.projectId,review.analysisId):undefined;
    if(!attempt||attempt.status!=='passed'||!record||record.projectId!==c.projectId||record.task?.graph?.executionId!==e!.id||record.task.nodeId!==c.reviewNodeId||record.task.graph.activationId!==review?.id||record.task.profileId===e!.aiTasks?.[c.implementationNodeId]?.profileId||!record.result.evidence.length)fail('Independent review and verified implementation evidence required.');
    if(attempt!.patches.some(p=>!c.paths.some(scope=>pathContains(scope,p.path))||record!.originals[p.path]!==p.result))fail('Reviewer must read the exact tested changed files within contract scope.');
  }
  tick(){return this.locked(()=>this.advance());}
  private async advance(){
    for(const original of [...this.tasks]){
      const task=this.task(original.contract.projectId,original.contract.taskId),c=task.contract;
      if(['draft','completed','cancelled','failed','paused'].includes(task.status))continue;
      if(task.status!=='cancelling')try{this.authority(task.actor,c.projectId,'run');}catch{this.update(task,t=>{t.status='paused';t.reason='Execution authority expired or revoked.';});continue;}
      const executionId=task.attempts.at(-1)?.executionId,e=this.bridge.overview(c.projectId).executions.find(e=>e.id===executionId);
      if(task.status==='cancelling'||task.deadline&&this.now()>Date.parse(task.deadline)){
        if(e&&['running','paused','cancelling'].includes(e.status)){await this.bridge.request(c.projectId,'cancel',{executionId},task.actor);this.update(task,t=>{t.status='cancelling';t.reason??='Task deadline reached or cancellation requested.';});}
        else this.update(task,t=>{t.status='cancelled';});
        continue;
      }
      if(task.status==='review')continue;
      if(e){
        if(e.status==='passed'){
          try{this.reviewEvidence(task);this.update(task,t=>{t.status='review';t.reason='Independent analysis is available. Record acceptance or requested changes.';});}
          catch(error){this.update(task,t=>{t.status='failed';t.reason=error instanceof Error?error.message:'Review evidence unavailable.';});}
        }else if(e.status==='failed'||e.status==='cancelled')this.update(task,t=>{t.status=e.status==='failed'?'failed':'cancelled';t.reason=e.reason;t.attempts.at(-1)!.finishedAt=new Date(this.now()).toISOString();});
        else if(e.status==='paused')this.update(task,t=>{t.status='paused';t.reason=e.reason;});
        else if(task.status!=='running')this.update(task,t=>{t.status='running';delete t.reason;});
        continue;
      }
      if(task.status==='queued'){
        try{for(const dep of c.dependencies)this.authority(task.actor,dep.projectId,'read');}catch{this.update(task,t=>{t.status='paused';t.reason='Dependency access expired or revoked.';});continue;}
        const dependencies=c.dependencies.map(d=>this.task(d.projectId,d.taskId));
        let waiting:string|undefined;
        if(dependencies.some(d=>d.status!=='completed'))waiting='Waiting for accepted dependencies.';
        else if(this.tasks.filter(holding).length>=this.maximumParallel||this.tasks.some(t=>holding(t)&&(t.contract.projectId===c.projectId||factoryConflicts(c,t.contract))))waiting='Waiting for a project slot or exclusive resource.';
        else if(this.bridge.overview(c.projectId).executions.some(e=>['running','paused','cancelling'].includes(e.status)))waiting='Waiting for the active project graph.';
        if(waiting){if(task.reason!==waiting)this.update(task,t=>{t.reason=waiting;});continue;}
        try{this.validateDefinition(c);}catch(error){this.update(task,t=>{t.status='failed';t.reason=String(error);});continue;}
        this.update(task,t=>{t.status='launching';delete t.reason;t.attempts.push({executionId:'factory-'+randomUUID(),startedAt:new Date(this.now()).toISOString()});});
      }
      const current=this.task(c.projectId,c.taskId);
      if(current.status==='launching'){
        try{await this.bridge.request(c.projectId,'start',{revision:c.revision,checksum:c.checksum,entryNodeId:c.entryNodeId,requestId:current.attempts.at(-1)!.executionId,factory:factoryContext(c)},task.actor);this.update(current,t=>{t.status='running';});}
        catch(error){this.update(current,t=>{t.status='paused';t.reason=error instanceof Error?error.message:'Launch reply unavailable. Resume reconciles the same execution identity.';});}
      }
    }
  }
}
