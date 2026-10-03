import type {CreateJob} from '../core/service.ts';
import {planPayload,type TestPlan} from '../core/test-plan.ts';
import type {WorkspaceSnapshot} from '../ai/snapshot.ts';
import {withWorkspaceSnapshot} from '../protocol/workspace-test.ts';
/** Use the existing TestOrchestrator even for a single Protocol Task, so source
 * preparation and bounded cleanup run through the same Agent pipeline. */
export function graphSourcePlan(input:CreateJob,projectId:string,snapshot:WorkspaceSnapshot):CreateJob {
 const plan:TestPlan=input.payload.testPlan??{id:crypto.randomUUID(),projectId,testName:input.payload.task,type:'unit',requirements:input.requirements,environment:input.payload.steps[0].env??{},timeout:Math.min(3600000,(input.payload.steps[0].timeoutMs??60000)+120000),steps:[{...input.payload.steps[0],stage:'test'},{name:'Cleanup',stage:'cleanup',executable:'internal-stop-services',args:[],cwd:'.',timeoutMs:10000}]};
 const sourced=withWorkspaceSnapshot(plan,snapshot);return {...input,requirements:sourced.requirements,payload:planPayload(sourced)};
}
/** Core supplies identity; a Protocol environment override cannot spoof it. */
export function graphActivationPlan(input:CreateJob,identity:{executionId:string;activationId:string;nodeId:string;attempt:number;revision:number;sourceChecksum?:string;snapshotId?:string}):CreateJob {
 const payload=structuredClone(input.payload),context=JSON.stringify(identity);
 payload.steps=payload.steps.map(step=>({...step,env:{...step.env,TASTEDEV_GRAPH_CONTEXT:context}}));
 if(payload.testPlan)payload.testPlan={...payload.testPlan,steps:payload.steps};
 return {...input,payload};
}
