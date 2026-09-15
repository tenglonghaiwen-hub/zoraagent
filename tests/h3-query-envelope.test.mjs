import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMediaResults} from '../apps/client/media-results.js';
test('H3 official task envelope handles video success processing and failure',()=>{
 assert.deepEqual(normalizeMediaResults({task:{id:'h3-id',status:'succeeded',content:{url:'https://example.com/video.mp4'}}}),{urls:['https://example.com/video.mp4'],taskIds:[],errors:[]});
 assert.deepEqual(normalizeMediaResults({task:{id:'h3-id',status:'processing'}}).taskIds,['h3-id']);
 assert.deepEqual(normalizeMediaResults({task:{id:'h3-id',status:'failed',error:{message:'upstream failed'}}}).errors,['upstream failed']);
});
