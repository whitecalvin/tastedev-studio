"use client";
import { useI18n } from '@/i18n/react';
import { useUpdateProtection } from '../update/views';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { browserFileHost } from '../filesystem/browser';
import { WorkspaceFileService, fileMessage } from '../filesystem/file-service';
import type { FolderConnection } from '../filesystem/contracts';
import { Documents } from './documents';
import { projectService } from '../projects/services/browser-services';

interface Question { title: string; message: string; initial?: string; choices: { value: string; label: string; danger?: boolean }[] }
interface Pending extends Question { resolve: (value: string | null) => void }
function useFileSession(projectId: string) {
  const [files] = useState(() => new WorkspaceFileService(browserFileHost));
  const [documents] = useState(() => new Documents(files));
  const editor = useSyncExternalStore(documents.subscribe, documents.snapshot, documents.snapshot);
  const [connection, setConnection] = useState<FolderConnection | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  useUpdateProtection(() => documents.snapshot().dirtyEditors.length > 0 || lock.current);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const ask = (question: Question) => new Promise<string | null>(resolve => setPending({ ...question, resolve }));
  const answer = (value: string | null) => { pending?.resolve(value); setPending(null); };
  const run = async (label: string, operation: () => Promise<void>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(label); setError(''); setNotice('');
    try { await operation(); return true; }
    catch (error) { setError(fileMessage(error)); return false; }
    finally { try { setConnection(await files.checkPermission()); } catch { setConnection(null); } lock.current = false; setBusy(''); }
  };
  useEffect(() => {
    let active = true;
    files.restore(projectId).then(value => { if (active) setConnection(value); }, error => { if (active) setError(fileMessage(error)); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [files, projectId]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (documents.snapshot().dirtyEditors.length || lock.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [documents]);
  const saveAll = async () => { const failures = await documents.saveAll(); if (failures.length) throw new Error(failures.join('\n')); };
  const protect = async (action: () => Promise<void> | void) => {
    if (lock.current) return;
    if (documents.snapshot().dirtyEditors.length) {
      const choice = await ask({ title: 'Unsaved changes', message: 'Save all edited files before leaving this workspace or changing its folder connection?', choices: [{ value: 'save', label: 'Save all' }, { value: 'discard', label: "Don't Save", danger: true }, { value: 'cancel', label: 'Cancel' }] });
      if (!choice || choice === 'cancel') return;
      if (choice === 'save' && !(await run('Saving files…', saveAll))) return;
      if (choice === 'save' && documents.snapshot().dirtyEditors.length) { setError('Some files changed while saving. Review the remaining unsaved changes before leaving.'); return; }
    }
    await action();
  };
  const connect = () => protect(async () => { await run('Connecting folder…', async () => { const result = await files.connect(projectId); if (result.workspacePath) await projectService.attachWorkspace(projectId, result.workspacePath); documents.clear(); setConnection(result); setRevision(n => n + 1); }); });
  const disconnect = () => protect(async () => { await run('Disconnecting…', async () => { await files.disconnect(projectId); documents.clear(); setConnection(null); setRevision(n => n + 1); }); });
  const close = async (id: string) => {
    if (lock.current) return;
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    if (documents.snapshot().dirtyEditors.includes(id)) {
      const result = await ask({ title: 'Save changes?', message: `“${documents.get(id).name}” has unsaved changes.`, choices: [{ value: 'save', label: 'Save' }, { value: 'discard', label: "Don't Save", danger: true }, { value: 'cancel', label: 'Cancel' }] });
      if (result !== 'save' && result !== 'discard') return;
      choice = result;
    }
    await run('Closing editor…', async () => { await documents.close(id, choice); });
  };
  const save = () => run('Saving file…', async () => { const id = documents.snapshot().activeEditorId; if (id) { await documents.save(id); setNotice('File saved to the connected folder.'); } });
  return { files, documents, editor, connection, ready, busy, error, notice, setError, setNotice, revision, refresh: () => setRevision(n => n + 1), pending, ask, answer, run, protect, connect, disconnect, close, save, saveAll, requestAccess: () => run('Requesting access…', async () => { setConnection(await files.requestAccess()); setRevision(n => n + 1); }) };
}
type Session = ReturnType<typeof useFileSession>;
const Context = createContext<Session | null>(null);
export function useFiles() { const session = useContext(Context); if (!session) throw new Error('File session required'); return session; }
export const editorShortcuts = { save: { key: 's', ctrl: true }, close: { key: 'w', ctrl: true } };
export function FileSessionProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const session = useFileSession(projectId);
  const router = useRouter();
  // Event closures follow current documents and dialogs. No global document content persistence.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || session.pending) return;
      if (event.key.toLowerCase() === editorShortcuts.save.key) { event.preventDefault(); void session.save(); }
      if (event.key.toLowerCase() === editorShortcuts.close.key && session.editor.activeEditorId) { event.preventDefault(); void session.close(session.editor.activeEditorId); }
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link = event.target.closest('a'); if (!link || !link.href || link.target === '_blank') return;
      const url = new URL(link.href); if (url.origin !== location.origin || url.pathname === location.pathname) return;
      if (session.editor.dirtyEditors.length || session.busy) { event.preventDefault(); event.stopPropagation(); void session.protect(() => router.push(url.pathname + url.search + url.hash)); }
    };
    const currentUrl = location.href, currentHistoryState = history.state;
    const historyNavigation = (event: PopStateEvent) => {
      if (location.pathname === new URL(currentUrl).pathname || (!session.editor.dirtyEditors.length && !session.busy)) return;
      const target = location.href;
      event.stopImmediatePropagation();
      // Restore the current editor before Next processes an in-app Back/Forward.
      // A confirmed navigation is then routed normally; no edits enter history state.
      history.pushState(currentHistoryState, '', currentUrl);
      if (!session.pending) void session.protect(() => router.push(target));
    };
    window.addEventListener('keydown', key, true); document.addEventListener('click', navigate, true); window.addEventListener('popstate', historyNavigation, true);
    return () => { window.removeEventListener('keydown', key, true); document.removeEventListener('click', navigate, true); window.removeEventListener('popstate', historyNavigation, true); };
  }, [session, router]);
  return <Context.Provider value={session}>{children}{session.pending && <QuestionDialog question={session.pending} answer={session.answer} />}</Context.Provider>;
}
function QuestionDialog({ question, answer }: { question: Question; answer: (value: string | null) => void }) {
  const { t, feedback } = useI18n();

  const [value, setValue] = useState(question.initial ?? '');
  return <Dialog title={question.title} onClose={() => answer(null)}><form onSubmit={event => { event.preventDefault(); answer(value); }}><p className="fs-dialog-message">{feedback(question.message)}</p>{question.initial !== undefined && <label className="fs-name-label">{t("Name")}<input autoFocus required maxLength={255} value={value} onChange={event => setValue(event.target.value)} /></label>}<div className="fs-dialog-actions">{question.choices.map(choice => <button className={`fs-button ${choice.danger ? 'fs-danger' : ''}`} type={question.initial !== undefined && choice.value === 'submit' ? 'submit' : 'button'} key={choice.value} onClick={choice.value === 'submit' ? undefined : () => answer(question.initial !== undefined && choice.value === 'cancel' ? null : choice.value)}>{t(choice.label)}</button>)}</div></form></Dialog>;
}
export function ConnectionStatus() {
  const { t } = useI18n();
 const { connection, ready, files } = useFiles(); return <>{!ready ? t("Checking access…") : !files.host.supported() ? t("Unsupported") : connection?.permission === 'granted' ? t("Connected") : connection?.permission === 'denied' ? t("Permission Denied") : t("Access Required")}</>; }
export function FileFeedback() {
  const { t, feedback } = useI18n();
 const { error, notice, busy, setError, setNotice } = useFiles(); return <>{(error || notice || busy) && <div className={`fs-feedback ${error ? 'fs-error' : ''}`} role={error ? 'alert' : 'status'}><span>{feedback(busy || error || notice || "")}</span>{!busy && <button aria-label={t("Dismiss file notification")} onClick={() => { setError(''); setNotice(''); }}>×</button>}</div>}</>; }


