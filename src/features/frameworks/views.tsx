 'use client';
import {FrameworkSettings} from './settings-view';
import {FrameworkRunPanel} from './run-view';
import {FrameworkSessionBoard} from './session-view';
import {useState} from 'react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {useCore} from '../core/context';
import {useFiles} from '../editor/session';
import {projectService} from '../projects/services/browser-services';
import {catalog,templateBinding,findInstruction} from './catalog';
import {engines,support,type ExecutionMode,type GameEngine} from './domain';
import {placeFrameworkSelection} from './graph';
import {resolveFrameworkConfig} from './config';
import type {ProjectGraph} from '../orchestration/domain';
export function FrameworkCatalogPanel({graph,disabled,onApply}:{graph:ProjectGraph;disabled:boolean;onApply:(graph:ProjectGraph)=>void}){
 const core=useCore(),files=useFiles(),{t}=useI18n(),[engine,setEngine]=useState<GameEngine>(core.project.templateBinding?.engine??'godot'),[mode,setMode]=useState<ExecutionMode>('claude-code'),[selected,setSelected]=useState<string[]>([]),[current,setCurrent]=useState('role:godot-specialist'),[agent,setAgent]=useState(''),[args,setArgs]=useState(''),[filter,setFilter]=useState(''),[message,setMessage]=useState(''),[config,setConfig]=useState<ReturnType<typeof resolveFrameworkConfig>|null>(null),[busy,setBusy]=useState(false);
 const nativeReady=engine==='godot'&&core.snapshot.agents.some(a=>a.id===graph.nodes.find(n=>n.id===agent)?.reference&&a.capabilities.frameworkRuntime===1);
 const entry=catalog.entries.find(e=>e.id===current),items=catalog.entries.filter(e=>['role','skill'].includes(e.kind)&&(!filter||e.id.toLowerCase().includes(filter.toLowerCase())));
 async function readConfig(){setBusy(true);try{const read=async(path:string)=>{try{return(await files.files.read(path)).content;}catch{return undefined;}};const [project,local,legacyReview,legacyStage,technicalPreferences]=await Promise.all(['project.yaml','project.local.yaml','production/review-mode.txt','production/stage.txt','.claude/docs/technical-preferences.md'].map(read));setConfig(resolveFrameworkConfig({project,local,legacyReview:legacyReview?.trim(),legacyStage:legacyStage?.trim(),technicalPreferences}));}finally{setBusy(false);}}
 async function bind(){setBusy(true);setMessage('');try{await projectService.bindTemplate(core.project.id,templateBinding(engine));setMessage(t('Framework definitions linked. Source files are unchanged.'));}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 function place(){try{onApply(placeFrameworkSelection(graph,{roleIds:selected.filter(id=>id.startsWith('role:')),skillIds:selected.filter(id=>id.startsWith('skill:')),agentNodeId:agent,mode,arguments:args}));setSelected([]);setMessage('');}catch(e){setMessage(e instanceof Error?e.message:String(e));}}
 return <details className="orch-product-flow"><summary>Claude-Code-Game-Studios · {catalog.entries.filter(e=>e.kind==='role').length} {t('AI roles')} · {catalog.entries.filter(e=>e.kind==='skill').length} {t('Skills')}</summary>
 <p><code>{catalog.commit}</code> · MIT · {t('Pinned definitions; support is qualified per skill')}</p>
 <div className="orch-factory-fields"><label>{t('Game engine')}<CustomSelect value={engine} disabled={disabled||busy} onChange={e=>setEngine(e.target.value as GameEngine)}>{engines.map(e=><option key={e}>{e}</option>)}</CustomSelect></label><label>{t('Execution mode')}<CustomSelect value={mode} onChange={e=>setMode(e.target.value as ExecutionMode)}><option value="claude-code">Claude Code</option><option value="studio">Studio AI</option></CustomSelect></label><label>{t('Execution Agent')}<CustomSelect value={agent} onChange={e=>setAgent(e.target.value)}><option value="">{t('Select')}</option>{graph.nodes.filter(n=>n.kind==='agent').map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</CustomSelect></label></div>
 <button className="fs-button" disabled={disabled||busy} onClick={()=>void bind()}>{t('Link framework template')}</button> <button className="fs-button" disabled={busy||!files.connection} onClick={()=>void readConfig()}>{t('Read effective configuration')}</button>
 {config&&<details><summary>{t('Effective configuration')}</summary><table><thead><tr><th>{t('Setting')}</th><th>{t('Value')}</th><th>{t('Source')}</th></tr></thead><tbody>{Object.entries(config.values).map(([key,v])=><tr key={key}><td>{key}</td><td>{JSON.stringify(v.value)}</td><td>{v.source}</td></tr>)}</tbody></table>{config.notes.map(n=><p key={n}>{n}</p>)}</details>}
 <label>{t('Search')}<input value={filter} maxLength={120} onChange={e=>setFilter(e.target.value)}/></label>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12}}><div style={{maxHeight:320,overflow:'auto'}}>{items.map(e=><div key={e.id} style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" aria-label={e.id} checked={selected.includes(e.id)} onChange={event=>setSelected(event.target.checked?[...selected,e.id]:selected.filter(id=>id!==e.id))}/><button className="fs-button" aria-pressed={current===e.id} onClick={()=>setCurrent(e.id)}>{e.id}</button></div>)}</div><div>{entry&&<><strong>{entry.id}</strong><p>{t(support(entry,mode,nativeReady).state)} · {t(support(entry,mode,nativeReady).reason)}</p><dl>{Object.entries(entry.frontmatter).map(([k,v])=><div key={k}><dt>{k}</dt><dd style={{overflowWrap:'anywhere'}}>{JSON.stringify(v)}</dd></div>)}</dl><details><summary>{t('Full original prompt')}</summary><pre style={{whiteSpace:'pre-wrap',maxHeight:400,overflow:'auto'}}>{findInstruction({commit:catalog.commit,path:entry.path,sha256:entry.sha256}).raw}</pre></details><code>{entry.path}</code></>}</div></div>
 <label>{t('Skill arguments')}<textarea value={args} maxLength={4000} rows={2} onChange={e=>setArgs(e.target.value)}/></label><button className="fs-button" disabled={disabled||!agent||!selected.some(id=>id.startsWith('role:'))} onClick={place}>{t('Place selected team')}</button>
 <FrameworkSettings/><FrameworkRunPanel/><FrameworkSessionBoard/><p>{t('Original minimal flow')}: /start → /setup-engine → /brainstorm → /create-stories → /dev-story → /story-done</p>{message&&<p role="status">{message}</p>}</details>;
}
