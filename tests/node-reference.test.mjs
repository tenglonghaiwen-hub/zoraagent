import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDraft} from '../packages/contracts/domain.mjs';
import {getModels} from '../packages/duoyuanx/catalog.mjs';
for(const key of ['DUOYUANX_API_KEY','ZORA_AGENT_API_KEY','RUNNINGHUB_API_KEY'])process.env[key]='';
for(const key of ['ZORA_AGENT_ENABLED','RUNNINGHUB_ENABLED','OM_ENABLED','OM_AUTO_SIDECAR'])process.env[key]='false';
const {packGenerateRequest}=await import('../apps/server/server.mjs');
test('references survive validation and packing for image and video models',()=>{
 const reference={type:'image/png',contentUrl:'data:image/png;base64,AA=='};
 const draft={modelId:'grok-video-3',prompt:'移动镜头',count:1,concurrency:1,ratio:'16:9',resolution:'720P',duration:5,videoMode:'i2v',references:[reference]};
 const valid=validateDraft(draft);assert.equal(valid.ok,true);assert.deepEqual(valid.draft.references,[reference]);
 assert.deepEqual(packGenerateRequest(valid.draft).fields.input_reference,[reference.contentUrl]);
 const gemini=getModels().find(m=>m.kind==='image'&&m.route.includes('generateContent'));
 assert(gemini);const packed=packGenerateRequest({...draft,modelId:gemini.id,videoMode:'i2i'},gemini);assert.equal(packed.body.contents[0].parts[1].inlineData.data,'AA==');
 assert.throws(()=>packGenerateRequest({...draft,videoMode:'t2v'}),/参考生成模式/);
 assert.equal(packGenerateRequest({...draft,references:[reference,reference]}).fields.input_reference.length,2);
 assert.equal(validateDraft({...draft,references:[{contentUrl:'javascript:alert(1)'}]}).ok,false);
});
