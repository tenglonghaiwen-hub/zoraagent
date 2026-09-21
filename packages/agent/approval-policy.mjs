import fs from 'node:fs';import path from 'node:path';
import {dataPath} from '../runtime-paths.mjs';
export const approvalModes={ask:{approvalPolicy:'on-request',sandbox:'workspace-write'},smart:{approvalPolicy:'untrusted',sandbox:'workspace-write'},full:{approvalPolicy:'never',sandbox:'danger-full-access'}};
export function readApprovalMode(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8')).mode;return Object.hasOwn(approvalModes,value)?value:'smart';}catch{return 'smart';}}
export function saveApprovalMode(file,mode){if(!Object.hasOwn(approvalModes,mode))throw Error('审批模式无效');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify({mode}));fs.renameSync(file+'.tmp',file);return mode;}
// Device preference is available before login or kernel startup. Retain legacy
// per-kernel settings until the user explicitly saves a device preference.
export function readDeviceApprovalMode(legacyFile){const file=dataPath('codex-approval-policy.json');return readApprovalMode(fs.existsSync(file)?file:legacyFile||file);}
export function saveDeviceApprovalMode(mode){return saveApprovalMode(dataPath('codex-approval-policy.json'),mode);}
