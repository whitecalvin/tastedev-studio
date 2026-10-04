import {AIError} from './domain.ts';
export interface ManagedAIConnection {id:string;provider:'openai'|'anthropic'|'google'|'local';adapter:'openai-api'|'codex-chatgpt'|'anthropic-api'|'google-api'|'ollama-local';connection:'api'|'account'|'local';model:string}
export function providerAdapter(provider:unknown,adapter:unknown):boolean{return provider==='openai'&&['openai-api','codex-chatgpt'].includes(String(adapter))||provider==='anthropic'&&adapter==='anthropic-api'||provider==='google'&&adapter==='google-api'||provider==='local'&&adapter==='ollama-local';}
export interface AIRoute {connectionId:string;adapter:ManagedAIConnection['adapter'];model:string}
export function managedConnections(value:unknown):ManagedAIConnection[]{
 if(!Array.isArray(value)||value.length>16)throw new AIError('malformed');const ids=new Set<string>();
 return value.map(v=>{
  if(!v||typeof v.id!=='string'||! /^[A-Za-z0-9_-]{1,64}$/.test(v.id)||ids.has(v.id)||!providerAdapter(v.provider,v.adapter)||v.connection!==(v.adapter==='codex-chatgpt'?'account':v.adapter==='ollama-local'?'local':'api')||typeof v.model!=='string'||v.model.length>120||v.model!==''&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(v.model)||/sk-[A-Za-z0-9_-]{12,}/.test(v.model))throw new AIError('malformed');
  ids.add(v.id);return {id:v.id,provider:v.provider,adapter:v.adapter,connection:v.connection,model:v.model};
 });
}
export function aiRoute(value:unknown):AIRoute{
 const v=value as AIRoute;
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['connectionId','adapter','model'].includes(k)))throw new AIError('unavailable');
 try{const row=managedConnections([{id:v.connectionId,adapter:v.adapter,provider:v.adapter==='anthropic-api'?'anthropic':v.adapter==='google-api'?'google':v.adapter==='ollama-local'?'local':'openai',connection:v.adapter==='codex-chatgpt'?'account':v.adapter==='ollama-local'?'local':'api',model:v.model}])[0];return {connectionId:row.id,adapter:row.adapter,model:row.model};}catch{throw new AIError('unavailable');}
}
