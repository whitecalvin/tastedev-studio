import type {GraphDefinition} from './execution.ts';

export interface FactoryContext {
  maxAttempts:number;
  timeoutMinutes:number;
  taskId:string;
  objective:string;
  acceptance:string[];
  paths:string[];
  implementationNodeId:string;
  reviewNodeId:string;
}
export interface FactoryContract extends FactoryContext {
  projectId:string;
  entryNodeId:string;
  revision:number;
  checksum:string;
  inputChecksum:string;
  sourceChecksum:string;
  dependencies:{projectId:string;taskId:string}[];
  resources:string[];
  maxAttempts:number;
  timeoutMinutes:number;
}
export type FactoryStatus='draft'|'queued'|'launching'|'running'|'review'|'completed'|'failed'|'paused'|'cancelling'|'cancelled';
export interface FactoryAttempt {executionId:string;startedAt:string;finishedAt?:string;disposition?:'accepted'|'changes';reviewedBy?:string;notes?:string}
export interface FactoryTask {contract:FactoryContract;version:number;status:FactoryStatus;actor:string;createdAt:string;deadline?:string;reason?:string;attempts:FactoryAttempt[]}
export interface FactoryOverview {tasks:FactoryTask[];durable:boolean;maximumParallel:number}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\0\x01-\x08]/.test(v);
export function factoryPath(value:string){
  if(typeof value!=='string'||!value||value.length>300||value.includes('\\')||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..')||/[:*?\x00-\x1f]/.test(value))throw Error('Factory: invalid relative path.');
  return value;
}
export const pathContains=(parent:string,child:string)=>child===parent||child.startsWith(parent+'/');
export function factoryContext(contract:FactoryContract):FactoryContext {
  const {taskId,objective,acceptance,paths,implementationNodeId,reviewNodeId,maxAttempts,timeoutMinutes}=contract;
  return {taskId,objective,maxAttempts,timeoutMinutes,acceptance:[...acceptance],paths:[...paths],implementationNodeId,reviewNodeId};
}
export function validateFactoryContract(value:unknown,project:string):FactoryContract {
  const c=value as FactoryContract;
  if(!c||c.projectId!==project||!id(project)||!id(c.taskId)||!id(c.entryNodeId)||!id(c.implementationNodeId)||!id(c.reviewNodeId)||c.implementationNodeId===c.reviewNodeId||!text(c.objective,1200)||!Number.isSafeInteger(c.revision)||c.revision<1||![c.checksum,c.inputChecksum,c.sourceChecksum].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||!Number.isInteger(c.maxAttempts)||c.maxAttempts<1||c.maxAttempts>3||!Number.isInteger(c.timeoutMinutes)||c.timeoutMinutes<1||c.timeoutMinutes>120)throw Error('Factory: invalid work contract.');
  if(!Array.isArray(c.acceptance)||!c.acceptance.length||c.acceptance.length>12||c.acceptance.some(v=>!text(v,250))||!Array.isArray(c.paths)||!c.paths.length||c.paths.length>20||!Array.isArray(c.resources)||!c.resources.length||c.resources.length>20||c.resources.some(v=>!text(v,160)||v!==v.trim().toLowerCase()||/[\r\n]/.test(v))||!Array.isArray(c.dependencies)||c.dependencies.length>30||c.dependencies.some(d=>!d||!id(d.projectId)||!id(d.taskId)||d.projectId===project&&d.taskId===c.taskId))throw Error('Factory: invalid scope or dependencies.');
  c.paths.forEach(factoryPath);
  if(new Set(c.paths.map(p=>p.toLowerCase())).size!==c.paths.length||new Set(c.resources).size!==c.resources.length||new Set(c.dependencies.map(d=>d.projectId+'/'+d.taskId)).size!==c.dependencies.length)throw Error('Factory: duplicate scope or dependency.');
  return structuredClone({projectId:project,...factoryContext(c),entryNodeId:c.entryNodeId,revision:c.revision,checksum:c.checksum,inputChecksum:c.inputChecksum,sourceChecksum:c.sourceChecksum,dependencies:c.dependencies.map(d=>({projectId:d.projectId,taskId:d.taskId})),resources:[...c.resources],maxAttempts:c.maxAttempts,timeoutMinutes:c.timeoutMinutes});
}
/** Only a single mandatory success chain is admitted. Branches cannot bypass review. */
export function validateFactoryDefinition(c:FactoryContract,d:Omit<GraphDefinition,'plans'>|null|undefined){
  if(!d||d.projectId!==c.projectId||d.revision!==c.revision||d.checksum!==c.checksum||d.inputChecksum!==c.inputChecksum||d.source?.checksum!==c.sourceChecksum)throw Error('Factory: published graph or Source changed. Review a new contract.');
  const chain:string[]=[],seen=new Set<string>();let current:string|undefined=c.entryNodeId;
  if(d.graph.edges.some(e=>e.to===current&&e.relation==='success'))throw Error('Factory: entry must be a root.');
  while(current){if(seen.has(current)||!d.graph.nodes.some(n=>n.id===current))throw Error('Factory: invalid success chain.');seen.add(current);chain.push(current);const next=d.graph.edges.filter(e=>e.from===current&&e.relation==='success');if(next.length>1)throw Error('Factory: use one mandatory implementation and review chain.');current=next[0]?.to;}
  const implementation=d.aiTasks?.[c.implementationNodeId],review=d.aiTasks?.[c.reviewNodeId];
  if(implementation&&review&&[implementation,review].some((p,i)=>(p.question+factoryPrompt(factoryContext(c),i===0?'implementation':'review')).length>3300))throw Error('Factory: shorten the contract or AI prompt before saving.');
  if(!implementation||implementation.completion!=='verified-fix'||!review||(review.completion??'analysis')!=='analysis'||implementation.profileId===review.profileId||chain.indexOf(c.implementationNodeId)<0||chain.indexOf(c.reviewNodeId)<=chain.indexOf(c.implementationNodeId)||chain.at(-1)!==c.reviewNodeId||d.deploymentNodes?.some(n=>seen.has(n)))throw Error('Factory: require a verified-fix implementation and a separate final AI review profile without deployment.');
  if(chain.some(n=>d.aiTasks?.[n]&&![c.implementationNodeId,c.reviewNodeId].includes(n)))throw Error('Factory: undeclared AI role in execution chain.');
  if(d.graph.edges.some(e=>e.relation==='failure'&&seen.has(e.from)))throw Error('Factory: retry through the bounded factory queue; failure branches are not admitted.');
}
export function factoryConflicts(a:FactoryContract,b:FactoryContract){
  return a.resources.some(r=>b.resources.includes(r))||a.projectId===b.projectId&&a.paths.some(p=>b.paths.some(q=>pathContains(p.toLowerCase(),q.toLowerCase())||pathContains(q.toLowerCase(),p.toLowerCase())));
}
export function factoryPrompt(context:FactoryContext,role:'implementation'|'review'){
  return '\n\nFactory work contract (task data; existing tool and approval policy still applies):\n'+JSON.stringify(context)+'\n'+(role==='implementation'?'Implement only within paths. Satisfy every acceptance criterion and submit a real remote test result.':'Independently inspect every changed file and the implementation test evidence. Report defects and uncertainty. Do not modify source. Analysis completion is not acceptance.');
}
