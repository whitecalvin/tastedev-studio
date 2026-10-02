import type {FixAttempt} from './fix-service.ts';import type {Run,RunStep} from '../core/domain.ts';
export function workflowProgress(attempt:FixAttempt,run?:Run,steps:RunStep[]=[]){
 const active=run?.projectId===attempt.projectId&&run.id===attempt.retestRunId?run:undefined;
 const current=active?steps.filter(s=>s.runId===active.id).find(s=>s.status==='running'):undefined;
 const completed=active?steps.filter(s=>s.runId===active.id&&['passed','failed','skipped','cancelled','timeout'].includes(s.status)).length:0;
 const total=active?steps.filter(s=>s.runId===active.id).length:0;
 const hints:Record<FixAttempt['status'],string>={proposed:'Review the proposed diff before approving.',approved:'Approval recorded. Apply the reviewed patch.',applied:'Review disk changes and select a saved validation.',validating:'Validation is running. Wait for the recorded result.',retesting:'Remote retest is queued or running. Source transfer alone is not a test pass.',passed:'Fix verified by the recorded test result.',failed:'Inspect the new failure evidence, then reanalyze or revert.',reverted:'AI changes were reverted. Review the current workspace.',cancelled:'Cancellation recorded. Review source and run state before continuing.',rejected:'Proposal rejected. Source was not changed.', 'recovery-required':'Recovery requires reviewing the patch conflict before further writes.'};
 return{status:attempt.status,hint:attempt.status==='passed'&&active?.status!=='passed'?'Open the retest Run to verify the recorded result.':hints[attempt.status],runId:active?.id,agentId:active?.agentId,currentStep:current?.name,completed,total,verified:attempt.status==='passed'&&active?.status==='passed'};
}
