import type { ProjectGraph } from './domain.ts';
import type { GraphActivation, GraphOverview } from './execution.ts';

export function graphMonitor(graph: ProjectGraph, overview: GraphOverview | null, executionId = '') {
  const execution = executionId
    ? overview?.executions.find(e => e.id === executionId && e.projectId === graph.projectId)
    : overview?.executions.findLast(e => e.projectId === graph.projectId);
  const definition = overview?.definition;
  const compatible = !!execution && !!definition && definition.projectId === graph.projectId &&
    execution.revision === definition.revision && execution.checksum === definition.checksum &&
    execution.inputChecksum === definition.inputChecksum && JSON.stringify(definition.graph) === JSON.stringify(graph);
  const nodes = new Map<string, GraphActivation>();
  if (compatible) {
    for (const activation of execution.activations) {
      if (!graph.nodes.some(n => n.id === activation.nodeId && ['task','approval'].includes(n.kind))) continue;
      const previous = nodes.get(activation.nodeId);
      if (!previous || activation.attempt >= previous.attempt) nodes.set(activation.nodeId, activation);
    }
  }
  return { execution, compatible, nodes };
}
