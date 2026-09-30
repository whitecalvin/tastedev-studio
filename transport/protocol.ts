import { CoreError } from '../src/features/core/domain.ts';
export const PROTOCOL = 1;
export const MESSAGE_LIMIT = 65536;
export type Message = Record<string, unknown> & { type: string; protocolVersion: number };
export function decode(raw: string): Message {
  if (Buffer.byteLength(raw) > MESSAGE_LIMIT) throw new CoreError('Message too large.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CoreError('Invalid message.');
  const m = value as Message;
  if (m.protocolVersion !== PROTOCOL) throw new CoreError('Protocol mismatch.');
  if (typeof m.type !== 'string' || m.type.length > 40) throw new CoreError('Invalid message type.');
  return m;
}
export function identifier(v: unknown): string {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(v)) throw new CoreError('Invalid identifier.');
  return v;
}
export function timestamp(v:unknown): string {if(typeof v!=='string'||v.length>40||!Number.isFinite(Date.parse(v)))throw new CoreError('Invalid timestamp.');return v;}
export interface LogChunk { sequence:number; stream:'stdout'|'stderr'; text:string; runStepId?:string }
export interface LogState { data: [string,LogChunk[]][]; last: [string,number][] }
/** Latest bounded output only; this is not an artifact store. */
export class RunLogs {
  private data = new Map<string,LogChunk[]>();
  private last = new Map<string,number>();
  private commit?: (state: LogState) => void;
  constructor(initial?:LogState,commit?:(state:LogState)=>void){this.data=new Map(initial?.data??[]);this.last=new Map(initial?.last??[]);this.commit=commit;}
  export():LogState{return structuredClone({data:[...this.data],last:[...this.last]});}
  append(id:string,sequence:unknown,stream:unknown,text:unknown,runStepId?:string) {
    const before=this.commit?this.export():undefined;
    try{this.appendChunk(id,sequence,stream,text,runStepId);this.commit?.(this.export());}
    catch(e){if(before){this.data=new Map(before.data);this.last=new Map(before.last);}throw e;}
  }
  private appendChunk(id:string,sequence:unknown,stream:unknown,text:unknown,runStepId?:string) {
    if(!Number.isSafeInteger(sequence)||(sequence as number)<1||!['stdout','stderr'].includes(stream as string)||typeof text!=='string'||text.length>8192)throw new CoreError('Invalid log chunk.');
    const key=runStepId?`${id}/${runStepId}`:id;
    if((sequence as number)<=(this.last.get(key)??0))return;
    this.last.set(key,sequence as number);
    const rows=this.data.get(id)??[];rows.push({sequence:sequence as number,stream:stream as LogChunk['stream'],text,...(runStepId?{runStepId}:{})});
    let size=rows.reduce((n,r)=>n+Buffer.byteLength(r.text),0);while(rows.length>500||size>131072)size-=Buffer.byteLength(rows.shift()!.text);
    this.data.set(id,rows);const retained=()=>[...this.data.values()].reduce((n,list)=>n+list.reduce((m,row)=>m+Buffer.byteLength(row.text),0),0);
    while(this.data.size>100||retained()>524288){const first=this.data.keys().next().value!;this.data.delete(first);for(const key of this.last.keys())if(key===first||key.startsWith(first+'/'))this.last.delete(key);}
  }
  read(runIds:string[]) {return Object.fromEntries(runIds.map(id=>[id,this.data.get(id)??[]]));}
}

