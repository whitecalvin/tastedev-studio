import type {Agent} from '../core/domain.ts';
import {matchAgent} from '../core/matcher.ts';
import type {ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';

export interface PreflightCheck {
  nodeId?:string;
  category:'configuration'|'source'|'agent'|'runtime'|'authentication'|'permission';
  state:'ready'|'blocked'|'unverified'|'review';
  message:string;
  action:'graph'|'agents'|'ai'|'tests';
  agents?:{id:string;name:string;matches:boolean;reasons:string[]}[];
}
export interface ExecutionPreflightInput {
  graph:ProjectGraph;overview:GraphOverview|null;agents:Agent[];connected:boolean;dirty:boolean;
  dirtyEditors:number;
  authentication?:Record<string,'authenticated'|'missing'|'unverified'|'failed'>;
}
/** Advisory, read-only projection of published inputs and the current registry.
 * Never grants execution authority, chooses an unrelated Agent or probes a host. */
export function executionPreflight(input:ExecutionPreflightInput) {
  const {graph,overview}=input,checks:PreflightCheck[]=[];
  const finish=()=>({projectId:graph.projectId,revision:overview?.definition?.revision,
    ready:checks.every(c=>c.state==='ready'||c.state==='review'),checks,executionAuthorized:false as const});
  if(!input.connected){checks.push({category:'configuration',state:'blocked',message:'Connect to Core in Agents.',action:'agents'});return finish();}
  const d=overview?.definition;
  if(!d||d.projectId!==graph.projectId||input.dirty||JSON.stringify(d.graph)!==JSON.stringify(graph)){
    checks.push({category:'configuration',state:'blocked',message:'Review and publish the saved graph and Source.',action:'graph'});return finish();
  }
  checks.push({category:'configuration',state:input.dirtyEditors?'blocked':'ready',message:input.dirtyEditors?'Save current edits before preparing execution.':'No unsaved editor changes.',action:'graph'});
  checks.push({category:'source',state:d.source?'ready':'unverified',message:d.source?'Published Source is available.':'Protocol Source / Agent workspace',action:'graph'});
  for(const node of graph.nodes.filter(n=>n.kind==='task')){
    const route=d.aiTasks?.[node.id]?.route;
    if(route){
      const auth=input.authentication?.[node.id];
      checks.push({nodeId:node.id,category:'authentication',state:auth==='authenticated'?'ready':auth==='missing'||auth==='failed'?'blocked':'unverified',message:auth==='authenticated'?'AI authentication is available.':auth==='missing'?'AI authentication required.':'Check the selected AI connection before execution.',action:'ai'});
    }else{
      const assigned=new Set(d.agents[node.id]??[]),requirement=d.requirements?.[node.id];
      const candidates=input.agents.filter(a=>assigned.has(a.id));
      const available=candidates.some(a=>a.status==='idle'||a.status==='online');
      checks.push({nodeId:node.id,category:'agent',state:available?'ready':'blocked',message:available?'Assigned Agent is available.':candidates.length?'Agent is unavailable.':'The responsible role has no registered Agent.',action:'agents'});
      const matches=requirement?candidates.map(agent=>({id:agent.id,name:agent.name,...matchAgent(agent,requirement)})):[];
      checks.push({nodeId:node.id,category:'runtime',state:!requirement?'unverified':matches.some(a=>a.matches)?'ready':'blocked',message:matches.some(a=>a.matches)?'Agent capabilities match the selected test.':'Review the test runtime requirements on the selected Agent.',action:'agents',agents:matches});
      if(node.frameworkTask?.mode==='claude-code')checks.push({nodeId:node.id,category:'authentication',state:'unverified',message:'Native authentication must be checked on the execution device.',action:'agents'});
    }
    checks.push({nodeId:node.id,category:'permission',state:'review',message:'Review execution scope',action:'graph'});
  }
  return finish();
}
