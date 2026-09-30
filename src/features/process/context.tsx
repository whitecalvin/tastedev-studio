'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFiles } from '../editor/session';
import { useGit } from '../git/context';
import { useWorkspace } from '../workspace/context';
import { BrowserConfigurationRepository, RunConfigurationService, validateConfiguration, type RunConfiguration } from './configurations';
import { desktopRequired } from './contracts';
import { runtimeHosts } from '../runtime/hosts';
import { prepareRun, RunService, type DirtyChoice } from './run-service';

function useRunSession(projectId: string) {
  const [service] = useState(() => new RunService(runtimeHosts().process));
  const [configurations] = useState(() => new RunConfigurationService(new BrowserConfigurationRepository(() => window.localStorage)));
  const state = useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  const [list, setList] = useState<RunConfiguration[]>([]), [selectedId, select] = useState('');
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [preparing, setPreparing] = useState(false);
  const lock = useRef(false), mounted = useRef(true);
  const { service: gitService } = useGit();
  const files = useFiles(), { dispatch } = useWorkspace();
  const reload = () => { const next = configurations.list(projectId); setList(next); select(id => next.some(c => c.id === id) ? id : next[0]?.id ?? ''); setError(''); };
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { try { const next = configurations.list(projectId); setList(next); select(next[0]?.id ?? ''); } catch { setError('Run configurations could not be loaded. Stored data is unchanged; check browser storage.'); } setReady(true); }, 0);
    if (!service.host.capabilities.process && !service.terminal.snapshot().chunks.length) service.terminal.append('system', `\x1b[1mTASTEDEV Studio Terminal\x1b[0m\r\n${desktopRequired}\r\n`);
    return () => { mounted.current = false; clearTimeout(timer); queueMicrotask(() => { if (!mounted.current) void service.dispose().catch(() => { /* Production Web host never starts a process; native cleanup reporting belongs to STEP6. */ }); }); };
  }, [projectId, service, configurations]);
  const run = async () => {
    if (lock.current || files.busy || files.pending) return;
    const config = list.find(c => c.id === selectedId); if (!config) { setError('Select a run configuration first.'); return; }
    lock.current = true; setPreparing(true); setError('');
    try {
      validateConfiguration(config);
      const proceed = await prepareRun({ dirty: () => files.documents.snapshot().dirtyEditors.length > 0, saveAll: async () => { if (!(await files.run('Saving files before Run…', files.saveAll))) throw new Error('Files could not be saved. Run was cancelled; review the file error.'); } }, async () => {
        const choice = await files.ask({ title: 'Unsaved files before Run', message: 'Choose whether this run should use your saved files or save all edits first. Unsaved edits will not be discarded.', choices: [{ value: 'save', label: 'Save All and Run' }, { value: 'without', label: 'Run Without Saving' }, { value: 'cancel', label: 'Cancel' }] });
        return (choice === 'save' || choice === 'without' ? choice : 'cancel') as DirtyChoice;
      });
      if (!proceed || !mounted.current) return;
      dispatch({ type: 'tab', value: config.type === 'terminal' ? 'Terminal' : 'Output' });
      await service.start(config, projectId, files.connection?.id ?? null, async path => { await files.files.list(path, true); });
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Run failed. Review the configuration.'); }
    finally { lock.current = false; if (mounted.current) setPreparing(false); }
  };
  const openTerminal = async () => { if (!files.connection || lock.current) return; dispatch({ type: 'tab', value: 'Terminal' }); await service.start({ id: 'interactive-shell', name: 'Shell', command: '@default-shell', args: [], cwd: '', env: {}, type: 'terminal' }, projectId, files.connection.id); };
  return { openTerminal, service, state, list, selectedId, select, error, setError, ready, preparing, run, reload, save: (input: unknown, id?: string) => { const result = configurations.save(projectId, input, id); reload(); select(result.id); }, remove: (id: string) => { configurations.delete(projectId, id); reload(); }, capabilities: { filesystem: files.ready && files.files.host.supported(), process: service.host.capabilities.process, pty: service.host.capabilities.pty, git: gitService.host.capabilities.git } };
}
const Context = createContext<ReturnType<typeof useRunSession> | null>(null);
export function RunProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) { const value = useRunSession(projectId); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useRun() { const value = useContext(Context); if (!value) throw new Error('Run provider required'); return value; }


