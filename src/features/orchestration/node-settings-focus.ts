/** Navigation only: reveal the matching inspector without editing node data. */
export function focusNodeSettings(projectId:string,nodeId:string){
 const inspector=document.getElementById('orch-node-inspector');
 if(!inspector||inspector.dataset.projectId!==projectId||inspector.dataset.nodeId!==nodeId||!inspector.getClientRects().length)return;
 const name=inspector.querySelector<HTMLInputElement>('[data-node-name-input]');
 const target=name&&!name.disabled?name:inspector;
 target.scrollIntoView({block:'nearest',inline:'nearest'});
 target.focus({preventScroll:true});
}
