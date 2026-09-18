/**
 * Skill-related tool handlers
 */
import { importedSkills, readImportedSkill } from '../imported-skills.mjs';

export async function handleSkillTool(name, args, { catalog = [], callApi } = {}) {
  if (name === 'list_skills') {
    const local = catalog.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || '',
      description: s.description || '',
      source: s.source || 'zora',
    }));

    let om = [];
    if (typeof callApi === 'function') {
      try {
        const res = await callApi({ method: 'GET', path: '/api/om/skills?limit=300' });
        const list = res?.data?.skills || res?.skills || [];
        if (Array.isArray(list)) om = list;
      } catch {}
    }

    return { skills: [...local, ...om], count: local.length + om.length };
  }

  if (name === 'get_skill') {
    const sid = String(args.skillId || importedSkills.find((s) => s.name === args.name)?.id || '');

    // Imported Codex skills
    if (sid.startsWith('codex:')) {
      return readImportedSkill(sid, args.resource) || { error: '技能不存在' };
    }

    // OpenMontage skills
    if (sid.startsWith('om:') && typeof callApi === 'function') {
      return callApi({ method: 'GET', path: '/api/om/skills/' + encodeURIComponent(sid) });
    }

    // Local skills
    const hit =
      catalog.find((s) => s.id && s.id === args.skillId) ||
      catalog.find((s) => s.name && s.name === args.name);

    if (!hit) {
      if (sid && typeof callApi === 'function') {
        return callApi({ method: 'GET', path: '/api/om/skills/' + encodeURIComponent(sid) });
      }
      return { error: '技能不存在' };
    }

    return {
      id: hit.id,
      name: hit.name,
      category: hit.category || '',
      description: hit.description || '',
      prompt: hit.prompt || '',
      source: hit.source || 'zora',
    };
  }

  return undefined;
}
