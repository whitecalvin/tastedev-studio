import {engines,type GameEngine} from '../../frameworks/domain.ts';
export const technologies=['unspecified','javascript','typescript','python','rust','csharp','cpp','gdscript','mixed','other'] as const;
export interface DevelopmentSetup {technology:typeof technologies[number];engine?:GameEngine}
/** Declared project metadata; never proof of an installed runtime. */
export function developmentSetup(value:unknown):DevelopmentSetup{
 const v=value as DevelopmentSetup;
 if(!v||typeof v!=='object'||Array.isArray(v)||!technologies.includes(v.technology)||v.engine!==undefined&&!engines.includes(v.engine))throw Error('Invalid development setup.');
 return {technology:v.technology,...(v.engine?{engine:v.engine}:{})};
}
