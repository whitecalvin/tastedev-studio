export interface DownloadIdentity {size:number;checksum:string}
/** One bounded partial download; only completed ranges are retained, no Blob before final verification. */
export class ArtifactDownloads {
 private partial:{key:string;chunks:Uint8Array[];offset:number;mime:string}|null=null;
 private busy=false;
 clear(){this.partial=null;}
 async download(key:string,identity:DownloadIdentity,request:(start:number,end:number,signal?:AbortSignal)=>Promise<Response>,signal?:AbortSignal){
  if(this.busy)throw Error('An artifact download is already in progress. Retry after cancellation.');this.busy=true;try{return await this.transfer(key,identity,request,signal);}finally{this.busy=false;}
 }
 private async transfer(key:string,identity:DownloadIdentity,request:(start:number,end:number,signal?:AbortSignal)=>Promise<Response>,signal?:AbortSignal){
  if(!Number.isSafeInteger(identity.size)||identity.size<1||identity.size>33554432||!/^[a-f0-9]{64}$/.test(identity.checksum))throw Error('Invalid artifact download identity.');
  const bound=key+':'+identity.size+':'+identity.checksum;if(this.partial?.key!==bound)this.partial={key:bound,chunks:[],offset:0,mime:'application/octet-stream'};
  const state=this.partial;
  while(state.offset<identity.size){signal?.throwIfAborted();const end=Math.min(identity.size-1,state.offset+1048575),response=await request(state.offset,end,signal);
   if(this.partial!==state)throw Error('Artifact download context changed.');
   if(response.status!==206||response.headers.get('etag')!==`"${identity.checksum}"`||response.headers.get('content-range')!==`bytes ${state.offset}-${end}/${identity.size}`){if([410,412].includes(response.status))this.clear();throw Error('Artifact range or identity mismatch.');}
   const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==end-state.offset+1)throw Error('Artifact transfer interrupted. Retry to resume verified ranges.');signal?.throwIfAborted();
   state.chunks.push(bytes);state.offset+=bytes.length;state.mime=response.headers.get('content-type')??state.mime;
  }
  const bytes=new Uint8Array(identity.size);let offset=0;for(const chunk of state.chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(this.partial!==state)throw Error('Artifact download context changed.');this.clear();if(hash!==identity.checksum)throw Error('Artifact integrity check failed.');return new Blob([bytes],{type:state.mime});
 }
}
