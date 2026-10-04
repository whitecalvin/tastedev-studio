'use client';
import {useEffect,useState} from 'react';
import {useCore} from '../core/context';
import type {ManagedAIConnection} from '../ai/routing';
export function useManagedAIConnections(projectId:string){
 const core=useCore(),key=JSON.stringify([projectId,core.connection.connectionKey,core.connection.generation,core.connection.connected]);
 const [result,setResult]=useState<{key:string;connections:ManagedAIConnection[];error:string}>({key:'',connections:[],error:''});
 useEffect(()=>{if(!core.connection.connected)return;const controller=new AbortController();let live=true;
  void core.connection.listAIConnections(projectId,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])).then(connections=>{if(live)setResult({key,connections,error:''});}).catch(()=>{if(live)setResult({key,connections:[],error:'Managed AI connections could not be loaded.'});});
  return()=>{live=false;controller.abort();};
 },[key,projectId,core.connection]);
 return {connections:result.key===key?result.connections:[],error:result.key===key?result.error:'',ready:core.connection.connected&&result.key===key&&!result.error};
}
