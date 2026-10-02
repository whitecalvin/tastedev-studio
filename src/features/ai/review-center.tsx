'use client';
import {useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useAI} from './views';
import {compareAttempts} from './comparison';
import {useFiles} from '../editor/session';
import {useCore} from '../core/context';
import {useGit} from '../git/context';
import {useWorkspace} from '../workspace/context';
import {GitDiffEditor} from '../git/diff-editor';
import {CreateIssueCandidate} from '../issues/views';
import type {GitDiff} from '../git/contracts';
export function AIReviewCenter(){
 const {t}=useI18n(),ai=useAI(),files=useFiles(),core=useCore(),git=useGit(),{dispatch}=useWorkspace();
 const [budget,setBudget]=useState(()=>ai.service.budget),[attemptLimit,setAttemptLimit]=useState(ai.fixes.maximumAttempts);
 const {left,right}=ai.review;const setLeft=(left:string)=>ai.setReview(v=>({...v,left})),setRight=(right:string)=>ai.setReview(v=>({...v,right}));
 const [path,setPath]=useState(''),[message,setMessage]=useState(''),[userDiff,setUserDiff]=useState<GitDiff|null>(null),[busy,setBusy]=useState(false);
 const attempts=ai.fixes.history,a=attempts.find(x=>x.id===left),b=attempts.find(x=>x.id===right);
 const rows=a&&b&&a.originRunId===b.originRunId?compareAttempts(ai.project.id,a,b):[];
 const row=rows.find(x=>x.path===path)??rows[0],selected=b??a;
 async function operation(action:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await action();}catch{setMessage(t('Review data unavailable. Reconnect and retry.'));}finally{setBusy(false);}}
 function saveBudget(){try{ai.configureBudget(budget,attemptLimit);setMessage(t('Budget saved. Each new proposal still requires approval.'));}catch{setMessage(t('Invalid budget or analysis is active.'));}}
 async function compareUser(){if(!selected)return;const p=selected.patches.find(p=>p.path===path)??selected.patches[0];if(!p)return;await operation(async()=>{const d=files.documents.snapshot().openEditors.find(d=>d.path===p.path);const content=d?.content??(await files.files.read(p.path)).content;setUserDiff({path:p.path,side:'working',binary:false,original:p.result,modified:content});});}
 async function reviewResult(){if(!selected?.retestRunId)return;await operation(async()=>{await core.connection.loadRun(selected.retestRunId!);ai.setProposal(null);core.select({kind:'run',id:selected.retestRunId!});dispatch({type:'activity',value:'runs'});});}
 const numbers=[['timeoutMs','Analysis timeout (ms)',1000,120000],['maxProviderRequests','Maximum provider requests',1,12],['maxInputTokens','Maximum input tokens',1,1000000],['maxOutputTokens','Maximum output tokens',1,100000]] as const;
 return <section className="core-detail ai-review-center" aria-label={t('AI review center')}>
  <h2>{t('AI review center')}</h2><p>{t('Compare attempts and your edits. Writes and tests keep separate approvals.')}</p>
  <details open><summary>{t('Analysis budget')}</summary><div className="ai-review-controls">{numbers.map(([key,label,min,max])=><label key={key}>{t(label)}<input type="number" min={min} max={max} value={budget[key]} disabled={ai.status==='generating'} onChange={e=>setBudget({...budget,[key]:Number(e.target.value)})}/></label>)}<label>{t('Maximum fix attempts')}<input type="number" min={1} max={10} value={attemptLimit} disabled={ai.status==='generating'} onChange={e=>setAttemptLimit(Number(e.target.value))}/></label></div>
  <label><input type="checkbox" checked={!!budget.cost} disabled={ai.status==='generating'} onChange={e=>setBudget({...budget,cost:e.target.checked?{model:'',inputUsdPerMillion:0,outputUsdPerMillion:0,maxUsd:1}:undefined})}/>{t('Estimate cost')}</label>
  {budget.cost&&<div className="ai-review-controls"><label>{t('Model')}<input value={budget.cost.model} disabled={ai.status==='generating'} onChange={e=>setBudget({...budget,cost:{...budget.cost!,model:e.target.value}})}/></label>{([['inputUsdPerMillion','Input USD / million tokens'],['outputUsdPerMillion','Output USD / million tokens'],['maxUsd','Maximum estimated USD']] as const).map(([key,label])=><label key={key}>{t(label)}<input type="number" min={0} max={100000} step="any" value={budget.cost![key]} disabled={ai.status==='generating'} onChange={e=>setBudget({...budget,cost:{...budget.cost!,[key]:Number(e.target.value)}})}/></label>)}</div>}
  <button className="fs-button" disabled={ai.status==='generating'} onClick={saveBudget}>{t('Save budget')}</button><p>{t('Estimates use configured rates after each reply. This is not a billing cap. Unknown usage or model stops cost-limited analysis.')}</p>
  {ai.service.lastMetrics&&<p role="status">{ai.service.lastMetrics.providerRequests} · {t('Maximum provider requests')} / {ai.service.lastMetrics.budget.maxProviderRequests} · {t('Cost estimate USD')}: {ai.service.lastMetrics.estimatedCostUsd?.toFixed(6)??t('Usage unavailable')} · {t(ai.service.lastMetrics.outcome)}</p>}</details>
  <div className="ai-review-controls">{([['left',left],['right',right]] as const).map(([side,value])=><label key={side}>{t(side==='left'?'Earlier attempt':'Later attempt')}<select value={value} onChange={e=>{(side==='left'?setLeft:setRight)(e.target.value);setUserDiff(null);}}><option value="">{t('Select attempt')}</option>{attempts.filter(x=>side==='left'||!a||x.originRunId===a.originRunId).map(x=><option key={x.id} value={x.id}>{t('Attempt')} {x.attempt} · {t(x.status)} · {x.proposalId.slice(0,8)}</option>)}</select></label>)}</div>
  {a&&b&&a.originRunId!==b.originRunId&&<p role="alert">{t('Select attempts from the same original failure.')}</p>}
  {rows.length>0&&<label>{t('File')}<select value={row?.path??''} onChange={e=>{setPath(e.target.value);setUserDiff(null);}}>{rows.map(r=><option key={r.path}>{r.path}</option>)}</select></label>}
  {selected&&<><p>{t('Proposal')}: {selected.proposalId} · {t('Status')}: {t(selected.status)} · Run {selected.retestRunId??'—'}</p><div className="core-actions"><button className="fs-button" disabled={busy} onClick={()=>void compareUser()}>{t('Compare with current editor / disk')}</button><button className="fs-button" disabled={busy||!selected.retestRunId||!ai.connected} onClick={()=>void reviewResult()}>{t('Review test result')}</button>{selected.retestRunId&&<CreateIssueCandidate runId={selected.retestRunId}/>}<button className="fs-button" disabled={busy||!git.service.host.capabilities.git} onClick={()=>void operation(async()=>{await git.service.refresh();if(selected.patches[0])await git.service.selectDiff(selected.patches[0].path,'working');ai.setProposal(null);dispatch({type:'activity',value:'source-control'});})}>{t('Review Git changes')}</button></div></>}
  {message&&<p role="status">{message}</p>}
  {(userDiff||row)&&<div className="ai-review-diff"><p>{t(userDiff?'AI result → current editor / disk':'Earlier result → later result')}</p><GitDiffEditor diff={userDiff??{path:row!.path,side:'working',original:row!.original,modified:row!.modified,binary:false}}/></div>}
  {!attempts.length&&<p>{t('No fix attempts yet. Analyze a failed Run and review its proposal.')}</p>}
 </section>;
}
