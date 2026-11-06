import {validateNativeRecipe,nativeBuildStages,type NativeBuildRecipe,type NativeBuildStage} from '../build/domain.ts';
import {validInstructionRef,type InstructionRef} from '../frameworks/domain.ts';
export const projectKinds = ['web', 'desktop', 'mobile', 'server', 'library', 'composite', 'custom'] as const;
export const nodeKinds = ['device', 'agent', 'role', 'task', 'approval', 'schedule', 'build-package'] as const;
export const roles = ['implementation', 'deployment', 'testing'] as const;
export type ProjectKind = typeof projectKinds[number];
export type NodeKind = typeof nodeKinds[number];
export type Role = typeof roles[number];
export const teamRoles = ['leader', 'design', 'implementation', 'review', 'documentation'] as const;
export type TeamRole = typeof teamRoles[number];
export type Relation = 'hosts' | 'assigns' | 'performs' | 'success' | 'failure' | 'triggers' | 'delegates' | 'consults' | 'escalates';
export interface GraphNode { nativeRecipe?:NativeBuildRecipe; nativeStage?:NativeBuildStage; id: string; kind: NodeKind; label: string; x: number; y: number; reference: string; role: Role; taskType: 'task' | 'test'; parentId?:string; collapsed?:boolean; subflow?:{entryId:string;exitId:string}; teamRole?: TeamRole; instructionRef?:InstructionRef; frameworkTask?:{mode:'claude-code'|'studio';skillId:string;arguments:string;roleId:string;writablePaths?:string[];model?:string;maxTurns?:number} }
export interface GraphEdge { id: string; from: string; to: string; relation: Relation }
export interface ProjectGraph { version: 1; projectId: string; projectKind: ProjectKind; retryLimit: number; nodes: GraphNode[]; edges: GraphEdge[] }
export const graphKey = (id: string) => `tastedev.studio.orchestration.v1:${encodeURIComponent(id)}`;
export function relations(from: NodeKind, to: NodeKind): Relation[] {
  if (from === 'device' && to === 'agent') return ['hosts'];
  if ((from === 'device' || from === 'agent') && to === 'role') return ['assigns'];
  if (from === 'role' && to === 'role') return ['delegates','consults','escalates'];
  if (from === 'role' && ['task','build-package'].includes(to)) return ['performs'];
  if (from === 'schedule' && to === 'task') return ['triggers'];
  if (['task', 'approval', 'build-package'].includes(from) && ['task', 'approval', 'build-package'].includes(to)) return ['success', 'failure'];
  return [];
}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
export function validateGraph(value: unknown, projectId: string): ProjectGraph {
  const g = value as ProjectGraph;
  if (!g || g.version !== 1 || g.projectId !== projectId || !projectKinds.includes(g.projectKind) || !Number.isInteger(g.retryLimit) || g.retryLimit < 1 || g.retryLimit > 3 || !Array.isArray(g.nodes) || !Array.isArray(g.edges) || g.nodes.length > 60 || g.edges.length > 200) throw Error('Invalid project graph. Saved data is unchanged.');
  const nodes = new Map<string, GraphNode>();
  for (const node of g.nodes) {
    if (!node || !identifier(node.id) || nodes.has(node.id) || !nodeKinds.includes(node.kind) || typeof node.label !== 'string' || !node.label.trim() || node.label.length > 120 || typeof node.reference !== 'string' || node.reference.length > 200 || /[\r\n\0]/.test(node.reference) || !roles.includes(node.role) || !['task', 'test'].includes(node.taskType) || !Number.isFinite(node.x) || !Number.isFinite(node.y) || node.x < 0 || node.x > 2800 || node.y < 0 || node.y > 1800) throw Error('Invalid node.');
    if(node.instructionRef!==undefined&&(!['role','task'].includes(node.kind)||!validInstructionRef(node.instructionRef)))throw Error('Invalid framework instruction.');
    if(node.frameworkTask!==undefined){const task=node.frameworkTask;if(node.kind!=='task'||!['claude-code','studio'].includes(task.mode)||!/^skill:[a-z0-9-]+$/.test(task.skillId)||task.roleId!=='workflow'&&!/^role:[a-z0-9-]+$/.test(task.roleId)||typeof task.arguments!=='string'||task.arguments.length>4000||task.arguments.includes('\0'))throw Error('Invalid framework skill task.');if(task.writablePaths!==undefined&&(!Array.isArray(task.writablePaths)||task.writablePaths.length>100||task.writablePaths.some(p=>typeof p!=='string'||p.length>240||/[\x00-\x1f]/.test(p))))throw Error('Invalid isolated file scope.');if(task.model!==undefined&&!/^[-a-zA-Z0-9_.]{1,120}$/.test(task.model)||task.maxTurns!==undefined&&(!Number.isInteger(task.maxTurns)||task.maxTurns<1||task.maxTurns>40))throw Error('Invalid native model budget.');}
    if(node.nativeRecipe!==undefined){if(node.kind!=='build-package')throw Error('Native recipe belongs to a build/package group.');validateNativeRecipe(node.nativeRecipe);}
    if(node.nativeStage!==undefined&&(node.kind!=='task'||!nativeBuildStages.includes(node.nativeStage)||node.frameworkTask||node.reference))throw Error('Invalid native stage.');
    nodes.set(node.id, node);
    if (node.teamRole !== undefined && (!teamRoles.includes(node.teamRole) || !['role', 'task'].includes(node.kind))) throw Error('Invalid team responsibility.');
  }
  for(const group of g.nodes.filter(n=>n.nativeRecipe)){
    const seen=new Set<string>();let id=group.subflow?.entryId;
    for(const stage of nativeBuildStages){const child=nodes.get(id??'');if(!child||child.parentId!==group.id||child.nativeStage!==stage||seen.has(child.id))throw Error('Native build stages must follow the reviewed eight-stage sequence.');seen.add(child.id);const next=g.edges.filter(e=>e.from===child.id&&e.relation==='success');if(next.length>1)throw Error('Native build stages cannot branch.');id=next[0]?.to;}
    if(id||seen.size!==g.nodes.filter(n=>n.parentId===group.id).length||nodes.get(group.subflow?.exitId??'')?.nativeStage!=='verify')throw Error('Native build stages must follow the reviewed eight-stage sequence.');
  }
  const ids = new Set<string>(), links = new Set<string>();
  for(const n of g.nodes){
    if(n.nativeStage&&!nodes.get(n.parentId??'')?.nativeRecipe)throw Error('Native stage requires its parent recipe.');
    if(n.parentId!==undefined&&(!identifier(n.parentId)||n.parentId===n.id||nodes.get(n.parentId)?.kind!=='build-package'||!['task','approval'].includes(n.kind)))throw Error('Invalid build/package parent.');
    if(n.collapsed!==undefined&&(n.kind!=='build-package'||typeof n.collapsed!=='boolean'))throw Error('Only a build/package node can collapse.');
    if(n.subflow!==undefined){const f=n.subflow;if(n.kind!=='build-package'||!f||!identifier(f.entryId)||!identifier(f.exitId)||nodes.get(f.entryId)?.parentId!==n.id||nodes.get(f.exitId)?.parentId!==n.id||Object.keys(f).some(k=>!['entryId','exitId'].includes(k)))throw Error('Invalid build/package entry or exit.');}
    if(n.kind==='build-package'&&(n.parentId||n.reference||n.frameworkTask||n.instructionRef))throw Error('A build/package container is not an executable task.');
  }
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
    if(['success','failure'].includes(edge.relation)&&from.parentId!==to.parentId&&(from.parentId||to.parentId))throw Error('Connect external flow through the build/package parent.');
    if(edge.relation==='hosts') { if(hostedAgents.has(edge.to)) throw Error('An Agent node can only belong to one device.'); hostedAgents.add(edge.to); }
  }
  // 실패 피드백은 설계 관계로만 저장한다. 성공 경로는 순환을 허용하지 않는다.
  const visiting = new Set<string>(), visited = new Set<string>();
  function walk(id: string) {
    if (visiting.has(id)) throw Error('Success path cannot contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of g.edges.filter(e => (nodes.get(e.from)?.subflow?.exitId??e.from) === id && e.relation === 'success')) walk(nodes.get(edge.to)?.subflow?.entryId??edge.to);
    visiting.delete(id); visited.add(id);
  }
  for (const id of nodes.keys()) walk(id);
  // Only model fields are persisted, never credentials or arbitrary imported properties.
  return { version: 1, projectId, projectKind: g.projectKind, retryLimit: g.retryLimit,
    nodes: g.nodes.map(n => ({ id:n.id, kind:n.kind, ...(n.nativeRecipe?{nativeRecipe:validateNativeRecipe(n.nativeRecipe)}:{}),...(n.nativeStage?{nativeStage:n.nativeStage}:{}), label:n.label.trim(), x:n.x, y:n.y, reference:n.reference, role:n.role, taskType:n.taskType, ...(n.parentId?{parentId:n.parentId}:{}),...(n.collapsed!==undefined?{collapsed:n.collapsed}:{}),...(n.subflow?{subflow:{...n.subflow}}:{}), ...(n.instructionRef?{instructionRef:{...n.instructionRef}}:{}), ...(n.frameworkTask?{frameworkTask:{mode:n.frameworkTask.mode,skillId:n.frameworkTask.skillId,arguments:n.frameworkTask.arguments,roleId:n.frameworkTask.roleId,...(n.frameworkTask.writablePaths?{writablePaths:[...n.frameworkTask.writablePaths]}:{}),...(n.frameworkTask.model?{model:n.frameworkTask.model}:{}),...(n.frameworkTask.maxTurns?{maxTurns:n.frameworkTask.maxTurns}:{})}}:{}), ...(n.teamRole ? {teamRole:n.teamRole} : {}) })),
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
  const removed=new Set([id,...graph.nodes.filter(n=>n.parentId===id).map(n=>n.id)]);
  return { ...graph, nodes:graph.nodes.filter(n => !removed.has(n.id)), edges:graph.edges.filter(e => !removed.has(e.from) && !removed.has(e.to)) };
}
