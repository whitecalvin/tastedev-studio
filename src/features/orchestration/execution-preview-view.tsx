'use client';
import {useI18n} from '@/i18n/react';
import type {Agent} from '../core/domain';
import type {ProjectGraph} from './domain';
import type {GraphOverview} from './execution';
import {executionPreview} from './execution-preview';

export function ExecutionPlanPreview({graph,definition,entry,timeoutMinutes,agents}:{graph:ProjectGraph;definition:GraphOverview['definition'];entry:string;timeoutMinutes:number;agents:Agent[]}){
 const {t}=useI18n(),plan=executionPreview(graph,definition,entry),label=(id:string)=>graph.nodes.find(n=>n.id===id)?.label??id;
 return <details className="orch-execution-preview"><summary>{t('Review execution scope')}</summary>
  {plan.blocked?<p>{t('Review the saved graph version before continuing.')}</p>:<>
   <p>{t('Core revision')}: {definition!.revision} · {t('Protocol input checksum')}: <code>{definition!.inputChecksum}</code></p>
   <p>{t('Execution Source')}: {definition!.source?<><code>{definition!.source.snapshotId}</code><br/><code>{definition!.source.checksum}</code></>:t('Protocol Source / Agent workspace')}</p>
   <p>{t('Tasks at the same dependency level may run in parallel; Agent capacity and policies still apply.')}</p>
   <ol>{plan.levels.map((level,index)=><li key={index}><strong>{t('Dependency level')} {index+1}</strong><ul>{level.map(row=><li key={row.nodeId}>
    <strong>{label(row.nodeId)}</strong> · {t(row.kind==='approval'?'Review execution scope':row.kind==='ai'?'AI':row.kind==='framework'?'Native framework':row.kind==='native-build'?'Native build stage':'Protocol')}
    {!!row.agentIds.length&&<span> · {row.agentIds.map(id=>agents.find(a=>a.id===id)?.name??id).join(', ')}</span>}
    {definition!.aiTasks?.[row.nodeId]&&<small> · {definition!.aiTasks[row.nodeId].route.connectionId} · {definition!.aiTasks[row.nodeId].route.model}</small>}
    {definition!.requirements?.[row.nodeId]&&<small> · {definition!.requirements[row.nodeId].platform??t('Any')} · {Object.entries(definition!.requirements[row.nodeId].runtimes??{}).map(([name,version])=>`${name} ${version}`).join(', ')}</small>}
   </li>)}</ul></li>)}</ol>
   <p>{t('Each approval node still requires its own approval.')}</p>
   {!!plan.failurePaths.length&&<div><strong>{t('Conditional failure paths')}</strong><ul>{plan.failurePaths.map((edge,i)=><li key={i}>{label(edge.from)} → {label(edge.to)}</li>)}</ul></div>}
   <p>{t('Maximum node attempts')}: {graph.retryLimit} · {t('Deadline')}: {timeoutMinutes} min</p>
  </>}
 </details>;
}
