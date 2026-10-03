import {mask} from '../ai/security.ts';

export const aiProviders=['openai','anthropic','google','local'] as const;
export const aiConnections=['core','api','account','local'] as const;
export const aiTools=['service','codex','claude-code','custom'] as const;
export const aiRoles=['implementation','review','analysis','design'] as const;
export interface AIConfiguration {
 id:string;name:string;provider:typeof aiProviders[number];model:string;
 connection:typeof aiConnections[number];tool:typeof aiTools[number];role:typeof aiRoles[number];
 location:'core'|'device'|'external';connectionRef:string;
 maxRequests:number;timeoutSeconds:number;maxAttempts:number;prompt:string;
}
export interface AIConfigurationStore {version:1;projectId:string;profiles:AIConfiguration[];bindings:Record<string,string>}
export const aiConfigurationKey=(projectId:string)=>`tastestudio.orchestration.ai.v1:${encodeURIComponent(projectId)}`;
export function emptyAIConfigurations(projectId:string):AIConfigurationStore{return{version:1,projectId,profiles:[],bindings:{}};}
export function newAIConfiguration(id:string):AIConfiguration{return{id,name:'AI configuration',provider:'openai',model:'',connection:'core',tool:'service',role:'implementation',location:'core',connectionRef:'',maxRequests:6,timeoutSeconds:120,maxAttempts:3,prompt:'Inspect the relevant source and requirements. Explain a grounded implementation proposal, affected files and suggested tests. Do not modify source or execute commands. Source changes require a separate reviewed approval.'};}
export function validateAIConfigurations(value:unknown,projectId:string):AIConfigurationStore{
 const s=value as AIConfigurationStore;
 if(!s||s.version!==1||s.projectId!==projectId||!Array.isArray(s.profiles)||s.profiles.length>30||!s.bindings||typeof s.bindings!=='object'||Array.isArray(s.bindings)||Object.keys(s.bindings).length>60)throw Error('Invalid AI configuration.');
 const ids=new Set<string>();
 const profiles=s.profiles.map(p=>{
  if(!p||typeof p.id!=='string'||! /^[A-Za-z0-9_-]{1,120}$/.test(p.id)||ids.has(p.id)||!aiProviders.includes(p.provider)||!aiConnections.includes(p.connection)||!aiTools.includes(p.tool)||!aiRoles.includes(p.role)||!['core','device','external'].includes(p.location))throw Error('Invalid AI configuration.');
  ids.add(p.id);
  for(const [text,max]of [[p.name,120],[p.model,120],[p.connectionRef,200],[p.prompt,3000]] as const)if(typeof text!=='string'||text.length>max||/[\0]/.test(text))throw Error('Invalid AI configuration.');
  if(!p.name.trim()||!p.prompt.trim()||!Number.isInteger(p.maxRequests)||p.maxRequests<1||p.maxRequests>12||!Number.isInteger(p.timeoutSeconds)||p.timeoutSeconds<1||p.timeoutSeconds>120||!Number.isInteger(p.maxAttempts)||p.maxAttempts<1||p.maxAttempts>3)throw Error('Invalid AI configuration.');
  // 인증값은 저장하지 않는다. 표시 문자열과 프롬프트도 기존 마스킹 규칙 적용.
  return{id:p.id,name:mask(p.name.trim()),provider:p.provider,model:mask(p.model.trim()),connection:p.connection,tool:p.tool,role:p.role,location:p.location,connectionRef:mask(p.connectionRef.trim()),maxRequests:p.maxRequests,timeoutSeconds:p.timeoutSeconds,maxAttempts:p.maxAttempts,prompt:mask(p.prompt)};
 });
 const bindings:Record<string,string>={};
 for(const [nodeId,profileId]of Object.entries(s.bindings)){
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(nodeId)||!ids.has(profileId))throw Error('Invalid AI configuration.');
  Object.defineProperty(bindings,nodeId,{value:profileId,enumerable:true,writable:true,configurable:true});
 }
 return{version:1,projectId,profiles,bindings};
}
export function saveAIConfigurations(storage:{getItem(key:string):string|null;setItem(key:string,value:string):void},value:AIConfigurationStore,expected:string|null){
 const key=aiConfigurationKey(value.projectId);
 if(storage.getItem(key)!==expected)throw Error('AI configuration changed in another window.');
 storage.setItem(key,JSON.stringify(validateAIConfigurations(value,value.projectId)));
}
export function configurationPrompt(profile:AIConfiguration,task:string):string{
 return mask(`Task: ${task}\nAI role: ${profile.role}\n\n${profile.prompt}`);
}
export function canPrepareConfiguration(profile:AIConfiguration|undefined):boolean{
 return !!profile&&profile.provider==='openai'&&profile.connection==='core'&&profile.tool==='service'&&profile.location==='core'&&!profile.model&&!profile.connectionRef;
}
