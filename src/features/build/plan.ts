import {validateGraph,type ProjectGraph} from '../orchestration/domain.ts';
import {nativeBuildStages,validateNativeRecipe,type NativeBuildRecipe,type NativeBuildStage} from './domain.ts';
import type {CreateJob} from '../core/service.ts';
export function configureNativeGroup(graph:ProjectGraph,groupId:string,value:unknown):ProjectGraph{
 const recipe=validateNativeRecipe(value),parent=graph.nodes.find(n=>n.id===groupId&&n.kind==='build-package');if(!parent?.subflow)throw Error('Choose a build/package group.');
 const ordered:string[]=[],seen=new Set<string>();let id=parent.subflow.entryId;
 while(id&&!seen.has(id)){const n=graph.nodes.find(n=>n.id===id&&n.parentId===groupId&&n.kind==='task');if(!n)throw Error('Native build requires eight sequential task nodes.');seen.add(id);ordered.push(id);const next=graph.edges.filter(e=>e.from===id&&e.relation==='success');if(next.length>1)throw Error('Native build requires eight sequential task nodes.');id=next[0]?.to??'';}
 if(ordered.length!==8||ordered.at(-1)!==parent.subflow.exitId||graph.nodes.filter(n=>n.parentId===groupId).length!==8)throw Error('Native build requires eight sequential task nodes.');
 return validateGraph({...graph,nodes:graph.nodes.map(n=>n.id===groupId?{...n,nativeRecipe:recipe}:seen.has(n.id)?{...n,nativeStage:nativeBuildStages[ordered.indexOf(n.id)],reference:'',frameworkTask:undefined}:n)},graph.projectId);
}
export function nativeBuildJob(recipe:NativeBuildRecipe,stage:NativeBuildStage,groupId:string,executionId='preflight'):CreateJob{
 const step={name:'Native '+stage,executable:'internal-native-build',args:[],cwd:'.',nativeBuild:{version:1 as const,stage,executionId,groupId,recipe},timeoutMs:stage==='build'||stage==='test'?3600000:1800000};return{name:recipe.productId+': '+stage,requirements:{platform:recipe.platform,nativeBuild:1},payload:{task:'native:'+stage,steps:[step]}};
}
