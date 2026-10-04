import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {CodexProvider} from '../transport/codex-provider.ts';
import {AIError} from '../src/features/ai/domain.ts';
import type {Launch} from '../transport/codex-client.ts';

// A test-only protocol peer. No external model or real account is used in these unit tests.
function peer(mode:string):Launch{return()=>spawn(process.execPath,['--input-type=module','-e',`
 import readline from 'node:readline';
 const mode=${JSON.stringify(mode)},send=p=>process.stdout.write(JSON.stringify(p)+'\\n');
 const answer={summary:'Grounded answer',observedFailure:'',candidates:[],evidence:[],relatedFiles:[],proposal:[],uncertainty:'Limited context'};
 readline.createInterface({input:process.stdin}).on('line',line=>{const p=JSON.parse(line);if(!p.id)return;
 if(p.method==='initialize')return send({id:p.id,result:{userAgent:'codex/0.151.0'}});
 if(p.method==='account/read')return send({id:p.id,result:{account:mode==='unauth'?null:{type:mode==='api'?'apiKey':'chatgpt'}}});
 if(p.method==='thread/start'){
  const x=p.params;if(x.environments.length!==0||x.sandbox!=='read-only'||x.approvalPolicy!=='never'||!x.ephemeral||x.config['features.shell_tool']!==false||x.config['features.apps']!==false||x.config['features.multi_agent']!==false)return send({id:p.id,error:{message:'Unsafe configuration'}});
  return send({id:p.id,result:{thread:{id:'thread-test'},model:'codex-fixture'}});
 }
 if(p.method==='turn/start'){
  if(p.params.environments.length!==0||!p.params.outputSchema)return send({id:p.id,error:{message:'Missing turn restrictions'}});
  send({id:p.id,result:{turn:{id:'turn-test'}}});if(mode==='hang')return;
  if(mode==='native'){send({id:998,method:'item/commandExecution/requestApproval',params:{threadId:'thread-test'}});return;}
  const text=mode==='malformed'?'not json':JSON.stringify({calls:mode==='calls'?[{name:'read_file',arguments:JSON.stringify({path:'src/index.ts'})}]:mode==='unknown'?[{name:'write_file',arguments:'{}'}]:[],analysis:mode==='calls'||mode==='unknown'?null:answer});
  send({method:'item/agentMessage/delta',params:{threadId:'thread-test',delta:text}});
  send({method:'item/completed',params:{threadId:'thread-test',item:{type:'agentMessage',text}}});
  send({method:'turn/completed',params:{threadId:'thread-test',turn:{status:mode==='failure'?'failed':'completed'}}});
 }
 });`],{windowsHide:true,stdio:['pipe','pipe','pipe']});}
test('Codex returns streaming structured analysis with no native environment',async()=>{let delta='';const p=new CodexProvider(undefined,peer('ok'));const result=await p.request({messages:[{role:'user',text:'Explain'}]},AbortSignal.timeout(5000),s=>delta+=s);assert.equal(JSON.parse(result.text).summary,'Grounded answer');assert.equal(result.model,'codex-fixture');assert(delta.includes('Grounded answer'));assert.deepEqual(result.calls,[]);});
test('Codex forwards only structured read requests to existing AIService',async()=>{const result=await new CodexProvider(undefined,peer('calls')).request({messages:[]},AbortSignal.timeout(5000),()=>{});assert.equal(result.text,'');assert.equal(result.calls[0].name,'read_file');assert.deepEqual(result.calls[0].arguments,{path:'src/index.ts'});});
for(const mode of ['unauth','api'])test(`Codex refuses ${mode} account rather than falling back to paid API`,async()=>{await assert.rejects(new CodexProvider(undefined,peer(mode)).request({messages:[]},AbortSignal.timeout(5000),()=>{}),e=>e instanceof AIError&&e.code==='authentication');});
for(const mode of ['native','unknown','malformed','failure'])test(`Codex fails closed on ${mode}`,async()=>{await assert.rejects(new CodexProvider(undefined,peer(mode)).request({messages:[]},AbortSignal.timeout(5000),()=>{}),AIError);});
test('Codex cancellation closes a stalled child and pending turn',async()=>{const c=new AbortController();const timer=setTimeout(()=>c.abort(new AIError('cancelled')),150);try{await assert.rejects(new CodexProvider(undefined,peer('hang')).request({messages:[]},c.signal,()=>{}),AIError);}finally{clearTimeout(timer);}});
test('Codex account inspection distinguishes ChatGPT and missing/API accounts without starting a turn',async()=>{
 for(const mode of ['ok','unauth','api']){
  // 테스트 peer는 모델 실행 메서드를 거부한다. 진단이 실행으로 진행하면 실패한다.
  const launch:Launch=()=>spawn(process.execPath,['--input-type=module','-e',`import readline from 'node:readline';readline.createInterface({input:process.stdin}).on('line',line=>{const p=JSON.parse(line);if(!p.id)return;const result=p.method==='initialize'?{}:p.method==='account/read'?{account:${mode==='ok'?"{type:'chatgpt',email:'private@example.test'}":mode==='api'?"{type:'apiKey'}":'null'}}:undefined;process.stdout.write(JSON.stringify(result===undefined?{id:p.id,error:{message:'Model execution forbidden'}}:{id:p.id,result})+'\\n');});`],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const result=await new CodexProvider('configured-model',launch).inspect(AbortSignal.timeout(5000));
  assert.equal(result.authentication,mode==='ok'?'authenticated':'missing');assert.equal(result.modelVerified,false);assert.ok(!JSON.stringify(result).includes('private@example.test'));
 }
});
