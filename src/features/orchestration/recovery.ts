import type {GraphDefinition,GraphExecution} from './execution.ts';

/** 완료 기록을 재작성하지 않는다. 변경된 입력은 새 실행으로 검토해야 한다. */
export function recoveryPlan(execution:Omit<GraphExecution,'definition'>&{source?:GraphDefinition['source'];definition?:Pick<GraphDefinition,'source'>},definition:Pick<GraphDefinition,'projectId'|'revision'|'checksum'|'inputChecksum'|'source'>|null,now=Date.now()) {
 const source=execution.source??execution.definition?.source;
 let adopted=false;const chain=execution.sourceAdoptions;if(definition?.source&&source&&chain?.length&&chain.length<=30){let id=definition.source.snapshotId,checksum=definition.source.checksum;adopted=true;for(const item of chain){if(item.fromSnapshotId!==id||item.fromChecksum!==checksum||!/^[a-f0-9]{64}$/.test(item.checksum)||!item.actor||!Number.isFinite(Date.parse(item.approvedAt))||!execution.activations.some(a=>a.id===item.activationId&&a.status==='passed'&&a.fixAttemptId)){adopted=false;break;}id=item.toSnapshotId;checksum=item.checksum;}adopted=adopted&&id===source.snapshotId&&checksum===source.checksum;}
 const current=!!definition&&definition.projectId===execution.projectId&&definition.revision===execution.revision&&definition.checksum===execution.checksum&&definition.inputChecksum===execution.inputChecksum&&(definition.source?.snapshotId===source?.snapshotId&&definition.source?.checksum===source?.checksum||adopted);
 const blocked=!current?'Review the saved graph version before continuing.':(!Number.isFinite(Date.parse(execution.deadline))||now>=Date.parse(execution.deadline))?'This execution is already finished.':execution.status!=='paused'?'Only paused execution can resume.':null;
 return {blocked,retained:execution.activations.filter(a=>a.status==='passed'),pending:execution.activations.filter(a=>!['passed','failed','cancelled'].includes(a.status)),failed:execution.activations.filter(a=>a.status==='failed')};
}

/** Latest attempts guide recovery; completed history is retained without replay. */
export function recoveryChecklist(execution:Omit<GraphExecution,'definition'>){const latest=new Map<string,GraphExecution['activations'][number]>();for(const a of execution.activations){const before=latest.get(a.nodeId);if(!before||a.attempt>=before.attempt)latest.set(a.nodeId,a);}return [...latest.values()].map(a=>({nodeId:a.nodeId,attempt:a.attempt,activationId:a.id,runId:a.runId,status:a.status,fixAttemptId:a.fixAttemptId,message:a.status==='passed'?'Keep successful results':a.status==='failed'?'Retry failed gate':a.status==='approval'?'Approve this activation':a.status==='ai-fix-review'?'Review graph fix proposal':a.status==='ai-review'?'Run independent review':a.runId?'Open Run':'Review execution scope'}));}

/** Explicit retry keeps passed nodes; deployment always returns to a fresh approval. */
export function retryPlan(execution:Parameters<typeof recoveryPlan>[0],definition:Omit<GraphDefinition,'plans'>|null,nodeId:string,now=Date.now()){
 const identity=recoveryPlan({...execution,status:'paused'},definition,now);
 if(identity.blocked)return {blocked:identity.blocked,target:nodeId};
 const latest=execution.activations.filter(a=>a.nodeId===nodeId).at(-1);
 if(execution.status!=='failed'||!latest||latest.status!=='failed'||execution.activations.some(a=>!['passed','failed','cancelled'].includes(a.status)))return {blocked:'Review an unexpired failed activation before retrying.',target:nodeId};
 const target=definition!.deploymentNodes?.includes(nodeId)?definition!.graph.edges.find(e=>e.to===nodeId&&e.relation==='success')?.from:nodeId;
 if(!target||definition!.deploymentNodes?.includes(nodeId)&&definition!.graph.nodes.find(n=>n.id===target)?.kind!=='approval')return {blocked:'Fresh deployment approval required.',target:nodeId};
 if([nodeId,target].some(id=>execution.activations.filter(a=>a.nodeId===id).length>=definition!.graph.retryLimit))return {blocked:'Retry limit reached.',target};
 return {blocked:null,target};
}
