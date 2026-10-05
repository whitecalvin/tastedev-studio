import {validateArtifactInstallations,type ArtifactInstallationReceipt} from '../src/features/orchestration/artifact-installation.ts';
import {validateArtifactReceipts} from '../src/features/orchestration/artifact-receipts.ts';
import {graphArtifactPlans} from '../src/features/orchestration/artifact-plans.ts';
import {verifiedGraphFix,failedGraphFix} from '../src/features/orchestration/graph-fix.ts';
import type {FixAttempt} from '../src/features/ai/fix-service.ts';
import {taskAIRequest} from '../src/features/orchestration/task-ai.ts';
import {validateAIConfigurations,type AIConfigurationStore} from '../src/features/orchestration/ai-config.ts';
import type {ManagedAIConnection} from '../src/features/ai/routing.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';
import {createHash,randomUUID} from 'node:crypto';
import {validateGraph,type ProjectGraph} from '../src/features/orchestration/domain.ts';
import type {GraphDefinition,GraphActivation,GraphExecution,GraphOverview} from '../src/features/orchestration/execution.ts';
import {CoreError,activeRun} from '../src/features/core/domain.ts';
import {matchAgent} from '../src/features/core/matcher.ts';
import {validatePayload} from '../src/features/core/matcher.ts';
import type {CoreService} from '../src/features/core/service.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';
import {protocolFiles,type ProtocolSources} from '../src/features/protocol/domain.ts';
import {resolveProtocol,resolveTestPlan} from '../src/features/protocol/resolver.ts';
import {planPayload} from '../src/features/core/test-plan.ts';
import {graphSourcePlan,graphActivationPlan} from '../src/features/orchestration/source-plan.ts';
import {validateArtifactLineage,artifactProducerActivation} from '../src/features/orchestration/artifact-lineage.ts';
import {validateBuildArtifact,type BuildArtifact,type BuildArtifactOrigin,type BuildArtifactDeclaration} from '../src/features/orchestration/build-artifact.ts';
import {verifyProjectReference,type ProjectSnapshot} from '../src/features/ai/project-snapshot.ts';
export interface GraphAIBridge {attempt?(project:string,id:string):FixAttempt|undefined;connections(project:string):ManagedAIConnection[];analysis(project:string,id:string):AnalysisRecord|undefined}
export interface GraphPersistence {load():unknown;save(state:unknown):void}
interface State {version:1;definitions:GraphDefinition[];executions:GraphExecution[]}
type Authority=(actor:string,projectId:string,action:'run'|'approve'|'cancel'|'history-write'|'read')=>void;
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message:string):never=>{throw new CoreError('Graph: '+message);};
const terminal=(a:GraphActivation)=>['passed','failed','cancelled'].includes(a.status);
const jobActor=(actor:string)=>{if(!actor.startsWith('{'))return actor;const identity=JSON.parse(actor) as {userId:string};return identity.userId;};
/** A durable intent is committed before Job creation. Core idempotency links a lost reply
 * to the same activation; process restart pauses progression rather than replaying work. */
export class GraphExecutionService {
 private state:State={version:1,definitions:[],executions:[]};private serial:Promise<unknown>=Promise.resolve();
 private core:CoreService;private dispatch:(project:string,job:string)=>unknown;private cancelJob:(project:string,job:string)=>void;private persistence?:GraphPersistence;private authority:Authority;private now:()=>number;private ai?:GraphAIBridge;private verifySource?:(snapshot:ProjectSnapshot,project:string)=>Promise<unknown>;
 constructor(core:CoreService,dispatch:(project:string,job:string)=>unknown,cancelJob:(project:string,job:string)=>void,persistence?:GraphPersistence,authority:Authority=()=>{},now=Date.now,verifySource?:(snapshot:ProjectSnapshot,project:string)=>Promise<unknown>,ai?:GraphAIBridge){
  this.core=core;this.dispatch=dispatch;this.cancelJob=cancelJob;this.persistence=persistence;this.authority=authority;this.now=now;this.verifySource=verifySource;this.ai=ai;
  const saved=persistence?.load();if(saved){const s=saved as State;if(s.version!==1||!Array.isArray(s.definitions)||!Array.isArray(s.executions)||s.definitions.length>100||s.executions.length>500)fail('Invalid durable state; preserved.');for(const d of s.definitions){validateGraph(d.graph,d.projectId);if(d.checksum!==digest(d.graph)||!Number.isInteger(d.revision)||d.revision<1)fail('Definition integrity mismatch.');}for(const e of s.executions){if(!s.definitions.some(d=>d.projectId===e.projectId)||e.definition.projectId!==e.projectId||e.checksum!==digest(e.definition.graph)||!Array.isArray(e.activations)||e.activations.length>180||!Number.isFinite(Date.parse(e.deadline)))fail('Execution integrity mismatch.');}for(const e of s.executions)for(const a of e.activations)if(a.artifactReceipts)a.artifactReceipts=validateArtifactReceipts(e,a,a.artifactReceipts);for(const e of s.executions)for(const a of e.activations)if(a.artifactInstallations)a.artifactInstallations=validateArtifactInstallations(e,a,a.artifactInstallations);this.state=structuredClone(s);this.commit(next=>{for(const e of next.executions)if(e.status==='running'){e.status='paused';for(const a of e.activations)if(a.status==='ai-running'){a.status='failed';a.reason='AI request interrupted by Core restart; no automatic replay.';}e.reason='Core restarted; review and resume with current authority.';}});}
 }
 private commit(change:(next:State)=>void){const next=structuredClone(this.state);change(next);if(JSON.stringify(next)===JSON.stringify(this.state))return;this.persistence?.save(next);this.state=next;}
 private locked<T>(fn:()=>T|Promise<T>):Promise<T>{const result=this.serial.then(fn);this.serial=result.catch(()=>{});return result;}
 private execution(project:string,id:string){return this.state.executions.find(e=>e.projectId===project&&e.id===id)??fail('Execution not found in project.');}
 overview(project:string):GraphOverview{const d=this.state.definitions.find(d=>d.projectId===project);return structuredClone({definition:d?{...d,plans:undefined}:null,executions:this.state.executions.filter(e=>e.projectId===project).map(e=>({...e,definition:undefined,source:e.definition.source,artifactPlans:graphArtifactPlans(e.definition),aiTasks:e.definition.aiTasks,nodeLabels:Object.fromEntries(e.definition.graph.nodes.map(n=>[n.id,n.label]))})),durable:!!this.persistence});}
 request(project:string,action:string,input:unknown,actor:string){return this.locked(async()=>{
  this.authority(actor,project,action==='list'?'read':action==='publish'?'history-write':['approve','ai-start','ai-fix-complete','ai-fix-reject','ai-reanalyze'].includes(action)?'approve':action==='cancel'?'cancel':'run');
  if(action==='list')return this.overview(project);
  const source=action==='publish'?(input as {snapshot?:ProjectSnapshot})?.snapshot:action==='start'?this.state.definitions.find(d=>d.projectId===project)?.source:['approve','resume'].includes(action)?this.execution(project,(input as {executionId:string})?.executionId).definition.source:undefined;
  if(source){if(!this.verifySource)fail('Source verification unavailable.');await this.verifySource!(source,project);}
  if(action==='publish')this.publish(project,input);
  else if(action==='start')this.start(project,input,actor);
  else if(action==='approve'){const i=input as {executionId:string;activationId:string;revision:number;checksum:string};const e=this.execution(project,i?.executionId);if(e.status!=='running'||e.revision!==i.revision||e.checksum!==i.checksum)fail('Approval version conflict.');const a=e.activations.find(a=>a.id===i.activationId&&a.status==='approval')??fail('Approval activation not waiting.');this.commit(s=>{const target=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;target.status='passed';target.approvedBy=actor;target.approvedAt=new Date(this.now()).toISOString();this.follow(s.executions.find(v=>v.id===e.id)!,target,'success');});}
  else if(['ai-start','ai-complete','ai-fail','ai-fix-complete','ai-fix-reject','ai-reanalyze'].includes(action))this.aiAction(project,action,input,actor);
  else if(action==='resume'){const i=input as {executionId:string};const e=this.execution(project,i?.executionId);if(e.status!=='paused')fail('Only paused execution can resume.');this.commit(s=>{const e2=s.executions.find(v=>v.id===e.id)!;e2.status='running';e2.actor=actor;e2.reason=undefined;for(const a of e2.activations)if(a.status==='failed'&&a.reason==='AI request interrupted by Core restart; no automatic replay.'){a.reason='AI request interrupted; recovery branch reviewed.';this.follow(e2,a,'failure');}});}
  else if(action==='cancel'){const i=input as {executionId:string};const e=this.execution(project,i?.executionId);if(!['running','paused','cancelling'].includes(e.status))fail('Execution already finished.');this.commit(s=>{s.executions.find(v=>v.id===e.id)!.status='cancelling';});}
  else fail('Unknown action.');
  await this.advance();return this.overview(project);
 });}
 private aiAction(project:string,action:string,input:unknown,actor:string){
  const i=input as {executionId:string;activationId:string;revision:number;checksum:string;leaseId?:string;analysisId?:string;attemptId?:string};
  const e=this.execution(project,i?.executionId),a=e.activations.find(v=>v.id===i.activationId)??fail('AI activation not found.'),plan=e.definition.aiTasks?.[a.nodeId]??fail('AI plan missing.');
  if(e.status!=='running'||e.revision!==i.revision||e.checksum!==i.checksum||this.now()>Date.parse(e.deadline))fail('AI execution version or deadline conflict.');
  this.authority(actor,project,'run');
  if(action==='ai-reanalyze'){
   if(a.status!=='ai-fix-review'||plan.completion!=='verified-fix')fail('Graph fix is not waiting for review.');
   if(e.definition.deploymentNodes?.includes(a.nodeId))fail('Deployment retry requires a fresh deployment approval branch.');
   const attempt=this.ai?.attempt?.(project,i.attemptId??'');
   const verified=failedGraphFix(project,e.id,a,attempt,this.core.snapshot(project));
   if(attempt!.attempt>=plan.maximum||e.activations.filter(v=>v.nodeId===a.nodeId).length>=Math.min(e.definition.graph.retryLimit,plan.maximum))fail('Graph fix attempt limit reached.');
   const originalRunId=a.failure?.originalRunId??attempt!.originRunId??verified.runId;
   if(!this.core.snapshot(project).runs.some(r=>r.id===originalRunId&&r.projectId===project))fail('Original failure Run unavailable.');
   this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.status='failed';v.fixAttemptId=verified.attemptId;v.reason='Retest failed; new analysis requires fresh review.';this.activate(x,v.nodeId);x.activations.at(-1)!.failure={runId:verified.runId,originalRunId,attemptId:verified.attemptId,previousAnalysisId:a.analysisId!};});return;
  }
  if(['ai-fix-complete','ai-fix-reject'].includes(action)){
   if(a.status!=='ai-fix-review'||plan.completion!=='verified-fix')fail('Graph fix is not waiting for review.');
   if(action==='ai-fix-complete'&&(this.ai?.attempt?.(project,i.attemptId??'')?.attempt??Infinity)>plan.maximum)fail('Graph fix attempt limit reached.');
   const verified=action==='ai-fix-complete'?verifiedGraphFix(project,e.id,a,typeof i.attemptId==='string'?this.ai?.attempt?.(project,i.attemptId):undefined,this.core.snapshot(project)):undefined;
   this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.status=verified?'passed':'failed';v.fixAttemptId=verified?.attemptId;v.reason=verified?undefined:'Graph fix rejected. Applied changes require explicit Revert.';this.follow(x,v,verified?'success':'failure');});return;
  }
  if(action==='ai-start'){
   if(a.status!=='ai-review')fail('AI activation already claimed; no replay.');
   const current=this.ai?.connections(project).find(c=>c.id===plan.route.connectionId);if(!current||current.model!==plan.route.model||current.adapter!==plan.route.adapter)fail('Reviewed AI connection is unavailable.');
   this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.status='ai-running';v.leaseId=randomUUID();v.approvedBy=actor;v.approvedAt=new Date(this.now()).toISOString();v.aiDeadline=new Date(Math.min(Date.parse(e.deadline),this.now()+plan.budget.timeoutMs+15000)).toISOString();});return;
  }
  if(a.status!=='ai-running'||!i.leaseId||i.leaseId!==a.leaseId||actor!==a.approvedBy||this.now()>Date.parse(a.aiDeadline!))fail('AI lease expired or does not belong to this approval.');
  if(action==='ai-complete'){
   const record=typeof i.analysisId==='string'?this.ai?.analysis(project,i.analysisId):undefined,g=record?.task?.graph;
   if(JSON.stringify(record?.task?.failure)!==JSON.stringify(a.failure)||a.failure&&record?.runId!==a.failure.runId)fail('Retest analysis lineage mismatch.');
   if(a.failure){const snap=this.core.snapshot(project),run=snap.runs.find(r=>r.id===a.failure!.runId),job=snap.jobs.find(j=>j.id===run?.jobId),source=job?.payload.steps.find(s=>s.source?.provider==='snapshot')?.source;if(source?.provider==='snapshot'&&source.snapshot.schemaVersion===2&&(record?.source?.runId!==run?.id||record?.source?.snapshotId!==source.snapshot.snapshotId||record?.source?.checksum!==source.snapshot.checksum))fail('Immutable Run Source analysis required.');}
   if(!record||record.projectId!==project||record.task?.nodeId!==a.nodeId||record.task.profileId!==plan.profileId||record.model!==plan.route.model&&plan.route.model!==''||g?.executionId!==e.id||g.activationId!==a.id||g.leaseId!==a.leaseId||Date.parse(record.createdAt)<Date.parse(a.approvedAt!))fail('Durable approved AI analysis required.');
  }
  this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.status=action==='ai-complete'?(plan.completion==='verified-fix'?'ai-fix-review':'passed'):'failed';v.analysisId=action==='ai-complete'?i.analysisId:undefined;v.reason=action==='ai-fail'?'AI analysis failed or cancelled; source unchanged.':undefined;if(v.status!=='ai-fix-review')this.follow(x,v,action==='ai-complete'?'success':'failure');});
 }
 private publish(project:string,input:unknown){
  const i=input as {graph:ProjectGraph;sources:ProtocolSources;expectedRevision:number;snapshot?:ProjectSnapshot;aiConfigurations?:AIConfigurationStore};const graph=validateGraph(i?.graph,project),previous=this.state.definitions.find(d=>d.projectId===project);
  if(i.expectedRevision!==(previous?.revision??0))fail('Revision conflict; reload Core definition.');
  if(!i.sources||Object.entries(i.sources).some(([k,v])=>!protocolFiles.includes(k as typeof protocolFiles[number])||typeof v!=='string'||v.length>65536))fail('Invalid Protocol sources.');
  const protocol=parseProtocol(i.sources);if(protocol.status!=='Valid')fail('Valid Protocol required.');
  if(i.snapshot){verifyProjectReference(i.snapshot);if(i.snapshot.projectId!==project)fail('Source project mismatch.');}
  const aiTasks:NonNullable<GraphDefinition['aiTasks']>={};const configurations=i.aiConfigurations?validateAIConfigurations(i.aiConfigurations,project):undefined;
  if(configurations&&Object.keys(configurations.bindings).some(id=>!graph.nodes.some(n=>n.id===id&&n.kind==='task')))fail('AI binding must target an existing task.');
  const plans:GraphDefinition['plans']={},agents:GraphDefinition['agents']={},deploymentNodes:string[]=[];const snapshot=this.core.snapshot(project);
  for(const n of graph.nodes.filter(n=>n.kind==='task')){
   const aiBound=configurations?.bindings[n.id];
   if(aiBound){if(!this.ai)fail('AI bridge unavailable.');aiTasks[n.id]=taskAIRequest(configurations!,n,this.ai!.connections(project));}
   if(!aiBound&&!n.reference)fail('Every task needs a Protocol reference.');
   if(!aiBound){const p=n.taskType==='test'?resolveTestPlan(protocol,project,n.reference):null;plans[n.id]=p?{name:'test: '+n.reference,requirements:p.requirements,payload:planPayload(p)}:resolveProtocol(protocol,'task',n.reference);}
   const roles=graph.edges.filter(e=>e.to===n.id&&e.relation==='performs');if(roles.length!==1)fail('Each task needs exactly one responsible role.');
   if(graph.nodes.find(v=>v.id===roles[0].from)?.role==='deployment'){
    const incoming=graph.edges.filter(e=>e.to===n.id&&['success','failure'].includes(e.relation));if(incoming.length!==1||incoming[0].relation!=='success'||graph.nodes.find(v=>v.id===incoming[0].from)?.kind!=='approval')fail('Deployment requires an immediate approval predecessor, including retries.');deploymentNodes.push(n.id);
   }
   if(aiBound){agents[n.id]=[];continue;}
   if(i.snapshot)plans[n.id]=graphSourcePlan(plans[n.id],project,i.snapshot);
   validatePayload(graphActivationPlan(plans[n.id],{executionId:'preflight',activationId:'preflight',nodeId:n.id,attempt:1,revision:(previous?.revision??0)+1,sourceChecksum:i.snapshot?.checksum,snapshotId:i.snapshot?.snapshotId}).payload);
   const assigned=graph.edges.filter(e=>e.to===roles[0].from&&e.relation==='assigns').map(e=>e.from);
   const candidates=graph.nodes.filter(a=>a.kind==='agent'&&a.reference&&(assigned.includes(a.id)||graph.edges.some(e=>e.relation==='hosts'&&e.to===a.id&&assigned.includes(e.from))));
   agents[n.id]=candidates.map(a=>a.reference).filter(id=>snapshot.agents.some(a=>a.id===id));
   if(!agents[n.id].length)fail('Responsible role needs an accessible registered Agent on its declared device.');
  }
  if(!Object.keys(plans).length&&!Object.keys(aiTasks).length)fail('At least one task required.');
  for(const n of graph.nodes.filter(n=>n.kind==='task'||n.kind==='approval'))if(graph.edges.filter(e=>e.to===n.id&&e.relation==='success').length>1)fail('Multi-parent joins are not supported; use one explicit predecessor.');
  const definition:GraphDefinition={...(i.snapshot?{source:i.snapshot}:{}),deploymentNodes,projectId:project,revision:(previous?.revision??0)+1,checksum:digest(graph),inputChecksum:digest(Object.keys(aiTasks).length?[i.sources,aiTasks]:i.sources),aiTasks,graph,plans,agents,publishedAt:new Date(this.now()).toISOString()};
  validateArtifactLineage(definition);
  if(Object.values(plans).some(p=>p.payload.steps.some(s=>s.buildArtifacts))){if(!i.snapshot)fail('Build artifacts require a published workspace Snapshot.');if(!this.core.supportsBuildArtifacts())fail('Build artifact runtime is not enabled; publish did not execute or change the graph.');}
  this.commit(s=>{if(!previous&&s.definitions.length>=100)fail('Definition capacity reached.');s.definitions=s.definitions.filter(d=>d.projectId!==project).concat(definition);});
 }
 private start(project:string,input:unknown,actor:string){const i=input as {revision:number;checksum:string;entryNodeId:string;requestId:string};const d=this.state.definitions.find(d=>d.projectId===project)??fail('Publish definition first.');
  if(d.revision!==i?.revision||d.checksum!==i.checksum)fail('Definition changed; review again.');if(typeof i.requestId!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(i.requestId))fail('Invalid request identity.');
  const existing=this.state.executions.find(e=>e.id===i.requestId);if(existing){if(existing.projectId!==project||existing.revision!==d.revision||existing.inputChecksum!==d.inputChecksum||existing.definition.source?.checksum!==d.source?.checksum||existing.checksum!==d.checksum||existing.activations[0]?.nodeId!==i.entryNodeId)fail('Request identity conflict.');return;}
  const node=d.graph.nodes.find(n=>n.id===i.entryNodeId&&['task','approval'].includes(n.kind))??fail('Choose a task or approval entry.');
  if(d.graph.edges.some(e=>e.to===node.id&&e.relation==='success'))fail('Entry must be a root; approval cannot be bypassed.');
  if(this.state.executions.some(e=>e.projectId===project&&['running','paused','cancelling'].includes(e.status)))fail('Finish or cancel the active project execution first.');
  const e:GraphExecution={id:i.requestId,projectId:project,revision:d.revision,checksum:d.checksum,inputChecksum:d.inputChecksum,definition:structuredClone(d),status:'running',activations:[],actor,createdAt:new Date(this.now()).toISOString(),deadline:new Date(this.now()+600000).toISOString()};this.activate(e,node.id);
  this.commit(s=>{if(s.executions.length>=500)fail('Execution history capacity reached.');s.executions.push(e);});
 }
 private activate(e:GraphExecution,nodeId:string,approvalId?:string){const node=e.definition.graph.nodes.find(n=>n.id===nodeId)!,attempt=e.activations.filter(a=>a.nodeId===nodeId).length+1;if(attempt>Math.min(e.definition.graph.retryLimit,e.definition.aiTasks?.[nodeId]?.maximum??3)){e.status='failed';e.reason='Retry limit reached.';e.finishedAt=new Date(this.now()).toISOString();return;}if(e.definition.deploymentNodes?.includes(nodeId)&&(!approvalId||!e.activations.some(a=>a.id===approvalId&&a.approvedAt)||e.activations.some(a=>a.approvalId===approvalId))){e.status='failed';e.reason='Fresh deployment approval required.';return;}e.activations.push({id:randomUUID(),nodeId,attempt,...(approvalId?{approvalId}:{}),status:node.kind==='approval'?'approval':e.definition.aiTasks?.[nodeId]?'ai-review':'ready'});}
 private follow(e:GraphExecution,a:GraphActivation,relation:'success'|'failure'){const targets=e.definition.graph.edges.filter(v=>v.from===a.nodeId&&v.relation===relation);if(relation==='failure'&&!targets.length){e.status='failed';e.reason='Task failed without a recovery branch.';e.finishedAt=new Date(this.now()).toISOString();return;}for(const edge of targets)this.activate(e,edge.to,a.approvedAt&&e.definition.deploymentNodes?.includes(edge.to)?a.id:undefined);}
 private owner(jobId:string){const job=this.core.repository.readEntity?.('jobs',jobId)??this.core.repository.read().jobs.find(j=>j.id===jobId);return this.state.executions.find(e=>e.activations.some(a=>a.jobId===jobId||job?.idempotencyKey===`graph:${e.id}:${a.id}`));}
 owns(jobId:string){return !!this.owner(jobId);}
 /** Core-owned identity for transfer grants; Protocol env/Agent metadata cannot supply it. */
 buildArtifactOrigin(jobId:string,stepId:string):{origin:BuildArtifactOrigin;declaration:BuildArtifactDeclaration} {
  const e=this.owner(jobId);if(!e||!this.allows(jobId)||!e.definition.source||this.now()>Date.parse(e.deadline))return fail('Active graph Snapshot required for artifact transfer.');
  const snap=this.core.snapshot(e.projectId),job=snap.jobs.find(j=>j.id===jobId),run=snap.runs.find(r=>r.jobId===jobId&&activeRun(r)),step=snap.steps.find(s=>s.id===stepId&&s.runId===run?.id),a=e.activations.find(a=>a.jobId===jobId||job?.idempotencyKey===`graph:${e.id}:${a.id}`);
  const declaration=step?job?.payload.steps[step.order]?.buildArtifacts:undefined;
  if(!run||!step||step.status!=='running'||!a||!declaration||job?.cancellationRequestedAt)return fail('Artifact grant requires an active declared step.');
  if(JSON.stringify(declaration)!==JSON.stringify(e.definition.plans[a.nodeId]?.payload.steps[step.order]?.buildArtifacts))return fail('Artifact declaration differs from the published plan.');
  return {origin:{projectId:e.projectId,executionId:e.id,graphRevision:e.revision,producerActivationId:a.id,producerNodeId:a.nodeId,producerRunId:run.id,producerStepId:step.id,snapshotId:e.definition.source.snapshotId,sourceChecksum:e.definition.source.checksum},declaration:structuredClone(declaration)};
 }
 recordArtifactInstallation(jobId:string,stepId:string,receipt:ArtifactInstallationReceipt){
  const {origin,declaration}=this.buildArtifactOrigin(jobId,stepId),run=this.core.snapshot(origin.projectId).runs.find(r=>r.id===origin.producerRunId)!;
  if(receipt.consumerStepId!==stepId||receipt.consumerRunId!==run.id||receipt.agentId!==run.agentId||receipt.inputs.length!==declaration.inputs.length)fail('Artifact installation Run mismatch.');
  for(const input of declaration.inputs){const producer=this.buildArtifactProducer(jobId,stepId,input.fromTask,input.name),saved=receipt.inputs.find(i=>i.path===input.path&&i.artifact.name===input.name);if(!saved||Object.entries(producer).some(([key,expected])=>saved.artifact[key as keyof BuildArtifact]!==expected))fail('Artifact installation current producer mismatch.');}
  this.commit(s=>{const e=s.executions.find(e=>e.id===origin.executionId)!,a=e.activations.find(a=>a.id===origin.producerActivationId)!;a.runId=run.id;a.agentId=run.agentId;a.artifactInstallations=validateArtifactInstallations(e,a,[...(a.artifactInstallations??[]).filter(r=>r.consumerStepId!==stepId),receipt]);});
 }
 recordBuildArtifactOutputs(jobId:string,stepId:string,values:BuildArtifact[]){
  const {origin,declaration}=this.buildArtifactOrigin(jobId,stepId),outputs=values.map(validateBuildArtifact);
  if(outputs.length!==declaration.outputs.length||outputs.length>16||new Set(outputs.map(v=>v.name)).size!==outputs.length)return fail('Build output receipt scope mismatch.');
  for(const value of outputs)if(Object.entries(origin).some(([key,expected])=>value[key as keyof BuildArtifact]!==expected)||!declaration.outputs.some(o=>o.name===value.name&&o.path===value.path&&o.executable===value.executable))return fail('Build output receipt scope mismatch.');
  if(!outputs.length)return;
  this.commit(s=>{const execution=s.executions.find(e=>e.id===origin.executionId)!,activation=execution.activations.find(a=>a.id===origin.producerActivationId)!;
   activation.runId=origin.producerRunId;
   activation.artifactReceipts=validateArtifactReceipts(execution,activation,[...(activation.artifactReceipts??[]).filter(r=>r.stepId!==stepId),{stepId,verifiedAt:new Date(this.now()).toISOString(),outputs}]);
  });
 }
 buildArtifactProducer(jobId:string,stepId:string,fromTask:string,name:string):BuildArtifactOrigin {
  const context=this.buildArtifactOrigin(jobId,stepId);if(!context.declaration.inputs.some(i=>i.fromTask===fromTask&&i.name===name))fail('Artifact input is not declared.');
  const e=this.owner(jobId)!,consumer=e.activations.find(a=>a.id===context.origin.producerActivationId)!,producer=artifactProducerActivation(e,consumer,fromTask,name),snap=this.core.snapshot(e.projectId),job=snap.jobs.find(j=>j.id===producer.jobId),run=snap.runs.find(r=>r.id===producer.runId&&r.jobId===producer.jobId&&r.status==='passed');
  const steps=snap.steps.filter(s=>s.runId===run?.id&&s.status==='passed'&&(job?.payload.steps[s.order]?.taskReference??job?.payload.steps[s.order]?.name)===fromTask&&job?.payload.steps[s.order]?.buildArtifacts?.outputs.some(o=>o.name===name));
  if(!run||steps.length!==1)return fail('Artifact producer Run or Step is not verified.');
  return {...context.origin,producerActivationId:producer.id,producerNodeId:producer.nodeId,producerRunId:run.id,producerStepId:steps[0].id};
 }
 allows(jobId:string){const owner=this.owner(jobId);if(!owner)return true;if(owner.status!=='running')return false;try{this.authority(owner.actor,owner.projectId,'run');return true;}catch{return false;}}
 tick(){return this.locked(()=>this.advance());}
 private async advance(){for(const original of [...this.state.executions]){
  let e=this.execution(original.projectId,original.id);if(['passed','cancelled'].includes(e.status)||e.status==='failed'&&e.activations.every(terminal))continue;
  if(e.status==='paused')continue;
  if(e.status==='running')try{this.authority(e.actor,e.projectId,'run');}catch{this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='paused';x.reason='Execution authority expired or revoked.';});continue;}
  if(this.now()>Date.parse(e.deadline)&&e.status==='running')this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='cancelling';x.reason='Execution deadline reached.';});
  e=this.execution(e.projectId,e.id);
  for(const originalActivation of [...e.activations]){
   e=this.execution(e.projectId,e.id);const a=e.activations.find(v=>v.id===originalActivation.id)!;if(terminal(a))continue;
   const jobs=this.core.snapshot(e.projectId).jobs;
   // A crash after createJob but before linking is reconciled by its durable key.
   const job=a.jobId?jobs.find(j=>j.id===a.jobId):jobs.find(j=>j.idempotencyKey===`graph:${e.id}:${a.id}`);
   if(e.status==='cancelling'||e.status==='failed'){
    if(job&&['queued','assigned','running'].includes(job.status)){this.cancelJob(e.projectId,job.id);if(job.status!=='queued')continue;}
    this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.status='cancelled';delete v.waitingReasons;});continue;
   }
   if(e.status!=='running'||a.status==='approval'||['ai-review','ai-fix-review'].includes(a.status))continue;
   if(a.status==='ai-running'){if(this.now()>Date.parse(a.aiDeadline!))this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.status='failed';v.reason='AI activation timeout.';this.follow(x,v,'failure');});continue;}
   if(job){
    if(job.status==='queued')this.dispatch(e.projectId,job.id);
    const snapshot=this.core.snapshot(e.projectId),current=snapshot.jobs.find(j=>j.id===job.id)!,run=snapshot.runs.find(r=>r.jobId===job.id);
    const assigned=snapshot.agents.find(v=>v.id===current.pinnedAgentId),reasons=assigned?matchAgent(assigned,current.requirements).reasons:['Assigned Agent is no longer registered.'];
    this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!,v=x.activations.find(v=>v.id===a.id)!;v.jobId=current.id;v.runId=run?.id;v.agentId=current.pinnedAgentId;
     if(current.status==='queued')v.waitingReasons=reasons.length?[...new Set(reasons)].sort().slice(0,12):['Waiting for Core dispatch.'];else delete v.waitingReasons;
     if(current.status==='succeeded'){v.status='passed';this.follow(x,v,'success');}else if(current.status==='failed'){v.status='failed';this.follow(x,v,'failure');}else if(current.status==='cancelled'){v.status='cancelled';x.status='cancelling';}else v.status=current.status==='queued'?'queued':'running';});
    continue;
   }
   const plan=e.definition.plans[a.nodeId];if(!plan)fail('Immutable plan missing.');
   const candidates=this.core.snapshot(e.projectId).agents.filter(v=>e.definition.agents[a.nodeId].includes(v.id)),matches=candidates.map(agent=>({agent,result:matchAgent(agent,plan.requirements)}));
   const agent=matches.find(v=>v.result.matches)?.agent;
   if(!agent){
    // Core의 실제 매칭 결과만 공개한다. 현재 편집 중인 그래프나 다른 Agent로 대체하지 않는다.
    const waitingReasons=matches.length?[...new Set(matches.flatMap(v=>v.result.reasons))].sort().slice(0,12):['Assigned Agent is no longer registered.'];
    if(JSON.stringify(a.waitingReasons)!==JSON.stringify(waitingReasons))this.commit(s=>{s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!.waitingReasons=waitingReasons;});
    continue;
   }
   this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.status='launching';v.agentId=agent.id;delete v.waitingReasons;});
   const bound=graphActivationPlan(plan,{executionId:e.id,activationId:a.id,nodeId:a.nodeId,attempt:a.attempt,revision:e.revision,sourceChecksum:e.definition.source?.checksum,snapshotId:e.definition.source?.snapshotId});
   const queued=await this.core.createJob(e.projectId,{...bound,pinnedAgentId:agent.id,maxAttempts:1,idempotencyKey:`graph:${e.id}:${a.id}`},jobActor(e.actor));
   this.commit(s=>{const v=s.executions.find(v=>v.id===e.id)!.activations.find(v=>v.id===a.id)!;v.jobId=queued.id;v.status='queued';});this.dispatch(e.projectId,queued.id);
  }
  e=this.execution(e.projectId,e.id);
  if(e.status==='cancelling'&&e.activations.every(terminal))this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='cancelled';x.finishedAt=new Date(this.now()).toISOString();});
  else if(e.status==='running'&&e.activations.every(terminal))this.commit(s=>{const x=s.executions.find(v=>v.id===e.id)!;x.status='passed';x.finishedAt=new Date(this.now()).toISOString();});
 }}
 cancelActive(project:string,jobId:string){const run=this.core.snapshot(project).runs.find(r=>r.jobId===jobId&&activeRun(r));return run;}
}
