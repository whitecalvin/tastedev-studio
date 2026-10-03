import type {CoreStore} from './storage.ts';
import type {GraphDefinition} from '../src/features/orchestration/execution.ts';
/** A published but not yet launched graph is still an owner of its Source. */
export function graphSourceReferences(store:Pick<CoreStore,'get'>){
 const state=store.get<{definitions:GraphDefinition[];executions:{projectId:string;definition:GraphDefinition}[]}>('node-orchestration');
 if(!state)return[];
 if(!Array.isArray(state.definitions)||!Array.isArray(state.executions))throw Error('Graph Source state is invalid.');
 return [...state.definitions,...state.executions.map(e=>e.definition)].flatMap(d=>Object.values(d.plans).map(plan=>({projectId:d.projectId,payload:plan.payload})));
}
