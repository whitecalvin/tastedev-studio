import {AIError,type AIErrorCode,type AIProvider,type ProviderRequest,type ProviderReply} from './domain.ts';
import {aiRoute,type AIRoute} from './routing.ts';
export class RemoteAIProvider implements AIProvider {
 readonly id='core-configured';readonly capabilities={streaming:true,tools:true,structured:true,images:false};private send:(body:unknown,signal:AbortSignal)=>Promise<Response>;
 constructor(send:(body:unknown,signal:AbortSignal)=>Promise<Response>){this.send=send;}
 private route?:AIRoute;
 setRoute(value:AIRoute|undefined){this.route=value?aiRoute(value):undefined;}
 get currentRoute(){return this.route?{...this.route}:undefined;}
 async request(input:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void):Promise<ProviderReply>{
  let response:Response;try{response=await this.send({...input,...(this.route?{route:{...this.route}}:{})},signal);}catch{if(signal.aborted)throw signal.reason;throw new AIError('unavailable');}if(!response.body)throw new AIError('unavailable');
  let text='',total=0,reply:ProviderReply|undefined;const reader=response.body.getReader(),decoder=new TextDecoder();try{while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>1024*1024)throw new AIError('malformed');text+=decoder.decode(r.value,{stream:true});let i:number;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i);text=text.slice(i+1);if(!line)continue;const event=JSON.parse(line);if(event.type==='error'){const codes:AIErrorCode[]=['budget','permission','quota','unavailable','authentication','rate-limit','timeout','context-too-large','tool-failure','malformed','cancelled'];throw new AIError(codes.includes(event.code)?event.code:'unavailable');}if(event.type==='delta'&&typeof event.text==='string')delta(event.text);if(event.type==='done')reply=event.reply;}}}finally{await reader.cancel().catch(()=>{});}if(!reply||typeof reply.text!=='string'||!Array.isArray(reply.calls))throw new AIError('malformed');return reply;
 }
}
