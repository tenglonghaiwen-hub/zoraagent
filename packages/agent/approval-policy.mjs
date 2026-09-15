import fs from 'node:fs';import path from 'node:path';
export const approvalModes={ask:{approvalPolicy:'on-request',sandbox:'workspace-write'},smart:{approvalPolicy:'untrusted',sandbox:'workspace-write'},full:{approvalPolicy:'never',sandbox:'danger-full-access'}};
export function readApprovalMode(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8')).mode;return Object.hasOwn(approvalModes,value)?value:'smart';}catch{return 'smart';}}
export function saveApprovalMode(file,mode){if(!Object.hasOwn(approvalModes,mode))throw Error('审批模式无效');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({mode}));fs.renameSync(file+'.tmp',file);return mode;}
