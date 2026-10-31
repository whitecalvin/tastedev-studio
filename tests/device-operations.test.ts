import {parseProtocol} from '../src/features/protocol/parser.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,newNode} from '../src/features/orchestration/domain.ts';
import {deviceOperations,deviceTaskReadiness} from '../src/features/orchestration/operations-board.ts';
import type {Agent} from '../src/features/core/domain.ts';
test('device roles use explicit device and hosted Agent assignments, not display names',()=>{
 const graph=initialGraph('project','web');
 graph.nodes=[{...newNode('device','pc',0),label:'PC'}, {...newNode('agent','a',1),reference:'live'},newNode('role','r',2),newNode('task','task',3),{...newNode('agent','free',4),label:'PC'}];
 graph.edges=[{id:'h',from:'pc',to:'a',relation:'hosts'},{id:'a',from:'a',to:'r',relation:'assigns'},{id:'p',from:'r',to:'task',relation:'performs'}];
 const report={id:'live',status:'busy'} as Agent;
 const live=deviceOperations(graph,[report],true);
 assert.equal(live.devices[0].agents[0].report,report);assert.deepEqual(live.devices[0].roles.map(n=>n.id),['r']);assert.equal(live.devices[0].tasks.length,1);assert.equal(live.unassigned[0].node.id,'free');
 assert.equal(deviceOperations(graph,[report],false).devices[0].agents[0].report,undefined);
});

test('device preparation uses assigned Agent requirements, hides environment values and never borrows another device',()=>{const g=initialGraph('p');g.nodes.push({...newNode('agent','agent',0),reference:'a'},{...newNode('task','check',1),reference:'check'});g.edges.push({id:'hosts',from:'current-pc',to:'agent',relation:'hosts'},{id:'performs',from:'role-implementation',to:'check',relation:'performs'});const protocol=parseProtocol({'project.yml':'version: 1\nproject: {name: check, type: node}','tasks.yml':JSON.stringify({check:{command:'node',args:['-v'],cwd:'src',requirements:{runtimes:{node:'>=24'}},env:{PASSWORD:'dummy-private'}}})});const agent={id:'a',name:'A',lastSeenAt:null,createdAt:'now',updatedAt:'now',status:'idle',platform:'linux',architecture:'x86_64',capabilities:{cpuCores:4,memoryMiB:4096,runtimes:{node:'22'},browsers:[],docker:false,gpu:false,pty:false}} as Agent;const rows=deviceTaskReadiness(g,[agent,{...agent,id:'unbound',capabilities:{...agent.capabilities,runtimes:{node:'24'}}}],true,protocol,'current-pc');assert.equal(rows[0].state,'waiting');assert.equal(rows[0].matches.length,1);assert.match(rows[0].matches[0].reasons.join(' '),/node/);assert.equal(rows[0].cwd,'src');assert(!JSON.stringify(rows).includes('dummy-private'));assert.equal(deviceTaskReadiness(g,[{...agent,capabilities:{...agent.capabilities,runtimes:{node:'24'}}}],true,protocol,'current-pc')[0].state,'ready');assert.equal(deviceTaskReadiness(g,[agent],false,protocol,'current-pc')[0].state,'waiting');});
