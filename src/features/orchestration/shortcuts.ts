interface ShortcutKey {key:string;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey:boolean;repeat:boolean;isComposing:boolean;defaultPrevented:boolean}
interface ShortcutScope {enabled:boolean;editable:boolean;canUndo:boolean;canRedo:boolean}
/** Called only by the canvas/toolbar, never a global document listener. */
export function canvasShortcut(key:ShortcutKey,scope:ShortcutScope):'undo'|'redo'|'find'|null{
 if(!scope.enabled||scope.editable||key.defaultPrevented||key.isComposing||key.repeat||key.altKey||key.ctrlKey===key.metaKey)return null;
 const value=key.key.toLowerCase();
 if(value==='f'&&!key.shiftKey)return 'find';
 if(value==='z')return key.shiftKey?(scope.canRedo?'redo':null):(scope.canUndo?'undo':null);
 if(value==='y'&&!key.shiftKey&&scope.canRedo)return 'redo';
 return null;
}
