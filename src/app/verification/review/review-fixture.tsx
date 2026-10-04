'use client';
import {useState} from 'react';
import {CoreProvider} from '@/features/core/context';
import {remoteCore} from '@/features/core/remote-client';
import {WorkspaceProvider} from '@/features/workspace/context';
import {WorkspaceShell} from '@/features/workspace/workspace';
import {FileSessionProvider} from '@/features/editor/session';
import {GitProvider} from '@/features/git/context';
import {RunProvider} from '@/features/process/context';
import {graphKey,saveGraph,validateGraph} from '@/features/orchestration/domain';
import type {Project} from '@/features/projects/types/project';

/** Development-only setup. Normal Core authentication/history/viewers remain in use. */
export function ReviewFixture(){
 const [id,setId]=useState(''),[graph,setGraph]=useState(''),[error,setError]=useState(''),[project,setProject]=useState<Project|null>(null);
 function open(){try{
  if(remoteCore.enabled)throw Error('Disconnect the current Core session before opening the isolated review workspace.');
  if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id)||graph.length>100000)throw Error('Enter the disposable Core project ID and its graph (maximum 100 KB).');
  const value=validateGraph(JSON.parse(graph),id);
  // Never replace another tab's saved graph, including a previous fixture setup.
  saveGraph(localStorage,value,null);
  const now=new Date().toISOString();setProject({id,name:'Isolated Core History Review',description:'Development-only actual persisted records. No automatic model, write or execution.',workspacePath:null,browserFolder:true,repositoryUrl:null,defaultBranch:null,framework:null,runtime:null,packageManager:null,projectType:value.projectKind,gitEnabled:null,createdAt:now,updatedAt:now,lastOpenedAt:null});setError('');
 }catch(e){setError(e instanceof Error?e.message:'Review setup failed.');}}
 if(!project)return <main className="core-fixture-banner"><h1>Isolated Core History Review</h1><p>Development only. Use a disposable Core database with existing real records. This does not register a Recent Project, connect a folder or approve any operation.</p><label>Disposable Core project ID<input value={id} onChange={e=>setId(e.target.value)}/></label><label>Published graph JSON<textarea rows={8} value={graph} onChange={e=>setGraph(e.target.value)}/></label><button className="button" onClick={open}>Open isolated review workspace</button>{error&&<p role="alert">{error}</p>}</main>;
 return <><p className="core-fixture-banner">DEVELOPMENT REVIEW — actual Core history; no automatic Provider/Patch/Test. No local folder connected. <button className="button" onClick={()=>{if(remoteCore.connectionKey.endsWith('\0'+project.id))remoteCore.disconnect();setProject(null);setError('The saved review graph is retained at '+graphKey(project.id)+'.');}}>Disconnect and close review</button></p><WorkspaceProvider projectId={project.id}><FileSessionProvider projectId={project.id}><GitProvider projectId={project.id} workspacePath={null}><RunProvider projectId={project.id}><CoreProvider project={project}><WorkspaceShell project={project}/></CoreProvider></RunProvider></GitProvider></FileSessionProvider></WorkspaceProvider></>;
}
