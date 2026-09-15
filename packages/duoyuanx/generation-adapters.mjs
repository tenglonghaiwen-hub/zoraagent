import {selectH3} from './h3-routing.mjs';
import { getModel } from './catalog.mjs';
import {validateRouteSelection} from './route-capabilities.mjs';
function mapExactImageSize(ratio = '1:1', resolution = '1K') {
  const label = String(resolution || '1K').toUpperCase();
  const long = label === '4K' ? 4096 : label === '2K' ? 2048 : 1024;
  const parts = String(ratio || '1:1').split(':').map(Number);
  const rw = parts[0] > 0 ? parts[0] : 1;
  const rh = parts[1] > 0 ? parts[1] : 1;
  let w;
  let h;
  if (rw >= rh) {
    w = long;
    h = Math.max(64, Math.round((long * rh) / rw));
  } else {
    h = long;
    w = Math.max(64, Math.round((long * rw) / rh));
  }
  // keep even-ish dims within bounds
  w = Math.min(4096, Math.max(64, w));
  h = Math.min(4096, Math.max(64, h));
  return `${w}x${h}`;
}

function imageSizeForModel(model, draft) {
  const family = String(model.family || '');
  const id = String(model.id || '');
  if (family === 'gpt-image' || id.startsWith('gpt-image')) {
    let [w,h]=mapExactImageSize(draft.ratio,draft.resolution).split('x').map(Number);
    const scale=Math.max(1,Math.sqrt(655360/(w*h)));
    return [w,h].map(v=>Math.ceil(v*scale/16)*16).join('x');
  }
  if(family==='seedream'||family==='grok-image'){
    const sizes={'1:1':[2048,2048],'4:3':[2304,1728],'3:4':[1728,2304],'16:9':[2560,1440],'9:16':[1440,2560],'3:2':[2496,1664],'2:3':[1664,2496],'21:9':[3024,1296]};
    const dimensions=sizes[draft.ratio];
    const scale=draft.resolution==='4K'?2:draft.resolution==='1K'?0.5:1;
    if(dimensions)return dimensions.map(v=>Math.round(v*scale)).join('x');
  }
  return mapExactImageSize(draft.ratio,draft.resolution);
}

/** Pack a validated draft into an upstream-shaped request descriptor (no network). */
export function packGenerateRequest(draft, model = getModel(draft.modelId)) {
  const selection=validateRouteSelection(draft,model);
  if(!selection.ok)throw Error(selection.error);
  const packed=packAdapterRequest(draft,model);
  if(selection.selected&&packed.path!==selection.selected.apiRoute)throw Error('适配器实际路由与明确选择不一致，未提交生成');
  return packed;
}

function packAdapterRequest(draft, model) {
  if (!model) throw new Error('模型不存在');
  const route = model.route || (model.kind === 'video' ? '/v1/videos' : '/v1/images/generations');
  const refs=draft.references||[];
  const images=refs.filter(r=>r.type?.startsWith('image/')).map(r=>r.contentUrl),videos=refs.filter(r=>r.type?.startsWith('video/')).map(r=>r.contentUrl),audios=refs.filter(r=>r.type?.startsWith('audio/')).map(r=>r.contentUrl);
  const json=(body,path=route)=>({method:'POST',path,contentType:'json',body,queryRoute:model.queryRoute});
  const mode=draft.videoMode;
  if(refs.length&&['t2i','t2v'].includes(mode))throw Error('已有参考素材，请选择参考生成模式');
  if(['i2i','i2v','fl','v2v'].includes(mode)&&!refs.length)throw Error('当前模式需要参考素材');
  if(mode==='fl'&&images.length!==2)throw Error('首尾帧需要按顺序接入两张图片');
  if(model.kind==='image'&&videos.length+audios.length)throw Error('图片模型只接受参考图片');
  if(model.kind==='image'&&model.family!=='gemini-image'){
    if(model.family==='qwen-image'){
      if(images.length>3)throw Error('Qwen 最多支持 3 张参考图片');
      return json({model:model.id,input:{messages:[{role:'user',content:[...images.map(image=>({image})),{text:draft.prompt}]}]},parameters:{size:mapExactImageSize(draft.ratio,draft.resolution).replace('x','*'),n:draft.count}},images.length?'/v1/images/edits':route);
    }
    const image=images.map(url=>url.startsWith('data:')?url.split(',')[1]:url);
    return json({model:model.id,prompt:draft.prompt,size:imageSizeForModel(model,draft),n:draft.count,response_format:'url',...(image.length?{image}:{})});
  }
  if(model.family==='grok-video'){
    if(videos.length+audios.length)throw Error('Grok 视频当前入口只接受图片参考');
    return {method:'POST',path:route,contentType:'multipart',fileField:'input_reference',fields:{model:model.id,prompt:draft.prompt,aspect_ratio:draft.ratio,size:draft.resolution,seconds:String(draft.duration),...(images.length?{input_reference:images}:{})},queryRoute:model.queryRoute};
  }
  if(model.family==='veo'){
    if(videos.length+audios.length)throw Error('Veo 当前生成入口只接受图片');
    if(images.length&&draft.ratio!=='16:9')throw Error('Veo 参考生成需选择 16:9');
    const dimensions=draft.resolution==='1080P'?[1920,1080]:[1280,720];const ratio=(draft.ratio==='9:16'?dimensions.reverse():dimensions).join('x');
    return json({model:model.id,prompt:draft.prompt,size:ratio,seconds:String(draft.duration),metadata:{output_config:{aspect_ratio:draft.ratio,resolution:draft.resolution}},...(images.length?{input_reference:images}:{})});
  }
  if(model.family==='minimax'){
    if(draft.prompt.length>7000)throw Error('MiniMax 提示词最多 7000 字符');
    const selected=selectH3(draft);
    if(!selected.ok)throw Error(selected.error);
    if(images.length>9||videos.length>3||audios.length>3)throw Error('H3 参考图最多9张，参考视频和音频分别最多3个');
    return {method:'POST',path:selected.selected.apiRoute,authorizationScheme:'raw',contentType:'json',body:{model:model.id,prompt:draft.prompt,duration:draft.duration,size:draft.resolution,...(images.length?{images}:{}),metadata:{ratio:draft.ratio||'adaptive',...(videos.length?{reference_videos:videos}:{}),...(audios.length?{reference_audios:audios}:{}),aigc_watermark:false}},queryRoute:selected.queryRoute};
  }
  if(model.family==='omni'){
    if(audios.length||images.length>5||videos.length>1||(videos.length&&model.id!=='omni-fast-v2v'))throw Error('Omni 参考素材类型或数量不支持');
    const media=mode==='fl'?{first_image_url:images[0],last_image_url:images[1]}:mode==='i2v'?{first_image_url:images[0]}:images.length?{images}:{};
    if(mode==='i2v'&&images.length!==1)throw Error('首帧模式需要一张图片');
    if(mode==='v2v'&&videos.length!==1)throw Error('视频模式需要一个参考视频');
    return json({model:model.id,prompt:draft.prompt,seconds:String(draft.duration),resolution:draft.resolution.toLowerCase(),aspect_ratio:draft.ratio,...media,...(videos.length?{video:videos[0]}:{})});
  }
  if(model.family==='seedance'){
    if(audios.length&&!images.length&&!videos.length)throw Error('Seedance 音频参考需要搭配图片或视频');
    if(mode==='i2v'&&images.length!==1)throw Error('首帧模式需要一张图片');
    if(['fl','i2v'].includes(mode)&&(videos.length||audios.length))throw Error('首尾帧模式不能混用其他参考素材');
    const content=[{type:'text',text:draft.prompt},...refs.map((r,i)=>{const type=r.type.split('/')[0]+'_url';return {type,[type]:{url:r.contentUrl},role:type==='image_url'?(mode==='fl'?(i===0?'first_frame':'last_frame'):mode==='i2v'?'first_frame':'reference_image'):type==='video_url'?'reference_video':'reference_audio'};})];
    return json({model:model.id,content,metadata:{duration:draft.duration,resolution:draft.resolution.toLowerCase(),ratio:draft.ratio,generate_audio:audios.length>0}});
  }
  if(refs.length&&!String(route).includes('generateContent')&&!model.referenceField)throw new Error('当前模型的参考素材传输尚未接入，请更换支持参考素材的模型；输入未被丢弃');
  if(refs.length&&['t2i','t2v'].includes(draft.videoMode))throw new Error('已接入素材，请选择参考生成模式');
  if(refs.length&&model.referenceField==='input_reference'&&(refs.length!==1||!refs[0].type?.startsWith('image/')))throw new Error('当前视频适配器只支持一张参考图片');
  if(refs.length&&model.referenceField==='images'&&refs.some(r=>!r.type?.startsWith('image/')))throw new Error('当前模型仅支持参考图片');
  if(refs.length&&model.referenceField==='video'&&(refs.length!==1||!refs[0].type?.startsWith('video/')))throw new Error('当前模型需要一个参考视频');
  const base = {
    model: model.id,
    prompt: draft.prompt,
    videoMode: draft.videoMode,
    ratio: draft.ratio,
    resolution: draft.resolution,
    duration: draft.duration,
    count: draft.count,
  };
  if (model.kind === 'video') {
    if (model.contentType === 'multipart') {
      return {
        method: 'POST',
        path: route,
        contentType: 'multipart',
        fields: {
          model: model.id,
          prompt: draft.prompt,
          aspect_ratio: draft.ratio,
          size: draft.resolution,
          seconds: String(draft.duration ?? model.fixedSeconds ?? ''),
          mode: draft.videoMode || 't2v',
          ...(refs.length?{[model.referenceField]:refs[0].contentUrl}:{}),
        },
        localProxy: `/api/duoyuanx${route}`,
      };
    }
    return {
      method: 'POST',
      path: route,
      contentType: 'json',
      body: {
        model: model.id,
        prompt: draft.prompt,
        aspect_ratio: draft.ratio,
        size: draft.resolution,
        duration: draft.duration,
        mode: draft.videoMode || 't2v',
        n: draft.count,
        ...(refs.length?{[model.referenceField]:model.referenceField==='video'?refs[0].contentUrl:refs.map(r=>r.contentUrl)}:{}),
      },
      localProxy: `/api/duoyuanx${route}`,
      queryRoute: model.queryRoute,
    };
  }
  // image
  if (String(route).includes('generateContent')) {
    if(refs.some(r=>!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.contentUrl)))throw new Error('当前图片模型需内嵌参考图片，请先下载后上传；不支持视频或音频');
    return {
      method: 'POST',
      path: route,
      contentType: 'json',
      body: {
        contents: [{ role: 'user', parts: [{ text: draft.prompt },...(draft.references||[]).map(r=>{const [header,data]=r.contentUrl.split(',');return {inlineData:{mimeType:header.slice(5).split(';')[0],data}};})] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: draft.ratio, imageSize: draft.resolution || '1K' },
        },
      },
      localProxy: `/api/duoyuanx${route}`,
    };
  }
  const size = imageSizeForModel(model, draft);
  return {
    method: 'POST',
    path: route,
    contentType: 'json',
    body: {
      model: model.id,
      prompt: draft.prompt,
      aspect_ratio: draft.ratio,
      size,
      n: draft.count,
      mode: draft.videoMode || 't2i',
    },
    localProxy: `/api/duoyuanx${route}`,
  };
}
