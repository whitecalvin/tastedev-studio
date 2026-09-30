'use client';
import { useState } from 'react';
import { ThemeControl } from '@/components/ui/theme';
import { DiffView, SourceControlPanel, type GitActions } from '@/features/git/views';
import { initialGitState } from '@/features/git/service';
import type { GitDiff } from '@/features/git/contracts';
// Static component snapshots only: no GitHost, filesystem, repository or mutation simulator.
const text: GitDiff = { path: 'src/example.ts', side: 'working', original: 'export const greeting = "Hello";\nexport const count = 1;\n', modified: 'export const greeting = "Hello Studio";\nexport const count = 2;\n', binary: false };
export function GitFixture() {
  const [diff, setDiff] = useState<GitDiff | null>(text);
  const [notice, setNotice] = useState('');
  const actions: GitActions = { refresh: async () => { setNotice('Rendering fixture only; no repository is read.'); return false; }, selectDiff: async (path, side) => { setDiff({ ...text, path, side, binary: path.endsWith('.png') }); return true; }, changeIndex: async () => { setNotice('Rendering fixture only; no index is changed.'); return false; }, commit: async () => { setNotice('Rendering fixture only; no commit is created.'); return false; } };
  return <main style={{height:'100dvh',display:'flex',flexDirection:'column'}}><header style={{padding:'12px 20px'}}><h1 style={{fontSize:18}}>Git rendering verification</h1><p>Development-only static fixture. No real repository, Git host or command is used.</p><ThemeControl /><button className="fs-button" onClick={()=>setDiff(text)}>Text diff fixture</button> <button className="fs-button" onClick={()=>setDiff({...text,path:'image.png',binary:true})}>Binary diff fixture</button></header><div style={{display:'flex',flex:1,minHeight:0}}><aside style={{width:260,overflow:'auto',flexShrink:0}}><SourceControlPanel dirty available actions={actions} state={{...initialGitState(),phase:'ready',fresh:true,notice,repository:{id:'fixture',root:'Illustrative fixture',currentBranch:'fixture/preview',detached:false,hasRemote:false},files:[{path:'src/example.ts',index:'modified',workingTree:'modified'},{path:'new.ts',index:null,workingTree:'untracked'},{path:'removed.ts',index:'deleted',workingTree:null},{path:'renamed.ts',originalPath:'old.ts',index:null,workingTree:'renamed'},{path:'conflict.ts',index:'conflicted',workingTree:'conflicted'},{path:'image.png',index:null,workingTree:'modified'}],history:[{hash:'fixture',shortHash:'fixture',message:'Illustrative history entry',author:'Fixture author',date:'2026-09-29'}]}} /></aside>{diff ? <DiffView diff={diff} close={()=>setDiff(null)} dirty /> : <p>Diff closed. Choose a fixture to reopen.</p>}</div></main>;
}
