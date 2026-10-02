/** A bounded, relative glob subset: * within a segment, ** as a whole segment.
 * Dynamic programming avoids regex backtracking on untrusted Protocol data. */
export function affectedPattern(value:unknown):string{
 if(typeof value!=='string'||!value||value.length>240||value.startsWith('/')||!/^[\p{L}\p{N}_.*\/ -]+$/u.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'||p.includes('**')&&p!=='**'))throw Error('Use a relative affected file pattern with * or ** segments.');return value;
}
function segment(pattern:string,value:string){let p=0,v=0,star=-1,retry=0;while(v<value.length){if(pattern[p]===value[v]){p++;v++;}else if(pattern[p]==='*'){star=p++;retry=v;}else if(star>=0){p=star+1;v=++retry;}else return false;}while(pattern[p]==='*')p++;return p===pattern.length;}
export function matchesAffected(pattern:string,path:string){const parts=affectedPattern(pattern).split('/'),names=path.split('/'),memo=new Map<string,boolean>();function visit(p:number,n:number):boolean{const key=p+':'+n,previous=memo.get(key);if(previous!==undefined)return previous;const result=p===parts.length?n===names.length:parts[p]==='**'?visit(p+1,n)||(n<names.length&&visit(p,n+1)):n<names.length&&segment(parts[p],names[n])&&visit(p+1,n+1);memo.set(key,result);return result;}return visit(0,0);}
