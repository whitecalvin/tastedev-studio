import type {AnalysisRecord} from '../ai/domain.ts';
import type {GraphActivation,GraphExecution,GraphOverview} from './execution.ts';
/** Navigation identity carries no lease or execution authority. */
export interface GraphReviewLocation {projectId:string;executionId:string;activationId:string;nodeId:string;analysisId:string}
/** Restored history supplies a bookmark only; Core must still resolve its exact activation. */
export function analysisReviewLocation(project:string,record:AnalysisRecord):GraphReviewLocation|null {
 const graph=record.task?.graph;
 if(record.projectId!==project||!graph||[project,record.id,record.task?.nodeId,graph.executionId,graph.activationId].some(value=>typeof value!=='string'||!value.trim()||value.length>200))return null;
 return {projectId:project,executionId:graph.executionId,activationId:graph.activationId,nodeId:record.task!.nodeId,analysisId:record.id};
}
export function graphReviewLocation(project:string,e:Pick<GraphExecution,'id'|'projectId'>,a:GraphActivation,record?:AnalysisRecord):GraphReviewLocation {
 if(e.projectId!==project||!a.analysisId)throw Error('Graph review project or analysis mismatch.');
 if(record&&(record.projectId!==project||record.id!==a.analysisId||record.task?.nodeId!==a.nodeId||record.task.graph?.executionId!==e.id||record.task.graph.activationId!==a.id||record.task.graph.leaseId!==a.leaseId))throw Error('Graph review analysis mismatch.');
 return {projectId:project,executionId:e.id,activationId:a.id,nodeId:a.nodeId,analysisId:a.analysisId};
}
export function resolveReviewReturn(location:GraphReviewLocation,project:string,overview:GraphOverview|null){
 if(location.projectId!==project)return 'unavailable';
 if(!overview)return 'loading';
 const e=overview.executions.find(e=>e.projectId===project&&e.id===location.executionId),a=e?.activations.find(a=>a.id===location.activationId);
 return a?.nodeId===location.nodeId&&a.analysisId===location.analysisId?'ready':'unavailable';
}
