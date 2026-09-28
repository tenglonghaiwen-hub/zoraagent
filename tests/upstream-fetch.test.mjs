import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithoutRedirect} from '../apps/cloudflare-worker/src/upstream-fetch.mjs';

test('Workers fetch uses manual redirects and preserves request fields',async()=>{
 const response=await fetchWithoutRedirect(async(url,options)=>{
  assert.equal(url,'https://provider.test/generate');
  assert.equal(options.redirect,'manual');
  assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,'Bearer test');
  return Response.json({task_id:'123'});
 },'https://provider.test/generate',{method:'POST',headers:{Authorization:'Bearer test'},redirect:'error'});
 assert.deepEqual(await response.json(),{task_id:'123'});
});
test('redirect response is not followed or classified as a safe resubmission',async()=>{
 let calls=0;
 await assert.rejects(fetchWithoutRedirect(async()=>{calls++;return new Response('',{status:307,headers:{Location:'https://elsewhere.test'}});},'https://provider.test'),error=>error.status===502&&!error.preSubmission);
 assert.equal(calls,1);
});
test('only known request-option rejection is classified as pre-submission',async()=>{
 for(const [message,expected] of [['Invalid redirect value, must be one of "follow" or "manual"',true],['fetch failed',false]]){
  await assert.rejects(fetchWithoutRedirect(async()=>{throw Error(message);},'https://provider.test'),error=>Boolean(error.preSubmission)===expected);
 }
});
