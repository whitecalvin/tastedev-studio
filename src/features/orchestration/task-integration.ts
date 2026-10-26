import {contentHash} from '../ai/fix-service.ts';
import {aiPath} from '../ai/security.ts';
import type {FixService} from '../ai/fix-service.ts';
import type {TaskComparison,TaskWorkspaceHost,TaskWorkspaceScope} from './task-workspace.ts';
export interface IntegrationChoice {path:string;choice:'keep-parent'|'use-task'|'manual';content?:string}
/** Three-way review is data, never a fabricated AI analysis or automatic Git merge. */
export function integrationChanges(comparison:TaskComparison,choices:IntegrationChoice[]){
  if(new Set(choices.map(c=>c.path)).size!==choices.length||choices.some(c=>!comparison.files.some(f=>f.path===c.path&&f.conflict)||!['keep-parent','use-task','manual'].includes(c.choice)))throw Error('Invalid integration resolution scope.');
  const originals:Record<string,string>={},changes:{path:string;proposed:string}[]=[];
  for(const file of comparison.files){aiPath(file.path);if(!file.supported||file.parent===null||file.modified===null)throw Error('This change requires manual file creation or deletion before integration.');const choice=choices.find(c=>c.path===file.path);if(file.conflict&&!choice)throw Error('Resolve every conflict or cancel integration.');
    const result=choice?.choice==='keep-parent'?file.parent:choice?.choice==='manual'?choice.content:file.modified;
    if(typeof result!=='string'||result.length>2*1024*1024)throw Error('Invalid integration resolution.');if(result===file.parent)continue;originals[file.path]=file.parent;changes.push({path:file.path,proposed:result});
  }
  if(!changes.length)throw Error('No new changes to integrate.');return{originals,changes};
}
export class TaskIntegration {
  private host:Pick<TaskWorkspaceHost,'compare'>;private scope:TaskWorkspaceScope;private fixes:FixService;
  constructor(host:Pick<TaskWorkspaceHost,'compare'>,scope:TaskWorkspaceScope,fixes:FixService){this.host=host;this.scope=scope;this.fixes=fixes;}
  async propose(comparison:TaskComparison,choices:IntegrationChoice[],testedFiles?:{path:string;checksum:string}[]){if(comparison.projectId!==this.scope.projectId||this.fixes.projectId!==this.scope.projectId)throw Error('Integration project boundary.');const fresh=await this.host.compare(this.scope,comparison.taskId);if(fresh.fingerprint!==comparison.fingerprint)throw Error('Task or parent Source changed. Compare again.');if(testedFiles&&(fresh.files.length!==testedFiles.length||!(await Promise.all(fresh.files.map(async f=>f.modified!==null&&testedFiles.some(p=>p.path===f.path)&&await contentHash(f.modified)===testedFiles.find(p=>p.path===f.path)!.checksum))).every(Boolean)))throw Error('Task Source differs from its submitted successful Run.');const data=integrationChanges(fresh,choices);return this.fixes.proposeIntegration({id:crypto.randomUUID(),taskId:comparison.taskId,baseRevision:comparison.baseRevision,comparisonFingerprint:comparison.fingerprint,...data});}
  async approveAndApply(attemptId:string,review?:(attemptId:string)=>Promise<void>){const attempt=this.fixes.get(attemptId);if(!attempt.integration)throw Error('Integration attempt required.');const fresh=await this.host.compare(this.scope,attempt.integration.taskId);if(fresh.fingerprint!==attempt.integration.comparisonFingerprint)throw Error('Task or parent Source changed. Compare again.');await review?.(attempt.id);await this.fixes.approve(attempt.id,attempt.patches.map(p=>p.path));await this.fixes.execute('apply_patch',{projectId:this.scope.projectId,attemptId:attempt.id});return this.fixes.get(attempt.id);}
}
