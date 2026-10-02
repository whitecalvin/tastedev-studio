import {historyQuery,type HistoryQuery} from './history-query.ts';import {uuid} from '../ai/security.ts';
export interface HistoryRow{id:string;createdAt:string;name:string;status:string;version?:number}
export interface HistoryPage{items:HistoryRow[];total:number;next:string|null}
export function historyPage(value:unknown):HistoryPage{const p=value as HistoryPage;if(!p||!Array.isArray(p.items)||p.items.length>100||!Number.isSafeInteger(p.total)||p.total<p.items.length||p.items.some(r=>!r||typeof r.name!=='string'||r.name.length>512||typeof r.status!=='string'||r.status.length>40||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt)))||new Set(p.items.map(r=>r.id)).size!==p.items.length)throw Error('Invalid history page.');p.items.forEach(r=>uuid(r.id));if(p.next!==null){if(typeof p.next!=='string')throw Error('Invalid history page.');historyQuery({after:p.next});}return p;}
/** Response ownership includes query and session generation. Cancelling a display
 * never cancels a server job or repeats an approval. */
export class HistoryRequestGuard{private epoch=0;begin(boundary:string,kind:string,query:HistoryQuery){return{epoch:++this.epoch,boundary,kind,query:JSON.stringify(historyQuery(query))};}cancel(){this.epoch++;}current(ticket:ReturnType<HistoryRequestGuard['begin']>,boundary:string){return ticket.epoch===this.epoch&&ticket.boundary===boundary;}}
