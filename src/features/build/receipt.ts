import {nativeBuildPath,type NativeBuildOperation,type NativeBuildReceipt} from './domain.ts';
export function validateNativeReceipt(value:unknown,op:NativeBuildOperation,recipeHash:string):NativeBuildReceipt{
 const r=value as NativeBuildReceipt,sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 if(!r||r.version!==1||r.stage!==op.stage||r.executionId!==op.executionId||r.groupId!==op.groupId||r.recipeHash!==recipeHash||!sha(r.sourceHash)||!sha(r.catalogHash)||typeof r.reused!=='boolean'||!['executed','not-required'].includes(r.outcome)||r.outcome==='not-required'&&(op.stage!=='sign'||op.recipe.signing!=='none')||!Array.isArray(r.outputs)||r.outputs.length>128||!Number.isSafeInteger(r.outputCount)||r.outputCount<r.outputs.length||r.outputCount>50000||!sha(r.outputManifestHash))throw Error('Native build receipt identity or policy mismatch.');
 const paths=new Set<string>();for(const f of r.outputs){nativeBuildPath(f.path);if(paths.has(f.path)||!sha(f.checksum)||!Number.isSafeInteger(f.size)||f.size<0)throw Error('Invalid native output receipt.');paths.add(f.path);}
 if(['build','stage','sign','package','verify'].includes(op.stage)&&!r.outputs.length)throw Error('Native build output evidence is missing.');
 return structuredClone(r);
}
