import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMainAgentPrompt } from '../packages/agent/prompts/main-agent.mjs';
import { buildMediaSubagentPrompt } from '../packages/agent/prompts/media-subagent.mjs';

test('main agent prompt contains required instructions', () => {
  const prompt = buildMainAgentPrompt();

  assert.ok(Array.isArray(prompt), 'should return an array of lines');
  assert.ok(prompt.length > 10, 'should have multiple instruction lines');

  const joined = prompt.join('\n');

  // Check key instructions are present
  assert.match(joined, /造境 Zora/, 'should mention Zora');
  assert.match(joined, /delegate_media_task/, 'should mention media delegation');
  assert.match(joined, /中文/, 'should mention Chinese language');
  assert.match(joined, /OpenMontage/, 'should mention OpenMontage');
  assert.match(joined, /desktop_jianying/, 'should mention Jianying tool');
  assert.match(joined, /browser_search|browser_open/, 'should mention browser tools');
  assert.match(joined, /local_runtime_status|propose_local_action/, 'should mention local runtime');
  assert.match(joined, /GPT Image 2|gpt-image-2/, 'should mention default image model');
  assert.match(joined, /MiniMax H3|MiniMax-H3/, 'should mention default video model');

  // Check it does NOT mention removed features
  assert.doesNotMatch(joined, /RunningHub/, 'should not mention RunningHub');
  assert.doesNotMatch(joined, /rh_list_workflows|rh_run_workflow/, 'should not mention RH tools');
});

test('media subagent prompt differs for image and video', () => {
  const imagePrompt = buildMediaSubagentPrompt('image');
  const videoPrompt = buildMediaSubagentPrompt('video');

  assert.ok(typeof imagePrompt === 'string', 'should return a string');
  assert.ok(typeof videoPrompt === 'string', 'should return a string');

  // Check image-specific content
  assert.match(imagePrompt, /图片/, 'image prompt should mention images');
  assert.match(imagePrompt, /gpt-image-2/, 'should mention default image model');

  // Check video-specific content
  assert.match(videoPrompt, /视频/, 'video prompt should mention videos');
  assert.match(videoPrompt, /MiniMax-H3/, 'should mention default video model');
  assert.match(videoPrompt, /t2v|i2v|fl|ref/, 'should mention video modes');

  // Check common instructions
  for (const prompt of [imagePrompt, videoPrompt]) {
    assert.match(prompt, /preview_task/, 'should mention preview tool');
    assert.match(prompt, /submit_generation/, 'should mention generation tool');
    assert.match(prompt, /operation/, 'should mention operation selection');
    assert.match(prompt, /routes/, 'should mention routes');
    assert.match(prompt, /参考素材/, 'should mention reference materials');
  }
});

test('prompts contain security and safety instructions', () => {
  const mainPrompt = buildMainAgentPrompt().join('\n');
  const imagePrompt = buildMediaSubagentPrompt('image');

  // Main agent safety checks
  assert.match(mainPrompt, /禁止猜测|必须.*批准|pending 不是完成/, 'should have safety instructions');
  assert.match(mainPrompt, /审批|授权|确认/, 'should mention approval/authorization');
  assert.match(mainPrompt, /不能.*假称|不得声称|禁止/, 'should prevent false claims');

  // Media subagent safety checks
  assert.match(imagePrompt, /不得声称完成/, 'should prevent false completion claims');
  assert.match(imagePrompt, /不得重复提交/, 'should prevent duplicate submissions');
  assert.match(imagePrompt, /不悄悄|不主动/, 'should prevent unauthorized changes');
});

test('prompts maintain consistent structure', () => {
  const mainPrompt = buildMainAgentPrompt();
  const imagePrompt = buildMediaSubagentPrompt('image');
  const videoPrompt = buildMediaSubagentPrompt('video');

  // Main prompt should be an array
  assert.ok(Array.isArray(mainPrompt));
  assert.ok(mainPrompt.every(line => typeof line === 'string'));

  // Subagent prompts should be strings
  assert.equal(typeof imagePrompt, 'string');
  assert.equal(typeof videoPrompt, 'string');

  // No empty lines in main prompt
  assert.ok(mainPrompt.every(line => line.trim().length > 0), 'no empty lines');

  // Subagent prompts should not be empty
  assert.ok(imagePrompt.length > 100, 'image prompt has content');
  assert.ok(videoPrompt.length > 100, 'video prompt has content');
});

test('prompts encode project-specific knowledge', () => {
  const mainPrompt = buildMainAgentPrompt().join('\n');

  // File delivery rules
  assert.match(mainPrompt, /Excel.*Word.*PDF/, 'should mention file formats');
  assert.match(mainPrompt, /plan_local_workflow/, 'should mention workflow planning');
  assert.match(mainPrompt, /\.xlsx/, 'should mention Excel extension');

  // Tool usage patterns
  assert.match(mainPrompt, /listWindows.*readWindow/, 'should describe Jianying workflow');
  assert.match(mainPrompt, /browser_search.*browser_open/, 'should describe browser workflow');

  // Model selection rules
  assert.match(mainPrompt, /用户.*明确要求.*上下文约束.*专业判断.*默认值/, 'should describe priority order');
});
