import assert from 'node:assert/strict';
import test from 'node:test';
import {initialGraph,validateGraph} from '../src/features/orchestration/domain.ts';
import {emptyAIConfigurations} from '../src/features/orchestration/ai-config.ts';
import {teamTemplate} from '../src/features/orchestration/team-template.ts';

test('team draft preserves the existing graph and separates five responsibilities from devices and Agents',()=>{
  const graph=initialGraph('project','desktop'),ai=emptyAIConfigurations('project'),before=JSON.stringify(graph);
  const result=teamTemplate(graph,ai,'team');
  assert.equal(JSON.stringify(graph),before);
  assert.deepEqual(result.graph.nodes.slice(0,graph.nodes.length),graph.nodes);
  assert.equal(result.graph.nodes.filter(n=>n.kind==='role'&&n.teamRole).length,5);
  assert.equal(result.graph.nodes.filter(n=>n.kind==='agent').length,1);
  assert.equal(result.configurations.profiles.length,5);
  assert.equal(result.configurations.profiles.find(p=>p.role==='review')?.completion,'analysis');
  assert.equal(result.graph.nodes.find(n=>n.kind==='agent')?.reference,'');
  assert.deepEqual(validateGraph(JSON.parse(JSON.stringify(result.graph)),'project'),result.graph);
  assert.throws(()=>teamTemplate(result.graph,result.configurations,'second'));
  assert.throws(()=>teamTemplate(graph,{...ai,projectId:'other'},'team'));
});
test('invalid responsibility cannot be persisted on a device or imported as an unknown role',()=>{
  const graph=initialGraph('project');
  assert.throws(()=>validateGraph({...graph,nodes:[{...graph.nodes[0],teamRole:'leader'}]},'project'));
  assert.throws(()=>validateGraph({...graph,nodes:[...graph.nodes,{...graph.nodes[1],id:'invalid',teamRole:'administrator'}]},'project'));
});


test('team placement avoids existing cards without moving any existing graph node',()=>{
 const graph=initialGraph('project'),before=structuredClone(graph.nodes),result=teamTemplate(graph,emptyAIConfigurations('project'),'team');
 assert.deepEqual(result.graph.nodes.slice(0,before.length),before);
 for(const added of result.graph.nodes.slice(before.length))for(const other of result.graph.nodes){if(added.id===other.id)continue;assert.ok(!(added.x<other.x+220&&added.x+220>other.x&&added.y<other.y+180&&added.y+180>other.y),added.id+' overlaps '+other.id);}
});
