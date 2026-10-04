'use client';
import { useI18n } from '@/i18n/react';
import { useEffect, useRef, useState } from 'react';
import { loadMonaco } from '../editor/monaco-editor';
import { detectLanguage } from '../editor/policy';
import type { GitDiff } from './contracts';
export function GitDiffEditor({ diff,labels,sideBySide=true,line=1 }: { diff: GitDiff;labels?:{original:string;modified:string};sideBySide?:boolean;line?:number }) {
  const { t } = useI18n();

  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (diff.binary) return;
    let alive = true, cleanup: (() => void) | undefined;
    loadMonaco().then(monaco => {
      if (!alive || !container.current) return;
      const original = monaco.editor.createModel(diff.original, detectLanguage(diff.path));
      const modified = monaco.editor.createModel(diff.modified, detectLanguage(diff.path));
      const widget = monaco.editor.createDiffEditor(container.current, { automaticLayout: true, readOnly: true, originalEditable: false, originalAriaLabel: labels?.original??'Original saved Git content', modifiedAriaLabel: labels?.modified??'Modified saved Git content', renderSideBySide: sideBySide, useInlineViewWhenSpaceIsLimited: true, minimap: { enabled: false }, fontSize: 13, fontFamily: 'Consolas, monospace', scrollBeyondLastLine: false, accessibilityVerbose: false });
      widget.setModel({ original, modified });if(Number.isInteger(line)&&line>0){widget.getModifiedEditor().revealLineInCenter(Math.min(line,modified.getLineCount()));}
      const theme = () => monaco.editor.setTheme(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs');
      theme(); const observer = new MutationObserver(theme); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      cleanup = () => { observer.disconnect(); widget.setModel(null); widget.dispose(); original.dispose(); modified.dispose(); };
    }).catch(() => { if (alive) setError('Diff editor could not load. Close the diff and try again.'); });
    return () => { alive = false; cleanup?.(); };
  }, [diff.binary, diff.path, diff.original, diff.modified,labels?.original,labels?.modified,sideBySide,line]);
  if (diff.binary) return <div className="git-diff-empty" role="status">{t("Binary diff is not supported.")}</div>;
  return <div className="git-diff-canvas" aria-label={labels?labels.original+' → '+labels.modified:t("Read-only Git diff")} ref={container}>{error && <p role="alert">{error}</p>}</div>;
}
