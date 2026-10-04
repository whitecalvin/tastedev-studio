import type {GraphNode} from './domain.ts';
/** Search only the current graph. Matching never changes node identities or order. */
export function findNodes(nodes:GraphNode[],query:string,translate:(value:string)=>string=value=>value){
 const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase();
 const terms=normalize(query.slice(0,200)).trim().split(/\s+/).filter(Boolean);
 return nodes.filter(node=>{const text=normalize([node.label,node.kind,node.reference,translate(node.label),translate(node.kind)].join(' '));return terms.every(term=>text.includes(term));});
}
