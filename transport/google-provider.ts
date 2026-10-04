import {randomUUID} from 'node:crypto';
import {AIError,analysisSchema,systemPolicy,limits,type AIProvider,type ProviderRequest,type ProviderReply,type ToolCall} from '../src/features/ai/domain.ts';
import {toolDefinitions} from '../src/features/ai/tools.ts';
import {mask,sanitize} from '../src/features/ai/security.ts';
const finalTool='tastedev_analysis';
type FunctionCall={name:string;args:Record<string,unknown>;id?:string};
type Part={text?:string;thought?:boolean;thoughtSignature?:string;functionCall?:FunctionCall;functionResponse?:{name:string;id?:string;response:{output:string}}};
type Turn={role:'user'|'model';parts:Part[]};
function modelParts(value:unknown):Part[]{
 if(!Array.isArray(value)||!value.length||value.length>limits.calls+8||JSON.stringify(value).length>32000)throw new AIError('malformed');
 for(const p of value){
  if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['text','thought','thoughtSignature','functionCall'].includes(k))||p.thought!==undefined&&typeof p.thought!=='boolean'||p.thoughtSignature!==undefined&&(typeof p.thoughtSignature!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(p.thoughtSignature)))throw new AIError('malformed');
  const c=p.functionCall;
  if(c){if(p.text!==undefined||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['name','args','id'].includes(k))||typeof c.name!=='string'||!c.args||typeof c.args!=='object'||Array.isArray(c.args)||c.id!==undefined&&(typeof c.id!=='string'||!c.id||c.id.length>200))throw new AIError('malformed');}
  else if(typeof p.text!=='string'||p.text.length>limits.response)throw new AIError('malformed');
 }
 return value;
}
export class GoogleProvider implements AIProvider {
 readonly id='google';readonly capabilities={streaming:false,tools:true,structured:true,images:false};
 readonly model:string;private key:string;private fetcher:typeof fetch;
 constructor(key:string,model:string,fetcher:typeof fetch=fetch){this.key=key;this.model=model;this.fetcher=fetcher;}
 private configured(){return !!this.key&&this.model.length<=120&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(this.model);}
 async inspect(signal:AbortSignal):Promise<import('../src/features/ai/connection-status.ts').AIConnectionStatus>{signal.throwIfAborted();return {provider:'google',adapter:'google-api',model:this.model,authentication:this.configured()?'configured':'missing',modelVerified:false};}
 async request(request:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void):Promise<ProviderReply>{
  signal.throwIfAborted();if(!this.configured())throw new AIError('unavailable');
  const contents:Turn[]=[],callsById=new Map<string,FunctionCall>();
  for(const m of request.messages){
   let parts:Part[];const role=m.role==='assistant'?'model':'user';
   if(m.role==='tool'){
    const c=callsById.get(m.callId??'');if(!c)throw new AIError('malformed');callsById.delete(m.callId!);
    parts=[{functionResponse:{name:c.name,...(c.id?{id:c.id}:{}),response:{output:m.text}}}];
   }else if(m.role==='assistant'&&m.calls?.length){
    // 서명을 포함한 원래 Part 순서를 유지한다. 다른 대화와 공유하는 캐시는 두지 않는다.
    const continuation=m.calls[0].continuation;
    if(continuation&&continuation.provider!=='google')throw new AIError('malformed');
    parts=continuation?modelParts(continuation.parts):m.calls.map(c=>({functionCall:{name:c.name,args:c.arguments as Record<string,unknown>}}));
    const functions=parts.flatMap(p=>p.functionCall?[p.functionCall]:[]);
    if(functions.length!==m.calls.length)throw new AIError('malformed');
    for(const [i,c]of m.calls.entries()){const f=functions[i];if(f.name!==c.name||JSON.stringify(f.args)!==JSON.stringify(c.arguments)||!toolDefinitions.some(t=>t.name===c.name)||callsById.has(c.id))throw new AIError('malformed');callsById.set(c.id,f);}
   }else parts=m.text?[{text:m.text}]:[];
   if(!parts.length)continue;
   if(contents.at(-1)?.role===role)contents.at(-1)!.parts.push(...parts);else contents.push({role,parts});
  }
  if(callsById.size)throw new AIError('malformed');
  const declarations=[...toolDefinitions.map(t=>({name:t.name,description:t.description,parametersJsonSchema:{type:'object',properties:t.properties,required:Object.keys(t.properties),additionalProperties:false}})),{name:finalTool,description:'Submit the final grounded analysis after required source reads. Do not combine with any read call.',parametersJsonSchema:analysisSchema}];
  let response:Response;
  try{response=await this.fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':this.key},body:JSON.stringify({systemInstruction:{parts:[{text:systemPolicy}]},contents:sanitize(contents,[this.key]),tools:[{functionDeclarations:declarations}],toolConfig:{functionCallingConfig:{mode:'ANY',allowedFunctionNames:declarations.map(d=>d.name)}},generationConfig:{candidateCount:1,maxOutputTokens:10000}})});}catch{if(signal.aborted)throw signal.reason;throw new AIError('unavailable');}
  signal.throwIfAborted();
  if(!response.ok){await response.body?.cancel();throw new AIError(response.status===401||response.status===403?'authentication':response.status===429?'rate-limit':response.status===413?'context-too-large':response.status===400?'malformed':'unavailable');}
  if(!response.body)throw new AIError('malformed');const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',size=0;
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{while(true){signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;if((size+=value.length)>1024*1024)throw new AIError('malformed');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  catch(error){if(signal.aborted)throw signal.reason;if(error instanceof AIError)throw error;throw new AIError('unavailable');}
  finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
  let r:{candidates?:{content?:{role?:string;parts?:unknown};finishReason?:string}[];modelVersion?:string;usageMetadata?:{promptTokenCount:number;candidatesTokenCount:number;thoughtsTokenCount?:number}};
  try{r=JSON.parse(raw);}catch{throw new AIError('malformed');}
  if(!r||!Array.isArray(r.candidates)||r.candidates.length!==1||r.candidates[0]?.finishReason!=='STOP'||r.candidates[0].content?.role!=='model'||typeof r.modelVersion!=='string'||!r.modelVersion||r.modelVersion.length>120||mask(r.modelVersion,[this.key])!==r.modelVersion)throw new AIError('malformed');
  const parts=modelParts(r.candidates[0].content.parts),calls:ToolCall[]=[],ids=new Set<string>();let final:unknown;
  for(const part of parts){
   const c=part.functionCall;if(!c)continue;
   if(c.id&&ids.has(c.id))throw new AIError('malformed');if(c.id)ids.add(c.id);
   if(c.name===finalTool){if(final!==undefined)throw new AIError('malformed');final=sanitize(c.args,[this.key]);}
   else{if(!toolDefinitions.some(t=>t.name===c.name))throw new AIError('tool-failure');calls.push({id:randomUUID(),name:c.name,arguments:sanitize(c.args,[this.key])});}
  }
  if(calls.length>limits.calls||final!==undefined&&calls.length||final===undefined&&!calls.length)throw new AIError('malformed');
  if(calls.length)calls[0].continuation={provider:'google',parts:sanitize(parts,[this.key]) as unknown[]};
  const u=r.usageMetadata;let usage:ProviderReply['usage'];
  if(u){const output=u.candidatesTokenCount+(u.thoughtsTokenCount??0);if([u.promptTokenCount,u.candidatesTokenCount,u.thoughtsTokenCount??0,output].some(n=>!Number.isSafeInteger(n)||n<0))throw new AIError('malformed');usage={input:u.promptTokenCount,output};}
  const text=final===undefined?'':JSON.stringify(final);if(text.length>limits.response)throw new AIError('malformed');if(text)delta(text);
  return {text,calls,model:r.modelVersion,usage};
 }
}
