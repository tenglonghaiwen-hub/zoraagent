import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import initSqlJs from 'sql.js';
import {changeMembership,membershipProfile,nextMembershipDay} from '../apps/cloudflare-worker/src/membership-lifecycle.mjs';
const SQL=await initSqlJs(),DAY=86400000,now=Date.parse('2026-09-20T04:00:00Z');
function fixture({expiry=now+10*DAY,concurrency=4,isVip=1}={}){
 const raw=new SQL.Database();raw.run(fs.readFileSync('apps/cloudflare-worker/schema.sql','utf8'));
 raw.run('INSERT INTO users(id,email,password_hash,quota_balance,is_vip,vip_expires_at,concurrency_limit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',['test','test@example.invalid','test',100,isVip,expiry,concurrency,now,now]);
 const db={prepare(sql){return {args:[],bind(...args){this.args=args;return this;},async first(){const q=raw.prepare(sql);try{q.bind(this.args);return q.step()?q.getAsObject():null;}finally{q.free();}},run(){raw.run(sql,this.args);return {meta:{changes:raw.getRowsModified()}};}};},async batch(items){raw.run('BEGIN');try{const results=[];for(const q of items)results.push(q.run());raw.run('COMMIT');return results;}catch(e){raw.run('ROLLBACK');throw e;}}};
 return {db,raw,user:()=>db.prepare('SELECT id,is_vip as isVip,vip_expires_at as vipExpiresAt,concurrency_limit as concurrencyLimit,quota_balance as quotaBalance FROM users WHERE id=?').bind('test').first()};
}
const request=(tier,requestId=crypto.randomUUID())=>({tier,requestId});
test('downgrade keeps current entitlement and grants the lower tier once on the following calendar day',async()=>{
 const f=fixture(),order=request('monthly');const result=await changeMembership(f.db,'test',order,now);
 assert.equal(result.scheduled,true);assert.equal(result.giftQuota,0);assert.equal(result.concurrencyLimit,4);assert.equal(result.newBalance,100);
 assert.equal(new Date(result.effectiveAt).toISOString(),'2026-09-30T16:00:00.000Z');
 const before=await membershipProfile(f.db,await f.user(),result.effectiveAt-1);assert.equal(before.concurrencyLimit,4);assert.equal(before.pendingMembership.tier,'monthly');
 await assert.rejects(changeMembership(f.db,'test',request('yearly'),now),/待生效/);
 assert.deepEqual(await changeMembership(f.db,'test',order,now),result);
 const due=await membershipProfile(f.db,await f.user(),result.effectiveAt);assert.equal(due.concurrencyLimit,2);assert.equal(due.quotaBalance,150);assert.equal(due.vipExpiresAt,result.effectiveAt+30*DAY);assert.equal(due.pendingMembership,null);
 const again=await membershipProfile(f.db,await f.user(),result.effectiveAt+1);assert.equal(again.quotaBalance,150);
 assert.equal((await f.db.prepare('SELECT count(*) as n FROM usage_logs').first()).n,1);
});
test('renew extends expiry, concurrent retry is idempotent, a reused key cannot change tier',async()=>{
 const f=fixture({concurrency:2}),order=request('monthly');
 const results=await Promise.all([changeMembership(f.db,'test',order,now),changeMembership(f.db,'test',order,now)]);
 assert.deepEqual(results[0],results[1]);assert.equal(results[0].action,'renew');assert.equal((await f.user()).quotaBalance,150);assert.equal((await f.user()).vipExpiresAt,now+40*DAY);
 await assert.rejects(changeMembership(f.db,'test',{...order,tier:'yearly'},now),/其他套餐/);
});
test('higher tier buys immediately; expired membership does not schedule downgrade',async()=>{
 const f=fixture({concurrency:2});const result=await changeMembership(f.db,'test',request('quarterly'),now);assert.equal(result.action,'purchase');assert.equal(result.concurrencyLimit,3);
 const expired=fixture({expiry:now-1});const fresh=await changeMembership(expired.db,'test',request('monthly'),now);assert.equal(fresh.scheduled,false);assert.equal(fresh.vipExpiresAt,now+30*DAY);
});
test('lifetime disallows renewal and downgrade; next-day timing uses Shanghai midnight',async()=>{
 const f=fixture({expiry:-1});await assert.rejects(changeMembership(f.db,'test',request('monthly'),now),/终身会员/);await assert.rejects(changeMembership(f.db,'test',request('lifetime'),now),/终身会员/);
 assert.equal(new Date(nextMembershipDay(Date.parse('2028-02-29T15:59:59Z'))).toISOString(),'2028-02-29T16:00:00.000Z');
 assert.equal(new Date(nextMembershipDay(Date.parse('2026-12-31T16:00:00Z'))).toISOString(),'2027-01-01T16:00:00.000Z');
});

test('authenticated endpoints expose pending state and keep current rights with the scheduling flag',async()=>{
 const {default:worker}=await import('../apps/cloudflare-worker/src/index.mjs');
 const {signJwt}=await import('../apps/cloudflare-worker/src/auth.mjs');
 const f=fixture({expiry:Date.now()+10*DAY});
 const env={DB:f.db,JWT_SECRET:'isolated-test-secret',MEMBERSHIP_SCHEDULING:'true'};
 const token=await signJwt({userId:'test'},env.JWT_SECRET);
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const response=await worker.fetch(new Request('https://fixture.invalid/api/user/membership/upgrade',{method:'POST',headers,body:JSON.stringify(request('monthly'))}),env,{});
 assert.equal(response.status,200);assert.equal((await response.json()).scheduled,true);
 const profile=await worker.fetch(new Request('https://fixture.invalid/api/auth/me',{headers}),env,{});
 const {user}=await profile.json();assert.equal(user.membershipScheduling,true);assert.equal(user.membershipTier,'yearly');assert.equal(user.pendingMembership.tier,'monthly');assert.equal(user.concurrencyLimit,4);
});
test('independent concurrent orders do not overwrite one another',async()=>{
 const f=fixture({concurrency:2});
 const outcomes=await Promise.allSettled([changeMembership(f.db,'test',request('monthly'),now),changeMembership(f.db,'test',request('monthly'),now)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await f.user()).quotaBalance,150);assert.equal((await f.user()).vipExpiresAt,now+40*DAY);
});
