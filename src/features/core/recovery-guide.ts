import type {ConnectionPhase} from './remote-client.ts';
export function recoveryGuide(phase:ConnectionPhase){
 if(phase==='authentication')return{message:'Authentication failed.',action:'Enter the configured Studio token.',retry:false};
 if(phase==='protocol-error')return{message:'Core protocol mismatch.',action:'Refresh state before retrying. Do not repeat a submitted action blindly.',retry:false};
 if(['recovering','unavailable','error'].includes(phase))return{message:'Core unavailable. Retrying…',action:'Refresh state before retrying. Do not repeat a submitted action blindly.',retry:true};
 return{message:phase==='connected'?'Connected to Core':'Not connected',action:'',retry:false};
}
