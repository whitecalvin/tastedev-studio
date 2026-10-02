'use client';
import {useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useWorkspace} from './context';
import {useFiles} from '../editor/session';
import {useCore} from '../core/context';
import {useAI} from '../ai/views';
import {workflowProgress} from '../ai/workflow-progress';
import {resolveWorkflow,workflowBookmark,workflowKey} from './workflow-bookmark';
export function WorkflowBar(){
 const {t}=useI18n(),{state,dispatch}=useWorkspace(),files=useFiles(),core=useCore(),ai=useAI();
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const active=files.editor.openEditors.find(f=>f.id===files.editor.activeEditorId);
 const attempt=ai.fixes.history.filter(a=>a.analysisId===ai.record?.id).at(-1);
 const run=core.snapshot.runs.find(r=>r.id===attempt?.retestRunId);
 const progress=attempt?workflowProgress(attempt,run,core.snapshot.steps):null;
 const endpoint=core.connection.connectionKey.split('\0')[0];
 const navigate=(activity:'explorer'|'run'|'ai'|'runs')=>{ai.setProposal(null);dispatch({type:'activity',value:activity});};
 const save=()=>{try{const bookmark=workflowBookmark({version:1,projectId:core.project.id,endpoint,...(active?{path:active.path}:{}),...(ai.record?{analysisId:ai.record.id}:{}),...(attempt?{attemptId:attempt.id}:{}),...(attempt?.retestRunId?{runId:attempt.retestRunId}:core.selection?.kind==='run'?{runId:core.selection.id}:{})},core.project.id,endpoint);localStorage.setItem(workflowKey(core.project.id),JSON.stringify(bookmark));setMessage('Workflow location saved.');}catch{setMessage('Connect to the matching Core before saving workflow.');}};
 const restore=async()=>{setBusy(true);setMessage('');const key=core.connection.connectionKey,generation=core.connection.generation;try{
  if(!ai.historyReady||files.busy)throw Error();const raw=localStorage.getItem(workflowKey(core.project.id));if(!raw||raw.length>4096)throw Error();const bookmark=workflowBookmark(JSON.parse(raw),core.project.id,endpoint);const resolved=resolveWorkflow(bookmark,ai.service.history,ai.fixes.history);
  if(bookmark.runId)await core.connection.loadRun(bookmark.runId);
  if(key!==core.connection.connectionKey||generation!==core.connection.generation||!core.connection.connected)throw Error();
  if(bookmark.path){await files.documents.open(bookmark.path);if(key!==core.connection.connectionKey||generation!==core.connection.generation)throw Error();}
  if(resolved.analysis){ai.selectRecord(resolved.analysis);dispatch({type:'activity',value:'ai'});}else if(bookmark.runId){ai.setProposal(null);core.select({kind:'run',id:bookmark.runId});dispatch({type:'activity',value:'runs'});}else navigate('explorer');
  setMessage('Workflow restored. Review before executing actions.');
 }catch{setMessage('Saved workflow unavailable. Connect the matching project and Core, then retry.');}finally{setBusy(false);}};
 return <nav className="ws-workflow" aria-label={t('Workflow')}><button className="ws-text-button" onClick={()=>navigate('explorer')}>{t('Edit')}</button><button className="ws-text-button" onClick={()=>dispatch({type:'tab',value:'Problems'})}>{t('Problems')}</button><button className="ws-text-button" onClick={()=>navigate('run')}>{t('Debugger')}</button><button className="ws-text-button" onClick={()=>navigate('ai')}>{t('Failure analysis')}</button><button className="ws-text-button" disabled={!ai.record?.result.proposal.length} onClick={()=>{if(ai.record){dispatch({type:'activity',value:'ai'});ai.setProposal({record:ai.record,index:0});}}}>{t('Fix proposal')}</button><button className="ws-text-button" onClick={()=>{navigate('runs');if(attempt?.retestRunId)void ai.openRun(attempt.retestRunId);}}>{t('Test Result')}</button><span className="ws-workflow-state" title={progress?t(progress.hint):active?.path}>{progress?`${t(progress.status)} · ${progress.completed}/${progress.total}${progress.verified?' ✓':''}`:active?.path??t(state.activeActivity)}{files.editor.dirtyEditors.length?` · ${t('Unsaved changes')}`:''}</span><button className="ws-text-button" disabled={!ai.historyReady||busy} onClick={save}>{t('Save workflow')}</button><button className="ws-text-button" disabled={!ai.historyReady||busy||!!files.busy||ai.status==='generating'} onClick={()=>void restore()}>{t('Restore workflow')}</button>{message&&<span role="status" className="ws-workflow-message">{t(message)}</span>}</nav>;
}
