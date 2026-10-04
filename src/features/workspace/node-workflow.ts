import type {GraphNode,ProjectGraph} from '../orchestration/domain.ts';
import type {graphMonitor} from '../orchestration/monitor.ts';
import type {GraphReviewLocation} from '../orchestration/review-navigation.ts';
import type {AnalysisRecord} from '../ai/domain.ts';

/** Navigation context only. No approval, lease, command or execution authority. */
export interface NodeWorkflowContext {
 projectId:string;nodeId:string;label:string;kind:GraphNode['kind'];taskType:GraphNode['taskType'];reference:string;
 executionId?:string;activationId?:string;runId?:string;analysisId?:string;status?:string;compatible:boolean;
}
export function nodeWorkflowContext(graph:ProjectGraph,nodeId:string,monitor:ReturnType<typeof graphMonitor>,review:GraphReviewLocation|null):NodeWorkflowContext|null {
 const node=graph.nodes.find(n=>n.id===nodeId);if(!node)return null;
 const exactReview=review?.projectId===graph.projectId&&review.nodeId===nodeId&&review.executionId===monitor.execution?.id;
 const activation=monitor.compatible?(exactReview?monitor.execution?.activations.find(a=>a.id===review.activationId&&a.nodeId===nodeId):monitor.nodes.get(nodeId)):undefined;
 return {projectId:graph.projectId,nodeId,label:node.label,kind:node.kind,taskType:node.taskType,reference:node.reference,compatible:monitor.compatible,executionId:monitor.execution?.id,activationId:activation?.id,runId:activation?.runId,analysisId:activation?.analysisId,status:activation?.status};
}
export function workflowAnalysis(context:NodeWorkflowContext|null,records:AnalysisRecord[]):AnalysisRecord|undefined {
 if(!context?.compatible||!context.activationId||!context.analysisId)return undefined;
 return records.find(r=>r.projectId===context.projectId&&r.id===context.analysisId&&r.task?.nodeId===context.nodeId&&r.task.graph?.executionId===context.executionId&&r.task.graph?.activationId===context.activationId);
}
