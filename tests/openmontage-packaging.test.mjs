import test from 'node:test';
import assert from 'node:assert/strict';
import {engineFileAllowed} from '../scripts/bundle-openmontage.mjs';
test('engine package includes implementation and skills but excludes private and generated files',()=>{
  for(const file of ['tools/video/video_compose.py','lib/paths.py','services/studio_api/app.py','.agents/skills/hyperframes/SKILL.md','skills/core/ffmpeg.md','remotion-composer/src/index.tsx'])assert.equal(engineFileAllowed(file),true,file);
  for(const file of ['.env','account-data/user.json','projects/private/project.json','remotion-composer/projects/secret/entry.tsx','remotion-composer/node_modules/package/index.js','tools/__pycache__/x.pyc','lib/config.local.json','lib/.env','work/result.mp4'])assert.equal(engineFileAllowed(file),false,file);
});
