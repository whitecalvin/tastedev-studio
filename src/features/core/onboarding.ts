import type {CoreSnapshot} from './domain.ts';
import type {ConnectionPhase} from './remote-client.ts';
export interface ConnectionDraft {endpoint:string;mode:'local'|'team'}
export const defaultConnectionDraft:ConnectionDraft={endpoint:'ws://127.0.0.1:4340/studio',mode:'local'};
export function connectionDraft(value:unknown):ConnectionDraft{
 if(!value||typeof value!=='object')return {...defaultConnectionDraft};
 const draft=value as Partial<ConnectionDraft>;try{const url=new URL(draft.endpoint??'');if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/studio'||url.href.length>2048)throw Error('Invalid endpoint');return {endpoint:url.href,mode:draft.mode==='team'?'team':'local'};}catch{return {...defaultConnectionDraft};}
}
export type ReadinessState='ready'|'loading'|'empty'|'unavailable'|'error'|'recovering';
export interface ReadinessCheck {label:string;state:ReadinessState;detail:string}
export function connectionReadiness(phase:ConnectionPhase,snapshot:CoreSnapshot,protocol:{loading:boolean;status:string}):ReadinessCheck[]{
 const connected=phase==='connected',waiting=phase==='connecting'||phase==='recovering';
 return [
  {label:'Core connection',state:connected?'ready':phase==='recovering'?'recovering':waiting?'loading':phase==='authentication'||phase==='protocol-error'||phase==='error'?'error':'unavailable',detail:phase==='authentication'?'Check the Studio token.':phase==='protocol-error'?'Check the Core protocol version.':connected?'Connected to Core':'Connect Core'},
  {label:'Agent capabilities',state:!connected?'unavailable':snapshot.agents.some(a=>a.status==='idle'||a.status==='busy')?'ready':snapshot.agents.length?'unavailable':'empty',detail:!connected?'Connect Core':snapshot.agents.some(a=>a.status==='idle'||a.status==='busy')?'Connected Agent capabilities are reported.':'Start an Agent connected to this Core.'},
  {label:'TASTEDEV Protocol',state:protocol.loading?'loading':protocol.status==='Valid'?'ready':protocol.status==='Not Configured'?'empty':protocol.status==='Access Required'?'unavailable':'error',detail:protocol.loading?'Loading project definition…':protocol.status==='Valid'?'Valid':'Open the project definition and resolve its reported issues.'}
 ];
}
