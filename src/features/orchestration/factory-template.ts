import {initialGraph,newNode,validateGraph,type ProjectGraph} from './domain.ts';
import {newAIConfiguration,validateAIConfigurations,type AIConfigurationStore} from './ai-config.ts';

/** New projects only: never replace an existing configured graph or saved AI bindings. */
export function factoryTemplate(projectId:string,graph:ProjectGraph,configurations:AIConfigurationStore){
  if(graph.projectId!==projectId||configurations.projectId!==projectId||graph.nodes.some(n=>['task','agent','approval','schedule'].includes(n.kind))||graph.edges.some(e=>!['assigns','hosts'].includes(e.relation))||configurations.profiles.length>28)throw Error('Factory: keep the existing workflow. Add implementation and review nodes manually.');
  const result=initialGraph(projectId,graph.projectKind,['implementation','testing']);
  const implementation={...newNode('task','factory-implementation',2),label:'Implementation',x:700,y:40};
  const review={...newNode('task','factory-review',3),label:'Independent review',role:'testing' as const,x:1000,y:40};
  result.nodes.push(implementation,review);
  result.edges.push({id:'factory-implement',from:'role-implementation',to:implementation.id,relation:'performs'},{id:'factory-inspect',from:'role-testing',to:review.id,relation:'performs'},{id:'factory-next',from:implementation.id,to:review.id,relation:'success'});
  const developer={...newAIConfiguration(crypto.randomUUID()),name:'Factory implementation',completion:'verified-fix' as const,role:'implementation' as const,prompt:'Inspect the saved project and the factory work contract. Propose the smallest source change within the allowed paths. Use existing Protocol tests; never claim a test ran from analysis alone.'};
  const reviewer={...newAIConfiguration(crypto.randomUUID()),name:'Factory independent review',completion:'analysis' as const,role:'review' as const,prompt:'Independently review the factory acceptance criteria. Read every changed file and inspect the supplied actual implementation Run and test evidence. Identify defects, missing coverage and uncertainty. Do not propose or apply source edits. Return grounded evidence for the final acceptance review.'};
  return {graph:validateGraph(result,projectId),configurations:validateAIConfigurations({...configurations,profiles:[...configurations.profiles,developer,reviewer],bindings:{...configurations.bindings,[implementation.id]:developer.id,[review.id]:reviewer.id}},projectId)};
}
