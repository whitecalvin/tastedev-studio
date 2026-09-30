'use client';
import { useI18n } from '@/i18n/react';
import { useEffect, useRef, useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import { OUTPUT_LIMIT, type TerminalStore } from './terminal-store';
export function TerminalCanvas({ store, input, resize, focusToken = 0, interactive = false }: { store: TerminalStore; input?: (data: string) => void; resize?: (cols: number, rows: number) => void; focusToken?: number; interactive?: boolean }) {
  const { t } = useI18n();

  const container = useRef<HTMLDivElement>(null), instance = useRef<Terminal | null>(null);
  const callbacks = useRef({ input, resize });
  const [error, setError] = useState('');
  useEffect(() => { callbacks.current = { input, resize }; }, [input, resize]);
  useEffect(() => { instance.current?.focus(); }, [focusToken]);
  useEffect(() => {
    let disposed = false, cleanup = () => {};
    void Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || !container.current) return;
      const term = new Terminal({ convertEol: true, scrollback: 2000, fontSize: 12, fontFamily: 'Consolas, monospace', cursorBlink: false, disableStdin: !interactive, screenReaderMode: true });
      const fit = new FitAddon(); term.loadAddon(fit); term.open(container.current); instance.current = term;
      let cursor = 0, revision = -1, pending = '', writing = false, scheduled = 0, resetPending = false;
      const flush = () => { if (disposed || writing || (!pending && !resetPending)) return; writing = true; const chunk = (resetPending ? '\x1bc' : '') + pending; pending = ''; resetPending = false; term.write(chunk, () => { writing = false; flush(); }); };
      const render = () => {
        const value = store.snapshot();
        // Queue reset after any in-flight write, so old output cannot reappear after Clear.
        if (revision !== value.revision) { revision = value.revision; pending = ''; resetPending = true; cursor = 0; }
        for (const chunk of value.chunks) if (chunk.sequence > cursor) { pending = (pending + (chunk.stream === 'stderr' ? `\x1b[31m${chunk.data}\x1b[0m` : chunk.data)).slice(-OUTPUT_LIMIT); cursor = chunk.sequence; }
        flush();
      };
      const theme = () => {
        const dark = document.documentElement.dataset.theme === 'dark';
        term.options.theme = { background: dark ? '#1e1e1e' : '#ffffff', foreground: dark ? '#d4d4d4' : '#252a34', cursor: dark ? '#d4d4d4' : '#252a34', selectionBackground: dark ? '#334a70' : '#c9ddff', red: dark ? '#f48771' : '#b42318', green: dark ? '#89d185' : '#28702c' };
      };
      const layout = () => { cancelAnimationFrame(scheduled); scheduled = requestAnimationFrame(() => { if (disposed || !container.current || container.current.clientWidth < 20 || container.current.clientHeight < 20) return; try { fit.fit(); } catch { setError('Terminal layout failed. Reopen the workspace to retry.'); } }); };
      theme(); render(); layout();
      const unsubscribe = store.subscribe(render), data = term.onData(value => callbacks.current.input?.(value)), dimensions = term.onResize(value => callbacks.current.resize?.(value.cols, value.rows));
      const observer = new ResizeObserver(layout); observer.observe(container.current);
      const themes = new MutationObserver(theme); themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      cleanup = () => { unsubscribe(); observer.disconnect(); themes.disconnect(); cancelAnimationFrame(scheduled); data.dispose(); dimensions.dispose(); term.dispose(); instance.current = null; };
    }).catch(() => { if (!disposed) setError('Terminal could not load. Reload the workspace to retry.'); });
    return () => { disposed = true; cleanup(); };
  }, [store, interactive]);
  return <div className="run-terminal-canvas" ref={container} aria-label={t("Terminal screen")}>{error && <p role="alert">{error}</p>}</div>;
}
