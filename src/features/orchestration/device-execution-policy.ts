import type {Agent,Job,Run,Platform} from '../core/domain.ts';
import {activeRun} from '../core/domain.ts';
import type {ProjectGraph,Role} from './domain.ts';
export interface DeviceRule {deviceId:string;roles:Role[];enabled:boolean;maximumConcurrent:number;platform?:Platform;availability?:{timezone:string;days:number[];startMinute:number;endMinute:number}}
export interface DevicePolicy {graphRevision:number;graphChecksum:string;rules:DeviceRule[]}
export interface DevicePolicyOverview {revision:number;durable:boolean;policy:DevicePolicy|null;graphRevision:number;graphChecksum:string;devices:{id:string;label:string;agentIds:string[]}[]}
export function validateDevicePolicy(value:unknown):DevicePolicy {
 const p=value as DevicePolicy;
 const closed=(v:unknown,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
 if(!closed(p,['graphRevision','graphChecksum','rules'])||!p||!Number.isSafeInteger(p.graphRevision)||p.graphRevision<1||! /^[a-f0-9]{64}$/.test(p.graphChecksum)||!Array.isArray(p.rules)||p.rules.length>60||new Set(p.rules.map(r=>r?.deviceId)).size!==p.rules.length)throw Error('Invalid device execution policy.');
 for(const r of p.rules){if(!closed(r,['deviceId','roles','enabled','maximumConcurrent','platform','availability'])||!r||! /^[A-Za-z0-9_-]{1,120}$/.test(r.deviceId)||typeof r.enabled!=='boolean'||!Number.isInteger(r.maximumConcurrent)||r.maximumConcurrent<1||r.maximumConcurrent>8||!Array.isArray(r.roles)||!r.roles.length||new Set(r.roles).size!==r.roles.length||r.roles.some(v=>!['implementation','deployment','testing'].includes(v))||r.platform!==undefined&&!['windows','linux','macos'].includes(r.platform))throw Error('Invalid device execution policy.');
 if(r.availability!==undefined){const a=r.availability;if(!closed(a,['timezone','days','startMinute','endMinute'])||!a||typeof a.timezone!=='string'||a.timezone.length>100||!Array.isArray(a.days)||!a.days.length||a.days.length>7||new Set(a.days).size!==a.days.length||a.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!Number.isInteger(a.startMinute)||!Number.isInteger(a.endMinute)||a.startMinute<0||a.endMinute>1440||a.startMinute>=a.endMinute)throw Error('Invalid availability window.');new Intl.DateTimeFormat('en',{timeZone:a.timezone}).format(0);}}
 return structuredClone(p);
}
export function deviceAgentIds(graph:ProjectGraph,deviceId:string){return graph.edges.filter(e=>e.from===deviceId&&e.relation==='hosts').map(e=>graph.nodes.find(n=>n.id===e.to&&n.kind==='agent')?.reference).filter((v):v is string=>!!v);}
export function devicePolicyReasons(policy:DevicePolicy|null,graph:ProjectGraph|null,revision:number,checksum:string,job:Job,agent:Agent,runs:Run[],role:Role,now=Date.now()){
 if(!policy||!policy.rules.length)return [];
 if(!graph||policy.graphRevision!==revision||policy.graphChecksum!==checksum)return ['Device policy requires graph review'];
 const candidates=policy.rules.filter(r=>deviceAgentIds(graph,r.deviceId).includes(agent.id));
 if(!candidates.length)return ['Agent has no approved device assignment'];
 const reasons=candidates.map(r=>{if(!r.enabled)return 'Device execution is paused';if(!r.roles.includes(role))return 'Device role is not approved';if(r.platform&&agent.platform!==r.platform)return 'Device OS policy mismatch';
 if(r.availability){const a=r.availability,parts=new Intl.DateTimeFormat('en-US',{timeZone:a.timezone,weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(now),get=(t:string)=>parts.find(p=>p.type===t)?.value??'',day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday')),minute=Number(get('hour'))*60+Number(get('minute'));if(!a.days.includes(day)||minute<a.startMinute||minute>=a.endMinute)return 'Outside device availability';}
 const ids=deviceAgentIds(graph,r.deviceId);if(runs.filter(v=>activeRun(v)&&ids.includes(v.agentId)).length>=r.maximumConcurrent)return 'Device concurrency limit';return '';});
 void job;return reasons.some(r=>!r)?[]:[...new Set(reasons)];
}
