'use client';
import { useEffect, useState } from 'react';
import { useFiles } from '../editor/session';
import { useI18n } from '@/i18n/react';
import { definitionMap, previewDraft, readProtocolSources, saveDraft, type ProtocolDraft } from './authoring';
import type { ProtocolSources } from './domain';
import { resolveTestPlan } from './resolver';
import { parseProtocol } from './parser';

export function DefinitionForm({ kind, name, projectId, onClose, onSaved }: { kind: 'task' | 'test'; name?: string; projectId: string; onClose(): void; onSaved(): void }) {
  const { t } = useI18n();
  const { files, connection, documents, refresh } = useFiles();
  const file = kind === 'task' ? 'tasks.yml' : 'tests.yml';
  const [sources, setSources] = useState<ProtocolSources>();
  const [loadedConnection, setLoadedConnection] = useState('');
  const [entry, setEntry] = useState(name ?? '');
  const [command, setCommand] = useState('node');
  const [args, setArgs] = useState('');
  const [cwd, setCwd] = useState('.');
  const [timeout, setTimeoutValue] = useState('60');
  const [task, setTask] = useState('');
  const [type, setType] = useState('unit');
  const [pipeline, setPipeline] = useState<Record<string, string>>({});
  const [advanced, setAdvanced] = useState('{}');
  const [problem, setProblem] = useState('');
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!connection) return;
    void readProtocolSources(files.host, connection.id).then(next => {
      if (cancelled) return;
      if (parseProtocol(next).status !== 'Valid') throw Error('Protocol changed or is invalid. Reload and fix it before editing.');
      const raw = name ? definitionMap(next, file)[name] as Record<string, unknown> : {};
      if (name && !raw) throw Error('Definition no longer exists.');
      setSources(next);
      setLoadedConnection(connection.id);
      const rest = { ...raw };
      if (kind === 'task') {
        setCommand(String(raw.command ?? 'node')); setArgs((raw.args as string[] ?? []).join('\n'));
        setCwd(String(raw.cwd ?? '.')); setTimeoutValue(String(raw.timeout ?? 60));
        for (const key of ['command', 'args', 'cwd', 'timeout']) delete rest[key];
      } else {
        setTask(String(raw.task ?? Object.keys(definitionMap(next, 'tasks.yml'))[0] ?? ''));
        setType(String(raw.type ?? 'unit')); setPipeline(raw.pipeline as Record<string, string> ?? {});
        for (const key of ['task', 'type', 'pipeline']) delete rest[key];
      }
      setAdvanced(JSON.stringify(rest, null, 2));
    }).catch(error => { if (!cancelled) setProblem(error instanceof Error ? error.message : 'Cannot read Protocol.'); });
    return () => { cancelled = true; };
  }, [connection, files.host, name, file, kind]);
  function draft(): ProtocolDraft {
    if (!sources) throw Error('Wait for Protocol files to load.');
    const extra = JSON.parse(advanced);
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw Error('Advanced options must be a JSON object.');
    return { sources, file, name: entry, originalName: name, value: kind === 'task'
      ? { ...extra, command, args: args ? args.split('\n') : [], cwd, timeout: Number(timeout) }
      : { ...extra, task, type, ...(Object.values(pipeline).some(Boolean) ? { pipeline: Object.fromEntries(Object.entries(pipeline).filter(([,value]) => value)) } : {}) } };
  }
  function inspect() {
    setProblem('');
    try {
      const result = previewDraft(draft());
      const stages = kind === 'test' ? resolveTestPlan(result.state, projectId, entry, 'preview').steps.map(step => ({ stage: step.stage, name: step.name, executable: step.executable, cwd: step.cwd, timeoutMs: step.timeoutMs })) : result.state.definition.tasks[entry];
      setPreview(JSON.stringify(stages, null, 2));
    } catch (error) { setPreview(''); setProblem(error instanceof Error ? error.message : 'Invalid definition.'); }
  }
  async function save() {
    if (pending || !connection) return;
    setPending(true); setProblem('');
    try {
      const current = connection.id;
      if (loadedConnection !== current) throw Error('Workspace changed. Reopen the form.');
      await saveDraft(files.host, current, draft(), target => {
        if (files.connection?.id !== current || files.connection.permission !== 'granted') throw Error('Workspace connection changed. Reopen the form.');
        if (documents.snapshot().openEditors.some(doc => doc.path === `.tastedev/${target}` && doc.content !== doc.savedContent)) throw Error('Save current editor changes first, or cancel. Your edits are preserved.');
      });
      refresh();
      for (const doc of documents.snapshot().openEditors.filter(doc => doc.path === `.tastedev/${file}`)) await documents.reload(doc.id);
      onSaved(); onClose();
    } catch (error) { setProblem(error instanceof Error ? error.message : 'Save failed. Reload before retrying.'); }
    finally { setPending(false); }
  }
  const tasks = sources ? Object.keys(definitionMap(sources, 'tasks.yml')) : [];
  const field = (label: string, value: string, update: (value: string) => void, inputType = 'text') => <label>{t(label)}<input type={inputType} value={value} disabled={pending} onChange={e => { update(e.target.value); setPreview(''); }} /></label>;
  return <form className="protocol-form" aria-label={t(kind === 'task' ? 'Task editor' : 'Test editor')} onSubmit={e => { e.preventDefault(); void save(); }}>
    <h4>{t(name ? 'Edit definition' : 'New definition')}</h4>
    {field('Name', entry, setEntry)}
    {kind === 'task' ? <>{field('Executable', command, setCommand)}<label>{t('Arguments (one per line)')}<textarea value={args} disabled={pending} onChange={e => { setArgs(e.target.value); setPreview(''); }} /></label>{field('Working directory', cwd, setCwd)}{field('Timeout (seconds)', timeout, setTimeoutValue, 'number')}</> : <>
      <label>{t('Test task')}<select value={task} disabled={pending} onChange={e => { setTask(e.target.value); setPreview(''); }}>{tasks.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{t('Test type')}<select value={type} disabled={pending} onChange={e => { setType(e.target.value); setPreview(''); }}>{['unit','integration','api','browser','e2e'].map(value => <option key={value}>{value}</option>)}</select></label>
      <fieldset><legend>{t('Pipeline')}</legend>{['install','build','start','cleanup'].map(stage => <label key={stage}>{stage}<select value={pipeline[stage] ?? ''} disabled={pending} onChange={e => { setPipeline({ ...pipeline, [stage]: e.target.value }); setPreview(''); }}><option value="">{t('None')}</option>{tasks.map(value => <option key={value}>{value}</option>)}</select></label>)}</fieldset>
    </>}
    <details><summary>{t('Advanced options (JSON)')}</summary><p>{t('Environment, requirements and optional settings are preserved. Values must follow the Protocol schema.')}</p><textarea value={advanced} disabled={pending} onChange={e => { setAdvanced(e.target.value); setPreview(''); }} /></details>
    {problem && <p role="alert" className="protocol-error">{problem}</p>}
    {preview && <details open><summary>{t('Validated execution preview')}</summary><pre>{preview}</pre></details>}
    <p>{t('Saving updates one Protocol file. It does not run commands.')}</p>
    <div className="protocol-form-actions"><button type="button" className="fs-button" disabled={pending || !sources} onClick={inspect}>{t('Validate and preview')}</button><button className="fs-button" disabled={pending || !sources}>{t('Save definition')}</button><button type="button" className="fs-button" disabled={pending} onClick={onClose}>{t('Cancel')}</button></div>
  </form>;
}
