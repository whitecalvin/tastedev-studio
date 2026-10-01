import {CoreError,type ExecutionReport,type ExecutionClassification} from '../src/features/core/domain.ts';

/** Optional additive protocol-v1 metadata; older Agent results remain compatible. */
export function executionReport(message:Record<string,unknown>):ExecutionReport|undefined {
 if(message.classification===undefined&&message.outputSummary===undefined)return;
 const allowed:ExecutionClassification[]=['PASSED','TEST_FAILED','EXECUTION_ERROR','TIMEOUT','CANCELLED','CONNECTION_LOST','AGENT_SHUTDOWN','AGENT_RESTARTED','CAPABILITY_MISMATCH'];
 if(!allowed.includes(message.classification as ExecutionClassification))throw new CoreError('Invalid execution classification.');
 const classification=message.classification as ExecutionClassification;
 const expected=classification==='PASSED'?'passed':['TEST_FAILED','EXECUTION_ERROR','AGENT_RESTARTED','CAPABILITY_MISMATCH'].includes(classification)?'failed':classification==='TIMEOUT'?'timeout':'cancelled';
 if(message.status!==expected)throw new CoreError('Execution classification does not match status.');
 const result:ExecutionReport={classification};
 if(message.outputSummary!==undefined){
  const v=message.outputSummary;
  if(!v||typeof v!=='object'||Array.isArray(v))throw new CoreError('Invalid output summary.');
  const s=v as Record<string,unknown>;
  if(['totalChunks','droppedChunks','droppedBytes','forwardedBytes'].some(k=>!Number.isSafeInteger(s[k])||(s[k] as number)<0)||typeof s.partial!=='boolean'||(s.droppedChunks as number)>(s.totalChunks as number)||(s.forwardedBytes as number)>1048576||((s.droppedChunks as number)>0&&!s.partial))throw new CoreError('Invalid output summary counters.');
  result.outputSummary={totalChunks:s.totalChunks as number,droppedChunks:s.droppedChunks as number,droppedBytes:s.droppedBytes as number,forwardedBytes:s.forwardedBytes as number,partial:s.partial};
 }
 return result;
}
