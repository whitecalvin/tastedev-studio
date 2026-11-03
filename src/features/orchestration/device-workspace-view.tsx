'use client';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import type {Agent} from '../core/domain';
import type {DeviceWorkspaceBinding} from './device-workspace';

export function DeviceWorkspaceFields({value,agentIds,agents,disabled,onChange}:{value:DeviceWorkspaceBinding[]|undefined;agentIds:string[];agents:Agent[];disabled:boolean;onChange:(value:DeviceWorkspaceBinding[]|undefined)=>void}){
 const {t}=useI18n();
 return <fieldset disabled={disabled} className="orch-device-workspaces"><legend>{t('Agent workspaces')}</legend>
  <label><input type="checkbox" checked={value!==undefined} onChange={e=>onChange(e.target.checked?[]:undefined)}/>{t('Require workspace bindings')}</label>
  <p>{t('Agents keep their configured roots. Each task uses its own Run workspace; host paths and credentials are not transferred.')}</p>
  {value!==undefined&&agentIds.map(id=>{
    const agent=agents.find(a=>a.id===id),binding=value.find(b=>b.agentId===id);
    return <label key={id}>{agent?.name??id} · {agent?.platform??t('Not reported')}<CustomSelect value={binding?.source??''} disabled={!agent} onChange={e=>{
      const others=value.filter(b=>b.agentId!==id);onChange(e.target.value&&agent?[...others,{agentId:id,platform:agent.platform,source:e.target.value as DeviceWorkspaceBinding['source']}]:others);
    }}><option value="">{t('Not configured')}</option><option value="snapshot">{t('Saved workspace snapshot')}</option><option value="git">{t('Git Source')}</option></CustomSelect></label>;
  })}
  {value!==undefined&&!value.length&&<p role="status">{t('Choose at least one Agent workspace binding before saving.')}</p>}
 </fieldset>;
}
