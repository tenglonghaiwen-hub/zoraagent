export const TT_IMAGE={kind:'image',family:'tt-image',route:'/v1/images/generations',modes:[{id:'t2i',enabled:true},{id:'i2i',enabled:true}],ratios:['1:1','16:9','9:16','4:3','3:4','3:2','2:3','5:4','4:5','2:1','1:2','21:9','9:21'],resolutions:['1K','2K','4K'],maxCount:1};
const invalid=message=>Object.assign(Error(message),{status:400});
export function ttImageSize(ratio='1:1',resolution='1K'){
 const [rw,rh]=String(ratio).split(':').map(Number);
 if(!TT_IMAGE.ratios.includes(ratio)||!TT_IMAGE.resolutions.includes(resolution))throw invalid('TT Image 比例或分辨率无效');
 const longest=resolution==='4K'?3840:resolution==='2K'?2048:1024;
 let w=rw>=rh?longest:longest*rw/rh,h=rh>=rw?longest:longest*rh/rw;
 const scale=Math.max(1,Math.sqrt(655360/(w*h)));
 w=Math.ceil(w*scale/16)*16;h=Math.ceil(h*scale/16)*16;
 if(w*h>8294400){const scale=Math.sqrt(8294400/(w*h));w=Math.floor(w*scale/16)*16;h=Math.floor(h*scale/16)*16;}
 return `${w}x${h}`;
}
export function packTtImage(draft,model){
 if(!draft.prompt?.trim()||draft.prompt.length>32000)throw invalid('TT Image 提示词需为 1–32000 字符');
 if((draft.count??draft.n??1)!==1)throw invalid('TT Image 单次仅支持 1 张');
 const refs=draft.references||[];
 if(refs.length>16||refs.some(r=>!r.type?.startsWith('image/')||!r.contentUrl))throw invalid('TT Image 最多接受 16 张参考图片');
 if(refs.length&&draft.videoMode==='t2i'||!refs.length&&draft.videoMode==='i2i')throw invalid('图片模式与参考素材不一致');
 const body={model:model.id,prompt:draft.prompt,size:ttImageSize(draft.ratio,draft.resolution),n:1,response_format:'url'};
 const options={quality:['auto','low','medium','high','xhigh','max'],background:['opaque','transparent','auto'],output_format:['png','jpeg','webp'],version:['flare','sunburst']};
 for(const [key,values] of Object.entries(options))if(draft[key]!==undefined){if(!values.includes(draft[key]))throw invalid('TT Image 参数无效：'+key);body[key]=draft[key];}
 if(!refs.length)return {method:'POST',path:'/v1/images/generations',contentType:'json',body};
 if(refs.every(r=>/^https?:\/\//.test(r.contentUrl)))return {method:'POST',path:'/v1/images/edits',contentType:'json',body:{...body,images:refs.map(r=>({image_url:r.contentUrl}))}};
 if(refs.some(r=>!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(r.contentUrl)))throw invalid('混合参考图请先将公网图片下载后一起上传；本地图片需为 PNG、JPEG 或 WebP');
 const bytes=refs.map(r=>Math.floor(r.contentUrl.split(',')[1].length*3/4));
 if(bytes.some(n=>n>10*1024*1024)||bytes.reduce((a,b)=>a+b,0)>30*1024*1024)throw invalid('参考图单张不得超过 10MB，合计不得超过 30MB');
 return {method:'POST',path:'/v1/images/edits',contentType:'multipart',fileField:'image[]',fields:{...body,'image[]':refs.map(r=>r.contentUrl)}};
}
