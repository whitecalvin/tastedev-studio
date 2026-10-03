'use client';
import {useI18n} from '@/i18n/react';
import {useCore} from './context';
import {useWorkspace} from '../workspace/context';

export function AgentOverview(){
  const {t,locale}=useI18n(),{snapshot,select,connection}=useCore(),{dispatch}=useWorkspace();
  const connected=connection.connected;
  const running=connected?snapshot.runs.filter(run=>run.status==='running'||run.status==='pending'):[];
  return <section className="core-agent-overview"><div className="core-overview-heading"><div><h1>{t('Agents')}</h1><p>{t(connected?'Status and last seen are reported by Core. Capability probes describe the connected agent.':'Remote agent transport is not connected. Registration does not establish a connection.')}</p></div><span>{t('Last seen')}: {connection.snapshotReceivedAt?new Date(connection.snapshotReceivedAt).toLocaleTimeString(locale):t('Not reported')}</span></div>
  <div className="core-overview-metrics"><div><span>{t('Agents')}</span><strong>{connected?snapshot.agents.filter(a=>['idle','busy','online'].includes(a.status)).length:'—'}</strong></div><div><span>{t('idle')}</span><strong>{connected?snapshot.agents.filter(a=>a.status==='idle').length:'—'}</strong></div><div><span>{t('busy')}</span><strong>{connected?snapshot.agents.filter(a=>a.status==='busy').length:'—'}</strong></div><div><span>{t('Job queue')}</span><strong>{connected?snapshot.jobs.filter(job=>job.status==='queued').length:'—'}</strong></div><div><span>{t('Run')}</span><strong>{connected?running.length:'—'}</strong></div></div>
  <div className="core-table-scroll"><table><thead><tr><th>{t('Agent')}</th><th>{t('Status')}</th><th>{t('OS / Architecture')}</th><th>{t('Runtimes')}</th><th>{t('Last seen')}</th></tr></thead><tbody>{snapshot.agents.map(agent=><tr key={agent.id}><td><button className="ws-text-button" onClick={()=>select({kind:'agent',id:agent.id})}>{agent.name}</button></td><td><span className="core-agent-state" data-state={connected?agent.status:'offline'}>{t(connected?agent.status:'offline')}</span></td><td>{agent.platform} / {agent.architecture}</td><td>{Object.entries(agent.capabilities.runtimes).map(([name,version])=>`${name} ${version}`).join(' · ')||t('None declared')}</td><td>{agent.lastSeenAt?new Date(agent.lastSeenAt).toLocaleString(locale):t('Not reported')}</td></tr>)}</tbody></table></div>
  {!snapshot.agents.length&&<p className="core-overview-empty">{t('No agents registered.')}</p>}
  <div className="core-overview-heading"><h2>{t('Run')}</h2><button className="ws-text-button" onClick={()=>dispatch({type:'activity',value:'runs'})}>{t('Run history')}</button></div>
  {!running.length?<p className="core-overview-empty">{t(connected?'No active runs.':'Not connected')}</p>:<ul className="core-active-runs">{running.map(run=><li key={run.id}><button className="ws-text-button" onClick={()=>{select({kind:'run',id:run.id});dispatch({type:'activity',value:'runs'});}}>{snapshot.jobs.find(job=>job.id===run.jobId)?.name??run.id}</button><span>{t(run.status)} · {snapshot.agents.find(agent=>agent.id===run.agentId)?.name??run.agentId}</span></li>)}</ul>}
  </section>;
}
