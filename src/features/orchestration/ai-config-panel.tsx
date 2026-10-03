'use client';
import {useEffect,useRef,useState} from 'react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {aiProviders,aiConnections,aiTools,aiRoles,aiConfigurationKey,emptyAIConfigurations,newAIConfiguration,validateAIConfigurations,saveAIConfigurations,configurationPrompt,canPrepareConfiguration,type AIConfigurationStore,type AIConfiguration} from './ai-config';
import type {GraphNode} from './domain';
import {useAI} from '../ai/views';
import {defaultBudget} from '../ai/domain';
import {useWorkspace} from '../workspace/context';

export function useAIConfigurations(projectId:string){
 const [store,setStore]=useState(()=>emptyAIConfigurations(projectId));
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
 const baseline=useRef<string|null>(null);
 useEffect(()=>{let live=true;queueMicrotask(()=>{if(!live)return;try{const raw=localStorage.getItem(aiConfigurationKey(projectId));baseline.current=raw;setStore(raw?validateAIConfigurations(JSON.parse(raw),projectId):emptyAIConfigurations(projectId));setReady(true);}catch{setError('Invalid AI configuration.');}});return()=>{live=false;};},[projectId]);
 function change(next:AIConfigurationStore){setStore(next);setDirty(true);setError('');}
 function save(){try{const checked=validateAIConfigurations(store,projectId);saveAIConfigurations(localStorage,checked,baseline.current);baseline.current=localStorage.getItem(aiConfigurationKey(projectId));setStore(checked);setDirty(false);setError('AI configurations saved. No request was sent.');}catch(e){setError(e instanceof Error?e.message:'Invalid AI configuration.');}}
 return{store,ready,error,dirty,change,save};
}
export function AIConfigurationPanel({state,nodes}:{state:ReturnType<typeof useAIConfigurations>;nodes:GraphNode[]}){
 const {t}=useI18n();const [selected,setSelected]=useState('');
 const profile=state.store.profiles.find(p=>p.id===selected)??state.store.profiles[0];
 function update(patch:Partial<AIConfiguration>){if(profile)state.change({...state.store,profiles:state.store.profiles.map(p=>p.id===profile.id?{...p,...patch}:p)});}
 const labels={core:'Core connection',api:'API connection',account:'Account connection',local:'Local connection'};
 return <details className="orch-ai-config"><summary>{t('AI configurations')} · {state.store.profiles.length}</summary>
 <p>{t('Configurations describe the requested AI. Provider routing is not activated by saving. Credentials stay on the connection host.')}</p>
 <div className="orch-toolbar"><label>{t('AI configuration')}<CustomSelect value={profile?.id??''} onChange={e=>setSelected(e.target.value)} disabled={!state.ready}><option value="">{t('Not configured')}</option>{state.store.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</CustomSelect></label>
 <button className="fs-button" disabled={!state.ready||state.store.profiles.length>=30} onClick={()=>{const p=newAIConfiguration(crypto.randomUUID());state.change({...state.store,profiles:[...state.store.profiles,p]});setSelected(p.id);}}>{t('Add AI configuration')}</button>
 <button className="fs-button" disabled={!state.ready||!state.dirty} onClick={state.save}>{t('Save AI configurations')}</button></div>
 {state.error&&<p role="status">{t(state.error)}</p>}
 {profile&&<div className="orch-ai-fields"><label>{t('Name')}<input maxLength={120} value={profile.name} onChange={e=>update({name:e.target.value})}/></label>
 <label>{t('AI provider')}<CustomSelect value={profile.provider} onChange={e=>update({provider:e.target.value as AIConfiguration['provider']})}>{aiProviders.map(p=><option key={p} value={p}>{({openai:'OpenAI',anthropic:'Anthropic',google:'Google',local:t('Local AI')})[p]}</option>)}</CustomSelect></label>
 <label>{t('Model')}<input value={profile.model} maxLength={120} placeholder={t('Configured on Core')} onChange={e=>update({model:e.target.value})}/></label>
 <label>{t('Connection method')}<CustomSelect value={profile.connection} onChange={e=>update({connection:e.target.value as AIConfiguration['connection']})}>{aiConnections.map(p=><option key={p} value={p}>{t(labels[p])}</option>)}</CustomSelect></label>
 <label>{t('AI development tool')}<CustomSelect value={profile.tool} onChange={e=>update({tool:e.target.value as AIConfiguration['tool']})}>{aiTools.map(p=><option key={p} value={p}>{({service:t('AI service'),codex:'Codex','claude-code':'Claude Code',custom:t('custom')})[p]}</option>)}</CustomSelect></label>
 <label>{t('AI role')}<CustomSelect value={profile.role} onChange={e=>update({role:e.target.value as AIConfiguration['role']})}>{aiRoles.map(p=><option key={p} value={p}>{t({implementation:'implementation',review:'Code review',analysis:'Failure analysis',design:'Design'}[p])}</option>)}</CustomSelect></label>
 <label>{t('Execution location')}<CustomSelect value={profile.location} onChange={e=>update({location:e.target.value as AIConfiguration['location']})}>{(['core','device','external']as const).map(p=><option key={p} value={p}>{t({core:'Core host',device:'Assigned device',external:'External service'}[p])}</option>)}</CustomSelect></label>
 <label>{t('Connection reference')}<input value={profile.connectionRef} maxLength={200} onChange={e=>update({connectionRef:e.target.value})}/></label>
 {([['maxRequests','Maximum provider requests',1,12],['timeoutSeconds','Timeout seconds',1,120],['maxAttempts','Maximum fix attempts',1,3]]as const).map(([key,label,min,max])=><label key={key}>{t(label)}<input type="number" min={min} max={max} value={profile[key]} onChange={e=>update({[key]:Number(e.target.value)})}/></label>)}
 <label className="orch-ai-prompt">{t('AI prompt')}<textarea rows={5} maxLength={3000} value={profile.prompt} onChange={e=>update({prompt:e.target.value})}/></label>
 <p className="orch-ai-prompt">{t('Configuration only. Graph AI dispatch is not yet connected; existing Core AI analysis remains available. All source changes require separate approval.')}</p>
 <button className="fs-button" onClick={()=>{state.change({...state.store,profiles:state.store.profiles.filter(p=>p.id!==profile.id),bindings:Object.fromEntries(Object.entries(state.store.bindings).filter(([,id])=>id!==profile.id))});setSelected('');}}>{t('Remove AI configuration')}</button>
 </div>}
 <p>{t('Bind an AI configuration in the task inspector. The exact task prompt is shown there.')}</p>
 <small>{t('Task bindings')}: {nodes.filter(n=>n.kind==='task'&&state.store.bindings[n.id]).length}</small>
 </details>;
}
export function TaskAIConfiguration({state,node}:{state:ReturnType<typeof useAIConfigurations>;node:GraphNode}){
 const {t}=useI18n(),ai=useAI(),{dispatch}=useWorkspace();const id=state.store.bindings[node.id]??'',profile=state.store.profiles.find(p=>p.id===id);
 const canPrepare=canPrepareConfiguration(profile);
 return <section className="orch-task-ai"><h3>{t('Task AI')}</h3><label>{t('AI configuration')}<CustomSelect value={id} disabled={!state.ready} onChange={e=>{const bindings={...state.store.bindings};if(e.target.value)bindings[node.id]=e.target.value;else delete bindings[node.id];state.change({...state.store,bindings});}}><option value="">{t('Not configured')}</option>{state.store.profiles.map(p=><option key={p.id} value={p.id}>{p.name} · {p.provider} · {p.model||t('Configured on Core')}</option>)}</CustomSelect></label>
 {profile&&<><p>{t('AI role')}: {t({implementation:'implementation',review:'Code review',analysis:'Failure analysis',design:'Design'}[profile.role])}</p><p>{t('Configuration only. Graph AI dispatch is not yet connected; existing Core AI analysis remains available. All source changes require separate approval.')}</p><details open><summary>{t('Prompt preview')}</summary><pre>{configurationPrompt(profile,node.label)}</pre></details></>}
 <button className="fs-button" disabled={!canPrepare||state.dirty||ai.status==='generating'} onClick={()=>{if(!profile||!canPrepare)return;ai.configureBudget({...defaultBudget,maxProviderRequests:profile.maxRequests,timeoutMs:profile.timeoutSeconds*1000},profile.maxAttempts);ai.reset();ai.setDraftQuestion(configurationPrompt(profile,node.label));dispatch({type:'activity',value:'ai'});}}>{t('Prepare prompt in AI')}</button>
 <p>{t('Preparation does not send data. Core selects the actual provider and model. Other connections require an adapter; no fallback is used.')}</p>
 <button className="fs-button" disabled={!state.ready||!state.dirty} onClick={state.save}>{t('Save AI configurations')}</button>
 </section>;
}
