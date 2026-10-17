import {pathContains,validateFactoryContract,type FactoryContract} from './factory.ts';

/** Model output proposes drafts only. Criteria and scope remain owned by the user. */
export function parseFactoryPlan(text:string,base:FactoryContract,readPaths:string[],newId=()=>crypto.randomUUID()):FactoryContract[]{
  if(typeof text!=='string'||text.length>16000)throw Error('Factory: invalid AI work plan.');
  const value=JSON.parse(text) as {tasks:{key:string;objective:string;criteria:number[];paths:string[];dependsOn:string[]}[]};
  if(!value||Object.keys(value).length!==1||!Array.isArray(value.tasks)||!value.tasks.length||value.tasks.length>8)throw Error('Factory: invalid AI work plan.');
  const mapped=new Map<string,string>(),coverage=new Set<number>();
  const contracts:FactoryContract[]=[];
  for(const task of value.tasks){
    if(!task||Object.keys(task).sort().join(',')!=='criteria,dependsOn,key,objective,paths'||typeof task.key!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(task.key)||mapped.has(task.key)||!Array.isArray(task.criteria)||!task.criteria.length||new Set(task.criteria).size!==task.criteria.length||task.criteria.some(i=>!Number.isInteger(i)||i<0||i>=base.acceptance.length)||!Array.isArray(task.paths)||!task.paths.length||task.paths.some(p=>typeof p!=='string'||!base.paths.some(scope=>pathContains(scope,p))||!readPaths.some(read=>pathContains(p,read)))||!Array.isArray(task.dependsOn)||new Set(task.dependsOn).size!==task.dependsOn.length||task.dependsOn.some(key=>!mapped.has(key)))throw Error('Factory: AI plan exceeds scope, omits grounded source or has invalid dependencies.');
    const dependencies=[...base.dependencies,...task.dependsOn.map(key=>({projectId:base.projectId,taskId:mapped.get(key)!}))];
    const contract=validateFactoryContract({...base,taskId:newId(),objective:task.objective,acceptance:task.criteria.map(i=>base.acceptance[i]),paths:task.paths,dependencies},base.projectId);
    mapped.set(task.key,contract.taskId);task.criteria.forEach(i=>coverage.add(i));contracts.push(contract);
  }
  if(coverage.size!==base.acceptance.length)throw Error('Factory: AI plan omitted an acceptance criterion.');
  return contracts;
}
export function factoryPlanningQuestion(base:FactoryContract){
  return 'Act as the factory coordinator. Read relevant real source before dividing this approved scope into at most 8 small development tasks. Do not implement or execute anything. Return the normal structured analysis, but put ONLY a JSON object in summary: {"tasks":[{"key":"lowercase-id","objective":"concrete change","criteria":[0],"paths":["allowed/path"],"dependsOn":[]}]}. criteria are zero-based indexes into the supplied acceptance list; cover every index. Dependencies must refer only to earlier task keys. Every task path must remain within allowed paths and contain at least one file you actually read. Use the other analysis fields for grounded evidence and uncertainty. This proposes drafts; saving and execution require separate user actions.\n'+JSON.stringify({objective:base.objective,acceptance:base.acceptance,paths:base.paths});
}
