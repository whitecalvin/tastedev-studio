/** Translate only known application codes; arbitrary provider/source text stays data. */
export function recoveryFeedback(message:string){
 if(message==='PATCH_CONFLICT')return 'Source changed since the proposal. Review your changes and reconcile the file before retrying. Your content is preserved.';
 if(message==='DIRTY_EDITOR')return 'Save or close your unsaved editor changes before retrying. Your editor content is preserved.';
 return message;
}
