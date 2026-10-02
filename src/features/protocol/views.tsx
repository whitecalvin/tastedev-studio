'use client';
import { useI18n } from '@/i18n/react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useFiles } from '../editor/session';
import { useCore } from '../core/context';
import { useWorkspace } from '../workspace/context';
import { protocolFiles, type ProtocolState } from './domain';
import { initializeProtocol, loadProtocol, workspaceReader } from './loader';
import { resolveProtocol, resolveTestPlan } from './resolver';
import { planPayload } from '../core/test-plan';
import { buildProjectSnapshot } from '../ai/project-snapshot';
import { withWorkspaceSnapshot } from './workspace-test';
import { DefinitionForm } from './definition-form';
import { matchAgent } from '../core/matcher';

function useProtocolState() {
  const { files, connection, ready, revision, editor, refresh, ask, documents } = useFiles();
  const core = useCore();
  const { dispatch } = useWorkspace();
  const [state, setState] = useState<ProtocolState>({ status: 'Not Configured', issues: [] });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  const accessible = ready && connection?.permission === 'granted';
  const saved = JSON.stringify(editor.openEditors.filter(d => d.path.startsWith('.tastedev/')).map(d => [d.path, d.savedContent]));
  const dirty = editor.openEditors.some(d => d.path.startsWith('.tastedev/') && d.content !== d.savedContent);
  useEffect(() => {
    const current = ++generation.current;
    const reader = connection?.permission === 'granted' ? workspaceReader(files.host, connection.id) : null;
    Promise.resolve().then(async () => {
      if (current !== generation.current) return;
      setLoading(true);
      const next = reader ? await loadProtocol(reader) : { status: 'Not Configured' as const, issues: [] };
      if (current === generation.current) { setState(next); setLoading(false); setMessage(''); }
    });
    return () => { generation.current = current + 1; };
  }, [files, connection?.id, connection?.permission, ready, revision, saved, reloadKey]);
  async function action(operation: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setPending(true); setMessage('');
    try { await operation(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Protocol action failed. Reload and try again.'); }
    finally { locked.current = false; setPending(false); }
  }
  function initialize() {
    void action(async () => {
      if (!accessible || !connection) throw new Error('Connect the project folder first.');
      await initializeProtocol(files.host, connection.id);
      refresh();
    });
  }
  function queue(kind: 'task' | 'test', name: string) {
    void action(async () => {
      if (!accessible || !connection || dirty) throw new Error('Save Protocol files and reconnect the project folder before queuing.');
      if (!core.remote || !core.connection.connected) throw new Error('Connect to Core in Agents before queuing a Protocol task.');
      const current = generation.current;
      const fresh = await loadProtocol(workspaceReader(files.host, connection.id));
      if (current !== generation.current || files.connection?.id !== connection.id) throw new Error('The workspace changed. Reload Protocol before queuing.');
      setState(fresh);
      let plan = kind === 'test' ? resolveTestPlan(fresh, core.project.id, name) : null;
      if (plan && fresh.status === 'Valid' && !fresh.definition.source) {
        if (documents.snapshot().dirtyEditors.length) throw Error('Save current edits before taking a snapshot.');
        const choice = await ask({ title: 'Approve validation and remote retest', message: `Run Protocol Test ${name} on an eligible Agent using a secret-filtered saved workspace snapshot?`, choices: [{ value: 'run', label: 'Approve Retest' }, { value: 'cancel', label: 'Cancel' }] });
        if (choice !== 'run') return;
        const d = fresh.definition;
        const secrets = [...Object.values(d.environment), ...Object.values(d.environments).flatMap(Object.values), ...Object.values(d.tasks).flatMap(task => Object.values(task.env)), ...Object.values(d.tests).flatMap(test => Object.values(test.env ?? {}))];
        const { snapshot } = await buildProjectSnapshot(files, { projectId: core.project.id, proposalId: plan.id, attempt: 1, baseRevision: 'working-tree', changedFiles: [] }, secrets);
        if (current !== generation.current || files.connection?.id !== connection.id || documents.snapshot().dirtyEditors.length) throw Error('The workspace changed. Reload Protocol before queuing.');
        const reference=await core.connection.uploadSnapshot(snapshot,undefined,p=>setMessage(`Source transfer: ${p.files}/${p.totalFiles} files, ${p.cachedFiles} reused`));
        if(current!==generation.current||files.connection?.id!==connection.id||documents.snapshot().dirtyEditors.length)throw Error('The workspace changed during transfer. Reload before queuing.');
        plan = withWorkspaceSnapshot(plan, reference);
      }
      const input = plan ? { name:`test: ${name}`, requirements:plan.requirements, payload:planPayload(plan) } : resolveProtocol(fresh, kind, name);
      const job = await core.service.createJob(core.project.id, input);
      core.select({ kind: 'job', id: job.id });
      core.setMessage('Protocol task queued. Review compatibility, then assign a compatible Agent.');
      dispatch({ type: 'activity', value: 'queue' });
    });
  }
  return { state, loading, pending, message, accessible, dirty, initialize, queue, reload: () => setReloadKey(n => n + 1), connected: core.remote && core.connection.connected };
}
const Context = createContext<ReturnType<typeof useProtocolState> | null>(null);
export function ProtocolProvider({ children }: { children: React.ReactNode }) { return <Context.Provider value={useProtocolState()}>{children}</Context.Provider>; }
export function useProtocol() { const value = useContext(Context); if (!value) throw new Error('Protocol provider required.'); return value; }
export function ProtocolStatus() {
  const { t } = useI18n();

  const p = useProtocol(); const { dispatch } = useWorkspace();
  return <button className="protocol-status" title={t("Open TASTEDEV project definition")} onClick={() => dispatch({ type: 'activity', value: 'run' })}>{t("Protocol:")} {!p.accessible ? t("Access Required") : p.loading ? t("Loading…") : t(p.state.status)}</button>;
}
export function ProtocolView({ tests = false }: { tests?: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<{ kind: 'task' | 'test'; name?: string } | null>(null);
  const core = useCore();
  const p = useProtocol(); const { documents, run } = useFiles(); const { dispatch } = useWorkspace();
  const d = p.state.status === 'Valid' ? p.state.definition : null;
  const open = (file: string) => void run('Opening Protocol…', async () => { await documents.open(`.tastedev/${file}`); dispatch({ type: 'activity', value: 'explorer' }); });
  return <section className="protocol-view" aria-label={tests ? t("Protocol tests") : t("TASTEDEV Protocol")}>
    <div className="protocol-heading"><h3>{tests ? t("Test definitions") : t("TASTEDEV Protocol")}</h3><button className="fs-button" disabled={!p.accessible || p.pending || p.loading} onClick={p.reload}>{t("Reload")}</button></div>
    <p className="protocol-state" role="status">{!p.accessible ? t("Connect the project folder to inspect .tastedev.") : p.loading ? t("Loading Protocol…") : `${t(p.state.status)}${d ? ' · v1' : ''}`}</p>
    {p.message && <p className="protocol-error" role="alert">{p.message}</p>}
    {p.accessible && !p.loading && <>
      {p.state.status === 'Not Configured' && <><p>{t("This project has no .tastedev/project.yml. Local IDE features remain available.")}</p><button className="fs-button" disabled={p.pending} onClick={p.initialize}>{t("Initialize TASTEDEV")}</button><p>{t("Creates a definition without executable tasks.")}</p></>}
      {p.state.status === 'Invalid' && <div role="alert"><p>{t("Fix the definition, save, then reload.")}</p>{p.state.issues.map((issue, i) => <div className="protocol-issue" key={i}><button className="ws-text-button" onClick={() => open(issue.file.split('/').pop()!)}>{issue.file}</button><code>{issue.path}</code><p>{issue.message}</p></div>)}</div>}
      {d && <>
        <p>{d.project.name} · {d.project.type}</p>
        <details><summary>{t("Project requirements")}</summary><pre>{JSON.stringify(d.requirements, null, 2)}</pre></details>
        <details><summary>{t("Definition files")}</summary>{protocolFiles.map(file => <button className="ws-text-button protocol-file" key={file} onClick={() => open(file)}>{file}</button>)}<p>{t("Optional files can be created in Explorer.")}</p></details>
        <h4>{tests ? t("Tests") : t("Tasks")}</h4>
        <button className="fs-button" disabled={p.pending || p.dirty} onClick={() => setEditing({ kind: tests ? 'test' : 'task' })}>{t(tests ? 'New test' : 'New task')}</button>
        {editing && <DefinitionForm key={`${editing.kind}:${editing.name ?? 'new'}`} kind={editing.kind} name={editing.name} projectId={core.project.id} onClose={() => setEditing(null)} onSaved={p.reload} />}
        {Object.keys(tests ? d.tests : d.tasks).length === 0 && <p>{t("No")} {tests ? 'tests' : 'tasks'} {t("declared. Edit")} {tests ? 'tests.yml' : 'tasks.yml'} {t("in Explorer.")}</p>}
        <ul className="protocol-list">{Object.values(tests ? d.tests : d.tasks).map(item => {
          if(tests) return <TestEntry key={item.name} name={item.name} onEdit={() => setEditing({ kind: 'test', name: item.name })}/>;
          const kind = 'task'; const resolved = resolveProtocol(p.state, kind, item.name); const step = resolved.payload.steps[0];
          return <li key={item.name}><strong>{item.name}</strong><button className="ws-text-button" disabled={p.pending || p.dirty} onClick={() => setEditing({ kind: 'task', name: item.name })}>{t('Edit definition')}</button>{'type' in item && <small>{item.type} {t("· task:")} {item.task}</small>}<code>{step.executable} · {step.cwd} · {step.timeoutMs! / 1000}{t("s")}</code><details><summary>{t("Effective requirements")}</summary><pre>{JSON.stringify(resolved.requirements, null, 2)}</pre></details><button className="fs-button" disabled={p.pending || p.dirty || !p.connected} onClick={() => p.queue(kind, item.name)}>{t("Queue")} {tests ? 'test' : 'task'}: {item.name}</button></li>;
        })}</ul>
        {p.dirty && <p role="status">{t("Save Protocol edits before queuing. The view reflects saved files.")}</p>}
        {!p.connected && <p>{t("Connect to Core in Agents to queue a task.")}</p>}
        <p>{t("Assign the queued job to a compatible Agent to execute it.")}</p>
        {tests && <p>{d.source ? `Remote tests use Git revision ${d.source.revision}. Unsaved or uncommitted local changes are not included.` : t('Without a Git source, tests use an approved, secret-filtered snapshot of saved workspace files.')}</p>}
      </>}
    </>}
  </section>;
}
function TestEntry({name,onEdit}:{name:string;onEdit():void}) {
  const { t } = useI18n();

  const p=useProtocol(),core=useCore(),{dispatch}=useWorkspace();
  let plan,problem='';
  try {plan=resolveTestPlan(p.state,core.project.id,name,'preview');}catch(e){problem=e instanceof Error?e.message:'Invalid TestPlan.';}
  const job=[...core.snapshot.jobs].reverse().find(j=>j.payload.testPlan?.testName===name);
  const latest=core.snapshot.runs.find(r=>r.jobId===job?.id);
  const steps=core.snapshot.steps.filter(s=>s.runId===latest?.id),current=steps.find(s=>s.status==='running');
  const readiness = plan ? core.snapshot.agents.map(agent => ({agent, ...matchAgent(agent, plan.requirements)})) : [];
  const elapsed=latest?.startedAt?Math.max(0,Date.parse(latest.finishedAt??new Date().toISOString())-Date.parse(latest.startedAt))/1000:0;
  return <li><strong>{name}</strong><button className="ws-text-button" disabled={p.pending || p.dirty} onClick={onEdit}>{t('Edit definition')}</button><small>{plan?.steps.some(s=>s.browser)?t("Chromium · "):''}{plan?.type??t("Invalid plan")} · {latest?.status??job?.status??t("Not run")}</small>{problem?<p role="alert">{problem}</p>:<><code>{plan!.steps.map(s=>s.stage).join(' → ')}</code><details><summary>{t("Effective requirements")}</summary><pre>{JSON.stringify(plan!.requirements,null,2)}</pre></details><button className="fs-button" disabled={p.pending||p.dirty||!p.connected} onClick={()=>p.queue('test',name)}>{t("Run Test:")} {name}</button></>}<details><summary>{t("Agent readiness")}</summary>{readiness.length ? readiness.map(match => <p key={match.agent.id}>{match.agent.name}: {match.matches ? t("Compatible") : match.reasons.map(reason => t(reason)).join(" · ")}</p>) : <p>{t("No agents registered.")}</p>}<p>{t("Capability preview. Core checks permissions and availability again when assigning.")}</p></details>{job && <button className="ws-text-button" onClick={() => {core.select({kind:"job",id:job.id});dispatch({type:"activity",value:"queue"});}}>{t("Inspect queue / cancel / retry")}</button>}{latest&&<><p>{current?`Current: ${current.name}`:t("Latest result")} · {steps.filter(s=>!['pending','running'].includes(s.status)).length}/{steps.length} {t("steps ·")} {elapsed.toFixed(1)}{t("s")}</p><small>{core.snapshot.agents.find(a=>a.id===latest.agentId)?.name??latest.agentId}</small><button className="ws-text-button" onClick={()=>{core.select({kind:'run',id:latest.id});dispatch({type:'activity',value:'runs'});}}>{t("View")} {t(latest.status)} {t("run")}</button></>}</li>;
}

