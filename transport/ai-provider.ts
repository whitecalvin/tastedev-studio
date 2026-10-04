import {AIError,analysisSchema,systemPolicy,limits,type AIProvider,type ProviderRequest,type ProviderReply,type ToolCall} from '../src/features/ai/domain.ts';
import {toolDefinitions} from '../src/features/ai/tools.ts';
import {mask} from '../src/features/ai/security.ts';
export class OpenAIProvider implements AIProvider {
 readonly id='openai';readonly capabilities={streaming:true,tools:true,structured:true,images:false};
 readonly model:string;private key:string;private fetcher:typeof fetch;
 constructor(key:string,model='gpt-4.1-mini',fetcher:typeof fetch=fetch){this.key=key;this.model=model;this.fetcher=fetcher;}
 async inspect(signal:AbortSignal):Promise<import('../src/features/ai/connection-status.ts').AIConnectionStatus>{signal.throwIfAborted();return {provider:'openai',adapter:'openai-api',model:this.model,authentication:this.key?'configured':'missing',modelVerified:false};}
 async request(request:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void):Promise<ProviderReply>{
  if(!this.key)throw new AIError('unavailable');
  const input=request.messages.flatMap<unknown>(m=>m.role==='tool'?[{type:'function_call_output',call_id:m.callId,output:m.text}]:m.role==='assistant'&&m.calls?.length?m.calls.map(c=>({type:'function_call',call_id:c.id,name:c.name,arguments:JSON.stringify(c.arguments)})):[{role:m.role,content:m.text}]);
  let response:Response;try{response=await this.fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},signal,body:JSON.stringify({model:this.model,instructions:systemPolicy,input,store:false,stream:true,max_output_tokens:10000,tools:toolDefinitions.map(t=>({type:'function',name:t.name,description:t.description,strict:true,parameters:{type:'object',properties:t.properties,required:Object.keys(t.properties),additionalProperties:false}})),text:{format:{type:'json_schema',name:'tastedev_analysis',strict:true,schema:analysisSchema}}})});}catch{if(signal.aborted)throw signal.reason;throw new AIError('unavailable');}
  if(!response.ok){await response.body?.cancel();throw new AIError(response.status===401||response.status===403?'authentication':response.status===429?'rate-limit':response.status===413?'context-too-large':'unavailable');}
  if(!response.body)throw new AIError('malformed');let buffer='',total=0,final:ProviderReply|undefined;const reader=response.body.getReader(),decoder=new TextDecoder();
  try{while(true){signal.throwIfAborted();const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>1024*1024)throw new AIError('malformed');buffer+=decoder.decode(value,{stream:true});let boundary:number;while((boundary=buffer.indexOf('\n\n'))>=0){const chunk=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);for(const line of chunk.split('\n')){if(!line.startsWith('data: '))continue;const data=line.slice(6);if(data==='[DONE]')continue;let e:Record<string,unknown>;try{e=JSON.parse(data);}catch{throw new AIError('malformed');}
   if(e.type==='response.output_text.delta'&&typeof e.delta==='string')delta(mask(e.delta,[this.key]));
   if(e.type==='error'||e.type==='response.failed'){const error=(e.error??(e.response as {error?:unknown})?.error) as {code?:string}|undefined;throw new AIError(error?.code==='credit_balance_exhausted'||error?.code==='insufficient_quota'?'quota':error?.code==='rate_limit_exceeded'?'rate-limit':'unavailable');}
   if(e.type==='response.completed'){const r=e.response as {status:string;model:string;output:{type:string;call_id?:string;name?:string;arguments?:string;content?:{type:string;text?:string}[]}[];usage?:{input_tokens:number;output_tokens:number}};if(r.status!=='completed'||!Array.isArray(r.output))throw new AIError('malformed');const calls:ToolCall[]=r.output.filter(o=>o.type==='function_call').map(o=>({id:o.call_id!,name:o.name!,arguments:JSON.parse(o.arguments!)}));const text=r.output.flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text??'').join('');if(text.length>limits.response)throw new AIError('malformed');final={text:mask(text,[this.key]),calls,model:r.model,usage:r.usage?{input:r.usage.input_tokens,output:r.usage.output_tokens}:undefined};}
  }}}}finally{await reader.cancel().catch(()=>{});}
  if(!final)throw new AIError('malformed');return final;
 }
}
