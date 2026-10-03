'use client';
import { CustomSelect } from '@/components/ui/custom-select';
import {GraphRuntime} from './runtime-view';
import {graphMonitor} from './monitor';
import {arrangeGraph} from './layout';
import {useAIConfigurations,AIConfigurationPanel,TaskAIConfiguration} from './ai-config-panel';
import type {GraphOverview} from './execution';
import { useEffect, useRef, useState } from 'react';
import { Network, Monitor, Bot, ShieldCheck, Play, Clock, Briefcase, Plus, Save } from 'lucide-react';
import { useCore } from '../core/context';
import { useProtocol } from '../protocol/views';
import { useScheduler } from '../scheduler/views';
import { useWorkspace } from '../workspace/context';
import { useI18n } from '@/i18n/react';
import { graphKey, initialGraph, loadGraph, saveGraph, validateGraph, newNode, removeNode, nodeKinds, projectKinds, roles, relations, type ProjectGraph, type GraphNode, type NodeKind, type ProjectKind, type Relation, type Role } from './domain';
const icons = {device:Monitor, agent:Bot, role:Briefcase, task:Play, approval:ShieldCheck, schedule:Clock};
function edgeRoute(graph:ProjectGraph,from:string,to:string,relation:Relation) {
  const a=graph.nodes.find(n=>n.id===from)!,b=graph.nodes.find(n=>n.id===to)!;
  if(relation==='failure') {
    const lane=Math.max(...graph.nodes.map(n=>n.y+126))+30,left=Math.max(8,Math.min(...graph.nodes.map(n=>n.x))-20);
    return {path:`M${a.x+110},${a.y+126} V${lane} H${left} V${b.y+65} H${b.x}`,x:(a.x+110+left)/2,y:lane-8};
  }
  if(a.x===b.x&&b.y>a.y+126) return {path:`M${a.x+110},${a.y+126} V${b.y}`,x:a.x+180,y:(a.y+126+b.y)/2};
  const backwards=b.x<a.x,x=backwards?a.x:a.x+220,tx=backwards?b.x+220:b.x,y=a.y+65,ty=b.y+65;
  const obstructed=!backwards&&graph.nodes.some(n=>n.id!==from&&n.id!==to&&n.x>x&&n.x<tx&&n.y<Math.max(y,ty)&&n.y+126>Math.min(y,ty));
  if(obstructed) { const lane=Math.max(8,Math.min(a.y,b.y)-25);return {path:`M${a.x+110},${a.y} V${lane} H${b.x+110} V${b.y}`,x:(a.x+b.x+220)/2,y:lane-4}; }
  return {path:`M${x},${y} C${x+(backwards?-70:70)},${y} ${tx+(backwards?70:-70)},${ty} ${tx},${ty}`,x:(x+tx)/2,y:(y+ty)/2-10};
}

export function OrchestrationSidebar() {
  const {t}=useI18n(),{dispatch}=useWorkspace(),core=useCore();
  return <div className="orch-sidebar"><Network size={25}/><h3>{t('Project orchestration')}</h3><p>{t('Devices, roles and work are connected here. Files are supporting tools.')}</p><p>{core.connection.connected?t('Connected to Core'):t('Connect to Core in Agents.')}</p>{(['agents','run','tests','scheduler','queue','runs','explorer'] as const).map(value=><button className="fs-button" key={value} onClick={()=>dispatch({type:'activity',value})}>{t({agents:'Agents',run:'Run',tests:'Tests',scheduler:'Scheduler',queue:'Queue',runs:'Runs',explorer:'Explorer'}[value])}</button>)}</div>;
}
export function OrchestrationView() {
  const {t}=useI18n(),core=useCore(),protocol=useProtocol(),scheduler=useScheduler(),{dispatch}=useWorkspace();
  const type=projectKinds.includes(core.project.projectType as ProjectKind)?core.project.projectType as ProjectKind:'custom';
  const aiConfigurations=useAIConfigurations(core.project.id);
  const [graph,setGraph]=useState(()=>initialGraph(core.project.id,type,core.project.initialRoles));
  const [selected,setSelected]=useState('current-pc'),[ready,setReady]=useState(false),[locked,setLocked]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState('');
  const [addKind,setAddKind]=useState<NodeKind>('device'),[target,setTarget]=useState(''),[relation,setRelation]=useState<Relation>('success');
  const [zoom,setZoom]=useState(1);
  const [liveOverview,setLiveOverview]=useState<GraphOverview|null>(null),[executionId,setExecutionId]=useState('');
  const [controlTarget,setControlTarget]=useState<HTMLDivElement|null>(null);
  const monitor=graphMonitor(graph,liveOverview,executionId);
  const activation=monitor.nodes.get(selected);
  const activeRun=activation?.runId?core.snapshot.runs.find(r=>r.id===activation.runId&&r.projectId===graph.projectId):undefined;
  const baseline=useRef<string|null>(null);
  const drag=useRef<{id:string;x:number;y:number;px:number;py:number}|null>(null);
  useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(!active)return;try{const saved=loadGraph(localStorage,core.project.id);baseline.current=localStorage.getItem(graphKey(core.project.id));if(saved){setGraph(saved);setSelected(saved.nodes[0]?.id??'');}else setDirty(true);}catch(error){setLocked(true);setMessage(error instanceof Error?error.message:'Graph storage unavailable.');}setReady(true);});return()=>{active=false;};},[core.project.id]);
  function change(next:ProjectGraph){try{setGraph(validateGraph(next,core.project.id));setDirty(true);setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'Invalid graph.');}}
  const node=graph.nodes.find(n=>n.id===selected);
  const tasks=protocol.state.status==='Valid'?protocol.state.definition.tasks:{};
  const tests=protocol.state.status==='Valid'?protocol.state.definition.tests:{};
  function update(patch:Partial<GraphNode>){change({...graph,nodes:graph.nodes.map(n=>n.id===selected?{...n,...patch}:n)});}
  function status(n:GraphNode){
    if(n.kind==='agent')return core.connection.connected&&n.reference?core.snapshot.agents.find(a=>a.id===n.reference)?.status??'Reference unavailable':'Not connected';
    if(n.kind==='task')return !n.reference?'Choose a Protocol reference':Object.hasOwn(n.taskType==='test'?tests:tasks,n.reference)?'Defined':'Reference unavailable';
    if(n.kind==='schedule')return n.reference?scheduler.snapshot?.schedules.find(s=>s.id===n.reference)?.status??'Reference unavailable':'Not configured';
    return n.kind==='device'?'Declared device':n.kind==='approval'?'Review required':'Configured role';
  }
  const destinations=node?graph.nodes.filter(n=>n.id!==node.id&&relations(node.kind,n.kind).length):[];
  const destination=destinations.find(n=>n.id===target),allowed=node&&destination?relations(node.kind,destination.kind):[];
  const selectedRelation=allowed.includes(relation)?relation:allowed[0];
  const width=Math.max(1120,...graph.nodes.map(n=>n.x+250)),height=Math.max(600,...graph.nodes.map(n=>n.y+180));
  return <main id="orchestration-content" tabIndex={-1} className="orch-view" aria-label={t('Project orchestration')}>
    <header className="orch-heading"><div><span className="orch-eyebrow">TASTESTUDIO / {core.project.name}</span><h1>{t('Project orchestration')}</h1><p>{t('Connect devices, roles, agents and the implementation → deployment → testing flow.')}</p></div><button className="button primary" disabled={!ready||locked||!dirty} onClick={()=>{try{saveGraph(localStorage,graph,baseline.current);baseline.current=localStorage.getItem(graphKey(graph.projectId));setDirty(false);setMessage('Graph saved. No work was executed.');}catch(error){setMessage(error instanceof Error?error.message:'Graph could not be saved. Your draft is preserved.');}}}><Save size={15}/>{t('Save graph')}</button></header>
    <div className="orch-summary"><span>{t('Devices')}: {graph.nodes.filter(n=>n.kind==='device').length}</span><span>{t('Roles')}: {graph.nodes.filter(n=>n.kind==='role').length}</span><span>{t('Connected agents')}: {core.connection.connected?core.snapshot.agents.filter(a=>a.status!=='offline').length:0}</span><span>{t('Relationships')}: {graph.edges.length}</span><span>{dirty?t('Unsaved graph'):t('Saved / initial configuration')}</span></div>
    <p className="orch-notice">{t('Saving a graph does not run work. Publish validates saved Protocol and Agent assignments; start requires review.')}</p>
    {message&&<p role={locked?'alert':'status'} className="orch-notice">{t(message)}</p>}
    <div className="orch-toolbar"><label>{t('Project kind')}<CustomSelect value={graph.projectKind} disabled={!ready||locked} onChange={e=>change({...graph,projectKind:e.target.value as ProjectKind})}>{projectKinds.map(k=><option key={k} value={k}>{t(k)}</option>)}</CustomSelect></label><label>{t('Add node')}<CustomSelect value={addKind} onChange={e=>setAddKind(e.target.value as NodeKind)}>{nodeKinds.map(k=><option key={k} value={k}>{t(k)}</option>)}</CustomSelect></label><button className="fs-button" disabled={!ready||locked||graph.nodes.length>=60} onClick={()=>{let index=0;let n=newNode(addKind,crypto.randomUUID(),index);while(graph.nodes.some(v=>Math.abs(v.x-n.x)<240&&Math.abs(v.y-n.y)<146)&&index<44){index++;n={...n,...newNode(addKind,n.id,index)};}change({...graph,nodes:[...graph.nodes,n]});setSelected(n.id);}}><Plus size={14}/>{t('Add node')}</button><button className="fs-button" disabled={!ready||locked||graph.nodes.length===0} onClick={()=>change(arrangeGraph(graph))}>{t('Arrange flow')}</button><label>{t('Zoom')}<CustomSelect value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={0.5}>50%</option><option value={0.75}>75%</option><option value={1}>100%</option><option value={1.25}>125%</option></CustomSelect></label><span>{t('Drag the handle to move a node. Arrow keys also move it.')}</span></div>
    <AIConfigurationPanel state={aiConfigurations} nodes={graph.nodes}/>
    <section className="orch-monitor" aria-label={t('Execution monitoring')}>
      <label>{t('Core graph execution')}<CustomSelect value={monitor.execution?.id??''} disabled={!liveOverview?.executions.length} onChange={e=>setExecutionId(e.target.value)}>
        {!liveOverview?.executions.length&&<option value="">{t('Not configured')}</option>}
        {liveOverview?.executions.filter(e=>e.projectId===graph.projectId).toReversed().map(e=><option key={e.id} value={e.id}>{e.id.slice(0,8)} · v{e.revision} · {t(e.status)}</option>)}
      </CustomSelect></label>
      <p role="status">{!liveOverview?t('Connect to Core in Agents.'):!monitor.execution?t('No execution has been recorded.'):!monitor.compatible?t('This execution differs from the current graph. Node states are hidden.'):t(monitor.execution.status)}</p>
    </section>
    <div className="orch-body"><div className="orch-scroll" tabIndex={0} aria-label={t('Relationship canvas')}><div style={{width:width*zoom,height:height*zoom}}><div className="orch-canvas" style={{width,height,transform:`scale(${zoom})`,transformOrigin:"0 0"}}>
      <svg width={width} height={height} aria-hidden="true"><defs><marker id="orch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>{graph.edges.map(edge=>{const route=edgeRoute(graph,edge.from,edge.to,edge.relation);return <g key={edge.id} className={`orch-edge ${edge.relation==='failure'?'failure':''}`}><path d={route.path} markerEnd="url(#orch-arrow)"/><text x={route.x} y={route.y} textAnchor="middle">{t(edge.relation)}</text></g>;})}</svg>
      {graph.nodes.map(n=>{const Icon=icons[n.kind];return <article key={n.id} className={`orch-node ${n.kind} ${selected===n.id?'selected':''}`} style={{left:n.x,top:n.y}}><button className="orch-node-handle" aria-label={t('Move {label}',{label:n.label})} disabled={locked||!ready} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:n.id,x:n.x,y:n.y,px:e.clientX,py:e.clientY};setSelected(n.id);}} onPointerMove={e=>{const d=drag.current;if(d?.id===n.id)change({...graph,nodes:graph.nodes.map(v=>v.id===n.id?{...v,x:Math.max(0,Math.min(2800,d.x+(e.clientX-d.px)/zoom)),y:Math.max(0,Math.min(1800,d.y+(e.clientY-d.py)/zoom))}:v)});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={e=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(delta){e.preventDefault();change({...graph,nodes:graph.nodes.map(v=>v.id===n.id?{...v,x:Math.max(0,Math.min(2800,v.x+delta[0])),y:Math.max(0,Math.min(1800,v.y+delta[1]))}:v)});}}}><Icon size={16}/>{t(n.kind)}<span>⋮⋮</span></button><button className="orch-node-content" aria-pressed={selected===n.id} onClick={()=>{setSelected(n.id);setTarget('');}}><strong>{t(n.label)}</strong><small className={monitor.nodes.has(n.id)?`orch-node-state ${monitor.nodes.get(n.id)!.status}`:undefined}>{monitor.nodes.has(n.id)?`${t(monitor.nodes.get(n.id)!.status)} · ${t("Attempt")} ${monitor.nodes.get(n.id)!.attempt}`:t(status(n))}</small>{n.kind==='task'&&aiConfigurations.store.bindings[n.id]&&<small>AI: {aiConfigurations.store.profiles.find(p=>p.id===aiConfigurations.store.bindings[n.id])?.name}</small>}{n.reference&&<small>{n.reference}</small>}</button></article>;})}
      {!graph.nodes.length&&<p className="orch-empty">{t('Add a device and its roles to begin.')}</p>}
    </div></div></div>
    <aside className="orch-inspector" aria-label={t('Node settings')}><h2>{t('Node settings')}</h2><div ref={setControlTarget}/>{activation&&<section className="orch-node-execution" aria-label={t('Execution monitoring')}><strong>{t(activation.status)} · {t('Attempt')} {activation.attempt}</strong>{activation.agentId&&<p>Agent: {activation.agentId}</p>}{activation.reason&&<p>{activation.reason}</p>}{activeRun&&<p>{t(activeRun.status)} · {activeRun.id.slice(0,8)}</p>}{activation.runId&&<button className="fs-button" onClick={()=>{core.select({kind:'run',id:activation.runId!});dispatch({type:'activity',value:'runs'});}}>{t('Open Run')}</button>}</section>}{!node?<p>{t('Select a node to configure its relationships.')}</p>:<><label>{t('Name')}<input value={node.label} maxLength={120} disabled={locked} onChange={e=>update({label:e.target.value})}/></label><p>{t(status(node))}</p>
      {node.kind==='task'&&<TaskAIConfiguration state={aiConfigurations} node={node}/>}
      {node.kind==='role'&&<label>{t('Role')}<CustomSelect value={node.role} disabled={locked} onChange={e=>update({role:e.target.value as Role})}>{roles.map(r=><option key={r} value={r}>{t(r)}</option>)}</CustomSelect></label>}
      {node.kind==='agent'&&<label>{t('Agent binding')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Not connected')}</option>{node.reference&&!core.snapshot.agents.some(a=>a.id===node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{core.snapshot.agents.map(a=><option key={a.id} value={a.id}>{a.name} · {t(a.status)}</option>)}</CustomSelect></label>}
      {node.kind==='task'&&<><label>{t('Execution definition')}<CustomSelect value={node.taskType} disabled={locked} onChange={e=>update({taskType:e.target.value as 'task'|'test',reference:''})}><option value="task">{t('Task')}</option><option value="test">{t('Test')}</option></CustomSelect></label><label>{t('Protocol reference')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Choose a Protocol reference')}</option>{node.reference&&!Object.hasOwn(node.taskType==='test'?tests:tasks,node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{Object.keys(node.taskType==='test'?tests:tasks).map(name=><option key={name}>{name}</option>)}</CustomSelect></label><button className="fs-button" onClick={()=>dispatch({type:'activity',value:node.taskType==='test'?'tests':'run'})}>{t('Open execution settings')}</button></>}
      {node.kind==='schedule'&&<><label>{t('Schedule binding')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Not configured')}</option>{node.reference&&!scheduler.snapshot?.schedules.some(s=>s.id===node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{scheduler.snapshot?.schedules.map(s=><option key={s.id} value={s.id}>{s.name} · {t(s.status)}</option>)}</CustomSelect></label><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'scheduler'})}>{t('Open Scheduler')}</button></>}
      {node.kind==='device'&&<p>{t('Device membership is declared here. It is not inferred from an Agent ID.')}</p>}{node.kind==='approval'&&<p>{t('This node expresses a review gate. It does not grant execution or write permission.')}</p>}
      <hr/><h3>{t('Connect to')}</h3><label>{t('Target node')}<CustomSelect value={target} disabled={locked} onChange={e=>setTarget(e.target.value)}><option value="">{t('Select a node')}</option>{destinations.map(n=><option key={n.id} value={n.id}>{t(n.label)} · {t(n.kind)}</option>)}</CustomSelect></label><label>{t('Relationship')}<CustomSelect value={selectedRelation??''} disabled={locked||!allowed.length} onChange={e=>setRelation(e.target.value as Relation)}>{allowed.map(r=><option key={r} value={r}>{t(r)}</option>)}</CustomSelect></label><button className="fs-button" disabled={locked||!destination||!selectedRelation} onClick={()=>change({...graph,edges:[...graph.edges,{id:crypto.randomUUID(),from:node.id,to:target,relation:selectedRelation}]})}>{t('Add relationship')}</button>
      <ul className="orch-links">{graph.edges.filter(e=>e.from===node.id||e.to===node.id).map(e=><li key={e.id}><span>{t(graph.nodes.find(n=>n.id===e.from)!.label)} → {t(graph.nodes.find(n=>n.id===e.to)!.label)}<small>{t(e.relation)}</small></span><button disabled={locked} aria-label={t('Remove relationship')} onClick={()=>change({...graph,edges:graph.edges.filter(v=>v.id!==e.id)})}>×</button></li>)}</ul><button className="fs-button" disabled={locked} onClick={()=>{change(removeNode(graph,node.id));setSelected('');}}>{t('Remove node')}</button><p>{t('Removing a graph node never deletes files, agents or running work.')}</p>
    </>}<hr/><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'agents'})}>{t('Open Agents')}</button><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'runs'})}>{t('Open Runs')}</button></aside></div>
    <GraphRuntime graph={graph} dirty={dirty||locked} onOverview={setLiveOverview} controlTarget={controlTarget} nodeId={selected} executionId={monitor.execution?.id??''}/>
  </main>;
}
