import {verifyArtifactInstallation} from '../src/features/orchestration/artifact-installation.ts';
import {createHash,randomBytes} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {CoreService} from '../src/features/core/service.ts';
import {BUILD_ARTIFACT_LIMIT,artifactProtocolVersion,type BuildArtifact,type BuildArtifactOrigin} from '../src/features/orchestration/build-artifact.ts';
import type {GraphExecutionService} from './graph-execution.ts';
import {BuildArtifactStore} from './build-artifact-store.ts';

export const buildArtifactId=(origin:BuildArtifactOrigin,name:string)=>createHash('sha256').update(JSON.stringify([origin.producerRunId,origin.producerStepId,name])).digest('hex');
interface Grant {served?:boolean;kind:'upload'|'download';jobId:string;runId:string;stepId:string;agentId:string;projectId:string;name:string;path:string;fromTask?:string;origin:BuildArtifactOrigin;id:string;expires:number;executable?:boolean}
export interface BuildArtifactTransfer {
 version:1|2;
 outputs:{name:string;path:string;id:string;url:string;token:string;executable?:boolean}[];
 inputs:{name:string;path:string;artifact:BuildArtifact;url:string;token:string}[];
}
export function buildArtifactGateway(core:CoreService,graph:GraphExecutionService,root:string,origins:string[],agentAllowed:(project:string,agent:string,job:string)=>boolean=()=>true,now=Date.now,credentialValues:string[]=[]){
 const store=new BuildArtifactStore(root),grants=new Map<string,Grant>();
 const same=(a:BuildArtifactOrigin,b:BuildArtifactOrigin)=>(['projectId','executionId','graphRevision','producerActivationId','producerNodeId','producerRunId','producerStepId','snapshotId','sourceChecksum'] as const).every(k=>a[k]===b[k]);
 function check(g:Grant,token?:string){
  if(token&&grants.get(token)!==g)throw Error('Build grant revoked.');
  if(g.expires<=now()||!agentAllowed(g.projectId,g.agentId,g.jobId))throw Error('Build grant expired or revoked.');
  const snap=core.snapshot(g.projectId,undefined,g.runId),run=snap.runs.find(r=>r.id===g.runId&&r.jobId===g.jobId&&r.agentId===g.agentId);if(!run)throw Error('Build grant Run changed.');
  const current=graph.buildArtifactOrigin(g.jobId,g.stepId);
  if(g.kind==='upload'){if(!same(current.origin,g.origin)||!current.declaration.outputs.some(o=>o.name===g.name&&o.path===g.path))throw Error('Build output scope changed.');}
  else if(!current.declaration.inputs.some(i=>i.fromTask===g.fromTask&&i.name===g.name&&i.path===g.path)||!same(graph.buildArtifactProducer(g.jobId,g.stepId,g.fromTask!,g.name),g.origin))throw Error('Build input scope changed.');
 }
 function revoke(stepId:string){for(const [token,g] of grants)if(g.stepId===stepId)grants.delete(token);}
 async function verifyOutputs(jobId:string,stepId:string){
  const {origin,declaration}=graph.buildArtifactOrigin(jobId,stepId),outputs:BuildArtifact[]=[];
  for(const output of declaration.outputs){
   const saved=await store.get(origin.projectId,buildArtifactId(origin,output.name));
   if(!same(saved.artifact,origin)||saved.artifact.name!==output.name||saved.artifact.path!==output.path||saved.artifact.executable!==output.executable)throw Error('Required build output missing or changed.');outputs.push(saved.artifact);
  }
  graph.buildArtifactOrigin(jobId,stepId);return outputs;
 }
 async function verifyInstallation(jobId:string,stepId:string,value:unknown){
  const {origin,declaration}=graph.buildArtifactOrigin(jobId,stepId),run=core.snapshot(origin.projectId).runs.find(r=>r.id===origin.producerRunId)!;
  if(!agentAllowed(origin.projectId,run.agentId,jobId))throw Error('Installation Agent revoked.');
  const inputs=[];
  for(const input of declaration.inputs){const producer=graph.buildArtifactProducer(jobId,stepId,input.fromTask,input.name),id=buildArtifactId(producer,input.name);
   if(![...grants.values()].some(g=>g.kind==='download'&&g.served&&g.jobId===jobId&&g.stepId===stepId&&g.agentId===run.agentId&&g.id===id&&g.path===input.path&&same(g.origin,producer)))throw Error('Installation input was not granted.');
   const saved=await store.get(origin.projectId,id);if(!same(saved.artifact,producer))throw Error('Installation producer mismatch.');inputs.push({path:input.path,artifact:saved.artifact});
  }
  graph.buildArtifactOrigin(jobId,stepId);if(!agentAllowed(origin.projectId,run.agentId,jobId))throw Error('Installation Agent revoked.');
  return verifyArtifactInstallation(value,{projectId:origin.projectId,executionId:origin.executionId,graphRevision:origin.graphRevision,snapshotId:origin.snapshotId,sourceChecksum:origin.sourceChecksum,consumerActivationId:origin.producerActivationId,consumerNodeId:origin.producerNodeId,consumerRunId:run.id,consumerStepId:stepId,agentId:run.agentId,inputs},new Date(now()).toISOString());
 }
 async function grant(runId:string,stepId:string,base:string):Promise<BuildArtifactTransfer> {
  const run=(core.repository.readEntity?.('runs',runId)??core.repository.read().runs.find(r=>r.id===runId));if(!run)throw Error('Build grant Run missing.');
  const context=graph.buildArtifactOrigin(run.jobId,stepId),url=new URL(base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Invalid Core build endpoint.');
  const transfer:BuildArtifactTransfer={version:artifactProtocolVersion(context.declaration),outputs:[],inputs:[]},pending:[string,Grant][]=[];
  for(const g of [...grants])if(g[1].expires<=now())grants.delete(g[0]);
  if(grants.size+context.declaration.outputs.length+context.declaration.inputs.length>512)throw Error('Build grant capacity.');
  const make=(g:Omit<Grant,'expires'>)=>{const token=randomBytes(32).toString('hex'),value={...g,expires:now()+300000};check(value);pending.push([token,value]);const endpoint=new URL(url);endpoint.pathname=`/build-artifacts/${g.kind}/${g.id}`;return{token,url:endpoint.href};};
  for(const output of context.declaration.outputs){const id=buildArtifactId(context.origin,output.name);transfer.outputs.push({...output,id,...make({kind:'upload',jobId:run.jobId,runId,stepId,agentId:run.agentId,projectId:run.projectId,...output,origin:context.origin,id})});}
  for(const input of context.declaration.inputs){const origin=graph.buildArtifactProducer(run.jobId,stepId,input.fromTask,input.name),id=buildArtifactId(origin,input.name),saved=await store.get(run.projectId,id);
   if(!same(saved.artifact,origin)||saved.artifact.name!==input.name||saved.artifact.executable!==input.executable)throw Error('Stored build artifact producer mismatch.');
   transfer.inputs.push({name:input.name,path:input.path,artifact:saved.artifact,...make({kind:'download',jobId:run.jobId,runId,stepId,agentId:run.agentId,projectId:run.projectId,...input,origin,id})});
  }
  for(const [,g] of pending)check(g);for(const [token,g] of pending)grants.set(token,g);return transfer;
 }
 async function handle(req:IncomingMessage,res:ServerResponse){
  const json=(code:number,value:unknown)=>{if(!res.headersSent)res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  try{
   if(req.headers.origin&&!origins.includes(req.headers.origin)){json(403,{error:'BUILD_FORBIDDEN'});return;}
   if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET,PUT,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,X-Project-Id,X-Build-Size,X-Build-Checksum,X-Build-Executable,Content-Type,If-Match');res.writeHead(204).end();return;}
   const token=(req.headers.authorization??'').replace(/^Bearer /,''),g=grants.get(token),route=/^\/build-artifacts\/(upload|download)\/([a-f0-9]{64})$/.exec(req.url??'');
   if(!g||!route||route[1]!==g.kind||route[2]!==g.id||req.headers['x-project-id']!==g.projectId){json(403,{error:'BUILD_GRANT_INVALID'});return;}
   check(g,token);req.setTimeout(15000,()=>req.destroy());
   if(g.kind==='upload'&&req.method==='PUT'){
    if(g.executable!==undefined?req.headers['x-build-executable']!==String(g.executable):req.headers['x-build-executable']!==undefined)throw Error('Build executable policy mismatch.');
    const sizeText=String(req.headers['x-build-size']??''),checksum=String(req.headers['x-build-checksum']??'');if(!/^[1-9][0-9]{0,9}$/.test(sizeText)||Number(sizeText)>BUILD_ARTIFACT_LIMIT||!/^[a-f0-9]{64}$/.test(checksum)||req.headers['content-length']!==undefined&&Number(req.headers['content-length'])!==Number(sizeText)){json(400,{error:'BUILD_METADATA_INVALID'});return;}
    const context=core.snapshot(g.projectId,undefined,g.runId),job=context.jobs.find(j=>j.id===g.jobId)!,secrets=job.payload.steps.flatMap(s=>Object.entries(s.env??{}).filter(([key])=>key!=='TASTEDEV_GRAPH_CONTEXT').map(([,value])=>value));
    const artifact=await store.put({...g.origin,version:g.executable===undefined?1:2,...(g.executable!==undefined?{executable:g.executable}:{}),id:g.id,name:g.name,path:g.path,size:Number(sizeText),checksum},req,[...new Set([...secrets,...credentialValues,token])],()=>check(g,token));check(g,token);json(200,{artifact});return;
   }
   if(g.kind==='download'&&req.method==='GET'){
    const saved=await store.get(g.projectId,g.id);check(g,token);if(!same(saved.artifact,g.origin)||saved.artifact.name!==g.name)throw Error('Build stored scope mismatch.');
    if(req.headers['if-match']!==`"${saved.artifact.checksum}"`){json(412,{error:'BUILD_PRECONDITION'});return;}
    res.once('finish',()=>{g.served=true;});
    res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':saved.bytes.length,ETag:`"${saved.artifact.checksum}"`,'Content-Disposition':`attachment; filename="${saved.artifact.name}.bin"`});res.end(saved.bytes);return;
   }
   json(405,{error:'BUILD_METHOD_INVALID'});
  }catch{json(403,{error:'BUILD_TRANSFER_REJECTED'});}
 }
 return {grant,revoke,verifyOutputs,verifyInstallation,handle,store};
}
