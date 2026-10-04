import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeWorkflowContext,workflowAnalysis} from '../src/features/workspace/node-workflow.ts';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import type {graphMonitor} from '../src/features/orchestration/monitor.ts';
import type {AnalysisRecord} from '../src/features/ai/domain.ts';

function fixture(){
 const graph=initialGraph('p');graph.nodes.push(newNode('task','repair',1));
 const first={id:'a1',nodeId:'repair',attempt:1,status:'failed' as const,analysisId:'analysis1',runId:'run1'};
 const second={...first,id:'a2',attempt:2,analysisId:'analysis2',runId:'run2'};
 const monitor={compatible:true,execution:{id:'e',projectId:'p',activations:[first,second]},nodes:new Map([['repair',second]])} as ReturnType<typeof graphMonitor>;
 const record={id:'analysis1',projectId:'p',task:{nodeId:'repair',graph:{executionId:'e',activationId:'a1',leaseId:'not-navigation-authority'}}} as AnalysisRecord;
 return {graph,monitor,record};
}
test('node workflow keeps exact historical attempt instead of latest node activation',()=>{
 const {graph,monitor,record}=fixture();const before=JSON.stringify(graph);
 const context=nodeWorkflowContext(graph,'repair',monitor,{projectId:'p',nodeId:'repair',executionId:'e',activationId:'a1',analysisId:'analysis1'});
 assert.equal(context?.runId,'run1');assert.equal(workflowAnalysis(context,[record]),record);
 assert.equal(JSON.stringify(graph),before);assert.equal(Object.hasOwn(context!,'leaseId'),false);
});
test('missing historical activation has no latest fallback',()=>{
 const {graph,monitor}=fixture();const context=nodeWorkflowContext(graph,'repair',monitor,{projectId:'p',nodeId:'repair',executionId:'e',activationId:'missing',analysisId:'analysis1'});
 assert.equal(context?.activationId,undefined);assert.equal(context?.runId,undefined);
});
test('graph mismatch exposes no Run or analysis actions; removed nodes clear context',()=>{
 const {graph,monitor,record}=fixture();monitor.compatible=false;
 const context=nodeWorkflowContext(graph,'repair',monitor,null);
 assert.equal(context?.runId,undefined);assert.equal(workflowAnalysis(context,[record]),undefined);
 assert.equal(nodeWorkflowContext(graph,'deleted',monitor,null),null);
});
test('workflow analysis rejects other projects, nodes, executions and attempts',()=>{
 const {graph,monitor,record}=fixture();const context=nodeWorkflowContext(graph,'repair',monitor,{projectId:'p',nodeId:'repair',executionId:'e',activationId:'a1',analysisId:'analysis1'});
 for(const changed of [{...record,projectId:'foreign'},{...record,id:'different'},{...record,task:{...record.task!,nodeId:'other'}},{...record,task:{...record.task!,graph:{...record.task!.graph!,executionId:'other'}}},{...record,task:{...record.task!,graph:{...record.task!.graph!,activationId:'other'}}}])assert.equal(workflowAnalysis(context,[changed]),undefined);
});
