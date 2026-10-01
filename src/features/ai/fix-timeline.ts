import type {AnalysisRecord} from './domain.ts';
import type {FixAttempt} from './fix-service.ts';
import type {CoreSnapshot} from '../core/domain.ts';
export interface TimelineEntry {id:string;label:string;status:string;timestamp:string}
const labels={proposal:'Fix proposal',approval:'Approval',patch:'Patch',validation:'Validation',retest:'Retest',recovery:'Recovery',result:'Result'};
/** Only observed records/events are displayed. Missing legacy events are not fabricated. */
export function fixTimeline(attempt:FixAttempt,analysis:AnalysisRecord|undefined,snapshot:CoreSnapshot){
 const entries:TimelineEntry[]=[];const run=snapshot.runs.find(r=>r.projectId===attempt.projectId&&r.id===(attempt.originRunId??attempt.runId));
 if(run?.finishedAt&&['failed','timeout','cancelled'].includes(run.status))entries.push({id:run.id,label:'Original failure',status:run.status,timestamp:run.finishedAt});
 if(analysis?.id===attempt.analysisId&&analysis.projectId===attempt.projectId)entries.push({id:analysis.id,label:'Failure analysis',status:'completed',timestamp:analysis.createdAt});
 const complete=attempt.events?.[0]?.status==='proposed';
 if(!complete){entries.push({id:attempt.proposalId,label:'Fix proposal',status:'proposed',timestamp:attempt.createdAt});if(attempt.approval)entries.push({id:attempt.proposalId+':approval',label:'Approval',status:'approved',timestamp:attempt.approval.timestamp});}
 if(attempt.events)entries.push(...attempt.events.map(e=>({id:e.id,label:labels[e.phase],status:e.status,timestamp:e.timestamp})));
 return {entries,complete};
}
