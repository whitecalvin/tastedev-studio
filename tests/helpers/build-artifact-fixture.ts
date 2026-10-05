import assert from 'node:assert/strict';
import {CoreService} from '../../src/features/core/service.ts';
import {InMemoryCoreRepository} from '../../src/features/core/repository.ts';
import type {Project} from '../../src/features/projects/types/project.ts';
import {GraphExecutionService} from '../../transport/graph-execution.ts';
import {initialGraph,newNode} from '../../src/features/orchestration/domain.ts';
import {TestOrchestrator} from '../../src/features/core/orchestrator.ts';
import {buildProjectSnapshot,projectReference} from '../../src/features/ai/project-snapshot.ts';

export async function artifactGraphFixture(enabled=true,executable?:boolean){
 const projectId=crypto.randomUUID(),core=new CoreService(new InMemoryCoreRepository(),{get:async id=>({id,name:'Artifacts'} as Project)},{buildArtifactRuntime:enabled});
 core.connectAgent('controlled',{name:'Controlled protocol peer',platform:'windows',architecture:'x86_64',capabilities:{sourceSnapshot:2,buildArtifacts:executable===undefined?1:2,cpuCores:2,memoryMiB:2048,docker:false,gpu:false,pty:false,runtimes:{node:'24'},browsers:[]}});
 const graph=initialGraph(projectId);graph.nodes.push({...newNode('agent','agent',0),reference:'controlled'},{...newNode('task','producer',1),reference:'build'},newNode('approval','review',2),{...newNode('task','consumer',3),reference:'verify'},{...newNode('role','deployment',4),role:'deployment'});
 graph.edges.push({id:'host',from:'current-pc',to:'agent',relation:'hosts'},{id:'make',from:'role-implementation',to:'producer',relation:'performs'},{id:'assign',from:'current-pc',to:'deployment',relation:'assigns'},{id:'use',from:'deployment',to:'consumer',relation:'performs'},{id:'built',from:'producer',to:'review',relation:'success'},{id:'approved',from:'review',to:'consumer',relation:'success'});
 const sources={'project.yml':JSON.stringify({version:1,project:{name:'Artifacts',type:'desktop'}}),'tasks.yml':JSON.stringify({build:{command:'node',env:{TASTEDEV_GRAPH_CONTEXT:'spoof'},artifacts:{outputs:[{name:'desktop',path:'out/app.exe',...(executable!==undefined?{executable}:{})}]}},verify:{command:'node',artifacts:{inputs:[{fromTask:'build',name:'desktop',path:'received/app.exe',...(executable!==undefined?{executable}:{})}]}}})};
 const {snapshot}=await buildProjectSnapshot({list:async()=>[{path:'test.cjs',name:'test.cjs',kind:'file'}],read:async()=>({content:'console.log(1)',size:14,modified:0})},{projectId,proposalId:crypto.randomUUID(),attempt:1,baseRevision:'controlled',changedFiles:[]});const reference=projectReference(snapshot);
 const service=new GraphExecutionService(core,(p,j)=>core.dispatch(p,j),(p,j)=>core.cancelJob(p,j),undefined,undefined,Date.now,async value=>{assert.deepEqual(value,reference);return snapshot;});const publish=()=>service.request(projectId,'publish',{graph,sources,snapshot:reference,expectedRevision:0},'user');
 const start=()=>{const d=service.overview(projectId).definition!;return service.request(projectId,'start',{revision:d.revision,checksum:d.checksum,entryNodeId:'producer',requestId:'artifacts'},'user');};
 return {projectId,core,service,graph,reference,sources,snapshot,publish,start,orchestrator:new TestOrchestrator(core)};
}
