import test from 'node:test';
import assert from 'node:assert/strict';
import {graphReadiness,type ReadinessContext} from '../src/features/orchestration/readiness.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations,newAIConfiguration} from '../src/features/orchestration/ai-config.ts';
import {parseProtocol} from '../src/features/protocol/parser.ts';

function fixture(){
 const graph=initialGraph('p');graph.nodes.push({...newNode('agent','agent',1),reference:'a'},{...newNode('task','task',2),reference:'hello'});
 graph.edges.push({id:'host',from:'current-pc',to:'agent',relation:'hosts'},{id:'work',from:'role-implementation',to:'task',relation:'performs'});
 const context:ReadinessContext={projectId:'p',connected:true,protocol:parseProtocol({'project.yml':JSON.stringify({version:1,project:{name:'P',type:'node'}}),'tasks.yml':JSON.stringify({hello:{command:'node',args:['-v']}})}),agents:[{id:'a',status:'idle'}],schedules:[],ai:emptyAIConfigurations('p'),aiConnections:[],aiConnectionsReady:true};
 return{graph,context};
}
test('valid declared device assignment has no setup issues and inputs remain unchanged',()=>{
 const {graph,context}=fixture(),before=JSON.stringify({graph,context});assert.deepEqual(graphReadiness(graph,context),[]);assert.equal(JSON.stringify({graph,context}),before);
 graph.edges=graph.edges.filter(edge=>edge.relation!=='assigns');graph.edges.push({id:'assign-agent',from:'agent',to:'role-implementation',relation:'assigns'});assert.deepEqual(graphReadiness(graph,context),[]);
});
test('offline/loading references are waiting, not fabricated missing references',()=>{
 const {graph,context}=fixture();context.connected=false;context.protocol=null;context.agents=null;context.ai=null;
 const pending=graphReadiness(graph,context);assert(pending.every(issue=>issue.severity==='waiting'));
 context.connected=true;context.ai=emptyAIConfigurations('p');context.agents=[{id:'a',status:'offline'}];
 assert(graphReadiness(graph,context).some(issue=>issue.nodeId==='task'&&issue.severity==='waiting'));
 context.agents=[];assert(graphReadiness(graph,context).some(issue=>issue.message==='The responsible role has no registered Agent.'));
});
test('missing Protocol, role and declared Agent are independently actionable',()=>{
 const {graph,context}=fixture();graph.nodes.find(node=>node.id==='task')!.reference='missing';
 graph.edges=graph.edges.filter(edge=>edge.relation!=='performs');const issues=graphReadiness(graph,context);
 assert(issues.some(issue=>issue.nodeId==='task'&&issue.message==='The Protocol reference does not exist.'));
 assert(issues.some(issue=>issue.nodeId==='task'&&issue.message==='Connect exactly one responsible role.'));
 graph.edges.push({id:'work',from:'role-implementation',to:'task',relation:'performs'});graph.nodes.find(node=>node.id==='agent')!.reference='';
 assert(graphReadiness(graph,context).some(issue=>issue.nodeId==='task'&&issue.message.startsWith('Assign an Agent')));
});
test('deployment requires one immediate approval, including failure branches',()=>{
 const {graph,context}=fixture();graph.nodes.find(node=>node.kind==='role')!.role='deployment';
 assert(graphReadiness(graph,context).some(issue=>issue.message.startsWith('Deployment needs')));
 graph.nodes.push(newNode('approval','gate',3));graph.edges.push({id:'approval',from:'gate',to:'task',relation:'success'});
 assert.deepEqual(graphReadiness(graph,context),[]);
 graph.edges.push({id:'retry',from:'task',to:'task2',relation:'failure'});graph.nodes.push({...newNode('task','task2',4),reference:'hello'});graph.edges.push({id:'work2',from:'role-implementation',to:'task2',relation:'performs'});
 assert(graphReadiness(graph,context).some(issue=>issue.nodeId==='task2'&&issue.message.startsWith('Deployment needs')));
});
test('Schedules require project-owned references and one root binding',()=>{
 const {graph,context}=fixture();graph.nodes.push({...newNode('schedule','schedule',3),reference:'s'});graph.edges.push({id:'trigger',from:'schedule',to:'task',relation:'triggers'});
 context.schedules=[{id:'s',projectId:'foreign'}];assert(graphReadiness(graph,context).some(issue=>issue.nodeId==='schedule'&&issue.message.includes('unavailable')));
 context.schedules=[{id:'s',projectId:'p'}];assert.deepEqual(graphReadiness(graph,context),[]);
 graph.nodes.push(newNode('approval','gate',4));graph.edges.push({id:'next',from:'gate',to:'task',relation:'success'});
 assert(graphReadiness(graph,context).some(issue=>issue.message==='Connect the Schedule to one root task.'));
});
test('AI tasks skip Protocol/Agent requirements but still need role and managed connection review',()=>{
 const {graph,context}=fixture();context.ai!.profiles.push(newAIConfiguration('profile'));context.ai!.bindings.task='profile';graph.nodes.find(node=>node.id==='task')!.reference='';graph.edges=graph.edges.filter(edge=>edge.relation!=='hosts');context.aiConnectionsReady=false;
 assert.deepEqual(graphReadiness(graph,context).map(issue=>issue.message),['Waiting for managed AI connections.']);
 context.aiConnectionsReady=true;assert.deepEqual(graphReadiness(graph,context).map(issue=>issue.message),['Review the AI profile, model and connection.']);
 context.ai!.projectId='other';assert(graphReadiness(graph,context).some(issue=>issue.message.includes('another project')));
});
test('invalid/cross-project graph is never treated as ready and unsupported joins are reported',()=>{
 const {graph,context}=fixture();assert.deepEqual(graphReadiness(graph,{...context,projectId:'other'}).map(issue=>issue.message),['Graph configuration is invalid.']);
 graph.nodes.push(newNode('approval','gate1',3),newNode('approval','gate2',4));graph.edges.push({id:'g1',from:'gate1',to:'task',relation:'success'},{id:'g2',from:'gate2',to:'task',relation:'success'});
 assert(graphReadiness(graph,context).some(issue=>issue.nodeId==='task'&&issue.message.includes('multi-parent')));
});
