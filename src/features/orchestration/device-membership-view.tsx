'use client';
import {CustomSelect} from '@/components/ui/custom-select';
import {useI18n} from '@/i18n/react';
import type {Agent} from '../core/domain';
import type {GraphNode,ProjectGraph} from './domain';
import {declaredAgentDevice,deviceAgentNodes} from './device-membership';

export function AgentDeviceSelector({graph,node,disabled,onChange}:{graph:ProjectGraph;node:GraphNode;disabled:boolean;onChange:(id:string)=>void}){
 const {t}=useI18n();
 return <><label>{t('Device membership')}<CustomSelect value={declaredAgentDevice(graph,node.id)} disabled={disabled} onChange={event=>onChange(event.target.value)}><option value="">{t('No declared device')}</option>{graph.nodes.filter(candidate=>candidate.kind==='device').map(device=><option key={device.id} value={device.id}>{device.label}</option>)}</CustomSelect></label><p>{t('Changing device membership changes which device roles can use this Agent. No remote configuration is changed.')}</p></>;
}
export function DeviceAgentList({graph,node,agents,connected,disabled,onChoose}:{graph:ProjectGraph;node:GraphNode;agents:Agent[];connected:boolean;disabled:boolean;onChoose:(id:string)=>void}){
 const {t}=useI18n(),nodes=deviceAgentNodes(graph,node.id);
 return <section aria-label={t('Agents on this device')}><h3>{t('Agents on this device')}</h3>{nodes.length?nodes.map(candidate=>{
  const registered=connected?agents.find(agent=>agent.id===candidate.reference):undefined;
  const status=t(registered?.status??(connected&&candidate.reference?'Reference unavailable':'Not connected'));
  return <div key={candidate.id}><button type="button" className="fs-button orch-device-agent" title={`${candidate.label} · ${status}`} disabled={disabled} onClick={()=>onChoose(candidate.id)}><span className="orch-device-agent-name">{candidate.label}</span><span>{status}</span></button>{registered&&<small className="orch-device-agent-platform">{registered.platform} / {registered.architecture}</small>}</div>;
 }):<p>{t('No Agent nodes linked to this device. Choose the device in Agent node settings.')}</p>}<p>{t('This is declared membership. A live Agent report does not prove physical device identity.')}</p></section>;
}
