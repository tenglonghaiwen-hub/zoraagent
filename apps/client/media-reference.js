import {restoreReference} from './reference-store.js?v=studio137';

async function readReference(ref,toDataUrl){
 if(ref.contentUrl)return {name:ref.name||ref.file?.name,type:ref.type||ref.file?.type,contentUrl:ref.contentUrl};
 if(!(ref.file instanceof Blob)&&ref.storageId)await restoreReference(ref);
 if(ref.file instanceof Blob)return {name:ref.file.name,type:ref.file.type,contentUrl:await toDataUrl(ref.file)};
 if(/^(https?:|data:)/.test(ref.url||''))return {name:ref.file?.name||ref.name,type:ref.file?.type||ref.type,contentUrl:ref.url};
 throw Error('参考素材原文件不可用，请重新添加图片后生成');
}

export async function prepareMediaReference(ref,toDataUrl){
 return readReference(ref,toDataUrl);
}
