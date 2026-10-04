import type {ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';
export type GraphConfigurationState='unpublished'|'unsaved'|'graph-changed'|'ai-changed'|'ready';
/** Readiness applies to new execution; historical review retains its own immutable identity. */
export function graphConfigurationState(definition:GraphOverview['definition'],graph:ProjectGraph,aiMatches:boolean,dirty:boolean):GraphConfigurationState {
 if(!definition)return 'unpublished';
 if(dirty)return 'unsaved';
 if(definition.projectId!==graph.projectId||JSON.stringify(definition.graph)!==JSON.stringify(graph))return 'graph-changed';
 return aiMatches?'ready':'ai-changed';
}
export const configurationMessages:Record<GraphConfigurationState,string>={
 unpublished:'Publish a saved graph before starting a new execution.',
 unsaved:'Save graph changes before publishing a new execution configuration.',
 'graph-changed':'The local graph differs from the published configuration. Review and publish before starting a new execution.',
 'ai-changed':'AI configuration changed. Publish again before starting.',
 ready:'The local configuration matches the published version. Review and approve before starting a new execution.'
};
