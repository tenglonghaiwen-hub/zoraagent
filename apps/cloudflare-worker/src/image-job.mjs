import {DurableObject} from 'cloudflare:workers';
import {ImageJobCore} from './image-job-core.mjs';
export class ImageGenerationJob extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.core=new ImageJobCore(ctx,env);}
 enqueue(job){return this.core.enqueue(job);}
 receipt(){return this.core.receipt();}
 alarm(){return this.core.alarm();}
}
