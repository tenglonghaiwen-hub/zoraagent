import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCallIds} from '../packages/agent/call-ids.mjs';
import {normalizeCallIdsWeb} from '../packages/agent/call-ids-web.mjs';
import {startCloudRelay} from '../apps/desktop/main/cloud-network-relay.mjs';
test('long historical call/output IDs are shortened consistently without collisions or mutation',()=>{
 const a='x'.repeat(551),b=a+'different';
 const original={input:[{type:'function_call',call_id:a},{type:'function_call_output',call_id:a},{type:'custom_tool_call',call_id:b},{type:'function_call',call_id:'valid'}]};
 const result=normalizeCallIds(original);
 assert.equal(result.input[0].call_id,result.input[1].call_id);
 assert.notEqual(result.input[0].call_id,result.input[2].call_id);
 assert.ok(result.input.every(x=>x.call_id.length<=64));assert.equal(result.input[3].call_id,'valid');
 assert.equal(original.input[0].call_id.length,551);assert.deepEqual(normalizeCallIds(result),result);
 assert.deepEqual(normalizeCallIds(original),result);
});
test('Worker Web Crypto mapping matches desktop SHA-256 call IDs',async()=>{
 const id='x'.repeat(551);
 const body={input:[{type:'function_call',call_id:id},{type:'function_call_output',call_id:id}]};
 assert.deepEqual(await normalizeCallIdsWeb(body),normalizeCallIds(body));
});
test('desktop relay repairs Responses history before upstream submission',async()=>{
 let seen;const relay=await startCloudRelay(async(url,init)=>{seen=JSON.parse(init.body.toString());return Response.json({ok:true});});
 try{const r=await fetch(relay.url+'/api/agent/v1/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:[{type:'function_call',call_id:'a'.repeat(551)},{type:'function_call_output',call_id:'a'.repeat(551)}]})});
 assert.equal(r.status,200);assert.ok(seen.input[0].call_id.length<=64);assert.equal(seen.input[0].call_id,seen.input[1].call_id);
 }finally{relay.close();}
});
