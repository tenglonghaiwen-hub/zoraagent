const DAY=86400000,ZONE=8*3600000;
export const plans={monthly:{rank:1,days:30,gift:50,concurrency:2},quarterly:{rank:2,days:90,gift:200,concurrency:3},yearly:{rank:3,days:365,gift:1000,concurrency:4},lifetime:{rank:4,days:-1,gift:3000,concurrency:4}};
const fail=(message,status=409)=>Object.assign(Error(message),{status});
export const nextMembershipDay=expiry=>(Math.floor((expiry+ZONE)/DAY)+1)*DAY-ZONE;
function currentTier(user,state){return user.vipExpiresAt===-1?'lifetime':state?.tier||({2:'monthly',3:'quarterly',4:'yearly'})[user.concurrencyLimit]||null;}
const selectUser=db=>db.prepare('SELECT id, is_vip as isVip, vip_expires_at as vipExpiresAt, concurrency_limit as concurrencyLimit, quota_balance as quotaBalance FROM users WHERE id = ?');

export async function membershipProfile(db,user,now=Date.now()){
 const snapshot=()=>db.prepare(`SELECT u.is_vip AS isVip,u.vip_expires_at AS vipExpiresAt,u.concurrency_limit AS concurrencyLimit,u.quota_balance AS quotaBalance,s.tier,s.revision,s.pending_tier,s.effective_at,s.pending_days FROM users u LEFT JOIN membership_state s ON s.user_id=u.id WHERE u.id=?`).bind(user.id).first();
 let state=await snapshot();
 const sync=()=>{for(const key of ['isVip','vipExpiresAt','concurrencyLimit','quotaBalance'])user[key]=state[key];};
 sync();
 if(state?.pending_tier&&state.effective_at<=now){
  // D1 batch is transactional: consume the pending grant once, before serving protected requests.
  await db.batch([
   db.prepare(`INSERT INTO usage_logs(id,user_id,resource_type,quota_cost,request_id,created_at) SELECT ?,user_id,'topup',-pending_gift,last_request_id,? FROM membership_state WHERE user_id=? AND pending_tier IS NOT NULL AND effective_at<=?`).bind(crypto.randomUUID(),now,user.id,now),
   db.prepare(`UPDATE users SET is_vip=1, vip_expires_at=(SELECT effective_at+pending_days*86400000 FROM membership_state WHERE user_id=?), concurrency_limit=(SELECT pending_concurrency FROM membership_state WHERE user_id=?), quota_balance=quota_balance+(SELECT pending_gift FROM membership_state WHERE user_id=?), updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM membership_state WHERE user_id=? AND pending_tier IS NOT NULL AND effective_at<=?)`).bind(user.id,user.id,user.id,now,user.id,user.id,now),
   db.prepare('UPDATE membership_state SET tier=pending_tier,pending_tier=NULL,effective_at=NULL,pending_days=NULL,pending_gift=NULL,pending_concurrency=NULL,revision=revision+1 WHERE user_id=? AND pending_tier IS NOT NULL AND effective_at<=?').bind(user.id,now),
  ]);
  state=await snapshot();sync();
 }
 return Object.assign(user,{membershipTier:currentTier(user,state),membershipScheduling:true,membershipRevision:state.revision||0,
  pendingMembership:state?.pending_tier?{tier:state.pending_tier,effectiveAt:state.effective_at,days:state.pending_days}:null});
}

export async function changeMembership(db,userId,{tier,requestId},now=Date.now()){
 if(!plans[tier]||!/^[-\w]{16,100}$/.test(requestId||''))throw fail('套餐或请求编号无效',400);
 const saved=await db.prepare('SELECT result_json FROM membership_orders WHERE user_id=? AND request_id=?').bind(userId,requestId).first();
 if(saved){const result=JSON.parse(saved.result_json);if(result.tier!==tier)throw fail('请求编号已用于其他套餐');return result;}
 const raw=await selectUser(db).bind(userId).first();if(!raw)throw fail('用户不存在',404);
 const user=await membershipProfile(db,raw,now),plan=plans[tier];
 if(user.pendingMembership)throw fail('已有待生效的降级套餐，请勿重复购买');
 const active=!!user.isVip&&(user.vipExpiresAt===-1||user.vipExpiresAt>now||user.vipExpiresAt===0);
 if(active&&user.vipExpiresAt===-1)throw fail('终身会员无需续费，也不能降级');
 const oldRank=active?(plans[user.membershipTier]?.rank||0):0;
 const downgrade=oldRank>plan.rank;
 if(downgrade&&!(user.vipExpiresAt>now))throw fail('当前会员没有可确认的到期日期，暂不能预约降级');
 const effectiveAt=downgrade?nextMembershipDay(user.vipExpiresAt):now;
 const expires=downgrade?user.vipExpiresAt:plan.days===-1?-1:Math.max(now,active?user.vipExpiresAt:0)+plan.days*DAY;
 await db.prepare('INSERT INTO membership_state(user_id,tier) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING').bind(userId,user.membershipTier).run();
 const state={revision:user.membershipRevision};
 const result={ok:true,userId,tier,action:downgrade?'downgrade':oldRank===plan.rank?'renew':'purchase',scheduled:downgrade,
  isVip:!!user.isVip||!downgrade,vipExpiresAt:expires,concurrencyLimit:downgrade?user.concurrencyLimit:plan.concurrency,
  newBalance:user.quotaBalance+(downgrade?0:plan.gift),membershipTier:downgrade?user.membershipTier:tier,membershipScheduling:true,membershipRevision:state.revision||0,
  pendingMembership:downgrade?{tier,effectiveAt,days:plan.days}:null,giftQuota:downgrade?0:plan.gift,effectiveAt};
 const updated=await db.batch([
  db.prepare('UPDATE membership_state SET tier=?,pending_tier=?,effective_at=?,pending_days=?,pending_gift=?,pending_concurrency=?,last_request_id=?,revision=revision+1 WHERE user_id=? AND revision=? AND pending_tier IS NULL AND NOT EXISTS(SELECT 1 FROM membership_orders WHERE user_id=? AND request_id=?)').bind(result.membershipTier,downgrade?tier:null,downgrade?effectiveAt:null,downgrade?plan.days:null,downgrade?plan.gift:null,downgrade?plan.concurrency:null,requestId,userId,state.revision,userId,requestId),
  db.prepare('UPDATE users SET is_vip=?,vip_expires_at=?,concurrency_limit=?,quota_balance=quota_balance+?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM membership_state WHERE user_id=? AND last_request_id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM membership_orders WHERE user_id=? AND request_id=?)').bind(result.isVip?1:0,result.vipExpiresAt,result.concurrencyLimit,result.giftQuota,now,userId,userId,requestId,state.revision+1,userId,requestId),
  db.prepare(`INSERT INTO usage_logs(id,user_id,resource_type,quota_cost,request_id,created_at) SELECT ?,?,'topup',?,?,? WHERE ? > 0 AND EXISTS(SELECT 1 FROM membership_state WHERE user_id=? AND last_request_id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM membership_orders WHERE user_id=? AND request_id=?)`).bind(crypto.randomUUID(),userId,-result.giftQuota,requestId,now,result.giftQuota,userId,requestId,state.revision+1,userId,requestId),
  db.prepare('INSERT INTO membership_orders(user_id,request_id,result_json) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM membership_state WHERE user_id=? AND last_request_id=? AND revision=?) ON CONFLICT(user_id,request_id) DO NOTHING').bind(userId,requestId,JSON.stringify(result),userId,requestId,state.revision+1),
 ]);
 if(!updated[0].meta.changes){
  const retry=await db.prepare('SELECT result_json FROM membership_orders WHERE user_id=? AND request_id=?').bind(userId,requestId).first();
  if(retry){const prior=JSON.parse(retry.result_json);if(prior.tier===tier)return prior;}
  throw fail('会员状态已变化，请刷新后重新确认');
 }
 return result;
}
