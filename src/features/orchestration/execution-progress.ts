import type {ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';
import {graphMonitor} from './monitor.ts';

export function executionProgress(graph:ProjectGraph,overview:GraphOverview|null,executionId='') {
 const monitor=graphMonitor(graph,overview,executionId);
 if(!monitor.compatible||!monitor.execution)return null;
 const rows=graph.nodes.filter(n=>['task','approval'].includes(n.kind)).map(node=>({node,activation:monitor.nodes.get(node.id)}));
 const passed=rows.filter(r=>r.activation?.status==='passed').length;
 return {rows,passed,total:rows.length,failed:rows.filter(r=>r.activation?.status==='failed').length,active:rows.filter(r=>r.activation&&['running','launching','ai-running'].includes(r.activation.status)).length};
}
