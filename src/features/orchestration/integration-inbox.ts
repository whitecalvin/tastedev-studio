import type {IntegrationPhase, IntegrationRequest} from './integration-requests.ts';

export type InboxFilter = 'active'|'attention'|'completed'|'all';
const closed = new Set<IntegrationPhase>(['completed','cancelled','rejected']);
export function integrationNext(phase:IntegrationPhase) {
  if(phase==='waiting')return 'Waiting for integration';
  if (phase==='submitted'||phase==='reviewed') return 'Review changes';
  if (phase==='verified') return 'Review and accept';
  if (phase==='applied') return 'Validate and Remote Retest';
  if (phase==='conflict'||phase==='failed'||phase==='reverted') return 'Resolve and compare again';
  if (phase==='access-required') return 'Access Required';
  return phase==='retesting'?'Retesting':'History';
}
export function integrationInbox(rows:IntegrationRequest[],project:string,filter:InboxFilter,query='') {
  const needle=query.trim().toLocaleLowerCase();
  return rows.filter(r=>r.parentProjectId===project
    && (filter==='all'||filter==='completed'&&closed.has(r.phase)||filter==='active'&&!closed.has(r.phase)
      ||filter==='attention'&&['submitted','reviewed','verified','conflict','failed','access-required'].includes(r.phase))
    && (!needle||[r.id,r.taskId,r.nodeId,r.childProjectId,r.childRunId,...r.files.map(f=>f.path)].join(' ').toLocaleLowerCase().includes(needle)))
    .sort((a,b)=>Number(closed.has(a.phase))-Number(closed.has(b.phase))||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
}
