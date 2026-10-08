import type {ProjectGraph} from './domain.ts';
import type {ReadinessIssue} from './readiness.ts';

/** 안내 표시만 생성한다. 실행 허용 여부는 Core의 입력 검증을 따른다. */
export function readinessMarkers(graph:ProjectGraph,issues:ReadinessIssue[]) {
 const nodes=new Map<string,ReadinessIssue['severity']>();
 for(const issue of issues)if(issue.nodeId&&graph.nodes.some(node=>node.id===issue.nodeId)) {
  if(nodes.get(issue.nodeId)!=='configuration')nodes.set(issue.nodeId,issue.severity);
 }
 const edges=new Map<string,ReadinessIssue['severity']>();
 for(const edge of graph.edges){const from=nodes.get(edge.from),to=nodes.get(edge.to);if(from||to)edges.set(edge.id,from==='configuration'||to==='configuration'?'configuration':'waiting');}
 return {nodes,edges};
}
