// Native picker anchors in this Electron build omit transformed canvas coordinates.
// Position its top-layer popup from the select's actual viewport rectangle instead.
const root=document.getElementById('canvas-workspace');
let tracked=null,frame=0;
function position(select){
 const rect=select.getBoundingClientRect();
 const values={'--canvas-picker-left':`${rect.left}px`,'--canvas-picker-top':`${rect.bottom+6}px`,'--canvas-picker-room':`${Math.max(48,innerHeight-rect.bottom-18)}px`};
 for(const [name,value] of Object.entries(values))if(select.style.getPropertyValue(name)!==value)select.style.setProperty(name,value);
}
function follow(){
 frame=0;
 if(!tracked?.isConnected||!tracked.matches(':open')){tracked=null;return;}
 position(tracked);frame=requestAnimationFrame(follow);
}
function prepare(event){
 const select=event.target.closest?.('select:not([hidden])');
 if(!select||select.disabled)return;
 position(select);tracked=select;
 cancelAnimationFrame(frame);frame=requestAnimationFrame(follow);
}
root?.addEventListener('pointerdown',prepare,true);
root?.addEventListener('keydown',prepare,true);
root?.addEventListener('focusin',prepare,true);
