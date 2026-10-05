import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {startCoreServer} from '../transport/server.ts';

test('actual Core HTTP router supports artifact runtime and rejects credentials without scoped grants',async()=>{
 const parent=path.resolve('../../../resources/verification/dev-01/tasks/tastedev-studio/build-artifact-server-20261005/fixtures');await fs.mkdir(parent,{recursive:true});const root=await fs.mkdtemp(path.join(parent,'server-'));
 const token='dummy-build-server-test-token',server=await startCoreServer({port:0,artifactRoot:path.join(root,'artifacts'),agentToken:token,studioToken:token});
 try{
  assert.equal(server.service.supportsBuildArtifacts(),true);
  for(const method of ['GET','PUT']){
   const response=await fetch(`http://127.0.0.1:${server.port}/build-artifacts/${method==='GET'?'download':'upload'}/${'a'.repeat(64)}`,{method,headers:{Authorization:`Bearer ${token}`,'X-Project-Id':'other'}});
   assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'BUILD_GRANT_INVALID'});
  }
  const health=await fetch(`http://127.0.0.1:${server.port}/health/ready`);assert.equal(health.status,200);
 }finally{await server.close();await fs.rm(root,{recursive:true,force:true});}
});
