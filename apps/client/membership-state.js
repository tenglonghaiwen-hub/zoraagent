export const membershipRanks={monthly:1,quarterly:2,yearly:3,lifetime:4};
export function membershipState(user,now=Date.now()){
 const expires=Number(user?.vipExpiresAt)||0;
 const active=!!user?.isVip&&(expires===-1||expires>now||expires===0);
 const explicit=user?.membershipTier||user?.vipTier||user?.tier;
 const tier=expires===-1?'lifetime':membershipRanks[explicit]?explicit:
   ({2:'monthly',3:'quarterly',4:'yearly'})[Number(user?.concurrencyLimit)]||null;
 return {active,tier,rank:active?(membershipRanks[tier]||0):0,expires,
  inferred:!membershipRanks[explicit]&&expires!==-1,pending:user?.pendingMembership||null};
}
export function membershipAction(user,tier,now=Date.now()){
 const state=membershipState(user,now),rank=membershipRanks[tier];
 if(!rank)return {kind:'unavailable',label:'暂不可选',disabled:true};
 if(state.pending)return {kind:'pending',label:state.pending.tier===tier?'已预约降级':'已有待生效套餐',disabled:true};
 if(state.active&&state.rank===4)return {kind:'owned',label:tier==='lifetime'?'已拥有':'已享终身权益',disabled:true};
 if(!state.active)return {kind:'purchase',label:'购买',disabled:false};
 if(rank===state.rank)return {kind:'renew',label:'续费',disabled:false};
 if(state.rank&&rank<state.rank)return {kind:'downgrade',label:'预约降级',disabled:user?.membershipScheduling!==true||state.expires<=now};
 return {kind:'purchase',label:'购买',disabled:false};
}

export function renderMembershipActions(user,root=document){
 const state=membershipState(user);
 for(const card of root.querySelectorAll('.membership-tier-card')){
  const action=membershipAction(user,card.dataset.tier);
  card.dataset.action=action.kind;card.disabled=action.disabled;
  card.setAttribute('role','radio');card.setAttribute('aria-checked',String(card.classList.contains('active')));
  let status=card.querySelector('.tier-action-label');
  if(!status){status=root.createElement('span');status.className='tier-action-label';card.append(status);}
  const selected=card.classList.contains('active');
  card.tabIndex=selected?0:-1;
  status.textContent=(selected?'✓ 已选择 · ':'')+action.label;
  card.setAttribute('aria-label',`${card.querySelector('.tier-name')?.textContent||card.dataset.tier}，${action.label}${selected?'，已选择':''}`);
 }
 const selected=root.querySelector('.membership-tier-card.active');
 const action=membershipAction(user,selected?.dataset.tier);
 const button=root.querySelector('#btn-membership-checkout');
 if(button){button.textContent=action.disabled?action.label:`${action.label}所选套餐 · 前往收银台`;button.disabled=action.disabled;}
 let note=root.querySelector('#membership-action-note');
 if(!note){note=root.createElement('p');note.id='membership-action-note';note.setAttribute('role','status');root.querySelector('.checkout-summary-col')?.append(note);}
 const effectiveAt=state.pending?.effectiveAt||(state.expires>0?(Math.floor((state.expires+28800000)/86400000)+1)*86400000-28800000:0);
 const date=effectiveAt?new Date(effectiveAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'';
 note.textContent=state.pending?`已预约降级，${date}（北京时间）生效。现有权益保留至到期，赠送积分届时到账。`:action.kind==='downgrade'?(action.disabled?'尚未取得支持预约降级的会员状态或明确到期时间，请刷新后重试。':`降级将在 ${date}（北京时间）生效，当前权益保留至到期，赠送积分届时到账。`):action.kind==='renew'?'续费延长当前会员有效期。':action.kind==='owned'?'终身会员无需重复购买或续费。':'请核对套餐、权益和金额后确认。';
 return state;
}
