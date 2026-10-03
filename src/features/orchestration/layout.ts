import {validateGraph, type ProjectGraph} from './domain.ts';

/** 실패 피드백은 순서를 뒤집지 않는다. 위치만 바꾸고 실행 정의는 보존한다. */
export function arrangeGraph(input: ProjectGraph): ProjectGraph {
  const graph = validateGraph(input, input.projectId);
  const pending = new Set(graph.nodes.map(n => n.id));
  const layers: typeof graph.nodes[] = [];
  while (pending.size) {
    const layer = graph.nodes.filter(n => pending.has(n.id) && !graph.edges.some(e =>
      e.relation !== 'failure' && e.to === n.id && pending.has(e.from)));
    if (!layer.length) throw Error('Cannot arrange a cyclic graph.');
    layers.push(layer);
    for (const node of layer) pending.delete(node.id);
  }
  const positions = new Map<string, {x:number;y:number}>();
  if (layers.length <= 10 && layers.every(layer => layer.length <= 12)) {
    layers.forEach((layer, column) => layer.forEach((node, row) =>
      positions.set(node.id, {x:40+column*270, y:40+row*150})));
  } else {
    // 최대 60개 노드도 좌표 한계 안에서 겹치지 않게 순서대로 줄바꿈한다.
    layers.flat().forEach((node, index) => positions.set(node.id,
      {x:40+(index%10)*270, y:40+Math.floor(index/10)*150}));
  }
  return {...graph, nodes:graph.nodes.map(node => ({...node, ...positions.get(node.id)!}))};
}
