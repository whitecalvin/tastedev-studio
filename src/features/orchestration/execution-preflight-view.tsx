'use client';
import {ClipboardCheck,CheckCircle2,AlertCircle,ChevronRight} from 'lucide-react';
import {useRef,useState} from 'react';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {useFiles} from '../editor/session';
import {useWorkspace} from '../workspace/context';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {executionPreflight} from './execution-preflight';

export function ExecutionPreflight({graph,overview,dirty,disabled,onChoose}:{graph:ProjectGraph;overview:GraphOverview|null;dirty:boolean;disabled:boolean;onChoose:(id:string)=>void}){
  const {t}=useI18n(),core=useCore(),files=useFiles(),{dispatch}=useWorkspace();
  const [auth,setAuth]=useState<{key:string;values:Record<string,'authenticated'|'missing'|'unverified'|'failed'>}>({key:'',values:{}}),[busy,setBusy]=useState(false),lock=useRef(false);
  const routes=overview?.definition?.projectId===graph.projectId?overview.definition.aiTasks??{}:{};
  const key=JSON.stringify([graph.projectId,core.connection.generation,core.connection.connected,overview?.definition?.revision,routes]);
  const report=executionPreflight({graph,overview,agents:core.snapshot.agents,connected:core.remote&&core.connection.connected,dirty,dirtyEditors:files.editor.dirtyEditors.length,authentication:auth.key===key?auth.values:undefined});
  async function checkAuthentication(){
    if(lock.current||disabled||!core.remote||!core.connection.connected)return;
    lock.current=true;setBusy(true);const captured=key,generation=core.connection.generation;
    try{const values=await Promise.all(Object.entries(routes).map(async([id,task])=>{try{const status=await core.connection.inspectAI(graph.projectId,AbortSignal.timeout(15000),task.route);return[id,status.authentication==='configured'?'unverified':status.authentication] as const;}catch{return[id,'failed'] as const;}}));if(generation===core.connection.generation)setAuth({key:captured,values:Object.fromEntries(values)});}
    finally{lock.current=false;setBusy(false);}
  }
  return <details className="project-preparation"><summary><ClipboardCheck size={16} aria-hidden="true"/>{t('Execution preflight')} · {report.checks.filter(c=>c.state==='ready').length}/{report.checks.length}</summary>
    <p>{t('Preparation checks do not execute tasks. Core revalidates the approved Source and capabilities before execution.')}</p>
    {!!Object.keys(routes).length&&<button type="button" className="fs-button" disabled={disabled||busy||!core.connection.connected||dirty} onClick={()=>void checkAuthentication()}>{t('Check AI authentication')}</button>}
    <ul>{report.checks.map((check,index)=><li key={`${check.nodeId??'project'}:${check.category}:${index}`} data-preparation-state={check.state==='ready'?'ready':'configuration-required'}>
      {check.state==='ready'?<CheckCircle2 size={15} aria-hidden="true"/>:<AlertCircle size={15} aria-hidden="true"/>}
      <span>{check.nodeId&&<strong>{graph.nodes.find(n=>n.id===check.nodeId)?.label} · </strong>}{t(check.message)}
        {check.agents?.map(agent=><small key={agent.id}>{agent.name}: {agent.matches?t('Ready'):agent.reasons.map(reason=>t(reason)).join(' · ')}</small>)}
      </span>
      {check.state!=='ready'&&<button type="button" className="fs-button" disabled={disabled} aria-label={t(check.message)} onClick={()=>{if(check.nodeId)onChoose(check.nodeId);if(check.action==='graph')document.getElementById('project-graph-controls')?.scrollIntoView({block:'start'});else dispatch({type:'activity',value:check.action});}}><ChevronRight size={15} aria-hidden="true"/></button>}
    </li>)}</ul>
  </details>;
}
