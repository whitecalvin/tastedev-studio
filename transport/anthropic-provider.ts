import {AIError,analysisSchema,systemPolicy,limits,type AIProvider,type ProviderRequest,type ProviderReply,type ToolCall} from '../src/features/ai/domain.ts';
import {toolDefinitions} from '../src/features/ai/tools.ts';
import {sanitize} from '../src/features/ai/security.ts';

const finalTool='tastedev_analysis';
type Block={type:string;text?:string;id?:string;name?:string;input?:unknown;tool_use_id?:string;content?:string};
type Turn={role:'user'|'assistant';content:Block[]};
export class AnthropicProvider implements AIProvider {
 readonly id='anthropic';readonly capabilities={streaming:false,tools:true,structured:true,images:false};
 readonly model:string;private key:string;private fetcher:typeof fetch;
 constructor(key:string,model:string,fetcher:typeof fetch=fetch){this.key=key;this.model=model;this.fetcher=fetcher;}
 async inspect(signal:AbortSignal):Promise<import('../src/features/ai/connection-status.ts').AIConnectionStatus>{
  signal.throwIfAborted();return {provider:'anthropic',adapter:'anthropic-api',model:this.model,authentication:this.key&&this.model?'configured':'missing',modelVerified:false};
 }
 async request(request:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void):Promise<ProviderReply>{
  signal.throwIfAborted();if(!this.key||!this.model)throw new AIError('unavailable');
  const messages:Turn[]=[];
  for(const m of request.messages){
   const role=m.role==='assistant'?'assistant':'user';
   const content:Block[]=m.role==='tool'?[{type:'tool_result',tool_use_id:m.callId,content:m.text}]:[
    ...(m.text?[{type:'text',text:m.text}]:[]),...(m.calls??[]).map(c=>({type:'tool_use',id:c.id,name:c.name,input:c.arguments}))];
   if(!content.length)continue;
   // 병렬 읽기 결과들은 하나의 user 턴에서 앞선 tool_use에 응답한다.
   if(messages.at(-1)?.role===role)messages.at(-1)!.content.push(...content);else messages.push({role,content});
  }
  const tools=[...toolDefinitions.map(t=>({name:t.name,description:t.description,input_schema:{type:'object',properties:t.properties,required:Object.keys(t.properties),additionalProperties:false}})),
   {name:finalTool,description:'Return the final grounded analysis after required source reads. Never combine this with other tool calls.',input_schema:analysisSchema}];
  let response:Response;
  try{response=await this.fetcher('https://api.anthropic.com/v1/messages',{method:'POST',signal,headers:{'Content-Type':'application/json','x-api-key':this.key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:this.model,max_tokens:10000,system:systemPolicy,messages:sanitize(messages,[this.key]),tools,tool_choice:{type:'any'}})});}catch{if(signal.aborted)throw signal.reason;throw new AIError('unavailable');}
  if(!response.ok){await response.body?.cancel();throw new AIError(response.status===401||response.status===403?'authentication':response.status===429?'rate-limit':response.status===413?'context-too-large':response.status===400?'malformed':'unavailable');}
  if(!response.body)throw new AIError('malformed');
  const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',bytes=0;
  const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done)break;bytes+=value.length;if(bytes>1024*1024)throw new AIError('malformed');raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
  catch(error){if(signal.aborted)throw signal.reason;if(error instanceof AIError)throw error;throw new AIError('unavailable');}
  finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});}
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new AIError('malformed');}
  const r=parsed as {type?:string;model?:string;stop_reason?:string;content?:Block[];usage?:{input_tokens:number;output_tokens:number}};
  if(!r||r.type!=='message'||typeof r.model!=='string'||!r.model||r.model.length>120||/sk-|[\x00-\x1f]/.test(r.model)||!Array.isArray(r.content)||r.content.length>limits.calls+1||r.stop_reason!=='tool_use')throw new AIError('malformed');
  if(r.usage&&(!Number.isSafeInteger(r.usage.input_tokens)||r.usage.input_tokens<0||!Number.isSafeInteger(r.usage.output_tokens)||r.usage.output_tokens<0))throw new AIError('malformed');
  const calls:ToolCall[]=[],ids=new Set<string>();let final:unknown;
  for(const b of r.content){
   if(!b||typeof b!=='object')throw new AIError('malformed');
   if(b.type==='text'){if(typeof b.text!=='string'||b.text.length>limits.response)throw new AIError('malformed');continue;}
   if(b.type!=='tool_use'||typeof b.id!=='string'||!b.id||b.id.length>200||ids.has(b.id)||typeof b.name!=='string'||!b.input||typeof b.input!=='object'||Array.isArray(b.input))throw new AIError('malformed');
   ids.add(b.id);
   if(b.name===finalTool){if(final!==undefined)throw new AIError('malformed');final=sanitize(b.input,[this.key]);}
   else {if(!toolDefinitions.some(t=>t.name===b.name))throw new AIError('tool-failure');calls.push({id:b.id,name:b.name,arguments:sanitize(b.input,[this.key])});}
  }
  if(calls.length>limits.calls||final!==undefined&&calls.length||final===undefined&&!calls.length)throw new AIError('malformed');
  const text=final===undefined?'':JSON.stringify(final);if(text.length>limits.response)throw new AIError('malformed');
  if(text)delta(text);
  return {text,calls,model:r.model,usage:r.usage?{input:r.usage.input_tokens,output:r.usage.output_tokens}:undefined};
 }
}
