export interface ConnectionProfile {id:string;name:string;endpoint:string;mode:'local'|'team';updatedAt:string}
export function coreEndpoint(input:string) {
  let url:URL;try{url=new URL(input);}catch{throw Error('Use a valid Core /studio endpoint.');}
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/studio'||url.href.length>2048||/[\r\n\0]/.test(input))throw Error('Use a credential-free Core /studio endpoint.');
  if(url.protocol==='ws:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Remote Core requires wss:// with a trusted TLS certificate.');
  return url.href;
}
const fields=['id','name','endpoint','mode','updatedAt'];
export function connectionProfiles(value:unknown):ConnectionProfile[]{
  if(!Array.isArray(value)||value.length>20)throw Error('Invalid saved connection profiles.');
  const result=value.map(row=>{
    if(!row||typeof row!=='object'||Object.keys(row).some(key=>!fields.includes(key))||typeof row.id!=='string'||!/^[0-9a-f-]{36}$/i.test(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>80||/[\x00-\x1f]/.test(row.name)||!['local','team'].includes(row.mode)||typeof row.endpoint!=='string'||typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt)))throw Error('Invalid saved connection profiles.');
    return {id:row.id,name:row.name.trim(),endpoint:coreEndpoint(row.endpoint),mode:row.mode,updatedAt:row.updatedAt} as ConnectionProfile;
  });
  if(new Set(result.map(profile=>profile.id)).size!==result.length||new Set(result.map(profile=>profile.name.toLocaleLowerCase())).size!==result.length)throw Error('Duplicate connection profile.');
  return result;
}
export interface ProfileStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export class ConnectionProfiles {
  private storage:ProfileStorage;
  constructor(storage:ProfileStorage){this.storage=storage;}
  load(){const value=this.storage.getItem('tastestudio.core.profiles.v1');return value===null?[]:connectionProfiles(JSON.parse(value));}
  save(profile:Omit<ConnectionProfile,'updatedAt'>){const current=this.load(),rows=current.filter(item=>item.id!==profile.id);const next=connectionProfiles([...rows,{...profile,updatedAt:new Date().toISOString()}]);this.storage.setItem('tastestudio.core.profiles.v1',JSON.stringify(next));return next;}
  remove(id:string){const next=this.load().filter(profile=>profile.id!==id);this.storage.setItem('tastestudio.core.profiles.v1',JSON.stringify(next));return next;}
}
