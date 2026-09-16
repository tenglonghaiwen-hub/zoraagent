import fs from 'node:fs';
import {inflateRawSync} from 'node:zlib';

// Structural delivery gate, not a substitute for rendering in Office/WPS.
export function validatePptx(file) {
 try {
  const b=fs.readFileSync(file); if(b.length>64*1024*1024)throw Error('文件超过结构校验上限 64 MiB');
  let end=-1; for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw Error('不是完整的 PPTX ZIP 文件');
  const entries=new Map(); let pos=b.readUInt32LE(end+16),total=0;
  for(let i=0;i<b.readUInt16LE(end+10);i++){
   if(b.readUInt32LE(pos)!==0x02014b50)throw Error('ZIP 目录损坏');
   const method=b.readUInt16LE(pos+10),size=b.readUInt32LE(pos+20),raw=b.readUInt32LE(pos+24),nl=b.readUInt16LE(pos+28),off=b.readUInt32LE(pos+42),name=b.subarray(pos+46,pos+46+nl).toString();
   total+=raw;if(total>128*1024*1024)throw Error('解压大小超过校验上限');
   const start=off+30+b.readUInt16LE(off+26)+b.readUInt16LE(off+28),data=b.subarray(start,start+size);
   if(entries.has(name))throw Error('ZIP 包含重复文件项');
   if(/\.(xml|rels)$/.test(name))entries.set(name,(method===0?data:method===8?inflateRawSync(data,{maxOutputLength:128*1024*1024}):(()=>{throw Error('不支持的 ZIP 压缩方式');})()).toString('utf8'));else entries.set(name,'');
   pos+=46+nl+b.readUInt16LE(pos+30)+b.readUInt16LE(pos+32);
  }
  for(const name of ['[Content_Types].xml','_rels/.rels','ppt/presentation.xml','ppt/_rels/presentation.xml.rels'])if(!entries.has(name))throw Error('缺少 '+name);
  const pres=entries.get('ppt/presentation.xml');
  if(!/<(?:\w+:)?sldMasterIdLst\b/.test(pres))throw Error('缺少幻灯片母版关联');
  if(pres.indexOf(':sldSz')<pres.indexOf(':sldIdLst'))throw Error('幻灯片列表与尺寸顺序错误');
  if(/\btype="wide"/.test(pres))throw Error('无效的画幅类型 wide');
  const slides=[...entries.keys()].filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));
  if(!slides.length)throw Error('没有幻灯片');
  for(const name of slides){
   if(/<a:b\s*\//.test(entries.get(name)))throw Error('文字加粗 XML 不合法');
   const rel=entries.get(name.replace('slides/','slides/_rels/')+'.rels');
   if(!rel?.includes('/slideLayout'))throw Error('幻灯片缺少版式关联');
  }
  return {ok:true,scope:'structure',slides:slides.length};
 }catch(error){return {ok:false,scope:'structure',error:'PPTX 结构校验失败：'+error.message+'。请让 Agent 修复并重新导出。'};}
}
