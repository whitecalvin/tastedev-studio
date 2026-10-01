import { parseAnnouncementsText, rememberDismissed, normalizeSeen, levelRank, type Announcement } from './shared/announcements.ts';
export const storageKey = 'tastedev.studio.announcements.v1';
export const endpoint = 'https://tastedev.net/api/announcements';
export type Notice = Announcement & { style: 'banner' | 'toast' | 'popup' | 'bottom'; imageUrl: string | null };
type Preferences = { enabled: boolean; read: string[]; dismissed: string[]; snoozed: Record<string, string> };
export function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function parseNotices(text: string, now = Date.now()): Notice[] {
  const items = parseAnnouncementsText(text); let raw: Record<string, unknown>[] = [];
  try { const value = JSON.parse(text); if (Array.isArray(value.announcements)) raw = value.announcements.filter((v: unknown) => typeof v === 'object' && v !== null); } catch {}
  return items.filter(item => (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.endsAt || Date.parse(item.endsAt) > now))
    .map(item => {
      const extra = raw.find(v => typeof v.id === 'string' && v.id.trim() === item.id);
      let image: string | null = null;
      try { if (typeof extra?.imageUrl === 'string') image = safeLink(new URL(extra.imageUrl, endpoint).href); } catch {}
      const imageUrl = image && new URL(image).origin === 'https://tastedev.net' && new URL(image).pathname.startsWith('/api/announcements/') ? image : null;
      const style = ['banner', 'toast', 'popup', 'bottom'].includes(String(extra?.style)) ? extra!.style as Notice['style'] : 'banner';
      return { ...item, title: item.title.slice(0, 500), body: item.body.slice(0, 20_000), url: safeLink(item.url), imageUrl, style };
    }).sort((a, b) => levelRank(a.level) - levelRank(b.level));
}
export type NoticeLoader = (language: string) => Promise<string>;
export class Announcements {
  private listeners = new Set<() => void>();
  private epoch = 0;
  private lastLanguage = '';
  private loadedAt = 0;
  private store: Pick<Storage, 'getItem' | 'setItem'>;
  private load: NoticeLoader;
  private state: { items: Notice[]; preferences: Preferences; loading: boolean; error: string; open: boolean };
  constructor(store: Pick<Storage, 'getItem' | 'setItem'>, load: NoticeLoader) {
    this.store = store; this.load = load;
    let saved: Partial<Preferences> = {};
    try { saved = JSON.parse(store.getItem(storageKey) ?? '{}') ?? {}; } catch {}
    const snoozed: Record<string, string> = {};
    if (typeof saved.snoozed === 'object' && saved.snoozed) for (const [key, value] of Object.entries(saved.snoozed).slice(-50)) if (/^\d{4}-\d{2}-\d{2}$/.test(value)) snoozed[key] = value;
    this.state = { items: [], preferences: { enabled: saved.enabled !== false, read: normalizeSeen(Array.isArray(saved.read) ? saved.read : []), dismissed: normalizeSeen(Array.isArray(saved.dismissed) ? saved.dismissed : []), snoozed }, loading: false, error: '', open: false };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private change(patch: Partial<typeof this.state>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private save(preferences: Preferences) { this.change({ preferences }); try { this.store.setItem(storageKey, JSON.stringify(preferences)); } catch { this.change({ error: 'Announcement preferences could not be saved.' }); } }
  show() { this.change({ open: true }); }
  close() { this.change({ open: false }); }
  enable(value: boolean) { this.epoch++; this.save({ ...this.state.preferences, enabled: value }); this.change({ loading: false, items: value ? this.state.items : [] }); this.loadedAt = 0; }
  markRead(id: string) { if (this.state.items.some(n => n.id === id)) this.save({ ...this.state.preferences, read: rememberDismissed(this.state.preferences.read, id) }); }
  dismiss(id: string) { const item = this.state.items.find(n => n.id === id); if (item && item.level !== 'urgent') this.save({ ...this.state.preferences, dismissed: rememberDismissed(this.state.preferences.dismissed, id) }); }
  snooze(id: string, today = new Date().toLocaleDateString('en-CA')) { const item = this.state.items.find(n => n.id === id); if (item && item.level !== 'urgent') { const entries = Object.entries({ ...this.state.preferences.snoozed, [id]: today }).slice(-50); this.save({ ...this.state.preferences, snoozed: Object.fromEntries(entries) }); } }
  unread() { return this.state.items.filter(n => !this.state.preferences.read.includes(n.id)).length; }
  visible(today = new Date().toLocaleDateString('en-CA')) { return this.state.items.filter(n => n.level === 'urgent' || (!this.state.preferences.dismissed.includes(n.id) && this.state.preferences.snoozed[n.id] !== today)); }
  async refresh(language: string, force = false, now = Date.now()) {
    if (!this.state.preferences.enabled) return;
    if (!force && this.lastLanguage === language && now - this.loadedAt < 300_000) return;
    const epoch = ++this.epoch; this.lastLanguage = language; this.change({ loading: true, error: '' });
    try { const text = await this.load(language); if (epoch === this.epoch) { this.loadedAt = now; this.change({ items: parseNotices(text, now), error: '' }); } }
    catch { if (epoch === this.epoch) this.change({ items: [], error: 'Announcements could not be loaded. Try again.' }); }
    finally { if (epoch === this.epoch) this.change({ loading: false }); }
  }
}
