// Explicit --publish uploads a draft only; public release remains a separate action.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),yaml=require('js-yaml');
const root=fileURLToPath(new URL('../',import.meta.url));
const file=process.argv.find(x=>x.startsWith('--manifest='))?.slice(11)||path.join(root,'outputs/latest-desktop-package.json');
const build=JSON.parse(fs.readFileSync(file,'utf8')),release=path.join(build.output,'release');
const metadata=path.join(release,'latest.yml');
const info=yaml.load(fs.readFileSync(metadata,'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(build.output,'stage/package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(info.version)||info.version!==pkg.version)throw Error('发布版本必须是与暂存包一致的稳定版 x.y.z');
const entry=info.files?.find(x=>x.url?.endsWith('.exe'));
if(!entry||path.basename(entry.url)!==entry.url||!entry.url.startsWith('Zora-'))throw Error('无效安装包清单');
const exe=path.join(release,entry.url),stat=fs.statSync(exe);
if(stat.size!==entry.size||createHash('sha512').update(fs.readFileSync(exe)).digest('base64')!==entry.sha512)throw Error('安装包大小或 SHA512 与更新清单不匹配');
if(!fs.existsSync(path.join(release,'win-unpacked/resources/app-update.yml')))throw Error('缺少包内更新源配置');
const assets=[metadata,exe];if(fs.existsSync(exe+'.blockmap'))assets.push(exe+'.blockmap');
const tag='v'+info.version;
console.log(JSON.stringify({tag,repository:'tenglonghaiwen-hub/zoraagent',assets,draft:true},null,2));
if(process.argv.includes('--publish')){
 const notes=process.argv.find(x=>x.startsWith('--notes='))?.slice(8);
 if(!notes||!fs.statSync(notes).isFile())throw Error('--publish 必须提供 --notes=中文发布说明文件');
 execFileSync('gh',['release','create',tag,...assets,'--repo','tenglonghaiwen-hub/zoraagent','--draft','--title',`Zora ${info.version}`,'--notes-file',notes],{stdio:'inherit',windowsHide:true});
}
