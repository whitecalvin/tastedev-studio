"use client";
import {useState} from 'react';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import {defaultNativeRecipe,validateNativeRecipe,type NativeBuildRecipe} from './domain';
import {configureNativeGroup} from './plan';
import type {ProjectGraph} from '../orchestration/domain';
export function NativeBuildSettings({graph,groupId,disabled,onChange}:{graph:ProjectGraph;groupId:string;disabled:boolean;onChange:(g:ProjectGraph)=>void}){
 const {t}=useI18n(),parent=graph.nodes.find(n=>n.id===groupId)!,initial=parent.nativeRecipe??defaultNativeRecipe();
 const [draft,setDraft]=useState(initial),[files,setFiles]=useState(JSON.stringify({binaries:initial.binaries,payloads:initial.payloads},null,2)),[error,setError]=useState('');
 function save(){try{const v=JSON.parse(files);if(Object.keys(v).some(k=>!['binaries','payloads'].includes(k)))throw Error('Only declared binary and payload mappings are supported.');onChange(configureNativeGroup(graph,groupId,validateNativeRecipe({...draft,...v})));setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}}
 return <fieldset disabled={disabled} className="orch-native-build"><legend>{t('Native build configuration')}</legend><p>{t('Saving configures eight native stages. Execution starts only after plan review.')}</p>
 <label>{t('Product ID')}<input value={draft.productId} maxLength={80} onChange={e=>setDraft({...draft,productId:e.target.value})}/></label>
 <label>{t('Product name')}<input value={draft.name} maxLength={120} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label>{t('Version')}<input value={draft.packageVersion} maxLength={30} onChange={e=>setDraft({...draft,packageVersion:e.target.value})}/></label>
 <label>{t('Application identifier')}<input value={draft.identifier} maxLength={120} onChange={e=>setDraft({...draft,identifier:e.target.value})}/></label>
 <label>{t('Platform')}<CustomSelect value={draft.platform} onChange={e=>{const platform=e.target.value as NativeBuildRecipe['platform'];setDraft({...draft,platform,formats:platform==='windows'?['zip']:['tar.gz']});}}>{['windows','linux','macos'].map(v=><option key={v}>{v}</option>)}</CustomSelect></label>
 <label>{t('Build system')}<CustomSelect value={draft.system} onChange={e=>setDraft({...draft,system:e.target.value as NativeBuildRecipe['system']})}>{['cargo','node','mixed'].map(v=><option key={v}>{v}</option>)}</CustomSelect></label>
 <label>{t('Rust toolchain')}<input value={draft.toolchain} maxLength={30} onChange={e=>setDraft({...draft,toolchain:e.target.value})}/></label>
 <label>{t('Cargo packages')}<input value={draft.packages.join(',')} maxLength={1000} onChange={e=>setDraft({...draft,packages:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label>
 <label>{t('Cargo features')}<input value={draft.features.join(',')} maxLength={1000} onChange={e=>setDraft({...draft,features:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label>
 <label className="checkbox-label"><input type="checkbox" checked={draft.allFeatures} onChange={e=>setDraft({...draft,allFeatures:e.target.checked})}/>{t('All Cargo features')}</label>
 <label>{t('Node build task')}<CustomSelect value={draft.buildScript} onChange={e=>setDraft({...draft,buildScript:e.target.value as NativeBuildRecipe['buildScript']})}><option>build</option><option>build:desktop</option></CustomSelect></label>
 <label>{t('Package formats')}<input value={draft.formats.join(',')} maxLength={100} onChange={e=>setDraft({...draft,formats:e.target.value.split(',').map(s=>s.trim()).filter(Boolean) as NativeBuildRecipe['formats']})}/></label>
 <label>{t('Signing policy')}<CustomSelect value={draft.signing} onChange={e=>setDraft({...draft,signing:e.target.value as NativeBuildRecipe['signing']})}><option value="required">{t('Required')}</option><option value="none">{t('Not required')}</option></CustomSelect></label>
 <label>{t('Binary and resource mappings')}<textarea rows={10} spellCheck={false} maxLength={10000} value={files} onChange={e=>setFiles(e.target.value)}/></label>
 <p>{t('Source roots, approved tools and signing identities stay in the Agent-local build catalog. One build Agent is required for all stages.')}</p>
 {error&&<p role="alert">{t(error)}</p>}<button type="button" className="fs-button" onClick={save}>{t('Save native build configuration')}</button></fieldset>;
}
