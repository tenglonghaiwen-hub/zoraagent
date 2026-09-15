import test from 'node:test';
import assert from 'node:assert/strict';
import {editContextItems} from '../apps/desktop/main/edit-context-menu.mjs';
test('native editing actions preserve order and only enable paste for editable targets',()=>{
 const actions=[],contents={copy:()=>actions.push('copy'),paste:()=>actions.push('paste'),selectAll:()=>actions.push('all')};
 const items=editContextItems(contents,{isEditable:true,editFlags:{canCopy:true,canPaste:true}});
 items.find(i=>i.label==='全选复制').click();assert.deepEqual(actions,['all','copy']);
 assert.equal(items.find(i=>i.label==='粘贴').enabled,true);
 assert.equal(editContextItems(contents,{isEditable:false,editFlags:{canPaste:true}})[1].enabled,false);
});
