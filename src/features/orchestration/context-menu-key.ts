interface ContextMenuKey {
 key:string;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean;altKey:boolean;
 repeat:boolean;isComposing:boolean;defaultPrevented:boolean;
}
/** 초점을 가진 노드만 처리하며, 입력기 조합과 다른 수정자 단축키는 가로채지 않는다. */
export function isContextMenuKey(event:ContextMenuKey):boolean {
 if(event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return false;
 return event.key==='ContextMenu'||(event.key==='F10'&&event.shiftKey);
}
