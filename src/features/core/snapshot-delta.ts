import type {CoreSnapshot} from './domain.ts';
const keys=['agents','jobs','runs','steps','artifacts','events'] as const;
export interface SnapshotDelta {upsert:CoreSnapshot;order:Record<keyof CoreSnapshot,string[]>}
export function snapshotDelta(before:CoreSnapshot,after:CoreSnapshot):SnapshotDelta {
 const upsert={} as CoreSnapshot,order={} as SnapshotDelta['order'];
 for(const key of keys){const previous=new Map(before[key].map(row=>[row.id,JSON.stringify(row)]));
  Object.assign(upsert,{[key]:after[key].filter(row=>previous.get(row.id)!==JSON.stringify(row))});order[key]=after[key].map(row=>row.id);
 }
 return {upsert,order};
}
/** Validate everything before replacing any live state; missing sequence forces reconnect. */
export function applySnapshotDelta(before:CoreSnapshot,input:unknown):CoreSnapshot {
 if(!input||typeof input!=='object')throw Error('Invalid Core delta.');
 const delta=input as SnapshotDelta,result={} as CoreSnapshot;
 for(const key of keys){const changes=delta.upsert?.[key],order=delta.order?.[key];
  if(!Array.isArray(changes)||!Array.isArray(order)||order.length>100000||order.some(id=>typeof id!=='string'||!id)||new Set(order).size!==order.length||changes.some(row=>!row||typeof row.id!=='string')||new Set(changes.map(row=>row.id)).size!==changes.length)throw Error('Invalid Core delta.');
  const values=new Map(before[key].map(row=>[row.id,row]));for(const row of changes)values.set(row.id,row);
  if(order.some(id=>!values.has(id))||changes.some(row=>!order.includes(row.id)))throw Error('Incomplete Core delta.');
  Object.assign(result,{[key]:order.map(id=>values.get(id))});
 }
 return result;
}
