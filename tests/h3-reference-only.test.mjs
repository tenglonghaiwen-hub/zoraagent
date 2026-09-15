import test from 'node:test';
import assert from 'node:assert/strict';
import {selectH3} from '../packages/duoyuanx/h3-routing.mjs';
const image={type:'image/png'},video={type:'video/mp4'};
test('H3 routing distinguishes frame roles from reference roles without dropping media',()=>{
 for(const [videoMode,references,ratio,route] of [['t2v',[],'9:16','/v1/videos'],['i2v',[image],'adaptive','/v1/videos'],['fl',[image,image],'adaptive','/v1/videos'],['ref',[image,image,image],'9:16','/v1/videos'],['ref',[video],'9:16','/v1/videos']]){const r=selectH3({videoMode,references,ratio});assert(r.ok);assert.equal(r.selected.apiRoute,route);}
 for(const d of [{videoMode:'i2v',references:[image,video],ratio:'adaptive'},{videoMode:'i2v',references:[image],ratio:'9:16'},{videoMode:'ref',references:[]},{videoMode:'t2v',references:[image]},{videoMode:'ref',references:[image],apiRoute:'/v2/video_generation'},{videoMode:'t2v',references:[],ratio:'adaptive'}])assert.equal(selectH3(d).ok,false);
});
