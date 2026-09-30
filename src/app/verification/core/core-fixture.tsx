'use client';
import {useState} from 'react';
import {CoreProvider} from '@/features/core/context';
import {CoreService} from '@/features/core/service';
import {InMemoryCoreRepository} from '@/features/core/repository';
import type {Project} from '@/features/projects/types/project';
import {WorkspaceProvider} from '@/features/workspace/context';
import {WorkspaceShell} from '@/features/workspace/workspace';
import {FileSessionProvider} from '@/features/editor/session';
import {GitProvider} from '@/features/git/context';
import {RunProvider} from '@/features/process/context';
const base:Project={id:'core-fixture-a',name:'Core fixture A',description:'Development-only controlled records. No remote execution.',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:null,gitEnabled:null,createdAt:'2026-09-30T00:00:00Z',updatedAt:'2026-09-30T00:00:00Z',lastOpenedAt:null};
export function CoreFixture(){const [project,setProject]=useState(base);const [loaded,setLoaded]=useState(false);const [core]=useState(()=>new CoreService(new InMemoryCoreRepository(),{async get(id){return {...base,id};}}));
async function load(){const a=core.registerAgent({name:'Controlled Linux Agent',platform:'linux',architecture:'x86_64',capabilities:{cpuCores:8,memoryMiB:16384,docker:true,gpu:false,pty:true,runtimes:{node:'24.11.1',rust:'1.98'},browsers:['chromium']}});core.updateAgentStatus(a.id,'idle');
 const make=(name:string)=>({name,requirements:{platform:'linux' as const},payload:{task:name,steps:['Checkout','Install','Build','Test'].map(name=>({name,executable:'node',args:[],cwd:'.'}))}});
 for(const success of [true,false]){await core.createJob(base.id,make(success?'Controlled passing run':'Controlled failing run'));const result=core.dispatch(base.id)!;core.startRun(base.id,result.run.id);const steps=core.snapshot(base.id).steps.filter(s=>s.runId===result.run.id);for(const s of steps){core.changeStep(base.id,result.run.id,s.id,'running');core.changeStep(base.id,result.run.id,s.id,success?'passed':'failed',success?0:1);if(!success)break;}if(success)core.finishRun(base.id,result.run.id,'passed',0,'Controlled test result; no command executed.');}
 await core.createJob(base.id,make('Controlled pending run'));core.dispatch(base.id);await core.createJob(base.id,{...make('Controlled queued job'),requirements:{platform:'windows'}});await core.createJob('core-fixture-b',make('Project B only'));setLoaded(true);}
return <><div className="core-fixture-banner">DEVELOPMENT FIXTURE — simulated Core records; no agent connection or command execution. <button className="button" disabled={loaded} onClick={()=>void load()}>Load controlled records</button> <button className="button" onClick={()=>setProject(project.id===base.id?{...base,id:'core-fixture-b',name:'Core fixture B'}:base)}>Switch fixture project</button></div><WorkspaceProvider key={project.id} projectId={project.id}><FileSessionProvider projectId={project.id}><GitProvider projectId={project.id} workspacePath={null}><RunProvider projectId={project.id}><CoreProvider project={project} service={core}><WorkspaceShell project={project}/></CoreProvider></RunProvider></GitProvider></FileSessionProvider></WorkspaceProvider></>;
}
