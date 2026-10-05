import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {artifactGraphFixture} from './helpers/build-artifact-fixture.ts';
import {buildArtifactGateway} from '../transport/build-artifact-gateway.ts';

const evidence=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/build-artifact-http-20261005/fixtures');
const bytes=Buffer.from('controlled executable artifact'),checksum=createHash('sha256').update(bytes).digest('hex');
async function setup(executable?:boolean){
 const f=await artifactGraphFixture(true,executable);await f.publish();await f.start();
 await fs.mkdir(evidence,{recursive:true});const root=await fs.mkdtemp(path.join(evidence,'http-'));let allowed=true,clock=Date.now();
 const gateway=buildArtifactGateway(f.core,f.service,root,['http://studio.local'],()=>allowed,()=>clock,['dummy-private-credential']);
 const server=createServer((req,res)=>{void gateway.handle(req,res);});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 function nextCommand(runId:string){const source=f.orchestrator.next(runId)!;assert(source.command.source);f.orchestrator.complete(runId,source.step.id,'passed',0,undefined,{repository:source.command.source!.repository,branch:'controlled',commit:f.reference.checksum,snapshotId:f.reference.snapshotId,proposalId:f.reference.proposalId,attempt:1});return f.orchestrator.next(runId)!;}
 const run=f.core.snapshot(f.projectId).runs[0],producer=nextCommand(run.id),transfer=await gateway.grant(run.id,producer.step.id,base),output=transfer.outputs[0];
 const headers={...(executable!==undefined?{'X-Build-Executable':String(executable)}:{}),Authorization:`Bearer ${output.token}`,'X-Project-Id':f.projectId,'X-Build-Size':String(bytes.length),'X-Build-Checksum':checksum};
 return {...f,root,gateway,base,run,producer,output,headers,nextCommand,setAllowed:(v:boolean)=>{allowed=v;},expire:()=>{clock+=300001;},close:async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await fs.rm(root,{recursive:true,force:true});}};
}
test('actual HTTP bytes follow successful producer, explicit approval and consumer checksum precondition',async()=>{
 const f=await setup();try{
  await assert.rejects(f.gateway.verifyOutputs(f.producer.job.id,f.producer.step.id));
  const upload=await fetch(f.output.url,{method:'PUT',headers:f.headers,body:bytes});assert.equal(upload.status,200);const saved=await upload.json();assert.equal(saved.artifact.producerRunId,f.run.id);assert.equal(saved.artifact.checksum,checksum);assert.equal('token' in saved.artifact,false);
  const verified=await f.gateway.verifyOutputs(f.producer.job.id,f.producer.step.id);f.service.recordBuildArtifactOutputs(f.producer.job.id,f.producer.step.id,verified);assert.equal(f.service.overview(f.projectId).executions[0].activations.find(a=>a.nodeId==='producer')!.artifactReceipts![0].outputs[0].checksum,checksum);
  f.orchestrator.complete(f.run.id,f.producer.step.id,'passed',0);let step;while((step=f.orchestrator.next(f.run.id)))f.orchestrator.complete(f.run.id,step.step.id,'passed',0);f.orchestrator.finish(f.run.id);await f.service.tick();assert.equal(f.core.snapshot(f.projectId).jobs.length,1);
  assert.equal((await fetch(f.output.url,{method:'PUT',headers:f.headers,body:bytes})).status,403);
  const execution=f.service.overview(f.projectId).executions[0],approval=execution.activations.find(a=>a.status==='approval')!;
  await f.service.request(f.projectId,'approve',{executionId:execution.id,activationId:approval.id,revision:execution.revision,checksum:execution.checksum},'user');
  const run=f.core.snapshot(f.projectId).runs.find(r=>r.status==='pending')!,consumer=f.nextCommand(run.id),transfer=await f.gateway.grant(run.id,consumer.step.id,f.base),input=transfer.inputs[0];assert.equal(input.artifact.id,f.output.id);assert.equal(input.path,'received/app.exe');
  await assert.rejects(f.gateway.verifyInstallation(consumer.job.id,consumer.step.id,[{id:input.artifact.id,path:input.path,size:bytes.length,checksum}]),/not granted/);
  const headers={Authorization:`Bearer ${input.token}`,'X-Project-Id':f.projectId};assert.equal((await fetch(input.url,{headers})).status,412);
  const download=await fetch(input.url,{headers:{...headers,'If-Match':`"${checksum}"`}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  const report=[{id:input.artifact.id,path:input.path,size:bytes.length,checksum}];
  await assert.rejects(f.gateway.verifyInstallation(consumer.job.id,consumer.step.id,[{...report[0],checksum:'f'.repeat(64)}]));
  const receipt=await f.gateway.verifyInstallation(consumer.job.id,consumer.step.id,report);f.service.recordArtifactInstallation(consumer.job.id,consumer.step.id,receipt);
  assert.equal(f.service.overview(f.projectId).executions[0].activations.find(a=>a.nodeId==='consumer')!.artifactInstallations![0].consumerRunId,run.id);
  f.setAllowed(false);await assert.rejects(f.gateway.verifyInstallation(consumer.job.id,consumer.step.id,report));f.setAllowed(true);
  await fs.writeFile(path.join(f.root,f.projectId,f.output.id),Buffer.alloc(bytes.length));assert.equal((await fetch(input.url,{headers:{...headers,'If-Match':`"${checksum}"`}})).status,403);
 }finally{await f.close();}
});
test('HTTP grants deny unauthorized project, origin, method, metadata, revocation and expiry',async()=>{
 const f=await setup();try{
  for(const headers of [{...f.headers,Authorization:'Bearer wrong'},{...f.headers,'X-Project-Id':'other'},{...f.headers,Origin:'http://untrusted.local'}])assert.equal((await fetch(f.output.url,{method:'PUT',headers,body:bytes})).status,403);
  assert.equal((await fetch(f.output.url,{headers:f.headers})).status,405);
  assert.equal((await fetch(f.output.url+'?escape=1',{method:'PUT',headers:f.headers,body:bytes})).status,403);
  assert.equal((await fetch(f.output.url,{method:'PUT',headers:{...f.headers,'X-Build-Checksum':'invalid'},body:bytes})).status,400);
  f.setAllowed(false);assert.equal((await fetch(f.output.url,{method:'PUT',headers:f.headers,body:bytes})).status,403);f.setAllowed(true);
  f.gateway.revoke(f.producer.step.id);assert.equal((await fetch(f.output.url,{method:'PUT',headers:f.headers,body:bytes})).status,403);
  const renewed=(await f.gateway.grant(f.run.id,f.producer.step.id,f.base)).outputs[0];f.expire();assert.equal((await fetch(renewed.url,{method:'PUT',headers:{...f.headers,Authorization:`Bearer ${renewed.token}`},body:bytes})).status,403);
 }finally{await f.close();}
});
test('configured dummy credential upload is rejected and leaves no finalized bytes',async()=>{
 const f=await setup();try{const secret=Buffer.from('dummy-private-credential');assert.equal((await fetch(f.output.url,{method:'PUT',headers:{...f.headers,'X-Build-Size':String(secret.length),'X-Build-Checksum':createHash('sha256').update(secret).digest('hex')},body:secret})).status,403);assert.deepEqual(await fs.readdir(path.join(f.root,f.projectId)),[]);}finally{await f.close();}
});

test('v2 upload binds explicit executable policy and rejects missing or different headers',async()=>{
 const f=await setup(true);try{
  assert.equal(f.output.executable,true);
  for(const value of ['false','', '0777'])assert.equal((await fetch(f.output.url,{method:'PUT',headers:{...f.headers,'X-Build-Executable':value},body:bytes})).status,403);
  const result=await fetch(f.output.url,{method:'PUT',headers:f.headers,body:bytes});assert.equal(result.status,200);const {artifact}=await result.json();assert.equal(artifact.version,2);assert.equal(artifact.executable,true);assert.equal((await f.gateway.verifyOutputs(f.producer.job.id,f.producer.step.id))[0].executable,true);
 }finally{await f.close();}
});
