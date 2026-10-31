'use client';
import {useEffect,useRef,useState} from 'react';
import {Factory} from 'lucide-react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {useAI} from '../ai/views';
import {useFiles} from '../editor/session';
import {factoryPlanningQuestion,parseFactoryPlan} from './factory-plan';
import {remoteCore} from '../core/remote-client';
import {factorySourceChanged,factoryDependencyProgress,validateFactoryContract,validateFactoryDefinition,type FactoryContract,type FactoryOverview,type FactoryTask} from './factory';
import {intentReference,type TeamIntent} from './team-intent';
import type {GraphOverview} from './execution';

export function FactoryBoard({onTemplate,onChoose,templateDisabled,intent}:{intent?:TeamIntent;onTemplate:()=>void;onChoose:(executionId:string,nodeId:string)=>void;templateDisabled:boolean}){
  const core=useCore(),ai=useAI(),files=useFiles(),{t}=useI18n(),project=core.project.id,session=remoteCore.generation,connected=core.remote&&core.connection.connected;
  const [data,setData]=useState<{project:string;session:number;factory:FactoryOverview;graph:GraphOverview}|null>(null);
  const [objective,setObjective]=useState(''),[acceptance,setAcceptance]=useState(''),[paths,setPaths]=useState('src'),[resources,setResources]=useState(''),[dependencies,setDependencies]=useState('');
  const [entry,setEntry]=useState(''),[implementation,setImplementation]=useState(''),[review,setReview]=useState(''),[notes,setNotes]=useState(''),[consent,setConsent]=useState(false),[attempts,setAttempts]=useState(3),[timeout,setTimeoutMinutes]=useState(30);
  const [plan,setPlan]=useState<FactoryContract[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false),epoch=useRef(0);
  const current=data?.project===project&&data.session===session&&connected?data:null;
  useEffect(()=>{let live=true,inflight=false;const generation=++epoch.current;async function refresh(){if(!connected||inflight)return;inflight=true;try{const [factory,graph]=await Promise.all([remoteCore.factoryRequest<FactoryOverview>('list'),remoteCore.graphRequest<GraphOverview>('list')]);if(live&&generation===epoch.current)setData({project,session,factory,graph});}catch(e){if(live)setError(e instanceof Error?e.message:'Factory unavailable.');}finally{inflight=false;}}void refresh();const timer=setInterval(()=>void refresh(),2000);return()=>{live=false;clearInterval(timer);};},[connected,project,session]);
  const definition=current?.graph.definition,aiNodes=definition?.graph.nodes.filter(n=>definition.aiTasks?.[n.id])??[],roots=definition?.graph.nodes.filter(n=>['task','approval'].includes(n.kind)&&!definition.graph.edges.some(e=>e.to===n.id&&e.relation==='success'))??[];
  const implementationId=implementation||aiNodes.find(n=>definition?.aiTasks?.[n.id].completion==='verified-fix')?.id||'',reviewId=review||aiNodes.find(n=>n.id!==implementationId&&(definition?.aiTasks?.[n.id].completion??'analysis')==='analysis'&&(!intent||n.teamRole==='review'))?.id||'',entryId=entry||roots[0]?.id||'';
  async function action(action:string,input?:unknown){if(lock.current||!connected)return;lock.current=true;setBusy(true);setError('');const generation=epoch.current;try{const factory=await remoteCore.factoryRequest<FactoryOverview>(action,input);if(generation===epoch.current)setData(previous=>previous&&previous.project===project&&previous.session===session?{...previous,factory}:previous);return true;}catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'Factory unavailable.');}finally{lock.current=false;setBusy(false);}}
  const seededIntent=useRef('');
  useEffect(()=>{if(!intent||seededIntent.current===intent.id+':'+intent.version)return;let live=true;queueMicrotask(()=>{if(live){seededIntent.current=intent.id+':'+intent.version;setObjective(intent.objective);setAcceptance(intent.acceptance.join('\n'));setPaths(intent.paths.join('\n'));setConsent(false);}});return()=>{live=false;};},[intent]);
  function buildContract(){
    if(!definition?.source)throw Error('Factory: publish a saved Source graph first.');
    const lines=(value:string)=>value.split('\n').map(v=>v.trim()).filter(Boolean);
    const contract:FactoryContract=validateFactoryContract({taskId:crypto.randomUUID(),projectId:project,...(intent?{intent:intentReference(intent)}:{}),objective,acceptance:lines(acceptance),paths:lines(paths),resources:lines(resources||'project:'+project).map(v=>v.toLowerCase()),dependencies:lines(dependencies).map(v=>{const parts=v.split('/');return parts.length===1?{projectId:project,taskId:parts[0]}:{projectId:parts[0],taskId:parts[1]};}),entryNodeId:entryId,implementationNodeId:implementationId,reviewNodeId:reviewId,revision:definition.revision,checksum:definition.checksum,inputChecksum:definition.inputChecksum,sourceChecksum:definition.source.checksum,maxAttempts:attempts,timeoutMinutes:timeout},project);
    validateFactoryDefinition(contract,definition);return contract;
  }
  function create(){try{void action('create',{contract:buildContract()});}catch(e){setError(e instanceof Error?e.message:'Invalid contract.');}}
  async function suggest(){
    if(lock.current||ai.status==='generating'||!ai.historyReady)return;
    lock.current=true;setBusy(true);setError('');const generation=epoch.current;
    try{
      const base=buildContract(),profile=(intent?Object.values(definition!.aiTasks!).find(p=>definition!.graph.nodes.some(n=>n.id===p.nodeId&&n.teamRole==='leader'&&(p.completion??'analysis')==='analysis')):undefined)??definition!.aiTasks![implementationId],question=factoryPlanningQuestion(base);
      if(question.length>4000)throw Error('Factory: shorten the planning request.');
      const record=await ai.send(question,false,false,{...profile,question,completion:'analysis',nodeId:'factory-planner',label:'Factory work planning',maximum:1});
      if(!record)throw Error('Factory: AI work planning did not produce a grounded result.');
      const proposed=parseFactoryPlan(record.result.summary,base,Object.keys(record.originals));
      if(generation===epoch.current){setPlan(proposed);setConsent(false);}
    }catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'Invalid plan.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function reviewSource(task:FactoryTask){if(!definition?.source)return;const answer=await files.ask({title:'Review current Source',message:task.contract.taskId+'\n'+task.contract.sourceChecksum+' → '+definition.source.checksum+'\n'+t('Source reviewed. Explicit queue approval is required.'),choices:[{value:'review',label:'Confirm'},{value:'cancel',label:'Cancel'}]});if(answer==='review')await action('review-source',{taskId:task.contract.taskId,version:task.version,sourceChecksum:definition.source.checksum,revision:definition.revision});}
  function taskAction(actionName:string,task:FactoryTask,accepted?:boolean){void action(actionName,{taskId:task.contract.taskId,version:task.version,...(accepted===undefined?{}:{accepted}),notes});}
  return <details className="orch-factory" open={intent?true:undefined}><summary><Factory size={16} aria-hidden="true"/>{t('Software factory')} · {current?.factory.tasks.length??0}</summary>
    <p>{t('Approve a work contract to queue implementation, real tests and independent review. Source patches retain their existing approval checks.')}</p>
    <button className="fs-button" disabled={templateDisabled||busy} onClick={onTemplate}>{t('Add factory workflow draft')}</button>
    {!connected&&<p>{t('Connect to Core in Agents.')}</p>}
    {current&&<><p>{t('Maximum parallel work')}: {current.factory.maximumParallel} · {t(current.factory.durable?'Durable storage':'Memory storage; restart loses graph history')}</p>
      <div className="orch-factory-fields">
        <label>{t('Work objective')}<textarea maxLength={1200} value={objective} onChange={e=>{setObjective(e.target.value);setConsent(false);}}/></label>
        <label>{t('Acceptance criteria, one per line')}<textarea maxLength={3000} value={acceptance} onChange={e=>setAcceptance(e.target.value)}/></label>
        <label>{t('Allowed relative paths, one per line')}<textarea maxLength={6000} value={paths} onChange={e=>setPaths(e.target.value)}/></label>
        <label>{t('Exclusive resources, one per line')}<textarea value={resources} maxLength={3200} placeholder={'project:'+project} onChange={e=>setResources(e.target.value)}/></label>
        <label>{t('Dependencies: task ID or project ID/task ID')}<textarea value={dependencies} maxLength={6000} onChange={e=>setDependencies(e.target.value)}/></label>
        <label>{t('Entry node')}<CustomSelect value={entryId} onChange={e=>setEntry(e.target.value)}>{roots.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</CustomSelect></label>
        <label>{t('Implementation')}<CustomSelect value={implementationId} onChange={e=>setImplementation(e.target.value)}>{aiNodes.filter(n=>definition?.aiTasks?.[n.id].completion==='verified-fix').map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</CustomSelect></label>
        <label>{t('Independent review')}<CustomSelect value={reviewId} onChange={e=>setReview(e.target.value)}>{aiNodes.filter(n=>n.id!==implementationId&&(definition?.aiTasks?.[n.id].completion??'analysis')==='analysis'&&(!intent||n.teamRole==='review')).map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</CustomSelect></label>
        <label>{t('Maximum attempts')}<input type="number" min={1} max={3} value={attempts} onChange={e=>setAttempts(Number(e.target.value))}/></label>
        <label>{t('Work budget, minutes')}<input type="number" min={1} max={120} value={timeout} onChange={e=>setTimeoutMinutes(Number(e.target.value))}/></label>
      </div>
      <button className="fs-button" disabled={busy||!definition||!objective.trim()||!acceptance.trim()} onClick={create}>{t('Save work contract draft')}</button>
      <button className="fs-button" disabled={busy||!definition||!objective.trim()||!acceptance.trim()||!ai.historyReady||ai.status==='generating'} onClick={()=>void suggest()}>{t('Divide work with AI')}</button>
      {plan.length>0&&<section aria-label={t('Proposed work breakdown')}><h3>{t('Proposed work breakdown')}</h3><ol>{plan.map(item=><li key={item.taskId}><strong>{item.objective}</strong><p>{item.acceptance.join(' · ')}</p><code>{item.paths.join(', ')}</code><p>{item.dependencies.map(d=>d.taskId).join(', ')}</p></li>)}</ol><button className="fs-button" disabled={busy} onClick={()=>void action('create-plan',{contracts:plan}).then(saved=>{if(saved)setPlan([]);})}>{t('Save reviewed plan as drafts')}</button><button className="fs-button" disabled={busy} onClick={()=>setPlan([])}>{t('Discard plan')}</button></section>}
      <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t('I approve the displayed contract, graph revision and bounded AI analysis. Packaging and publication are separate.')}</label>
      <label>{t('Review or retry notes')}<textarea value={notes} maxLength={1000} onChange={e=>setNotes(e.target.value)}/></label>
      <details><summary>{t('Reviewed draft queue')}</summary><ul>{current.factory.tasks.filter(task=>task.status==='draft'&&(!intent||task.contract.intent?.id===intent.id)).slice(0,8).map(task=><li key={task.contract.taskId}><strong>{task.contract.objective}</strong> · {task.contract.taskId} · v{task.version}<code>{task.contract.paths.join(', ')} · {task.contract.sourceChecksum}</code></li>)}</ul><button className="fs-button" disabled={busy||!consent||!current.factory.tasks.some(task=>task.status==='draft'&&(!intent||task.contract.intent?.id===intent.id))} onClick={()=>void action('queue-plan',{tasks:current.factory.tasks.filter(task=>task.status==='draft'&&(!intent||task.contract.intent?.id===intent.id)).slice(0,8).map(task=>({taskId:task.contract.taskId,version:task.version}))})}>{t('Approve and queue displayed drafts')}</button></details>
      <ol className="orch-factory-tasks">{current.factory.tasks.map(task=><li key={task.contract.taskId}>
        <strong>{task.contract.objective}</strong><span>{t(task.status)} · v{task.version} · {task.attempts.length}/{task.contract.maxAttempts}</span><code>{task.contract.taskId}</code>
        <details><summary>{t('Work contract')}</summary><ul>{task.contract.acceptance.map((line,i)=><li key={i}>{line}</li>)}</ul><p>{task.contract.paths.join(', ')} · {task.contract.resources.join(', ')}</p><p>{t('Core revision')}: {task.contract.revision}</p><code>{task.contract.sourceChecksum}</code><p>{task.contract.dependencies.map(d=>d.projectId+'/'+d.taskId).join(', ')}</p></details>
        {['draft','queued','paused'].includes(task.status)&&!task.attempts.length&&factorySourceChanged(task.contract,definition)&&<button className="fs-button" disabled={busy} onClick={()=>void reviewSource(task)}>{t('Review current Source')}</button>}{task.sourceReviews?.length&&<details><summary>{t('Source review history')}</summary>{task.sourceReviews.map((r,i)=><p key={i}>{r.previous.sourceChecksum} · {r.at}</p>)}</details>}{task.reason&&<p>{t(task.reason)}</p>}
        {!!task.contract.dependencies.length&&<details><summary>{t('Dependencies: task ID or project ID/task ID')}</summary>{factoryDependencyProgress(task,current.factory.tasks).map(dep=><div className="orch-factory-dependency" key={dep.projectId+'/'+dep.taskId}><p><code>{dep.taskId}</code> · {t(dep.status)}</p>{dep.sourceChecksum&&<span>{t('Execution Source')}<code>{dep.sourceChecksum}</code></span>}{dep.executionId&&dep.nodeId&&dep.projectId===project&&<button className="ws-text-button" onClick={()=>onChoose(dep.executionId!,dep.nodeId!)}>{t('Execution monitoring')}</button>}{dep.runId&&dep.projectId===project&&<button className="ws-text-button" onClick={()=>void ai.openRun(dep.runId!)}>{t('Open Run')}</button>}</div>)}</details>}{task.attempts.map((attempt,i)=><button key={i} className="ws-text-button" onClick={()=>onChoose(attempt.executionId,task.contract.implementationNodeId)}>{t('Execution monitoring')} · {i+1} · {attempt.executionId.slice(-8)}</button>)}
        {task.status==='draft'&&<button className="fs-button" disabled={busy||!consent} onClick={()=>taskAction('queue',task)}>{t('Approve and queue')}</button>}
        {task.status==='paused'&&<button className="fs-button" disabled={busy||!consent} onClick={()=>taskAction('resume',task)}>{t('Resume reviewed work')}</button>}
        {task.status==='failed'&&current.graph.executions.find(e=>e.id===task.attempts.at(-1)?.executionId)?.status==='failed'&&<button className="fs-button" disabled={busy||!consent||!notes.trim()||task.attempts.length>=task.contract.maxAttempts} onClick={()=>taskAction('retry',task)}>{t('Retry failed gate')}</button>}
        {task.status==='review'&&<><button className="fs-button" disabled={busy||!notes.trim()} onClick={()=>taskAction('review',task,true)}>{t('Accept reviewed work')}</button><button className="fs-button" disabled={busy||!notes.trim()} onClick={()=>taskAction('review',task,false)}>{t('Request changes')}</button></>}
        {!['completed','cancelled'].includes(task.status)&&<button className="fs-button" disabled={busy||task.status==='cancelling'} onClick={()=>taskAction('cancel',task)}>{t('Cancel')}</button>}
      </li>)}</ol>
    </>}
    {error&&<p role="alert">{t(error)}</p>}
  </details>;
}
