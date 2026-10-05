import type {GraphDefinition,GraphExecution,GraphActivation} from './execution.ts';

/** A producer must be an unambiguous success ancestor in the published graph. */
export function artifactProducerNode(definition:GraphDefinition,consumerNodeId:string,fromTask:string,name:string):string {
 const ancestors=new Set<string>(),pending=[consumerNodeId];
 while(pending.length){const node=pending.pop()!;for(const edge of definition.graph.edges.filter(e=>e.to===node&&e.relation==='success'))if(!ancestors.has(edge.from)){ancestors.add(edge.from);pending.push(edge.from);}}
 const producers=[...ancestors].filter(id=>definition.plans[id]?.payload.steps.some(s=>(s.taskReference??s.name)===fromTask&&s.buildArtifacts?.outputs.some(v=>v.name===name)));
 if(producers.length!==1)throw Error('Artifact input requires one declared success-ancestor producer.');
 return producers[0];
}
export function validateArtifactLineage(definition:GraphDefinition){
 for(const plan of Object.values(definition.plans)){const identities=plan.payload.steps.flatMap(s=>(s.buildArtifacts?.outputs??[]).map(o=>(s.taskReference??s.name)+'/'+o.name));if(new Set(identities).size!==identities.length)throw Error('Artifact producer output must identify one step.');}
 for(const [node,plan] of Object.entries(definition.plans))for(const step of plan.payload.steps)for(const input of step.buildArtifacts?.inputs??[]){const producer=artifactProducerNode(definition,node,input.fromTask,input.name),output=definition.plans[producer].payload.steps.filter(s=>(s.taskReference??s.name)===input.fromTask).flatMap(s=>s.buildArtifacts?.outputs??[]).find(o=>o.name===input.name)!;if(output.executable!==input.executable)throw Error('Artifact executable policy must match producer.');}
}
export function artifactProducerActivation(execution:GraphExecution,consumer:GraphActivation,fromTask:string,name:string):GraphActivation {
 if(!execution.activations.some(a=>a.id===consumer.id&&a.nodeId===consumer.nodeId))throw Error('Artifact consumer activation is outside execution.');
 const node=artifactProducerNode(execution.definition,consumer.nodeId,fromTask,name),producer=execution.activations.findLast(a=>a.nodeId===node);
 if(!producer||producer.status!=='passed'||!producer.runId||!producer.jobId)throw Error('Artifact producer has no verified successful Run.');
 return structuredClone(producer);
}
