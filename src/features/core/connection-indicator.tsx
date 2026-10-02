'use client';
import {useEffect,useRef,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useWorkspace} from '../workspace/context';
import {useCore} from './context';
import {connectionPresentation} from './connection-presentation';

export function CoreConnectionIndicator({compact=false}:{compact?:boolean}) {
  const {t}=useI18n(),{connection,snapshot}=useCore(),{dispatch}=useWorkspace();
  const state=connectionPresentation(connection.phase,connection.connectionKey,snapshot);
  return <button type="button" className="core-status-chip" data-tone={state.tone} title={state.host} onClick={()=>dispatch({type:'activity',value:'agents'})}>
    <span className="core-status-dot" aria-hidden="true"/>{t(state.label)}{!compact&&state.connected&&<span> · {t('Agents')} {state.agents}</span>}
  </button>;
}

export function CoreConnectionToast() {
  const {t}=useI18n(),{connection}=useCore();
  const phase=connection.phase,key=connection.connectionKey;
  const previous=useRef({phase,key});const [notice,setNotice]=useState('');
  useEffect(()=>{
    const before=previous.current;previous.current={phase,key};
    const message=phase==='connected'&&(before.phase!=='connected'||before.key!==key)?'Connected to Core':before.phase==='connected'&&phase!=='connected'?(phase==='recovering'?'Reconnecting to Core…':'Core disconnected'):'';
    if(!message)return;
    let active=true;Promise.resolve().then(()=>{if(active)setNotice(message);});
    return()=>{active=false;};
  },[phase,key]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  return notice?<div className="core-connection-toast" role="status" aria-live="polite"><span>{t(notice)}</span><button type="button" aria-label={t('Dismiss')} onClick={()=>setNotice('')}>×</button></div>:null;
}
