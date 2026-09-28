import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnimationInvocation as validate} from '../packages/adapters/om-animation-validation.mjs';
import {createToolRunner} from '../packages/agent/tools.mjs';
test('explicit Remotion cannot silently switch to HyperFrames or FFmpeg',()=>{
 assert.throws(()=>validate('hyperframes_compose',{operation:'render_existing'},'使用本地 Remotion'),/禁止替换/);
 assert.throws(()=>validate('video_compose',{operation:'compose'},'使用 Remotion'),/禁止替换/);
 assert.doesNotThrow(()=>validate('video_compose',{operation:'remotion_render'},'使用 Remotion'));
});
test('placeholder and malformed timelines fail before render',()=>{
 const args=cuts=>({operation:'render',edit_decisions:{cuts}});
 assert.throws(()=>validate('hyperframes_compose',args([{type:'text_card',duration:2}])),/时间轴/);
 assert.throws(()=>validate('hyperframes_compose',args([{type:'text_card',in_seconds:0,out_seconds:2}])),/占位/);
 assert.throws(()=>validate('hyperframes_compose',args([{type:'chart',in_seconds:0,out_seconds:2,text:'排名'}])),/不支持/);
 assert.throws(()=>validate('hyperframes_compose',args([{text:'a',in_seconds:0,out_seconds:2},{text:'b',in_seconds:0,out_seconds:3}])),/覆盖/);
 assert.doesNotThrow(()=>validate('hyperframes_compose',args([{type:'text_card',text:'标题',in_seconds:0,out_seconds:2},{type:'text_card',text:'来源',in_seconds:2,out_seconds:5}])));
});
test('original instruction reaches pipeline and confirmation-first request cannot render',async()=>{
 const calls=[];const userMessage='请先输出数据方案，在数据来源确认并核验后，再生成动画代码。使用 Remotion';
 const runner=createToolRunner({userMessage,callApi:async call=>{calls.push(call);return {ok:true};}});
 await runner('om_prepare_pipeline',{pipelineId:'animated-explainer',instruction:'重写后的简介'});
 assert.equal(calls[0].body.originalInstruction,userMessage);
 const result=await runner('om_execute_tool',{projectId:'test',tool:'video_compose',args:{operation:'remotion_render'}});
 assert.equal(result.ok,false);assert.match(result.error,/等待确认/);assert.equal(calls.length,1);
});
