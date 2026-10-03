export const projectKinds = ['web', 'desktop', 'mobile', 'server', 'library', 'composite', 'custom'] as const;
export const nodeKinds = ['device', 'agent', 'role', 'task', 'approval', 'schedule'] as const;
export const roles = ['implementation', 'deployment', 'testing'] as const;
export type ProjectKind = typeof projectKinds[number];
export type NodeKind = typeof nodeKinds[number];
export type Role = typeof roles[number];
export type Relation = 'hosts' | 'assigns' | 'performs' | 'success' | 'failure' | 'triggers';
export interface GraphNode { id: string; kind: NodeKind; label: string; x: number; y: number; reference: string; role: Role; taskType: 'task' | 'test' }
export interface GraphEdge { id: string; from: string; to: string; relation: Relation }
export interface ProjectGraph { version: 1; projectId: string; projectKind: ProjectKind; retryLimit: number; nodes: GraphNode[]; edges: GraphEdge[] }
export const graphKey = (id: string) => `tastedev.studio.orchestration.v1:${encodeURIComponent(id)}`;
export function relations(from: NodeKind, to: NodeKind): Relation[] {
  if (from === 'device' && to === 'agent') return ['hosts'];
  if ((from === 'device' || from === 'agent') && to === 'role') return ['assigns'];
  if (from === 'role' && to === 'task') return ['performs'];
  if (from === 'schedule' && to === 'task') return ['triggers'];
  if (['task', 'approval'].includes(from) && ['task', 'approval'].includes(to)) return ['success', 'failure'];
  return [];
}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
export function validateGraph(value: unknown, projectId: string): ProjectGraph {
  const g = value as ProjectGraph;
  if (!g || g.version !== 1 || g.projectId !== projectId || !projectKinds.includes(g.projectKind) || !Number.isInteger(g.retryLimit) || g.retryLimit < 1 || g.retryLimit > 3 || !Array.isArray(g.nodes) || !Array.isArray(g.edges) || g.nodes.length > 60 || g.edges.length > 200) throw Error('Invalid project graph. Saved data is unchanged.');
  const nodes = new Map<string, GraphNode>();
  for (const node of g.nodes) {
    if (!node || !identifier(node.id) || nodes.has(node.id) || !nodeKinds.includes(node.kind) || typeof node.label !== 'string' || !node.label.trim() || node.label.length > 120 || typeof node.reference !== 'string' || node.reference.length > 200 || /[\r\n\0]/.test(node.reference) || !roles.includes(node.role) || !['task', 'test'].includes(node.taskType) || !Number.isFinite(node.x) || !Number.isFinite(node.y) || node.x < 0 || node.x > 2800 || node.y < 0 || node.y > 1800) throw Error('Invalid node.');
    nodes.set(node.id, node);
  }
  const ids = new Set<string>(), links = new Set<string>();
  const boundAgents = new Set<string>(), hostedAgents = new Set<string>();
  for (const node of g.nodes.filter(n=>n.kind==='agent'&&n.reference)) {
    if(boundAgents.has(node.reference)) throw Error('An Agent can only be bound once in a project graph.');
    boundAgents.add(node.reference);
  }
  for (const edge of g.edges) {
    const from = nodes.get(edge?.from), to = nodes.get(edge?.to);
    const link = `${edge?.from}:${edge?.to}:${edge?.relation}`;
    if (!edge || !identifier(edge.id) || ids.has(edge.id) || links.has(link) || !from || !to || from.id === to.id || !relations(from.kind, to.kind).includes(edge.relation)) throw Error('Invalid or duplicate relationship.');
    ids.add(edge.id); links.add(link);
    if(edge.relation==='hosts') { if(hostedAgents.has(edge.to)) throw Error('An Agent node can only belong to one device.'); hostedAgents.add(edge.to); }
  }
  // 실패 피드백은 설계 관계로만 저장한다. 성공 경로는 순환을 허용하지 않는다.
  const visiting = new Set<string>(), visited = new Set<string>();
  function walk(id: string) {
    if (visiting.has(id)) throw Error('Success path cannot contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of g.edges.filter(e => e.from === id && e.relation === 'success')) walk(edge.to);
    visiting.delete(id); visited.add(id);
  }
  for (const id of nodes.keys()) walk(id);
  // Only model fields are persisted, never credentials or arbitrary imported properties.
  return { version: 1, projectId, projectKind: g.projectKind, retryLimit: g.retryLimit,
    nodes: g.nodes.map(n => ({ id:n.id, kind:n.kind, label:n.label.trim(), x:n.x, y:n.y, reference:n.reference, role:n.role, taskType:n.taskType })),
    edges: g.edges.map(e => ({ id:e.id, from:e.from, to:e.to, relation:e.relation })) };
}
export function newNode(kind: NodeKind, id: string, index: number): GraphNode {
  return { id, kind, label:kind, x:40+(index%4)*270, y:40+Math.floor(index/4)*160, reference:'', role:'implementation', taskType:'task' };
}
export function initialGraph(projectId: string, projectKind: ProjectKind = 'custom', firstRoles: Role[] = ['implementation']): ProjectGraph {
  const device = { ...newNode('device', 'current-pc', 0), label:'Current PC', y:220 };
  const nodes: GraphNode[] = [device];
  const edges: GraphEdge[] = [];
  for (const [i, role] of [...new Set(firstRoles)].entries()) {
    nodes.push({ ...newNode('role', `role-${role}`, i+1), label:role, role, x:400, y:40+i*170 });
    edges.push({ id:`assign-${role}`, from:device.id, to:`role-${role}`, relation:'assigns' });
  }
  return validateGraph({version:1, projectId, projectKind, retryLimit:3, nodes, edges}, projectId);
}
export interface GraphStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export function loadGraph(storage: GraphStorage, projectId: string): ProjectGraph | null {
  const raw = storage.getItem(graphKey(projectId));
  if (raw === null) return null;
  if (raw.length > 100000) throw Error('Saved project graph exceeds limit.');
  return validateGraph(JSON.parse(raw), projectId);
}
export function saveGraph(storage: GraphStorage, graph: ProjectGraph, expected?: string | null) {
  if(expected !== undefined && storage.getItem(graphKey(graph.projectId)) !== expected) throw Error('Graph changed in another window. Your draft is preserved.');
  storage.setItem(graphKey(graph.projectId), JSON.stringify(validateGraph(graph, graph.projectId)));
}
export function removeNode(graph: ProjectGraph, id: string): ProjectGraph {
  return { ...graph, nodes:graph.nodes.filter(n => n.id !== id), edges:graph.edges.filter(e => e.from !== id && e.to !== id) };
}
