import test from 'node:test';
import assert from 'node:assert/strict';
import {selectH3} from '../packages/duoyuanx/h3-routing.mjs';
const image={type:'image/png'},video={type:'video/mp4'};
test('H3 routing distinguishes frame roles from reference roles without dropping media',()=>{
 for(const [videoMode,references,ratio,route] of [['t2v',[],'9:16','/v2/video_generation'],['i2v',[image],'adaptive','/v2/video_generation'],['fl',[image,image],'adaptive','/v2/video_generation'],['ref',[image,image,image],'9:16','/v2/video_generation'],['ref',[video],'9:16','/v2/video_generation']]){const r=selectH3({videoMode,references,ratio});assert(r.ok);assert.equal(r.selected.apiRoute,route);}
 for(const d of [{videoMode:'i2v',references:[image,video],ratio:'adaptive'},{videoMode:'i2v',references:[image],ratio:'9:16'},{videoMode:'ref',references:[]},{videoMode:'t2v',references:[image]},{videoMode:'ref',references:[image],apiRoute:'/v1/videos'},{videoMode:'t2v',references:[],ratio:'adaptive'}])assert.equal(selectH3(d).ok,false);
});
