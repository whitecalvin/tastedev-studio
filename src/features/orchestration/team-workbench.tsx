'use client';
import {useEffect,useRef,useState} from 'react';
import {TeamPolicyPanel} from './team-policy-view';
import {TeamReportPanel} from './team-report-view';
import {TeamReadinessPanel} from './team-readiness-view';
import {TeamOperationsPanel} from './team-operations-panel';
import {ClipboardList,RefreshCw} from 'lucide-react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {remoteCore} from '../core/remote-client';
import {teamRoles,type TeamRole} from './domain';
import {teamRoleLabels} from './team-template';
import {intentContent,type TeamIntent,type TeamWorkOverview} from './team-intent';

const lines=(value:string)=>value.split('\n').map(v=>v.trim()).filter(Boolean);
export function TeamWorkbench({onUseIntent,onChoose}:{onUseIntent:(intent:TeamIntent)=>void;onChoose:(node:string)=>void}){
  const {t}=useI18n(),core=useCore(),project=core.project.id,session=remoteCore.generation,connected=core.remote&&core.connection.connected;
  const [state,setState]=useState<{project:string;session:number;value:TeamWorkOverview}|null>(null);
  const [selected,setSelected]=useState(''),[tab,setTab]=useState('intent'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [objective,setObjective]=useState(''),[request,setRequest]=useState(''),[exclusions,setExclusions]=useState(''),[acceptance,setAcceptance]=useState(''),[paths,setPaths]=useState('src'),[role,setRole]=useState<TeamRole>('implementation'),[reason,setReason]=useState(''),[decision,setDecision]=useState('');
  const [editing,setEditing]=useState<string|null>(null),[refresh,setRefresh]=useState(0);const lock=useRef(false),epoch=useRef(0);
  const [pending,setPending]=useState<{action:string;input:Record<string,unknown>}|null>(null);
  const current=connected&&state?.project===project&&state.session===session?state.value:null;
  const intent=current?.intents.find(i=>i.id===selected)??current?.intents[0];
  useEffect(()=>{let active=true,inflight=false;const token=++epoch.current;async function load(){if(!connected||inflight)return;inflight=true;try{const value=await remoteCore.teamWorkRequest<TeamWorkOverview>('list');if(active&&token===epoch.current)setState({project,session,value});}catch{if(active)setError('Team workspace could not be loaded.');}finally{inflight=false;}}void load();const timer=setInterval(()=>void load(),3000);return()=>{active=false;clearInterval(timer);};},[project,session,connected,refresh]);
  async function mutate(action:string,input:Record<string,unknown>){if(!current||lock.current)return;lock.current=true;setBusy(true);setError('');const token=epoch.current;const payload={revision:current.revision,requestId:crypto.randomUUID(),...input};setPending({action,input:payload});try{const value=await remoteCore.teamWorkRequest<TeamWorkOverview>(action,payload);if(token!==epoch.current)return;setState({project,session,value});setPending(null);return value;}catch(e){if(token===epoch.current)setError(e instanceof Error?e.message:'Team action failed.');}finally{lock.current=false;setBusy(false);}}
  const identity=intent?{intentId:intent.id,intentVersion:intent.version}:{};
  function edit(i:TeamIntent){setEditing(i.id);setObjective(i.objective);setRequest(i.userRequest);setExclusions(i.exclusions.join('\n'));setAcceptance(i.acceptance.join('\n'));setPaths(i.paths.join('\n'));setRole(i.responsibility);setReason('');}
  async function save(){try{const content=intentContent({objective,userRequest:request,exclusions:lines(exclusions),acceptance:lines(acceptance),paths:lines(paths),responsibility:role});const id=editing??crypto.randomUUID();const value=await mutate(editing?'intent-revise':'intent-create',editing?{intentId:editing,intentVersion:current!.intents.find(i=>i.id===editing)?.version,content,reason}:{id,content});if(value){setSelected(id);setEditing(null);setObjective('');setRequest('');setExclusions('');setAcceptance('');setReason('');}}catch(e){setError(e instanceof Error?e.message:'Invalid work intent.');}}
  return <details className="orch-team-work"><summary><ClipboardList size={16} aria-hidden="true"/>{t('Team operations')}<span>{current?.intents.length??0}</span></summary>
    {!connected?<p>{t('Connect to Core to use durable team operations.')}</p>:<>
      <div className="orch-team-tabs" role="tablist" aria-label={t('Team operations')}>{[['intent','Work intent'],['assignment','Assignment'],['preflight','Execution preflight'],['isolation','Workspace isolation'],['quality','Quality gates'],['inbox','Inbox'],['rules','Project rules'],['policy','AI operating policy'],['report','Completion report']].map(([id,label])=><button type="button" role="tab" tabIndex={tab===id?0:-1} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=Array.from(e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'));const at=buttons.indexOf(e.currentTarget),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();}} aria-selected={tab===id} aria-controls={`team-${project}-${id}`} id={`team-tab-${project}-${id}`} className="fs-button" key={id} onClick={()=>setTab(id)}>{t(label)}</button>)}<button type="button" className="fs-button" disabled={busy} title={t('Refresh')} aria-label={t('Refresh')} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={14}/></button></div>
      {!current?<p role="status">{t('Loading…')}</p>:<><p>{current.durable?t('Saved in Core'):t('Core is using memory storage. Changes will not survive restart.')}</p>
      <label>{t('Work intent')}<CustomSelect value={intent?.id??''} onChange={e=>{setSelected(e.target.value);setEditing(null);}}><option value="">{t('Select')}</option>{current.intents.map(i=><option key={i.id} value={i.id}>{i.objective} · v{i.version}</option>)}</CustomSelect></label>
      <section role="tabpanel" id={`team-${project}-${tab}`} aria-labelledby={`team-tab-${project}-${tab}`} tabIndex={0}>
      {tab==='intent'&&<>
        <fieldset disabled={busy} className="orch-team-fields"><legend>{t(editing?'Edit intent':'New intent')}</legend>
          <label>{t('Objective')}<input value={objective} maxLength={1200} onChange={e=>setObjective(e.target.value)}/></label>
          <label>{t('Responsibility')}<CustomSelect value={role} onChange={e=>setRole(e.target.value as TeamRole)}>{teamRoles.map(r=><option key={r} value={r}>{t(teamRoleLabels[r])}</option>)}</CustomSelect></label>
          <label>{t('Original request (masked)')}<textarea value={request} maxLength={1600} onChange={e=>setRequest(e.target.value)}/></label>
          <label>{t('Exclusions')}<textarea value={exclusions} maxLength={2200} onChange={e=>setExclusions(e.target.value)}/></label>
          <label>{t('Acceptance criteria, one per line')}<textarea value={acceptance} maxLength={3200} onChange={e=>setAcceptance(e.target.value)}/></label>
          <label>{t('Allowed paths, one per line')}<textarea value={paths} maxLength={4000} onChange={e=>setPaths(e.target.value)}/></label>
          {editing&&<label>{t('Revision reason')}<input value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>}
        </fieldset><div className="orch-team-actions"><button className="fs-button" disabled={busy||!objective.trim()||!request.trim()||!acceptance.trim()||!!editing&&!reason.trim()} onClick={()=>void save()}>{t('Save intent')}</button>{editing&&<button className="fs-button" onClick={()=>setEditing(null)}>{t('Cancel')}</button>}</div>
        {intent&&<article><h3>{intent.objective} · v{intent.version}</h3><p>{intent.userRequest}</p><ul>{intent.exclusions.map(v=><li key={v}>{v}</li>)}</ul><p>{t(intent.ready?'ready':'draft')} · {t(teamRoleLabels[intent.responsibility])}</p><code>{intent.digest}</code><div className="orch-team-actions"><button className="fs-button" disabled={busy} onClick={()=>edit(intent)}>{t('Edit intent')}</button><button className="fs-button" disabled={busy||intent.ready} onClick={()=>void mutate('intent-ready',identity)}>{t('Mark ready')}</button><button className="fs-button" disabled={!intent.ready||intent.responsibility!=='implementation'} onClick={()=>onUseIntent(intent)}>{t('Use intent in work contract')}</button></div>
          <details><summary>{t('Intent history')}</summary>{intent.history.map(v=><article key={v.version}><strong>v{v.version} · {v.reason}</strong><p>{v.content.userRequest}</p><p>{v.content.exclusions.join(' · ')}</p></article>)}</details>
          <label>{t('Decision')}<input value={decision} maxLength={1000} onChange={e=>setDecision(e.target.value)}/></label><button className="fs-button" disabled={busy||!decision.trim()} onClick={()=>void mutate('decision-add',{...identity,id:crypto.randomUUID(),text:decision}).then(value=>{if(value)setDecision('');})}>{t('Record decision')}</button><ul>{intent.decisions.map(d=><li key={d.id}>{d.text} · {d.author} · {d.at}</li>)}</ul>
        </article>}
      </>}
      {tab==='preflight'&&intent&&<TeamReadinessPanel project={project} intentId={intent.id} revision={current.revision} onChoose={onChoose}/>}
      {tab==='policy'&&<TeamPolicyPanel key={JSON.stringify([project,session])} project={project}/>}
      {tab==='report'&&intent&&<TeamReportPanel key={intent.id} intentId={intent.id} revision={current.revision} project={project}/>}
      {tab!=='intent'&&tab!=='preflight'&&tab!=='policy'&&tab!=='report'&&<TeamOperationsPanel key={intent?.id} tab={tab} current={current} intent={intent} busy={busy} mutate={mutate} onChoose={onChoose}/>}
      </section></>}
    </>}{error&&<div role="alert"><p>{t(error)}</p>{pending&&<><button className="fs-button" disabled={busy} onClick={()=>{const request=pending;if(request)void mutate(request.action,request.input);}}>{t('Retry same request')}</button><button className="fs-button" onClick={()=>{setPending(null);setError('');}}>{t('Dismiss')}</button></>}</div>}
  </details>;
}
