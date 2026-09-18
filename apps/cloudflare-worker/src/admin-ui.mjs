/**
 * Visual Admin Dashboard HTML/CSS/JS generator for Cloudflare Workers
 * Embeds a standalone, responsive, high-aesthetic single-page console.
 */

export function renderAdminHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zora Gateway | 官方云端网关可视化控制台</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-main: #0b0f19;
      --bg-card: rgba(18, 24, 38, 0.85);
      --bg-card-hover: rgba(28, 36, 54, 0.95);
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(99, 102, 241, 0.35);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-light: rgba(99, 102, 241, 0.15);
      --accent: #8b5cf6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --radius: 12px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                  radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 40%),
                  var(--bg-main);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      border-bottom: 1px solid var(--border);
      background: rgba(11, 15, 25, 0.75);
      backdrop-filter: blur(16px);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 0.5px;
    }
    .brand-badge {
      font-size: 0.7rem;
      font-weight: 600;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      text-transform: uppercase;
    }

    .nav-tabs {
      display: flex;
      gap: 0.5rem;
    }
    .nav-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      padding: 0.45rem 0.9rem;
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
    }
    .nav-btn:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }
    .nav-btn.active {
      background: var(--primary-light);
      border-color: var(--border-accent);
      color: #818cf8;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    main {
      flex: 1;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      padding: 1.75rem 1.5rem;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; animation: fadeIn 0.25s ease; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Stats Cards */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }
    .stat-title {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-value {
      font-size: 1.85rem;
      font-weight: 700;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.4rem;
    }

    /* Panels & Tables */
    .panel {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      backdrop-filter: blur(12px);
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .panel-title {
      font-size: 1.15rem;
      font-weight: 600;
    }
    .panel-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: middle;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-primary { background: rgba(99, 102, 241, 0.2); color: #818cf8; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .badge-agent { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
    .badge-video { background: rgba(236, 72, 153, 0.2); color: #f472b6; }

    /* Form & Controls */
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 0.45rem;
      color: var(--text);
    }
    .form-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    input[type="text"], input[type="password"], input[type="number"], select, textarea {
      width: 100%;
      background: rgba(15, 21, 35, 0.8);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.65rem 0.85rem;
      color: var(--text);
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }
    input[type="checkbox"] {
      cursor: pointer;
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    .btn {
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.6rem 1.1rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.14); }
    .btn-danger {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .btn-danger:hover { background: var(--danger); color: white; }
    .btn-sm { padding: 0.35rem 0.65rem; font-size: 0.775rem; }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      visibility: hidden;
      opacity: 0;
      transition: all 0.2s ease;
    }
    .modal-overlay.active {
      visibility: visible;
      opacity: 1;
    }
    .modal {
      background: #141b2d;
      border: 1px solid var(--border-accent);
      border-radius: var(--radius);
      padding: 1.75rem;
      max-width: 520px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .modal-title {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    /* Toast */
    #toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .toast {
      background: #1e293b;
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
      color: white;
      padding: 0.85rem 1.25rem;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      font-size: 0.875rem;
      animation: slideIn 0.3s ease;
    }
    .toast.success { border-left-color: var(--success); }
    .toast.error { border-left-color: var(--danger); }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .mono { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="brand">
      <span>⚡ ZORA GATEWAY</span>
      <span class="brand-badge">Admin</span>
    </div>

    <nav class="nav-tabs" id="navTabs">
      <button class="nav-btn active" data-tab="overview">概览仪表盘</button>
      <button class="nav-btn" data-tab="models">模型与定价</button>
      <button class="nav-btn" data-tab="config">API 密钥与配置</button>
      <button class="nav-btn" data-tab="users">用户账本</button>
      <button class="nav-btn" data-tab="logs">审计流水</button>
    </nav>

    <div class="header-actions">
      <span id="adminStatusText" style="font-size: 0.8rem; color: var(--text-muted);">已连接生产 D1</span>
      <button class="btn btn-secondary btn-sm" id="logoutBtn">退出登录</button>
    </div>
  </header>

  <!-- Main Content -->
  <main>
    <!-- TAB 1: OVERVIEW -->
    <section id="tab-overview" class="tab-content active">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">总注册用户</div>
          <div class="stat-value" id="statUsers">-</div>
          <div class="stat-sub">D1 users 实时统计</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">活跃运行模型</div>
          <div class="stat-value" id="statModels">-</div>
          <div class="stat-sub">当前开放调用的模型数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">全站累计消耗积分</div>
          <div class="stat-value" id="statConsumed" style="color: #fbbf24;">-</div>
          <div class="stat-sub">定点账本已结算总点数</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总调用请求次数</div>
          <div class="stat-value" id="statRequests" style="color: #818cf8;">-</div>
          <div class="stat-sub">生图 / 生视频 / 对话记录数</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">网关运行状态 (APAC 边缘节点)</div>
            <div class="panel-desc">Cloudflare Workers + D1 无服务器架构，实时响应与配置生效</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadAllData()">刷新数据</button>
        </div>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1rem;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">D1 数据库标识</div>
            <div class="mono" style="margin-top: 0.25rem;">zora-db (295307be-7caa...)</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">官方计费兑换比率</div>
            <div style="margin-top: 0.25rem; font-weight: 600;">1 元 = 10 积分（成本 × 12 = 应扣积分）</div>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">桌面分发接口地址</div>
            <div class="mono" style="margin-top: 0.25rem; color: #818cf8;" id="apiUrlDisplay">-</div>
          </div>
        </div>
      </div>
    </section>

    <!-- TAB 2: MODELS & PRICING -->
    <section id="tab-models" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">服务端模型与计费定价管理</div>
            <div class="panel-desc">直接在此处修改模型定价、单价、并发限制或开关启停，桌面端即刻生效</div>
          </div>
          <button class="btn btn-sm" onclick="openModelModal()">+ 新增模型</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>模型 ID</th>
              <th>显示名称</th>
              <th>类型</th>
              <th>供应商</th>
              <th>单价 (积分/次)</th>
              <th>并发限制</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="modelsTableBody">
            <tr><td colspan="8" style="text-align: center; color: var(--text-muted);">正在加载模型列表...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 3: CONFIG & API KEYS -->
    <section id="tab-config" class="tab-content">
      <div class="panel" style="max-width: 820px;">
        <div class="panel-header">
          <div>
            <div class="panel-title">多服务商 API 密钥与网关动态配置</div>
            <div class="panel-desc">在此处设置各家大模型服务商的 API 密钥及接口地址，存入 D1 数据库即时生效，无需重新部署</div>
          </div>
        </div>

        <form id="configForm">
          <!-- 1. MiniMax Official Section -->
          <div style="background: rgba(236, 72, 153, 0.06); border: 1px solid rgba(236, 72, 153, 0.25); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="font-size: 1.1rem;">🚀</span>
              <strong style="color: #f472b6;">MiniMax 官方直连服务商 (MiniMax-H3 视频生成)</strong>
              <span class="badge" style="background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4);">官方直连</span>
            </div>
            <div class="form-desc" style="margin-bottom: 1rem; color: #e2e8f0;">
              MiniMax-H3 视频生成已接入官方规范（<code>/v2/video_generation</code> 与 <code>/v2/query/video_generation/{task_id}</code>），直接填入海螺/MiniMax 开放平台申请的官方 API Key 即可。
            </div>
            <div class="form-group">
              <label for="cfg_minimax_key">MiniMax 官方 API 密钥 (MINIMAX_API_KEY)</label>
              <input type="password" id="cfg_minimax_key" placeholder="eyJhbGciOi... 或 留空保持现有配置">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label for="cfg_minimax_base">MiniMax 官方 API 地址 (MINIMAX_BASE_URL)</label>
              <input type="text" id="cfg_minimax_base" placeholder="https://api.minimax.cn">
              <div class="form-desc">默认为 https://api.minimax.cn，海外用户可填写 https://api.minimaxi.com。</div>
            </div>
          </div>

          <!-- 2. Duoyuanx Section -->
          <div style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="font-size: 1.1rem;">🌐</span>
              <strong style="color: #60a5fa;">多元交叉 / 多元探索 (Duoyuanx)</strong>
              <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);">中转服务商</span>
            </div>
            <div class="form-group">
              <label for="cfg_duoyuanx_key">多元探索 API 密钥 (DUOYUANX_API_KEY)</label>
              <input type="password" id="cfg_duoyuanx_key" placeholder="sk-...">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label for="cfg_duoyuanx_base">多元探索 Base 地址 (DUOYUANX_BASE_URL)</label>
              <input type="text" id="cfg_duoyuanx_base" placeholder="https://duoyuanx.com">
            </div>
          </div>

          <!-- 3. OpenAI & DeepSeek & SiliconFlow Accordion/Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
            <!-- OpenAI -->
            <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.1rem;">🤖</span>
                <strong style="color: #34d399;">OpenAI 官方</strong>
              </div>
              <div class="form-group">
                <label for="cfg_openai_key">API 密钥 (OPENAI_API_KEY)</label>
                <input type="password" id="cfg_openai_key" placeholder="sk-...">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg_openai_base">Base 地址</label>
                <input type="text" id="cfg_openai_base" placeholder="https://api.openai.com">
              </div>
            </div>

            <!-- DeepSeek -->
            <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px; padding: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.1rem;">🧠</span>
                <strong style="color: #818cf8;">DeepSeek 官方</strong>
              </div>
              <div class="form-group">
                <label for="cfg_deepseek_key">API 密钥 (DEEPSEEK_API_KEY)</label>
                <input type="password" id="cfg_deepseek_key" placeholder="sk-...">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg_deepseek_base">Base 地址</label>
                <input type="text" id="cfg_deepseek_base" placeholder="https://api.deepseek.com">
              </div>
            </div>
          </div>

          <!-- 4. SiliconFlow & Custom -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
            <!-- SiliconFlow -->
            <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.1rem;">⚡</span>
                <strong style="color: #fbbf24;">硅基流动 (SiliconFlow)</strong>
              </div>
              <div class="form-group">
                <label for="cfg_siliconflow_key">API 密钥 (SILICONFLOW_API_KEY)</label>
                <input type="password" id="cfg_siliconflow_key" placeholder="sk-...">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg_siliconflow_base">Base 地址</label>
                <input type="text" id="cfg_siliconflow_base" placeholder="https://api.siliconflow.cn">
              </div>
            </div>

            <!-- Custom OneAPI -->
            <div style="background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 1.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.1rem;">🔌</span>
                <strong style="color: #c084fc;">自定义 / OneAPI 中转</strong>
              </div>
              <div class="form-group">
                <label for="cfg_custom_key">自定义 API 密钥 (CUSTOM_API_KEY)</label>
                <input type="password" id="cfg_custom_key" placeholder="sk-...">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="cfg_custom_base">自定义 Base 地址</label>
                <input type="text" id="cfg_custom_base" placeholder="https://your-oneapi-domain.com">
              </div>
            </div>
          </div>

          <!-- 5. Admin Password -->
          <div class="form-group" style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem;">
            <label for="cfg_admin_pass">后台管理员控制台登录密码 (ADMIN_PASSWORD)</label>
            <input type="password" id="cfg_admin_pass" placeholder="留空表示不修改">
            <div class="form-desc">用于登录此可视化控制台。若需修改请输入新密码。</div>
          </div>

          <div style="margin-top: 1.75rem;">
            <button type="submit" class="btn" style="padding: 0.65rem 1.5rem; font-size: 0.95rem;">保存所有服务商配置</button>
          </div>
        </form>
      </div>
    </section>

    <!-- TAB 4: USERS & BALANCE -->
    <section id="tab-users" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">注册用户账本与积分管理</div>
            <div class="panel-desc">查看桌面端已注册账号，支持管理员手动为用户充值或调账</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>用户 ID</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>当前可用积分</th>
              <th>身份</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr><td colspan="7" style="text-align: center; color: var(--text-muted);">正在加载用户...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 5: AUDIT LOGS -->
    <section id="tab-logs" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">全站消费与调用流水审计</div>
            <div class="panel-desc">每一笔扣款与充值均在此处留存记录，不可篡改</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadLogs()">刷新日志</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户 ID</th>
              <th>操作类型</th>
              <th>涉及模型 / 渠道</th>
              <th>积分变动</th>
              <th>请求标识 (Request ID)</th>
            </tr>
          </thead>
          <tbody id="logsTableBody">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">正在加载流水日志...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <!-- Login Modal -->
  <div class="modal-overlay" id="loginModal">
    <div class="modal">
      <div class="modal-title">🔐 管理员登录</div>
      <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem;">
        请输入 Cloudflare Gateway 管理控制台密码以继续。
      </div>
      <form id="loginForm">
        <div class="form-group">
          <label for="adminPasswordInput">管理员密码</label>
          <input type="password" id="adminPasswordInput" placeholder="输入密码..." required autofocus>
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn" style="width: 100%;">登录控制台</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Model Edit/Add Modal -->
  <div class="modal-overlay" id="modelModal">
    <div class="modal">
      <div class="modal-title" id="modelModalTitle">编辑模型配置</div>
      <form id="modelForm">
        <div class="form-group">
          <label for="m_id">模型 ID (英文唯一标识)</label>
          <input type="text" id="m_id" placeholder="如 gpt-image-2, flux-dev" required>
        </div>
        <div class="form-group">
          <label for="m_name">显示名称</label>
          <input type="text" id="m_name" placeholder="如 GPT Image 2 (高清生图)" required>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label for="m_kind">模型类别</label>
            <select id="m_kind">
              <option value="image">image (生图)</option>
              <option value="video">video (生视频)</option>
              <option value="agent">agent (对话模型)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="m_cost">扣除积分单价</label>
            <input type="number" id="m_cost" min="0" placeholder="10" required>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label for="m_provider">供应商服务 (Provider)</label>
            <select id="m_provider">
              <option value="minimax">minimax (MiniMax 官方直连)</option>
              <option value="duoyuanx">duoyuanx (多元探索)</option>
              <option value="openai">openai (OpenAI 官方)</option>
              <option value="siliconflow">siliconflow (硅基流动)</option>
              <option value="deepseek">deepseek (DeepSeek 官方)</option>
              <option value="custom">custom (自定义 / OneAPI)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="m_concurrency">最大并发上限</label>
            <input type="number" id="m_concurrency" min="1" max="20" value="2">
          </div>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="checkbox" id="m_enabled" checked>
          <label for="m_enabled" style="margin-bottom: 0; cursor: pointer;">启用此模型向客户端开放</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModelModal()">取消</button>
          <button type="submit" class="btn">保存模型</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Adjust Balance Modal -->
  <div class="modal-overlay" id="adjustModal">
    <div class="modal">
      <div class="modal-title">💰 调整用户积分</div>
      <form id="adjustForm">
        <input type="hidden" id="adj_user_id">
        <div class="form-group">
          <label>目标用户</label>
          <div class="mono" id="adj_user_display" style="padding: 0.5rem 0; color: #818cf8;">-</div>
        </div>
        <div class="form-group">
          <label for="adj_delta">积分变动量（正数为增加，负数为扣减）</label>
          <input type="number" id="adj_delta" placeholder="如 100 或 -50" required>
        </div>
        <div class="form-group">
          <label for="adj_reason">调账备注原因</label>
          <input type="text" id="adj_reason" value="管理员手动调账" placeholder="调账原因">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeAdjustModal()">取消</button>
          <button type="submit" class="btn">确认调账</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Container -->
  <div id="toast-container"></div>

  <script>
    const TOKEN_KEY = 'zora_admin_token';
    let currentToken = sessionStorage.getItem(TOKEN_KEY) || '';

    // Show Toast
    function showToast(msg, type = 'info') {
      const c = document.getElementById('toast-container');
      const t = document.createElement('div');
      t.className = 'toast ' + type;
      t.textContent = msg;
      c.appendChild(t);
      setTimeout(() => t.remove(), 4000);
    }

    // Authenticated Admin Fetch
    async function adminFetch(url, options = {}) {
      if (!currentToken) {
        openLoginModal();
        throw new Error('需要登录');
      }
      const headers = {
        ...(options.headers || {}),
        'Authorization': 'Bearer ' + currentToken,
        'Content-Type': 'application/json'
      };
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem(TOKEN_KEY);
        currentToken = '';
        openLoginModal();
        throw new Error('登录已过期或无权限');
      }
      return res;
    }

    // Modal helpers
    function openLoginModal() { document.getElementById('loginModal').classList.add('active'); }
    function closeLoginModal() { document.getElementById('loginModal').classList.remove('active'); }
    function openModelModal(data = null) {
      const isEdit = !!data;
      document.getElementById('modelModalTitle').textContent = isEdit ? '编辑模型配置' : '新增服务模型';
      document.getElementById('m_id').value = data ? data.id : '';
      document.getElementById('m_id').readOnly = isEdit;
      document.getElementById('m_name').value = data ? data.name : '';
      document.getElementById('m_kind').value = data ? data.kind : 'image';
      document.getElementById('m_cost').value = data ? data.quotaCostPerUnit : '10';
      document.getElementById('m_provider').value = data ? data.provider : 'duoyuanx';
      document.getElementById('m_concurrency').value = data ? data.maxConcurrency : '2';
      document.getElementById('m_enabled').checked = data ? (data.enabled === 1 || data.enabled === true) : true;
      document.getElementById('modelModal').classList.add('active');
    }
    function closeModelModal() { document.getElementById('modelModal').classList.remove('active'); }
    function openAdjustModal(userId, username) {
      document.getElementById('adj_user_id').value = userId;
      document.getElementById('adj_user_display').textContent = username + ' (' + userId + ')';
      document.getElementById('adj_delta').value = '';
      document.getElementById('adjustModal').classList.add('active');
    }
    function closeAdjustModal() { document.getElementById('adjustModal').classList.remove('active'); }

    // Nav Switcher
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = 'tab-' + btn.getAttribute('data-tab');
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
      });
    });

    // Login Form Submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('adminPasswordInput').value;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || '密码错误');
        currentToken = data.token;
        sessionStorage.setItem(TOKEN_KEY, currentToken);
        closeLoginModal();
        showToast('管理员登录成功', 'success');
        loadAllData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem(TOKEN_KEY);
      currentToken = '';
      openLoginModal();
      showToast('已退出登录');
    });

    // Load Stats
    async function loadStats() {
      try {
        const res = await adminFetch('/api/admin/stats');
        const d = await res.json();
        if (d.ok) {
          document.getElementById('statUsers').textContent = d.stats.totalUsers;
          document.getElementById('statModels').textContent = d.stats.activeModels;
          document.getElementById('statConsumed').textContent = d.stats.totalConsumed.toLocaleString();
          document.getElementById('statRequests').textContent = d.stats.totalRequests.toLocaleString();
        }
      } catch {}
    }

    // Load Models
    async function loadModels() {
      try {
        const res = await adminFetch('/api/admin/models');
        const d = await res.json();
        const tbody = document.getElementById('modelsTableBody');
        tbody.innerHTML = '';
        if (!d.models || d.models.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">暂无配置的模型</td></tr>';
          return;
        }

        function getProviderBadge(p) {
          const norm = String(p || 'duoyuanx').toLowerCase();
          if (norm === 'minimax') return '<span class="badge" style="background: rgba(236, 72, 153, 0.18); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4);">MiniMax 官方</span>';
          if (norm === 'duoyuanx') return '<span class="badge" style="background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);">多元交叉</span>';
          if (norm === 'openai') return '<span class="badge" style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">OpenAI</span>';
          if (norm === 'siliconflow') return '<span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">硅基流动</span>';
          if (norm === 'deepseek') return '<span class="badge" style="background: rgba(99, 102, 241, 0.18); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4);">DeepSeek</span>';
          if (norm === 'custom') return '<span class="badge" style="background: rgba(139, 92, 246, 0.18); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4);">自定义</span>';
          return '<span class="badge">' + norm + '</span>';
        }

        d.models.forEach(m => {
          const tr = document.createElement('tr');
          const isEnabled = m.enabled === 1 || m.enabled === true;
          const badgeClass = m.kind === 'video' ? 'badge-video' : (m.kind === 'agent' ? 'badge-agent' : 'badge-primary');
          const routeDisplay = m.route ? ('<span class="mono" style="color: #38bdf8; font-size: 0.78rem;">' + m.route + '</span>' + (m.queryRoute ? '<br><span class="mono" style="color: #94a3b8; font-size: 0.72rem;">' + m.queryRoute + '</span>' : '')) : '<span style="color: var(--text-muted);">-</span>';
          tr.innerHTML = \`
            <td class="mono" style="font-weight: 600;">\${m.id}</td>
            <td>\${m.name}</td>
            <td><span class="badge \${badgeClass}">\${m.kind}</span></td>
            <td>\${getProviderBadge(m.provider)}</td>
            <td>\${routeDisplay}</td>
            <td><strong style="color: #fbbf24;">\${m.quotaCostPerUnit}</strong> 积分</td>
            <td>\${m.maxConcurrency || 1}</td>
            <td>
              <span class="badge \${isEnabled ? 'badge-success' : 'badge-warning'}">
                \${isEnabled ? '开放中' : '已停用'}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick='editModel(\${JSON.stringify(m).replace(/'/g, "&#39;")})'>编辑</button>
              <button class="btn btn-danger btn-sm" onclick="deleteModel('\${m.id}')">删除</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch {}
    }

    window.editModel = function(m) { openModelModal(m); };

    window.deleteModel = async function(id) {
      if (!confirm('确定要删除模型 ' + id + ' 吗？')) return;
      try {
        const res = await adminFetch('/api/admin/models?id=' + encodeURIComponent(id), { method: 'DELETE' });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('模型已删除', 'success');
        loadModels();
        loadStats();
      } catch (e) {
        showToast(e.message, 'error');
      }
    };

    // Save Model Submit
    document.getElementById('modelForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const model = {
        id: document.getElementById('m_id').value.trim(),
        name: document.getElementById('m_name').value.trim(),
        kind: document.getElementById('m_kind').value,
        quotaCostPerUnit: parseInt(document.getElementById('m_cost').value, 10),
        provider: document.getElementById('m_provider').value.trim(),
        route: document.getElementById('m_route').value.trim(),
        queryRoute: document.getElementById('m_query_route').value.trim(),
        maxConcurrency: parseInt(document.getElementById('m_concurrency').value, 10),
        enabled: document.getElementById('m_enabled').checked ? 1 : 0
      };
      try {
        const res = await adminFetch('/api/admin/models', {
          method: 'POST',
          body: JSON.stringify(model)
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('模型已保存', 'success');
        closeModelModal();
        loadModels();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Load Configs
    async function loadConfigs() {
      try {
        const res = await adminFetch('/api/admin/config');
        const d = await res.json();
        if (d.ok && d.configs) {
          d.configs.forEach(c => {
            const key = c.key;
            const val = c.value || '';
            const setField = (id, isSecret = false) => {
              const el = document.getElementById(id);
              if (!el) return;
              if (isSecret && val) {
                el.placeholder = '已配置 (' + (val.length > 8 ? '••••••••' + val.slice(-6) : '••••••••') + ')';
              } else if (!isSecret && val) {
                el.value = val;
              }
            };
            if (key === 'MINIMAX_API_KEY') setField('cfg_minimax_key', true);
            if (key === 'MINIMAX_BASE_URL') setField('cfg_minimax_base', false);
            if (key === 'DUOYUANX_API_KEY') setField('cfg_duoyuanx_key', true);
            if (key === 'DUOYUANX_BASE_URL') setField('cfg_duoyuanx_base', false);
            if (key === 'OPENAI_API_KEY') setField('cfg_openai_key', true);
            if (key === 'OPENAI_BASE_URL') setField('cfg_openai_base', false);
            if (key === 'SILICONFLOW_API_KEY') setField('cfg_siliconflow_key', true);
            if (key === 'SILICONFLOW_BASE_URL') setField('cfg_siliconflow_base', false);
            if (key === 'DEEPSEEK_API_KEY') setField('cfg_deepseek_key', true);
            if (key === 'DEEPSEEK_BASE_URL') setField('cfg_deepseek_base', false);
            if (key === 'CUSTOM_API_KEY') setField('cfg_custom_key', true);
            if (key === 'CUSTOM_BASE_URL') setField('cfg_custom_base', false);
          });
        }
      } catch {}
    }

    // Save Config Submit
    document.getElementById('configForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {};
      const fields = [
        ['cfg_minimax_key', 'MINIMAX_API_KEY'],
        ['cfg_minimax_base', 'MINIMAX_BASE_URL'],
        ['cfg_duoyuanx_key', 'DUOYUANX_API_KEY'],
        ['cfg_duoyuanx_base', 'DUOYUANX_BASE_URL'],
        ['cfg_openai_key', 'OPENAI_API_KEY'],
        ['cfg_openai_base', 'OPENAI_BASE_URL'],
        ['cfg_siliconflow_key', 'SILICONFLOW_API_KEY'],
        ['cfg_siliconflow_base', 'SILICONFLOW_BASE_URL'],
        ['cfg_deepseek_key', 'DEEPSEEK_API_KEY'],
        ['cfg_deepseek_base', 'DEEPSEEK_BASE_URL'],
        ['cfg_custom_key', 'CUSTOM_API_KEY'],
        ['cfg_custom_base', 'CUSTOM_BASE_URL'],
        ['cfg_admin_pass', 'ADMIN_PASSWORD'],
      ];

      for (const [elemId, configKey] of fields) {
        const val = document.getElementById(elemId)?.value?.trim();
        if (val) payload[configKey] = val;
      }

      try {
        const res = await adminFetch('/api/admin/config', {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('所有服务商配置已即时更新', 'success');
        for (const [elemId] of fields) {
          if (elemId.includes('key') || elemId.includes('pass')) {
            const el = document.getElementById(elemId);
            if (el) el.value = '';
          }
        }
        loadConfigs();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Load Users
    async function loadUsers() {
      try {
        const res = await adminFetch('/api/admin/users');
        const d = await res.json();
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        if (!d.users || d.users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">暂无注册用户</td></tr>';
          return;
        }
        d.users.forEach(u => {
          const tr = document.createElement('tr');
          const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : '-';
          tr.innerHTML = \`
            <td class="mono" style="font-size: 0.75rem;">\${u.id}</td>
            <td style="font-weight: 600;">\${u.username}</td>
            <td>\${u.email || '-'}</td>
            <td><strong style="color: #34d399; font-size: 1rem;">\${u.quotaBalance}</strong> 积分</td>
            <td><span class="badge badge-primary">\${u.role}</span></td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${dateStr}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="openAdjustModal('\${u.id}', '\${u.username}')">调账</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch {}
    }

    // Adjust Balance Submit
    document.getElementById('adjustForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.getElementById('adj_user_id').value;
      const delta = parseInt(document.getElementById('adj_delta').value, 10);
      const reason = document.getElementById('adj_reason').value.trim();

      try {
        const res = await adminFetch('/api/admin/users/adjust-balance', {
          method: 'POST',
          body: JSON.stringify({ userId, delta, reason })
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('调账成功，用户新余额：' + d.newBalance, 'success');
        closeAdjustModal();
        loadUsers();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Load Logs
    async function loadLogs() {
      try {
        const res = await adminFetch('/api/admin/logs?limit=50');
        const d = await res.json();
        const tbody = document.getElementById('logsTableBody');
        tbody.innerHTML = '';
        if (!d.logs || d.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无流水记录</td></tr>';
          return;
        }
        d.logs.forEach(l => {
          const tr = document.createElement('tr');
          const dateStr = l.createdAt ? new Date(l.createdAt).toLocaleTimeString('zh-CN') : '-';
          const isTopup = l.quotaCost < 0;
          const costDisplay = isTopup
            ? \`<span style="color: #34d399; font-weight: 600;">+\${Math.abs(l.quotaCost)} (充值)</span>\`
            : \`<span style="color: #f87171; font-weight: 600;">-\${l.quotaCost} (消耗)</span>\`;
          tr.innerHTML = \`
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${dateStr}</td>
            <td class="mono" style="font-size: 0.75rem;">\${l.userId.slice(0, 8)}...</td>
            <td><span class="badge \${isTopup ? 'badge-success' : 'badge-primary'}">\${l.resourceType}</span></td>
            <td>\${l.modelId || '-'}</td>
            <td>\${costDisplay}</td>
            <td class="mono" style="font-size: 0.75rem; color: var(--text-muted);">\${l.requestId || '-'}</td>
          \`;
          tbody.appendChild(tr);
        });
      } catch {}
    }

    function loadAllData() {
      loadStats();
      loadModels();
      loadConfigs();
      loadUsers();
      loadLogs();
    }

    // Init
    document.getElementById('apiUrlDisplay').textContent = window.location.origin;
    if (!currentToken) {
      openLoginModal();
    } else {
      loadAllData();
    }
  </script>
</body>
</html>`;
}
