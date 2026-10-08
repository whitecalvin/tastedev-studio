import {coreEndpoint} from './connection-profiles.ts';
import {connectionReadiness, type ConnectionDraft} from './onboarding.ts';
import type {CoreSnapshot} from './domain.ts';
import type {ConnectionPhase} from './remote-client.ts';

/** Connection completion is based on the live session, never an offline registration or saved address. */
export function connectionSetupSteps(draft:ConnectionDraft, phase:ConnectionPhase, connectionKey:string, snapshot:CoreSnapshot, protocol:{loading:boolean;status:string}) {
 let endpoint='',error='';
 try {endpoint=coreEndpoint(draft.endpoint);} catch {error='Use a credential-free Core /studio endpoint.';}
 const current=phase==='connected'&&endpoint===connectionKey.split('\0')[0];
 const checks=connectionReadiness(current?'connected':phase==='connected'?'disabled':phase,snapshot,protocol);
 const steps=[{label:'Endpoint',state:error?'error':'ready',detail:error||'Saved addresses do not contain credentials.'},...checks];
 const next=steps.findIndex(step=>step.state!=='ready');
 return {steps,next:next<0?steps.length-1:next,complete:steps.every(step=>step.state==='ready'),current};
}
