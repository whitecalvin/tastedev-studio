'use client';
import {useState} from 'react';
import {Network,MoreHorizontal,SlidersHorizontal} from 'lucide-react';
import {focusNodeSettings} from '../orchestration/node-settings-focus';
import {Dialog} from '@/components/ui/dialog';
import {useI18n} from '@/i18n/react';
import {useWorkspace} from './context';
import {useFiles} from '../editor/session';
import {useCore} from '../core/context';
import {useAI} from '../ai/views';
import {workflowAnalysis} from './node-workflow';
import type {Activity} from './state';
import {workflowProgress} from '../ai/workflow-progress';
import {resolveWorkflow,workflowBookmark,workflowKey} from './workflow-bookmark';
export function WorkflowBar(){
 const {t}=useI18n(),{state,dispatch,nodeContext}=useWorkspace(),files=useFiles(),core=useCore(),ai=useAI();
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[debugging,setDebugging]=useState(false),[locationOpen,setLocationOpen]=useState(false);
 const active=files.editor.openEditors.find(f=>f.id===files.editor.activeEditorId);
 const selected=nodeContext?.projectId===core.project.id?nodeContext:null;
 const record=workflowAnalysis(selected,ai.service.history);
 const attempt=record?ai.fixes.history.filter(a=>a.analysisId===record.id).at(-1):undefined;
 const selectedRun=selected?.runId?core.snapshot.runs.find(r=>r.projectId===core.project.id&&r.id===selected.runId):undefined;
 const run=core.snapshot.runs.find(r=>r.id===attempt?.retestRunId);
 const progress=attempt?workflowProgress(attempt,run,core.snapshot.steps):null;
 const endpoint=core.connection.connectionKey.split('\0')[0];
 const navigate=(activity:Activity,debug=false)=>{setDebugging(debug);ai.setProposal(null);dispatch({type:'activity',value:activity});};
 const save=()=>{try{const bookmark=workflowBookmark({version:1,projectId:core.project.id,endpoint,...(active?{path:active.path}:{}),...(record?{analysisId:record.id}:{}),...(attempt?{attemptId:attempt.id}:{}),...(attempt?.retestRunId?{runId:attempt.retestRunId}:core.selection?.kind==='run'?{runId:core.selection.id}:{})},core.project.id,endpoint);localStorage.setItem(workflowKey(core.project.id),JSON.stringify(bookmark));setMessage('Workflow location saved.');}catch{setMessage('Connect to the matching Core before saving workflow.');}};
 const restore=async()=>{setBusy(true);setMessage('');const key=core.connection.connectionKey,generation=core.connection.generation;try{
  if(!ai.historyReady||files.busy)throw Error();const raw=localStorage.getItem(workflowKey(core.project.id));if(!raw||raw.length>4096)throw Error();const bookmark=workflowBookmark(JSON.parse(raw),core.project.id,endpoint);const resolved=resolveWorkflow(bookmark,ai.service.history,ai.fixes.history);
  if(bookmark.runId)await core.connection.loadRun(bookmark.runId);
  if(key!==core.connection.connectionKey||generation!==core.connection.generation||!core.connection.connected)throw Error();
  if(bookmark.path){await files.documents.open(bookmark.path);if(key!==core.connection.connectionKey||generation!==core.connection.generation)throw Error();}
  if(resolved.analysis){ai.selectRecord(resolved.analysis);dispatch({type:'activity',value:'ai'});}else if(bookmark.runId){ai.setProposal(null);core.select({kind:'run',id:bookmark.runId});dispatch({type:'activity',value:'runs'});}else navigate('explorer');
  setMessage('Workflow restored. Review before executing actions.');
 }catch{setMessage('Saved workflow unavailable. Connect the matching project and Core, then retry.');}finally{setBusy(false);}};
 const isTask=selected?.kind==='task';
 const stage=ai.proposal&&record&&ai.proposal.record.id===record.id?'proposal':state.activeActivity==='runs'?'result':state.activeActivity==='ai'?'analysis':state.activeActivity==='run'&&debugging?'implementation':state.activeActivity==='tests'||state.activeActivity==='run'?'validation':state.activeActivity==='explorer'?'implementation':'';
 const button=(label:string,value:string,action:()=>void,disabled=false)=><button type="button" className="ws-workflow-step" aria-current={stage===value?'step':undefined} disabled={disabled} onClick={action}>{t(label)}</button>;
 const review=()=>{if(record){ai.selectRecord(record);dispatch({type:'activity',value:'ai'});if(!state.secondaryPanelVisible)dispatch({type:'toggle',panel:'secondaryPanelVisible'});}};
 const hint=selectedRun?.status==='failed'?t('Open the failed Run to review evidence and request analysis.'):t('Analysis and proposals are available only for the selected node execution.');
 return <section className="ws-node-workflow" aria-label={t('Workflow')}>
  <nav className="ws-workflow" aria-label={t('Node workflow')}>
   <button className="ws-icon-button" title={t('Project orchestration')} aria-label={t('Project orchestration')} onClick={()=>navigate('orchestration')}><Network size={16} aria-hidden="true"/></button>
   <div className="ws-node-context" title={selected?[selected.label,t(selected.kind),selected.reference,selected.executionId,selected.status?t(selected.status):''].filter(Boolean).join(' · '):t('Select a node')}><strong>{selected?t(selected.label):t('Select a node')}</strong>{selected&&<span>{t(selected.kind)}</span>}</div>
   {isTask?<div className="ws-workflow-steps">
    {button('Implementation','implementation',()=>navigate('explorer'))}
    {button('Validation','validation',()=>navigate(selected.taskType==='test'?'tests':'run'))}
    {button('Execution results','result',()=>{if(selected.runId)void ai.openRun(selected.runId);},!selected.runId||!core.connection.connected)}
    {button('Failure analysis','analysis',review,!record||!ai.historyReady)}
    {button('Fix proposal','proposal',()=>{if(record){review();ai.setProposal({record,index:0});}},!record?.result.proposal.length||!ai.historyReady)}
   </div>:<div className="ws-workflow-steps"><button type="button" className="ws-workflow-step ws-node-settings" title={t('Node settings')} aria-current={state.activeActivity==='orchestration'?'step':undefined} disabled={!selected} onClick={()=>{if(!selected)return;navigate('orchestration');requestAnimationFrame(()=>focusNodeSettings(core.project.id,selected.nodeId));}}><SlidersHorizontal size={14} aria-hidden="true"/>{t('Node settings')}</button>{selected?.kind==='agent'&&<button className="ws-text-button" onClick={()=>{navigate('agents');if(core.snapshot.agents.some(a=>a.id===selected.reference))core.select({kind:'agent',id:selected.reference});}}>{t('Open Agents')}</button>}{selected?.kind==='schedule'&&<button className="ws-text-button" onClick={()=>navigate('scheduler')}>{t('Open Scheduler')}</button>}</div>}
   {isTask&&(stage==='implementation'||stage==='result')&&<div className="ws-workflow-tools">{stage==='implementation'?<button className="ws-text-button" onClick={()=>navigate('run',true)}>{t('Debugger')}</button>:<button className="ws-text-button" onClick={()=>dispatch({type:'tab',value:'Problems'})}>{t('Problems')}</button>}</div>}
   <span className="ws-workflow-state" title={progress?t(progress.hint):active?.path}>{progress?`${t(progress.status)} · ${progress.completed}/${progress.total}${progress.verified?' ✓':''}`:active?.path??''}{files.editor.dirtyEditors.length?` · ${t('Unsaved changes')}`:''}</span>
   {selected?.executionId&&<span className="ws-node-identity" title={`${t('Execution ID')}: ${selected.executionId}${selected.compatible?'':` · ${t('This execution differs from the current graph. Node states are hidden.')}`}`}>{selected.executionId.slice(0,8)}{selected.status?` · ${t(selected.status)}`:''}</span>}
   {isTask&&!record&&<span className="ws-workflow-hint" title={hint}>{t('No linked analysis')}</span>}
   {message&&<span role="status" className="ws-workflow-feedback" title={t(message)}>{t(message)}</span>}
   <button className="ws-icon-button" title={t('Saved review location')} aria-label={t('Saved review location')} aria-haspopup="dialog" onClick={()=>setLocationOpen(true)}><MoreHorizontal size={16} aria-hidden="true"/></button>
  </nav>
  {locationOpen&&<Dialog title="Saved review location" onClose={()=>setLocationOpen(false)}><p className="dialog-description">{t('Save the open file, Run and AI review references to return to them later. Node positions and canvas zoom are not saved.')}</p>{(!core.connection.connected||!ai.historyReady)&&<p role="status" className="dialog-description">{t(!core.connection.connected?'Connect to the project Core to save or restore review references.':'Loading review history. Save and restore will be available when it is ready.')}</p>}<div className="dialog-actions"><button className="fs-button" disabled={!ai.historyReady||busy} onClick={()=>{save();setLocationOpen(false);}}>{t('Save review location')}</button><button className="fs-button" disabled={!ai.historyReady||busy||!!files.busy||ai.status==='generating'} onClick={()=>void restore().finally(()=>setLocationOpen(false))}>{t('Restore review location')}</button></div></Dialog>}
 </section>;
}
