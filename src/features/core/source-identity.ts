import type {WorkspaceSnapshot} from '../ai/snapshot.ts';
/** File-byte identity excludes launch/proposal/run identities. Project ownership is
 * checked by the caller; this hash is never an authorization token. */
export async function sourceContentHash(snapshot:WorkspaceSnapshot){
 const rows=snapshot.files.map(f=>[f.path,f.checksum,f.size??new TextEncoder().encode(f.content).length] as const).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 if(!rows.length||rows.some(([path,checksum,size])=>!path||!/^[a-f0-9]{64}$/.test(checksum)||!Number.isSafeInteger(size)||size<0))throw Error('Verified Source manifest required.');
 const bytes=new TextEncoder().encode(JSON.stringify(['source-content-v1',...rows]));const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...hash].map(v=>v.toString(16).padStart(2,'0')).join('');
}
