'use client';
import { useI18n, I18nText } from '@/i18n/react';
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { Play, Square, Plus, Pencil, Trash2, Eraser, Focus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useRun } from './context';
import { desktopRequired } from './contracts';
import type { RunConfiguration } from './configurations';
const TerminalCanvas = dynamic(() => import('./terminal-canvas').then(v => v.TerminalCanvas), { ssr: false, loading: () => <p role="status">{<I18nText text="Loading terminal…" />}</p> });
function running(status?: string) { return status === 'starting' || status === 'running' || status === 'stopping'; }
export function RunStatus() {
  const { t } = useI18n();
 const { capabilities, state } = useRun(); return <span>{!capabilities.process ? t("Process: Desktop runtime required") : state.session ? `Run: ${state.session.name} — ${t(state.session.status)}${state.session.exitCode !== null ? ` (${state.session.exitCode})` : ''}` : t("Run: Ready")}</span>; }
export function RunView() {
  const { t } = useI18n();

  const run = useRun(); const [editing, setEditing] = useState<RunConfiguration | 'new' | null>(null), [deleting, setDeleting] = useState(false);
  const selected = run.list.find(c => c.id === run.selectedId), active = running(run.state.session?.status), locked = active || run.preparing;
  return <div className="run-view"><div className="run-heading"><h3>{t("Run Configurations")}</h3><button aria-label={t("Add run configuration")} disabled={!run.ready || locked} onClick={() => setEditing('new')}><Plus size={16} /></button></div>
    {run.error && <p className="run-error" role="alert">{run.error}</p>}
    {!run.ready ? <p role="status">{t("Loading configurations…")}</p> : !run.list.length ? <p>{t("No configurations yet. Add an executable and its arguments to prepare a run.")}</p> : <label className="run-selection">{t("Configuration")}<select value={run.selectedId} disabled={locked} onChange={e => run.select(e.target.value)}>{run.list.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
    {selected && <><dl className="run-summary"><dt>{t("Executable")}</dt><dd title={selected.command}>{selected.command}</dd><dt>{t("Working directory")}</dt><dd>{selected.cwd || t("Workspace root")}</dd><dt>{t("Destination")}</dt><dd>{selected.type === 'terminal' ? t("Terminal / PTY") : t("Task output")}</dd></dl><div className="run-actions"><button disabled={locked} onClick={() => setEditing(selected)}><Pencil size={13} />{t("Edit")}</button><button disabled={locked} onClick={() => setDeleting(true)}><Trash2 size={13} />{t("Delete")}</button></div></>}
    <div className="run-actions"><button disabled={!selected || locked} onClick={() => void run.run()}><Play size={14} />{run.preparing ? t("Preparing…") : t("Run")}</button><button disabled={!active || run.state.session?.status === 'stopping'} onClick={() => void run.service.stop()}><Square size={13} />{t("Stop")}</button></div>
    <p role="status" className="run-state">{!run.capabilities.process ? t("Unsupported runtime") : run.state.session?.status ?? t("Ready")}</p><p>{run.state.message || (!run.capabilities.process ? desktopRequired : t("Select a configuration to begin."))}</p>
    <dl className="run-capabilities"><dt>{t("Filesystem")}</dt><dd>{run.capabilities.filesystem ? t("Available with permission") : t("Unavailable")}</dd><dt>{t("Process")}</dt><dd>{run.capabilities.process ? t("Available") : t("Unavailable")}</dd><dt>{t("PTY")}</dt><dd>{run.capabilities.pty ? t("Available") : t("Unavailable")}</dd><dt>Git</dt><dd>{run.capabilities.git ? t("Available") : t("Unavailable")}</dd></dl>
    {editing && <ConfigurationForm initial={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
    {deleting && selected && <Dialog title={t("Delete run configuration?")} onClose={() => setDeleting(false)}><p>{t("Remove “")}{selected.name}{t("” from this project? Files and processes are not changed.")}</p><div className="fs-dialog-actions"><button className="fs-button fs-danger" onClick={() => { try { run.remove(selected.id); setDeleting(false); } catch { run.setError('The configuration could not be removed. Check browser storage.'); setDeleting(false); } }}>{t("Delete configuration")}</button><button className="fs-button" onClick={() => setDeleting(false)}>{t("Cancel")}</button></div></Dialog>}
  </div>;
}
function ConfigurationForm({ initial, close }: { initial?: RunConfiguration; close: () => void }) {
  const { t } = useI18n();

  const run = useRun();
  const [name, setName] = useState(initial?.name ?? ''), [command, setCommand] = useState(initial?.command ?? ''), [args, setArgs] = useState(JSON.stringify(initial?.args ?? [], null, 2)), [cwd, setCwd] = useState(initial?.cwd || '.'), [env, setEnv] = useState(JSON.stringify(initial?.env ?? {}, null, 2)), [type, setType] = useState(initial?.type ?? 'terminal'), [error, setError] = useState('');
  const submit = (event: React.FormEvent) => { event.preventDefault(); let parsedArgs: unknown, parsedEnv: unknown; try { parsedArgs = JSON.parse(args); parsedEnv = JSON.parse(env); } catch { setError('Arguments must be a JSON array; environment must be a JSON object.'); return; } try { run.save({ name, command, args: parsedArgs, cwd, env: parsedEnv, type }, initial?.id); close(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this configuration.'); } };
  return <Dialog title={initial ? t("Edit run configuration") : t("Add run configuration")} onClose={close}><form className="run-form" onSubmit={submit}>
    <label>{t("Name")}<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={t("Development Server")} /></label>
    <label>{t("Executable")}<input required maxLength={1024} value={command} onChange={e => setCommand(e.target.value)} placeholder={t("pnpm")} /></label>
    <label>{t("Arguments (JSON array)")}<textarea rows={2} value={args} onChange={e => setArgs(e.target.value)} placeholder={t("[\"dev\"]")} /></label><small>{t("Each array item is one argument. No shell command is assembled.")}</small>
    <label>{t("Working directory")}<input value={cwd} onChange={e => setCwd(e.target.value)} placeholder="." /></label><small>{t("Relative to the connected workspace. “.” uses its root.")}</small>
    <label>{t("Environment (JSON object)")}<textarea rows={2} value={env} onChange={e => setEnv(e.target.value)} spellCheck={false} /></label><small>{t("Stored locally with the configuration. This is not a secret vault.")}</small>
    <label>{t("Output destination")}<select value={type} onChange={e => setType(e.target.value as 'terminal' | 'task')}><option value="terminal">{t("Terminal / PTY")}</option><option value="task">{t("Task output")}</option></select></label>
    {error && <p role="alert" className="run-error">{t(error || "")}</p>}<div className="fs-dialog-actions"><button className="fs-button" type="submit">{t("Save configuration")}</button><button className="fs-button" type="button" onClick={close}>{t("Cancel")}</button></div>
  </form></Dialog>;
}
export function TerminalView() {
  const { t } = useI18n();

  const { service, state, capabilities, openTerminal } = useRun(); const terminal = useSyncExternalStore(service.terminal.subscribe, service.terminal.snapshot, service.terminal.snapshot); const [focus, setFocus] = useState(0);
  return <div className="run-terminal"><div className="run-terminal-tools"><span title={terminal.session.name}>{terminal.session.name}</span><span className="run-terminal-status">{!capabilities.pty ? t("Desktop runtime required") : t(terminal.session.status)}</span>{capabilities.pty && <><button aria-label={t("Open shell")} disabled={running(state.session?.status)} onClick={() => void openTerminal()}><Plus size={14} /></button><button aria-label={t("Close terminal")} onClick={() => void service.closeTerminal()}><Trash2 size={14} /></button></>}<button aria-label={t("Clear terminal")} onClick={() => service.terminal.clear()}><Eraser size={14} /></button><button aria-label={t("Focus terminal")} onClick={() => setFocus(v => v + 1)}><Focus size={14} /></button><button aria-label={t("Stop terminal process")} disabled={!running(state.session?.status) || state.session?.status === 'stopping'} onClick={() => void service.stop()}><Square size={13} /></button></div><TerminalCanvas store={service.terminal} interactive={capabilities.pty} input={data => { void service.input(data); }} resize={(cols, rows) => { void service.resize(cols, rows); }} focusToken={focus} />{terminal.truncated && <small className="run-truncated">{t("Older output discarded at the retention limit.")}</small>}</div>;
}
export function OutputView() {
  const { t } = useI18n();

  const { service } = useRun(); const output = useSyncExternalStore(service.output.subscribe, service.output.snapshot, service.output.snapshot);
  return <div className="run-output"><div className="run-terminal-tools"><span>{t("Studio & task output")}</span><button aria-label={t("Clear output")} onClick={() => service.output.clear()}><Eraser size={14} /></button></div>{!output.chunks.length ? <p>{t("No task output. Studio run messages and non-interactive task output appear here.")}</p> : <pre aria-label={t("Task output")}>{output.chunks.map(c => <span key={c.sequence} className={c.stream === 'stderr' ? 'run-error' : ''}>{`[${c.stream}] ${c.data}`}</span>)}</pre>}{output.truncated && <small>{t("Older output discarded at the retention limit.")}</small>}</div>;
}

