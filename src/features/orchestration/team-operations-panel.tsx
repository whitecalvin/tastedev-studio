'use client';
import {TeamDispatchPanel} from './team-dispatch-view';
import {remoteCore} from '../core/remote-client';
import {useState} from 'react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {teamRoles,type TeamRole} from './domain';
import {teamRoleLabels} from './team-template';
import {gateCategories,type GateCategory,type GateResult,type TeamIntent,type TeamWorkOverview} from './team-intent';

type Mutate=(action:string,input:Record<string,unknown>)=>Promise<TeamWorkOverview|undefined>;
export function TeamOperationsPanel({tab,current,intent,busy,mutate,onChoose}:{tab:string;current:TeamWorkOverview;intent?:TeamIntent;busy:boolean;mutate:Mutate;onChoose:(node:string)=>void}){
  const {t}=useI18n();const [launchError,setLaunchError]=useState(''),[launching,setLaunching]=useState(false);
  const [roleNode,setRoleNode]=useState(''),[factoryTask,setFactoryTask]=useState(''),[category,setCategory]=useState<GateCategory>('tests'),[result,setResult]=useState<GateResult>('not-run'),[kind,setKind]=useState<'run'|'manual'>('run'),[runId,setRunId]=useState(''),[note,setNote]=useState('');
  const [recipient,setRecipient]=useState<TeamRole>('review'),[sender,setSender]=useState<TeamRole>('implementation'),[messageKind,setMessageKind]=useState('handoff'),[body,setBody]=useState(''),[inboxRole,setInboxRole]=useState('all');
  const [ruleText,setRuleText]=useState(''),[ruleScope,setRuleScope]=useState<TeamRole|'project'>('project'),[feedback,setFeedback]=useState('');
  if(!intent)return <p>{t('Create a work intent first.')}</p>;
  const identity={intentId:intent.id,intentVersion:intent.version},assignment=current.assignments.find(a=>a.intentId===intent.id),work=current.work.filter(w=>w.intentId===intent.id),chosen=work.find(w=>w.taskId===factoryTask)??work.at(-1);
  async function startRole(){if(!intent||!assignment||launching)return;setLaunching(true);setLaunchError('');try{const graph=await remoteCore.graphRequest<import('./execution').GraphOverview>('list');if(!graph.definition||graph.definition.revision!==assignment.graphRevision)throw Error('Review the current role assignment.');await remoteCore.graphRequest('start',{revision:graph.definition.revision,checksum:graph.definition.checksum,entryNodeId:assignment.taskNodeId,requestId:crypto.randomUUID(),teamIntentId:intent.id});onChoose(assignment.taskNodeId);}catch(e){setLaunchError(e instanceof Error?e.message:'Role execution failed.');}finally{setLaunching(false);}}
  const roles=teamRoles.map(r=><option key={r} value={r}>{t(teamRoleLabels[r])}</option>);
  return <>
    {tab==='assignment'&&<>
      <h3>{t('Assignment')}</h3><p>{t('Choose a published responsibility. Device, Agent and AI identities are pinned to that graph revision.')}</p>
      <label>{t('Responsibility')}<CustomSelect value={roleNode} onChange={e=>setRoleNode(e.target.value)}><option value="">{t('Select')}</option>{current.roles.filter(r=>r.responsibility===intent.responsibility).map(r=><option key={r.id} value={r.id}>{t(r.label)}</option>)}</CustomSelect></label>
      <button className="fs-button" disabled={busy||!roleNode} onClick={()=>void mutate('assign',{...identity,roleNodeId:roleNode})}>{t('Save assignment')}</button>
      {assignment&&<dl className="orch-team-identities">{[['Device',assignment.deviceNodeId],['Agent',assignment.agentId],['AI profile',assignment.profileId],['Graph revision',String(assignment.graphRevision)]].map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}<button className="fs-button" onClick={()=>onChoose(assignment.taskNodeId)}>{t('Open assigned node')}</button></dl>}
      <ul>{current.waiting.find(w=>w.intentId===intent.id)?.reasons.map(r=><li key={r}>{t(r)}</li>)}</ul>
      {assignment&&intent.responsibility!=='implementation'&&<button className="fs-button" disabled={busy||launching||!intent.ready||!!current.waiting.find(w=>w.intentId===intent.id)?.reasons.length} onClick={()=>void startRole()}>{t('Prepare read-only role execution')}</button>}{launchError&&<p role="alert">{t(launchError)}</p>}
      <ul>{work.map(w=><li key={w.taskId}><code>{w.taskId}</code>{t(w.status)} · {w.reason&&t(w.reason)}{w.executionId&&<code>{w.executionId}</code>}</li>)}</ul>
    </>}
    {tab==='isolation'&&<><h3>{t('Workspace isolation')}</h3><p>{t('Source writes are serialized per project. Each Agent retest uses its own Snapshot workspace. Patch integration keeps existing approval, dirty-editor and base-hash checks.')}</p>{current.isolations?.filter(w=>w.taskId&&work.some(t=>t.taskId===w.taskId)).map(w=><article key={w.taskId}><strong>{w.taskId}</strong><code>{w.baselineChecksum}</code><p>{w.paths.join(' · ')}</p>{w.issues.map(i=><p role="alert" key={i}>{t(i)}</p>)}{w.attempts.map(a=><div key={a.id}><p>{t('Attempt')} {a.id} · {t(a.status)}</p><code>{a.snapshotId} · {a.snapshotChecksum}</code><p>{t('Run')} {a.runId??'—'} · {t(a.runStatus??'not-run')} · {t(a.sourceMatchesRun?'Snapshot matches tested Source.':'Source identity not yet verified.')}</p><ul>{a.files.map(f=><li key={f.path}>{f.path} · {t(f.approved?'approved':'not-run')}<code>{f.baseHash} → {f.resultHash}</code></li>)}</ul></div>)}</article>)}</>}
    {tab==='quality'&&<>
      <p>{t('Record actual evidence for each gate. Manual review stays distinct from automated Run results. New attempts require new evidence.')}</p>
      <label>{t('Work contract')}<CustomSelect value={chosen?.taskId??''} onChange={e=>setFactoryTask(e.target.value)}><option value="">{t('Select')}</option>{work.map(w=><option key={w.taskId} value={w.taskId}>{w.taskId} · {t(w.status)}</option>)}</CustomSelect></label>
      {chosen&&<><code>{chosen.executionId} · {chosen.sourceChecksum}</code>
        <fieldset disabled={busy} className="orch-team-fields"><legend>{t('Quality gates')}</legend>
          <label>{t('Category')}<CustomSelect value={category} onChange={e=>setCategory(e.target.value as GateCategory)}>{gateCategories.map(c=><option key={c} value={c}>{t(c)}</option>)}</CustomSelect></label>
          <label>{t('Result')}<CustomSelect value={result} onChange={e=>setResult(e.target.value as GateResult)}>{['not-run','passed','reused','failed','not-applicable'].map(r=><option key={r} value={r}>{t(r)}</option>)}</CustomSelect></label>
          <label>{t('Evidence type')}<CustomSelect value={kind} onChange={e=>setKind(e.target.value as 'run'|'manual')}><option value="run">{t('Actual Run')}</option><option value="manual">{t('Manual review')}</option></CustomSelect></label>
          {kind==='run'&&<label>{t('Run')}<CustomSelect value={runId} onChange={e=>setRunId(e.target.value)}><option value="">{t('Select')}</option>{chosen.runIds.map(id=><option key={id} value={id}>{id}</option>)}</CustomSelect></label>}
          <label>{t('Evidence or reuse rationale')}<textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label>
        </fieldset><button className="fs-button" disabled={busy||!note.trim()||!chosen.executionId||kind==='run'&&!runId} onClick={()=>void mutate('gate-record',{...identity,id:crypto.randomUUID(),factoryTaskId:chosen.taskId,executionId:chosen.executionId,category,result,kind,runId,note})}>{t('Record reviewed evidence')}</button>
      </>}
      <ul>{current.gates.filter(g=>g.intentId===intent.id).map(g=><li key={g.id}>{t(g.category)} · {t(g.result)} · {t(g.kind==='run'?'Actual Run':'Manual review')}<p>{g.note}</p><code>{g.executionId} · {g.sourceChecksum}</code></li>)}</ul>
    </>}
    {tab==='inbox'&&<>
      <TeamDispatchPanel work={current} onChoose={onChoose}/>
      <p>{t('Project inbox is stored in Core. Sending a handoff does not execute work or contact external services.')}</p>
      <fieldset disabled={busy} className="orch-team-fields"><legend>{t('New team message')}</legend>
        <label>{t('Sender role')}<CustomSelect value={sender} onChange={e=>setSender(e.target.value as TeamRole)}>{roles}</CustomSelect></label>
        <label>{t('Recipient role')}<CustomSelect value={recipient} onChange={e=>setRecipient(e.target.value as TeamRole)}>{roles}</CustomSelect></label>
        <label>{t('Message type')}<CustomSelect value={messageKind} onChange={e=>setMessageKind(e.target.value)}>{['request','question','handoff','review'].map(k=><option key={k} value={k}>{t(k)}</option>)}</CustomSelect></label>
        <label>{t('Message')}<textarea value={body} maxLength={1600} onChange={e=>setBody(e.target.value)}/></label>
      </fieldset><button className="fs-button" disabled={busy||!body.trim()} onClick={()=>void mutate('message-send',{...identity,id:crypto.randomUUID(),from:sender,to:recipient,kind:messageKind,body}).then(value=>{if(value)setBody('');})}>{t('Send to project inbox')}</button>
      <label>{t('Recipient filter')}<CustomSelect value={inboxRole} onChange={e=>setInboxRole(e.target.value)}><option value="all">{t('All')}</option>{roles}</CustomSelect></label>
      <ul>{current.messages.filter(m=>m.intentId===intent.id&&(inboxRole==='all'||m.to===inboxRole)).map(m=><li key={m.id}><strong>{t(teamRoleLabels[m.from])} → {t(teamRoleLabels[m.to])} · {t(m.kind)}</strong><p>{m.body}</p><code>{m.createdAt}</code>{m.acknowledgedAt?<p>{t('Acknowledged')} · {m.acknowledgedBy}</p>:<button className="fs-button" disabled={busy} onClick={()=>void mutate('message-ack',{...identity,id:m.id})}>{t('Acknowledge')}</button>}<button className="ws-text-button" onClick={()=>{setFeedback(m.id);setRuleText(m.body.slice(0,300));}}>{t('Use as rule feedback')}</button></li>)}</ul>
    </>}
    {tab==='rules'&&<>
      <p>{t('Feedback becomes a rule only after explicit approval. Ready work retains its reviewed rules; revise and mark ready to adopt new rules.')}</p>
      <fieldset disabled={busy} className="orch-team-fields"><legend>{t('Propose project rule')}</legend>
        <label>{t('Scope')}<CustomSelect value={ruleScope} onChange={e=>setRuleScope(e.target.value as TeamRole|'project')}><option value="project">{t('Project')}</option>{roles}</CustomSelect></label>
        <label>{t('Source feedback')}<CustomSelect value={feedback} onChange={e=>setFeedback(e.target.value)}><option value="">{t('Decision or request')}</option>{current.messages.filter(m=>m.intentId===intent.id).map(m=><option key={m.id} value={m.id}>{m.body.slice(0,80)}</option>)}</CustomSelect></label>
        <label>{t('Rule')}<textarea value={ruleText} maxLength={300} onChange={e=>setRuleText(e.target.value)}/></label>
      </fieldset><button className="fs-button" disabled={busy||!ruleText.trim()} onClick={()=>void mutate('rule-propose',{...identity,id:crypto.randomUUID(),scope:ruleScope,text:ruleText,sourceMessages:feedback?[feedback]:[]}).then(value=>{if(value){setRuleText('');setFeedback('');}})}>{t('Save rule proposal')}</button>
      <ul>{current.rules.map(r=><li key={r.id}><strong>{t(r.scope==='project'?'Project':teamRoleLabels[r.scope])} · v{r.version} · {t(r.status)}</strong><p>{r.text}</p><div className="orch-team-actions">{r.status==='proposed'&&<button className="fs-button" disabled={busy} onClick={()=>void mutate('rule-approve',{intentId:r.intentId,intentVersion:current.intents.find(i=>i.id===r.intentId)!.version,id:r.id,ruleVersion:r.version})}>{t('Approve rule')}</button>}{r.status!=='retired'&&<button className="fs-button" disabled={busy} onClick={()=>void mutate('rule-retire',{intentId:r.intentId,intentVersion:current.intents.find(i=>i.id===r.intentId)!.version,id:r.id,ruleVersion:r.version})}>{t('Retire rule')}</button>}</div></li>)}</ul>
      <h3>{t('Rules pinned to selected intent')}</h3><ul>{intent.rules?.map(r=><li key={r.id}>v{r.version} · {r.text}</li>)}</ul>
    </>}
  </>;
}
