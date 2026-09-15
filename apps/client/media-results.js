export function normalizeMediaResults(payload){
 const urls=[],taskIds=[],errors=[];
 const add=url=>{if(typeof url==='string'&&/^(https?:\/\/|data:(image|video)\/)/.test(url))urls.push(url);};
 const visit=value=>{
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach(visit);return;}
  const status=String(value.status||'').toLowerCase();
  const failure=value.error||(['failed','failure','expired','error','cancelled','canceled'].includes(status)?status:null);
  if(failure){errors.push(String(failure.message||failure));return;}
  const before=urls.length,beforeErrors=errors.length;
  for(const key of ['url','video_url','image_url'])add(value[key]);
  if(value.b64_json)add('data:image/png;base64,'+value.b64_json);
  const inline=value.inlineData||value.inline_data;if(inline?.data)add(`data:${inline.mimeType||inline.mime_type||'image/png'};base64,${inline.data}`);
  for(const key of ['task','data','output','outputs','results','upstreams','upstream','candidates','content','parts'])visit(value[key]);
  const id=value.task_id||value.id;
  if(id&&typeof id==='string'&&urls.length===before&&errors.length===beforeErrors){
   if(['completed','succeeded','success'].includes(status))errors.push('任务已结束但未返回可用素材');
   else taskIds.push(id);
  }
 };
 visit(payload);return {urls:[...new Set(urls)],taskIds:[...new Set(taskIds)],errors};
}
