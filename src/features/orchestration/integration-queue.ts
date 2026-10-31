import type {IntegrationRequest} from './integration-requests.ts';
export function overlappingIntegration(a:IntegrationRequest,b:IntegrationRequest){
 return a.parentProjectId===b.parentProjectId&&(a.taskId===b.taskId||a.files.some(x=>b.files.some(y=>{
  const p=x.path.toLowerCase(),q=y.path.toLowerCase();return p===q||p.startsWith(q+'/')||q.startsWith(p+'/');
 })));
}
export function orderedIntegrations(rows:IntegrationRequest[],project:string){return rows.filter(r=>r.parentProjectId===project&&!r.disposition).sort((a,b)=>(a.queueRank??0)-(b.queueRank??0)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
