import {randomUUID} from 'node:crypto';
import {AIError,analysisSchema,systemPolicy,limits,type AIProvider,type ProviderRequest,type ProviderReply,type ToolCall} from '../src/features/ai/domain.ts';
import {mask,sanitize} from '../src/features/ai/security.ts';
import {toolDefinitions} from '../src/features/ai/tools.ts';
const finalTool='tastedev_analysis';
export function ollamaEndpoint(value:string):string {
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||!['127.0.0.1','[::1]','localhost'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error();if(u.hostname==='localhost')u.hostname='127.0.0.1';return new URL('api/chat',u).href;}catch{throw new AIError('unavailable');}
}
export class OllamaProvider implements AIProvider {
 readonly id='local';readonly capabilities={streaming:false,tools:true,structured:true,images:false};readonly model:string;private endpoint:string;private fetcher:typeof fetch;
 constructor(model:string,url='http://127.0.0.1:11434',fetcher:typeof fetch=fetch){this.model=model;this.endpoint=ollamaEndpoint(url);this.fetcher=fetcher;}
 private configured(){return !!this.model&&this.model.length<=120&&/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(this.model)&&!/(?:^|[:/-])cloud(?:$|[:/-])/i.test(this.model);}
 async inspect(signal:AbortSignal):Promise<import('../src/features/ai/connection-status.ts').AIConnectionStatus>{signal.throwIfAborted();return {provider:'local',adapter:'ollama-local',model:this.model,authentication:this.configured()?'configured':'missing',modelVerified:false};}
 async request(input:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void):Promise<ProviderReply>{
  signal.throwIfAborted();if(!this.configured())throw new AIError('unavailable');
  const names=new Map<string,string>();const messages:unknown[]=[{role:'system',content:systemPolicy+'\nSubmit final analysis with tastedev_analysis. Do not combine final submission with read calls.'}];
  for(const m of input.messages){
   if(m.role==='tool'){const name=names.get(m.callId??'');if(!name)throw new AIError('malformed');names.delete(m.callId!);messages.push({role:'tool',tool_name:name,content:m.text});}
   else{const calls=(m.calls??[]).map(c=>{if(m.role!=='assistant'||names.has(c.id)||!toolDefinitions.some(t=>t.name===c.name))throw new AIError('malformed');names.set(c.id,c.name);return {type:'function',function:{name:c.name,arguments:c.arguments}};});messages.push({role:m.role,content:m.text,...(calls.length?{tool_calls:calls}:{})});}
  }
  if(names.size)throw new AIError('malformed');
  const tools=[...toolDefinitions.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:{type:'object',properties:t.properties,required:Object.keys(t.properties),additionalProperties:false}}})),{type:'function',function:{name:finalTool,description:'Submit the final grounded analysis after source reads, without other tool calls.',parameters:analysisSchema}}];
  let response:Response;try{response=await this.fetcher(this.endpoint,{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:this.model,messages:sanitize(messages),tools,stream:false,think:false,options:{num_predict:10000}})});}catch{if(signal.aborted)throw signal.reason;throw new AIError('unavailable');}
  if(!response.ok){await response.body?.cancel();throw new AIError(response.status===401||response.status===403?'authentication':response.status===429?'rate-limit':response.status===413?'context-too-large':response.status===400?'malformed':'unavailable');}
  if(!response.body)throw new AIError('malformed');const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',size=0;const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{while(true){signal.throwIfAborted();const {value,done}=await reader.read();signal.throwIfAborted();if(done)break;if((size+=value.length)>1024*1024)throw new AIError('malformed');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch(e){if(signal.aborted)throw signal.reason;if(e instanceof AIError)throw e;throw new AIError('unavailable');}finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
  let r:{model:string;done:boolean;done_reason?:string;message:{role:string;content:string;tool_calls?:{function:{name:string;arguments:unknown}}[]};prompt_eval_count?:number;eval_count?:number};try{r=JSON.parse(raw);}catch{throw new AIError('malformed');}
  if(!r||r.done!==true||r.done_reason!=='stop'||typeof r.model!=='string'||!r.model||r.model.length>120||mask(r.model)!==r.model||r.message?.role!=='assistant'||typeof r.message.content!=='string'||r.message.content.length>limits.response||r.message.tool_calls!==undefined&&(!Array.isArray(r.message.tool_calls)||r.message.tool_calls.length>limits.calls))throw new AIError('malformed');
  const calls:ToolCall[]=[];let final:unknown;
  for(const c of r.message.tool_calls??[]){const f=c?.function;if(!f||typeof f.name!=='string'||!f.arguments||typeof f.arguments!=='object'||Array.isArray(f.arguments))throw new AIError('malformed');if(f.name===finalTool){if(final!==undefined)throw new AIError('malformed');final=sanitize(f.arguments);}else{if(!toolDefinitions.some(t=>t.name===f.name))throw new AIError('tool-failure');calls.push({id:randomUUID(),name:f.name,arguments:sanitize(f.arguments)});}}
  if(final!==undefined&&calls.length)throw new AIError('malformed');
  let text=final===undefined?'':JSON.stringify(final);if(!calls.length&&final===undefined){try{const a=JSON.parse(r.message.content);if(!a||typeof a!=='object'||Array.isArray(a))throw Error();text=JSON.stringify(sanitize(a));}catch{throw new AIError('malformed');}}
  if(text.length>limits.response)throw new AIError('malformed');let usage:ProviderReply['usage'];if(r.prompt_eval_count!==undefined||r.eval_count!==undefined){if(!Number.isSafeInteger(r.prompt_eval_count)||r.prompt_eval_count!<0||!Number.isSafeInteger(r.eval_count)||r.eval_count!<0)throw new AIError('malformed');usage={input:r.prompt_eval_count!,output:r.eval_count!};}if(text)delta(text);return {text,calls,model:r.model,usage};
 }
}
