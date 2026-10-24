export interface TeamExecutionPolicy {maxProviderRequests:number;timeoutSeconds:number;maximumConcurrent:number;executionRequestBudget:number;allowedConnections:string[];allowedModels:string[]}
export const defaultTeamPolicy:TeamExecutionPolicy={maxProviderRequests:6,timeoutSeconds:120,maximumConcurrent:2,executionRequestBudget:60,allowedConnections:[],allowedModels:[]};
export interface TeamPolicyOverview {revision:number;durable:boolean;policy:TeamExecutionPolicy;grants:{id:string;executionId:string;activationId:string;reservedRequests:number;at:string}[]}
export function validateTeamPolicy(value:unknown):TeamExecutionPolicy {
  const p=value as TeamExecutionPolicy;
  if(!p||!Number.isInteger(p.maxProviderRequests)||p.maxProviderRequests<1||p.maxProviderRequests>12||!Number.isInteger(p.timeoutSeconds)||p.timeoutSeconds<10||p.timeoutSeconds>300||!Number.isInteger(p.maximumConcurrent)||p.maximumConcurrent<1||p.maximumConcurrent>2||!Number.isInteger(p.executionRequestBudget)||p.executionRequestBudget<1||p.executionRequestBudget>120)throw Error('Invalid team execution policy.');
  for(const list of [p.allowedConnections,p.allowedModels])if(!Array.isArray(list)||list.length>20||new Set(list).size!==list.length||list.some(v=>typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/.test(v)))throw Error('Invalid AI connection or model allowlist.');
  return{maxProviderRequests:p.maxProviderRequests,timeoutSeconds:p.timeoutSeconds,maximumConcurrent:p.maximumConcurrent,executionRequestBudget:p.executionRequestBudget,allowedConnections:[...p.allowedConnections],allowedModels:[...p.allowedModels]};
}
