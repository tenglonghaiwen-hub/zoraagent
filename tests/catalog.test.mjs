import test from 'node:test';
import assert from 'node:assert/strict';
import {getModels,getModel,catalogPayload} from '../apps/server/catalog.mjs';
import {validateDraft} from '../packages/contracts/domain.mjs';
test('published catalog has unique enabled IDs and no credential fields',()=>{
  const models=getModels();assert(models.length>0);assert.equal(new Set(models.map(m=>m.id)).size,models.length);
  assert.deepEqual(catalogPayload().models,models);
  for(const m of models){assert.notEqual(m.enabled,false);assert.equal(getModel(m.id).name,m.name);assert(!Object.keys(m).some(k=>/key|secret|token|password/i.test(k)));}
});
test('every media model accepts advertised parameters and rejects tampering',()=>{
  for(const m of getModels().filter(m=>m.kind==='image'||m.kind==='video')){
    const d={modelId:m.id,prompt:'验收',count:1,concurrency:1,ratio:m.ratios[0],resolution:m.resolutions[0],duration:m.fixedSeconds??m.durations?.[0]??m.durationRange?.min};
    if(m.family==='minimax')Object.assign(d,{videoMode:'ref',references:[{type:'video/mp4',contentUrl:'data:video/mp4;base64,AA=='}]});
    assert.equal(validateDraft(d).ok,true,m.id);
    for(const patch of [{count:m.maxCount+1},{concurrency:m.maxConcurrency+1},{ratio:'invalid'},{modelId:'invented'},{prompt:''},{videoMode:'invented'}])assert.equal(validateDraft({...d,...patch}).ok,false,JSON.stringify({id:m.id,patch}));
    if(m.resolutions.length)assert.equal(validateDraft({...d,resolution:'invalid'}).ok,false,m.id);
    if(m.kind==='video')assert.equal(validateDraft({...d,duration:-2}).ok,false,m.id);
    const checked=validateDraft({...d,price:0,apiKey:'not-a-key'});
    assert.equal(checked.draft.price,undefined);assert.equal(checked.draft.apiKey,undefined);
  }
});

