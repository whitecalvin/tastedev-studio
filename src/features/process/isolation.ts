import type {JobPayload,JobRequirement} from '../core/domain.ts';
import type {ExecutionStep} from '../core/test-plan.ts';
export type ExecutionIsolation = {version:1;filesystem:'workspace';network:'deny';childProcesses:'deny'}|{version:2;filesystem:'workspace';network:'deny';childProcesses:'bounded';maxProcesses:number};
export function strictExecutionIsolation():ExecutionIsolation{return {version:1,filesystem:'workspace',network:'deny',childProcesses:'deny'};}
export const localIsolationMessage='Local validation cannot enforce required isolation. Use an approved remote Protocol Test instead.';
/** Native IDE process execution has no approved OS isolation contract. */
export function assertLocalExecutionAllowed(requirements:JobRequirement,step:ExecutionStep){
 if(requirements.executionIsolation===1||step.isolation)throw Error(localIsolationMessage);
}
export function validateExecutionIsolation(value:unknown):ExecutionIsolation{
 const p=value as ExecutionIsolation;
 if(p&&typeof p==='object'&&!Array.isArray(p)&&p.version===2&&p.filesystem==='workspace'&&p.network==='deny'&&p.childProcesses==='bounded'&&Number.isInteger(p.maxProcesses)&&p.maxProcesses>=2&&p.maxProcesses<=4&&!Object.keys(p).some(k=>!['version','filesystem','network','childProcesses','maxProcesses'].includes(k)))return {...p};
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['version','filesystem','network','childProcesses'].includes(k))||p.version!==1||p.filesystem!=='workspace'||p.network!=='deny'||p.childProcesses!=='deny')throw Error('Unsupported execution isolation policy.');
 return strictExecutionIsolation();
}
/** Source transfer, HTTP checks and owned-service cleanup run in the trusted Agent broker. */
export function isolatedCommand(step:ExecutionStep){return !step.source&&!step.healthcheck&&step.executable!=='internal-stop-services';}
/** An inherited deny or lower bound cannot be loosened by a task/profile. */
export function intersectChildLimits(layers:Pick<JobRequirement,'executionIsolation'|'isolatedChildProcesses'>[]){const isolated=layers.filter(layer=>layer.executionIsolation===1);if(!isolated.length||isolated.some(layer=>layer.isolatedChildProcesses===undefined))return undefined;return Math.min(...isolated.map(layer=>layer.isolatedChildProcesses!));}
export function isolateSteps(requirements:JobRequirement,steps:ExecutionStep[]){return steps.map(step=>requirements.executionIsolation===1&&isolatedCommand(step)?{...step,isolation:requirements.isolatedChildProcesses!==undefined?validateExecutionIsolation({version:2,filesystem:'workspace',network:'deny',childProcesses:'bounded',maxProcesses:requirements.isolatedChildProcesses}):strictExecutionIsolation()}:step);}
export function validateIsolationBoundary(requirements:JobRequirement,payload:JobPayload){
 for(const step of payload.steps){if(step.isolation&&requirements.executionIsolation!==1)throw Error('Execution isolation capability is required.');if(step.isolation?.version===2&&(!requirements.isolatedChildProcesses||step.isolation.maxProcesses>requirements.isolatedChildProcesses))throw Error('Isolated child policy exceeds approved requirements.');if(requirements.executionIsolation===1&&isolatedCommand(step)&&!step.isolation)throw Error('Every executable step requires the approved isolation policy.');}
}
