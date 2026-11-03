import type {FrameworkSession} from '../src/features/frameworks/session.ts';
import {frameworkTurnCompleted} from '../src/features/frameworks/session.ts';
import {CoreError} from '../src/features/core/domain.ts';
const nativeId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
export const nativeTurnCompleted=frameworkTurnCompleted;
/** A failed test is not permission to replay an already completed model turn. */
export function requireNativeResumeParent(session:FrameworkSession){
 if(nativeTurnCompleted(session))throw new CoreError('FRAMEWORK_TURN_COMPLETED: continue Source review or validation; do not replay the completed model turn.');
 if(!Array.isArray(session.events)||!['interrupted','cancelled','failed','authentication-required'].includes(session.status)||!nativeId(session.nativeSessionId))throw new CoreError('Exact stopped native session required before resume.');
}
export function requireNativeResumeRequest(session:FrameworkSession|undefined,value:unknown){
 const request=value as {sessionId?:unknown;nativeSessionId?:unknown;workspaceId?:unknown;configurationChecksum?:unknown;requestId?:unknown}|undefined;
 if(!session||!request)throw new CoreError('Exact stopped native session required before resume.');
 requireNativeResumeParent(session);
 if(!nativeId(request.nativeSessionId)||!nativeId(request.requestId)||request.sessionId!==session.id||request.nativeSessionId!==session.nativeSessionId||request.workspaceId!==session.scope.workspaceId||request.configurationChecksum!==session.scope.configurationChecksum)throw new CoreError('Exact native session, workspace and configuration required before resume.');
}
