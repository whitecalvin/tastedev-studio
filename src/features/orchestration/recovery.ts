import type {GraphDefinition,GraphExecution} from './execution.ts';

/** 완료 기록을 재작성하지 않는다. 변경된 입력은 새 실행으로 검토해야 한다. */
export function recoveryPlan(execution:Omit<GraphExecution,'definition'>,definition:Pick<GraphDefinition,'projectId'|'revision'|'checksum'|'inputChecksum'>|null,now=Date.now()) {
 const current=!!definition&&definition.projectId===execution.projectId&&definition.revision===execution.revision&&definition.checksum===execution.checksum&&definition.inputChecksum===execution.inputChecksum;
 const blocked=!current?'Review the saved graph version before continuing.':(!Number.isFinite(Date.parse(execution.deadline))||now>=Date.parse(execution.deadline))?'This execution is already finished.':execution.status!=='paused'?'Only paused execution can resume.':null;
 return {blocked,retained:execution.activations.filter(a=>a.status==='passed'),pending:execution.activations.filter(a=>!['passed','failed','cancelled'].includes(a.status)),failed:execution.activations.filter(a=>a.status==='failed')};
}
