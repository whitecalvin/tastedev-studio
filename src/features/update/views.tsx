'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/i18n/react';
import { Dialog } from '@/components/ui/dialog';
import { UpdateService, protections } from './service';

const Context = createContext<UpdateService | null>(null);
export function useUpdateProtection(check: () => boolean) {
  const checkRef = useRef(check);
  useEffect(() => { checkRef.current = check; });
  useEffect(() => { const key = Symbol(); protections.set(key, () => checkRef.current()); return () => { protections.delete(key); }; }, []);
}
export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [service, setService] = useState<UpdateService | null>(null);
  useEffect(() => {
    const desktop = '__TAURI_INTERNALS__' in window;
    const next = new UpdateService(desktop, async (action, enabled, protectedWorkspace) => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('update_action', { action, enabled, protected: protectedWorkspace });
    });
    const timer = setTimeout(() => { setService(next); void next.start(); }, 0);
    const poll = setInterval(() => { if (desktop) void next.action('status'); }, 1000);
    return () => { clearTimeout(timer); clearInterval(poll); };
  }, []);
  return <Context.Provider value={service}>{children}{service && <UpdateDialog service={service} />}</Context.Provider>;
}
export function UpdateButton() {
  const service = useContext(Context); const { t } = useI18n();
  return <button className="button button-quiet" onClick={() => service?.show()} disabled={!service}>{t('Updates')}</button>;
}
function UpdateDialog({ service }: { service: UpdateService }) {
  const { t } = useI18n();
  const state = useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  const status = state.status;
  if (!state.visible) return null;
  const busy = state.pending || ['checking', 'downloading', 'installing'].includes(status?.stage ?? '');
  const stageMessages: Record<string, string> = { idle: 'Check for updates', checking: 'Checking for updates…', current: 'You are up to date.', available: 'A new version is available.', downloading: 'Downloading and verifying…', ready: 'Update verified. Ready to install.', installing: 'Installing update…', cancelled: 'Update cancelled.', error: 'Update failed. Your current installation is unchanged. Try again.' };
  return <Dialog title="Updates" onClose={() => service.dismiss()}><div className="dialog-body">
    {!service.desktop ? <p>{t('Automatic updates are available in the desktop app.')}</p> : <>
      <p>{t('Current version')}: {status?.currentVersion ?? '…'}{status?.version && <> → {status.version}</>}</p>
      <label><input type="checkbox" checked={status?.autoCheck ?? true} disabled={busy || !status} onChange={event => void service.action('preference', event.target.checked)} /> {t('Check for updates when the app starts')}</label>
      <p role="status">{t(stageMessages[status?.stage ?? 'idle'] ?? 'Check for updates')}</p>
      {status?.previousResult && <p role="status">{t(status.previousResult === 'installed' ? 'The previous update was installed.' : 'The previous update could not be installed.')}</p>}
      {(state.error || status?.error) && <p role="alert">{t(state.error || 'Update failed. Your current installation is unchanged. Try again.')}</p>}
      {status?.notes && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{status.notes}</pre>}
      {status?.stage === 'downloading' && <><progress max={status.total || 1} value={status.downloaded} /><p>{Math.round(status.downloaded / Math.max(1, status.total) * 100)}%</p></>}
      {status?.stage === 'available' && !status.canInstall && <p>{t('This installation needs a manual update. Open the release page.')}</p>}
      {status?.page && <p><button className="button button-quiet" onClick={() => void service.action('release')}>{t('Release notes and downloads')}</button></p>}
      <p>{t('Installation restarts the app. Save your files and finish active tasks first.')}</p>
      <div className="dialog-actions">
        <button className="button" disabled={busy || !status} onClick={() => void service.action('check')}>{t('Check for updates')}</button>
        {status?.canInstall && status.stage === 'available' && <button className="button button-primary" disabled={busy} onClick={() => void service.action('download')}>{t('Download update')}</button>}
        {status?.stage === 'ready' && <button className="button button-primary" disabled={busy} onClick={() => void service.action('install')}>{t('Install and restart')}</button>}
        {['checking', 'downloading', 'ready'].includes(status?.stage ?? '') && <button className="button" disabled={state.pending} onClick={() => void service.action('cancel')}>{t('Cancel')}</button>}
        <button className="button" onClick={() => service.dismiss()}>{t('Later')}</button>
      </div>
    </>}
  </div></Dialog>;
}
