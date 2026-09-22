export function imageRequest(body) {
 if(typeof body.prompt!=='string'||!body.prompt.trim())throw Object.assign(Error('请填写创作需求'),{status:400});
 const count=Number(body.count ?? body.n ?? 1);
 if(!Number.isInteger(count)||count<1||count>4)throw Object.assign(Error('当前 gpt-image-2 渠道单次生成数量需为 1–4，不会自动拆分'),{status:400});
 let size=body.size;
 if(!size){
  const [rw,rh]=String(body.ratio||'1:1').split(':').map(Number);
  if(!(rw>0&&rh>0)||rw/rh<1/3||rw/rh>3)throw Object.assign(Error('图片比例无效'),{status:400});
  const longest=body.resolution==='4K'?3840:body.resolution==='2K'?2048:1024;
  let w=rw>=rh?longest:longest*rw/rh,h=rh>=rw?longest:longest*rh/rw;
  const scale=Math.max(1,Math.sqrt(655360/(w*h)));
  w=Math.ceil(w*scale/16)*16;h=Math.ceil(h*scale/16)*16;
  if(w*h>8294400){const s=Math.sqrt(8294400/(w*h));w=Math.floor(w*s/16)*16;h=Math.floor(h*s/16)*16;}
  size=w+'x'+h;
 }
 const references=body.references||[];
 if(references.some(r=>!r.type?.startsWith('image/')||!r.contentUrl))throw Object.assign(Error('参考图格式无效'),{status:400});
 const image=references.map(r=>r.contentUrl.startsWith('data:')?r.contentUrl.split(',')[1]:r.contentUrl);
 return {model:body.model||body.modelId,prompt:body.prompt,n:count,size,response_format:'url',
  ...(image.length?{image}:body.image?{image:body.image}:{}),
  ...Object.fromEntries(['quality','style','background','output_format','output_compression','moderation','watermark'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]))};
}
