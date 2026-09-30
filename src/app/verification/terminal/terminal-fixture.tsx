'use client';
import { useState } from 'react';
import { TerminalCanvas } from '@/features/process/terminal-canvas';
import { TerminalStore } from '@/features/process/terminal-store';
import { ThemeControl } from '@/components/ui/theme';
export function TerminalFixture() {
  const [store] = useState(() => new TerminalStore('Rendering fixture')); const [size,setSize]=useState(''),[input,setInput]=useState(''),[focus,setFocus]=useState(0);
  return <main style={{padding:24}}><h1>Terminal rendering verification</h1><p>Development-only fixture. No process is executed.</p><ThemeControl /><button onClick={()=>{store.append('stdout','\x1b[32mANSI GREEN\x1b[0m\r\nfirst line\r\nsecond line\r\n');store.append('stderr','STDERR fixture\r\n');}}>Write ANSI fixture</button><button onClick={()=>{for(let i=0;i<2500;i++)store.append('stdout',`fixture line ${i}\r\n`);}}>Write long output</button><button onClick={()=>store.clear()}>Clear fixture</button><button onClick={()=>setFocus(v=>v+1)}>Focus fixture</button><p>Dimensions: {size} · Last input: {JSON.stringify(input)}</p><div style={{height:320,width:'100%',resize:'both',overflow:'hidden',display:'flex'}}><TerminalCanvas store={store} interactive input={setInput} resize={(cols,rows)=>setSize(`${cols} × ${rows}`)} focusToken={focus}/></div></main>;
}
