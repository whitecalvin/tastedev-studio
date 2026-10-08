'use client';
import {Monitor,Bot} from 'lucide-react';
import {useI18n} from '@/i18n/react';
import type {Agent} from '../core/domain';
import type {ProjectGraph} from './domain';
import {deviceOperations} from './operations-board';
import {useProtocol} from '../protocol/views';

export function DeviceOperationsBoard({graph,agents,connected,disabled,onChoose}:{graph:ProjectGraph;agents:Agent[];connected:boolean;disabled:boolean;onChoose:(id:string)=>void}) {
 const protocol=useProtocol(),definition=protocol.state.status==='Valid'?protocol.state.definition:null;
 const {t,locale}=useI18n(),board=deviceOperations(graph,agents,connected);
 return <details className="orch-operations"><summary><Monitor size={16} aria-hidden="true"/>{t('Devices')} · {t('Roles')}<span>{board.devices.length}</span></summary>
  <p>{t('This is declared membership. A live Agent report does not prove physical device identity.')}</p>
  <div className="orch-operations-grid">{board.devices.map(row=><section key={row.device.id}><h3><button className="ws-text-button" disabled={disabled} onClick={()=>onChoose(row.device.id)}><Monitor size={14}/>{row.device.label}</button></h3>
   <dl><div><dt>{t('Roles')}</dt><dd>{row.roles.length?row.roles.map(role=><button key={role.id} className="ws-text-button" disabled={disabled} onClick={()=>onChoose(role.id)}>{role.label} · {t(role.role)}</button>):t('Not configured')}</dd></div><div><dt>{t('Tasks')}</dt><dd>{row.tasks.length}</dd></div></dl>
   <ul className="orch-operations-tasks">{row.tasks.map(task=>{const reference=task.taskType==='test'?definition?.tests[task.reference]?.task:task.reference;const cwd=reference?definition?.tasks[reference]?.cwd:undefined;return <li key={task.id}><button className="ws-text-button" disabled={disabled} onClick={()=>onChoose(task.id)}>{task.label}</button><code>cwd: {cwd??t('Not reported')}</code></li>;})}</ul>
   {!row.agents.length&&<p>{t('No Agent nodes linked to this device. Choose the device in Agent node settings.')}</p>}
   {row.agents.map(({node,report})=><div className="orch-operations-agent" key={node.id}><button className="ws-text-button" disabled={disabled} onClick={()=>onChoose(node.id)}><Bot size={14}/>{node.label}</button><span data-state={report?.status??'offline'}>{t(report?.status??'Not connected')}</span>{report&&<><small>{report.platform} / {report.architecture} · {Object.entries(report.capabilities.runtimes).map(([name,version])=>`${name} ${version}`).join(' · ')||t('None declared')}</small><small>{t('Last seen')}: {report.lastSeenAt?new Date(report.lastSeenAt).toLocaleString(locale):t('Not reported')}</small></>}</div>)}
  </section>)}</div>
  {board.unassigned.length>0&&<div><h3>{t('No declared device')}</h3>{board.unassigned.map(({node})=><button key={node.id} className="fs-button" disabled={disabled} onClick={()=>onChoose(node.id)}>{node.label}</button>)}</div>}
 </details>;
}
