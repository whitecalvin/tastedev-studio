'use client';
import {useState} from 'react';
import {useI18n} from '@/i18n/react';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {graphMonitor} from './monitor';
import {graphControlRequest,type GraphControlAction} from './control';
import {GraphActivationDetails} from './activation-details';

type ControlProps={graph:ProjectGraph;overview:GraphOverview|null;executionId:string;nodeId:string;connected:boolean;session:number;dirty:boolean;busy:boolean;message:string;onAction:(action:string,input:unknown)=>Promise<void>};
export function GraphNodeControls(props:ControlProps) {
 const identity=JSON.stringify([props.session,props.connected,props.dirty,props.executionId,props.nodeId,!!props.overview,props.overview?.definition?.checksum,props.overview?.definition?.inputChecksum]);
 return <GraphNodeControlBody key={identity} {...props}/>;
}
function GraphNodeControlBody({graph,overview,executionId,nodeId,connected,session,dirty,busy,message,onAction}:ControlProps) {
 const {t}=useI18n(),[reviewedScope,setReviewedScope]=useState(''),[feedback,setFeedback]=useState('');
 const monitor=graphMonitor(graph,overview,executionId),execution=monitor.execution,activation=monitor.nodes.get(nodeId);
 if(!execution||!connected)return null;
 const scope=JSON.stringify([session,execution.id,execution.revision,execution.checksum,execution.inputChecksum,nodeId,activation?.id,activation?.status,execution.status]);
 const reviewed=reviewedScope===scope;
 const approval=monitor.compatible&&execution.status==='running'&&activation?.status==='approval';
 const resume=monitor.compatible&&execution.status==='paused';
 const cancel=['running','paused','cancelling'].includes(execution.status);
 async function perform(action:GraphControlAction) {
  try {
   const request=graphControlRequest(graph,overview,{executionId,nodeId,action,connected,dirty,reviewed});
   setReviewedScope('');setFeedback('');await onAction(request.action,request.input);
  }catch(error){setFeedback(error instanceof Error?error.message:'Graph execution is unavailable.');}
 }
 return <section className="orch-node-controls" aria-label={t('Execution controls')}>
  <h3>{t('Execution controls')}</h3>
  <p>{execution.id.slice(0,8)} · v{execution.revision} · {t(execution.status)}</p>
  {monitor.compatible&&activation&&<GraphActivationDetails activation={activation} running={execution.status==='running'} artifactPlans={execution.artifactPlans?.[nodeId]}/>}
  {!monitor.compatible&&<p>{t('This execution differs from the current graph. Node states are hidden.')}</p>}
  {(approval||resume)&&<>
   <details><summary>{t('Review execution scope')}</summary><p>{t(execution.nodeLabels[nodeId]??nodeId)}</p><p>{t('Protocol input checksum')}: {execution.inputChecksum}</p>{execution.source&&<p>Snapshot: {execution.source.snapshotId}<br/>Checksum: {execution.source.checksum}</p>}{activation&&<p>{t('Attempt')}: {activation.attempt}</p>}</details>
   <label className="orch-control-review"><input type="checkbox" checked={reviewed&&!dirty} disabled={busy||dirty} onChange={e=>setReviewedScope(e.target.checked?scope:'')}/>{t('I reviewed this version and approve its Protocol execution.')}</label>
  </>}
  <div className="orch-control-actions">
   {approval&&<button className="fs-button" disabled={busy||dirty||!reviewed} onClick={()=>void perform('approve')}>{t('Approve this activation')}</button>}
   {resume&&<button className="fs-button" disabled={busy||dirty||!reviewed} onClick={()=>void perform('resume')}>{t('Review and resume')}</button>}
   {cancel&&<button className="fs-button" disabled={busy} onClick={()=>void perform('cancel')}>{t('Cancel execution')}</button>}
  </div>
  {(feedback||message)&&<p role="status">{t(feedback||message)}</p>}
 </section>;
}
