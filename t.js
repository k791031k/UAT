javascript:(function() {
  if (window.__PRODUCT_QUERY_TOOL__) return;
  window.__PRODUCT_QUERY_TOOL__ = true;

  // 建立容器和遮罩
  const maskElement = document.createElement('div');
  maskElement.className = 'pct-modal-mask';
  maskElement.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: rgba(0, 0, 0, 0.5) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  `;
  document.body.appendChild(maskElement);

  const container = document.createElement('div');
  container.className = 'pct-modal';
  container.style.cssText = `
    width: 1200px !important;
    max-height: 85vh !important;
    background: white !important;
    border-radius: 12px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
    display: flex !important;
    flex-direction: column !important;
    font-family: 'Segoe UI', system-ui, sans-serif !important;
    overflow: hidden !important;
    position: relative !important;
  `;
  maskElement.appendChild(container);

  // Shadow DOM 設置
  const shadow = container.attachShadow({ mode: 'open' });

  // 完整的樣式表
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }

    /* 全域樣式 */
    .pct-modal {
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      color: #2d3748;
      line-height: 1.5;
    }

    /* 標題列 */
    .pct-modal-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      user-select: none;
    }
    .pct-modal-header:active { cursor: grabbing; }
    .pct-modal-title {
      font-size: 18px;
      font-weight: 600;
    }
    .pct-close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .pct-close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    /* 內容區 */
    .pct-modal-body {
      flex: 1;
      overflow: auto;
      padding: 24px;
    }

    /* 頁腳 */
    .pct-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }

    /* Toast 提示 */
    .pct-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000000;
      animation: slideDown 0.3s ease;
      max-width: 400px;
      text-align: center;
    }
    .pct-toast.success { background: #48bb78; }
    .pct-toast.error { background: #f56565; }
    .pct-toast.warning { background: #ed8936; }
    .pct-toast.info { background: #4299e1; }

    @keyframes slideDown {
      from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    /* 進度條 */
    .pct-progress-bar {
      background: #e2e8f0;
      height: 6px;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .pct-progress-bar-fill {
      background: #4299e1;
      height: 100%;
      transition: width 0.3s ease;
    }
    .pct-progress-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .pct-progress-text { flex: 1; font-size: 13px; color: #4a5568; }
    .pct-abort-btn {
      background: #f56565;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    /* 表單元素 */
    .pct-input, .pct-textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s;
    }
    .pct-input:focus, .pct-textarea:focus {
      outline: none;
      border-color: #4299e1;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
    }
    .pct-textarea {
      resize: vertical;
      min-height: 120px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .pct-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #2d3748;
    }

    .pct-error-message {
      color: #f56565;
      font-size: 13px;
      margin-top: 8px;
      display: none;
    }
    .pct-error-message.show { display: block; }

    /* 按鈕系統 */
    .pct-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      user-select: none;
    }

    .pct-btn-primary {
      background: #4299e1;
      color: white;
    }
    .pct-btn-primary:hover { background: #3182ce; }
    .pct-btn-primary:disabled {
      background: #a0aec0;
      cursor: not-allowed;
    }

    .pct-btn-secondary {
      background: #edf2f7;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }
    .pct-btn-secondary:hover { background: #e2e8f0; }

    .pct-btn-success {
      background: #48bb78;
      color: white;
    }
    .pct-btn-success:hover { background: #38a169; }

    .pct-btn-warning {
      background: #ed8936;
      color: white;
    }
    .pct-btn-warning:hover { background: #dd6b20; }

    .pct-btn-small {
      padding: 6px 12px;
      font-size: 12px;
    }

    /* 查詢模式卡片 */
    .pct-mode-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .pct-mode-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .pct-mode-card:hover {
      border-color: #4299e1;
      background: #f0f8ff;
      box-shadow: 0 4px 12px rgba(66, 153, 225, 0.15);
      transform: translateY(-2px);
    }

    .pct-mode-card.selected {
      background: #4299e1;
      border-color: #4299e1;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(66, 153, 225, 0.3);
    }

    .pct-mode-card h3 {
      margin-bottom: 8px;
      font-size: 16px;
    }

    .pct-mode-card p {
      font-size: 13px;
      opacity: 0.8;
      margin-bottom: 0;
    }

    /* 動態選項區 */
    .pct-dynamic-options {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
    }

    .pct-option-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .pct-option-card {
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      font-size: 13px;
    }

    .pct-option-card:hover {
      border-color: #4299e1;
      background: #f0f8ff;
    }

    .pct-option-card.selected {
      background: #4299e1;
      border-color: #4299e1;
      color: white;
    }

    /* 表格樣式 */
    .pct-table-container {
      flex: 1;
      overflow: auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: white;
    }

    .pct-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .pct-table th {
      background: #f7fafc;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }

    .pct-table th:hover {
      background: #edf2f7;
    }

    .pct-table th.sortable::after {
      content: '';
      margin-left: 6px;
      opacity: 0.4;
    }
    .pct-table th.sort-asc::after { content: '▲'; opacity: 1; }
    .pct-table th.sort-desc::after { content: '▼'; opacity: 1; }

    .pct-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #f1f5f9;
      cursor: cell;
      transition: all 0.2s;
      position: relative;
    }

    .pct-table td:hover {
      background: #f0f9ff;
    }

    .pct-table tr:hover {
      background: #f0f9ff;
    }

    .pct-table tr.pct-special-row {
      background: #fefce8;
      border-left: 4px solid #eab308;
    }

    .pct-table tr.pct-special-row:hover {
      background: #fef3c7;
    }

    .pct-table tr.pct-reload-row {
      cursor: pointer;
    }

    /* 狀態標籤 */
    .pct-status-pill {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .pct-status-onsale { background: #c6f6d5; color: #22543d; }
    .pct-status-stopped { background: #fed7d7; color: #742a2a; }
    .pct-status-notyet { background: #bee3f8; color: #2c5282; }
    .pct-status-error { background: #fef5e7; color: #c05621; }

    /* 通路顯示 */
    .pct-channels {
      font-size: 12px;
      line-height: 1.4;
    }

    .pct-channel-active {
      color: #3182ce;
      font-weight: 600;
      margin-right: 4px;
      cursor: help;
    }

    .pct-channel-inactive {
      color: #e53e3e;
      margin-right: 4px;
      cursor: help;
    }

    .pct-channel-separator {
      color: #718096;
      margin: 0 6px;
    }

    /* 搜尋和篩選 */
    .pct-search-container {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .pct-search-input {
      flex: 1;
      min-width: 200px;
    }

    .pct-filter-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pct-filter-btn {
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .pct-filter-btn:hover {
      border-color: #4299e1;
      background: #f0f8ff;
    }

    .pct-filter-btn.selected {
      background: #4299e1;
      color: white;
      border-color: #4299e1;
    }

    /* 分頁器 */
    .pct-pagination {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .pct-pagination button {
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .pct-pagination button:hover:not(:disabled) {
      background: #f0f8ff;
      border-color: #4299e1;
    }

    .pct-pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* 工具提示 */
    .pct-tooltip {
      position: absolute;
      background: #1a202c;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .pct-tooltip::before {
      content: '';
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid #1a202c;
    }

    /* 等寬字體 */
    .pct-monospace {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    }

    /* 空狀態 */
    .pct-empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #718096;
    }

    .pct-empty-state h3 {
      font-size: 18px;
      color: #2d3748;
      margin-bottom: 12px;
    }

    .pct-empty-state p {
      margin-bottom: 20px;
      line-height: 1.6;
    }

    /* 隱藏滾動條 */
    .pct-table-container::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .pct-table-container::-webkit-scrollbar-track {
      background: #f1f5f9;
    }

    .pct-table-container::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }

    .pct-table-container::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }
  `;
  shadow.appendChild(styleSheet);

  // 狀態管理
  const state = {
    view: 'token', // token, query, result, loading
    token: '',
    autoDetected: false,
    selectedMode: '',
    selectedOptions: {},
    data: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    searchKeyword: '',
    sortField: '',
    sortDirection: '',
    specialOnly: false,
    onePageMode: false,
    loading: false,
    progress: { current: 0, total: 0, text: '' }
  };

  // 拖拽功能
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // 工具函式
  const utils = {
    showToast(message, type = 'info') {
      const existing = shadow.querySelector('.pct-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = `pct-toast ${type}`;
      toast.textContent = message;
      shadow.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    },

    createTooltip(text, x, y) {
      const existing = shadow.querySelector('.pct-tooltip');
      if (existing) existing.remove();

      const tooltip = document.createElement('div');
      tooltip.className = 'pct-tooltip';
      tooltip.textContent = text;
      tooltip.style.left = x + 'px';
      tooltip.style.top = (y - 35) + 'px';
      shadow.appendChild(tooltip);
    },

    hideTooltip() {
      const tooltip = shadow.querySelector('.pct-tooltip');
      if (tooltip) tooltip.remove();
    },

    copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('已複製', 'success');
      }).catch(() => {
        this.showToast('複製失敗', 'error');
      });
    },

    extractToken() {
      const keys = ['SSO-TOKEN', 'euisToken'];
      for (const key of keys) {
        const token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (token) return { token, source: key };
      }
      return null;
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[1]}${match[2]}${match[3]}` : dateStr;
    },

    getSaleStatus(startDate, endDate) {
      if (!startDate || !endDate) return 'error';
      const now = new Date();
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) return 'error';
      if (now < start) return 'notyet';
      if (now > end) return 'stopped';
      return 'onsale';
    },

    updateProgress(current, total, text) {
      state.progress = { current, total, text };
      const container = shadow.querySelector('.pct-progress-container');
      if (container) {
        const progressBar = container.querySelector('.pct-progress-bar-fill');
        const progressText = container.querySelector('.pct-progress-text');
        if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
        if (progressText) progressText.textContent = text;
      }
    }
  };

  // 渲染引擎
  const renderer = {
    render() {
      const content = this.getContent();
      shadow.innerHTML = '';
      shadow.appendChild(styleSheet);
      
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content;
      shadow.appendChild(wrapper);
      
      this.bindEvents();
    },

    getContent() {
      const header = `
        <div class="pct-modal-header" id="modal-header">
          <div class="pct-modal-title">${this.getTitle()}</div>
          <button class="pct-close-btn" onclick="closeTool()">×</button>
        </div>
      `;

      const footer = this.getFooter();
      const body = this.getBody();

      return `
        <div class="pct-modal">
          ${header}
          <div class="pct-modal-body">
            ${body}
          </div>
          ${footer ? `<div class="pct-modal-footer">${footer}</div>` : ''}
        </div>
      `;
    },

    getTitle() {
      switch (state.view) {
        case 'token': return '設定 Token';
        case 'query': return '選擇查詢條件';
        case 'result': return `查詢結果 (${state.filteredData.length || state.data.length} 筆)`;
        default: return '商品查詢小工具';
      }
    },

    getBody() {
      switch (state.view) {
        case 'token': return this.renderTokenView();
        case 'query': return this.renderQueryView();
        case 'result': return this.renderResultView();
        default: return '<div class="pct-empty-state"><h3>載入中...</h3></div>';
      }
    },

    getFooter() {
      switch (state.view) {
        case 'token': return this.renderTokenFooter();
        case 'query': return this.renderQueryFooter();
        case 'result': return this.renderResultFooter();
        default: return '';
      }
    },

    renderTokenView() {
      return `
        <div>
          <label class="pct-label">SSO Token</label>
          <textarea class="pct-textarea" 
                    id="token-input" 
                    placeholder="請貼上您的 SSO Token..."
                    ${state.loading ? 'disabled' : ''}>${state.token}</textarea>
          <div class="pct-error-message" id="token-error"></div>
        </div>
      `;
    },

    renderTokenFooter() {
      return `
        <div></div>
        <div style="display: flex; gap: 12px;">
          <button class="pct-btn pct-btn-primary" 
                  id="verify-btn" 
                  ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '⏳ 驗證中...' : '驗證'}
          </button>
          <button class="pct-btn pct-btn-secondary" 
                  id="skip-btn"
                  ${state.loading ? 'disabled' : ''}>
            略過
          </button>
        </div>
      `;
    },

    renderQueryView() {
      const modes = [
        { id: 'code', title: '商品代號', desc: '輸入單筆或多筆商品代號' },
        { id: 'name', title: '商品名稱', desc: '輸入商品名稱關鍵字搜尋' },
        { id: 'channel', title: '通路銷售時間', desc: '查詢特定通路的銷售商品' },
        { id: 'status', title: '依銷售狀態', desc: '查詢特定銷售狀態的商品' }
      ];

      const modeCards = modes.map(mode => `
        <div class="pct-mode-card ${state.selectedMode === mode.id ? 'selected' : ''}" 
             onclick="selectMode('${mode.id}')">
          <h3>${mode.title}</h3>
          <p>${mode.desc}</p>
        </div>
      `).join('');

      const dynamicOptions = this.renderDynamicOptions();

      return `
        <div class="pct-mode-grid">
          ${modeCards}
        </div>
        ${dynamicOptions}
        <div class="pct-error-message" id="query-error"></div>
      `;
    },

    renderDynamicOptions() {
      if (!state.selectedMode) return '';

      switch (state.selectedMode) {
        case 'code':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">商品代號（多筆請用空格、逗號或換行分隔）</label>
              <textarea class="pct-textarea" 
                        id="code-input" 
                        placeholder="例如：AALI BBLI CCLI&#10;或每行一個代號"></textarea>
            </div>
          `;
        case 'name':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">商品名稱關鍵字</label>
              <input type="text" 
                     class="pct-input" 
                     id="name-input" 
                     placeholder="例如：健康、終身" />
            </div>
          `;
        case 'channel':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">選擇通路（可多選）</label>
              <div class="pct-option-grid">
                ${['AG', 'BK', 'BR', 'WS'].map(ch => `
                  <div class="pct-option-card ${(state.selectedOptions.channels || []).includes(ch) ? 'selected' : ''}"
                       onclick="toggleChannelOption('${ch}')">
                    ${ch}
                  </div>
                `).join('')}
              </div>
              <label class="pct-label" style="margin-top: 16px;">銷售範圍</label>
              <div class="pct-option-grid">
                ${[
                  { id: 'current', label: '現售商品' },
                  { id: 'all', label: '全部商品' }
                ].map(opt => `
                  <div class="pct-option-card ${state.selectedOptions.range === opt.id ? 'selected' : ''}"
                       onclick="selectRangeOption('${opt.id}')">
                    ${opt.label}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        case 'status':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">選擇銷售狀態</label>
              <div class="pct-option-grid">
                ${[
                  { id: 'onsale', label: '🟢 現售' },
                  { id: 'stopped', label: '🔴 停售' },
                  { id: 'notyet', label: '🔵 尚未開賣' },
                  { id: 'error', label: '🟡 日期異常' }
                ].map(status => `
                  <div class="pct-option-card ${state.selectedOptions.status === status.id ? 'selected' : ''}"
                       onclick="selectStatusOption('${status.id}')">
                    ${status.label}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        default:
          return '';
      }
    },

    renderQueryFooter() {
      return `
        <button class="pct-btn pct-btn-secondary" onclick="goBackToToken()">
          修改 Token
        </button>
        <button class="pct-btn pct-btn-primary" 
                id="start-query-btn"
                ${this.canStartQuery() ? '' : 'disabled'}>
          開始查詢
        </button>
      `;
    },

    canStartQuery() {
      if (!state.selectedMode) return false;
      
      switch (state.selectedMode) {
        case 'code':
        case 'name':
          return true; // 輸入驗證在點擊時進行
        case 'channel':
          return (state.selectedOptions.channels || []).length > 0 && state.selectedOptions.range;
        case 'status':
          return state.selectedOptions.status;
        default:
          return false;
      }
    },

    renderResultView() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      const paginatedData = this.getPaginatedData(currentData);

      return `
        ${state.loading ? this.renderProgress() : ''}
        ${this.renderSearchAndFilters()}
        <div class="pct-table-container">
          ${this.renderTable(paginatedData)}
        </div>
      `;
    },

    renderProgress() {
      return `
        <div class="pct-progress-container">
          <div class="pct-progress-text">${state.progress.text}</div>
          <div class="pct-progress-bar">
            <div class="pct-progress-bar-fill" style="width: ${(state.progress.current / state.progress.total) * 100}%"></div>
          </div>
          <button class="pct-abort-btn" onclick="abortQuery()">中止查詢</button>
        </div>
      `;
    },

    renderSearchAndFilters() {
      const statusFilters = state.selectedMode === 'channel' ? `
        <div class="pct-filter-buttons">
          ${['onsale', 'stopped', 'notyet', 'error'].map(status => `
            <button class="pct-filter-btn ${state.statusFilters && state.statusFilters.includes(status) ? 'selected' : ''}"
                    onclick="toggleStatusFilter('${status}')">
              ${this.getStatusLabel(status)}
            </button>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="pct-search-container">
          <input type="text" 
                 class="pct-input pct-search-input" 
                 id="search-input"
                 placeholder="🔍 搜尋表格內容..."
                 value="${state.searchKeyword}" />
          ${statusFilters}
        </div>
      `;
    },

    renderTable(data) {
      if (!data.length) {
        return `
          <div class="pct-empty-state">
            <h3>📭 查無資料</h3>
            <p>請調整搜尋條件或重新查詢</p>
          </div>
        `;
      }

      const headers = this.getTableHeaders().map(col => `
        <th class="sortable ${state.sortField === col.id ? `sort-${state.sortDirection}` : ''}"
            onclick="sortTable('${col.id}')">
          ${col.label}
        </th>
      `).join('');

      const rows = data.map(row => {
        const isSpecial = this.isSpecialRow(row);
        const isReloadable = this.isReloadableRow(row);
        
        return `
          <tr class="${isSpecial ? 'pct-special-row' : ''} ${isReloadable ? 'pct-reload-row' : ''}"
              ${isSpecial ? `title="${this.getSpecialReason(row)}"` : ''}
              ${isReloadable ? `onclick="reloadRowData('${row.planCode}')"` : ''}>
            ${this.renderTableCells(row)}
          </tr>
        `;
      }).join('');

      return `
        <table class="pct-table">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    },

    getTableHeaders() {
      return [
        { id: 'no', label: '#' },
        { id: 'planCode', label: '代號' },
        { id: 'shortName', label: '名稱' },
        { id: 'currency', label: '幣別' },
        { id: 'unit', label: '單位' },
        { id: 'coverageType', label: '類型' },
        { id: 'saleStartDate', label: '銷售起日' },
        { id: 'saleEndDate', label: '銷售迄日' },
        { id: 'mainStatus', label: '狀態' },
        { id: 'channels', label: '銷售通路' }
      ];
    },

    renderTableCells(row) {
      return this.getTableHeaders().map(col => {
        let value = row[col.id] || '';
        let className = '';
        let onClick = '';

        // 特殊欄位處理
        if (col.id === 'planCode') {
          className = 'pct-monospace';
        } else if (col.id === 'mainStatus') {
          value = this.renderStatusPill(row.mainStatus);
        } else if (col.id === 'channels') {
          value = this.renderChannels(row.channels);
          onClick = ''; // 通路欄位不可複製
        }

        // 一般欄位可複製
        if (col.id !== 'channels' && col.id !== 'mainStatus') {
          onClick = `onclick="copyCell('${value}')"`;
        }

        return `<td class="${className}" ${onClick}>${value}</td>`;
      }).join('');
    },

    renderStatusPill(status) {
      const labels = {
        onsale: '🟢 現售',
        stopped: '🔴 停售',
        notyet: '🔵 尚未開賣',
        error: '🟡 日期異常'
      };
      return `<span class="pct-status-pill pct-status-${status}">${labels[status] || status}</span>`;
    },

    renderChannels(channels) {
      if (!channels || !channels.length) return '';
      
      const active = channels.filter(ch => ch.status === 'onsale');
      const inactive = channels.filter(ch => ch.status !== 'onsale');
      
      const activeHTML = active.map(ch => 
        `<span class="pct-channel-active"
               onmouseover="showChannelTooltip(event, '${ch.channel} (現售): ${ch.saleStartDate}-${ch.saleEndDate}')"
               onmouseout="hideChannelTooltip()">${ch.channel}</span>`
      ).join('');
      
      const inactiveHTML = inactive.map(ch => 
        `<span class="pct-channel-inactive"
               onmouseover="showChannelTooltip(event, '${ch.channel} (${this.getStatusLabel(ch.status)}): ${ch.saleStartDate}-${ch.saleEndDate}')"
               onmouseout="hideChannelTooltip()">${ch.channel}</span>`
      ).join('');
      
      const separator = active.length && inactive.length ? '<span class="pct-channel-separator">|</span>' : '';
      
      return `<div class="pct-channels">${activeHTML}${separator}${inactiveHTML}</div>`;
    },

    renderResultFooter() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      state.totalPages = Math.ceil(currentData.length / state.pageSize);

      return `
        <div style="display: flex; gap: 12px; align-items: center;">
          <button class="pct-btn pct-btn-small pct-btn-secondary" 
                  onclick="togglePageMode()">
            ${state.onePageMode ? '分頁顯示' : '一頁顯示'}
          </button>
          <button class="pct-btn pct-btn-small pct-btn-warning ${state.specialOnly ? 'selected' : ''}" 
                  onclick="toggleSpecialFilter()">
            篩選特殊
          </button>
        </div>

        <div class="pct-pagination">
          <button onclick="changePage(${state.currentPage - 1})" 
                  ${state.currentPage <= 1 || state.onePageMode ? 'disabled' : ''}>◀</button>
          <span>${state.onePageMode ? '全部' : `${state.currentPage} / ${state.totalPages}`}</span>
          <button onclick="changePage(${state.currentPage + 1})" 
                  ${state.currentPage >= state.totalPages || state.onePageMode ? 'disabled' : ''}>▶</button>
        </div>

        <div style="display: flex; gap: 12px;">
          <button class="pct-btn pct-btn-success" onclick="copyAllData()">
            一鍵複製
          </button>
          <button class="pct-btn pct-btn-primary" onclick="goBackToQuery()">
            重新查詢
          </button>
        </div>
      `;
    },

    getPaginatedData(data) {
      if (state.onePageMode) return data;
      
      const start = (state.currentPage - 1) * state.pageSize;
      const end = start + state.pageSize;
      return data.slice(start, end);
    },

    isSpecialRow(row) {
      // 判斷是否為特殊狀態列的邏輯
      return row.specialReason && row.specialReason.length > 0;
    },

    isReloadableRow(row) {
      // 判斷是否可重載的邏輯
      return row._needsReload || false;
    },

    getSpecialReason(row) {
      return row.specialReason || '';
    },

    getStatusLabel(status) {
      const labels = {
        onsale: '現售',
        stopped: '停售',
        notyet: '尚未開賣',
        error: '日期異常'
      };
      return labels[status] || status;
    },

    bindEvents() {
      // 拖拽功能
      const header = shadow.querySelector('#modal-header');
      if (header) {
        header.addEventListener('mousedown', (e) => {
          isDragging = true;
          const rect = container.getBoundingClientRect();
          dragOffset.x = e.clientX - rect.left;
          dragOffset.y = e.clientY - rect.top;
          document.addEventListener('mousemove', handleDrag);
          document.addEventListener('mouseup', stopDrag);
        });
      }

      // Token 相關事件
      const verifyBtn = shadow.querySelector('#verify-btn');
      const skipBtn = shadow.querySelector('#skip-btn');
      const tokenInput = shadow.querySelector('#token-input');

      if (verifyBtn) {
        verifyBtn.addEventListener('click', handleTokenVerify);
      }
      if (skipBtn) {
        skipBtn.addEventListener('click', handleTokenSkip);
      }
      if (tokenInput) {
        tokenInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            handleTokenVerify();
          }
        });
      }

      // 查詢相關事件
      const startQueryBtn = shadow.querySelector('#start-query-btn');
      if (startQueryBtn) {
        startQueryBtn.addEventListener('click', handleStartQuery);
      }

      // 各種輸入事件
      const inputs = ['code-input', 'name-input'];
      inputs.forEach(id => {
        const input = shadow.querySelector(`#${id}`);
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              handleStartQuery();
            }
          });
        }
      });

      // 搜尋事件
      const searchInput = shadow.querySelector('#search-input');
      if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            handleSearch(e.target.value);
          }, 1000); // 1秒延遲
        });
      }

      // ESC 鍵關閉
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeTool();
        }
      });
    }
  };

  // 事件處理函式
  function handleDrag(e) {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    container.style.left = Math.max(0, Math.min(x, window.innerWidth - container.offsetWidth)) + 'px';
    container.style.top = Math.max(0, Math.min(y, window.innerHeight - container.offsetHeight)) + 'px';
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  async function handleTokenVerify() {
    const tokenInput = shadow.querySelector('#token-input');
    const token = tokenInput.value.trim();
    
    if (!token) {
      showError('token-error', '請輸入 Token');
      return;
    }

    state.loading = true;
    hideError('token-error');
    renderer.render();

    try {
      // 這裡放置 Token 驗證邏輯
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模擬 API 呼叫
      
      state.token = token;
      state.view = 'query';
      utils.showToast('Token 驗證成功', 'success');
    } catch (error) {
      showError('token-error', 'Token 驗證失敗，請檢查後重試');
    } finally {
      state.loading = false;
      renderer.render();
    }
  }

  function handleTokenSkip() {
    const tokenInput = shadow.querySelector('#token-input');
    state.token = tokenInput ? tokenInput.value.trim() : '';
    state.view = 'query';
    utils.showToast('已略過驗證', 'warning');
    renderer.render();
  }

  async function handleStartQuery() {
    // 驗證輸入
    const validation = validateQueryInput();
    if (!validation.valid) {
      showError('query-error', validation.message);
      return;
    }

    hideError('query-error');
    
    // 開始查詢
    state.view = 'result';
    state.loading = true;
    state.data = [];
    state.filteredData = [];
    renderer.render();

    try {
      // 模擬批量查詢
      const batches = Math.ceil(Math.random() * 5) + 1;
      for (let i = 0; i < batches; i++) {
        utils.updateProgress(i, batches, `批量查詢第 ${i + 1}/${batches} 批...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 添加模擬資料
        const batchData = generateMockData(20);
        state.data.push(...batchData);
        renderer.render();
      }

      utils.updateProgress(batches, batches, '查詢完成');
      utils.showToast(`查詢完成，找到 ${state.data.length} 筆資料`, 'success');
      
    } catch (error) {
      utils.showToast('查詢失敗', 'error');
    } finally {
      state.loading = false;
      renderer.render();
    }
  }

  function validateQueryInput() {
    if (!state.selectedMode) {
      return { valid: false, message: '請選擇查詢模式' };
    }

    switch (state.selectedMode) {
      case 'code':
        const codeInput = shadow.querySelector('#code-input');
        if (!codeInput || !codeInput.value.trim()) {
          return { valid: false, message: '請輸入商品代號' };
        }
        break;
      case 'name':
        const nameInput = shadow.querySelector('#name-input');
        if (!nameInput || !nameInput.value.trim()) {
          return { valid: false, message: '請輸入商品名稱關鍵字' };
        }
        break;
      case 'channel':
        if (!(state.selectedOptions.channels && state.selectedOptions.channels.length > 0)) {
          return { valid: false, message: '請至少選擇一個通路' };
        }
        if (!state.selectedOptions.range) {
          return { valid: false, message: '請選擇銷售範圍' };
        }
        break;
      case 'status':
        if (!state.selectedOptions.status) {
          return { valid: false, message: '請選擇銷售狀態' };
        }
        break;
    }

    return { valid: true };
  }

  function handleSearch(keyword) {
    state.searchKeyword = keyword;
    
    if (!keyword.trim()) {
      state.filteredData = [];
    } else {
      state.filteredData = state.data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }
    
    state.currentPage = 1;
    renderer.render();
  }

  // 模擬資料生成
  function generateMockData(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
      const statuses = ['onsale', 'stopped', 'notyet', 'error'];
      const channels = ['AG', 'BK', 'BR', 'WS'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      data.push({
        no: state.data.length + i + 1,
        planCode: 'TEST' + String(1000 + state.data.length + i),
        shortName: `測試商品 ${state.data.length + i + 1}`,
        currency: 'TWD',
        unit: '萬元',
        coverageType: Math.random() > 0.5 ? '主約' : '附約',
        saleStartDate: '20230101',
        saleEndDate: '20241231',
        mainStatus: status,
        channels: channels.slice(0, Math.floor(Math.random() * 3) + 1).map(ch => ({
          channel: ch,
          status: Math.random() > 0.3 ? 'onsale' : 'stopped',
          saleStartDate: '20230101',
          saleEndDate: '20241231'
        })),
        specialReason: Math.random() > 0.8 ? '主約已停售，但部分通路仍在售' : '',
        _needsReload: Math.random() > 0.7
      });
    }
    return data;
  }

  // 輔助函式
  function showError(elementId, message) {
    const errorElement = shadow.querySelector(`#${elementId}`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
  }

  function hideError(elementId) {
    const errorElement = shadow.querySelector(`#${elementId}`);
    if (errorElement) {
      errorElement.classList.remove('show');
    }
  }

  // 全域函式
  window.closeTool = () => {
    document.body.removeChild(maskElement);
    window.__PRODUCT_QUERY_TOOL__ = false;
  };

  window.selectMode = (modeId) => {
    state.selectedMode = modeId;
    state.selectedOptions = {};
    renderer.render();
  };

  window.toggleChannelOption = (channel) => {
    if (!state.selectedOptions.channels) {
      state.selectedOptions.channels = [];
    }
    
    const index = state.selectedOptions.channels.indexOf(channel);
    if (index > -1) {
      state.selectedOptions.channels.splice(index, 1);
    } else {
      state.selectedOptions.channels.push(channel);
    }
    
    renderer.render();
  };

  window.selectRangeOption = (range) => {
    state.selectedOptions.range = range;
    renderer.render();
  };

  window.selectStatusOption = (status) => {
    state.selectedOptions.status = status;
    renderer.render();
  };

  window.goBackToToken = () => {
    state.view = 'token';
    renderer.render();
  };

  window.goBackToQuery = () => {
    state.view = 'query';
    state.data = [];
    state.filteredData = [];
    renderer.render();
  };

  window.copyCell = (value) => {
    utils.copyToClipboard(value);
  };

  window.copyAllData = () => {
    const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
    const headers = renderer.getTableHeaders().map(h => h.label);
    const rows = currentData.map(row => 
      renderer.getTableHeaders().map(col => {
        if (col.id === 'channels') {
          return row.channels.map(ch => ch.channel).join(' ');
        }
        return row[col.id] || '';
      })
    );
    
    const text = [headers, ...rows].map(row => row.join('\t')).join('\n');
    utils.copyToClipboard(text);
  };

  window.sortTable = (field) => {
    const direction = state.sortField === field && state.sortDirection === 'asc' ? 'desc' : 'asc';
    const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
    
    currentData.sort((a, b) => {
      let aVal = a[field] || '';
      let bVal = b[field] || '';
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return direction === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    state.sortField = field;
    state.sortDirection = direction;
    renderer.render();
  };

  window.changePage = (page) => {
    if (page >= 1 && page <= state.totalPages) {
      state.currentPage = page;
      renderer.render();
    }
  };

  window.togglePageMode = () => {
    state.onePageMode = !state.onePageMode;
    state.currentPage = 1;
    renderer.render();
  };

  window.toggleSpecialFilter = () => {
    state.specialOnly = !state.specialOnly;
    
    if (state.specialOnly) {
      state.filteredData = state.data.filter(row => renderer.isSpecialRow(row));
    } else {
      state.filteredData = [];
    }
    
    state.currentPage = 1;
    renderer.render();
  };

  window.showChannelTooltip = (event, text) => {
    utils.createTooltip(text, event.pageX, event.pageY);
  };

  window.hideChannelTooltip = () => {
    utils.hideTooltip();
  };

  window.reloadRowData = (planCode) => {
    utils.showToast(`重新載入 ${planCode} 的資料...`, 'info');
    // 這裡放置重載邏輯
  };

  window.abortQuery = () => {
    state.loading = false;
    utils.showToast('查詢已中止', 'warning');
    renderer.render();
  };

  // 初始化
  const tokenResult = utils.extractToken();
  if (tokenResult) {
    state.token = tokenResult.token;
    state.autoDetected = true;
    state.view = 'query';
    utils.showToast(`已自動偵測到 Token (${tokenResult.source})`, 'info');
  }

  renderer.render();

})();
