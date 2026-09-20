export function conversationDay(timestamp, now=Date.now()) {
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) return '历史记录';
  const date=new Date(timestamp), today=new Date(now), yesterday=new Date(now);
  yesterday.setDate(yesterday.getDate()-1);
  const key=d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if(key(date)===key(today))return '今天';
  if(key(date)===key(yesterday))return '昨天';
  return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
}
export const nearConversationBottom=(height,top,viewport)=>height-top-viewport<=64;
const viewports=new WeakMap();
export function conversationViewport(log) {
  if(viewports.has(log))return viewports.get(log);
  const button=document.createElement('button');button.type='button';button.className='conversation-latest';button.textContent='回到最新';button.hidden=true;button.setAttribute('aria-label','回到对话最新消息');document.body.append(button);
  let following=true,anchor=null,lastTop=log.scrollTop;
  const atBottom=()=>nearConversationBottom(log.scrollHeight,log.scrollTop,log.clientHeight);
  const readAnchor=()=>{
    const top=log.getBoundingClientRect().top;
    const node=[...log.children].find(child=>child.dataset.chatKey&&child.getBoundingClientRect().bottom>top+1);
    return node?{key:node.dataset.chatKey,offset:node.getBoundingClientRect().top-top}:null;
  };
  function updateButton(){
    const rect=log.getBoundingClientRect();button.hidden=!log.clientHeight||log.hidden||atBottom();
    button.style.top=Math.max(rect.top,rect.bottom-44)+'px';button.style.left=Math.max(rect.left,rect.right-116)+'px';
  }
  function capture(){return {top:log.scrollTop,atBottom:following,anchor:readAnchor()};}
  function restore(snapshot,{latest=false}={}){
    if(!log.clientHeight){updateButton();return;}
    following=latest||snapshot.atBottom;
    if(following)log.scrollTop=log.scrollHeight;
    else {
      const node=snapshot.anchor&&[...log.children].find(child=>child.dataset.chatKey===snapshot.anchor.key);
      log.scrollTop=node?log.scrollTop+node.getBoundingClientRect().top-log.getBoundingClientRect().top-snapshot.anchor.offset:snapshot.top;
    }
    lastTop=log.scrollTop;anchor=readAnchor();updateButton();
    observer.disconnect();observer.observe(log,{box:'border-box'});for(const child of log.children)observer.observe(child,{box:'border-box'});
  }
  const observer=new ResizeObserver(()=>{
    if(!log.clientHeight){updateButton();return;}
    if(following)log.scrollTop=log.scrollHeight;
    else if(anchor){const node=[...log.children].find(child=>child.dataset.chatKey===anchor.key);if(node)log.scrollTop+=node.getBoundingClientRect().top-log.getBoundingClientRect().top-anchor.offset;}
    lastTop=log.scrollTop;anchor=readAnchor();updateButton();
  });
  log.addEventListener('click',event=>{if(event.target.closest?.('summary')){following=false;anchor=readAnchor();}},true);
  log.addEventListener('scroll',()=>{if(Math.abs(log.scrollTop-lastTop)>.5){following=atBottom();lastTop=log.scrollTop;anchor=readAnchor();}updateButton();},{passive:true});
  button.onclick=()=>restore({atBottom:true},{latest:true});
  window.addEventListener('resize',updateButton);
  const viewport={capture,restore,latest:()=>button.click()};viewports.set(log,viewport);return viewport;
}
