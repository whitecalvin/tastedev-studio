import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer,request} from 'node:http';
import {Script} from 'node:vm';
import {aiGateway} from '../transport/ai-gateway.ts';
import {OpenAIProvider} from '../transport/ai-provider.ts';
import {AIError,type ProviderReply,type AIProvider} from '../src/features/ai/domain.ts';
import {mask} from '../src/features/ai/security.ts';
import {FakeAIProvider} from './helpers/fake-ai-provider.ts';
import {AIService} from '../src/features/ai/service.ts';
import {ContextTools} from '../src/features/ai/tools.ts';
const projectId=randomUUID();
test('AI URL redaction preserves JavaScript delimiters and subsequent source',()=>{
 const source="fetch('https://user:pass@example.test/no?token=dummy-secret').catch(()=>{}); const after = 42;";
 const filtered=mask(source);assert(!filtered.includes('dummy-secret'));assert(!filtered.includes('user:pass'));assert(filtered.endsWith("').catch(()=>{}); const after = 42;"));assert.doesNotThrow(()=>new Script(filtered));
 const serialized=mask(JSON.stringify({source}));assert.doesNotThrow(()=>JSON.parse(serialized));assert(JSON.parse(serialized).source.endsWith('const after = 42;'));
});
test('AI Core request timeout is configurable, bounded and cancels the provider',async()=>{
 let aborted=false;const provider:AIProvider={id:'timeout-test',capabilities:{streaming:true,tools:true,structured:true,images:false},request:(_input,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true}))};
 assert.throws(()=>aiGateway(provider,'token',[],()=>true,[],120001));assert.throws(()=>aiGateway(provider,'token',[],()=>true,[],Number.NaN));
 const handler=aiGateway(provider,'test-token-long-enough',[],id=>id===projectId,[],1000),server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`,headers={Authorization:'Bearer test-token-long-enough','X-Project-Id':projectId};
 try{assert.equal((await(await fetch(base+'/ai/config',{headers})).json()).limits.timeout,1000);const r=await fetch(base+'/ai/request',{method:'POST',headers,body:JSON.stringify({messages:[]})});assert((await r.text()).includes('timeout'));assert(aborted);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('AI gateway preserves multibyte source across request chunks',async()=>{
 let captured='';const provider=new FakeAIProvider([input=>{captured=input.messages[0].text;return {text:'ok',calls:[],model:'test'};}]);
 const handler=aiGateway(provider,'test-token-long-enough',[],id=>id===projectId),server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{const body=Buffer.from(JSON.stringify({messages:[{role:'user',text:'한글 source 설명'}]}));const split=body.indexOf(Buffer.from('한'))+1;
 await new Promise<void>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:(server.address() as {port:number}).port,path:'/ai/request',method:'POST',headers:{Authorization:'Bearer test-token-long-enough','X-Project-Id':projectId}},res=>{res.resume();res.on('end',resolve);});req.on('error',reject);req.write(body.subarray(0,split));setTimeout(()=>req.end(body.subarray(split)),20);});assert.equal(captured,'한글 source 설명');
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
const env={projectId,name:'Boundary test',files:{list:async()=>[],read:async()=>({content:'line',size:4,modified:0})},snapshot:()=>({agents:[],jobs:[],runs:[],steps:[],artifacts:[],events:[]}),logs:()=>[],artifact:async()=>new Blob()};
test('AI maximum tool calls stops distinct untrusted requests at twelve',async()=>{const steps=Array.from({length:20},(_,i)=>()=>({text:'',model:'test',calls:[0,1].map(n=>({id:String(i*2+n),name:'search_code',arguments:{query:'q'+(i*2+n)}}))}));const p=new FakeAIProvider(steps),s=new AIService(p,env);s.setBudget({...s.budget,maxProviderRequests:12});await assert.rejects(s.analyze(s.newConversation().id,'find code',{},()=>{}),AIError);assert.equal(p.requests.length,7);});
test('AI file count and malformed structured result are bounded',async()=>{const t=new ContextTools(env);for(let i=0;i<8;i++)await t.execute('read_file',{path:`file${i}.ts`},AbortSignal.timeout(1000));await assert.rejects(t.execute('read_file',{path:'ninth.ts'},AbortSignal.timeout(1000)));const s=new AIService(new FakeAIProvider([()=>({text:'invalid',calls:[],model:'test'})]),env);await assert.rejects(s.analyze(s.newConversation().id,'explain',{},()=>{}),e=>e instanceof AIError&&e.code==='malformed');});
test('Provider distinguishes actual observed streaming quota error',async()=>{const p=new OpenAIProvider('dummy','test',async()=>new Response('data: '+JSON.stringify({type:'error',error:{code:'credit_balance_exhausted',message:'raw diagnostic secret'}})+'\n\n'));await assert.rejects(p.request({messages:[]},AbortSignal.timeout(1000),()=>{}),e=>e instanceof AIError&&e.code==='quota'&&!e.message.includes('raw diagnostic'));});
test('AI HTTP gateway validates origin, auth, project, input size and masks context',async()=>{let captured='';const provider=new FakeAIProvider([input=>{captured=JSON.stringify(input);return {text:'ok',calls:[],model:'test'} satisfies ProviderReply;}]);const handler=aiGateway(provider,'test-token-long-enough',['http://localhost:4330'],id=>id===projectId,['dummy-secret']);const server=createServer((req,res)=>void handler(req,res));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/ai/request`;const headers={Authorization:'Bearer test-token-long-enough','X-Project-Id':projectId,'Content-Type':'application/json'};try{assert.equal((await fetch(base,{method:'POST'})).status,401);assert.equal((await fetch(base,{method:'POST',headers:{...headers,Origin:'https://evil.invalid'}})).status,403);assert.equal((await fetch(base,{method:'POST',headers:{...headers,'X-Project-Id':randomUUID()},body:'{}'})).status,400);assert.equal((await fetch(base,{method:'POST',headers,body:'x'.repeat(170000)})).status,400);const r=await fetch(base,{method:'POST',headers,body:JSON.stringify({messages:[{role:'user',text:'dummy-secret password=abc'}]})});assert.equal(r.status,200);assert((await r.text()).includes('done'));assert(!captured.includes('dummy-secret'));assert(!captured.includes('password=abc'));}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}});
