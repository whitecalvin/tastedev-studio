import type {IntegrationPhase, IntegrationRequest} from './integration-requests.ts';

export type InboxFilter = 'active'|'attention'|'completed'|'all';
const closed = new Set<IntegrationPhase>(['completed','cancelled','rejected']);
export interface IntegrationOverlap {requestId:string;paths:string[];differentBase:boolean;differentResult:boolean}
/** Advisory only: the existing patch precondition remains the write boundary. */
export function integrationOverlaps(rows:IntegrationRequest[],project:string) {
  const active=rows.filter(r=>r.parentProjectId===project&&!closed.has(r.phase));
  const result=new Map<string,IntegrationOverlap[]>();
  for(const row of active){
    const files=new Map(row.files.map(f=>[f.path.replaceAll('\\','/').toLowerCase(),f]));
    const overlaps:IntegrationOverlap[]=[];
    for(const peer of active){
      if(peer.id===row.id)continue;
      const shared=peer.files.filter(f=>files.has(f.path.replaceAll('\\','/').toLowerCase()));
      if(!shared.length)continue;
      overlaps.push({requestId:peer.id,paths:shared.map(f=>files.get(f.path.replaceAll('\\','/').toLowerCase())!.path),differentBase:peer.baseRevision!==row.baseRevision,
        differentResult:shared.some(f=>files.get(f.path.replaceAll('\\','/').toLowerCase())!.checksum!==f.checksum)});
    }
    result.set(row.id,overlaps);
  }
  return result;
}
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
