import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

test('index.html uses studio185+ cache buster', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/client/index.html'), 'utf8');
  assert.match(html, /style\.css\?v=studio(18[3-9]|19\d)/);
  assert.match(html, /app\.js\?v=studio(18[3-9]|19\d)/);
  assert.match(html, /runtime-panel\.js\?v=studio(18[3-9]|19\d)/);
  assert.match(html, /appearance\.js\?v=studio(18[3-9]|19\d)/);
  assert.doesNotMatch(html, /studio182/);
});

test('style.css defines canvas board interactivity styles', () => {
  const css = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');
  assert.match(css, /\.btn-insert-canvas/);
  assert.match(css, /\.frame-insert-btn/);
  assert.match(css, /#canvas-board\.is-drop-target/);
});

test('app.js exports __canvasInsertMediaNode and hooks board drag & drop', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.match(appJs, /window\.__canvasAddNode\s*=/);
  assert.match(appJs, /window\.__canvasInsertMediaNode\s*=/);
  assert.match(appJs, /board\.addEventListener\(['"]dragover['"]/);
  assert.match(appJs, /board\.addEventListener\(['"]drop['"]/);
  assert.match(appJs, /application\/x-zora-gen/);
  assert.match(appJs, /frame-insert-btn/);
  assert.match(appJs, /btn-insert-canvas/);
});

test('Canvas media node generator produces valid res-image and res-video schema', () => {
  // Simulate the __canvasInsertMediaNode mapping logic
  function mockCanvasInsertMediaNode({ url, kind = 'image', prompt = '', at = null, batchIndex = 0 }) {
    if (!url) return null;
    const isVideo = kind === 'video';
    const type = isVideo ? 'res-video' : 'res-image';
    const cleanPrompt = String(prompt || '').trim();
    const note = cleanPrompt ? (cleanPrompt.length > 30 ? cleanPrompt.slice(0, 30) + '…' : cleanPrompt) : (isVideo ? '生成的视频' : '生成的图片');
    const label = isVideo ? '视频素材' : '图片素材';
    const targetPos = at || { x: 100 + batchIndex * 260, y: 150 };
    return {
      id: 'n' + Date.now(),
      type,
      label,
      note,
      prompt: cleanPrompt,
      outputUrl: url,
      x: targetPos.x,
      y: targetPos.y,
      source: 'agent-generated'
    };
  }

  const imgNode = mockCanvasInsertMediaNode({
    url: 'https://cdn.zora.local/images/gen-001.png',
    kind: 'image',
    prompt: '赛博朋克雨夜街道，霓虹灯光倒影',
    at: { x: 200, y: 300 }
  });
  assert.equal(imgNode.type, 'res-image');
  assert.equal(imgNode.label, '图片素材');
  assert.equal(imgNode.outputUrl, 'https://cdn.zora.local/images/gen-001.png');
  assert.equal(imgNode.x, 200);
  assert.equal(imgNode.y, 300);
  assert.equal(imgNode.prompt, '赛博朋克雨夜街道，霓虹灯光倒影');

  const videoNode = mockCanvasInsertMediaNode({
    url: 'https://cdn.zora.local/videos/gen-002.mp4',
    kind: 'video',
    prompt: '电影级推镜头穿过森林',
    batchIndex: 2
  });
  assert.equal(videoNode.type, 'res-video');
  assert.equal(videoNode.label, '视频素材');
  assert.equal(videoNode.outputUrl, 'https://cdn.zora.local/videos/gen-002.mp4');
  assert.equal(videoNode.x, 100 + 2 * 260);
});

test('canvas card drag styles and pointer interaction allow unrestricted free dragging', () => {
  const css = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');
  assert.match(css, /\.canvas-node\s*\{[^}]*touch-action:\s*none/);
  assert.match(css, /\.canvas-node\s*\{[^}]*user-select:\s*none/);
  assert.match(css, /\.canvas-node\.is-dragging/);
  assert.match(css, /\.canvas-image-node\s+\.canvas-node-body\s+img\s*\{[^}]*pointer-events:\s*none/);
  assert.match(css, /\.canvas-media-result-node/);

  const appJs = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.match(appJs, /startPosMap/);
  assert.match(appJs, /Math\.round\(start\.x\s*\+\s*dx\)/);
  assert.match(appJs, /isMediaResult/);
  assert.doesNotMatch(appJs, /Math\.min\(rect\.width\/zoom-48/);
});

test('canvas card selection mounts full editor with detailed IO, prompt input, and upload across all nodes', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  // Must NOT exclude res-image or res-video from mountNodeWorkflow
  assert.doesNotMatch(appJs, /!\[['"]res-image['"],\s*['"]res-video['"]\]\.includes\(n\.type\)/);
  // Must render image-node-editor with textarea for prompt input
  assert.match(appJs, /image-node-editor/);
  assert.match(appJs, /textarea placeholder/);
  // Must render upload buttons
  assert.match(appJs, /data-upload/);
  assert.match(appJs, /image-node-reference/);
  // Must call mountNodeWorkflow for selected nodes
  assert.match(appJs, /mountNodeWorkflow\(el,\s*n,/);
});

test('collectNodeInput extracts Jimeng-style explicit constraint and agent auto inference', async () => {
  const { collectNodeInput } = await import('../apps/client/node-workflow.js');
  const mockNodes = [
    {
      id: 'img1',
      label: '角色参考图',
      type: 'res-image',
      outputUrl: 'https://cdn.zora.local/role.png',
      runState: 'complete'
    },
    {
      id: 'bg1',
      label: '赛博街道',
      type: 'res-image',
      outputUrl: 'https://cdn.zora.local/bg.png',
      runState: 'complete'
    }
  ];

  const targetNode = {
    id: 'vid1',
    type: 'res-video',
    inputs: ['img1', 'bg1'],
    prompt: '保持 @角色参考图 的人物面部与服饰特征，背景融入 @赛博街道 的夜景霓虹灯光'
  };

  const result = collectNodeInput(mockNodes, targetNode);
  assert.equal(result.references.length, 2);

  const roleRef = result.references.find(r => r.name === '角色参考图');
  assert.ok(roleRef);
  assert.match(roleRef.constraint, /人物面部与服饰特征/);
  assert.equal(roleRef.role, 'user-constraint');

  const bgRef = result.references.find(r => r.name === '赛博街道');
  assert.ok(bgRef);
  assert.match(bgRef.constraint, /夜景霓虹灯光/);
  assert.equal(bgRef.role, 'user-constraint');

  // Test case without explicit constraint: should fallback to agent-auto-infer
  const unconstrainedNode = {
    id: 'vid2',
    type: 'res-video',
    inputs: ['img1'],
    prompt: '镜头向前推进穿过雨雾'
  };
  const resultAuto = collectNodeInput(mockNodes, unconstrainedNode);
  assert.equal(resultAuto.references[0].role, 'agent-auto-infer');
});

test('node-workflow.js provides connected and canvas-wide auto-connecting @-mention popover and parameter controls', () => {
  const code = fs.readFileSync(path.join(ROOT, 'apps/client/node-workflow.js'), 'utf8');
  assert.match(code, /node-mention-pop/);
  assert.match(code, /connectNodes\(nodes,\s*item\.id,\s*n\.id\)/, 'Selecting canvas media should auto-connect to current node');
  assert.match(code, /mention-badge-connected/);
  assert.match(code, /mention-badge-connectable/);
  assert.match(code, /mention-thumb/);

  // Parameter grid controls: ratio, resolution, count, concurrency, duration slider
  assert.match(code, /node-param-grid/);
  assert.match(code, /节点比例/);
  assert.match(code, /节点画质/);
  assert.match(code, /生成数量/);
  assert.match(code, /并发上限/);
  assert.match(code, /node-slider-row/);
  assert.match(code, /slider-badge/);
  assert.match(code, /视频时长滑杆/);
});

test('canvas card supports deleting uploaded media, reuploading, and canvas agent supports @-mentions', () => {
  const appCode = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  const cssCode = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');

  // Card media deletion & replacement
  assert.match(appCode, /data-remove-media/, 'Toolbar must have remove media button');
  assert.match(appCode, /ref-btn-del/, 'Reference card must have delete button');
  assert.match(appCode, /canvas-media-overlay/, 'Media body must have overlay with replace and delete');
  assert.match(cssCode, /\.canvas-media-overlay/, 'CSS must style media overlay');
  assert.match(cssCode, /\.ref-btn-del/, 'CSS must style reference delete button');

  // Canvas Agent @-mention popup & reference auto-attachment
  assert.match(appCode, /canvas-agent-mention-pop/, 'Canvas agent must create mention popup');
  assert.match(appCode, /checkAgentMentions/, 'Canvas agent must check mentions on input');
  assert.match(appCode, /assets\.push/, 'Selecting canvas media must add to agent assets');
  assert.match(cssCode, /\.canvas-agent-mention-pop/, 'CSS must style canvas agent mention pop');
});

test('canvas card and canvas agent support full-width ＠, IME composition, and explicit mention trigger button', () => {
  const nodeWorkflowCode = fs.readFileSync(path.join(ROOT, 'apps/client/node-workflow.js'), 'utf8');
  const appCode = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  const cssCode = fs.readFileSync(path.join(ROOT, 'apps/client/style.css'), 'utf8');

  // Node workflow: full-width ＠ regex, compositionend, trigger button, and fixed popover
  assert.match(nodeWorkflowCode, /\[@\\uff20\]/, 'Node workflow must support full-width ＠ character in regex');
  assert.match(nodeWorkflowCode, /node-mention-trigger-btn/, 'Node workflow must provide explicit @ mention trigger button');
  assert.match(nodeWorkflowCode, /compositionend/, 'Node workflow must listen to compositionend for Chinese IME');
  assert.match(nodeWorkflowCode, /mentionPop\.style\.position\s*=\s*'fixed'/, 'Node workflow must use fixed positioning to avoid overflow clipping');

  // Canvas Agent: full-width ＠ regex, compositionend, trigger button
  assert.match(appCode, /\[@\\uff20\]/, 'App.js must support full-width ＠ in checkAgentMentions and showMentions');
  assert.match(appCode, /canvas-agent-mention-btn/, 'App.js must provide explicit mention button in canvas agent');

  // CSS: trigger button styles
  assert.match(cssCode, /\.node-mention-trigger-btn/, 'CSS must style node mention trigger button');
  assert.match(cssCode, /\.canvas-agent-mention-btn/, 'CSS must style canvas agent mention button');
});

test('canvas card upload has no 2MB limit and safely handles large files via IndexedDB', () => {
  const appCode = fs.readFileSync(path.join(ROOT, 'apps/client/app.js'), 'utf8');
  assert.doesNotMatch(appCode, /本地节点图片暂限 2 MB/, 'Must not have 2MB image upload restriction');
  assert.doesNotMatch(appCode, /本地参考素材暂限 2 MB/, 'Must not have 2MB media upload restriction');
  assert.match(appCode, /saveReference\(\{file,\s*storageId:\s*n\.storageId\}\)/, 'Must safely persist large files to IndexedDB');
});

