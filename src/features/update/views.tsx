'use client';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useI18n } from '@/i18n/react';
import { Dialog } from '@/components/ui/dialog';
import { UpdateService, protections, updateFailure } from './service';
import {version as buildVersion} from '../../../package.json';
import {Download,RefreshCw,ShieldCheck,AlertCircle} from 'lucide-react';
import './update.css';

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
  return <Dialog title="Updates" onClose={() => service.dismiss()}><div className="dialog-body update-dialog">
    {!service.desktop ? <p>{t('Automatic updates are available in the desktop app.')}</p> : <>
      <div className="update-version"><div><span>{t('Current version')}</span><strong>{status?.currentVersion ?? buildVersion}</strong></div>{status?.version&&<div><span>{t('A new version is available.')}</span><strong>{status.version}</strong></div>}<ShieldCheck size={24} aria-hidden="true"/></div>
      <label className="update-preference"><input type="checkbox" checked={status?.autoCheck ?? true} disabled={busy || !status} onChange={event => void service.action('preference', event.target.checked)} /> {t('Check for updates when the app starts')}</label>
      {!state.error&&!status?.error&&<div className="update-status" role="status"><RefreshCw size={18} aria-hidden="true"/><p>{t(stageMessages[status?.stage ?? 'idle'] ?? 'Check for updates')}</p></div>}
      {status?.previousResult && <p role="status">{t(status.previousResult === 'installed' ? 'The previous update was installed.' : 'The previous update could not be installed.')}</p>}
      {(state.error || status?.error) && <div className="update-status update-error" role="alert"><AlertCircle size={18} aria-hidden="true"/><p>{t(state.error || updateFailure(status?.error))}</p></div>}
      {status?.notes && <details className="update-notes"><summary>{t('Release notes and downloads')}</summary><pre>{status.notes}</pre></details>}
      {status?.stage === 'downloading' && <><progress max={status.total || 1} value={status.downloaded} /><p>{Math.round(status.downloaded / Math.max(1, status.total) * 100)}%</p></>}
      {status?.stage === 'available' && !status.canInstall && <p>{t('This installation needs a manual update. Open the release page.')}</p>}
      {status?.page && <p><button className="button button-quiet" onClick={() => void service.action('release')}>{t('Release notes and downloads')}</button></p>}
      <p className="update-safety">{t('Installation restarts the app. Save your files and finish active tasks first.')}</p>
      <div className="dialog-actions update-actions">
        <button className="button" disabled={busy} onClick={() => void service.action('check')}><RefreshCw size={16} aria-hidden="true"/>{t('Check for updates')}</button>
        {status?.canInstall && status.stage === 'available' && <button className="button button-primary" disabled={busy} onClick={() => void service.action('download')}><Download size={16} aria-hidden="true"/>{t('Download update')}</button>}
        {status?.stage === 'ready' && <button className="button button-primary" disabled={busy} onClick={() => void service.action('install')}>{t('Install and restart')}</button>}
        {['checking', 'downloading', 'ready'].includes(status?.stage ?? '') && <button className="button" disabled={state.pending} onClick={() => void service.action('cancel')}>{t('Cancel')}</button>}
        <button className="button" onClick={() => service.dismiss()}>{t('Later')}</button>
      </div>
    </>}
  </div></Dialog>;
}
