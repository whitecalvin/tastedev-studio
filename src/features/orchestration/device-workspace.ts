import type {Agent,Job,Platform} from '../core/domain.ts';

/** A binding selects the Agent's existing managed Run workspace. It never
 * accepts host paths, copies credentials, or remaps a running workspace. */
export interface DeviceWorkspaceBinding {agentId:string;platform:Platform;source:'snapshot'|'git'}
export function validateDeviceWorkspaces(value:unknown):DeviceWorkspaceBinding[]{
  if(!Array.isArray(value)||!value.length||value.length>60)throw Error('Invalid Agent workspace bindings.');
  const ids=new Set<string>();
  for(const item of value){
    if(!item||typeof item!=='object'||Object.keys(item).some(k=>!['agentId','platform','source'].includes(k))||typeof item.agentId!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(item.agentId)||ids.has(item.agentId)||!['windows','linux','macos'].includes(item.platform)||!['snapshot','git'].includes(item.source))throw Error('Invalid Agent workspace bindings.');
    ids.add(item.agentId);
  }
  return structuredClone(value);
}
export function deviceWorkspaceReason(bindings:DeviceWorkspaceBinding[]|undefined,job:Job,agent:Agent):string|null{
  if(bindings===undefined)return null; // Preserve existing policies until explicit review.
  const binding=bindings.find(b=>b.agentId===agent.id);
  if(!binding)return 'Agent workspace binding missing';
  if(binding.platform!==agent.platform)return 'Agent workspace OS mismatch';
  const sources=job.payload.steps.flatMap(s=>s.source?[s.source]:[]);
  if(sources.length!==1||sources[0].provider!==binding.source)return 'Workspace Source mismatch';
  return null;
}
