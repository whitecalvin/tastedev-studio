import {buildArtifactPath,validateBuildArtifact,type BuildArtifact} from './build-artifact.ts';
import type {GraphExecution,GraphActivation} from './execution.ts';

/** Agent reports only installed bytes. Core supplies all execution and producer identities. */
export interface ArtifactInstallationReport {id:string;path:string;size:number;checksum:string;executable?:boolean}
export interface ArtifactInstallationScope {
 projectId:string;executionId:string;graphRevision:number;snapshotId:string;sourceChecksum:string;
 consumerActivationId:string;consumerNodeId:string;consumerRunId:string;consumerStepId:string;agentId:string;
 inputs:{path:string;artifact:BuildArtifact}[];
}
export interface ArtifactInstallationReceipt {
 version:1;projectId:string;executionId:string;graphRevision:number;
 consumerActivationId:string;consumerNodeId:string;consumerRunId:string;consumerStepId:string;agentId:string;
 verifiedAt:string;inputs:{path:string;artifact:BuildArtifact}[];
}

/** Exact-set validation: partial installation is never represented as a completed receipt. */
export function verifyArtifactInstallation(value:unknown,scope:ArtifactInstallationScope,verifiedAt:string):ArtifactInstallationReceipt {
 const identity=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
 if(!scope||!['projectId','executionId','consumerActivationId','consumerNodeId','consumerRunId','consumerStepId','agentId','snapshotId'].every(k=>identity(scope[k as keyof ArtifactInstallationScope]))||!Number.isSafeInteger(scope.graphRevision)||scope.graphRevision<1||!Array.isArray(scope.inputs)||!scope.inputs.length||scope.inputs.length>16||typeof verifiedAt!=='string'||verifiedAt.length>40||!Number.isFinite(Date.parse(verifiedAt)))throw Error('Invalid artifact installation scope.');
 const expected=scope.inputs.map(i=>({path:buildArtifactPath(i.path),artifact:validateBuildArtifact(i.artifact)}));
 if(new Set(expected.map(i=>i.path.toLowerCase())).size!==expected.length||new Set(expected.map(i=>i.artifact.id)).size!==expected.length)throw Error('Duplicate artifact installation scope.');
 for(const {artifact} of expected)if(artifact.projectId!==scope.projectId||artifact.executionId!==scope.executionId||artifact.graphRevision!==scope.graphRevision||artifact.snapshotId!==scope.snapshotId||artifact.sourceChecksum!==scope.sourceChecksum)throw Error('Artifact installation producer scope mismatch.');
 if(!Array.isArray(value)||value.length!==expected.length)throw Error('Incomplete artifact installation report.');
 const reports=value as ArtifactInstallationReport[],seen=new Set<string>();
 for(const r of reports){
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['id','path','size','checksum','executable'].includes(k))||!identity(r.id)||seen.has(r.id))throw Error('Invalid artifact installation report.');
  seen.add(r.id);const target=expected.find(i=>i.artifact.id===r.id);
  if(!target||buildArtifactPath(r.path)!==target.path||r.size!==target.artifact.size||r.checksum!==target.artifact.checksum||r.executable!==target.artifact.executable)throw Error('Artifact installation report mismatch.');
 }
 return {version:1,projectId:scope.projectId,executionId:scope.executionId,graphRevision:scope.graphRevision,consumerActivationId:scope.consumerActivationId,consumerNodeId:scope.consumerNodeId,consumerRunId:scope.consumerRunId,consumerStepId:scope.consumerStepId,agentId:scope.agentId,verifiedAt,inputs:expected};
}

/** Restore uses captured plans and persisted producer receipts, never current edited plans. */
export function validateArtifactInstallations(execution:GraphExecution,activation:GraphActivation,value:unknown):ArtifactInstallationReceipt[] {
 if(!Array.isArray(value)||value.length>200||!execution.definition.source)throw Error('Invalid durable artifact installations.');
 const source=execution.definition.source,steps=new Set<string>();
 return value.map(raw=>{
  const r=raw as ArtifactInstallationReceipt;
  if(!r||r.version!==1||r.projectId!==execution.projectId||r.executionId!==execution.id||r.graphRevision!==execution.revision||r.consumerActivationId!==activation.id||r.consumerNodeId!==activation.nodeId||r.consumerRunId!==activation.runId||r.agentId!==activation.agentId||steps.has(r.consumerStepId)||!Array.isArray(r.inputs))throw Error('Artifact installation consumer identity mismatch.');
  steps.add(r.consumerStepId);
  const receipt=verifyArtifactInstallation(r.inputs.map(i=>({id:i.artifact?.id,path:i.path,size:i.artifact?.size,checksum:i.artifact?.checksum,...(i.artifact?.executable!==undefined?{executable:i.artifact.executable}:{})})),{...r,snapshotId:source.snapshotId,sourceChecksum:source.checksum},r.verifiedAt);
  const plan=execution.definition.plans[activation.nodeId];
  if(!plan?.payload.steps.some(s=>s.buildArtifacts?.inputs.length===receipt.inputs.length&&receipt.inputs.every(i=>s.buildArtifacts!.inputs.some(d=>d.path===i.path&&d.name===i.artifact.name&&execution.definition.plans[i.artifact.producerNodeId]?.payload.steps.some(p=>(p.taskReference??p.name)===d.fromTask&&p.buildArtifacts?.outputs.some(o=>o.name===d.name&&o.path===i.artifact.path&&o.executable===i.artifact.executable))))))throw Error('Artifact installation declaration mismatch.');
  for(const input of receipt.inputs){const producer=execution.activations.find(a=>a.id===input.artifact.producerActivationId&&a.nodeId===input.artifact.producerNodeId&&a.runId===input.artifact.producerRunId);
   if(!producer?.artifactReceipts?.some(r=>r.stepId===input.artifact.producerStepId&&r.outputs.some(o=>JSON.stringify(validateBuildArtifact(o))===JSON.stringify(input.artifact))))throw Error('Artifact installation producer receipt missing.');
  }
  return receipt;
 });
}
