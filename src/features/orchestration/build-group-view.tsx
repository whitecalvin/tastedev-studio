'use client';
import {useEffect,useState} from 'react';
import {groupViewKey,readGroupView,saveGroupView} from './build-group-view-state';
export function useBuildGroupView(project:string){
 const [state,setState]=useState<{project:string;values:Record<string,boolean>;raw:string|null;error:string}>({project:'',values:{},raw:null,error:''});
 useEffect(()=>{let active=true;function load(){try{const raw=localStorage.getItem(groupViewKey(project)),values=readGroupView(raw,project);if(active)setState({project,values,raw,error:''});}catch{if(active)setState({project,values:{},raw:null,error:'Saved build group view is invalid.'});}}queueMicrotask(load);const onStorage=(e:StorageEvent)=>{if(e.key===groupViewKey(project))load();};window.addEventListener('storage',onStorage);return()=>{active=false;window.removeEventListener('storage',onStorage);};},[project]);
 const current=state.project===project?state:{project,values:{},raw:null,error:''};
 return {values:current.values,error:current.error,set(id:string,collapsed:boolean){const values={...current.values,[id]:collapsed};try{const raw=saveGroupView(localStorage,project,values,current.raw);setState({project,values,raw,error:''});}catch{setState({...current,error:'Build group view changed in another window.'});}}};
}
