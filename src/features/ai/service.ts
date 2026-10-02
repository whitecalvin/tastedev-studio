import {AIError,limits,analysisSchema,defaultBudget,validateBudget,type AnalysisMetrics,type AnalysisBudget,type Analysis,type AnalysisRecord,type Conversation,type Message,type AIProvider} from './domain.ts';
import {ContextTools,type ToolEnvironment} from './tools.ts';
import {aiPath,mask,sanitize} from './security.ts';
export interface ContextSelection {fixFeedback?:unknown; current?:{path:string;content:string}; selected?:{path:string;text:string;start:number}; open?:string[]; protocol?:unknown; related?:string[]; runId?:string; originalRunId?:string }
export async function buildContext(tools:ContextTools,selection:ContextSelection,signal:AbortSignal){
 tools.add('Project','project',{id:tools.env.projectId,name:tools.env.name});
 if(selection.protocol)tools.add('Protocol','protocol',selection.protocol,4000);
 if(selection.fixFeedback)tools.add('Current fix validation feedback','validation',selection.fixFeedback,4000);
 if(selection.open)tools.add('Open editors','editors',selection.open.filter(p=>{try{aiPath(p);return true;}catch{return false;}}).slice(0,20),2000);
 if(selection.current){aiPath(selection.current.path);tools.add(`Current editor: ${selection.current.path}`,'editor',selection.current.content,limits.file,{path:selection.current.path});}
 if(selection.selected){aiPath(selection.selected.path);tools.add(`Selection: ${selection.selected.path}`,'selection',{startLine:selection.selected.start,text:selection.selected.text},8000,{path:selection.selected.path});}
 for(const path of (selection.related??[]).slice(0,3))await tools.execute('read_file',{path},signal);
 if(selection.runId){await tools.execute('get_run',{runId:selection.runId},signal);
  if(selection.originalRunId&&selection.originalRunId!==selection.runId){
   const snapshot=tools.env.snapshot(),step=snapshot.steps.find(s=>s.runId===selection.runId&&['failed','timeout'].includes(s.status));
   if(step){await tools.execute('get_run_step',{runId:selection.runId,stepId:step.id},signal);await tools.execute('get_logs',{runId:selection.runId,stepId:step.id},signal);}
   const evidence=snapshot.artifacts.find(a=>a.runId===selection.runId&&(!step||a.runStepId===step.id)&&!a.deletedAt&&['test-report','browser-console','page-errors','network-log'].includes(a.type));
   if(evidence)await tools.execute('get_evidence',{runId:selection.runId,artifactId:evidence.id},signal);
  }
 }
 if(selection.originalRunId&&selection.originalRunId!==selection.runId){tools.add('Original failure versus current retest','lineage',{originalRunId:selection.originalRunId,currentRunId:selection.runId});await tools.execute('get_run',{runId:selection.originalRunId},signal);}
}
// Provider output stays unknown until the entire schema and all references are checked.
function conforms(value:unknown,schema:unknown):boolean{
 const s=schema as {type:string;properties?:Record<string,unknown>;items?:unknown};
 if(s.type==='string')return typeof value==='string'&&value.length<=limits.response;
 if(s.type==='integer')return Number.isSafeInteger(value);
 if(s.type==='array')return Array.isArray(value)&&value.length<=30&&value.every(v=>conforms(v,s.items));
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>,p=s.properties!;return Object.keys(v).length===Object.keys(p).length&&Object.keys(p).every(k=>conforms(v[k],p[k]));
}
export function validateAnalysis(text:string,tools:ContextTools):Analysis{
 let value:unknown;try{value=JSON.parse(text);}catch{throw new AIError('malformed');}
 if(!conforms(value,analysisSchema))throw new AIError('malformed');const a=value as Analysis;
 const ids=new Set(tools.context.map(c=>c.id));const refs=[...a.evidence,...a.candidates.flatMap(c=>c.evidence),...a.relatedFiles.map(f=>f.evidence)];
 if(!a.summary.trim()||refs.some(id=>!ids.has(id))||a.candidates.some(c=>!c.evidence.length||!c.uncertainty.trim()))throw new AIError('malformed');
 for(const file of a.relatedFiles){const c=tools.context.find(c=>c.id===file.evidence&&c.path===file.path&&c.kind==='source');if(!c||c.truncated||file.start<1||file.end<file.start||file.end>(c.end??0))throw new AIError('malformed');}
 for(const p of a.proposal){if(!(p.path in tools.originals)||!a.relatedFiles.some(f=>f.path===p.path)||p.proposed.length>limits.file||!p.rationale||!p.tests.length)throw new AIError('malformed');aiPath(p.path);}
 return a;
}
export class AIService {
 readonly provider:AIProvider;readonly env:ToolEnvironment;readonly conversations:Conversation[]=[];readonly history:AnalysisRecord[]=[];
 private active:AbortController|null=null;private configuredBudget:AnalysisBudget={...defaultBudget};
 lastMetrics:AnalysisMetrics|null=null;
 get budget(){return validateBudget(this.configuredBudget);}
 setBudget(value:AnalysisBudget){if(this.active)throw new AIError('tool-failure');this.configuredBudget=validateBudget(value);}
 constructor(provider:AIProvider,env:ToolEnvironment){this.provider=provider;this.env=env;}
 setSecrets(values:string[]){if(this.active)throw new AIError('tool-failure');this.env.secrets=[...new Set(values.filter(Boolean))];}
 newConversation(){this.stop();const c:Conversation={id:crypto.randomUUID(),projectId:this.env.projectId,createdAt:new Date().toISOString(),messages:[]};this.conversations.push(c);if(this.conversations.length>20)this.conversations.shift();return c;}
 stop(){this.active?.abort(new AIError('cancelled'));}
 async analyze(conversationId:string,question:string,selection:ContextSelection,onEvent:(event:{type:'context'|'tool'|'delta';text:string})=>void,timeout=limits.timeout){
  if(this.active)throw new AIError('tool-failure');const c=this.conversations.find(c=>c.id===conversationId&&c.projectId===this.env.projectId);if(!c||!question.trim()||question.length>4000)throw new AIError('context-too-large');
  const budget=this.budget,started=performance.now();const controller=new AbortController();this.active=controller;const signal=controller.signal;let timer:ReturnType<typeof setTimeout>|undefined;
  const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>controller.abort(new AIError('timeout')),Math.min(timeout,budget.timeoutMs));signal.addEventListener('abort',()=>reject(signal.reason instanceof AIError?signal.reason:new AIError('cancelled')),{once:true});});
  const tools=new ContextTools(this.env);const safeQuestion=mask(question,this.env.secrets);c.messages.push({role:'user',text:safeQuestion});
  let count=0,input=0,output=0,requests=0,replies=0,usageComplete=true,costComplete=!!budget.cost,cost=0;
  const metrics=(outcome:AnalysisMetrics['outcome']):AnalysisMetrics=>({durationMs:Math.round(performance.now()-started),providerRequests:requests,toolCalls:count,usageComplete:usageComplete&&replies===requests,budget,...(costComplete&&replies===requests?{estimatedCostUsd:cost}:{}),costComplete:costComplete&&replies===requests,outcome});
  this.lastMetrics=null;
  const work=async()=>{
   await buildContext(tools,selection,signal);signal.throwIfAborted();onEvent({type:'context',text:tools.context.map(c=>c.label).join('\n')});
   const messages:Message[]=[{role:'user',text:JSON.stringify({question:safeQuestion,mode:selection.runId?'failure':'development',runId:selection.runId,originalRunId:selection.originalRunId,previousConversation:c.messages.slice(-6,-1).map(m=>({role:m.role,text:m.text.slice(0,2500)})),context:tools.context})}];
   const calls=new Set<string>();
   while(true){signal.throwIfAborted();if(JSON.stringify(messages).length>limits.total+16000)throw new AIError('context-too-large');
    if(requests>=budget.maxProviderRequests)throw new AIError('budget');requests++;
    const reply=await this.provider.request({messages},signal,text=>{if(!signal.aborted)onEvent({type:'delta',text:mask(text,this.env.secrets)});});replies++;signal.throwIfAborted();if(reply.usage){if(!Number.isSafeInteger(reply.usage.input)||!Number.isSafeInteger(reply.usage.output)||reply.usage.input<0||reply.usage.output<0){usageComplete=false;costComplete=false;throw new AIError('malformed');}input+=reply.usage.input;output+=reply.usage.output;}else usageComplete=false;
    if(budget.cost){if(!reply.usage||reply.model!==budget.cost.model){costComplete=false;throw new AIError('budget');}cost+=(reply.usage.input*budget.cost.inputUsdPerMillion+reply.usage.output*budget.cost.outputUsdPerMillion)/1000000;if(cost>budget.cost.maxUsd)throw new AIError('budget');}
    if(input>budget.maxInputTokens||output>budget.maxOutputTokens)throw new AIError('budget');
    if(reply.text.length>limits.response||reply.calls.length>limits.calls)throw new AIError('malformed');
    if(!reply.calls.length){const result=validateAnalysis(JSON.stringify(sanitize(JSON.parse(reply.text),this.env.secrets)),tools);const record:AnalysisRecord={id:crypto.randomUUID(),projectId:this.env.projectId,conversationId:c.id,...(selection.runId?{runId:selection.runId}:{}),model:reply.model,createdAt:new Date().toISOString(),result,context:tools.context,originals:tools.originals,...(usageComplete?{usage:{input,output}}:{}),metrics:metrics('completed')};this.lastMetrics=record.metrics!;this.history.push(record);if(this.history.length>100)this.history.shift();c.messages.push({role:'assistant',text:result.summary,analysisId:record.id});c.messages=c.messages.slice(-20);return record;}
    messages.push({role:'assistant',text:reply.text,calls:reply.calls});
    for(const call of reply.calls){if(++count>limits.calls)throw new AIError('tool-failure');const key=JSON.stringify([call.name,call.arguments]);if(calls.has(key))throw new AIError('tool-failure');calls.add(key);onEvent({type:'tool',text:call.name});
     let text:string;try{text=JSON.stringify(await tools.execute(call.name,call.arguments,signal));}catch(error){signal.throwIfAborted();if(error instanceof AIError&&error.code==='context-too-large')throw error;text=JSON.stringify({error:'Tool access rejected or unavailable. Use only valid project-scoped read-only inputs.'});}
     signal.throwIfAborted();messages.push({role:'tool',callId:call.id,text});onEvent({type:'context',text:tools.context.map(c=>c.label).join('\n')});
    }
   }
  };
  try{return await Promise.race([work(),expired]);}catch(error){const safe=error instanceof AIError?error:new AIError(error instanceof SyntaxError?'malformed':'tool-failure');this.lastMetrics=metrics(safe.code);throw safe;}finally{clearTimeout(timer);this.active=null;}
 }
}
