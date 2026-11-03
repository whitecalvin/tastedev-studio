import type {GraphDefinition} from './execution.ts';
import {validateExecutionIsolation,type ExecutionIsolation} from '../process/isolation.ts';
export type IsolationReview=Record<string,{step:string;policy:ExecutionIsolation}[]>;
/** Expose the immutable execution permission scope, never arguments/env/grants. */
export function isolationReview(definition:Pick<GraphDefinition,'plans'>):IsolationReview {
 return Object.fromEntries(Object.entries(definition.plans).flatMap(([node,plan])=>{
  const steps=plan.payload.steps.filter(step=>step.isolation).map(step=>({step:step.name,policy:validateExecutionIsolation(step.isolation)}));
  return steps.length?[[node,steps]]:[];
 }));
}
