import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {CodexClient} from '../transport/codex-client.ts';
import {startChatGPTLogin} from '../transport/codex-login.ts';
import {AIError} from '../src/features/ai/domain.ts';

function launch(mode:string){return()=>spawn(process.execPath,['--input-type=module','-e',`
 import readline from 'node:readline';
 readline.createInterface({input:process.stdin}).on('line',line=>{const p=JSON.parse(line);if(!p.id)return;
 const result=p.method==='initialize'?{}:p.method==='account/read'?${mode==='valid'?"{account:{type:'chatgpt',planType:'pro'}}":'null'}:p.method==='account/login/start'?{loginId:'test-login',authUrl:${JSON.stringify(mode==='evil'?'https://evil.example/login':'https://auth.openai.com/authorize?state=dummy')}}:null;
 const error=p.method==='account/read'&&${mode!=='valid'}?{code:-32603,message:'workspace routing discovery unauthorized (401); token_revoked; private diagnostic'}:null;
 process.stdout.write(JSON.stringify(error?{id:p.id,error}:{id:p.id,result})+'\\n');});
 `],{windowsHide:true,stdio:['pipe','pipe','pipe']});}

test('revoked account inspection is safely classified and login starts without deleting existing credentials',async()=>{
 const client=await CodexClient.connect(AbortSignal.timeout(5000),launch('revoked'));
 try{await assert.rejects(client.call('account/read',{refreshToken:false}),e=>e instanceof AIError&&e.code==='authentication'&&!e.message.includes('private diagnostic'));
 const login=await startChatGPTLogin(client);assert.equal(login.connected,false);if(!login.connected)assert.equal(new URL(login.authUrl).hostname,'auth.openai.com');}finally{client.close();}
});
test('connected ChatGPT login is reused and untrusted login origins are rejected',async()=>{
 for(const mode of ['valid','evil']){const client=await CodexClient.connect(AbortSignal.timeout(5000),launch(mode));try{if(mode==='valid')assert.deepEqual(await startChatGPTLogin(client),{connected:true,plan:'pro'});else await assert.rejects(startChatGPTLogin(client),AIError);}finally{client.close();}}
});
