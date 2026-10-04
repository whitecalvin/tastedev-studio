import type {IncomingMessage,ServerResponse} from 'node:http';
import {TeamAccessError} from './team-access.ts';
import {createHash,timingSafeEqual} from 'node:crypto';
import {AIError,limits,type AIProvider,type ProviderRequest} from '../src/features/ai/domain.ts';
import {sanitize,uuid} from '../src/features/ai/security.ts';
import {connectionStatus} from '../src/features/ai/connection-status.ts';
import type {AIConnectionRegistry} from './ai-connections.ts';
const same=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function aiGateway(provider:AIProvider,token:string,origins:string[],hasProject:(id:string)=>boolean,secrets:string[]=[],timeoutMs=limits.timeout,authorize?:(req:IncomingMessage,projectId:string,write:boolean)=>void,connections?:AIConnectionRegistry){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>limits.timeout)throw Error('AI request timeout must be 1000–120000 milliseconds.');
 let active=0;
 return async(req:IncomingMessage,res:ServerResponse)=>{
  const origin=req.headers.origin;if(origin&&!origins.includes(origin)){res.writeHead(403).end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Project-Id, X-AI-Route');res.setHeader('Access-Control-Allow-Methods','GET, POST');res.writeHead(204).end();return;}
  const controller=new AbortController();let entered=false;const timeout=setTimeout(()=>controller.abort(new AIError('timeout')),timeoutMs);res.on('close',()=>controller.abort(new AIError('cancelled')));
  const cancelInput=()=>{if(!req.complete)req.destroy();};controller.signal.addEventListener('abort',cancelInput,{once:true});
  try{
   if(!same(req.headers.authorization??'','Bearer '+token))throw new AIError('authentication');const projectId=uuid(req.headers['x-project-id']);if(!hasProject(projectId))throw new AIError('tool-failure');
   authorize?.(req,projectId,!['/ai/config','/ai/connection','/ai/connections'].includes(req.url??''));
   if(req.url==='/ai/connections'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(connections?.list(projectId)??[]));return;}
   if(req.url==='/ai/connection'&&req.method==='GET'){
    const header=req.headers['x-ai-route'];let selected=provider;
    if(header!==undefined){if(typeof header!=='string'||header.length>1024||!connections)throw new AIError('unavailable');try{selected=connections.resolve(JSON.parse(header),projectId);}catch{throw new AIError('unavailable');}}
    if(!selected.inspect)throw new AIError('unavailable');if(active>=2)throw new AIError('rate-limit');active++;entered=true;
    const result=connectionStatus(sanitize(await selected.inspect(AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])),secrets));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
   }
   if(req.url==='/ai/config'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({provider:provider.id,capabilities:provider.capabilities,limits:{...limits,timeout:timeoutMs}}));return;}
   if(req.url!=='/ai/request'||req.method!=='POST')throw new AIError('tool-failure');if(active>=2)throw new AIError('rate-limit');active++;entered=true;
   req.setTimeout(15000,()=>req.destroy());
   const chunks:Buffer[]=[];let bytes=0;for await(const part of req){const chunk=Buffer.from(part);bytes+=chunk.length;if(bytes>160000)throw new AIError('context-too-large');chunks.push(chunk);}
   const raw=Buffer.concat(chunks).toString('utf8');
   let input:ProviderRequest;try{input=sanitize(JSON.parse(raw),secrets) as ProviderRequest;}catch{throw new AIError('malformed');}
   if(!input||!Array.isArray(input.messages)||input.messages.length>40||input.messages.some(m=>!['user','assistant','tool'].includes(m.role)||typeof m.text!=='string'||m.text.length>limits.total+16000||(m.calls&&(!Array.isArray(m.calls)||m.calls.length>limits.calls||m.calls.some(c=>typeof c.id!=='string'||typeof c.name!=='string'||c.id.length>200||c.name.length>80)))))throw new AIError('malformed');
   const route=(input as ProviderRequest&{route?:unknown}).route;
   const selected=route===undefined?provider:connections?.resolve(route,projectId);
   if(!selected)throw new AIError('unavailable');
   res.setHeader('Content-Type','application/x-ndjson');res.flushHeaders();const send=(value:unknown)=>{if(!res.destroyed)res.write(JSON.stringify(value)+'\n');};
   const reply=await selected.request({messages:input.messages},controller.signal,text=>send({type:'delta',text}));send({type:'done',reply});res.end();
  }catch(error){const safe=error instanceof AIError?error:new AIError(error instanceof TeamAccessError?'permission':'unavailable');if(!res.headersSent){res.statusCode=safe.code==='permission'?403:safe.code==='authentication'?401:safe.code==='rate-limit'?429:400;res.setHeader('Content-Type','application/x-ndjson');}if(!res.destroyed)res.end(JSON.stringify({type:'error',code:safe.code})+'\n');}
  finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',cancelInput);if(entered)active--;}
 };
}
