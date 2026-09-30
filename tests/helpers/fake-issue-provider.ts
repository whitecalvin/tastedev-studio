import type {IssueProvider,ExternalIssue} from '../../src/features/issues/domain.ts';
import {IssueError} from '../../src/features/issues/domain.ts';
export class FakeIssueProvider implements IssueProvider {
 readonly name='github';readonly capabilities={comments:false,labels:true};issues:ExternalIssue[]=[];writes=0;searches=0;failure:IssueError|null=null;
 async identify(){if(this.failure)throw this.failure;}
 async search(){this.searches++;if(this.failure)throw this.failure;return structuredClone(this.issues);}
 async get(repository:string,number:number){const issue=this.issues.find(i=>i.repository===repository&&i.number===number);if(!issue)throw new IssueError('repository');return structuredClone(issue);}
 async create(repository:string,input:{title:string;body:string;labels:string[]}){this.writes++;if(this.failure)throw this.failure;const number=this.issues.length+1,issue={provider:'github',repository,number,externalId:String(number),url:`https://github.com/${repository}/issues/${number}`,state:'open',title:input.title,body:input.body,createdAt:new Date().toISOString()};this.issues.push(issue);return structuredClone(issue);}
 async reconcile(){return structuredClone(this.issues);}
}
