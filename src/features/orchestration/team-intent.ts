import {mask} from '../ai/security.ts';
import {teamRoles,type TeamRole} from './domain.ts';

export interface IntentContent {objective:string;userRequest:string;exclusions:string[];acceptance:string[];paths:string[];responsibility:TeamRole}
export interface IntentReference {id:string;version:number;digest:string;userRequest:string;exclusions:string[];responsibility:TeamRole;rules?:{id:string;version:number;text:string}[]}
export interface TeamIntent extends IntentContent {rules?:{id:string;version:number;text:string}[];id:string;version:number;digest:string;ready:boolean;createdAt:string;updatedAt:string;history:{version:number;digest:string;content:IntentContent;reason:string;at:string}[];decisions:{id:string;text:string;author:string;at:string}[]}
export type GateCategory='tests'|'lint'|'screen'|'documentation'|'report';
export const gateCategories:GateCategory[]=['tests','lint','screen','documentation','report'];
export type GateResult='passed'|'reused'|'failed'|'not-run'|'not-applicable';
export interface QualityGate {id:string;intentId:string;intentVersion:number;factoryTaskId:string;executionId:string;sourceChecksum:string;category:GateCategory;result:GateResult;kind:'run'|'manual';runId?:string;note:string;author:string;at:string}
export interface TeamMessage {id:string;intentId:string;from:TeamRole;to:TeamRole;kind:'request'|'question'|'handoff'|'review';body:string;createdAt:string;acknowledgedAt?:string;acknowledgedBy?:string}
export interface TeamRule {id:string;intentId:string;scope:TeamRole|'project';text:string;version:number;status:'proposed'|'approved'|'retired';createdAt:string;approvedBy?:string;approvedAt?:string;sourceMessages:string[]}
export interface TeamWorkspace {projectId:string;revision:number;intents:TeamIntent[];gates:QualityGate[];messages:TeamMessage[];rules:TeamRule[];assignments?:TeamAssignment[];receipts?:{id:string;digest:string}[]}
export interface TeamWorkOverview extends TeamWorkspace {durable:boolean;assignments:TeamAssignment[];waiting:{intentId:string;reasons:string[]}[];roles:{id:string;label:string;responsibility:TeamRole}[];work:{taskId:string;intentId:string;intentVersion:number;status:string;reason?:string;executionId?:string;sourceChecksum?:string;runIds:string[]}[]}
export interface TeamAssignment {intentId:string;intentVersion:number;roleNodeId:string;taskNodeId:string;profileId:string;agentNodeId:string;agentId:string;deviceNodeId:string;graphRevision:number;inputChecksum:string;at:string}
export const teamId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value);
export function teamText(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max||/[\0\x01-\x08]/.test(value))throw Error('Invalid team text.');return mask(value.trim());}
export function intentContent(value:unknown):IntentContent {
  const i=value as IntentContent;
  if(!i||!teamRoles.includes(i.responsibility))throw Error('Invalid team responsibility.');
  const lines=(value:unknown,max:number,length:number,required=false):string[]=>{if(!Array.isArray(value)||value.length>length||required&&!value.length)throw Error('Invalid intent list.');const result=value.map(v=>teamText(v,max));if(new Set(result).size!==result.length)throw Error('Duplicate intent item.');return result;};
  const paths=lines(i.paths,300,20,true);
  if(new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw Error('Duplicate intent path.');
  for(const path of paths)if(path.includes('\\')||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||/[:*?\x00-\x1f]/.test(path))throw Error('Invalid intent relative path.');
  return{objective:teamText(i.objective,1200),userRequest:teamText(i.userRequest,1600),exclusions:lines(i.exclusions,200,10),acceptance:lines(i.acceptance,250,12,true),paths,responsibility:i.responsibility};
}
export function intentReference(i:TeamIntent):IntentReference{return{id:i.id,version:i.version,digest:i.digest,userRequest:i.userRequest,exclusions:[...i.exclusions],responsibility:i.responsibility,...(i.rules?.length?{rules:structuredClone(i.rules)}:{})};}
export function validateIntentReference(value:unknown):IntentReference{
  const r=value as IntentReference;
  if(!r||!teamId(r.id)||!Number.isSafeInteger(r.version)||r.version<1||!/^[a-f0-9]{64}$/.test(r.digest)||!teamRoles.includes(r.responsibility)||!Array.isArray(r.exclusions)||r.exclusions.length>10)throw Error('Invalid team intent reference.');
  if(r.rules!==undefined&&(!Array.isArray(r.rules)||r.rules.length>10||r.rules.some(v=>!teamId(v.id)||!Number.isSafeInteger(v.version)||v.version<1||teamText(v.text,300)!==v.text)))throw Error('Invalid project rules.');
  return{id:r.id,version:r.version,digest:r.digest,userRequest:teamText(r.userRequest,1600),exclusions:r.exclusions.map(v=>teamText(v,200)),responsibility:r.responsibility,...(r.rules?.length?{rules:r.rules.map(v=>({...v}))}:{})};
}
