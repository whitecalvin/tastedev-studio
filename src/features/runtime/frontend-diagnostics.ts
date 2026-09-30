export const DIAGNOSTIC_KEY = 'tastedev.frontend-diagnostics.v1';
export type DiagnosticSource = 'window.error' | 'unhandledrejection' | 'react.boundary' | 'console.error' | 'tauri.invoke' | 'tauri.event';
export interface DiagnosticRecord {
  timestamp: string; level: 'error'; source: DiagnosticSource; message: string; stack: string;
  route: string; runtime: 'web' | 'tauri'; applicationVersion: string; platform: string;
  category: 'PRODUCT' | 'TEST/CONTROLLED';
}
type DiagnosticWindow = Pick<Window, 'addEventListener' | 'removeEventListener' | 'location' | 'navigator' | 'localStorage'> & { console: Console; __TAURI_INTERNALS__?: unknown };

// Do not serialize arbitrary objects, console arguments, IPC arguments or editor data.
// Keep error templates/frames while removing values, URLs, paths and multiline payloads.
export function sanitizeDiagnostic(value: string, limit = 512): string {
  return value.slice(0, 8192).split(/[\r\n]/, 1)[0]
    .replace(/(?:https?|file):\/\/[^\s)]+/gi, '[url]')
    .replace(/(?:[a-z]:[\\/]|\\\\)[^\s)]+/gi, '[path]')
    .replace(/\/(?:[^\s/]+\/)+[^\s)]*/g, '[path]')
    .replace(/\b(?:bearer\s+\S+|(?:password|passwd|secret|token|credential|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+)/gi, '[redacted]')
    .replace(/(["'`]).*?\1/g, '[value]')
    .replace(/[A-Za-z0-9_+/=-]{40,}/g, '[value]')
    .slice(0, limit);
}

export function createDiagnostics(target: DiagnosticWindow, applicationVersion: string, category: DiagnosticRecord['category'] = 'PRODUCT') {
  const records: DiagnosticRecord[] = [];
  let storageAvailable = true;
  const storageKey = category === 'PRODUCT' ? DIAGNOSTIC_KEY : `${DIAGNOSTIC_KEY}.controlled`;
  const report = (source: DiagnosticSource, error: unknown, fallback = 'Error details unavailable'): DiagnosticRecord => {
    let message = fallback, stack = '';
    try {
      if (error instanceof Error) {
        message = error.message;
        stack = (error.stack ?? '').split('\n').filter(line => /^\s*at\s/.test(line)).slice(0, 12)
          .map(line => {
            // Keep source asset basename and line/column, never full paths/query values.
            const location = line.match(/([^/\\\s():?#]+\.(?:js|tsx?|jsx))(?::(\d+))?(?::(\d+))?\)?\s*$/);
            const frame = sanitizeDiagnostic(line.trim());
            return location ? `${frame} [${location[1]}:${location[2] ?? '?'}:${location[3] ?? '?'}]` : frame;
          }).join('\n');
      } else if (typeof error === 'string') message = error;
      // Structured IPC failures use fixed codes; never stringify the payload.
      else if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[a-z-]{1,40}$/.test(error.code)) message = `Native command rejected: ${error.code}`;
    } catch { /* Hostile getters must not break application error recovery. */ }
    const path = target.location.pathname;
    const record: DiagnosticRecord = {
      timestamp: new Date().toISOString(), level: 'error', source,
      message: sanitizeDiagnostic(message), stack: stack.slice(0, 4096),
      route: path === '/' ? '/' : path.startsWith('/projects/') ? '/projects/[id]' : path === '/workspace' ? '/workspace' : '[other]',
      runtime: target.__TAURI_INTERNALS__ ? 'tauri' : 'web', applicationVersion,
      platform: /Win/i.test(target.navigator.platform) ? 'Windows' : /Mac/i.test(target.navigator.platform) ? 'macOS' : /Linux/i.test(target.navigator.platform) ? 'Linux' : 'Other',
      category,
    };
    records.push(record);
    if (records.length > 50) records.shift();
    try { target.localStorage.setItem(storageKey, JSON.stringify(records)); storageAvailable = true; }
    catch { storageAvailable = false; } // Bounded in-memory capture remains available.
    return record;
  };
  const onError = (event: Event) => { const e = event as ErrorEvent; report('window.error', e.error, e.message || 'Resource load failed'); };
  const onRejection = (event: Event) => report('unhandledrejection', (event as PromiseRejectionEvent).reason);
  const original = target.console.error;
  const consoleError: typeof console.error = (...args) => {
    // Only Error objects carry diagnostic details; free-form console data is excluded.
    report('console.error', args.find(value => value instanceof Error), 'Console error (arguments omitted)');
    original.apply(target.console, args);
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  target.console.error = consoleError;
  return { report, snapshot: () => records.map(record => ({ ...record })), storageAvailable: () => storageAvailable,
    dispose() { target.removeEventListener('error', onError); target.removeEventListener('unhandledrejection', onRejection); if (target.console.error === consoleError) target.console.error = original; },
  };
}
let diagnostics: ReturnType<typeof createDiagnostics> | undefined;
export function initializeDiagnostics(version: string, category: DiagnosticRecord['category'] = 'PRODUCT') {
  if (!diagnostics && typeof window !== 'undefined') diagnostics = createDiagnostics(window, version, category);
  return diagnostics;
}
export function reportFrontendError(source: DiagnosticSource, error: unknown) { return diagnostics?.report(source, error); }
export function frontendDiagnosticSnapshot() { return diagnostics?.snapshot() ?? []; }
