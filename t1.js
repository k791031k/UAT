javascript:(function() {
  if (window.__PRODUCT_QUERY_TOOL__) return;
  window.__PRODUCT_QUERY_TOOL__ = true;

  // 建立遮罩和容器
  const maskElement = document.createElement('div');
  maskElement.className = 'pct-modal-mask';
  maskElement.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.4) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    backdrop-filter: blur(2px) !important;
  `;
  document.body.appendChild(maskElement);

  const container = document.createElement('div');
  container.className = 'pct-modal';
  container.style.cssText = `
    background: white !important;
    border-radius: 16px !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4) !important;
    display: flex !important;
    flex-direction: column !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
    overflow: hidden !important;
    position: relative !important;
    max-width: 95vw !important;
    max-height: 95vh !important;
  `;
  maskElement.appendChild(container);

  // Shadow DOM 設置
  const shadow = container.attachShadow({ mode: 'open' });

  // 完整樣式表
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }

    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
    }

    /* 視窗統一尺寸 */
    .pct-modal {
      font-family: inherit;
      font-size: 14px;
      color: #1f2937;
      line-height: 1.6;
      display: flex;
      flex-direction: column;
    }

    .pct-modal.small {
      width: 500px;
      height: 420px;
    }

    .pct-modal.large {
      width: 1000px;
      height: 700px;
    }

    /* 標題列 */
    .pct-modal-header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      user-select: none;
      position: relative;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .pct-modal-header:active { 
      cursor: grabbing; 
    }

    .pct-modal-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.025em;
    }

    .pct-close-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(8px);
    }

    .pct-close-btn:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.05);
    }

    /* 內容區 */
    .pct-modal-body {
      flex: 1;
      overflow: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      background: #fafbfc;
    }

    /* 頁腳 */
    .pct-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: white;
      min-height: 68px;
    }

    /* Toast 通知系統 */
    .pct-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 12px;
      color: white;
      font-weight: 500;
      z-index: 1000001;
      animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 400px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
    }

    .pct-toast.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .pct-toast.error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .pct-toast.warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .pct-toast.info { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }

    @keyframes slideDown {
      from { 
        transform: translateX(-50%) translateY(-20px); 
        opacity: 0; 
        scale: 0.95;
      }
      to { 
        transform: translateX(-50%) translateY(0); 
        opacity: 1; 
        scale: 1;
      }
    }

    /* 表單元素 */
    .pct-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
      font-size: 14px;
    }

    .pct-input, .pct-textarea {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
    }

    .pct-input:focus, .pct-textarea:focus {
      outline: none;
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }

    .pct-textarea {
      resize: vertical;
      min-height: 120px;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
      line-height: 1.5;
    }

    .pct-error-message {
      color: #ef4444;
      font-size: 13px;
      margin-top: 8px;
      font-weight: 500;
      display: none;
      background: #fef2f2;
      padding: 8px 12px;
      border-radius: 8px;
      border-left: 4px solid #ef4444;
    }

    .pct-error-message.show { 
      display: block; 
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 現代化按鈕系統 */
    .pct-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      user-select: none;
      position: relative;
      overflow: hidden;
    }

    .pct-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .pct-btn:hover::before {
      opacity: 1;
    }

    .pct-btn-primary {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
    }

    .pct-btn-primary:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4);
    }

    .pct-btn-primary:active {
      transform: translateY(0);
    }

    .pct-btn-primary:disabled {
      background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .pct-btn-secondary {
      background: white;
      color: #6b7280;
      border: 2px solid #e5e7eb;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .pct-btn-secondary:hover { 
      background: #f9fafb;
      border-color: #d1d5db;
      transform: translateY(-1px);
    }

    .pct-btn-success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    }

    .pct-btn-success:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
    }

    .pct-btn-small {
      padding: 8px 16px;
      font-size: 12px;
    }

    /* 查詢模式卡片 - 強化互動效果 */
    .pct-mode-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .pct-mode-card {
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      background: white;
      position: relative;
      overflow: hidden;
    }

    .pct-mode-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .pct-mode-card:hover {
      border-color: #4f46e5;
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 10px 25px rgba(79, 70, 229, 0.15);
    }

    .pct-mode-card:hover::before {
      opacity: 1;
    }

    .pct-mode-card:active {
      transform: translateY(-2px) scale(0.98);
    }

    .pct-mode-card.selected {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-color: #4f46e5;
      color: white;
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 15px 35px rgba(79, 70, 229, 0.3);
    }

    .pct-mode-card.selected::before {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      opacity: 1;
    }

    .pct-mode-card h3 {
      margin-bottom: 8px;
      font-size: 16px;
      font-weight: 600;
      position: relative;
      z-index: 1;
    }

    .pct-mode-card p {
      font-size: 13px;
      opacity: 0.8;
      position: relative;
      z-index: 1;
    }

    /* 動態選項區 */
    .pct-dynamic-options {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 20px;
      margin-top: 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }

    .pct-option-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }

    .pct-option-card {
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      font-size: 13px;
      background: white;
      position: relative;
    }

    .pct-option-card:hover {
      border-color: #4f46e5;
      background: #f0f4ff;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
    }

    .pct-option-card:active {
      transform: scale(0.95);
      animation: wiggle 0.3s ease;
    }

    .pct-option-card.selected {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-color: #4f46e5;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.3);
    }

    .pct-option-card.selected::after {
      content: '✓';
      position: absolute;
      top: -6px;
      right: -6px;
      background: #10b981;
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      animation: checkmark 0.3s ease;
    }

    @keyframes wiggle {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-3deg); }
      75% { transform: rotate(3deg); }
    }

    @keyframes checkmark {
      0% { transform: scale(0) rotate(180deg); opacity: 0; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    /* 表格樣式 */
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

    .pct-table-container {
      flex: 1;
      overflow: auto;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    .pct-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .pct-table th {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 10;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    }

    .pct-table th:hover {
      background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
    }

    .pct-table th.sortable::after {
      content: '';
      margin-left: 6px;
      opacity: 0.4;
      font-size: 10px;
    }

    .pct-table th.sort-asc::after { 
      content: '▲'; 
      opacity: 1; 
      color: #4f46e5;
    }

    .pct-table th.sort-desc::after { 
      content: '▼'; 
      opacity: 1; 
      color: #4f46e5;
    }

    .pct-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #f3f4f6;
      cursor: cell;
      transition: all 0.2s ease;
      position: relative;
    }

    .pct-table td:hover {
      background: #f0f9ff;
    }

    .pct-table tr:hover {
      background: #f0f9ff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .pct-table tr.pct-special-row {
      background: #fefce8;
      border-left: 4px solid #eab308;
    }

    .pct-table tr.pct-special-row:hover {
      background: #fef3c7;
    }

    /* 統一寬度的狀態標籤 */
    .pct-status-pill {
      min-width: 80px;
      padding: 4px 8px;
      border-radius: 16px;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      text-align: center;
    }

    .pct-status-onsale { background: #dcfce7; color: #166534; }
    .pct-status-stopped { background: #fee2e2; color: #991b1b; }
    .pct-status-notyet { background: #dbeafe; color: #1e40af; }
    .pct-status-error { background: #fef3c7; color: #92400e; }

    /* 通路顯示 */
    .pct-channels {
      font-size: 12px;
      line-height: 1.4;
    }

    .pct-channel-active {
      color: #2563eb;
      font-weight: 600;
      margin-right: 4px;
      cursor: help;
    }

    .pct-channel-inactive {
      color: #dc2626;
      margin-right: 4px;
      cursor: help;
    }

    .pct-channel-separator {
      color: #6b7280;
      margin: 0 6px;
    }

    /* 等寬字體 */
    .pct-monospace {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    }

    /* 工具提示 */
    .pct-tooltip {
      position: absolute;
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1001;
      pointer-events: none;
      white-space: nowrap;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    }

    .pct-tooltip::before {
      content: '';
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid #1f2937;
    }

    /* 空狀態 */
    .pct-empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .pct-empty-state h3 {
      font-size: 18px;
      color: #374151;
      margin-bottom: 12px;
    }

    .pct-empty-state p {
      margin-bottom: 20px;
      line-height: 1.6;
    }

    /* 回到頂部按鈕 */
    .pct-back-to-top {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(79, 70, 229, 0.1);
      color: #4f46e5;
      border: 2px solid rgba(79, 70, 229, 0.2);
      width: 48px;
      height: 48px;
      border-radius: 24px;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s ease;
      backdrop-filter: blur(8px);
      z-index: 1000;
    }

    .pct-back-to-top:hover {
      background: rgba(79, 70, 229, 0.2);
      transform: scale(1.1);
    }

    .pct-back-to-top.show {
      display: flex;
      animation: fadeInUp 0.3s ease;
    }

    @keyframes fadeInUp {
      from { 
        opacity: 0; 
        transform: translateY(20px) scale(0.8); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0) scale(1); 
      }
    }

    /* 滾動條樣式 */
    .pct-table-container::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    .pct-table-container::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }

    .pct-table-container::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 4px;
    }

    .pct-table-container::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    /* 虛擬渲染容器 */
    .pct-virtual-container {
      position: relative;
      height: 100%;
      overflow: auto;
    }

    .pct-virtual-spacer-top,
    .pct-virtual-spacer-bottom {
      height: 0px;
      transition: height 0.1s ease;
    }

    .pct-virtual-list {
      position: relative;
    }
  `;
  shadow.appendChild(styleSheet);

  // 狀態管理
  const state = {
    view: 'token',
    token: '',
    autoDetected: false,
    tokenSource: '',
    selectedMode: '',
    selectedOptions: {},
    data: [],
    filteredData: [],
    searchKeyword: '',
    sortField: '',
    sortDirection: '',
    loading: false,
    error: null,
    virtualScrollTop: 0,
    virtualItemHeight: 41,
    virtualVisibleCount: 15
  };

  // 配置
  const CONFIG = {
    CURRENCY: { '1': 'TWD', '2': 'USD', '3': 'CNY' },
    UNIT: { 'A1': '元', 'A4': '萬元', 'B1': '計畫' },
    COVERAGE_TYPE: { 'M': '主約', 'R': '附約' },
    STATUS_COLORS: {
      onsale: { text: '現售', emoji: '🟢' },
      stopped: { text: '停售', emoji: '🔴' },
      notyet: { text: '尚未開賣', emoji: '🔵' },
      error: { text: '日期異常', emoji: '🟡' }
    },
    QUERY_MODES: [
      {
        id: 'code',
        title: '商品代號',
        description: '輸入單筆或多筆商品代號'
      },
      {
        id: 'name',
        title: '商品名稱',
        description: '輸入商品名稱關鍵字搜尋'
      },
      {
        id: 'channel',
        title: '通路銷售時間',
        description: '查詢特定通路的銷售商品'
      },
      {
        id: 'status',
        title: '依銷售狀態',
        description: '查詢特定銷售狀態的商品'
      }
    ]
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

    splitInput(input) {
      if (!input) return [];
      return input
        .split(/[\s,;、||\n]+/)
        .map(s => s.trim().toUpperCase())
        .filter(s => s.length > 0);
    }
  };

  // API 模組
  const api = {
    baseUrl: location.hostname.includes('uat') 
      ? 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api'
      : 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api',

    async request(endpoint, body = {}) {
      const response = await fetch(this.baseUrl + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'SSO-TOKEN': state.token
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }

      return response.json();
    },

    async queryProducts(params) {
      return this.request('/planCodeController/query', {
        pageSize: 10000,
        currentPage: 1,
        ...params
      });
    },

    async queryChannels(planCode) {
      return this.request('/planCodeSaleDateController/query', {
        planCode: planCode || '',
        pageSize: 5000,
        pageIndex: 1
      });
    },

    async queryPOLDetails(planCode) {
      return this.request('/planCodeController/queryDetail', {
        planCode,
        pageSize: 50,
        currentPage: 1
      });
    }
  };

  // 資料處理
  const dataProcessor = {
    processData(products, channels = []) {
      const channelMap = new Map();
      
      // 建立通路對照
      channels.forEach(ch => {
        const key = ch.planCode;
        if (!channelMap.has(key)) {
          channelMap.set(key, []);
        }
        channelMap.get(key).push(ch);
      });

      return products.map((product, index) => {
        const productChannels = channelMap.get(product.planCode) || [];
        
        return {
          no: index + 1,
          planCode: product.planCode || '',
          shortName: product.shortName || product.planName || '',
          currency: CONFIG.CURRENCY[product.currency] || product.currency || '',
          unit: CONFIG.UNIT[product.insuranceAmountUnit] || '',
          coverageType: CONFIG.COVERAGE_TYPE[product.coverageType] || '',
          saleStartDate: utils.formatDate(product.saleStartDate),
          saleEndDate: utils.formatDate(product.saleEndDate),
          rawSaleStartDate: product.saleStartDate,
          rawSaleEndDate: product.saleEndDate,
          mainStatus: utils.getSaleStatus(product.saleStartDate, product.saleEndDate),
          polpln: '',
          channels: this.processChannels(productChannels),
          specialReason: this.checkSpecialStatus(product, productChannels)
        };
      });
    },

    processChannels(channels) {
      const processed = channels.map(ch => ({
        channel: ch.channel === 'OT' ? 'BK' : ch.channel,
        status: utils.getSaleStatus(ch.saleStartDate, ch.saleEndDate),
        saleStartDate: utils.formatDate(ch.saleStartDate),
        saleEndDate: utils.formatDate(ch.saleEndDate),
        rawStart: ch.saleStartDate,
        rawEnd: ch.saleEndDate
      }));

      // 按規格排序：現售優先，組內字母排序
      const active = processed.filter(ch => ch.status === 'onsale').sort((a, b) => a.channel.localeCompare(b.channel));
      const inactive = processed.filter(ch => ch.status !== 'onsale').sort((a, b) => a.channel.localeCompare(b.channel));
      
      return [...active, ...inactive];
    },

    checkSpecialStatus(product, channels) {
      if (!channels.length) return '';
      
      const mainStatus = utils.getSaleStatus(product.saleStartDate, product.saleEndDate);
      const activeChannels = channels.filter(ch => 
        utils.getSaleStatus(ch.saleStartDate, ch.saleEndDate) === 'onsale'
      );
      
      if (mainStatus === 'stopped' && activeChannels.length > 0) {
        return '主約已停售，但部分通路仍在售';
      }
      if (mainStatus === 'onsale' && activeChannels.length === 0) {
        return '主約現售，但所有通路均已停售';
      }
      
      return '';
    }
  };

  // 虛擬滾動
  const virtualScroll = {
    updateVirtualScroll() {
      const container = shadow.querySelector('.pct-virtual-container');
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      
      if (!container || !currentData.length) return;

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const startIndex = Math.floor(scrollTop / state.virtualItemHeight);
      const endIndex = Math.min(startIndex + state.virtualVisibleCount + 2, currentData.length);
      
      const topSpacer = shadow.querySelector('.pct-virtual-spacer-top');
      const bottomSpacer = shadow.querySelector('.pct-virtual-spacer-bottom');
      
      if (topSpacer) topSpacer.style.height = (startIndex * state.virtualItemHeight) + 'px';
      if (bottomSpacer) bottomSpacer.style.height = ((currentData.length - endIndex) * state.virtualItemHeight) + 'px';

      const visibleData = currentData.slice(startIndex, endIndex);
      this.renderVirtualItems(visibleData, startIndex);

      // 顯示/隱藏回到頂部按鈕
      const backToTop = shadow.querySelector('.pct-back-to-top');
      if (backToTop) {
        if (scrollTop > 200) {
          backToTop.classList.add('show');
        } else {
          backToTop.classList.remove('show');
        }
      }
    },

    renderVirtualItems(visibleData, startIndex) {
      const virtualList = shadow.querySelector('.pct-virtual-list');
      if (!virtualList) return;

      const tbody = virtualList.querySelector('tbody');
      if (!tbody) return;

      const rows = visibleData.map((row, index) => {
        const actualIndex = startIndex + index;
        const isSpecial = row.specialReason && row.specialReason.length > 0;
        
        return `
          <tr ${isSpecial ? `class="pct-special-row" title="${row.specialReason}"` : ''}>
            <td class="pct-monospace" onclick="copyCell('${actualIndex + 1}')">${actualIndex + 1}</td>
            <td class="pct-monospace" onclick="copyCell('${row.planCode}')">${row.planCode}</td>
            <td onclick="copyCell('${row.shortName}')" title="${row.shortName}">${row.shortName}</td>
            <td onclick="copyCell('${row.currency}')">${row.currency}</td>
            <td onclick="copyCell('${row.unit}')">${row.unit}</td>
            <td onclick="copyCell('${row.coverageType}')">${row.coverageType}</td>
            <td onclick="copyCell('${row.saleStartDate}')">${row.saleStartDate}</td>
            <td onclick="copyCell('${row.saleEndDate}')">${row.saleEndDate}</td>
            <td>${this.renderStatusPill(row.mainStatus)}</td>
            <td>${this.renderChannels(row.channels)}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
    },

    renderStatusPill(status) {
      const config = CONFIG.STATUS_COLORS[status] || CONFIG.STATUS_COLORS.error;
      return `<span class="pct-status-pill pct-status-${status}" onclick="copyCell('${config.text}')">${config.emoji} ${config.text}</span>`;
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

    getStatusLabel(status) {
      const labels = {
        onsale: '現售',
        stopped: '停售',
        notyet: '尚未開賣',
        error: '日期異常'
      };
      return labels[status] || status;
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
      
      this.updateModalSize();
      this.bindEvents();
      
      if (state.view === 'result') {
        setTimeout(() => {
          virtualScroll.updateVirtualScroll();
        }, 100);
      }
    },

    updateModalSize() {
      const modal = shadow.querySelector('.pct-modal');
      if (modal) {
        if (state.view === 'result') {
          modal.className = 'pct-modal large';
        } else {
          modal.className = 'pct-modal small';
        }
      }
    },

    getContent() {
      const header = this.renderHeader();
      const body = this.renderBody();
      const footer = this.renderFooter();

      return `
        <div class="pct-modal small">
          ${header}
          ${body}
          ${footer ? footer : ''}
        </div>
        ${state.view === 'result' ? '<div class="pct-back-to-top" onclick="scrollToTop()">↑</div>' : ''}
      `;
    },

    renderHeader() {
      const titles = {
        token: '設定 Token (PROD)',
        query: '選擇查詢條件 (PROD)',
        result: '查詢結果 (PROD)'
      };

      return `
        <div class="pct-modal-header" id="modal-header">
          <div class="pct-modal-title">${titles[state.view] || '商品查詢小工具'}</div>
          <button class="pct-close-btn" onclick="closeTool()">×</button>
        </div>
      `;
    },

    renderBody() {
      return `
        <div class="pct-modal-body">
          ${this.renderContent()}
        </div>
      `;
    },

    renderContent() {
      switch (state.view) {
        case 'token': return this.renderTokenView();
        case 'query': return this.renderQueryView();
        case 'result': return this.renderResultView();
        default: return '<div class="pct-empty-state"><h3>載入中...</h3></div>';
      }
    },

    renderTokenView() {
      return `
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label class="pct-label">請貼上您的 SSO-TOKEN 或 euisToken：</label>
          <textarea class="pct-textarea" 
                    id="token-input" 
                    placeholder="(使用者在此貼上 Token...)"
                    style="flex: 1;">${state.token}</textarea>
          <div class="pct-error-message" id="token-error"></div>
        </div>
      `;
    },

    renderQueryView() {
      const modeCards = CONFIG.QUERY_MODES.map(mode => `
        <div class="pct-mode-card ${state.selectedMode === mode.id ? 'selected' : ''}" 
             onclick="selectMode('${mode.id}')">
          <h3>${mode.title}</h3>
          <p>${mode.description}</p>
        </div>
      `).join('');

      const dynamicOptions = this.renderDynamicOptions();

      return `
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label class="pct-label">查詢模式:</label>
          <div class="pct-mode-grid">
            ${modeCards}
          </div>
          ${dynamicOptions}
          <div class="pct-error-message" id="query-error"></div>
        </div>
      `;
    },

    renderDynamicOptions() {
      if (!state.selectedMode) return '';

      switch (state.selectedMode) {
        case 'code':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">商品代碼：(多筆可用空格、逗號或換行分隔)</label>
              <textarea class="pct-textarea" 
                        id="code-input" 
                        placeholder="(使用者在此輸入商品代碼...)"
                        style="min-height: 80px;"></textarea>
            </div>
          `;
        case 'name':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">商品名稱關鍵字：</label>
              <input type="text" 
                     class="pct-input" 
                     id="name-input" 
                     placeholder="例如：健康、終身" />
            </div>
          `;
        case 'channel':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">選擇通路（可多選）：</label>
              <div class="pct-option-grid">
                ${['AG', 'BK', 'BR', 'WS'].map(ch => `
                  <div class="pct-option-card ${(state.selectedOptions.channels || []).includes(ch) ? 'selected' : ''}"
                       onclick="toggleChannelOption('${ch}')">
                    ${ch}
                  </div>
                `).join('')}
              </div>
              <label class="pct-label" style="margin-top: 16px;">銷售範圍：</label>
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
              <label class="pct-label">選擇銷售狀態：</label>
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

    renderResultView() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      
      return `
        <div style="flex: 1; display: flex; flex-direction: column;">
          ${this.renderSearchArea()}
          <div class="pct-table-container pct-virtual-container" onscroll="handleVirtualScroll()" style="flex: 1;">
            <div class="pct-virtual-spacer-top"></div>
            ${this.renderTable()}
            <div class="pct-virtual-spacer-bottom"></div>
          </div>
        </div>
      `;
    },

    renderSearchArea() {
      return `
        <div class="pct-search-container">
          <input type="text" 
                 class="pct-input pct-search-input" 
                 id="search-input"
                 placeholder="搜尋:" 
                 value="${state.searchKeyword}" />
        </div>
      `;
    },

    renderTable() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      
      if (!currentData.length) {
        return `
          <div class="pct-empty-state">
            <h3>📭 查無資料</h3>
            <p>請調整搜尋條件或重新查詢</p>
          </div>
        `;
      }

      const headers = [
        { id: 'no', label: 'No' },
        { id: 'planCode', label: '代號' },
        { id: 'shortName', label: '名稱' },
        { id: 'currency', label: '幣別' },
        { id: 'unit', label: '單位' },
        { id: 'coverageType', label: '類型' },
        { id: 'saleStartDate', label: '主約銷售日' },
        { id: 'saleEndDate', label: '主約停賣日' },
        { id: 'mainStatus', label: '險種狀態' },
        { id: 'channels', label: '銷售通路' }
      ];

      const headerHTML = headers.map(col => {
        const sortClass = state.sortField === col.id ? `sort-${state.sortDirection}` : '';
        return `<th class="sortable ${sortClass}" onclick="sortTable('${col.id}')">${col.label}</th>`;
      }).join('');

      return `
        <div class="pct-virtual-list">
          <table class="pct-table">
            <thead>
              <tr>${headerHTML}</tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;
    },

    renderFooter() {
      switch (state.view) {
        case 'token': return this.renderTokenFooter();
        case 'query': return this.renderQueryFooter();
        case 'result': return this.renderResultFooter();
        default: return '';
      }
    },

    renderTokenFooter() {
      return `
        <div class="pct-modal-footer">
          <div></div>
          <div style="display: flex; gap: 12px;">
            <button class="pct-btn pct-btn-secondary" id="skip-btn">略過</button>
            <button class="pct-btn pct-btn-primary" id="verify-btn" ${state.loading ? 'disabled' : ''}>
              ${state.loading ? '驗證中...' : '驗證'}
            </button>
          </div>
        </div>
      `;
    },

    renderQueryFooter() {
      const canStartQuery = this.canStartQuery();
      return `
        <div class="pct-modal-footer">
          <button class="pct-btn pct-btn-secondary" onclick="goBackToToken()">修改 Token</button>
          <button class="pct-btn pct-btn-primary" id="start-query-btn" ${canStartQuery ? '' : 'disabled'}>
            開始查詢
          </button>
        </div>
      `;
    },

    renderResultFooter() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      return `
        <div class="pct-modal-footer">
          <div style="display: flex; gap: 12px;">
            <button class="pct-btn pct-btn-secondary pct-btn-small">一頁顯示</button>
            <button class="pct-btn pct-btn-secondary pct-btn-small">篩選特殊</button>
          </div>
          <div style="color: #6b7280; font-size: 13px;">
            共 ${currentData.length} 筆資料
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="pct-btn pct-btn-success" onclick="copyAllData()">一鍵複製</button>
            <button class="pct-btn pct-btn-primary" onclick="goBackToQuery()">重新查詢</button>
          </div>
        </div>
      `;
    },

    canStartQuery() {
      if (!state.selectedMode) return false;
      
      switch (state.selectedMode) {
        case 'code':
        case 'name':
          return true;
        case 'channel':
          return (state.selectedOptions.channels || []).length > 0 && state.selectedOptions.range;
        case 'status':
          return state.selectedOptions.status;
        default:
          return false;
      }
    },

    bindEvents() {
      // 拖拽功能
      const header = shadow.querySelector('#modal-header');
      if (header) {
        header.addEventListener('mousedown', (e) => {
          e.preventDefault();
          isDragging = true;
          const rect = container.getBoundingClientRect();
          dragOffset.x = e.clientX - rect.left;
          dragOffset.y = e.clientY - rect.top;
          
          const handleMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;
            container.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            container.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
          };
          
          const handleMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
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

      // 輸入事件
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
          }, 300);
        });
      }

      // ESC 鍵關閉
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          closeTool();
        }
      };
      document.addEventListener('keydown', handleKeydown);
      
      // 清理函數
      container._cleanup = () => {
        document.removeEventListener('keydown', handleKeydown);
      };
    }
  };

  // 事件處理函式
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
      // 不進行 5105 驗證，直接設定 Token
      state.token = token;
      state.view = 'query';
      utils.showToast('Token 設定成功', 'success');
    } catch (error) {
      showError('token-error', 'Token 設定失敗');
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
      let result;
      
      if (state.selectedMode === 'code') {
        const codeInput = shadow.querySelector('#code-input');
        const codes = utils.splitInput(codeInput.value);
        result = await api.queryProducts({ planCode: codes.join(',') });
      } else if (state.selectedMode === 'name') {
        const nameInput = shadow.querySelector('#name-input');
        result = await api.queryProducts({ planCodeName: nameInput.value.trim() });
      } else if (state.selectedMode === 'status') {
        // 這裡需要根據狀態查詢的實際 API 參數來調整
        result = await api.queryProducts({ 
          // 根據實際 API 需要的參數格式來調整
          saleStatus: state.selectedOptions.status 
        });
      } else if (state.selectedMode === 'channel') {
        // 通路查詢邏輯
        const channelResult = await api.queryChannels('');
        result = { records: [] }; // 需要根據通路結果處理商品資料
      }

      if (result && result.records && result.records.length > 0) {
        // 同時查詢通路資料
        let channelData = [];
        try {
          const channelResult = await api.queryChannels('');
          channelData = channelResult.planCodeSaleDates?.records || [];
        } catch (error) {
          console.warn('通路資料查詢失敗:', error);
        }
        
        state.data = dataProcessor.processData(result.records, channelData);
        utils.showToast(`查詢完成，找到 ${state.data.length} 筆資料`, 'success');
      } else {
        state.data = [];
        utils.showToast('查無資料', 'info');
      }
      
    } catch (error) {
      console.error('查詢錯誤:', error);
      utils.showToast('查詢失敗: ' + error.message, 'error');
      state.data = [];
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
    
    renderer.render();
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
    if (container._cleanup) container._cleanup();
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
    utils.copyToClipboard(String(value));
  };

  window.copyAllData = () => {
    const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
    const headers = ['#', '代號', '名稱', '幣別', '單位', '類型', '主約銷售日', '主約停賣日', '險種狀態', '銷售通路'];
    const rows = currentData.map(row => [
      row.no,
      row.planCode,
      row.shortName,
      row.currency,
      row.unit,
      row.coverageType,
      row.saleStartDate,
      row.saleEndDate,
      CONFIG.STATUS_COLORS[row.mainStatus]?.text || row.mainStatus,
      row.channels.map(ch => ch.channel).join(' ')
    ]);
    
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

  window.showChannelTooltip = (event, text) => {
    utils.createTooltip(text, event.pageX, event.pageY);
  };

  window.hideChannelTooltip = () => {
    utils.hideTooltip();
  };

  window.handleVirtualScroll = () => {
    virtualScroll.updateVirtualScroll();
  };

  window.scrollToTop = () => {
    const container = shadow.querySelector('.pct-virtual-container');
    if (container) {
      container.scrollTop = 0;
    }
  };

  // 初始化
  const tokenResult = utils.extractToken();
  if (tokenResult) {
    state.token = tokenResult.token;
    state.autoDetected = true;
    state.tokenSource = tokenResult.source;
    state.view = 'query';
    utils.showToast(`已自動偵測到 Token (${tokenResult.source})`, 'info');
  }

  renderer.render();

})();
