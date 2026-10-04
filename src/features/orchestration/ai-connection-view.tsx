'use client';
import {useEffect,useRef,useState} from 'react';
import {useCore} from '../core/context';
import {useI18n} from '@/i18n/react';
import type {AIConnectionStatus} from '../ai/connection-status';
import type {ManagedAIConnection} from '../ai/routing';
import {canPrepareConfiguration,configurationRoute,type AIConfiguration} from './ai-config';

export function AIConnectionView({profile,connections}:{profile:AIConfiguration;connections:ManagedAIConnection[]}){
 const {t}=useI18n(),core=useCore(),controller=useRef<AbortController|null>(null);
 const key=JSON.stringify([core.project.id,core.connection.connectionKey,core.connection.generation,core.connection.connected,profile,connections]);
 const latest=useRef(key);
 const [check,setCheck]=useState<{key:string;busy:boolean;result?:AIConnectionStatus;error?:string}|null>(null);
 useEffect(()=>{latest.current=key;return()=>controller.current?.abort();},[key]);
 const visible=check?.key===key?check:null;
 async function inspect(){
  if(!core.connection.connected)return;controller.current?.abort();const c=new AbortController();controller.current=c;setCheck({key,busy:true});
  try{const result=await core.connection.inspectAI(core.project.id,AbortSignal.any([c.signal,AbortSignal.timeout(15000)]),configurationRoute(profile,connections));if(!c.signal.aborted&&latest.current===key)setCheck({key,busy:false,result});}
  catch(e){if(!c.signal.aborted&&latest.current===key)setCheck({key,busy:false,error:e instanceof Error?e.message:'AI connection inspection failed.'});}
 }
 return <section className="orch-task-ai" aria-label={t('AI connection readiness')}>
 <h4>{t('AI connection readiness')}</h4>
 <p>{t(!core.connection.connected?'Connect to Core to load managed AI connections.':!connections.length?'Managed Core connection list unavailable.':canPrepareConfiguration(profile,connections)?'This configuration uses the existing Core AI adapter.':'This configuration requires an adapter that is not available. No fallback will be used.')}</p>
 <button className="fs-button" disabled={!core.connection.connected||!configurationRoute(profile,connections)||visible?.busy} onClick={()=>void inspect()}>{t(visible?.busy?'Checking AI connection…':'Check Core AI connection')}</button>
 {!core.connection.connected&&<p>{t('Core connection required.')}</p>}
 {visible?.error&&<p role="status">{t(visible.error)}</p>}
 {visible?.result&&<div role="status"><p>{t('Actual Core adapter')}: {visible.result.adapter}</p><p>{t('Model')}: {visible.result.model||t('Provider default model')}</p>
 <p>{t({missing:'AI authentication required.',configured:'Credential configured; authentication not verified.',authenticated:'ChatGPT account available.'}[visible.result.authentication])}</p></div>}
 <small>{t('Connection inspection does not send source, logs or prompts, and does not run a model. Model availability and quota remain unverified.')}</small>
 </section>;
}
