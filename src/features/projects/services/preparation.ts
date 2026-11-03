import type {ProjectGraph} from '../../orchestration/domain.ts';
import {newNode,validateGraph} from '../../orchestration/domain.ts';
import type {Agent} from '../../core/domain.ts';
import {matchAgent} from '../../core/matcher.ts';
import {resolveTestPlan} from '../../protocol/resolver.ts';
import type {ProtocolState} from '../../protocol/domain.ts';
export type PreparationState='ready'|'configuration-required'|'authentication-required'|'disconnected'|'unsupported'|'failed';
export interface PreparationCheck {id:string;state:PreparationState;message:string;action:'folder'|'save'|'agents'|'ai'|'tests'|'graph';detail?:string}
export interface PreparationInput {projectId:string;folder:'granted'|'required'|'disconnected'|'loading';dirty:number;sourceAvailable:boolean;connected:boolean;connectionFailed:boolean;protocol:ProtocolState|null;agents:Agent[];testName:string;agentId:string;aiRequired:boolean;authentication:'authenticated'|'missing'|'unverified'|'failed';nativeAI:boolean}
export function projectPreparation(input:PreparationInput){
 const checks:PreparationCheck[]=[],add=(id:string,state:PreparationState,message:string,action:PreparationCheck['action'],detail?:string)=>checks.push({id,state,message,action,...(detail?{detail}:{})});
 add('folder',input.folder==='granted'?'ready':input.folder==='disconnected'?'disconnected':'configuration-required',input.folder==='granted'?'Workspace access is ready.':'Connect the project folder and grant access.','folder');
 add('saved',input.dirty?'configuration-required':'ready',input.dirty?'Save current edits before preparing execution.':'No unsaved editor changes.','save');
 add('source',input.sourceAvailable?'ready':'configuration-required',input.sourceAvailable?'Published Source is available.':'Review and publish the saved graph and Source.','graph');
 add('core',input.connected?'ready':input.connectionFailed?'failed':'disconnected',input.connected?'Connected to Core':'Connect to Core in Agents.','agents');
 add('protocol',input.protocol?.status==='Valid'?'ready':input.protocol?.status==='Invalid'?'failed':'configuration-required',input.protocol?.status==='Valid'?'Project definition is valid.':'Review the project definition in Tests.','tests');
 const agent=input.connected?input.agents.find(a=>a.id===input.agentId):undefined;
 add('agent',agent?['online','idle'].includes(agent.status)?'ready':'disconnected':input.connected?'configuration-required':'disconnected',agent?['online','idle'].includes(agent.status)?'Selected Agent is available.':'Selected Agent must become available.':'Choose a registered execution Agent.','agents');
 let plan:ReturnType<typeof resolveTestPlan>|undefined,error='';
 try{if(input.protocol&&input.testName)plan=resolveTestPlan(input.protocol,input.projectId,input.testName);}catch{error='The selected test plan could not be resolved.';}
 const match=agent&&plan?matchAgent(agent,{...plan.requirements,sourceSnapshot:2}):undefined;
 const unsupported=agent&&(agent.capabilities.sourceSnapshot!==2||plan?.requirements.frameworkRuntime===1&&agent.capabilities.frameworkRuntime!==1||plan?.requirements.executionIsolation===1&&agent.capabilities.executionIsolation!==1);
 add('runtime',error?'failed':match?.matches?'ready':unsupported?'unsupported':'configuration-required',error|| (match?.matches?'Agent capabilities match the selected test.':'Review the test runtime requirements on the selected Agent.'),'agents',match?.reasons.join('; '));
 add('test',plan?'ready':'configuration-required',plan?'A Protocol test is selected.':'Choose a Protocol test for the first task.','tests');
 add('ai',!input.aiRequired?'ready':input.authentication==='authenticated'?'ready':input.authentication==='missing'?'authentication-required':input.authentication==='failed'?'failed':'configuration-required',!input.aiRequired?'No AI execution is selected.':input.nativeAI?'Native authentication must be checked on the execution device.':input.authentication==='authenticated'?'AI authentication is available.':input.authentication==='missing'?'AI authentication required.':'Check the selected AI connection before execution.',input.nativeAI?'agents':'ai');
 return {checks,ready:checks.every(c=>c.state==='ready'),draftReady:!!agent&&!!plan&&!!match?.matches&&input.folder==='granted'&&!input.dirty};
}
/** Creates a reviewable draft only. Does not save, publish, queue or execute. */
export function firstTestDraft(graph:ProjectGraph,agent:Agent,testName:string,protocol:ProtocolState):ProjectGraph{
 validateGraph(graph,graph.projectId);const plan=resolveTestPlan(protocol,graph.projectId,testName);
 if(!matchAgent(agent,{...plan.requirements,sourceSnapshot:2}).matches||graph.nodes.some(n=>n.kind==='task'))throw Error('Review the existing tasks or select an available compatible Agent.');
 const next=structuredClone(graph),unique=(prefix:string)=>{let id=prefix;while(next.nodes.some(n=>n.id===id)||next.edges.some(e=>e.id===id))id+='-next';return id;};
 let runner=next.nodes.find(n=>n.kind==='agent'&&n.reference===agent.id);
 if(!runner){runner={...newNode('agent',unique('starter-agent'),next.nodes.length),label:agent.name,reference:agent.id,x:400,y:220};next.nodes.push(runner);}
 let role=next.nodes.find(n=>n.kind==='role'&&n.role==='testing')??next.nodes.find(n=>n.kind==='role'&&n.role==='implementation');
 if(!role){role={...newNode('role',unique('starter-testing'),next.nodes.length),role:'testing',label:'testing',x:800,y:220};next.nodes.push(role);}
 if(!next.edges.some(e=>e.from===runner.id&&e.to===role.id&&e.relation==='assigns'))next.edges.push({id:unique('starter-assignment'),from:runner.id,to:role.id,relation:'assigns'});
 const task={...newNode('task',unique('starter-test'),next.nodes.length),label:testName,reference:testName,taskType:'test' as const,x:1200,y:220};next.nodes.push(task);next.edges.push({id:unique('starter-performs'),from:role.id,to:task.id,relation:'performs'});
 return validateGraph(next,graph.projectId);
}
