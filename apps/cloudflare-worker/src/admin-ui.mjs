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
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
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
      <button class="nav-btn" data-tab="models">模型与路由</button>
      <button class="nav-btn" data-tab="config">API 密钥与服务商</button>
      <button class="nav-btn" data-tab="users">用户中台 & VIP</button>
      <button class="nav-btn" data-tab="notifications">消息与公告推送</button>
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
              <th>调用路由</th>
              <th>单价 (积分/次)</th>
              <th>并发限制</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="modelsTableBody">
            <tr><td colspan="9" style="text-align: center; color: var(--text-muted);">正在加载模型列表...</td></tr>
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
            <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('minimax')">测试 MiniMax 连通性</button>
              <span id="test_minimax_res" class="mono" style="font-size: 0.78rem;"></span>
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
            <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('duoyuanx')">测试多元探索连通性</button>
              <span id="test_duoyuanx_res" class="mono" style="font-size: 0.78rem;"></span>
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
              <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('openai')">测试 OpenAI</button>
                <span id="test_openai_res" class="mono" style="font-size: 0.78rem;"></span>
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
              <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('deepseek')">测试 DeepSeek</button>
                <span id="test_deepseek_res" class="mono" style="font-size: 0.78rem;"></span>
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
              <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('siliconflow')">测试硅基流动</button>
                <span id="test_siliconflow_res" class="mono" style="font-size: 0.78rem;"></span>
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
              <div style="margin-top: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="testProvider('custom')">测试自定义上游</button>
                <span id="test_custom_res" class="mono" style="font-size: 0.78rem;"></span>
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

    <!-- TAB 4: USERS & VIP CENTER -->
    <section id="tab-users" class="tab-content">
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">👥 全球用户运营中台 & VIP 权限</div>
            <div class="panel-desc">集中管理桌面端注册创作者、实时积分扣补调账、VIP会员生命周期与账号封禁</div>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <input type="text" id="userSearchInput" placeholder="按邮箱或昵称搜索..." style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px; border: 1px solid var(--border); background: rgba(0,0,0,0.3); color: #fff; width: 220px;" oninput="debounceUserSearch()">
            <button class="btn btn-secondary btn-sm" onclick="loadUsers()">刷新列表</button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>用户邮箱 / 昵称</th>
              <th>积分余额</th>
              <th>VIP 状态</th>
              <th>账号状态</th>
              <th>注册时间</th>
              <th>运营操作</th>
            </tr>
          </thead>
          <tbody id="usersTableBody">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">正在加载用户...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 5: NOTIFICATIONS & BROADCAST -->
    <section id="tab-notifications" class="tab-content">
      <div class="panel" style="margin-bottom: 1.5rem;">
        <div class="panel-title" style="margin-bottom: 0.5rem;">📢 发布新系统通知 / 消息推送</div>
        <div class="panel-desc" style="margin-bottom: 1.25rem;">推送将实时同步至所有桌面端消息中心（右上角消息铃铛红点提醒）</div>
        
        <form id="notificationForm" onsubmit="handleSendNotification(event)">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="notif_target">推送对象</label>
              <select id="notif_target" onchange="toggleNotifUserField()">
                <option value="*">📢 全员系统广播（所有用户）</option>
                <option value="single">👤 指定用户专属私信</option>
              </select>
            </div>
            <div class="form-group" id="notif_user_group" style="display: none;">
              <label for="notif_user_id">目标用户 ID 或 邮箱</label>
              <input type="text" id="notif_user_id" placeholder="输入用户 ID 或邮箱">
            </div>
            <div class="form-group">
              <label for="notif_kind">消息分类</label>
              <select id="notif_kind">
                <option value="official">官方系统公告</option>
                <option value="activity">活动 / 优惠福利</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="notif_title">通知标题</label>
            <input type="text" id="notif_title" placeholder="如：Zora 全新视频生成模型已上线！" required>
          </div>
          <div class="form-group">
            <label for="notif_content">通知详细内容</label>
            <textarea id="notif_content" rows="3" placeholder="填写公告或私信具体内容，支持 Markdown 或纯文本..." required style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: rgba(0,0,0,0.3); color: #fff;"></textarea>
          </div>
          <button type="submit" class="btn">🚀 立即推送给客户端</button>
        </form>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">📜 历史推送记录</div>
            <div class="panel-desc">查看已发布的历史广播或私信，支持随时撤回删除</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadNotifications()">刷新推送列表</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>接收目标</th>
              <th>分类</th>
              <th>标题</th>
              <th>内容预览</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="notificationsTableBody">
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">正在加载推送记录...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- TAB 6: AUDIT LOGS -->
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
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="form-group">
            <label for="m_template">协议模板</label>
            <select id="m_template"><option value="">按已有模型识别</option><option value="responses">responses</option><option value="claude-messages">claude-messages</option><option value="chat-completions">chat-completions</option><option value="openai-image">openai-image</option><option value="gpt-image">gpt-image</option><option value="grok-image">grok-image</option><option value="seedream">seedream</option><option value="qwen-image">qwen-image</option><option value="gemini-image">gemini-image</option><option value="grok-video">grok-video</option><option value="veo">veo</option><option value="minimax">minimax（官方格式 v2）</option><option value="minimax-openai">minimax-openai（多元 OpenAI 格式 v1）</option><option value="omni">omni</option><option value="seedance">seedance</option></select>
            <div id="m_h3_prices">
              <label for="m_h3_enhance_cost">H3 提示词增强 · 每次积分</label>
              <input id="m_h3_enhance_cost" type="number" min="0" step="1" placeholder="留空不开放">
              <label for="m_h3_remix_cost">H3 再生成 · 每次积分</label>
              <input id="m_h3_remix_cost" type="number" min="0" step="1" placeholder="留空不开放">
              <p>仅用于多元 MiniMax 官方格式；0 表示用户免费。价格由管理员核定，设置后 Agent 可按指令选择操作。</p>
            </div>
            <label for="m_capability">能力参数（JSON，可留空使用模板默认值）</label>
            <textarea id="m_capability" rows="5" placeholder='{"version":1,"modes":["t2i","i2i"],"ratios":["1:1","9:16"],"maxCount":4}'></textarea>
            <p>同协议模型复用模板；素材库、蒙版和再生成需要对应能力配置。保存前校验，不执行付费调用。</p>
            <label><input type="checkbox" id="m_asset_workflow">启用多元 Seedance 素材库工作流（需先迁移素材回执表）</label>
            <button type="button" class="btn btn-secondary" id="m_history_load">查看历史版本</button>
            <select id="m_history" hidden><option value="">选择要恢复到表单的版本</option></select>
            <label for="m_route">API 请求路由 (Route)</label>
            <input type="text" id="m_route" placeholder="/v2/video_generation 或 /v1/images/generations">
            <div class="form-desc" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">MiniMax为 /v2/video_generation，通用生图为 /v1/images/generations</div>
          </div>
          <div class="form-group">
            <label for="m_query_route">异步任务轮询路由 (Query Route)</label>
            <input type="text" id="m_query_route" placeholder="/v2/query/video_generation/{task_id}">
            <div class="form-desc" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">支持 {task_id} 占位符，视频模型必填</div>
          </div>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 1.5rem; margin-top: 0.5rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0; cursor: pointer;">
            <input type="checkbox" id="m_enabled" checked> 启用此模型向客户端开放
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0; cursor: pointer; color: #fbbf24;">
            <input type="checkbox" id="m_vip_only"> 👑 设为 VIP 专属模型 (普通用户受限)
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeModelModal()">取消</button>
          <button type="submit" class="btn">保存模型</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Adjust Balance Modal (Recharge / Refund) -->
  <div class="modal-overlay" id="adjustModal">
    <div class="modal">
      <div class="modal-title">💰 手动充值 / 调账退费</div>
      <form id="adjustForm">
        <input type="hidden" id="adj_user_id">
        <div class="form-group">
          <label>目标用户</label>
          <div class="mono" id="adj_user_display" style="padding: 0.5rem 0; color: #818cf8;">-</div>
        </div>
        <div class="form-group">
          <label for="adj_delta">积分变动量（正数为充值增加，负数为退费扣减）</label>
          <input type="number" id="adj_delta" placeholder="例如: 100 (充值) 或 -50 (退费)" required>
        </div>
        <div class="form-group">
          <label for="adj_reason">操作原因 / 订单关联说明</label>
          <input type="text" id="adj_reason" value="后台人工充值入账" placeholder="调账原因">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeAdjustModal()">取消</button>
          <button type="submit" class="btn">确认调账执行</button>
        </div>
      </form>
    </div>
  </div>

  <!-- VIP Management Modal -->
  <div class="modal-overlay" id="vipModal">
    <div class="modal">
      <div class="modal-title">👑 设置用户 VIP 会员身份</div>
      <form id="vipForm" onsubmit="handleSaveVip(event)">
        <input type="hidden" id="vip_user_id">
        <div class="form-group">
          <label>目标创作者</label>
          <div class="mono" id="vip_user_display" style="padding: 0.5rem 0; color: #fbbf24;">-</div>
        </div>
        <div class="form-group">
          <label for="vip_action">VIP 身份操作</label>
          <select id="vip_action">
            <option value="30">赠送 / 开通 1 个月 VIP (30天)</option>
            <option value="90">开通 季度 VIP (90天)</option>
            <option value="365">开通 年度 VIP (365天)</option>
            <option value="-1">升级为 终身永久 VIP (Permanent)</option>
            <option value="0">取消 VIP (恢复普通用户)</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="closeVipModal()">取消</button>
          <button type="submit" class="btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 700;">确认设置 VIP</button>
        </div>
      </form>
    </div>
  </div>

  <!-- User Logs Modal -->
  <div class="modal-overlay" id="userLogsModal">
    <div class="modal" style="max-width: 800px; width: 90%;">
      <div class="modal-title">📜 用户个人消费与充值流水</div>
      <div class="mono" id="userLogsTitle" style="color: #93c5fd; margin-bottom: 1rem; font-size: 0.9rem;">-</div>
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>业务类型</th>
              <th>涉及模型/操作</th>
              <th>积分变动</th>
              <th>流水单号</th>
            </tr>
          </thead>
          <tbody id="userLogsTableBody">
            <tr><td colspan="5" style="text-align: center; color: var(--text-muted);">正在拉取用户流水...</td></tr>
          </tbody>
        </table>
      </div>
      <div class="modal-actions" style="margin-top: 1.25rem;">
        <button type="button" class="btn btn-secondary" onclick="closeUserLogsModal()">关闭流水</button>
      </div>
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
      document.getElementById('m_history').hidden=true;
      document.getElementById('m_history').innerHTML='';
      const isEdit = !!data;
      document.getElementById('modelModalTitle').textContent = isEdit ? '编辑模型配置' : '新增服务模型';
      document.getElementById('m_id').value = data ? data.id : '';
      document.getElementById('m_id').readOnly = isEdit;
      document.getElementById('m_name').value = data ? data.name : '';
      document.getElementById('m_kind').value = data ? data.kind : 'image';
      document.getElementById('m_cost').value = data ? data.quotaCostPerUnit : '10';
      document.getElementById('m_provider').value = data ? data.provider : 'duoyuanx';
      document.getElementById('m_template').value=data?.capability?.template||'';
      document.getElementById('m_capability').value=data?.capability?JSON.stringify(data.capability,null,2):'';
      document.getElementById('m_h3_enhance_cost').value=data?.capability?.h3OperationCosts?.enhance??'';
      document.getElementById('m_h3_remix_cost').value=data?.capability?.h3OperationCosts?.remix??'';
      document.getElementById('m_h3_prices').hidden=data?.capability?.template!=='minimax';
      document.getElementById('m_asset_workflow').checked=data?.capability?.assetWorkflow==='seedance-library-v1';
      document.getElementById('modelForm').dataset.revision=String(data?.capability?.revision||0);
      document.getElementById('m_route').value = data ? (data.route || '') : '';
      document.getElementById('m_query_route').value = data ? (data.queryRoute || data.query_route || '') : '';
      document.getElementById('m_concurrency').value = data ? data.maxConcurrency : '2';
      document.getElementById('m_enabled').checked = data ? (data.enabled === 1 || data.enabled === true) : true;
      if (!isEdit) autoSuggestRoute();
      document.getElementById('modelModal').classList.add('active');
    }

    function autoSuggestRoute() {
      const kind = document.getElementById('m_kind').value;
      const provider = document.getElementById('m_provider').value;
      const id = document.getElementById('m_id').value.trim();
      const routeInput = document.getElementById('m_route');
      const queryInput = document.getElementById('m_query_route');

      const template=document.getElementById('m_template').value;
      if(template==='minimax-openai'){
        routeInput.value='/v1/videos';queryInput.value='/v1/videos/{task_id}';return;
      }
      if(template==='seedance'){
        routeInput.value='/v1/video/generations';queryInput.value='/v1/video/generations/{task_id}';return;
      }

      if (provider === 'minimax' || id === 'MiniMax-H3') {
        if (!routeInput.value || routeInput.value === '/v1/videos' || routeInput.value === '/v1/images/generations') {
          routeInput.value = '/v2/video_generation';
        }
        if (!queryInput.value || queryInput.value === '/v1/videos/{task_id}') {
          queryInput.value = '/v2/query/video_generation/{task_id}';
        }
      } else if (kind === 'video') {
        if (!routeInput.value || routeInput.value === '/v2/video_generation' || routeInput.value === '/v1/images/generations') {
          routeInput.value = '/v1/videos';
        }
        if (!queryInput.value || queryInput.value === '/v2/query/video_generation/{task_id}') {
          queryInput.value = '/v1/videos/{task_id}';
        }
      } else if (kind === 'image') {
        if (!routeInput.value || routeInput.value === '/v2/video_generation' || routeInput.value === '/v1/videos') {
          routeInput.value = '/v1/images/generations';
        }
        queryInput.value = '';
      } else if (kind === 'agent') {
        if (!routeInput.value || routeInput.value === '/v1/images/generations' || routeInput.value === '/v1/videos') {
          routeInput.value = '/v1/chat/completions';
        }
        queryInput.value = '';
      }
    }
    document.getElementById('m_kind').addEventListener('change', autoSuggestRoute);
    document.getElementById('m_provider').addEventListener('change', autoSuggestRoute);
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

    document.getElementById('m_template').onchange=()=>{document.getElementById('m_h3_prices').hidden=document.getElementById('m_template').value!=='minimax';document.getElementById('m_h3_enhance_cost').value='';document.getElementById('m_h3_remix_cost').value='';document.getElementById('m_capability').value='';const route={'minimax-openai':'/v1/videos',minimax:'/v2/video_generation',responses:'/v1/responses','claude-messages':'/v1/messages','chat-completions':'/v1/chat/completions'}[document.getElementById('m_template').value];if(route)document.getElementById('m_route').value=route;const template=document.getElementById('m_template').value;if(template==='minimax-openai'||template==='minimax'){document.getElementById('m_query_route').value=template==='minimax-openai'?'/v1/videos/{task_id}':'/v2/query/video_generation/{task_id}';document.getElementById('m_asset_workflow').checked=false;}};
    let capabilityHistory=[];
    document.getElementById('m_history_load').onclick=async()=>{
      try{const response=await adminFetch('/api/admin/models/history?id='+encodeURIComponent(document.getElementById('m_id').value));const data=await response.json();if(!response.ok)throw Error(data.error||'历史读取失败');capabilityHistory=data.history||[];const select=document.getElementById('m_history');select.replaceChildren(new Option('选择要恢复到表单的版本',''),...capabilityHistory.map((h,i)=>new Option('版本 '+h.revision,i)));select.hidden=false;if(!capabilityHistory.length)showToast('暂无配置历史');}catch(e){showToast(e.message,'error');}
    };
    document.getElementById('m_history').onchange=e=>{if(e.target.value==='')return;const revision=document.getElementById('modelForm').dataset.revision;openModelModal(capabilityHistory[Number(e.target.value)].model);document.getElementById('modelForm').dataset.revision=revision;showToast('历史配置已载入表单，点击保存后生效');};
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
        vipOnly: document.getElementById('m_vip_only').checked ? 1 : 0,
        enabled: document.getElementById('m_enabled').checked ? 1 : 0
      };
      try {
        const raw=document.getElementById('m_capability').value.trim();
        const template=document.getElementById('m_template').value;
        if(raw||template)model.capability={...(raw?JSON.parse(raw):{}),version:1,...(template?{template}:{})};
        if(document.getElementById('m_asset_workflow').checked){
          if(template!=='seedance'||model.provider!=='duoyuanx')throw new Error('素材库需要 seedance 模板与 duoyuanx 供应商');
          model.capability.assetWorkflow='seedance-library-v1';
        }else if(model.capability){delete model.capability.assetWorkflow;}
        if(template==='minimax'&&model.provider==='duoyuanx'){
          const costs={};
          for(const key of ['enhance','remix']){const value=document.getElementById('m_h3_'+key+'_cost').value.trim();if(value!=='')costs[key]=Number(value);}
          model.capability.h3OperationCosts=costs;
        }else if(model.capability){delete model.capability.h3OperationCosts;}
        model.expectedRevision=Number(document.getElementById('modelForm').dataset.revision||0);
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

    // Test Provider Connectivity
    window.testProvider = async function(p) {
      const resEl = document.getElementById('test_' + p + '_res');
      if (resEl) {
        resEl.style.color = '#818cf8';
        resEl.textContent = '正在探测连通性...';
      }
      try {
        const inputKey = document.getElementById('cfg_' + p + '_key')?.value?.trim() || null;
        const inputBase = document.getElementById('cfg_' + p + '_base')?.value?.trim() || null;
        const res = await adminFetch('/api/admin/providers/test', {
          method: 'POST',
          body: JSON.stringify({ provider: p, apiKey: inputKey, baseUrl: inputBase })
        });
        const d = await res.json();
        if (d.ok) {
          if (resEl) {
            resEl.style.color = '#10b981';
            const countInfo = d.modelCount != null ? (', ' + d.modelCount + '个模型') : '';
            resEl.textContent = '✓ 连通正常 (' + d.latency + 'ms, HTTP ' + d.status + countInfo + ')';
          }
          showToast(p + ' 上游连通正常 (' + d.latency + 'ms)', 'success');
        } else {
          if (resEl) {
            resEl.style.color = '#ef4444';
            resEl.textContent = '✗ ' + (d.error || '连通失败') + ' (' + d.latency + 'ms, HTTP ' + d.status + ')';
          }
          showToast(p + ' 探测失败: ' + (d.error || '连接异常'), 'error');
        }
      } catch (err) {
        if (resEl) {
          resEl.style.color = '#ef4444';
          resEl.textContent = '✗ 请求错误: ' + err.message;
        }
        showToast('探测请求异常: ' + err.message, 'error');
      }
    };

    // User Search Debounce
    let searchTimer = null;
    window.debounceUserSearch = function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        loadUsers();
      }, 350);
    };

    // Load Users
    async function loadUsers() {
      try {
        const search = document.getElementById('userSearchInput')?.value?.trim() || '';
        const url = '/api/admin/users?limit=50' + (search ? '&search=' + encodeURIComponent(search) : '');
        const res = await adminFetch(url);
        const d = await res.json();
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        if (!d.users || d.users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无匹配创作者</td></tr>';
          return;
        }
        d.users.forEach(u => {
          const tr = document.createElement('tr');
          const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '-';
          const isVip = u.isVip === 1;
          const vipBadge = isVip
            ? '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.5);">👑 VIP会员</span>'
            : '<span class="badge" style="background: rgba(255, 255, 255, 0.06); color: #94a3b8;">普通创作者</span>';
          
          const isSuspended = u.status === 'suspended';
          const statusBadge = isSuspended
            ? '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 已冻结</span>'
            : '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">● 正常</span>';

          tr.innerHTML = \`
            <td>
              <div style="font-weight: 600; color: #fff;">\${u.email || u.username}</div>
              <small class="mono" style="color: var(--text-muted); font-size: 0.72rem;">ID: \${u.id.slice(0, 8)}...</small>
            </td>
            <td><strong style="color: #34d399; font-size: 1.05rem;">\${u.quotaBalance}</strong> <small style="color: var(--text-muted);">分</small></td>
            <td>\${vipBadge}</td>
            <td>\${statusBadge}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${dateStr}</td>
            <td>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="openAdjustModal('\${u.id}', '\${u.email || u.username}')">充值/退费</button>
                <button class="btn btn-secondary btn-sm" style="color: #fbbf24;" onclick="openVipModal('\${u.id}', '\${u.email || u.username}', \${isVip}, \${u.vipExpiresAt || 0})">VIP</button>
                <button class="btn btn-secondary btn-sm" style="\${isSuspended ? 'color: #34d399;' : 'color: #f87171;'}" onclick="toggleUserStatus('\${u.id}', '\${u.status || 'active'}')">\${isSuspended ? '解冻' : '冻结'}</button>
                <button class="btn btn-secondary btn-sm" onclick="openUserLogsModal('\${u.id}', '\${u.email || u.username}')">流水</button>
              </div>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error(err);
      }
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
        showToast('调账成功，最新积分：' + d.newBalance, 'success');
        closeAdjustModal();
        loadUsers();
        loadStats();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // VIP Modal handlers
    window.openVipModal = function(userId, display, isVip, expiresAt) {
      document.getElementById('vip_user_id').value = userId;
      let info = display;
      if (isVip) {
        const expStr = expiresAt === -1 ? '终身永久' : (expiresAt ? new Date(expiresAt).toLocaleDateString('zh-CN') : '已生效');
        info += ' [当前已是 VIP · 到期: ' + expStr + ']';
      } else {
        info += ' [当前为普通创作者]';
      }
      document.getElementById('vip_user_display').textContent = info;
      document.getElementById('vipModal').classList.add('active');
    };
    window.closeVipModal = function() {
      document.getElementById('vipModal').classList.remove('active');
    };
    window.handleSaveVip = async function(e) {
      e.preventDefault();
      const userId = document.getElementById('vip_user_id').value;
      const val = parseInt(document.getElementById('vip_action').value, 10);
      const isVip = val !== 0;
      const days = val;
      try {
        const res = await adminFetch('/api/admin/users/vip', {
          method: 'POST',
          body: JSON.stringify({ userId, isVip, days })
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast(isVip ? '已成功开通/续期 VIP 会员！' : '已取消该用户 VIP 身份', 'success');
        closeVipModal();
        loadUsers();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    // User Account Status Toggle
    window.toggleUserStatus = async function(userId, currentStatus) {
      const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
      const promptText = nextStatus === 'suspended' ? '确认冻结该用户账号吗？冻结后该用户将无法调用任何 API' : '确认解冻该用户账号吗？';
      if (!confirm(promptText)) return;
      try {
        const res = await adminFetch('/api/admin/users/status', {
          method: 'POST',
          body: JSON.stringify({ userId, status: nextStatus })
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast(nextStatus === 'suspended' ? '账号已冻结' : '账号已恢复正常', 'success');
        loadUsers();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    // User Single Logs Modal
    window.openUserLogsModal = async function(userId, display) {
      document.getElementById('userLogsTitle').textContent = '创作者: ' + display + ' (ID: ' + userId + ')';
      const tbody = document.getElementById('userLogsTableBody');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">正在拉取流水...</td></tr>';
      document.getElementById('userLogsModal').classList.add('active');

      try {
        const res = await adminFetch('/api/admin/users/logs?userId=' + encodeURIComponent(userId));
        const d = await res.json();
        tbody.innerHTML = '';
        if (!d.logs || d.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">该用户暂无消费或充值流水</td></tr>';
          return;
        }
        d.logs.forEach(l => {
          const tr = document.createElement('tr');
          const dateStr = l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN') : '-';
          const isTopup = l.quotaCost < 0;
          const costDisplay = isTopup
            ? '<span style="color: #34d399; font-weight: 600;">+' + Math.abs(l.quotaCost) + ' (充值)</span>'
            : '<span style="color: #f87171; font-weight: 600;">-' + l.quotaCost + ' (消耗)</span>';
          tr.innerHTML = \`
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${dateStr}</td>
            <td><span class="badge \${isTopup ? 'badge-success' : 'badge-primary'}">\${l.resourceType}</span></td>
            <td>\${l.modelId || '-'}</td>
            <td>\${costDisplay}</td>
            <td class="mono" style="font-size: 0.75rem; color: var(--text-muted);">\${l.requestId || '-'}</td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #f87171;">流水拉取失败: ' + err.message + '</td></tr>';
      }
    };
    window.closeUserLogsModal = function() {
      document.getElementById('userLogsModal').classList.remove('active');
    };

    // Notification Tab Handlers
    window.toggleNotifUserField = function() {
      const isSingle = document.getElementById('notif_target').value === 'single';
      document.getElementById('notif_user_group').style.display = isSingle ? 'block' : 'none';
    };

    window.handleSendNotification = async function(e) {
      e.preventDefault();
      const target = document.getElementById('notif_target').value;
      const userId = target === 'single' ? document.getElementById('notif_user_id').value.trim() : '*';
      const kind = document.getElementById('notif_kind').value;
      const title = document.getElementById('notif_title').value.trim();
      const content = document.getElementById('notif_content').value.trim();

      if (target === 'single' && !userId) {
        showToast('请输入指定用户的 ID 或邮箱', 'error');
        return;
      }

      try {
        const res = await adminFetch('/api/admin/notifications', {
          method: 'POST',
          body: JSON.stringify({ userId, kind, title, content })
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('消息已成功推送给客户端！', 'success');
        document.getElementById('notif_title').value = '';
        document.getElementById('notif_content').value = '';
        loadNotifications();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    async function loadNotifications() {
      try {
        const res = await adminFetch('/api/admin/notifications');
        const d = await res.json();
        const tbody = document.getElementById('notificationsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!d.notifications || d.notifications.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无历史推送</td></tr>';
          return;
        }
        d.notifications.forEach(n => {
          const tr = document.createElement('tr');
          const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleString('zh-CN') : '-';
          const targetDisplay = n.userId === '*'
            ? '<span class="badge badge-primary">📢 全体广播</span>'
            : '<span class="badge" style="background: rgba(139,92,246,0.2); color: #c084fc;">👤 私信 (' + n.userId.slice(0, 8) + '...)</span>';
          tr.innerHTML = \`
            <td style="color: var(--text-muted); font-size: 0.8rem;">\${dateStr}</td>
            <td>\${targetDisplay}</td>
            <td><span class="badge badge-secondary">\${n.kind === 'official' ? '官方公告' : '活动'}</span></td>
            <td style="font-weight: 600;">\${n.title}</td>
            <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; color: var(--text-muted);">\${n.content}</td>
            <td>
              <button class="btn btn-secondary btn-sm" style="color: #f87171;" onclick="deleteNotificationItem('\${n.id}')">撤回</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch {}
    }

    window.deleteNotificationItem = async function(id) {
      if (!confirm('确认撤回此条通知消息吗？撤回后客户端将不再展示')) return;
      try {
        const res = await adminFetch('/api/admin/notifications?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error);
        showToast('通知已撤回删除', 'success');
        loadNotifications();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

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
            ? '<span style="color: #34d399; font-weight: 600;">+' + Math.abs(l.quotaCost) + ' (充值)</span>'
            : '<span style="color: #f87171; font-weight: 600;">-' + l.quotaCost + ' (消耗)</span>';
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
      loadNotifications();
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
