import type {GraphDefinition} from './execution.ts';
import {validateBuildArtifactDeclaration,type BuildArtifactDeclaration} from './build-artifact.ts';

export interface GraphArtifactPlan extends BuildArtifactDeclaration {stepName:string;taskReference:string}
/** Public read-only projection. Environment, command arguments and transfer grants stay server-side. */
export function graphArtifactPlans(definition:Pick<GraphDefinition,'plans'>):Record<string,GraphArtifactPlan[]> {
 const result:Record<string,GraphArtifactPlan[]>={};
 for(const [nodeId,plan] of Object.entries(definition.plans)){
  const rows=plan.payload.steps.filter(s=>s.buildArtifacts).map(step=>({stepName:step.name,taskReference:step.taskReference??step.name,...validateBuildArtifactDeclaration(step.buildArtifacts)}));
  if(rows.length)result[nodeId]=rows;
 }
 return result;
}
