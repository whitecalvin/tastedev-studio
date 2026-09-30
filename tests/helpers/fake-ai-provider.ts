import {AIError,type AIProvider,type ProviderRequest,type ProviderReply} from '../../src/features/ai/domain.ts';
/** Test fixture only; never selectable by production UI or Core. */
export class FakeAIProvider implements AIProvider {
 readonly id='test-only';readonly capabilities={streaming:true,tools:true,structured:true,images:false};requests:ProviderRequest[]=[];
 steps:((input:ProviderRequest,signal:AbortSignal)=>Promise<ProviderReply>|ProviderReply)[];
 constructor(steps:FakeAIProvider['steps']){this.steps=steps;}
 async request(input:ProviderRequest,signal:AbortSignal,delta:(text:string)=>void){this.requests.push(structuredClone(input));signal.throwIfAborted();const step=this.steps.shift();if(!step)throw new AIError('unavailable');const reply=await step(input,signal);for(const piece of reply.text.match(/.{1,12}/gs)??[])delta(piece);return reply;}
}
