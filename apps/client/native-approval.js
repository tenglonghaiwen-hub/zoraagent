// Show only requests belonging to the visible conversation. Closing is not consent.
export function createNativeApprovalPrompt(decide) {
  const seen = new Set();
  const dialog = document.createElement('dialog');
  dialog.className = 'native-script-approval';
  dialog.setAttribute('aria-label', '本机脚本执行授权');
  dialog.style.cssText = 'max-width:680px;width:calc(100% - 48px);max-height:80vh;overflow:auto;border:1px solid #60738b;border-radius:18px;padding:24px;background:#172838;color:#edf4fc';
  document.body.append(dialog);
  let current;
  function sync(requests) {
    if (current && !requests.some(r => r.id === current && r.status === 'pending')) { dialog.close(); current = null; }
    if (dialog.open) return;
    const request = requests.find(r => r.status === 'pending' && r.request?.execution === 'native' && !seen.has(r.id));
    if (!request) return;
    current = request.id; seen.add(current);
    const add = (tag, text) => { const node = document.createElement(tag); node.textContent = text; dialog.append(node); return node; };
    dialog.replaceChildren();
    add('h2', '允许执行这段本机脚本？');
    add('p', '仅授权本次操作。脚本以当前 Windows 用户权限运行，不申请管理员权限；可能访问工作区外文件及网络，没有 Docker 隔离。');
    add('p', `运行环境：${request.request.runtime}\n工作目录：${request.request.workspaceRoot}\n最长执行：${request.request.timeoutMs / 1000} 秒`).style.whiteSpace = 'pre-wrap';
    const code = add('pre', request.request.command);
    code.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:35vh;overflow:auto;padding:12px;background:#0e1a26;border-radius:10px';
    for (const [label, action] of [['拒绝', 'deny'], ['允许本次', 'approve'], ['稍后处理', null]]) {
      const button = add('button', label); button.type = 'button'; button.style.marginRight = '12px';
      button.onclick = () => { dialog.close(); current = null; if (action) void decide(request, action); };
    }
    dialog.showModal();
    dialog.querySelector('button')?.focus();
  }
  return {sync, dispose: () => dialog.remove()};
}
