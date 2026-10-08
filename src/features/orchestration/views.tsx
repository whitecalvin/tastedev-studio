'use client';
import { CustomSelect } from '@/components/ui/custom-select';
import {assignAgentDevice} from './device-membership';
import {AgentDeviceSelector,DeviceAgentList} from './device-membership-view';
import {useAI} from '../ai/views';
import {resolveReviewReturn} from './review-navigation';
import {GraphRuntime} from './runtime-view';
import {focusNodeSettings} from './node-settings-focus';
import {nodeWorkflowContext} from '../workspace/node-workflow';
import {graphMonitor} from './monitor';
import {arrangeGraph} from './layout';
import {fitViewport} from './viewport';
import {useCanvasView} from './canvas-view-state';
import {NodeSearchDialog} from './node-search-dialog';
import {nodeConnections} from './connections';
import {ConnectionList} from './connection-list';
import {emptyEdits,recordEdit,travelEdit,matchesSavedGraph} from './edit-history';
import {canvasShortcut} from './shortcuts';
import {duplicateNode} from './duplicate-node';
import {graphReadiness} from './readiness';
import {GraphReadiness} from './readiness-view';
import {readinessMarkers} from './readiness-markers';
import {ExecutionProgress} from './execution-progress-view';
import {DeviceOperationsBoard} from './operations-board-view';
import {nodeLayer,layerActions} from './layers';
import {NodeContextMenu} from './node-context-menu';
import {useNodeLayers,LayerControls} from './layer-controls';
import {useAIConfigurations,AIConfigurationPanel,TaskAIConfiguration} from './ai-config-panel';
import type {GraphOverview} from './execution';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Network, Monitor, Bot, ShieldCheck, Play, Clock, Briefcase, Plus, Save, Workflow, Scan, RotateCcw, Search, Focus, GitBranch, Undo2, Redo2, Copy } from 'lucide-react';
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
  const {t}=useI18n(),core=useCore(),protocol=useProtocol(),scheduler=useScheduler(),{dispatch,setNodeContext}=useWorkspace();
  const type=projectKinds.includes(core.project.projectType as ProjectKind)?core.project.projectType as ProjectKind:'custom';
  const aiConfigurations=useAIConfigurations(core.project.id),ai=useAI();
 const reviewLocation=ai.graphReview?.projectId===core.project.id?ai.graphReview:null;
  const [graph,setGraph]=useState(()=>initialGraph(core.project.id,type,core.project.initialRoles));
  const [edits,setEdits]=useState(()=>emptyEdits(core.project.id));
  const [selected,setSelected]=useState(reviewLocation?.nodeId??'current-pc'),[ready,setReady]=useState(false),[locked,setLocked]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState('');
  const [addKind,setAddKind]=useState<NodeKind>('device'),[target,setTarget]=useState(''),[relation,setRelation]=useState<Relation>('success');
  const canvasView=useCanvasView(core.project.id,ready&&graph.projectId===core.project.id);
  const {zoom,setZoom,scroll:canvasScroll}=canvasView;
  function fitFlow(){
   const scroll=canvasScroll.current;if(!scroll)return;
   const nodes=Array.from(scroll.querySelectorAll<HTMLElement>('.orch-node'));
   if(!nodes.length)return;
   const boxes=nodes.map(node=>({x:node.offsetLeft,y:node.offsetTop,width:node.offsetWidth,height:node.offsetHeight}));
   for(const edge of scroll.querySelectorAll<SVGGraphicsElement>('.orch-edge')){const box=edge.getBBox();boxes.push({x:box.x,y:box.y,width:box.width,height:box.height});}
   const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
   const view=fitViewport({x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y},scroll.clientWidth,scroll.clientHeight);
   if(view)canvasView.move(view);
  }
  const [dragging,setDragging]=useState<string|null>(null);
  const [searchOpen,setSearchOpen]=useState(false),[trace,setTrace]=useState(false);
  function revealNode(id:string){
   if(dragging!==null)return;
   const scroll=canvasScroll.current,found=graph.nodes.find(node=>node.id===id);
   if(!scroll||!found||graph.projectId!==core.project.id||!scroll.clientWidth)return;
   const element=Array.from(scroll.querySelectorAll<HTMLElement>('.orch-node')).find(node=>node.dataset.nodeId===id);
   setSelected(id);setTarget('');setSearchOpen(false);
   canvasView.move({zoom,left:Math.max(0,(found.x+110)*zoom-scroll.clientWidth/2),top:Math.max(0,(found.y+(element?.offsetHeight??126)/2)*zoom-scroll.clientHeight/2)});
   const project=core.project.id;
   requestAnimationFrame(()=>{if(scroll.isConnected&&scroll.dataset.projectId===project)element?.querySelector<HTMLButtonElement>('.orch-node-content')?.focus({preventScroll:true});});
  }
  const [contextMenu,setContextMenu]=useState<{id:string;x:number;y:number}|null>(null);
  const menuOrigin=useRef<HTMLElement|null>(null),inspector=useRef<HTMLElement|null>(null);
  const closeMenu=useCallback(()=>{setContextMenu(null);menuOrigin.current?.focus();},[]);
  function openMenu(id:string,x:number,y:number,origin:HTMLElement){if(drag.current)return;setSelected(id);setTarget('');menuOrigin.current=origin.querySelector<HTMLElement>('.orch-node-content');setContextMenu({id,x,y});}
  const layers=useNodeLayers(core.project.id,graph.nodes.map(n=>n.id));
  const [liveOverview,setLiveOverview]=useState<GraphOverview|null>(null),[executionId,setExecutionId]=useState(reviewLocation?.executionId??'');
  const [controlTarget,setControlTarget]=useState<HTMLDivElement|null>(null);
  const monitor=graphMonitor(graph,liveOverview,executionId);
  const workflowContext=JSON.stringify(ready?nodeWorkflowContext(graph,selected,monitor,reviewLocation):null);
  useEffect(()=>{let live=true;queueMicrotask(()=>{if(live)setNodeContext(JSON.parse(workflowContext));});return()=>{live=false;};},[workflowContext,setNodeContext]);
  const activation=monitor.nodes.get(selected);
  useEffect(()=>{if(!ready||!reviewLocation)return;let live=true;queueMicrotask(()=>{if(live){setSelected(reviewLocation.nodeId);setExecutionId(reviewLocation.executionId);}});return()=>{live=false;};},[ready,reviewLocation]);
  const activeRun=activation?.runId?core.snapshot.runs.find(r=>r.id===activation.runId&&r.projectId===graph.projectId):undefined;
  const baseline=useRef<string|null>(null);
  const drag=useRef<{id:string;pointerId:number;x:number;y:number;px:number;py:number}|null>(null);
  useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(!active)return;setEdits(emptyEdits(core.project.id));try{const saved=loadGraph(localStorage,core.project.id);baseline.current=localStorage.getItem(graphKey(core.project.id));if(saved){setGraph(saved);setSelected(saved.nodes[0]?.id??'');}else setDirty(true);}catch(error){setLocked(true);setMessage(error instanceof Error?error.message:'Graph storage unavailable.');}setReady(true);});return()=>{active=false;};},[core.project.id]);
  function endDrag(pointerId:number){if(drag.current?.pointerId===pointerId){drag.current=null;setDragging(null);setEdits(previous=>({...previous,group:null}));}}
  function change(next:ProjectGraph){if(!ready||locked||graph.projectId!==core.project.id)return;try{const validated=validateGraph(next,core.project.id),group=drag.current?`drag:${drag.current.pointerId}`:null;setEdits(previous=>recordEdit(previous,graph,validated,group));setGraph(validated);setDirty(!matchesSavedGraph(validated,baseline.current));setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'Invalid graph.');}}
  function travel(direction:'undo'|'redo'){
   if(!ready||locked||dragging!==null||graph.projectId!==core.project.id||edits.projectId!==core.project.id)return;
   try{const result=travelEdit(edits,graph,direction);if(!result)return;setEdits(result.history);setGraph(result.graph);setDirty(!matchesSavedGraph(result.graph,baseline.current));setTarget('');setContextMenu(null);if(!result.graph.nodes.some(node=>node.id===selected))setSelected(result.graph.nodes[0]?.id??'');setMessage(direction==='undo'?'Canvas edit undone.':'Canvas edit redone.');}catch{setMessage('Canvas edit history is unavailable. Graph is unchanged.');}
  }
  function duplicate(id:string){
   if(!ready||locked||dragging!==null||graph.projectId!==core.project.id||edits.projectId!==core.project.id)return;
   const source=graph.nodes.find(node=>node.id===id);if(!source)return;
   try{const result=duplicateNode(graph,id,crypto.randomUUID(),t('Copy of {label}',{label:t(source.label)}),core.project.id);
    change(result.graph);setSelected(result.node.id);setTarget('');setMessage('Node duplicated. Relationships and bindings were not copied.');
    const scroll=canvasScroll.current,project=core.project.id;if(scroll?.clientWidth)canvasView.move({zoom,left:Math.max(0,(result.node.x+110)*zoom-scroll.clientWidth/2),top:Math.max(0,(result.node.y+63)*zoom-scroll.clientHeight/2)});
    requestAnimationFrame(()=>{if(scroll?.isConnected&&scroll.dataset.projectId===project)Array.from(scroll.querySelectorAll<HTMLElement>('.orch-node')).find(element=>element.dataset.nodeId===result.node.id)?.querySelector<HTMLButtonElement>('.orch-node-content')?.focus({preventScroll:true});});
   }catch{setMessage('Node could not be duplicated. Graph is unchanged.');}
  }
  const node=graph.nodes.find(n=>n.id===selected);
  const connections=nodeConnections(graph,selected,core.project.id);
  const tracedEdges=new Set([...connections.incoming,...connections.outgoing].map(item=>item.edge.id));
  const tracedNodes=new Set([...connections.incoming,...connections.outgoing].map(item=>item.node.id));
  const tracing=trace&&!!node&&graph.projectId===core.project.id;
  const tasks=protocol.state.status==='Valid'?protocol.state.definition.tasks:{};
  const tests=protocol.state.status==='Valid'?protocol.state.definition.tests:{};
  function update(patch:Partial<GraphNode>){change({...graph,nodes:graph.nodes.map(n=>n.id===selected?{...n,...patch}:n)});}
  function setDevice(id:string){if(!node||!ready||locked||dragging!==null)return;try{change(assignAgentDevice(graph,core.project.id,node.id,id,crypto.randomUUID()));}catch(error){setMessage(error instanceof Error?error.message:'Invalid graph.');}}
  function status(n:GraphNode){
    if(n.kind==='agent')return core.connection.connected&&n.reference?core.snapshot.agents.find(a=>a.id===n.reference)?.status??'Reference unavailable':'Not connected';
    if(n.kind==='task'&&aiConfigurations.store.projectId===graph.projectId&&aiConfigurations.store.bindings[n.id])return 'AI configuration';
    if(n.kind==='task')return !n.reference?'Choose a Protocol reference':Object.hasOwn(n.taskType==='test'?tests:tasks,n.reference)?'Defined':'Reference unavailable';
    if(n.kind==='schedule')return n.reference?scheduler.snapshot?.schedules.find(s=>s.id===n.reference)?.status??'Reference unavailable':'Not configured';
    return n.kind==='device'?'Declared device':n.kind==='approval'?'Review required':'Configured role';
  }
  const setupIssues=graphReadiness(graph,{projectId:core.project.id,connected:core.remote&&core.connection.connected,protocol:protocol.loading?null:protocol.state,agents:core.remote&&core.connection.connected?core.snapshot.agents:null,schedules:scheduler.snapshot?.schedules??null,ai:aiConfigurations.ready?aiConfigurations.store:null,aiConnections:aiConfigurations.managed.connections,aiConnectionsReady:aiConfigurations.managed.ready});
  const markers=readinessMarkers(graph,setupIssues);
  const destinations=node?graph.nodes.filter(n=>n.id!==node.id&&relations(node.kind,n.kind).length):[];
  const destination=destinations.find(n=>n.id===target),allowed=node&&destination?relations(node.kind,destination.kind):[];
  const selectedRelation=allowed.includes(relation)?relation:allowed[0];
  const width=Math.max(1120,...graph.nodes.map(n=>n.x+250)),height=Math.max(600,...graph.nodes.map(n=>n.y+180));
  const menuNode=contextMenu?graph.nodes.find(n=>n.id===contextMenu.id):undefined;
  const menuIndex=menuNode?layers.order.indexOf(menuNode.id):-1;
  return <main id="orchestration-content" tabIndex={-1} className="orch-view" aria-label={t('Project orchestration')} onKeyDown={event=>{
     const target=event.target instanceof Element?event.target:null;
     const editable=!!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],dialog,[role="dialog"],[role="menu"],[role="listbox"],.monaco-editor');
     const enabled=!!target?.closest('.orch-scroll,.orch-toolbar')&&ready&&dragging===null&&graph.projectId===core.project.id&&!searchOpen&&!contextMenu;
     const canEdit=!locked&&edits.projectId===core.project.id;
     const command=canvasShortcut({key:event.key,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,altKey:event.altKey,repeat:event.repeat,isComposing:event.nativeEvent.isComposing,defaultPrevented:event.defaultPrevented},{enabled,editable,canUndo:canEdit&&!!edits.past.length,canRedo:canEdit&&!!edits.future.length});
     if(!command)return;event.preventDefault();event.stopPropagation();if(command==='find')setSearchOpen(true);else travel(command);
    }}>
    <header className="orch-heading"><div><span className="orch-eyebrow">TASTESTUDIO / {core.project.name}</span><h1>{t('Project orchestration')}</h1><p>{t('Connect devices, roles, agents and the implementation → deployment → testing flow.')}</p></div><button className="button primary" disabled={!ready||locked||!dirty} onClick={()=>{try{saveGraph(localStorage,graph,baseline.current);baseline.current=localStorage.getItem(graphKey(graph.projectId));setDirty(false);setMessage('Graph saved. No work was executed.');}catch(error){setMessage(error instanceof Error?error.message:'Graph could not be saved. Your draft is preserved.');}}}><Save size={15}/>{t('Save graph')}</button></header>
    <div className="orch-summary"><span>{t('Devices')}: {graph.nodes.filter(n=>n.kind==='device').length}</span><span>{t('Roles')}: {graph.nodes.filter(n=>n.kind==='role').length}</span><span>{t('Connected agents')}: {core.connection.connected?core.snapshot.agents.filter(a=>a.status!=='offline').length:0}</span><span>{t('Relationships')}: {graph.edges.length}</span><span>{dirty?t('Unsaved graph'):t('Saved / initial configuration')}</span></div>
    <p className="orch-notice">{t('Saving a graph does not run work. Publish validates saved Protocol and Agent assignments; start requires review.')}</p>
    {message&&<p role={locked?'alert':'status'} className="orch-notice">{t(message)}</p>}
    <div className="orch-toolbar"><label>{t('Project kind')}<CustomSelect value={graph.projectKind} disabled={!ready||locked} onChange={e=>change({...graph,projectKind:e.target.value as ProjectKind})}>{projectKinds.map(k=><option key={k} value={k}>{t(k)}</option>)}</CustomSelect></label><label>{t('Add node')}<CustomSelect value={addKind} onChange={e=>setAddKind(e.target.value as NodeKind)}>{nodeKinds.map(k=><option key={k} value={k}>{t(k)}</option>)}</CustomSelect></label><button className="fs-button" disabled={!ready||locked||graph.nodes.length>=60} onClick={()=>{let index=0;let n=newNode(addKind,crypto.randomUUID(),index);while(graph.nodes.some(v=>Math.abs(v.x-n.x)<240&&Math.abs(v.y-n.y)<146)&&index<44){index++;n={...n,...newNode(addKind,n.id,index)};}change({...graph,nodes:[...graph.nodes,n]});setSelected(n.id);}}><Plus size={14}/>{t('Add node')}</button><label>{t('Zoom')}<CustomSelect value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={0.25}>25%</option>{![.25,.5,.75,1,1.25].includes(zoom)&&<option value={zoom}>{Math.round(zoom*100)}%</option>}<option value={0.5}>50%</option><option value={0.75}>75%</option><option value={1}>100%</option><option value={1.25}>125%</option></CustomSelect></label><span>{t('Drag the handle to move a node. Arrow keys also move it.')}</span><div className="orch-viewport-actions"><button type="button" className="fs-button" title={`${t('Undo canvas edit')} · Ctrl/⌘+Z`} aria-keyshortcuts="Control+Z Meta+Z" aria-label={t('Undo canvas edit')} disabled={!ready||locked||dragging!==null||edits.projectId!==core.project.id||!edits.past.length} onClick={()=>travel('undo')}><Undo2 size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={`${t('Redo canvas edit')} · Ctrl/⌘+Shift+Z / Ctrl+Y`} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y" aria-label={t('Redo canvas edit')} disabled={!ready||locked||dragging!==null||edits.projectId!==core.project.id||!edits.future.length} onClick={()=>travel('redo')}><Redo2 size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={t('Trace selected relationships')} aria-label={t('Trace selected relationships')} aria-pressed={tracing} disabled={!node||dragging!==null} onClick={()=>setTrace(value=>!value)}><GitBranch size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={`${t('Find node')} · Ctrl/⌘+F`} aria-keyshortcuts="Control+F Meta+F" aria-label={t('Find node')} aria-haspopup="dialog" disabled={!ready||dragging!==null} onClick={()=>setSearchOpen(true)}><Search size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={t('Show selected node')} aria-label={t('Show selected node')} disabled={!node||dragging!==null} onClick={()=>revealNode(selected)}><Focus size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={t('Fit flow to view')} aria-label={t('Fit flow to view')} disabled={!graph.nodes.length||dragging!==null} onClick={fitFlow}><Scan size={16} aria-hidden="true"/></button><button type="button" className="fs-button" title={t('Reset canvas view')} aria-label={t('Reset canvas view')} disabled={dragging!==null} onClick={()=>canvasView.move({zoom:1,left:0,top:0})}><RotateCcw size={16} aria-hidden="true"/></button><button type="button" className="fs-button orch-arrange-button" title={t('Arrange flow')} aria-label={t('Arrange flow')} disabled={!ready||locked||graph.nodes.length===0} onClick={()=>change(arrangeGraph(graph))}><Workflow size={16} aria-hidden="true"/></button></div></div>
    {searchOpen&&<NodeSearchDialog key={core.project.id} nodes={graph.projectId===core.project.id?graph.nodes:[]} onClose={()=>setSearchOpen(false)} onChoose={revealNode}/>}{canvasView.error&&<p className="orch-notice" role="status">{t(canvasView.error)}</p>}<AIConfigurationPanel state={aiConfigurations} nodes={graph.nodes}/>
    {ready&&graph.projectId===core.project.id&&<GraphReadiness issues={setupIssues} nodes={graph.nodes} disabled={dragging!==null} onChoose={id=>{revealNode(id);requestAnimationFrame(()=>focusNodeSettings(core.project.id,id));}}/>}
    {ready&&graph.projectId===core.project.id&&<DeviceOperationsBoard graph={graph} agents={core.snapshot.agents} connected={core.connection.connected} disabled={dragging!==null} onChoose={revealNode}/>}
    <section className="orch-monitor" aria-label={t('Execution monitoring')}>
      <label>{t('Core graph execution')}<CustomSelect value={monitor.execution?.id??''} disabled={!liveOverview?.executions.length} onChange={e=>setExecutionId(e.target.value)}>
        {!liveOverview?.executions.length&&<option value="">{t('Not configured')}</option>}
        {liveOverview?.executions.filter(e=>e.projectId===graph.projectId).toReversed().map(e=><option key={e.id} value={e.id}>{e.id.slice(0,8)} · v{e.revision} · {t(e.status)}</option>)}
      </CustomSelect></label>
      <p role="status">{!liveOverview?t('Connect to Core in Agents.'):!monitor.execution?t('No execution has been recorded.'):!monitor.compatible?t('This execution differs from the current graph. Node states are hidden.'):t(monitor.execution.status)}</p>
    </section>
    <ExecutionProgress graph={graph} overview={liveOverview} executionId={executionId} onChoose={revealNode} onRun={id=>{core.select({kind:'run',id});dispatch({type:'activity',value:'runs'});}}/>
    <div className="orch-body"><div className="orch-scroll" data-project-id={graph.projectId} ref={canvasScroll} onScroll={canvasView.remember} tabIndex={0} aria-description={t('Canvas shortcuts: Ctrl/Cmd+Z undo; Ctrl/Cmd+Shift+Z or Ctrl+Y redo; Ctrl/Cmd+F find node.')} aria-label={t('Relationship canvas')}><div style={{width:width*zoom,height:height*zoom}}><div className={`orch-canvas ${tracing?'tracing':''}`} style={{width,height,transform:`scale(${zoom})`,transformOrigin:"0 0"}}>
      <svg width={width} height={height} aria-hidden="true"><defs><marker id="orch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>{graph.edges.map(edge=>{const route=edgeRoute(graph,edge.from,edge.to,edge.relation);return <g key={edge.id} data-readiness={markers.edges.get(edge.id)} className={`orch-edge ${edge.relation==='failure'?'failure':''} ${tracing&&tracedEdges.has(edge.id)?'related':''}`}><path d={route.path} markerEnd="url(#orch-arrow)"/><text x={route.x} y={route.y} textAnchor="middle">{t(edge.relation)}</text></g>;})}</svg>
      {graph.nodes.map(n=>{const Icon=icons[n.kind];return <article key={n.id} data-node-id={n.id} data-readiness={markers.nodes.get(n.id)} onContextMenu={e=>{e.preventDefault();openMenu(n.id,e.clientX,e.clientY,e.currentTarget);}} onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const box=e.currentTarget.getBoundingClientRect();openMenu(n.id,box.left+24,box.top+32,e.currentTarget);}}} className={`orch-node ${n.kind} ${selected===n.id?'selected':''} ${tracing&&tracedNodes.has(n.id)?'related':''}`} style={{left:n.x,top:n.y,zIndex:nodeLayer(layers.order,n.id,dragging)}}><button className="orch-node-handle" aria-label={t('Move {label}',{label:n.label})} disabled={locked||!ready} onPointerDown={e=>{if(e.button!==0||drag.current)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:n.id,pointerId:e.pointerId,x:n.x,y:n.y,px:e.clientX,py:e.clientY};setSelected(n.id);setDragging(n.id);}} onPointerMove={e=>{const d=drag.current;if(d?.id===n.id&&d.pointerId===e.pointerId)change({...graph,nodes:graph.nodes.map(v=>v.id===n.id?{...v,x:Math.max(0,Math.min(2800,d.x+(e.clientX-d.px)/zoom)),y:Math.max(0,Math.min(1800,d.y+(e.clientY-d.py)/zoom))}:v)});}} onPointerUp={e=>endDrag(e.pointerId)} onPointerCancel={e=>endDrag(e.pointerId)} onLostPointerCapture={e=>endDrag(e.pointerId)} onKeyDown={e=>{const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(delta){e.preventDefault();change({...graph,nodes:graph.nodes.map(v=>v.id===n.id?{...v,x:Math.max(0,Math.min(2800,v.x+delta[0])),y:Math.max(0,Math.min(1800,v.y+delta[1]))}:v)});}}}><Icon size={16}/>{t(n.kind)}<span>⋮⋮</span></button><button className="orch-node-content" aria-pressed={selected===n.id} onClick={()=>{setSelected(n.id);setTarget('');}}><strong>{t(n.label)}</strong><small className={monitor.nodes.has(n.id)?`orch-node-state ${monitor.nodes.get(n.id)!.status}`:undefined}>{monitor.nodes.has(n.id)?`${t(monitor.nodes.get(n.id)!.status)} · ${t("Attempt")} ${monitor.nodes.get(n.id)!.attempt}`:t(status(n))}</small>{n.kind==='task'&&aiConfigurations.store.bindings[n.id]&&<small>AI: {aiConfigurations.store.profiles.find(p=>p.id===aiConfigurations.store.bindings[n.id])?.name}</small>}{n.reference&&<small>{n.reference}</small>}</button></article>;})}
      {!graph.nodes.length&&<p className="orch-empty">{t('Add a device and its roles to begin.')}</p>}
    </div></div></div>
    <aside id="orch-node-inspector" data-project-id={core.project.id} data-node-id={node?.id} tabIndex={-1} ref={inspector} className="orch-inspector" aria-label={t('Node settings')}><h2>{t('Node settings')}</h2><div ref={setControlTarget}/>{activation&&<section className="orch-node-execution" aria-label={t('Execution monitoring')}><strong>{t(activation.status)} · {t('Attempt')} {activation.attempt}</strong>{activation.agentId&&<p>Agent: {activation.agentId}</p>}{activation.reason&&<p>{activation.reason}</p>}{activeRun&&<p>{t(activeRun.status)} · {activeRun.id.slice(0,8)}</p>}{activation.runId&&<button className="fs-button" onClick={()=>{core.select({kind:'run',id:activation.runId!});dispatch({type:'activity',value:'runs'});}}>{t('Open Run')}</button>}</section>}{!node?<p>{t('Select a node to configure its relationships.')}</p>:<><label>{t('Name')}<input data-node-name-input value={node.label} maxLength={120} disabled={locked} onChange={e=>update({label:e.target.value})}/></label><p>{t(status(node))}</p>
      <button type="button" className="fs-button orch-duplicate-button" title={t('Duplicate node without relationships or bindings')} disabled={locked||!ready||dragging!==null||graph.nodes.length>=60} onClick={()=>duplicate(node.id)}><Copy size={14} aria-hidden="true"/>{t('Duplicate node')}</button><LayerControls id={node.id} layers={layers} disabled={locked||!ready||dragging!==null}/>
      {node.kind==='task'&&<TaskAIConfiguration state={aiConfigurations} node={node}/>}
      {node.kind==='role'&&<label>{t('Role')}<CustomSelect value={node.role} disabled={locked} onChange={e=>update({role:e.target.value as Role})}>{roles.map(r=><option key={r} value={r}>{t(r)}</option>)}</CustomSelect></label>}
      {node.kind==='agent'&&<label>{t('Agent binding')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Not connected')}</option>{node.reference&&!core.snapshot.agents.some(a=>a.id===node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{core.snapshot.agents.map(a=><option key={a.id} value={a.id}>{a.name} · {t(a.status)}</option>)}</CustomSelect></label>}
      {node.kind==='agent'&&<AgentDeviceSelector graph={graph} node={node} disabled={locked||!ready||dragging!==null} onChange={setDevice}/>}
      {node.kind==='task'&&<><label>{t('Execution definition')}<CustomSelect value={node.taskType} disabled={locked} onChange={e=>update({taskType:e.target.value as 'task'|'test',reference:''})}><option value="task">{t('Task')}</option><option value="test">{t('Test')}</option></CustomSelect></label><label>{t('Protocol reference')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Choose a Protocol reference')}</option>{node.reference&&!Object.hasOwn(node.taskType==='test'?tests:tasks,node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{Object.keys(node.taskType==='test'?tests:tasks).map(name=><option key={name}>{name}</option>)}</CustomSelect></label><button className="fs-button" onClick={()=>dispatch({type:'activity',value:node.taskType==='test'?'tests':'run'})}>{t('Open execution settings')}</button></>}
      {node.kind==='schedule'&&<><label>{t('Schedule binding')}<CustomSelect value={node.reference} disabled={locked} onChange={e=>update({reference:e.target.value})}><option value="">{t('Not configured')}</option>{node.reference&&!scheduler.snapshot?.schedules.some(s=>s.id===node.reference)&&<option value={node.reference}>{t('Reference unavailable')}</option>}{scheduler.snapshot?.schedules.map(s=><option key={s.id} value={s.id}>{s.name} · {t(s.status)}</option>)}</CustomSelect></label><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'scheduler'})}>{t('Open Scheduler')}</button></>}
      {node.kind==='device'&&<><p>{t('Device membership is declared here. It is not inferred from an Agent ID.')}</p><DeviceAgentList graph={graph} node={node} agents={core.snapshot.agents} connected={core.remote&&core.connection.connected} disabled={locked||!ready||dragging!==null} onChoose={id=>{setSelected(id);setTarget('');}}/></>}{node.kind==='approval'&&<p>{t('This node expresses a review gate. It does not grant execution or write permission.')}</p>}
      <hr/><h3>{t('Connect to')}</h3><label>{t('Target node')}<CustomSelect value={target} disabled={locked} onChange={e=>setTarget(e.target.value)}><option value="">{t('Select a node')}</option>{destinations.map(n=><option key={n.id} value={n.id}>{t(n.label)} · {t(n.kind)}</option>)}</CustomSelect></label><label>{t('Relationship')}<CustomSelect value={selectedRelation??''} disabled={locked||!allowed.length} onChange={e=>setRelation(e.target.value as Relation)}>{allowed.map(r=><option key={r} value={r}>{t(r)}</option>)}</CustomSelect></label><button className="fs-button" disabled={locked||!destination||!selectedRelation} onClick={()=>change({...graph,edges:[...graph.edges,{id:crypto.randomUUID(),from:node.id,to:target,relation:selectedRelation}]})}>{t('Add relationship')}</button>
      <ConnectionList connections={connections} onReveal={revealNode} disabled={locked||!ready||dragging!==null} onRemove={id=>change({...graph,edges:graph.edges.filter(edge=>edge.id!==id)})}/><button className="fs-button" disabled={locked} onClick={()=>{change(removeNode(graph,node.id));setSelected('');}}>{t('Remove node')}</button><p>{t('Removing a graph node never deletes files, agents or running work.')}</p>
    </>}<hr/><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'agents'})}>{t('Open Agents')}</button><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'runs'})}>{t('Open Runs')}</button></aside></div>
    {reviewLocation&&liveOverview&&<p role="status">{t(resolveReviewReturn(reviewLocation,core.project.id,liveOverview)==='unavailable'?'The reviewed activation is unavailable. No other execution was selected.':'Returned to the reviewed graph execution. Review current status before continuing.')} · {reviewLocation.executionId.slice(0,8)} · {reviewLocation.nodeId}</p>}
    {contextMenu&&menuNode&&<NodeContextMenu x={contextMenu.x} y={contextMenu.y} label={menuNode.label} onClose={closeMenu} actions={[
      {label:'Node settings',run:()=>focusNodeSettings(core.project.id,menuNode.id)},
      {label:'Duplicate node',disabled:locked||!ready||dragging!==null||graph.nodes.length>=60,run:()=>duplicate(menuNode.id)},
      ...layerActions.map(action=>({label:{front:'Bring to front',back:'Send to back',forward:'Bring forward',backward:'Send backward'}[action],disabled:locked||!ready||!layers.ready||dragging!==null||menuIndex<0||(action==='front'||action==='forward'?menuIndex===layers.order.length-1:menuIndex===0),run:()=>layers.move(menuNode.id,action)})),
      ...(menuNode.kind==='task'?[{label:'Open execution settings',run:()=>dispatch({type:'activity',value:menuNode.taskType==='test'?'tests':'run'})}]:[]),
      ...(menuNode.kind==='agent'?[{label:'Open Agents',run:()=>dispatch({type:'activity',value:'agents'})}]:[]),
      ...(menuNode.kind==='schedule'?[{label:'Open Scheduler',run:()=>dispatch({type:'activity',value:'scheduler'})}]:[]),
      {label:'Remove node',danger:true,disabled:locked||!ready||dragging!==null,run:()=>{change(removeNode(graph,menuNode.id));setSelected('');}}
    ]}/>}
    <GraphRuntime aiConnections={aiConfigurations.managed.connections} aiConfigurations={aiConfigurations.store} graph={graph} dirty={dirty||locked||aiConfigurations.dirty||!aiConfigurations.ready} onOverview={setLiveOverview} controlTarget={controlTarget} nodeId={selected} executionId={executionId||monitor.execution?.id||''}/>
  </main>;
}
