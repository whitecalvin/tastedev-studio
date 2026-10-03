'use client';
import {useState} from 'react';
import {GraphNodeControls} from '@/features/orchestration/node-controls';
import {initialGraph,newNode} from '@/features/orchestration/domain';
import type {GraphOverview} from '@/features/orchestration/execution';

const graph=initialGraph('controlled-ui');
graph.nodes.push({...newNode('approval','gate',1),label:'Deployment approval'});
function fixture():GraphOverview{return {durable:false,definition:{graph,projectId:graph.projectId,revision:1,checksum:'dummy-graph',inputChecksum:'dummy-input',agents:{},publishedAt:'fixture'},executions:[{id:'controlled-execution',projectId:graph.projectId,revision:1,checksum:'dummy-graph',inputChecksum:'dummy-input',status:'running',actor:'fixture',createdAt:'fixture',deadline:'fixture',nodeLabels:{gate:'Deployment approval'},activations:[{id:'activation-1',nodeId:'gate',attempt:1,status:'approval'}]}]};}
export function GraphControlFixture(){
 const [overview,setOverview]=useState(fixture),[connected,setConnected]=useState(true),[dirty,setDirty]=useState(false),[record,setRecord]=useState('No control request');
 const execution=overview.executions[0];
 function change(update:(value:GraphOverview)=>void){setOverview(previous=>{const next=structuredClone(previous);update(next);return next;});}
 return <main className="orch-view"><h1>Controlled execution UI verification</h1><p>Dummy state only. No Core, Agent or deployment requests are sent.</p><div className="orch-control-actions">
  <button className="fs-button" onClick={()=>{setOverview(fixture());setConnected(true);setDirty(false);setRecord('No control request');}}>Reset approval</button>
  <button className="fs-button" onClick={()=>change(v=>{v.executions[0].activations=[{id:'activation-2',nodeId:'gate',attempt:2,status:'approval'}];})}>Next attempt</button>
  <button className="fs-button" onClick={()=>change(v=>{v.executions[0].status='paused';})}>Pause fixture</button>
  <button className="fs-button" onClick={()=>setDirty(v=>!v)}>Toggle dirty</button>
  <button className="fs-button" onClick={()=>setConnected(v=>!v)}>Toggle connection</button>
 </div><aside className="orch-inspector" style={{height:'auto',maxWidth:360,marginTop:20}}><GraphNodeControls graph={graph} overview={overview} executionId={execution.id} nodeId="gate" connected={connected} session={1} dirty={dirty} busy={false} message="" onAction={async(action,input)=>{setRecord(JSON.stringify({action,input}));change(v=>{if(action==='approve')v.executions[0].activations[0].status='passed';else v.executions[0].status=action==='cancel'?'cancelled':'running';});}}/></aside><output aria-label="Control request">{record}</output><p>Fixture state: {execution.status}; dirty: {String(dirty)}</p></main>;
}
