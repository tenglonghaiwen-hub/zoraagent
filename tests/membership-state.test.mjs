import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipState,membershipAction} from '../apps/client/membership-state.js';
const now=Date.now(),member=tier=>({isVip:true,membershipScheduling:true,membershipTier:tier,vipExpiresAt:now+86400000});
test('current tier renews, higher tier buys, lower tier schedules downgrade',()=>{
 const user=member('quarterly');
 assert.equal(membershipAction(user,'quarterly',now).label,'续费');
 assert.equal(membershipAction(user,'yearly',now).label,'购买');
 assert.equal(membershipAction(user,'monthly',now).kind,'downgrade');
});
test('expired membership buys again and lifetime never invites duplicate purchase',()=>{
 assert.equal(membershipAction({...member('yearly'),vipExpiresAt:now-1},'yearly',now).kind,'purchase');
 for(const tier of ['monthly','quarterly','yearly','lifetime'])assert(membershipAction({isVip:true,vipExpiresAt:-1},tier,now).disabled);
});
test('explicit tier overrides concurrency; legacy profile uses entitlement rather than remaining duration',()=>{
 assert.equal(membershipState({...member('monthly'),concurrencyLimit:4},now).tier,'monthly');
 assert.equal(membershipState({isVip:true,concurrencyLimit:3,vipExpiresAt:now+86400000},now).tier,'quarterly');
 assert.equal(membershipState({isVip:true,concurrencyLimit:1,vipExpiresAt:now+365*86400000},now).tier,null);
});
test('scheduled change is shown without pretending it is already active',()=>{
 const user={...member('yearly'),pendingMembership:{tier:'monthly',effectiveAt:now+86400000}};
 assert.equal(membershipState(user,now).tier,'yearly');
 assert.equal(membershipAction(user,'monthly',now).label,'已预约降级');
});

test('old backend and unknown expiry cannot execute a downgrade',()=>{
 assert(membershipAction({...member('yearly'),membershipScheduling:false},'monthly',now).disabled);
 assert(membershipAction({...member('yearly'),vipExpiresAt:0},'monthly',now).disabled);
 assert.equal(membershipAction(member('yearly'),'monthly',now).disabled,false);
});
