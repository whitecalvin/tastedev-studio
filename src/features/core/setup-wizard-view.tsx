'use client';
import {useState} from 'react';
import {Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {useWorkspace} from '../workspace/context';
import {useProtocol} from '../protocol/views';
import {useCore} from './context';
import {connectionSetupSteps} from './setup-wizard';

export function ConnectionSetupWizard() {
 const {t}=useI18n(),core=useCore(),protocol=useProtocol(),{dispatch}=useWorkspace();
 const {connection,connectionDraft:draft,setConnectionDraft,connectionToken,setConnectionToken}=core;
 const model=connectionSetupSteps(draft,connection.phase,connection.connectionKey,core.snapshot,{loading:protocol.loading,status:protocol.state.status});
 const [chosen,setChosen]=useState<number|null>(null),step=chosen??model.next;
 const busy=connection.phase==='connecting'||connection.phase==='recovering';
 return <section className="core-setup-wizard" aria-label={t('Connection guide')}>
  <header><h2>{t('Connection guide')}</h2><span role="status">{model.steps.filter(row=>row.state==='ready').length} / {model.steps.length} · {t(model.complete?'ready':'Review required')}</span></header>
  <ol className="core-setup-steps">{model.steps.map((row,index)=><li key={row.label}><button type="button" aria-current={step===index?'step':undefined} onClick={()=>setChosen(index)}><span aria-hidden="true">{row.state==='ready'?<Check size={14}/>:index+1}</span>{t(row.label)}</button></li>)}</ol>
  <div className="core-setup-body" role="group" aria-label={t(model.steps[step].label)}>
   <p role="status">{t(model.steps[step].detail)}</p>
   {step===0&&<><label>{t('Connection mode')}<CustomSelect value={draft.mode} disabled={busy} onChange={e=>setConnectionDraft({...draft,mode:e.target.value as 'local'|'team'})}><option value="local">{t('Local Core')}</option><option value="team">{t('Team Core')}</option></CustomSelect></label><label>{t('Endpoint')}<input type="url" value={draft.endpoint} disabled={busy} onChange={e=>setConnectionDraft({...draft,endpoint:e.target.value})}/></label><p>{t(draft.mode==='local'?'Start Core locally, then connect an Agent to the same Core.':'Enter the address and Studio token supplied by your team administrator.')}</p></>}
   {step===1&&<form className="core-setup-form" onSubmit={e=>{e.preventDefault();try{connection.connect(draft.endpoint,connectionToken,core.project);core.setMessage('');setChosen(null);}catch(error){core.setMessage(error instanceof Error?error.message:'Core operation failed.');}}}><label>{t('Studio token')}<input type="password" autoComplete="off" required minLength={16} maxLength={512} disabled={busy} value={connectionToken} onChange={e=>setConnectionToken(e.target.value)}/></label><p>{t('Enter the configured Studio token.')}</p><p>{t('Execution history is saved by Core. Connection credentials stay in memory.')}</p><button className="button primary" disabled={busy||model.steps[0].state!=='ready'}>{t('Connect Core')}</button>{connection.lastError&&<p role="alert">{t(connection.lastError)}</p>}</form>}
   {step===2&&<><p>{t('Record an execution environment. Declared capabilities are unverified until an agent connects.')}</p><p>{t('Start an Agent connected to this Core.')}</p><button className="button" disabled={!model.current} onClick={()=>core.select({kind:'new-agent'})}>{t('Register agent')}</button></>}
   {step===3&&<><p>{t('Open the project definition and resolve its reported issues.')}</p><button className="button" disabled={protocol.loading} onClick={protocol.reload}>{t('Reload project definition')}</button>{model.complete&&<button className="button primary" onClick={()=>dispatch({type:'activity',value:'orchestration'})}>{t('Project orchestration')}</button>}</>}
  </div><footer><button type="button" className="button" disabled={step===0} onClick={()=>setChosen(step-1)}><ChevronLeft size={14}/>{t('Back')}</button><button type="button" className="button" disabled={step===3||model.steps[step].state!=='ready'} onClick={()=>setChosen(step+1)}>{t('Next')}<ChevronRight size={14}/></button></footer>
 </section>;
}
