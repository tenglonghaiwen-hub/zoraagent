import {createHash} from 'node:crypto';

// Hash the complete identifier: truncating it can merge distinct tool calls.
export function normalizeCallIds(body) {
  if (!Array.isArray(body?.input)) return body;
  const reserved=new Set(body.input.map(x=>x?.call_id).filter(x=>typeof x==='string'&&x.length<=64));
  const mapping=new Map();
  for(const item of body.input){
    const id=item?.call_id;
    if(typeof id!=='string'||id.length<=64||mapping.has(id))continue;
    let salt=0,short;
    do {short='call_'+createHash('sha256').update(id+'\0'+salt++).digest('hex').slice(0,56);} while(reserved.has(short));
    reserved.add(short);mapping.set(id,short);
  }
  if(!mapping.size)return body;
  return {...body,input:body.input.map(item=>mapping.has(item?.call_id)?{...item,call_id:mapping.get(item.call_id)}:item)};
}
