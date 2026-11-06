import {newNode,validateGraph,type GraphEdge,type ProjectGraph} from './domain.ts';
export const buildPackageStages=['Prepare source','Prepare dependencies','Build','Test','Stage files','Sign','Package','Verify packages'] as const;
export function addBuildPackageGroup(input:ProjectGraph,id:string){
 const graph=validateGraph(input,input.projectId);if(graph.nodes.length+9>60||graph.nodes.some(n=>n.id===id))throw Error('The build/package group needs nine available node slots.');
 const candidates=[40,540,1040].flatMap(y=>[40,1160].map(x=>({x,y}))),position=candidates.find(p=>!graph.nodes.filter(n=>!n.parentId).some(n=>{const b=buildGroupBounds(graph,n.id);return p.x<n.x+b.width+24&&p.x+1054+24>n.x&&p.y<n.y+b.height+24&&p.y+408+24>n.y;}))??candidates.at(-1)!;
 const parent={...newNode('build-package',id,0),label:'Build and package',...position,collapsed:false,subflow:{entryId:id+'-step-0',exitId:id+'-step-7'}};
 const children=buildPackageStages.map((label,i)=>({...newNode('task',id+'-step-'+i,i),label,parentId:id,x:parent.x+24+(i%4)*270,y:parent.y+84+Math.floor(i/4)*170}));
 const edges=children.slice(1).map((n,i)=>({id:id+'-flow-'+i,from:children[i].id,to:n.id,relation:'success' as const}));
 return validateGraph({...graph,nodes:[...graph.nodes,parent,...children],edges:[...graph.edges,...edges]},graph.projectId);
}
/** Containers have no process. External flow enters/exits exact child boundaries. */
export function executionEdges(graph:ProjectGraph):GraphEdge[]{
 const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 return graph.edges.flatMap(e=>{if(!['success','failure'].includes(e.relation))return[e];const from=nodes.get(e.from),to=nodes.get(e.to);if(from?.kind==='build-package'&&!from.subflow||to?.kind==='build-package'&&!to.subflow)throw Error('Configure build/package entry and exit nodes.');const target=to?.kind==='build-package'?to.subflow!.entryId:e.to;if(e.relation==='failure'&&from?.kind==='build-package')return graph.nodes.filter(n=>n.parentId===from.id&&!graph.edges.some(inner=>inner.from===n.id&&inner.relation==='failure')).map(n=>({...e,id:e.id+'-'+n.id,from:n.id,to:target}));return [{...e,from:from?.kind==='build-package'?from.subflow!.exitId:e.from,to:target}];});
}
export function buildGroupBounds(graph:ProjectGraph,id:string){const parent=graph.nodes.find(n=>n.id===id),children=graph.nodes.filter(n=>n.parentId===id);if(!parent||parent.collapsed||!children.length)return {width:220,height:126};return{width:Math.max(260,...children.map(n=>n.x-parent.x+244)),height:Math.max(160,...children.map(n=>n.y-parent.y+154))};}
export function visibleGroupGraph(graph:ProjectGraph):ProjectGraph{
 const parent=new Map(graph.nodes.filter(n=>n.kind==='build-package').map(n=>[n.id,n]));const hidden=(id:string)=>{const n=graph.nodes.find(n=>n.id===id);return n?.parentId&&parent.get(n.parentId)?.collapsed?n.parentId:id;};
 return {...graph,nodes:graph.nodes.filter(n=>!n.parentId||!parent.get(n.parentId)?.collapsed),edges:graph.edges.map(e=>({...e,from:hidden(e.from),to:hidden(e.to)})).filter(e=>e.from!==e.to)};
}
export function moveGroupedNode(graph:ProjectGraph,id:string,x:number,y:number){const n=graph.nodes.find(n=>n.id===id);if(!n)return graph;const parent=graph.nodes.find(p=>p.id===n.parentId);if(parent){x=Math.max(parent.x+24,x);y=Math.max(parent.y+84,y);}const children=graph.nodes.filter(c=>c.parentId===id),minX=Math.min(0,...children.map(c=>c.x-n.x)),maxX=Math.max(0,...children.map(c=>c.x-n.x)),minY=Math.min(0,...children.map(c=>c.y-n.y)),maxY=Math.max(0,...children.map(c=>c.y-n.y));const tx=Math.max(-minX,Math.min(2800-maxX,x)),ty=Math.max(-minY,Math.min(1800-maxY,y)),dx=tx-n.x,dy=ty-n.y;return{...graph,nodes:graph.nodes.map(c=>c.id===id||c.parentId===id?{...c,x:c.x+dx,y:c.y+dy}:c)};}
export function groupProgress(graph:ProjectGraph,parentId:string,states:Map<string,{status:string}>){const children=graph.nodes.filter(n=>n.parentId===parentId),values=children.map(n=>states.get(n.id)?.status);return{total:children.length,passed:values.filter(v=>v==='passed').length,status:values.some(v=>['failed','cancelled','timeout'].includes(v??''))?'failed':values.some(v=>v==='approval')?'approval':values.some(v=>['running','launching','queued'].includes(v??''))?'running':values.length&&values.every(v=>v==='passed')?'passed':'pending'};}
export function groupNodeLayer(graph:ProjectGraph,order:string[],id:string,dragging:string|null){const n=graph.nodes.find(n=>n.id===id),owner=n?.parentId??id;if(dragging===id&&n?.parentId)return(order.length+2)*100;const base=(dragging===owner?order.length+1:order.indexOf(owner)+1)*100;return base+(n?.parentId?order.indexOf(id)+1:0);}
export function arrangeBuildGroups(graph:ProjectGraph){
 const groups=new Set(graph.nodes.filter(n=>n.kind==='build-package').map(n=>n.id)),top=graph.nodes.filter(n=>!n.parentId),owner=new Map(graph.nodes.map(n=>[n.id,n.parentId??n.id]));const pending=new Set(top.map(n=>n.id)),ordered:typeof top=[];
 while(pending.size){const layer=top.filter(n=>pending.has(n.id)&&!graph.edges.some(e=>e.relation!=='failure'&&owner.get(e.to)===n.id&&owner.get(e.from)!==n.id&&pending.has(owner.get(e.from)!)));if(!layer.length)throw Error('Cannot arrange a cyclic graph.');ordered.push(...layer);for(const n of layer)pending.delete(n.id);}
 const result=structuredClone(graph);let x=40,y=40,rowHeight=0;
 for(const n of ordered){const size=groups.has(n.id)?buildGroupBounds(graph,n.id):{width:220,height:126};if(x+size.width>3020){x=40;y+=rowHeight+44;rowHeight=0;}const next=moveGroupedNode(result,n.id,x,Math.min(1500,y));result.nodes=next.nodes;x+=size.width+50;rowHeight=Math.max(rowHeight,size.height);}
 return validateGraph(result,result.projectId);
}
