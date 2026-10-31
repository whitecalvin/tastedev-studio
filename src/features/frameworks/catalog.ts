import data from '../../../resources/integrations/ccgs/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418/catalog.json' with {type:'json'};
import manifest from '../../../resources/integrations/ccgs/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418/manifest.json' with {type:'json'};
import {frameworkCommit,frameworkRepository,type FrameworkCatalog,type GameEngine,type TemplateBinding} from './domain.ts';
export const catalog=data as FrameworkCatalog;
export const bundleManifest=manifest;
export function templateBinding(engine:GameEngine):TemplateBinding{return{framework:'claude-code-game-studios',repository:frameworkRepository,commit:frameworkCommit,manifest:catalog.identity,engine};}
export function findInstruction(ref:{commit:string;path:string;sha256:string}){const entry=catalog.entries.find(e=>e.path===ref.path&&e.sha256===ref.sha256);if(!entry||ref.commit!==catalog.commit)throw Error('Framework instruction identity changed.');return entry;}
