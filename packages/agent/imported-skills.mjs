import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../skills/codex-imports/',import.meta.url);
export const importedSkills=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
export function readImportedSkill(id,resource='SKILL.md'){
 const skill=importedSkills.find(s=>s.id===id);if(!skill)return null;
 if(!skill.resources.includes(resource))return {error:'技能资料不存在'};
 const url=new URL(id.slice(6)+'/'+resource,root);
 const prompt=fs.readFileSync(fileURLToPath(url),'utf8');
 return {...skill,prompt,resource};
}
