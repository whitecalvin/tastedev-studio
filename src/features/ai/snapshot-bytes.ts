export const projectSnapshotLimits={files:10000,bytes:100*1024*1024,fileBytes:8*1024*1024,manifestBytes:2*1024*1024,chunkBytes:256*1024};
export function base64Encode(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function base64Decode(text:string){if(text.length>Math.ceil(projectSnapshotLimits.fileBytes/3)*4||text.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Invalid snapshot base64.');const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(base64Encode(bytes)!==text)throw Error('Noncanonical snapshot base64.');return bytes;}
export async function bytesHash(bytes:Uint8Array){const copy=new Uint8Array(bytes);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',copy))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** Scan decoded bytes as well as UTF-8, so binary wrapping cannot hide secrets. */
export function binaryText(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return text;}
