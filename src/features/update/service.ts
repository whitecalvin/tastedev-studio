export interface UpdateStatus {
  stage: string; currentVersion: string; version: string | null; notes: string; page: string | null;
  canInstall: boolean; autoCheck: boolean; downloaded: number; total: number;
  error: string | null; previousResult: string | null;
}
export type UpdateAction = 'status' | 'check' | 'download' | 'install' | 'cancel' | 'preference' | 'release';
export type UpdateInvoke = (action: UpdateAction, enabled?: boolean, protectedWorkspace?: boolean) => Promise<UpdateStatus>;
export const protections = new Map<symbol, () => boolean>();
export function updateFailure(error:unknown){
  const code=typeof error==='string'?error:error instanceof Error?error.message:'';
  if(/update_action.*(?:not allowed|denied)|(?:not allowed|denied).*update_action|command.*not found/i.test(code))return 'The update service is unavailable. Reinstall the latest desktop package.';
  if(code==='workspace-busy')return 'Save your files and finish active tasks before installing.';
  if(code==='network')return 'Could not reach the update server. Check your connection and try again.';
  return 'Update failed. Your current installation is unchanged. Try again.';
}
export function workspaceProtected() { return [...protections.values()].some(check => check()); }
export class UpdateService {
  private listeners = new Set<() => void>();
  private lock = false;
  private started = false;
  private state = { status: null as UpdateStatus | null, visible: false, pending: false, error: '' };
  readonly desktop: boolean;
  private invoke: UpdateInvoke;
  private protectedWorkspace: () => boolean;
  constructor(desktop: boolean, invoke: UpdateInvoke, protectedWorkspace = workspaceProtected) { this.desktop = desktop; this.invoke = invoke; this.protectedWorkspace = protectedWorkspace; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private change(patch: Partial<typeof this.state>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  show() { this.change({ visible: true }); if(this.desktop&&!this.state.status)void this.action('status'); }
  dismiss() { this.change({ visible: false }); }
  async start() {
    if (this.started || !this.desktop) return;
    this.started = true;
    await this.action('status');
    if (this.state.status?.autoCheck) await this.action('check');
  }
  async action(action: UpdateAction, enabled?: boolean) {
    if (!this.desktop || this.lock) return;
    if (action === 'install' && this.protectedWorkspace()) { this.change({ error: 'Save your files and finish active tasks before installing.' }); return; }
    this.lock = true;
    this.change({ pending: action !== 'status'||!this.state.status, error: action === 'status' ? this.state.error : '' });
    try {
      const status = await this.invoke(action, enabled, action === 'install' ? this.protectedWorkspace() : true);
      const newlyAvailable = status.stage === 'available' && (this.state.status?.stage !== 'available' || this.state.status?.version !== status.version);
      const previousResult = !!status.previousResult && !this.state.status;
      this.change({ status, ...(!this.state.status?{error:''}:{}), visible: this.state.visible || newlyAvailable || previousResult });
    } catch (error) {
      this.change({ error:updateFailure(error) });
    } finally { this.lock = false; this.change({ pending: false }); }
  }
}
