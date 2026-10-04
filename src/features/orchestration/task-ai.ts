import {AIError,defaultBudget,type AnalysisBudget} from '../ai/domain.ts';
import {aiRoute,type AIRoute,type ManagedAIConnection} from '../ai/routing.ts';
import {configurationPrompt,configurationRoute,validateAIConfigurations,type AIConfigurationStore} from './ai-config.ts';
import type {GraphNode,ProjectGraph} from './domain.ts';
import {mask} from '../ai/security.ts';
export interface GraphAIIdentity {executionId:string;activationId:string;leaseId:string}
export interface GraphFailureContext {runId:string;originalRunId:string;attemptId:string;previousAnalysisId:string}
export interface TaskAIRequest {failure?:GraphFailureContext;completion?:'analysis'|'verified-fix';graph?:GraphAIIdentity;projectId:string;nodeId:string;label:string;profileId:string;route:AIRoute;question:string;budget:AnalysisBudget;maximum:number}
export function taskAIRequest(store:AIConfigurationStore,node:GraphNode,connections:ManagedAIConnection[]):TaskAIRequest{
 const checked=validateAIConfigurations(store,store.projectId),profile=checked.profiles.find(p=>p.id===checked.bindings[node.id]),route=configurationRoute(profile,connections);
 if(node.kind!=='task'||!profile||!route||! /^[A-Za-z0-9_-]{1,120}$/.test(node.id)||typeof node.label!=='string'||!node.label.trim()||node.label.length>120)throw new AIError('unavailable');
 return {...(profile.completion?{completion:profile.completion}:{}),projectId:store.projectId,nodeId:node.id,label:mask(node.label),profileId:profile.id,route:aiRoute(route),question:configurationPrompt(profile,node.label),budget:{...defaultBudget,maxProviderRequests:profile.maxRequests,timeoutMs:profile.timeoutSeconds*1000},maximum:profile.maxAttempts};
}
export async function reviewedTaskAI(request:TaskAIRequest,approve:()=>Promise<boolean>,current:()=>boolean,run:(request:TaskAIRequest)=>Promise<unknown>){
 const pinned=structuredClone(request);if(!await approve())return 'cancelled';if(!current())throw new AIError('cancelled');await run(pinned);return 'submitted';
}

/** Saved profile changes cannot silently reuse a differently published completion policy. */
export function graphAIConfigurationMatches(store:AIConfigurationStore|undefined,graph:ProjectGraph,published:Record<string,TaskAIRequest>|undefined,connections:ManagedAIConnection[]){
 try{
  if(!store)return !Object.keys(published??{}).length;
  const checked=validateAIConfigurations(store,graph.projectId);
  if(Object.keys(checked.bindings).some(id=>!graph.nodes.some(n=>n.id===id&&n.kind==='task')))return false;
  const current=Object.fromEntries(graph.nodes.filter(n=>n.kind==='task'&&checked.bindings[n.id]).map(n=>[n.id,taskAIRequest(checked,n,connections)]));
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,value])=>[k,canonical(value)])):v;
  const normalize=(plans:Record<string,TaskAIRequest>)=>Object.entries(plans).sort(([a],[b])=>a.localeCompare(b)).map(([id,p])=>[id,{...p,completion:p.completion??'analysis'}]);
  return JSON.stringify(canonical(normalize(current)))===JSON.stringify(canonical(normalize(published??{})));
 }catch{return false;}
}
