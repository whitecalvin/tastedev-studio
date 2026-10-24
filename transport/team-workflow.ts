import {teamIsolation} from '../src/features/orchestration/team-isolation.ts';
import {createHash} from 'node:crypto';
import {CoreError,type Agent,type Run} from '../src/features/core/domain.ts';
import {gateCategories,intentContent,intentReference,teamId,teamText,type TeamWorkspace,type TeamIntent,type TeamWorkOverview,type TeamAssignment,type QualityGate,type TeamRule} from '../src/features/orchestration/team-intent.ts';
import {teamRoles} from '../src/features/orchestration/domain.ts';
import {factoryPath,pathContains,type FactoryOverview,type FactoryContract,type FactoryTask} from '../src/features/orchestration/factory.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import type {GraphPersistence} from './graph-execution.ts';
import type {GraphOverview} from '../src/features/orchestration/execution.ts';

type Permission='read'|'history-write'|'approve'|'run';
export interface TeamWorkBridge {factory:(project:string)=>FactoryOverview;graph:(project:string)=>GraphOverview;agents?:(project:string)=>Agent[];run?:(project:string,id:string)=>Run|undefined;attempt?:(project:string,id:string)=>FixAttempt|undefined}
const fail=(s:string):never=>{throw new CoreError('Team workflow: '+s);};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const empty=(projectId:string):TeamWorkspace=>({projectId,revision:0,intents:[],gates:[],messages:[],rules:[],assignments:[],receipts:[]});
const author=(actor:string)=>{if(actor==='local')return 'local';try{return teamText(JSON.parse(actor).userId,120);}catch{return fail('Invalid actor.');}};
const stamp=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const active=(task:FactoryTask)=>['queued','launching','running','review','paused','cancelling'].includes(task.status);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const bounded=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max;
/** One Core writer. Metadata never registers a model tool or launches a command. */
export class TeamWorkflow {
  private workspaces=new Map<string,TeamWorkspace>();
  private bridge:TeamWorkBridge;private persistence?:GraphPersistence;private authority:(actor:string,project:string,permission:Permission)=>void;private now:()=>string;
  constructor(bridge:TeamWorkBridge,persistence?:GraphPersistence,authority:(actor:string,project:string,permission:Permission)=>void=()=>{},now=()=>new Date().toISOString()){
    this.bridge=bridge;this.persistence=persistence;this.authority=authority;this.now=now;
    const saved=persistence?.load() as {version:number;workspaces:TeamWorkspace[]}|undefined;
    if(saved){
      if(saved.version!==1||!bounded(saved.workspaces,100))fail('Invalid saved state; preserved.');
      for(const w of saved.workspaces){this.validate(w);if(this.workspaces.has(w.projectId))fail('Duplicate saved project; preserved.');this.workspaces.set(w.projectId,structuredClone(w));}
    }
  }
  private validate(w:TeamWorkspace){
    if(!w||!teamId(w.projectId)||!Number.isSafeInteger(w.revision)||w.revision<0||!bounded(w.intents,100)||!bounded(w.gates,500)||!bounded(w.messages,500)||!bounded(w.rules,100)||!bounded(w.assignments??[],100)||!bounded(w.receipts??[],1000)||JSON.stringify(w).length>2000000)fail('Invalid saved workspace; preserved.');
    const unique=(values:{id:string}[])=>{if(values.some(v=>!v||!teamId(v.id))||new Set(values.map(v=>v.id)).size!==values.length)fail('Invalid or duplicate saved identity; preserved.');};
    unique(w.intents);unique(w.gates);unique(w.messages);unique(w.rules);unique(w.receipts??[]);
    for(const i of w.intents){
      const content=intentContent(i);if(!same(content,intentContent(content))||hash(content)!==i.digest||!Number.isSafeInteger(i.version)||i.version<1||typeof i.ready!=='boolean'||!stamp(i.createdAt)||!stamp(i.updatedAt)||!bounded(i.history,20)||!bounded(i.decisions,100))fail('Invalid saved intent; preserved.');
      if(i.history.length!==i.version-1||i.history.some((h,n)=>h.version!==n+1||hash(intentContent(h.content))!==h.digest||!stamp(h.at)||teamText(h.reason,500)!==h.reason))fail('Invalid intent history; preserved.');
      unique(i.decisions);if(i.decisions.some(d=>!stamp(d.at)||teamText(d.text,1000)!==d.text||teamText(d.author,120)!==d.author))fail('Invalid decision; preserved.');
      if(i.rules?.some(r=>!teamId(r.id)||!Number.isSafeInteger(r.version)||r.version<1||teamText(r.text,300)!==r.text)||(i.rules?.length??0)>10)fail('Invalid rule snapshot; preserved.');
    }
    const intent=(id:string,version?:number)=>w.intents.some(v=>v.id===id&&(version===undefined||Number.isSafeInteger(version)&&version>=1&&version<=v.version));
    for(const a of w.assignments??[])if(!intent(a.intentId,a.intentVersion)||![a.roleNodeId,a.taskNodeId,a.profileId,a.agentNodeId,a.agentId,a.deviceNodeId].every(teamId)||!Number.isSafeInteger(a.graphRevision)||a.graphRevision<1||!hex(a.inputChecksum)||!stamp(a.at))fail('Invalid saved assignment; preserved.');
    if(new Set((w.assignments??[]).map(a=>a.intentId)).size!==(w.assignments??[]).length)fail('Duplicate assignment; preserved.');
    for(const g of w.gates)if(!intent(g.intentId,g.intentVersion)||!teamId(g.factoryTaskId)||!teamId(g.executionId)||!hex(g.sourceChecksum)||!gateCategories.includes(g.category)||!['passed','reused','failed','not-run','not-applicable'].includes(g.result)||!['manual','run'].includes(g.kind)||g.kind==='run'&&!teamId(g.runId)||!stamp(g.at)||teamText(g.note,1000)!==g.note||teamText(g.author,120)!==g.author)fail('Invalid saved gate; preserved.');
    for(const m of w.messages)if(!intent(m.intentId)||!teamRoles.includes(m.from)||!teamRoles.includes(m.to)||!['request','question','handoff','review'].includes(m.kind)||teamText(m.body,1600)!==m.body||!stamp(m.createdAt)||(m.acknowledgedAt!==undefined&&(!stamp(m.acknowledgedAt)||teamText(m.acknowledgedBy,120)!==m.acknowledgedBy)))fail('Invalid saved inbox; preserved.');
    for(const r of w.rules)if(!intent(r.intentId)||!(r.scope==='project'||teamRoles.includes(r.scope))||teamText(r.text,300)!==r.text||!Number.isSafeInteger(r.version)||r.version<1||!['proposed','approved','retired'].includes(r.status)||!stamp(r.createdAt)||!bounded(r.sourceMessages,20)||r.sourceMessages.some(id=>!w.messages.some(m=>m.id===id&&m.intentId===r.intentId))||(r.status==='approved'&&(!stamp(r.approvedAt)||teamText(r.approvedBy,120)!==r.approvedBy)))fail('Invalid saved rule; preserved.');
    if((w.receipts??[]).some(r=>!hex(r.digest)))fail('Invalid request receipt; preserved.');
  }
  private current(project:string){if(!teamId(project))fail('Invalid project.');return this.workspaces.get(project)??empty(project);}
  private commit(w:TeamWorkspace){this.validate(w);const all=new Map(this.workspaces);all.set(w.projectId,w);if(all.size>100)fail('Project capacity reached.');this.persistence?.save({version:1,workspaces:[...all.values()]});this.workspaces=all;}
  private assignment(project:string,intent:TeamIntent,roleNodeId:string,at:string):TeamAssignment{
    const d=this.bridge.graph(project).definition;if(!d)fail('Publish the saved graph and source first.');
    const role=d!.graph.nodes.find(n=>n.id===roleNodeId&&n.kind==='role'&&n.teamRole===intent.responsibility);
    if(!role)fail('Responsibility does not match the published role.');
    const tasks=d!.graph.edges.filter(e=>e.from===roleNodeId&&e.relation==='performs').map(e=>d!.graph.nodes.find(n=>n.id===e.to&&n.kind==='task'&&n.teamRole===intent.responsibility)).filter(n=>!!n);
    if(tasks.length!==1)fail('Choose a role with exactly one declared team task.');
    const task=tasks[0]!,plan=d!.aiTasks?.[task.id];if(!plan)fail('Publish the role AI profile and connection first.');
    if((plan!.completion==='verified-fix')!==(intent.responsibility==='implementation'))fail('Role tool policy mismatch.');
    const agents=d!.graph.edges.filter(e=>e.to===roleNodeId&&e.relation==='assigns').map(e=>d!.graph.nodes.find(n=>n.id===e.from&&n.kind==='agent')).filter(n=>!!n);
    if(agents.length!==1||!agents[0]!.reference)fail('Assign one registered Agent explicitly.');
    const agent=agents[0]!,devices=d!.graph.edges.filter(e=>e.to===agent.id&&e.relation==='hosts').map(e=>d!.graph.nodes.find(n=>n.id===e.from&&n.kind==='device')).filter(n=>!!n);
    if(devices.length!==1)fail('Declare the Agent host device.');
    if(!this.bridge.agents?.(project).some(a=>a.id===agent.reference))fail('Agent is not accessible in this project.');
    return{intentId:intent.id,intentVersion:intent.version,roleNodeId,taskNodeId:task.id,profileId:plan!.profileId,agentNodeId:agent.id,agentId:agent.reference,deviceNodeId:devices[0]!.id,graphRevision:d!.revision,inputChecksum:d!.inputChecksum,at};
  }
  private evidence(project:string,executionId:string){
    const execution=this.bridge.graph(project).executions.find(e=>e.id===executionId);
    const fixes=execution?.activations.filter(a=>a.fixAttemptId).map(a=>this.bridge.attempt?.(project,a.fixAttemptId!)).filter(a=>!!a)??[];
    return{execution,fixes,checksum:fixes.at(-1)?.snapshot?.checksum??execution?.source?.checksum};
  }
  overview(project:string):TeamWorkOverview{
    const w=this.current(project),assignments=w.assignments??[];
    const waiting=w.intents.map(i=>{const reasons:string[]=[],a=assignments.find(a=>a.intentId===i.id);if(!i.ready)reasons.push('Intent needs review.');if(!a)reasons.push('Choose an assignment from the published graph.');else{try{const fresh=this.assignment(project,i,a.roleNodeId,a.at);if(!same(a,fresh))reasons.push('Graph, AI profile or intent changed. Review assignment.');}catch(e){reasons.push(e instanceof Error?e.message:'Assignment unavailable.');}const agent=this.bridge.agents?.(project).find(v=>v.id===a.agentId);if(!agent||agent.status==='offline'||agent.status==='error')reasons.push('Agent is unavailable.');if(agent?.status==='busy')reasons.push('Agent is busy.');}for(const task of this.bridge.factory(project).tasks.filter(t=>t.contract.intent?.id===i.id&&!['completed','cancelled'].includes(t.status)))if(task.reason)reasons.push(task.reason);return{intentId:i.id,reasons:[...new Set(reasons)]};});
    const roles=this.bridge.graph(project).definition?.graph.nodes.filter(n=>n.kind==='role'&&n.teamRole).map(n=>({id:n.id,label:n.label,responsibility:n.teamRole!}))??[];
    const work=this.bridge.factory(project).tasks.filter(t=>t.contract.intent).map(t=>{const executionId=t.attempts.at(-1)?.executionId,e=this.evidence(project,executionId??'');return{taskId:t.contract.taskId,intentId:t.contract.intent!.id,intentVersion:t.contract.intent!.version,status:t.status,reason:t.reason,executionId,sourceChecksum:e.checksum,runIds:[...new Set([...(e.execution?.activations.flatMap(a=>a.runId?[a.runId]:[])??[]),...e.fixes.flatMap(f=>f.retestRunId?[f.retestRunId]:[])])]};});
    return{...structuredClone(w),isolations:this.bridge.factory(project).tasks.filter(t=>t.contract.intent).map(t=>teamIsolation(t,this.bridge.graph(project),id=>this.bridge.attempt?.(project,id),id=>this.bridge.run?.(project,id))),durable:!!this.persistence,assignments:structuredClone(assignments),waiting,roles,work};
  }
  request(project:string,action:string,input:unknown,actor:string):TeamWorkOverview{
    const permission:Permission=action==='list'?'read':['intent-ready','gate-record','rule-approve','rule-retire'].includes(action)?'approve':'history-write';this.authority(actor,project,permission);
    if(action==='list')return this.overview(project);
    const i=input as Record<string,unknown>,current=this.current(project);if(!i)fail('Invalid request.');
    const requestDigest=hash([actor,action,Object.fromEntries(Object.entries(i).filter(([k])=>k!=='revision'&&k!=='requestId').sort(([a],[b])=>a.localeCompare(b)))]);
    if(i.requestId!==undefined){if(!teamId(i.requestId))fail('Invalid request identity.');const receipt=current.receipts?.find(r=>r.id===i.requestId);if(receipt){if(receipt.digest!==requestDigest)fail('Request identity conflict.');return this.overview(project);}}
    if(i.revision!==current.revision)fail('Workspace changed. Refresh before continuing.');
    const next=structuredClone(current),at=this.now();
    if(action==='intent-create'){
      if(!teamId(i.id))fail('Invalid intent identity.');const content=intentContent(i.content),old=next.intents.find(v=>v.id===i.id);
      if(old){if(old.digest!==hash(content))fail('Intent identity conflict.');return this.overview(project);}if(next.intents.length>=100)fail('Intent capacity reached.');
      next.intents.push({...content,id:String(i.id),version:1,digest:hash(content),ready:false,createdAt:at,updatedAt:at,history:[],decisions:[]});
    }else{
      const intent=next.intents.find(v=>v.id===i.intentId);if(!intent||intent.version!==i.intentVersion)fail('Intent changed or unavailable.');const target=intent!;
      if(action==='intent-revise'){
        if(this.bridge.factory(project).tasks.some(t=>t.contract.intent?.id===target.id&&active(t))||this.bridge.graph(project).executions.some(e=>e.team?.id===target.id&&['running','paused','cancelling'].includes(e.status)))fail('Active work must finish or be cancelled before changing intent.');
        if(target.history.length>=20)fail('Intent history capacity reached.');const content=intentContent(i.content),reason=teamText(i.reason,500);
        target.history.push({version:target.version,digest:target.digest,content:intentContent(target),reason,at});Object.assign(target,content,{version:target.version+1,digest:hash(content),ready:false,updatedAt:at});delete target.rules;
      }else if(action==='intent-ready'){
        if(!target.ready){const rules=next.rules.filter(r=>r.status==='approved'&&(r.scope==='project'||r.scope===target.responsibility));if(rules.length>10)fail('Select at most ten active rules.');target.rules=rules.map(r=>({id:r.id,version:r.version,text:r.text}));target.ready=true;target.updatedAt=at;}
      }else if(action==='decision-add'){
        if(!teamId(i.id)||target.decisions.length>=100)fail('Decision limit or identity.');const text=teamText(i.text,1000),old=target.decisions.find(v=>v.id===i.id);if(old&&old.text!==text)fail('Decision identity conflict.');if(!old)target.decisions.push({id:String(i.id),text,author:author(actor),at});
      }else if(action==='assign'){
        const assignment=this.assignment(project,target,String(i.roleNodeId),at);next.assignments=[...(next.assignments??[]).filter(a=>a.intentId!==target.id),assignment];
      }else if(action==='message-send'){
        if(!teamId(i.id)||next.messages.length>=500||!teamRoles.includes(i.from as never)||!teamRoles.includes(i.to as never)||!['request','question','handoff','review'].includes(String(i.kind)))fail('Invalid team message.');
        const m={id:String(i.id),intentId:target.id,from:i.from,to:i.to,kind:i.kind,body:teamText(i.body,1600),createdAt:at} as TeamWorkspace['messages'][number];if(next.messages.some(m=>m.id===i.id))fail('Message identity conflict.');next.messages.push(m);
      }else if(action==='message-ack'){
        const m=next.messages.find(m=>m.id===i.id&&m.intentId===target.id);if(!m)fail('Message unavailable.');if(!m!.acknowledgedAt){m!.acknowledgedAt=at;m!.acknowledgedBy=author(actor);}
      }else if(action==='rule-propose'){
        if(!teamId(i.id)||next.rules.length>=100||!(i.scope==='project'||teamRoles.includes(i.scope as never))||!bounded(i.sourceMessages,20))fail('Invalid rule proposal.');
        const sources=i.sourceMessages as string[];if(sources.some(id=>!next.messages.some(m=>m.id===id&&m.intentId===target.id))||new Set(sources).size!==sources.length)fail('Rule references unavailable feedback.');
        if(next.rules.some(r=>r.id===i.id))fail('Rule identity conflict.');next.rules.push({id:String(i.id),intentId:target.id,scope:i.scope as TeamRule['scope'],text:teamText(i.text,300),version:1,status:'proposed',createdAt:at,sourceMessages:[...sources]});
      }else if(action==='rule-approve'||action==='rule-retire'){
        const r=next.rules.find(r=>r.id===i.id&&r.intentId===target.id);if(!r||r.version!==i.ruleVersion||r.status==='retired')fail('Rule changed or unavailable.');if(action==='rule-approve'&&r!.status!=='proposed')fail('Only a proposed rule can be approved.');
        r!.status=action==='rule-approve'?'approved':'retired';r!.version++;r!.approvedBy=author(actor);r!.approvedAt=at;
        // Ready intents retain their reviewed rule snapshot. New revisions opt in through Mark ready.
      }else if(action==='gate-record'){
        if(!teamId(i.id)||next.gates.length>=500||next.gates.some(g=>g.id===i.id))fail('Invalid gate identity or capacity.');
        const task=this.bridge.factory(project).tasks.find(t=>t.contract.taskId===i.factoryTaskId&&t.contract.intent?.id===target.id&&t.contract.intent.version===target.version),execution=this.bridge.graph(project).executions.find(e=>e.id===i.executionId);
        const tested=this.evidence(project,String(i.executionId));
        if(!task||task.attempts.at(-1)?.executionId!==execution?.id||!tested.checksum)fail('Gate must identify the current attempt and its tested Source.');
        if(!gateCategories.includes(i.category as never)||!['passed','reused','failed','not-run','not-applicable'].includes(String(i.result))||!['manual','run'].includes(String(i.kind)))fail('Invalid quality gate.');
        if(i.category==='tests'&&['passed','reused'].includes(String(i.result))&&i.kind!=='run')fail('Passing tests require actual Run evidence.');
        if(i.kind==='run'){
          if(i.category!=='tests')fail('Run evidence records test results only; other checks need explicit review.');
          const run=this.bridge.run?.(project,String(i.runId));if(!run||run.projectId!==project||!(execution!.activations.some(a=>a.runId===run!.id)||tested.fixes.some(f=>f.retestRunId===run!.id))||run!.revision?.commit!==tested.checksum)fail('Run evidence does not match the execution Source.');
          if(['passed','reused'].includes(String(i.result))&&run!.status!=='passed')fail('Run did not pass.');if(i.result==='failed'&&!['failed','timeout','cancelled'].includes(run!.status))fail('Run has not failed.');
        }
        const gate:QualityGate={id:String(i.id),intentId:target.id,intentVersion:target.version,factoryTaskId:task!.contract.taskId,executionId:execution!.id,sourceChecksum:tested.checksum!,category:i.category as QualityGate['category'],result:i.result as QualityGate['result'],kind:i.kind as QualityGate['kind'],...(i.kind==='run'?{runId:String(i.runId)}:{}),note:teamText(i.note,1000),author:author(actor),at};next.gates.push(gate);
      }else fail('Unknown action.');
    }
    if(i.requestId!==undefined){if((next.receipts?.length??0)>=1000)fail('Request receipt capacity reached.');next.receipts=[...(next.receipts??[]),{id:String(i.requestId),digest:requestDigest}];}
    next.revision++;this.commit(next);return this.overview(project);
  }
  completion(project:string,intentId:string):import('../src/features/orchestration/team-report.ts').TeamCompletionReport {
    const w=this.current(project),intent=w.intents.find(i=>i.id===intentId);if(!intent)fail('Intent unavailable.');
    const all=this.bridge.factory(project).tasks.filter(t=>t.contract.intent?.id===intentId),tasks=all.filter(t=>t.contract.intent!.version===intent!.version),issues:string[]=[];
    if(intent!.responsibility!=='implementation')issues.push('Read-only analysis is not implementation completion.');
    if(!intent!.ready)issues.push('Review and mark the work intent ready.');if(!tasks.length)issues.push('No current implementation contracts.');
    const rows=tasks.map(t=>{const executionId=t.attempts.at(-1)?.executionId,tested=this.evidence(project,executionId??''),isolation=teamIsolation(t,this.bridge.graph(project),id=>this.bridge.attempt?.(project,id),id=>this.bridge.run?.(project,id));
      if(t.status!=='completed')issues.push('Work has not been accepted: '+t.contract.taskId);
      try{this.validateContract(t.contract);this.validateAcceptance(t.contract,executionId??'');}catch{issues.push('Current contract or quality evidence unavailable: '+t.contract.taskId);}
      if(tested.execution?.status!=='passed'||!isolation.attempts.length||!isolation.attempts.some(a=>a.sourceMatchesRun&&a.runStatus==='passed'))issues.push('Actual verified retest unavailable: '+t.contract.taskId);
      issues.push(...isolation.issues);
      const gates=gateCategories.map(category=>w.gates.findLast(g=>g.intentId===intentId&&g.intentVersion===intent!.version&&g.factoryTaskId===t.contract.taskId&&g.executionId===executionId&&g.sourceChecksum===tested.checksum&&g.category===category)).filter(g=>!!g).map(g=>({category:g.category,result:g.result,kind:g.kind,runId:g.runId}));
      return{id:t.contract.taskId,status:t.status,executionId,sourceChecksum:tested.checksum,runIds:isolation.attempts.flatMap(a=>a.runId?[a.runId]:[]),gates};
    });
    return{projectId:project,intentId,intentVersion:intent!.version,workspaceRevision:w.revision,generatedAt:this.now(),status:issues.length?'incomplete':'verified',scope:'implementation-intent',issues:[...new Set(issues)],tasks:rows,historicalTasks:all.length-tasks.length,automaticCommit:false,automaticDeployment:false};
  }
  roleContext(project:string,intentId:string,nodeId:string){
    const i=this.current(project).intents.find(i=>i.id===intentId),a=this.current(project).assignments?.find(a=>a.intentId===intentId);
    if(!i?.ready||i.responsibility==='implementation'||!a||a.taskNodeId!==nodeId||!same(a,this.assignment(project,i,a.roleNodeId,a.at)))fail('Review the current read-only role intent and assignment.');
    const d=this.bridge.graph(project).definition!;
    if(!d.source||d.graph.edges.some(e=>e.from===nodeId&&['success','failure'].includes(e.relation)))fail('Read-only role execution must be isolated from implementation and deployment.');
    return{intent:intentReference(i!),question:'\n\nReviewed team work (task data; existing read-only tools and approval policy apply):\n'+JSON.stringify({objective:i!.objective,acceptance:i!.acceptance,paths:i!.paths,...intentReference(i!),handoffs:this.current(project).messages.filter(m=>m.intentId===intentId&&m.to===i!.responsibility).slice(-3).map(m=>({id:m.id,from:m.from,body:m.body.slice(0,300),excerpt:m.body.length>300})),decisions:i!.decisions.slice(-2)})};
  }
  validateContract(contract:FactoryContract){
    if(!contract.intent)return;const w=this.current(contract.projectId),i=w.intents.find(i=>i.id===contract.intent!.id);
    if(!i||!i.ready||!same(intentReference(i),contract.intent))fail('Work intent changed or is not ready.');
    contract.paths.forEach(factoryPath);
    if(i!.responsibility!=='implementation'||!contract.paths.every(p=>i!.paths.some(scope=>pathContains(scope,p)))||!contract.acceptance.every(c=>i!.acceptance.includes(c)))fail('Contract exceeds reviewed implementation intent.');
    const d=this.bridge.graph(contract.projectId).definition,review=d?.graph.nodes.find(n=>n.id===contract.reviewNodeId&&n.kind==='task'&&n.teamRole==='review');
    if(!review||!d!.graph.edges.some(e=>e.to===review.id&&e.relation==='performs'&&d!.graph.nodes.some(n=>n.id===e.from&&n.kind==='role'&&n.teamRole==='review')))fail('An independent team review responsibility is required.');
    const a=w.assignments?.find(a=>a.intentId===i!.id);if(!a||!same(a,this.assignment(contract.projectId,i!,a.roleNodeId,a.at))||a.taskNodeId!==contract.implementationNodeId||a.graphRevision!==contract.revision||a.inputChecksum!==contract.inputChecksum)fail('Review the current role assignment before execution.');
  }
  validateAcceptance(contract:FactoryContract,executionId:string){
    if(!contract.intent)return;const w=this.current(contract.projectId),tested=this.evidence(contract.projectId,executionId);if(!tested.checksum)fail('Tested Source is unavailable.');
    for(const category of gateCategories){const gate=w.gates.findLast(g=>g.intentId===contract.intent!.id&&g.intentVersion===contract.intent!.version&&g.factoryTaskId===contract.taskId&&g.executionId===executionId&&g.sourceChecksum===tested.checksum&&g.category===category);if(!gate||!['passed','reused','not-applicable'].includes(gate.result)||category==='tests'&&gate.result==='not-applicable')fail('Quality gate requires evidence: '+category);}
  }
}
