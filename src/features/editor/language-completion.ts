import type {TextRange} from './language-service.ts';

export interface SafeCompletion {
 label:string;kind:number;insertText:string;snippet:boolean;range?:TextRange;
 detail?:string;documentation?:string;sortText?:string;filterText?:string;
}
function validRange(value:unknown):value is TextRange {
 const row=value as TextRange;
 return [row?.start,row?.end].every(p=>p&&Number.isSafeInteger(p.line)&&p.line>=0&&p.line<=1000000&&Number.isSafeInteger(p.character)&&p.character>=0&&p.character<=2000000)
  &&(row.start.line<row.end.line||row.start.line===row.end.line&&row.start.character<=row.end.character);
}
const bounded=(value:unknown,limit:number)=>typeof value==='string'&&value.length<=limit&&!value.includes('\0')?value:undefined;
/** Completion never executes server commands or silently applies unrelated edits. */
export function languageCompletions(value:unknown):{items:SafeCompletion[];incomplete:boolean} {
 const list=Array.isArray(value)?value:(value as {items?:unknown[]}|null)?.items;
 if(!Array.isArray(list)||list.length>1000)return{items:[],incomplete:false};
 const defaults=Array.isArray(value)?undefined:(value as {itemDefaults?:unknown})?.itemDefaults;
 // Unhandled server defaults may change edit ranges, so fail closed rather than guess.
 if(defaults&&Object.keys(defaults).length)return{items:[],incomplete:false};
 const items:SafeCompletion[]=[];
 for(const entry of list){
  if(!entry||typeof entry!=='object')continue;
  const row=entry as Record<string,unknown>,label=bounded(row.label,512);
  if(!label||row.command||row.additionalTextEdits||row.insertTextFormat!==undefined&&![1,2].includes(Number(row.insertTextFormat)))continue;
  let range:TextRange|undefined,insertText=bounded(row.insertText??label,65536);
  if(row.textEdit){const edit=row.textEdit as {range?:unknown;insert?:unknown;replace?:unknown;newText?:unknown};
   const target=edit.range??edit.replace;
   if(!validRange(target)||edit.insert&&!validRange(edit.insert))continue;
   range=target;insertText=bounded(edit.newText,65536);
  }
  if(insertText===undefined)continue;
  const documentation=bounded(row.documentation,16000)??bounded((row.documentation as {value?:unknown}|null)?.value,16000);
  items.push({label,kind:Number.isInteger(row.kind)&&Number(row.kind)>=1&&Number(row.kind)<=25?Number(row.kind):1,insertText,snippet:row.insertTextFormat===2,...(range?{range}:{}),...(documentation?{documentation}:{}),...(bounded(row.detail,4000)?{detail:String(row.detail)}:{}),...(bounded(row.sortText,512)?{sortText:String(row.sortText)}:{}),...(bounded(row.filterText,512)?{filterText:String(row.filterText)}:{})});
 }
 return{items,incomplete:!Array.isArray(value)&&(value as {isIncomplete?:unknown})?.isIncomplete===true};
}
