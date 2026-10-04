import {AIError} from './domain.ts';
import {mask} from './security.ts';
import {providerAdapter,type ManagedAIConnection} from './routing.ts';

export interface AIConnectionStatus {
 provider:ManagedAIConnection['provider']; adapter:ManagedAIConnection['adapter']; model:string;
 authentication:'configured'|'missing'|'authenticated'; modelVerified:false;
}
// 진단은 모델 실행 성공이 아니다. 인증값/계정 정보는 계약에 포함하지 않는다.
export function connectionStatus(value:unknown):AIConnectionStatus {
 const v=value as AIConnectionStatus;
 if(!v||!providerAdapter(v.provider,v.adapter)||typeof v.model!=='string'||v.model.length>120||/[\x00-\x1f]/.test(v.model)||!['configured','missing','authenticated'].includes(v.authentication)||v.modelVerified!==false)throw new AIError('malformed');
 return {provider:v.provider,adapter:v.adapter,model:mask(v.model),authentication:v.authentication,modelVerified:false};
}
