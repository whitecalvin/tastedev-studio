'use client';
import {CapturedArtifactPlans} from './artifact-plan-view';
import {ExecutionIdentity} from './execution-identity';
import {sessionGraphOverview} from './session-overview';
import {graphConfigurationState,configurationMessages} from './configuration-state';
import { CustomSelect } from '@/components/ui/custom-select';
import {useEffect,useRef,useState} from 'react';
import {useCore} from '../core/context';
import {useFiles} from '../editor/session';
import {useWorkspace} from '../workspace/context';
import {useI18n} from '@/i18n/react';
import {protocolFiles,type ProtocolSources} from '../protocol/domain';
import {remoteCore} from '../core/remote-client';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {parseProtocol} from '../protocol/parser';
import {buildProjectSnapshot,type ProjectSnapshot} from '../ai/project-snapshot';
import {useScheduler} from '../scheduler/views';
import {createPortal} from 'react-dom';
import {graphAIConfigurationMatches} from './task-ai';
import type {ManagedAIConnection} from '../ai/routing';
import {GraphAIReview} from './graph-ai-review';
import type {AIConfigurationStore} from './ai-config';
import {GraphNodeControls} from './node-controls';
import {GraphActivationDetails} from './activation-details';
export function GraphRuntime({aiConnections=[],aiConfigurations,graph,dirty,onOverview,controlTarget,nodeId='',executionId=''}:{aiConnections?:ManagedAIConnection[];aiConfigurations?:AIConfigurationStore;graph:ProjectGraph;dirty:boolean;onOverview?:(value:GraphOverview|null)=>void;controlTarget?:HTMLDivElement|null;nodeId?:string;executionId?:string}){
 const core=useCore(),files=useFiles(),scheduler=useScheduler(),{dispatch}=useWorkspace(),{t}=useI18n();
 const [overview,setOverview]=useState<GraphOverview|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[review,setReview]=useState(false),[entry,setEntry]=useState('');
 const [sourceMode,setSourceMode]=useState('snapshot'),[transferConsent,setTransferConsent]=useState(false),[sourceNotice,setSourceNotice]=useState('');
 const active=useRef(true),locked=useRef(false),generation=remoteCore.generation,connected=core.remote&&core.connection.connected;
 const [overviewSession,setOverviewSession]=useState(-1);
 const sessionOverview=sessionGraphOverview(overview,overviewSession,generation,graph.projectId,connected);
 useEffect(()=>{onOverview?.(sessionOverview);},[sessionOverview,onOverview]);
 useEffect(()=>{active.current=true;let live=true;const refresh=()=>{if(!connected)return;void remoteCore.graphRequest<GraphOverview>('list').then(value=>{if(live){if(value.definition&&value.definition.projectId!==graph.projectId||value.executions.some(e=>e.projectId!==graph.projectId))throw Error('Graph project mismatch.');setOverview(value);setOverviewSession(generation);}}).catch(error=>{if(live){setOverviewSession(-1);setMessage(error instanceof Error?error.message:'Core graph request failed.');}});};refresh();const timer=setInterval(refresh,2000);return()=>{live=false;active.current=false;clearInterval(timer);};},[connected,generation,graph.projectId]);
 const definition=sessionOverview?.definition,aiMatches=graphAIConfigurationMatches(aiConfigurations,graph,definition?.aiTasks,aiConnections),matches=!!definition&&aiMatches&&JSON.stringify(definition.graph)===JSON.stringify(graph),roots=graph.nodes.filter(n=>['task','approval'].includes(n.kind)&&!graph.edges.some(e=>e.to===n.id&&e.relation==='success'));
 const selected=roots.find(n=>n.id===entry)?.id??roots[0]?.id??'';
 async function action(name:string,input?:unknown){if(locked.current)return;locked.current=true;setBusy(true);const session=remoteCore.generation;try{const value=await remoteCore.graphRequest<GraphOverview>(name,input);if(active.current&&session===remoteCore.generation){setOverview(value);setOverviewSession(session);setMessage('');setReview(false);}}catch(error){if(active.current)setMessage(error instanceof Error?error.message:'Core graph request failed.');}finally{locked.current=false;if(active.current)setBusy(false);}}
 async function publish(){if(locked.current||!files.connection||files.connection.permission!=='granted')return;locked.current=true;setBusy(true);const connection=files.connection.id,session=remoteCore.generation,sources:ProtocolSources={};const check=()=>{if(!active.current||session!==remoteCore.generation||files.files.connection?.id!==connection||files.documents.snapshot().dirtyEditors.length)throw Error('Save current edits and review the workspace connection before publishing.');};try{
  check();for(const file of protocolFiles){const path='.tastedev/'+file;if(await files.files.host.exists(connection,path))sources[file]=(await files.files.host.readFile(connection,path)).content;}
  const protocol=parseProtocol(sources);if(protocol.status!=='Valid')throw Error('Valid saved Protocol required.');let snapshot:ProjectSnapshot|undefined;
  if(sourceMode==='snapshot'){
   if(!transferConsent)throw Error('Approve Source transfer first.');const d=protocol.definition,secrets=[...Object.values(d.environment),...Object.values(d.environments).flatMap(Object.values),...Object.values(d.tasks).flatMap(v=>Object.values(v.env)),...Object.values(d.tests).flatMap(v=>Object.values(v.env??{}))];
   const built=await buildProjectSnapshot(files.files,{projectId:graph.projectId,proposalId:crypto.randomUUID(),attempt:1,baseRevision:'saved-working-tree',changedFiles:[]},secrets);
   for(const [name,content] of Object.entries(sources))if(built.snapshot.files.find(f=>f.path==='.tastedev/'+name)?.content!==content)throw Error('Protocol changed or was excluded by the secret policy. Review before publishing.');
   check();snapshot=await remoteCore.uploadSnapshot(built.snapshot);check();setSourceNotice(`${built.snapshot.files.length} ${t('Snapshot files')} · ${built.excluded.length} ${t('Excluded entries')}`);
  }else setSourceNotice('');
  check();const value=await remoteCore.graphRequest<GraphOverview>('publish',{graph,sources,snapshot,aiConfigurations,expectedRevision:definition?.revision??0});check();setOverview(value);setOverviewSession(session);setMessage('');setReview(false);setTransferConsent(false);
 }catch(error){if(active.current)setMessage(error instanceof Error?error.message:'Cannot publish graph.');}finally{locked.current=false;if(active.current)setBusy(false);}}
 const dirtyProtocol=files.editor.openEditors.some(d=>d.path.startsWith('.tastedev/')&&d.content!==d.savedContent);
 const current=sessionOverview?.executions.findLast(e=>['running','paused','cancelling'].includes(e.status));
 async function bindSchedules(){if(!definition||!matches||locked.current)return;locked.current=true;setBusy(true);try{
  const bindings=definition.graph.edges.filter(e=>e.relation==='triggers').map(e=>{const node=definition.graph.nodes.find(n=>n.id===e.from)!,schedule=scheduler.snapshot?.schedules.find(s=>s.id===node.reference);if(!schedule||definition.graph.edges.some(v=>v.to===e.to&&v.relation==='success'))throw Error('Bind an existing Schedule to a root task first.');return{schedule,entryNodeId:e.to};});
  if(!bindings.length||new Set(bindings.map(b=>b.schedule.id)).size!==bindings.length)throw Error('Each Schedule needs one unique root task binding.');
  for(const {schedule,entryNodeId} of bindings)await remoteCore.schedulerRequest('save',{name:schedule.name,testName:schedule.testName,enabled:false,trigger:schedule.trigger,timezone:schedule.timezone,graph:{revision:definition.revision,checksum:definition.checksum,entryNodeId}},schedule.id);
  setMessage(t('Graph schedules saved disabled. Review and enable them in Scheduler.'));
 }catch(error){setMessage(error instanceof Error?error.message:'Cannot bind schedules.');}finally{locked.current=false;if(active.current)setBusy(false);}}
 return <>{controlTarget&&createPortal(<GraphNodeControls graph={graph} overview={sessionOverview} executionId={executionId} nodeId={nodeId} connected={connected} session={generation} dirty={dirty} busy={busy} message={message} onAction={action}/>,controlTarget)}<section className="orch-runtime" aria-label={t('Core graph execution')}><h2>{t('Core graph execution')}</h2>
 {!connected?<button className="fs-button" onClick={()=>dispatch({type:'activity',value:'agents'})}>{t('Connect to Core in Agents.')}</button>:<>
 <p>{t('Core revision')}: {definition?.revision??0} · {sessionOverview?.durable?t('Durable storage'):t('Memory storage; restart loses graph history')}</p>
 <label>{t('Execution Source')}<CustomSelect value={sourceMode} disabled={busy} onChange={e=>{setSourceMode(e.target.value);setTransferConsent(false);setReview(false);}}><option value="snapshot">{t('Saved workspace snapshot')}</option><option value="protocol">{t('Protocol Source / Agent workspace')}</option></CustomSelect></label>
 {sourceMode==='snapshot'&&<label><input type="checkbox" checked={transferConsent} disabled={busy} onChange={e=>setTransferConsent(e.target.checked)}/>{t('Transfer the saved, secret-filtered Source to the connected Core for this graph.')}</label>}
 <button className="fs-button" disabled={busy||dirty||dirtyProtocol||files.editor.dirtyEditors.length>0||!files.ready||files.connection?.permission!=='granted'||sourceMode==='snapshot'&&!transferConsent} onClick={()=>void publish()}>{t('Publish graph to Core')}</button>
 {sourceNotice&&<p>{sourceNotice}</p>}
 <section aria-label={t('New execution readiness')}><h3>{t('New execution readiness')}</h3><p role='status'>{t(configurationMessages[graphConfigurationState(definition??null,graph,aiMatches,dirty)])}</p><p>{t('Past executions remain available for read-only review. Reviewing history does not publish or start work.')}</p></section>
 {dirtyProtocol&&<p>{t('Save Protocol changes before publishing.')}</p>}
 <label>{t('Entry node')}<CustomSelect value={selected} disabled={busy||!!current} onChange={e=>{setEntry(e.target.value);setReview(false);}}>{roots.map(n=><option key={n.id} value={n.id}>{t(n.label)}</option>)}</CustomSelect></label>
 {definition&&<details><summary>{t('Review execution scope')}</summary><p>{t('Protocol input checksum')}: {definition.inputChecksum}</p>{definition.source&&<SourceIdentity source={definition.source}/>}<ul>{definition.graph.nodes.filter(n=>n.kind==='task').map(n=><li key={n.id}>{n.label} · {definition.aiTasks?.[n.id]?`AI: ${definition.aiTasks[n.id].route.connectionId} · ${definition.aiTasks[n.id].route.model}`:`${n.taskType}: ${n.reference} · Agent: ${definition.agents[n.id]?.join(', ')}`}</li>)}</ul><p>{t('Maximum node attempts')}: {definition.graph.retryLimit} · {t('Deadline')}: 10 min</p></details>}
 <label><input type="checkbox" checked={review&&matches&&!dirty} disabled={busy||!matches||dirty||!!current} onChange={e=>setReview(e.target.checked)}/>{t('I reviewed this version and approve its Protocol execution.')}</label>
 <button className="fs-button" disabled={busy||!review||!matches||dirty||!!current||!selected} onClick={()=>void action('start',{revision:definition!.revision,checksum:definition!.checksum,entryNodeId:selected,requestId:crypto.randomUUID()})}>{t('Start reviewed graph')}</button>
 {definition?.graph.edges.some(e=>e.relation==='triggers')&&<><button className="fs-button" disabled={busy||!matches||dirty||!!current} onClick={()=>void bindSchedules()}>{t('Bind graph schedules disabled')}</button><p>{t('Graph schedules saved disabled. Review and enable them in Scheduler.')}</p><button className="fs-button" onClick={()=>dispatch({type:'activity',value:'scheduler'})}>{t('Open Scheduler')}</button></>}
 {sessionOverview?.executions.toReversed().map(e=><div className="orch-execution" key={e.id}><strong>{t(e.status)} · {e.id.slice(0,8)} · v{e.revision}</strong><ExecutionIdentity execution={e}/><CapturedArtifactPlans plans={e.artifactPlans} labels={e.nodeLabels}/>{e.source&&<SourceIdentity source={e.source}/ >}{e.reason&&<p>{e.reason}</p>}{['running','paused','cancelling'].includes(e.status)&&<button className="fs-button" disabled={busy} onClick={()=>void action('cancel',{executionId:e.id})}>{t('Cancel execution')}</button>}{e.status==='paused'&&<GraphNodeControls graph={graph} overview={sessionOverview} executionId={e.id} nodeId={e.activations[0]?.nodeId??''} connected={connected} session={generation} dirty={dirty} busy={busy} message={message} onAction={action}/>}<ul>{e.activations.map(a=><li key={a.id}>{e.nodeLabels[a.nodeId]??a.nodeId} · {a.attempt} · {t(a.status)}<GraphActivationDetails activation={a} running={e.status==='running'} artifactPlans={e.artifactPlans?.[a.nodeId]}/>{a.status==='approval'&&e.status==='running'&&<GraphNodeControls graph={graph} overview={sessionOverview} executionId={e.id} nodeId={a.nodeId} connected={connected} session={generation} dirty={dirty} busy={busy} message={message} onAction={action}/>}{e.aiTasks?.[a.nodeId]&&<GraphAIReview execution={e} activation={a} plan={e.aiTasks[a.nodeId]} disabled={busy||dirty} reviewDisabled={busy} onOverview={setOverview}/ >}{a.runId&&<button className="fs-button" onClick={()=>{core.select({kind:'run',id:a.runId!});dispatch({type:'activity',value:'runs'});}}>{t('Open Run')}</button>}</li>)}</ul></div>)}
 </>}{message&&<p role="status">{message}</p>}</section></>;
}
function SourceIdentity({source}:{source:ProjectSnapshot}){const {t}=useI18n();return <p className="orch-source-identity">{t('Execution Source')}: {source.baseRevision}<br/>Snapshot: {source.snapshotId}<br/>Checksum: {source.checksum}<br/>{t('Snapshot files')}: {source.transfer?.fileCount}</p>;}
