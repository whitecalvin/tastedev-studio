'use client';
import {Users} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {ProjectGraph} from './domain';
import type {AIConfigurationStore} from './ai-config';
import {teamRoleLabels} from './team-template';

export function TeamSetup({graph,configurations,disabled,onAdd,onChoose}:{graph:ProjectGraph;configurations:AIConfigurationStore;disabled:boolean;onAdd:()=>void;onChoose:(id:string)=>void}){
  const {t}=useI18n();
  const roles=graph.nodes.filter(n=>n.kind==='role'&&n.teamRole);
  return <details className="orch-team"><summary><Users size={16} aria-hidden="true"/>{t('Project team')}<span>{roles.length}/5</span></summary>
    <p>{t('Devices run Agents. Responsibilities define work. AI profiles define models and tools.')}</p>
    {!roles.length?<button className="fs-button" disabled={disabled} onClick={onAdd}>{t('Add role-based team draft')}</button>:<ul className="orch-team-roles">{roles.map(role=>{
      const tasks=graph.edges.filter(e=>e.from===role.id&&e.relation==='performs').map(e=>graph.nodes.find(n=>n.id===e.to)).filter(n=>!!n);
      const assigned=graph.edges.filter(e=>e.to===role.id&&e.relation==='assigns').map(e=>graph.nodes.find(n=>n.id===e.from)?.label).filter(Boolean);
      return <li key={role.id}><button className="ws-text-button" onClick={()=>onChoose(role.id)}>{t(teamRoleLabels[role.teamRole!])}</button><span>{assigned.map(a=>t(a!)).join(', ')||t('Not assigned')}</span>{tasks.map(task=>{const profile=configurations.profiles.find(p=>p.id===configurations.bindings[task.id]);return <button className="ws-text-button" key={task.id} onClick={()=>onChoose(task.id)}>{profile?`${t(profile.name)} · ${profile.provider} · ${profile.model||t('Core connection')}`:t('AI configuration missing')}</button>;})}</li>;
    })}</ul>}
  </details>;
}
