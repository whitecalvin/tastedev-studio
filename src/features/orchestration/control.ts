import {recoveryPlan} from './recovery.ts';
import type {ProjectGraph} from './domain.ts';
import type {GraphOverview} from './execution.ts';
import {graphMonitor} from './monitor.ts';

export type GraphControlAction='approve'|'resume'|'cancel';
export function graphControlRequest(graph:ProjectGraph,overview:GraphOverview|null,input:{executionId:string;nodeId:string;action:GraphControlAction;connected:boolean;dirty:boolean;reviewed:boolean}) {
  if(!input.connected)throw Error('Connect to Core in Agents.');
  if(!input.executionId||!['approve','resume','cancel'].includes(input.action))throw Error('Graph execution is unavailable.');
  const monitor=graphMonitor(graph,overview,input.executionId),execution=monitor.execution;
  if(!execution)throw Error('Graph execution is unavailable.');
  if(input.action==='cancel') {
    if(!['running','paused','cancelling'].includes(execution.status))throw Error('This execution is already finished.');
    return {action:'cancel' as const,input:{executionId:execution.id}};
  }
  if(input.dirty||!monitor.compatible)throw Error('Review the saved graph version before continuing.');
  if(!input.reviewed)throw Error('Review this execution before continuing.');
  if(input.action==='resume') {
    const recovery=recoveryPlan(execution,overview?.definition??null);if(recovery.blocked)throw Error(recovery.blocked);
    return {action:'resume' as const,input:{executionId:execution.id}};
  }
  const activation=monitor.nodes.get(input.nodeId);
  if(execution.status!=='running'||activation?.status!=='approval')throw Error('Approval activation not waiting.');
  return {action:'approve' as const,input:{executionId:execution.id,activationId:activation.id,revision:execution.revision,checksum:execution.checksum}};
}
