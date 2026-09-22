import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const STOCK_SOURCES=['archive_org','nasa','wikimedia','pexels','unsplash'];
export const TRANSCRIPT_MODELS=['tiny','base','small','medium','large-v2','large-v3'];
const defaults={editing:true,transcription:true,voice:true,stock:true,transcriptModel:'base',voiceModel:'',sources:['archive_org','nasa','wikimedia']};
function location(){return path.join(process.env.OM_STATE_DIR||process.env.ZORA_DATA_DIR||fileURLToPath(new URL('../../runtime/',import.meta.url)),'om-preferences.json');}
export function readOmPreferences(){
 if(!fs.existsSync(location()))return structuredClone(defaults);
 return validateOmPreferences(JSON.parse(fs.readFileSync(location(),'utf8')));
}
export function validateOmPreferences(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('设置格式无效');
 if(Object.keys(value).some(k=>!(k in defaults)))throw new Error('包含不支持的设置项');
 const next={...defaults,...value};
 for(const key of ['editing','transcription','voice','stock'])if(typeof next[key]!=='boolean')throw new Error('能力开关必须为布尔值');
 if(!TRANSCRIPT_MODELS.includes(next.transcriptModel))throw new Error('不支持的转录模型');
 if(typeof next.voiceModel!=='string'||next.voiceModel.length>1024)throw new Error('音色路径无效');
 next.voiceModel=next.voiceModel.trim();
 if(next.voiceModel&&(!path.isAbsolute(next.voiceModel)||!next.voiceModel.toLowerCase().endsWith('.onnx')))throw new Error('请填写本地 ONNX 音色文件的绝对路径');
 if(!Array.isArray(next.sources)||next.sources.some(s=>!STOCK_SOURCES.includes(s)))throw new Error('仅支持已开放的公共素材来源');
 next.sources=[...new Set(next.sources)];
 if(next.stock&&!next.sources.length)throw new Error('开启素材检索时至少选择一个来源');
 return next;
}
export function saveOmPreferences(value){
 const next=validateOmPreferences(value),file=location();fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2));fs.renameSync(temp,file);return next;
}
export function configureOmInputs(tool,args,preferences=readOmPreferences()){
 const group=tool==='transcriber'?'transcription':tool==='piper_tts'?'voice':tool==='direct_clip_search'?'stock':'editing';
 if(!preferences[group])throw new Error('此能力已在设置 → 本地媒体能力中关闭');
 const inputs={...args};
 if(tool==='transcriber')inputs.model_size??=preferences.transcriptModel;
 if(tool==='piper_tts'){
  inputs.model||=preferences.voiceModel;
  if(!inputs.model||!path.isAbsolute(inputs.model)||!fs.existsSync(inputs.model)||!fs.existsSync(inputs.model+'.json'))throw new Error('请在本地媒体能力设置中配置已有的 .onnx 音色及同名 .onnx.json 文件');
 }
 if(tool==='direct_clip_search'){
  inputs.sources??=preferences.sources;
  if(!Array.isArray(inputs.sources)||!inputs.sources.length||inputs.sources.some(s=>!preferences.sources.includes(s)))throw new Error('请求了未启用的素材来源');
 }
 return inputs;
}
