'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { Bell, ChevronDown, RefreshCw } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/i18n/react';
import { Announcements, endpoint, type Notice } from './service';
const Context = createContext<Announcements | null>(null);
async function load(language: string) {
  if ('__TAURI_INTERNALS__' in window) { const { invoke } = await import('@tauri-apps/api/core'); return invoke<string>('announcements_get', { locale: language }); }
  const response = await fetch(`${endpoint}?product=tastestudio&locale=${encodeURIComponent(language)}`, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('network');
  const reader = response.body?.getReader(); if (!reader) throw Error('network');
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 512 * 1024) throw Error('too-large'); chunks.push(next.value); } }
  finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export function AnnouncementsProvider({ children }: { children: React.ReactNode }) {
  const { language } = useI18n(); const [service, setService] = useState<Announcements | null>(null);
  useEffect(() => { const timer = setTimeout(() => { let storage: Pick<Storage, 'getItem' | 'setItem'>; try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('storage'); } }; } setService(new Announcements(storage, load)); }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!service) return; void service.refresh(language); const timer = setInterval(() => { void service.refresh(language); }, 300_000); return () => clearInterval(timer); }, [service, language]);
  return <Context.Provider value={service}>{children}{service && <Notices service={service} />}</Context.Provider>;
}
export function AnnouncementsButton() {
  const service = useContext(Context); return service ? <BellButton service={service} /> : null;
}
function BellButton({ service }: { service: Announcements }) {
  const { t, language } = useI18n(); useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot); const unread = service.unread();
  return <button className="button button-quiet studio-notice-bell" aria-label={t('Announcements')} title={t('Announcements')} onClick={() => { service.show(); void service.refresh(language); }}><Bell size={17} /><span>{t('Announcements')}</span>{unread > 0 && <span className="studio-notice-count" aria-label={t('{count} unread announcements', { count: unread })}>{unread}</span>}</button>;
}
export function AnnouncementSettings() {
  const service = useContext(Context); return service ? <Settings service={service} /> : null;
}
function Settings({ service }: { service: Announcements }) {
  const { t, language } = useI18n(); const { preferences } = useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  return <label><input type="checkbox" checked={preferences.enabled} onChange={event => { service.enable(event.target.checked); if (event.target.checked) void service.refresh(language, true); }} /> {t('Receive announcements')}</label>;
}
function Content({ item }: { item: Notice }) {
  const { t } = useI18n();
  const more = async () => { if (!item.url) return; if ('__TAURI_INTERNALS__' in window) { try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('announcements_open', { url: item.url }); } catch {} } else window.open(item.url, '_blank', 'noopener,noreferrer'); };
  return <><p className="studio-notice-body">{item.body}</p>{item.imageUrl && <Image src={item.imageUrl} alt={item.title} unoptimized width={640} height={320} className="studio-notice-image" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}{item.url && <button className="button button-quiet" onClick={() => void more()}>{t('More information')}</button>}</>;
}
function Notices({ service }: { service: Announcements }) {
  const { t, language } = useI18n(); const state = useSyncExternalStore(service.subscribe, service.snapshot, service.snapshot);
  const [selected, select] = useState<string | null>(null);
  const visible = state.preferences.enabled ? service.visible() : []; const featured = visible[0];
  return <>
    {featured && !state.open && <aside className={`studio-notice studio-notice-${featured.style} studio-notice-${featured.level}`} aria-label={t('Announcements')} role={featured.level === 'urgent' ? 'alert' : 'status'}>
      <strong>{featured.title}</strong><Content item={featured} /><div className="studio-notice-actions"><button className="button button-quiet" onClick={() => { service.markRead(featured.id); select(featured.id); service.show(); }}>{t('View announcement')}</button>{featured.level !== 'urgent' && <><button className="button button-quiet" onClick={() => service.dismiss(featured.id)}>{t('Dismiss announcement')}</button><button className="button button-quiet" onClick={() => service.snooze(featured.id)}>{t('Do not show again today')}</button></>}</div>
    </aside>}
    {state.open && <Dialog title="Announcements" onClose={() => service.close()}><div className="dialog-body studio-notice-inbox">
      <div className="studio-notice-toolbar"><AnnouncementSettings /><button className="button button-quiet" disabled={state.loading || !state.preferences.enabled} onClick={() => void service.refresh(language, true)}><RefreshCw size={16} aria-hidden="true" />{t('Refresh')}</button></div>
      {state.loading && <p className="studio-notice-status" role="status">{t('Loading announcements…')}</p>}{state.error && <p className="studio-notice-status studio-notice-error" role="alert">{t(state.error)}</p>}
      {!state.loading && !state.error && !state.items.length && <div className="studio-notice-empty"><Bell size={28} aria-hidden="true" /><p>{t(state.preferences.enabled ? 'No announcements.' : 'Announcements are disabled.')}</p></div>}
      <div className="studio-notice-list" aria-busy={state.loading}>{state.items.map(item => <article key={item.id} className={`studio-notice-item studio-notice-${item.level}`}><button className="studio-notice-title" aria-expanded={selected === item.id} aria-controls={`notice-${item.id}`} onClick={() => { select(selected === item.id ? null : item.id); service.markRead(item.id); }}><strong>{item.title}</strong><span className="studio-notice-title-meta">{!state.preferences.read.includes(item.id) && <span>{t('Unread')}</span>}<ChevronDown size={16} aria-hidden="true" /></span></button>{selected === item.id && <div id={`notice-${item.id}`} className="studio-notice-detail"><Content item={item} /></div>}</article>)}</div>
    </div></Dialog>}
  </>;
}
