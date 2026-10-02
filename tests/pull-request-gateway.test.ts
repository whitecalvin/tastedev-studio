import test from 'node:test';import assert from 'node:assert/strict';
import {startCoreServer} from '../transport/server.ts';
import {RemoteCoreClient} from '../src/features/core/remote-client.ts';
import type {Project} from '../src/features/projects/types/project.ts';
import type {PullDraft,PullProvider,PullRequest,PullChecks} from '../src/features/git/pull-requests.ts';
test('actual local Core HTTP preserves PR approval, project/auth boundaries and current SHA CI identity',async()=>{
 const sha='a'.repeat(40);let posts=0,pull:PullRequest|undefined;
 const provider:PullProvider={async head(){return sha;},async list(){return pull?[pull]:[];},async create(repo,input){posts++;return pull={number:7,url:`https://github.com/${repo}/pull/7`,sha,title:input.title,body:input.body,state:'open',head:input.head,base:input.base};},async get(){return pull!;},async checks(){return {sha,state:'pending',checks:[{name:'Controlled CI',status:'completed',conclusion:'success'}],truncated:false};}};
 const token=crypto.randomUUID(),server=await startCoreServer({port:0,agentToken:token,studioToken:token,pullProvider:provider}),client=new RemoteCoreClient(),project={id:crypto.randomUUID(),name:'PR gateway fixture',repositoryUrl:'https://github.com/owner/repo.git'} as Project;
 try{client.connect(`ws://127.0.0.1:${server.port}/studio`,token,project);for(let i=0;i<100&&!client.connected;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(client.connected);
  const draft=await client.issueRequest<PullDraft>({action:'pr-build',prFields:{base:'main',head:'feature/fix',sha,title:'TEST local approval fixture',body:'Controlled, no external calls.'}},project.id);assert.equal(posts,0);assert.equal(draft.status,'reviewing');
  const denied=await fetch(`http://127.0.0.1:${server.port}/issues/request`,{method:'POST',headers:{'X-Project-Id':project.id},body:JSON.stringify({action:'pr-approve-create',id:draft.id})});assert.equal(denied.status,401);
  const foreign=await fetch(`http://127.0.0.1:${server.port}/issues/request`,{method:'POST',headers:{Authorization:'Bearer '+token,'X-Project-Id':crypto.randomUUID()},body:JSON.stringify({action:'pr-approve-create',id:draft.id})});assert.equal(foreign.status,400);assert.equal(posts,0);
  const result=await client.issueRequest<PullDraft>({action:'pr-approve-create',id:draft.id},project.id);assert.equal(result.status,'linked');assert.equal(posts,1);await assert.rejects(client.issueRequest({action:'pr-approve-create',id:draft.id},project.id));assert.equal(posts,1);
  const status=await client.issueRequest<{draft:PullDraft;checks:PullChecks}>({action:'pr-status',id:draft.id},project.id);assert.equal(status.draft.pull!.sha,status.checks.sha);assert.equal(status.checks.checks[0].conclusion,'success');assert.equal(status.checks.state,'pending');
 }finally{client.disconnect();await server.close();}
});
