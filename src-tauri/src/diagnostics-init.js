// Runs before application scripts. Log arguments may contain source or secrets;
// only fixed event codes cross IPC.
;(() => {
  const original = { error: console.error, warn: console.warn };
  const report = (event) => {
    void window.__TAURI_INTERNALS__.invoke('runtime_diagnostic', { event }).catch(() => {
      original.error.call(console, 'Studio diagnostic delivery failed.');
    });
  };
  for (const level of ['error', 'warn']) {
    console[level] = function (...args) {
      report(`console-${level}`);
      return original[level].apply(this, args);
    };
  }
  window.addEventListener('error', (event) => report(
    event.message === 'ResizeObserver loop completed with undelivered notifications.' || event.message === 'ResizeObserver loop limit exceeded'
      ? 'resize-observer-error' : 'error'
  ));
  window.addEventListener('unhandledrejection', () => report('unhandled-rejection'));
  report('ready');
})();
