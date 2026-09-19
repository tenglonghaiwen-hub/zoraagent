import {DurableObject} from 'cloudflare:workers';
import {ImageJobCore} from '../../apps/cloudflare-worker/src/image-job-core.mjs';
export class MockImageJob extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.core=new ImageJobCore(ctx,{DB:{prepare(){return {bind(){return this;},async run(){return {};}};}}},{generate:async({body})=>({data:Array.from({length:body.n},(_,i)=>({url:'https://mock.invalid/image-'+i+'.png'}))}),price:async()=>4,deduct:async()=>{}});}
 enqueue(job){return this.core.enqueue(job);}
 receipt(){return this.core.receipt();}
 alarm(){return this.core.alarm();}
}
export default {async fetch(request,env){
 const job=env.IMAGE_JOBS.getByName('mock-only-4');
 if(request.method==='POST')return Response.json(await job.enqueue({input:{model:'gpt-image-2',n:4,prompt:'test'},task:{id:'mock-only-4',status:'running',revision:1,upstreams:[]},userId:'test',fingerprint:'mock'}));
 return Response.json(await job.receipt());
}};
