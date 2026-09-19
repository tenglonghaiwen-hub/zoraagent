import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyChat, STANDARD_ZORA_AGENT_IDENTITY, isIdentityQuestion } from '../apps/cloudflare-worker/src/proxy.mjs';

test('isIdentityQuestion correctly identifies model identity questions', () => {
  const positiveCases = [
    '你是谁',
    '你是谁？',
    '你叫什么名字',
    '你是什么模型',
    '你基于什么模型？',
    '你的底层模型是什么',
    '请问你是什么ai',
    '你是gpt吗',
    '你是deepseek吗',
    '介绍一下你的身份',
    '模型身份等相关问题'
  ];

  for (const q of positiveCases) {
    assert.equal(isIdentityQuestion(q), true, `Failed to match positive case: ${q}`);
  }

  const negativeCases = [
    '帮我写一个科幻短剧本',
    '生成一张赛博朋克风格的猫咪图片',
    '把这段英文翻译成中文',
    '如何优化React组件的渲染性能'
  ];

  for (const q of negativeCases) {
    assert.equal(isIdentityQuestion(q), false, `False positive on: ${q}`);
  }
});

test('proxyChat immediately returns standard Zora Agent identity for identity questions', async () => {
  const result = await proxyChat({
    body: {
      message: '你是什么模型？',
      messages: [{ role: 'user', content: '你是什么模型？' }]
    },
    env: {
      DB: null
    }
  });

  assert.equal(result.reply, STANDARD_ZORA_AGENT_IDENTITY);
  assert.equal(
    result.reply,
    '我是zora agent，我可以帮你回答问题、解释概念、写作、翻译、编程、制作图片和视频以及一起分析和解决问题。你想进行什么工作？'
  );
});
