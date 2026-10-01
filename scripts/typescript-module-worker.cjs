// Monaco's supported custom worker factory preserves .mts/.cts ScriptKind.
globalThis.customTSWorkerFactory = (BaseWorker, ts) => class extends BaseWorker {
  getScriptKind(file) {
    if (/\.(?:mts|cts)$/i.test(file)) return ts.ScriptKind.TS;
    if (/\.(?:mjs|cjs)$/i.test(file)) return ts.ScriptKind.JS;
    return super.getScriptKind(file);
  }
};
