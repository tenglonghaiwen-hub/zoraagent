export function editContextItems(contents,params){
 const editable=!!params.isEditable;
 return [
  {label:'复制',enabled:!!params.editFlags?.canCopy,click:()=>contents.copy()},
  {label:'粘贴',enabled:editable&&!!params.editFlags?.canPaste,click:()=>contents.paste()},
  {type:'separator'},
  {label:'全选',click:()=>contents.selectAll()},
  {label:'全选复制',click:()=>{contents.selectAll();contents.copy();}}
 ];
}
