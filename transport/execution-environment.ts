import {CoreError,type ExecutionEnvironment,type JobRequirement} from '../src/features/core/domain.ts';
import {validateCapabilities,matchAgent} from '../src/features/core/matcher.ts';
/** Additive protocol metadata from the existing fixed runtime probes. Credentials,
 * arbitrary environment values and executable arguments are never retained here. */
export function executionEnvironment(value:unknown,requirements:JobRequirement):ExecutionEnvironment|undefined{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>4096)throw new CoreError('Invalid execution environment.');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['platform','architecture','capabilities','observation','agentVersion'].includes(k))||typeof v.agentVersion!=='string'||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v.agentVersion)||!['windows','linux','macos'].includes(v.platform as string)||!['x86_64','arm64'].includes(v.architecture as string)||v.observation!=='pre-execution-runtime-check')throw new CoreError('Invalid execution environment.');
 const capabilities=validateCapabilities(v.capabilities as Parameters<typeof validateCapabilities>[0]);
 if(Object.keys(capabilities.runtimes).some(k=>!Object.hasOwn(requirements.runtimes??{},k))||Object.keys(requirements.runtimes??{}).some(k=>!Object.hasOwn(capabilities.runtimes,k)))throw new CoreError('Execution runtime scope mismatch.');
 const result:ExecutionEnvironment={platform:v.platform as ExecutionEnvironment['platform'],architecture:v.architecture as ExecutionEnvironment['architecture'],observation:'pre-execution-runtime-check',capabilities,agentVersion:v.agentVersion};
 if(!matchAgent({id:'observation',name:'Observation',status:'idle',lastSeenAt:null,createdAt:'',updatedAt:'',...result},requirements).matches)throw new CoreError('Execution environment does not satisfy approved requirements.');
 return result;
}
