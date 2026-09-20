import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeMembership,storeUser,getUser} from '../apps/client/auth.js';
test('membership network failure never grants local entitlement; confirmed schedule keeps current tier',async()=>{
 const previousFetch=globalThis.fetch,previousStorage=globalThis.localStorage;
 const data=new Map();globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
 const user={id:'fixture',isVip:true,membershipTier:'yearly',vipExpiresAt:Date.now()+86400000,concurrencyLimit:4,quotaBalance:100};storeUser(user);
 try{
  globalThis.fetch=async()=>{throw Error('offline');};
  await assert.rejects(upgradeMembership(),/offline/);assert.deepEqual(getUser(),user);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,error:'服务未确认'}),{status:503});
  await assert.rejects(upgradeMembership(),/服务未确认/);assert.deepEqual(getUser(),user);
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:true,scheduled:true,isVip:true,membershipTier:'yearly',vipExpiresAt:user.vipExpiresAt,concurrencyLimit:4,newBalance:100,pendingMembership:{tier:'monthly',effectiveAt:user.vipExpiresAt+86400000}}));
  await upgradeMembership({tier:'monthly'});assert.equal(getUser().membershipTier,'yearly');assert.equal(getUser().pendingMembership.tier,'monthly');assert.equal(getUser().quotaBalance,100);
 }finally{globalThis.fetch=previousFetch;globalThis.localStorage=previousStorage;}
});
