import type {CoreSnapshot} from '../core/domain.ts';
import type {ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';
import {graphMonitor} from './monitor.ts';

export function executionProgress(graph:ProjectGraph,overview:GraphOverview|null,executionId='',snapshot?:CoreSnapshot) {
 const monitor=graphMonitor(graph,overview,executionId);
 if(!monitor.compatible||!monitor.execution)return null;
 const rows=graph.nodes.filter(n=>['task','approval'].includes(n.kind)).map(node=>{const activation=monitor.nodes.get(node.id),run=activation?.runId&&snapshot?.runs.find(r=>r.id===activation.runId&&r.projectId===graph.projectId),step=run&&snapshot?.steps.find(s=>s.runId===run.id&&s.status==='running'),job=activation?.jobId&&snapshot?.jobs.find(j=>j.id===activation.jobId&&j.projectId===graph.projectId);return{node,activation,currentStep:step?step.name:undefined,reassignments:job?job.assignmentHistory??[]:[],attempts:monitor.execution!.activations.filter(a=>a.nodeId===node.id)};});
 const passed=rows.filter(r=>r.activation?.status==='passed').length;
 return {rows,passed,waiting:rows.filter(r=>r.activation&&['ready','queued'].includes(r.activation.status)).length,approvals:rows.filter(r=>r.activation&&['approval','ai-fix-review','ai-review'].includes(r.activation.status)).length,total:rows.length,failed:rows.filter(r=>r.activation?.status==='failed').length,active:rows.filter(r=>r.activation&&['running','launching','ai-running'].includes(r.activation.status)).length};
}
