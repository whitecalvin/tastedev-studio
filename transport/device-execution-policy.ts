import {validateDevicePolicy,deviceAgentIds,devicePolicyReasons,type DevicePolicy,type DevicePolicyOverview} from '../src/features/orchestration/device-execution-policy.ts';
import type {GraphDefinition} from '../src/features/orchestration/execution.ts';
import type {Agent,Job,Run} from '../src/features/core/domain.ts';
import type {Role} from '../src/features/orchestration/domain.ts';
import type {GraphPersistence} from './graph-execution.ts';
interface State {version:1;projects:{projectId:string;revision:number;policy:DevicePolicy}[]}
export class DevicePolicies {
 private state:State={version:1,projects:[]};
 private graph:(project:string)=>Omit<GraphDefinition,'plans'>|null;private authority:(actor:string,project:string,action:'read'|'approve')=>void;private persistence?:GraphPersistence;private now:()=>number;
 constructor(graph:(project:string)=>Omit<GraphDefinition,'plans'>|null,authority:(actor:string,project:string,action:'read'|'approve')=>void,persistence?:GraphPersistence,now=Date.now){this.graph=graph;this.authority=authority;this.persistence=persistence;this.now=now;const saved=persistence?.load() as State|undefined;if(saved){if(saved.version!==1||!Array.isArray(saved.projects)||saved.projects.length>500||new Set(saved.projects.map(p=>p.projectId)).size!==saved.projects.length)throw Error('Invalid saved device policies; preserved.');for(const row of saved.projects){if(!row.projectId||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('Invalid saved device policy; preserved.');validateDevicePolicy(row.policy);}this.state=structuredClone(saved);}}
 request(project:string,action:string,input:unknown,actor:string):DevicePolicyOverview {
  this.authority(actor,project,action==='list'?'read':'approve');const row=this.state.projects.find(p=>p.projectId===project),d=this.graph(project);
  if(action==='save'){const i=input as {revision:number;policy:unknown};if(i?.revision!==(row?.revision??0))throw Error('Device policy changed. Refresh first.');const policy=validateDevicePolicy(i.policy);if(!d||d.revision!==policy.graphRevision||d.checksum!==policy.graphChecksum||policy.rules.some(r=>!d.graph.nodes.some(n=>n.id===r.deviceId&&n.kind==='device')))throw Error('Review the current published devices first.');const next=structuredClone(this.state),entry={projectId:project,revision:(row?.revision??0)+1,policy};next.projects=next.projects.filter(p=>p.projectId!==project);next.projects.push(entry);if(next.projects.length>500)throw Error('Device policy capacity reached.');this.persistence?.save(next);this.state=next;
  }else if(action!=='list')throw Error('Unknown device policy action.');
  const current=this.state.projects.find(p=>p.projectId===project);return{revision:current?.revision??0,durable:!!this.persistence,policy:current?structuredClone(current.policy):null,graphRevision:d?.revision??0,graphChecksum:d?.checksum??'',devices:d?.graph.nodes.filter(n=>n.kind==='device').map(n=>({id:n.id,label:n.label,agentIds:deviceAgentIds(d.graph,n.id)}))??[]};
 }
 reasons(job:Job,agent:Agent,runs:Run[],role:Role){const d=this.graph(job.projectId);return devicePolicyReasons(this.state.projects.find(p=>p.projectId===job.projectId)?.policy??null,d?.graph??null,d?.revision??0,d?.checksum??'',job,agent,runs,role,this.now());}
}

export function deviceWorkRole(d:Omit<GraphDefinition,'plans'>|null,nodeId:string|undefined,job:Job):Role{if(nodeId&&d){if(d.deploymentNodes?.includes(nodeId))return 'deployment';const edge=d.graph.edges.find(e=>e.to===nodeId&&e.relation==='performs'),responsible=edge&&d.graph.nodes.find(n=>n.id===edge.from&&n.kind==='role');if(responsible)return responsible.role;}return job.payload.testPlan?'testing':'implementation';}
