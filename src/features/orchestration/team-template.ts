import {newNode, validateGraph, teamRoles, type ProjectGraph, type TeamRole} from './domain.ts';
import {newAIConfiguration, validateAIConfigurations, type AIConfigurationStore} from './ai-config.ts';

export const teamRoleLabels: Record<TeamRole,string> = {leader:'Team lead',design:'Design',implementation:'Implementation',review:'Independent review',documentation:'Documentation'};
const instructions: Record<TeamRole,string> = {
  leader:'Read the objective, exclusions and acceptance criteria. Propose bounded work and dependencies. Explain assignment and waiting reasons. Planning is not permission to edit source or publish.',
  design:'Inspect the project context and propose a design with constraints and acceptance criteria. Return reviewable evidence. Do not modify source or execute commands.',
  implementation:'Implement only the approved work contract using the existing proposal, scoped patch approval and Protocol validation workflow. Require actual test evidence. Never commit, publish or deploy.',
  review:'Independently inspect every changed file and actual test evidence. Report defects and uncertainty. Do not modify source. Analysis completion is not acceptance.',
  documentation:'Inspect the actual implementation and evidence. Propose accurate user documentation and release notes. Distinguish unverified behavior. Do not modify source or publish.',
};

/** Additive draft only. Device, executor, responsibility and model identity remain distinct. */
export function teamTemplate(graph:ProjectGraph,configurations:AIConfigurationStore,prefix:string){
  if(graph.projectId!==configurations.projectId||!/^[a-zA-Z0-9_-]{1,50}$/.test(prefix)||graph.nodes.some(n=>n.teamRole)||configurations.profiles.length>25)throw Error('Team template cannot replace an existing team or exceed capacity.');
  const next=structuredClone(graph),profiles=[...configurations.profiles],bindings={...configurations.bindings};
  const device=next.nodes.find(n=>n.kind==='device')??{...newNode('device',`${prefix}-device`,0),label:'Current PC'};
  if(!next.nodes.includes(device))next.nodes.push(device);
  const occupied=next.nodes.map(n=>({x:n.x,y:n.y}));
  const clear=(x:number,y:number)=>!occupied.some(n=>x<n.x+240&&x+240>n.x&&y<n.y+200&&y+200>n.y);
  let agentY=460;while(!clear(40,agentY))agentY+=210;
  const agent={...newNode('agent',`${prefix}-agent`,0),label:'Team execution Agent',x:40,y:agentY};occupied.push(agent);
  const rows=new Map<TeamRole,number>();let nextY=40;
  for(const role of teamRoles){while(!clear(400,nextY)||!clear(740,nextY))nextY+=210;rows.set(role,nextY);occupied.push({x:400,y:nextY},{x:740,y:nextY});nextY+=210;}
  next.nodes.push(agent);next.edges.push({id:`${prefix}-host`,from:device.id,to:agent.id,relation:'hosts'});
  // Implementation and final review form the existing factory chain. Consultative roles stay explicit.
  const ordered:TeamRole[]=['implementation','review','leader','design','documentation'];
  for(const role of ordered){
    const y=rows.get(role)!,executionRole=role==='review'?'testing' as const:'implementation' as const;
    const responsibility={...newNode('role',`${prefix}-${role}-role`,0),label:teamRoleLabels[role],role:executionRole,teamRole:role,x:400,y};
    const task={...newNode('task',`${prefix}-${role}`,0),label:teamRoleLabels[role],role:executionRole,teamRole:role,x:740,y};
    const profile={...newAIConfiguration(`${prefix}-${role}-ai`),name:teamRoleLabels[role],role:role==='leader'||role==='documentation'?'analysis' as const:role==='review'?'review' as const:role==='design'?'design' as const:'implementation' as const,completion:role==='implementation'?'verified-fix' as const:'analysis' as const,prompt:instructions[role]};
    next.nodes.push(responsibility,task);
    next.edges.push({id:`${prefix}-${role}-assign`,from:agent.id,to:responsibility.id,relation:'assigns'},{id:`${prefix}-${role}-perform`,from:responsibility.id,to:task.id,relation:'performs'});
    profiles.push(profile);bindings[task.id]=profile.id;
  }
  next.edges.push({id:`${prefix}-review-chain`,from:`${prefix}-implementation`,to:`${prefix}-review`,relation:'success'});
  return{graph:validateGraph(next,graph.projectId),configurations:validateAIConfigurations({...configurations,profiles,bindings},graph.projectId)};
}
