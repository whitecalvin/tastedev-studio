import test from 'node:test';
import assert from 'node:assert/strict';
import {findNodes} from '../src/features/orchestration/node-search.ts';
import {newNode} from '../src/features/orchestration/domain.ts';
const nodes=[{...newNode('task','a',0),label:'Build TASTEFILES',reference:'build:files'}, {...newNode('device','b',1),label:'DEV-01',reference:'PC-01'}, {...newNode('task','c',2),label:'Build TASTEFILES',reference:'test:files'}];
test('multiple terms match names, types and references without merging duplicate labels',()=>{
 assert.deepEqual(findNodes(nodes,'BUILD files').map(n=>n.id),['a','c']);assert.deepEqual(findNodes(nodes,'task build:files').map(n=>n.id),['a']);assert.deepEqual(findNodes(nodes,' pc-01 ').map(n=>n.id),['b']);
});
test('localized labels and compatibility characters are searchable',()=>{
 assert.deepEqual(findNodes(nodes,'장비',value=>value==='device'?'장비':value).map(n=>n.id),['b']);assert.deepEqual(findNodes(nodes,'ＢＵＩＬＤ').map(n=>n.id),['a','c']);
});
test('empty search preserves order and objects; expressions are treated literally',()=>{
 const before=JSON.stringify(nodes);assert.deepEqual(findNodes(nodes,' '),nodes);assert.equal(findNodes(nodes,'')[0],nodes[0]);assert.deepEqual(findNodes(nodes,'.*'),[]);assert.deepEqual(findNodes(nodes,'<script>'),[]);assert.equal(JSON.stringify(nodes),before);assert.deepEqual(findNodes([],''),[]);
});
