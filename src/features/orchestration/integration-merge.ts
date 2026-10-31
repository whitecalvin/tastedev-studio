import {structuredEdit} from '../ai/fix-service.ts';

/** Conservative three-way merge. Overlapping edits require explicit user resolution. */
export function mergeIntegration(base:string,parent:string,task:string):string|null {
  if(parent===base||parent===task)return task;
  if(task===base)return parent;
  const a=structuredEdit(base,parent)[0],b=structuredEdit(base,task)[0];
  if(!a||!b)return null;
  const first=a.start<b.start?a:b,last=first===a?b:a;
  if(first.start+first.remove.length>=last.start)return null;
  return base.slice(0,first.start)+first.insert+base.slice(first.start+first.remove.length,last.start)
    +last.insert+base.slice(last.start+last.remove.length);
}
