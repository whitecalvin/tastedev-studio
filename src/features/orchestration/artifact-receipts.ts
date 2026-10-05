import {validateBuildArtifact,type BuildArtifact} from './build-artifact.ts';
import type {GraphExecution,GraphActivation} from './execution.ts';
export interface GraphArtifactReceipt {stepId:string;verifiedAt:string;outputs:BuildArtifact[]}
/** A historical receipt proves a Core verification at that time, not current blob availability. */
export function validateArtifactReceipts(execution:GraphExecution,activation:GraphActivation,value:unknown):GraphArtifactReceipt[]{
 if(!Array.isArray(value)||value.length>200)throw Error('Invalid graph artifact receipts.');
 const seen=new Set<string>();
 return value.map(raw=>{
  const r=raw as GraphArtifactReceipt;if(!r||typeof r.stepId!=='string'||seen.has(r.stepId)||typeof r.verifiedAt!=='string'||r.verifiedAt.length>40||!Number.isFinite(Date.parse(r.verifiedAt))||!Array.isArray(r.outputs)||!r.outputs.length||r.outputs.length>16)throw Error('Invalid graph artifact receipt.');seen.add(r.stepId);
  const outputs=r.outputs.map(validateBuildArtifact),source=execution.definition.source;
  for(const artifact of outputs)if(artifact.projectId!==execution.projectId||artifact.executionId!==execution.id||artifact.graphRevision!==execution.revision||artifact.producerActivationId!==activation.id||artifact.producerNodeId!==activation.nodeId||artifact.producerRunId!==activation.runId||artifact.producerStepId!==r.stepId||!source||artifact.snapshotId!==source.snapshotId||artifact.sourceChecksum!==source.checksum||!execution.definition.plans[activation.nodeId]?.payload.steps.some(step=>step.buildArtifacts?.outputs.some(o=>o.name===artifact.name&&o.path===artifact.path&&o.executable===artifact.executable)))throw Error('Graph artifact receipt identity mismatch.');
  if(new Set(outputs.map(o=>o.id)).size!==outputs.length)throw Error('Duplicate graph artifact receipt output.');
  return{stepId:r.stepId,verifiedAt:r.verifiedAt,outputs};
 });
}
