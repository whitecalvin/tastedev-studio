import type { CoreSnapshot } from './domain.ts';
import type { ConnectionPhase } from './remote-client.ts';

export function connectionPresentation(phase:ConnectionPhase, key:string, snapshot:CoreSnapshot) {
  const connected=phase==='connected';
  let host='';
  try { host=new URL(key.split('\0')[0]).host; } catch { /* No endpoint before connection. */ }
  const label=connected?'Connected to Core':phase==='connecting'?'Connecting to Core…':phase==='recovering'?'Reconnecting to Core…':'Core disconnected';
  return {connected,host,label,tone:connected?'connected':phase==='connecting'||phase==='recovering'?'pending':'disconnected',
    agents:connected?snapshot.agents.filter(a=>['online','idle','busy'].includes(a.status)).length:0,
    idle:connected?snapshot.agents.filter(a=>a.status==='idle').length:0,
    busy:connected?snapshot.agents.filter(a=>a.status==='busy').length:0};
}
