import test from 'node:test';
import assert from 'node:assert/strict';
import {disclosureState,bindExecutionDisclosure} from '../apps/client/execution-disclosure.js';
test('execution stays expanded while running and collapses only once on completion',()=>{
 assert.equal(disclosureState('task1',true).open,true);
 assert.equal(disclosureState('task1',true).open,true);
 const completed=disclosureState('task1',false);assert.equal(completed.open,false);
 completed.open=true;assert.equal(disclosureState('task1',false).open,true);
});
test('manual summary click survives replacing the DOM, while nested clicks do not toggle parent',()=>{
 const make=()=>({open:false,addEventListener(_name,fn){this.click=fn;}});
 const panel=make();bindExecutionDisclosure(panel,'task2',false);
 panel.click({target:{closest:()=>({parentElement:panel})},preventDefault(){}});assert.equal(panel.open,true);
 const replacement=make();bindExecutionDisclosure(replacement,'task2',false);assert.equal(replacement.open,true);
 replacement.click({target:{closest:()=>({parentElement:{}})},preventDefault(){throw Error('nested click intercepted');}});assert.equal(replacement.open,true);
});
