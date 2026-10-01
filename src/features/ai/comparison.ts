import {type FixAttempt,FixError} from './fix-service.ts';
/** Comparison is data only. It grants neither source nor execution approval. */
export function compareAttempts(projectId:string,left:FixAttempt,right:FixAttempt){
 if(left.projectId!==projectId||right.projectId!==projectId||left.originRunId!==right.originRunId)throw new FixError('PROJECT_BOUNDARY');
 const paths=[...new Set([...left.patches,...right.patches].map(p=>p.path))].sort();
 return paths.map(path=>{const a=left.patches.find(p=>p.path===path),b=right.patches.find(p=>p.path===path);return{path,original:a?.result??b!.base,modified:b?.result??a!.base,leftHash:a?.resultHash,rightHash:b?.resultHash};});
}
