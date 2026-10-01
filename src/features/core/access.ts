export const teamRoles=['Owner','Admin','Developer','Viewer'] as const;
export const teamActions=['read','run','cancel','ai','approve','history-write','agent-manage','schedule-manage','issue-write','audit','access-manage'] as const;
export type TeamRole=typeof teamRoles[number];
export type TeamAction=typeof teamActions[number];
export type CoreAccess={mode:'local-single-user'}|{mode:'team';userId:string;role:TeamRole;projectId:string;actions:TeamAction[];revision:number;expiresAt?:string};
export const accessDeniedMessage='Core denied this action. Ask a project administrator to check your access.';
export const sessionExpiredMessage='Your Core session expired or was revoked. Reconnect with a current session token.';
export function accessFeedback(message:string){return /TEAM_.*(SESSION|AUTHENTICATION)/.test(message)?sessionExpiredMessage:/^TEAM_.*QUEUE_LIMIT/.test(message)?'The shared Queue limit was reached. Wait for pending work to finish.':/^TEAM_/.test(message)?accessDeniedMessage:message;}
/** Server descriptions are UI information only, never local authority to write or run. */
export function coreAccess(value:unknown,projectId:string):CoreAccess{
 if(value===undefined)return{mode:'local-single-user'}; // older authenticated Core protocol
 if(!value||typeof value!=='object')throw Error('Invalid Core access description.');
 const v=value as CoreAccess;if(v.mode==='local-single-user')return{mode:v.mode};
 if(v.mode!=='team'||v.projectId!==projectId||typeof v.userId!=='string'||!v.userId||v.userId.length>100||!teamRoles.includes(v.role)||!Array.isArray(v.actions)||v.actions.some(a=>!teamActions.includes(a))||new Set(v.actions).size!==v.actions.length||!Number.isSafeInteger(v.revision)||v.revision<0)throw Error('Invalid Core access description.');
 if(v.expiresAt!==undefined&&(typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))))throw Error('Invalid Core access description.');
 return{mode:v.mode,userId:v.userId,role:v.role,projectId:v.projectId,actions:[...v.actions],revision:v.revision,...(v.expiresAt?{expiresAt:v.expiresAt}:{})};
}
