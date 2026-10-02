import {type CoreSnapshot,type Run,type RunStep} from './domain.ts';
export function elapsedMs(row:Pick<Run,'startedAt'|'finishedAt'>):number|null {
 if(!row.startedAt||!row.finishedAt)return null;
 const n=Date.parse(row.finishedAt)-Date.parse(row.startedAt);return Number.isFinite(n)&&n>=0?n:null;
}
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
function source(run:Run){const r=run.revision;if(!r||!/^[a-f0-9]{40,64}$/.test(r.commit))return null;
 return r.snapshotId?{kind:'snapshot',checksum:r.commit}:{kind:'git',repository:r.repository,commit:r.commit};
}
export function compareRuns(projectId:string,left:CoreSnapshot,right:CoreSnapshot,leftId:string,rightId:string){
 const a=left.runs.find(r=>r.id===leftId),b=right.runs.find(r=>r.id===rightId);
 if(!a||!b||a.projectId!==projectId||b.projectId!==projectId||a.id===b.id)throw Error('Run comparison Project boundary.');
 const ja=left.jobs.find(j=>j.id===a.jobId&&j.projectId===projectId),jb=right.jobs.find(j=>j.id===b.jobId&&j.projectId===projectId);
 if(!ja||!jb)throw Error('Run comparison missing job.');
 const plan=(j:typeof ja)=>({name:j.payload.testPlan?.testName??j.name,type:j.payload.testPlan?.type??'task',requirements:j.requirements,steps:j.payload.steps.filter(s=>s.stage!=='source').map(s=>({name:s.name,stage:s.stage,executable:s.executable,args:s.args,cwd:s.cwd,env:s.env,browser:s.browser,healthcheck:s.healthcheck,timeout:s.timeoutMs}))});
 const sourceKnown=!!source(a)&&!!source(b),sameSource=sourceKnown&&canonical(source(a))===canonical(source(b));
 const samePlan=canonical(plan(ja))===canonical(plan(jb)),environmentKnown=!!a.agentEnvironment&&!!b.agentEnvironment;
 const sameEnvironment=environmentKnown&&a.agentId===b.agentId&&canonical(a.agentEnvironment)===canonical(b.agentEnvironment);
 const comparable=sameSource&&samePlan&&sameEnvironment;
 const durationA=elapsedMs(a),durationB=elapsedMs(b);
 const slower=comparable&&a.status==='passed'&&b.status==='passed'&&durationA!==null&&durationB!==null&&durationA>0&&durationB-durationA>=100&&durationB/durationA>=1.2;
 const stepsA=left.steps.filter(s=>s.runId===a.id),stepsB=right.steps.filter(s=>s.runId===b.id);
 const failedTest=(run:Run,steps:RunStep[])=>run.status==='failed'&&(run.executionReport?.classification==='TEST_FAILED'||steps.some(s=>s.executionReport?.classification==='TEST_FAILED'||s.browserResult?.classification==='TEST_FAILED'));
 const flakyCandidate=comparable&&(a.status==='passed'&&failedTest(b,stepsB)||b.status==='passed'&&failedTest(a,stepsA));
 const stepRows=stepsA.map(s=>{const other=stepsB.find(x=>x.order===s.order&&x.name===s.name);return{name:s.name,order:s.order,leftStatus:s.status,rightStatus:other?.status,leftMs:elapsedMs(s),rightMs:other?elapsedMs(other):null};});
 const evidence=(snapshot:CoreSnapshot,id:string)=>snapshot.artifacts.filter(v=>v.runId===id).map(v=>({type:v.type,name:v.name,checksum:v.checksum,size:v.size,available:!v.deletedAt}));
 const ea=evidence(left,a.id),eb=evidence(right,b.id),keys=[...new Set([...ea,...eb].map(v=>JSON.stringify([v.type,v.name])))];
 return {leftId,rightId,leftSource:a.revision,rightSource:b.revision,sourceKnown,sameSource,samePlan,environmentKnown,sameEnvironment,comparable,durationA,durationB,slower,flakyCandidate,steps:stepRows,evidence:keys.map(k=>{const [type,name]=JSON.parse(k) as [string,string],l=ea.filter(v=>v.type===type&&v.name===name),r=eb.filter(v=>v.type===type&&v.name===name);return{type,name,left:l,right:r,equal:l.length===1&&r.length===1&&!!l[0].checksum&&l[0].checksum===r[0].checksum};})};
}
