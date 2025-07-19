javascript:(function() {
  'use strict';

  // 防止重複執行
  if (window.__PRODUCT_QUERY_TOOL_V2__) return;
  window.__PRODUCT_QUERY_TOOL_V2__ = true;

  // 清理舊版本
  const cleanupOld = () => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask', 'product-query-tool-root'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.pct-toast, .pct-modal-mask, .pct-modal').forEach(el => el.remove());
  };
  cleanupOld();

  // 建立容器
  const createContainer = () => {
    const mask = document.createElement('div');
    mask.className = 'pct-modal-mask';
    mask.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.3) !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    document.body.appendChild(mask);

    const container = document.createElement('div');
    container.className = 'pct-modal';
    container.style.cssText = `
      background: white !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
      display: flex !important;
      flex-direction: column !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
      overflow: hidden !important;
      position: relative !important;
    `;
    mask.appendChild(container);

    return { mask, container };
  };

  // 樣式注入
  const injectStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
      .pct-modal.small { width: 500px; height: 420px; }
      .pct-modal.large { width: 1000px; height: 700px; }
      
      .pct-modal-header {
        background: #4A90E2;
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
        user-select: none;
        font-size: 16px;
        font-weight: 600;
      }
      .pct-modal-header:active { cursor: grabbing; }
      
      .pct-close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .pct-close-btn:hover { background: rgba(255, 255, 255, 0.3); }
      
      .pct-modal-body {
        flex: 1;
        padding: 20px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .pct-modal-footer {
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8f9fa;
        min-height: 60px;
      }
      
      .pct-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      
      .pct-btn-primary {
        background: #4A90E2;
        color: white;
      }
      .pct-btn-primary:hover { background: #357ABD; }
      .pct-btn-primary:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      
      .pct-btn-secondary {
        background: #6C757D;
        color: white;
      }
      .pct-btn-secondary:hover { background: #5A6268; }
      
      .pct-btn-success {
        background: #5CB85C;
        color: white;
      }
      .pct-btn-success:hover { background: #4CAE4C; }
      
      .pct-input, .pct-textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      .pct-input:focus, .pct-textarea:focus {
        outline: none;
        border-color: #4A90E2;
      }
      .pct-textarea {
        resize: vertical;
        min-height: 100px;
        font-family: 'Consolas', 'Monaco', monospace;
      }
      
      .pct-label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #374151;
      }
      
      .pct-error {
        color: #dc2626;
        font-size: 13px;
        margin-top: 8px;
        display: none;
        background: #fef2f2;
        padding: 8px 12px;
        border-radius: 4px;
        border-left: 4px solid #dc2626;
      }
      .pct-error.show { display: block; }
      
      .pct-mode-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      
      .pct-mode-card {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        background: white;
        min-height: 60px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      
      .pct-mode-card:hover {
        border-color: #4A90E2;
        background: #f0f7ff;
      }
      
      .pct-mode-card.selected {
        background: #4A90E2;
        border-color: #4A90E2;
        color: white;
      }
      
      .pct-mode-card h3 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
      }
      
      .pct-mode-card p {
        margin: 0;
        font-size: 12px;
        opacity: 0.8;
      }
      
      .pct-dynamic-options {
        background: #f8f9fa;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 16px;
        margin-top: 16px;
        max-height: 140px;
        overflow-y: auto;
      }
      
      .pct-option-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 8px;
        margin-top: 12px;
      }
      
      .pct-option-card {
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        font-size: 13px;
        background: white;
        min-height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .pct-option-card:hover {
        border-color: #4A90E2;
        background: #f0f7ff;
      }
      
      .pct-option-card.selected {
        background: #4A90E2;
        border-color: #4A90E2;
        color: white;
      }
      
      .pct-search-container {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 16px;
      }
      
      .pct-search-input {
        flex: 1;
        min-width: 200px;
      }
      
      .pct-table-container {
        flex: 1;
        overflow: auto;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        background: white;
        position: relative;
      }
      
      .pct-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        table-layout: fixed;
        min-width: 900px;
      }
      
      .pct-table th {
        background: #f8f9fa;
        padding: 10px 8px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
        cursor: pointer;
        user-select: none;
      }
      
      .pct-table th:hover { background: #f1f5f9; }
      
      .pct-table td {
        padding: 8px;
        border-bottom: 1px solid #f1f5f9;
        cursor: cell;
        transition: background 0.2s;
      }
      
      .pct-table td:hover { background: #f0f9ff; }
      
      .pct-table tr:hover { background: #f0f9ff; }
      
      .pct-table tr.special-row {
        background: #fefce8;
        border-left: 4px solid #eab308;
      }
      .pct-table tr.special-row:hover { background: #fef3c7; }
      
      .pct-status-pill {
        min-width: 70px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      
      .pct-status-onsale { background: #dcfce7; color: #166534; }
      .pct-status-stopped { background: #fee2e2; color: #991b1b; }
      .pct-status-notyet { background: #dbeafe; color: #1e40af; }
      .pct-status-error { background: #fef3c7; color: #92400e; }
      
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
      
      .pct-monospace {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .pct-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000000;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.3s ease;
      }
      
      .pct-toast.success { background: #10b981; }
      .pct-toast.error { background: #ef4444; }
      .pct-toast.warning { background: #f59e0b; }
      .pct-toast.info { background: #3b82f6; }
      
      .pct-progress {
        background: #f0f9ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
        display: none;
      }
      .pct-progress.show { display: block; }
      
      .pct-progress-bar {
        width: 100%;
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin: 8px 0;
      }
      
      .pct-progress-fill {
        height: 100%;
        background: #3b82f6;
        border-radius: 4px;
        transition: width 0.3s ease;
        width: 0%;
      }
      
      .pct-virtual-container {
        position: relative;
      }
      
      .pct-virtual-spacer {
        height: 0px;
      }
      
      .pct-back-to-top {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(74, 144, 226, 0.9);
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        display: none;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        z-index: 1000;
      }
      .pct-back-to-top:hover { background: rgba(74, 144, 226, 1); transform: scale(1.1); }
      .pct-back-to-top.show { display: flex; }
    `;
    document.head.appendChild(style);
  };

  // 狀態管理
  const state = {
    view: 'token',
    token: '',
    selectedMode: '',
    selectedOptions: {},
    data: [],
    filteredData: [],
    searchKeyword: '',
    sort: { field: '', direction: 'asc' },
    loading: false,
    error: null,
    abortController: null
  };

  // 工具函式
  const utils = {
    showToast(message, type = 'info') {
      const existing = document.querySelector('.pct-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = `pct-toast ${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
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
    },

    copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('複製成功', 'success');
      }).catch(() => {
        this.showToast('複製失敗', 'error');
      });
    }
  };

  // API 模組
  const api = {
    baseUrl: location.hostname.includes('uat') 
      ? 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api'
      : 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api',

    async request(endpoint, body = {}) {
      const controller = new AbortController();
      state.abortController = controller;

      try {
        const response = await fetch(this.baseUrl + endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'SSO-TOKEN': state.token
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`API 錯誤: ${response.status}`);
        }

        return await response.json();
      } finally {
        state.abortController = null;
      }
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
          planCode: String(product.planCode || ''),  // 確保字串格式，保留前導零
          shortName: product.shortName || product.planName || '',
          currency: this.convertCurrency(product.currency),
          unit: this.convertUnit(product.insuranceAmountUnit),
          coverageType: this.convertCoverageType(product.coverageType),
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

      const active = processed.filter(ch => ch.status === 'onsale').sort((a, b) => a.channel.localeCompare(b.channel));
      const inactive = processed.filter(ch => ch.status !== 'onsale').sort((a, b) => a.channel.localeCompare(b.channel));
      
      return [...active, ...inactive];
    },

    convertCurrency(code) {
      const map = { '1': 'TWD', '2': 'USD', '3': 'CNY' };
      return map[code] || code;
    },

    convertUnit(code) {
      const map = { 'A4': '萬元', 'A1': '元' };
      return map[code] || code;
    },

    convertCoverageType(code) {
      const map = { 'M': '主約', 'R': '附約' };
      return map[code] || code;
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
    itemHeight: 35,
    visibleCount: 15,
    
    update() {
      const container = document.querySelector('.pct-table-container');
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      
      if (!container || !currentData.length) return;

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const startIndex = Math.floor(scrollTop / this.itemHeight);
      const endIndex = Math.min(startIndex + this.visibleCount + 2, currentData.length);
      
      const topSpacer = document.querySelector('.pct-virtual-spacer-top');
      const bottomSpacer = document.querySelector('.pct-virtual-spacer-bottom');
      
      if (topSpacer) topSpacer.style.height = (startIndex * this.itemHeight) + 'px';
      if (bottomSpacer) bottomSpacer.style.height = ((currentData.length - endIndex) * this.itemHeight) + 'px';

      const visibleData = currentData.slice(startIndex, endIndex);
      this.renderVisibleRows(visibleData, startIndex);

      // 回到頂部按鈕
      const backToTop = document.querySelector('.pct-back-to-top');
      if (backToTop) {
        if (scrollTop > 200) {
          backToTop.classList.add('show');
        } else {
          backToTop.classList.remove('show');
        }
      }
    },

    renderVisibleRows(visibleData, startIndex) {
      const tbody = document.querySelector('.pct-table tbody');
      if (!tbody) return;

      const rows = visibleData.map((row, index) => {
        const actualIndex = startIndex + index;
        const isSpecial = row.specialReason && row.specialReason.length > 0;
        
        return `
          <tr ${isSpecial ? `class="special-row" title="${row.specialReason}"` : ''}>
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
      const config = {
        onsale: { text: '現售', emoji: '🟢' },
        stopped: { text: '停售', emoji: '🔴' },
        notyet: { text: '尚未開賣', emoji: '🔵' },
        error: { text: '日期異常', emoji: '🟡' }
      };
      const statusConfig = config[status] || config.error;
      return `<span class="pct-status-pill pct-status-${status}" onclick="copyCell('${statusConfig.text}')">${statusConfig.emoji} ${statusConfig.text}</span>`;
    },

    renderChannels(channels) {
      if (!channels || !channels.length) return '';
      
      const active = channels.filter(ch => ch.status === 'onsale');
      const inactive = channels.filter(ch => ch.status !== 'onsale');
      
      const activeHTML = active.map(ch => 
        `<span class="pct-channel-active" title="${ch.channel} (現售): ${ch.saleStartDate}-${ch.saleEndDate}">${ch.channel}</span>`
      ).join('');
      
      const inactiveHTML = inactive.map(ch => 
        `<span class="pct-channel-inactive" title="${ch.channel} (停售): ${ch.saleStartDate}-${ch.saleEndDate}">${ch.channel}</span>`
      ).join('');
      
      const separator = active.length && inactive.length ? '<span class="pct-channel-separator">|</span>' : '';
      
      return `<div class="pct-channels">${activeHTML}${separator}${inactiveHTML}</div>`;
    }
  };

  // 進度管理
  const progress = {
    show(text) {
      let p = document.querySelector('.pct-progress');
      if (!p) {
        p = document.createElement('div');
        p.className = 'pct-progress';
        p.innerHTML = `
          <div class="pct-progress-text">${text}</div>
          <div class="pct-progress-bar">
            <div class="pct-progress-fill"></div>
          </div>
          <button class="pct-btn pct-btn-secondary" onclick="abortQuery()">中止查詢</button>
        `;
        document.querySelector('.pct-modal-body').prepend(p);
      }
      p.classList.add('show');
    },

    update(percentage, text) {
      const fill = document.querySelector('.pct-progress-fill');
      const textEl = document.querySelector('.pct-progress-text');
      if (fill) fill.style.width = `${percentage}%`;
      if (textEl && text) textEl.textContent = text;
    },

    hide() {
      const p = document.querySelector('.pct-progress');
      if (p) p.classList.remove('show');
    }
  };

  // 渲染引擎
  const renderer = {
    render() {
      const content = this.getContent();
      const modal = document.querySelector('.pct-modal');
      if (modal) {
        modal.innerHTML = content;
        this.updateModalSize();
        this.bindEvents();
        
        if (state.view === 'result') {
          setTimeout(() => virtualScroll.update(), 100);
        }
      }
    },

    updateModalSize() {
      const modal = document.querySelector('.pct-modal');
      if (modal) {
        modal.className = state.view === 'result' ? 'pct-modal large' : 'pct-modal small';
      }
    },

    getContent() {
      const header = this.renderHeader();
      const body = this.renderBody();
      const footer = this.renderFooter();

      return `
        ${header}
        ${body}
        ${footer}
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
        <div class="pct-modal-header">
          <div>${titles[state.view] || '商品查詢小工具'}</div>
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
        default: return '<div>載入中...</div>';
      }
    },

    renderTokenView() {
      return `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <label class="pct-label">請貼上您的 SSO-TOKEN 或 euisToken：</label>
          <textarea class="pct-textarea" id="token-input" placeholder="(使用者在此貼上 Token...)" style="flex: 1;">${state.token}</textarea>
          <div class="pct-error" id="token-error"></div>
        </div>
      `;
    },

    renderQueryView() {
      const modeCards = [
        { id: 'code', title: '商品代號', desc: '輸入單筆或多筆商品代號' },
        { id: 'name', title: '商品名稱', desc: '輸入商品名稱關鍵字搜尋' },
        { id: 'channel', title: '通路銷售時間', desc: '查詢特定通路的銷售商品' },
        { id: 'status', title: '依銷售狀態', desc: '查詢特定銷售狀態的商品' }
      ].map(mode => `
        <div class="pct-mode-card ${state.selectedMode === mode.id ? 'selected' : ''}" onclick="selectMode('${mode.id}')">
          <h3>${mode.title}</h3>
          <p>${mode.desc}</p>
        </div>
      `).join('');

      return `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <label class="pct-label">查詢模式:</label>
          <div class="pct-mode-grid">
            ${modeCards}
          </div>
          ${this.renderDynamicOptions()}
          <div class="pct-error" id="query-error"></div>
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
              <textarea class="pct-textarea" id="code-input" placeholder="(使用者在此輸入商品代碼...)" style="min-height: 60px;"></textarea>
            </div>
          `;
        case 'name':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">商品名稱關鍵字：</label>
              <input type="text" class="pct-input" id="name-input" placeholder="例如：健康、終身" />
            </div>
          `;
        case 'channel':
          return `
            <div class="pct-dynamic-options">
              <label class="pct-label">選擇通路（可多選）：</label>
              <div class="pct-option-grid">
                ${['AG', 'BK', 'BR', 'WS'].map(ch => `
                  <div class="pct-option-card ${(state.selectedOptions.channels || []).includes(ch) ? 'selected' : ''}" onclick="toggleChannelOption('${ch}')">${ch}</div>
                `).join('')}
              </div>
              <label class="pct-label" style="margin-top: 8px;">銷售範圍：</label>
              <div class="pct-option-grid">
                ${[
                  { id: 'current', label: '現售商品' },
                  { id: 'all', label: '全部商品' }
                ].map(opt => `
                  <div class="pct-option-card ${state.selectedOptions.range === opt.id ? 'selected' : ''}" onclick="selectRangeOption('${opt.id}')">${opt.label}</div>
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
                  <div class="pct-option-card ${state.selectedOptions.status === status.id ? 'selected' : ''}" onclick="selectStatusOption('${status.id}')">${status.label}</div>
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
        <div style="display: flex; flex-direction: column; height: 100%;">
          ${this.renderSearchArea()}
          <div class="pct-table-container" onscroll="handleVirtualScroll()" style="flex: 1;">
            <div class="pct-virtual-spacer pct-virtual-spacer-top"></div>
            ${this.renderTable()}
            <div class="pct-virtual-spacer pct-virtual-spacer-bottom"></div>
          </div>
        </div>
      `;
    },

    renderSearchArea() {
      return `
        <div class="pct-search-container">
          <input type="text" class="pct-input pct-search-input" id="search-input" placeholder="搜尋:" value="${state.searchKeyword}" />
        </div>
      `;
    },

    renderTable() {
      const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
      
      if (!currentData.length) {
        return '<div style="text-align: center; padding: 40px; color: #6b7280;"><h3>📭 查無資料</h3><p>請調整搜尋條件或重新查詢</p></div>';
      }

      const headers = [
        { id: 'no', label: '#' },
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

      const headerHTML = headers.map(col => `<th onclick="sortTable('${col.id}')">${col.label}</th>`).join('');

      return `
        <table class="pct-table">
          <thead><tr>${headerHTML}</tr></thead>
          <tbody></tbody>
        </table>
      `;
    },

    renderFooter() {
      switch (state.view) {
        case 'token':
          return `
            <div class="pct-modal-footer">
              <div></div>
              <div style="display: flex; gap: 12px;">
                <button class="pct-btn pct-btn-secondary" onclick="skipToken()">略過</button>
                <button class="pct-btn pct-btn-primary" id="verify-btn" ${state.loading ? 'disabled' : ''}>
                  ${state.loading ? '驗證中...' : '驗證'}
                </button>
              </div>
            </div>
          `;
        case 'query':
          return `
            <div class="pct-modal-footer">
              <button class="pct-btn pct-btn-secondary" onclick="goBackToToken()">修改 Token</button>
              <button class="pct-btn pct-btn-primary" id="start-query-btn" ${this.canStartQuery() ? '' : 'disabled'}>開始查詢</button>
            </div>
          `;
        case 'result':
          const currentData = state.filteredData.length > 0 ? state.filteredData : state.data;
          return `
            <div class="pct-modal-footer">
              <div style="color: #6b7280; font-size: 13px;">共 ${currentData.length} 筆資料</div>
              <div style="display: flex; gap: 12px;">
                <button class="pct-btn pct-btn-success" onclick="copyAllData()">一鍵複製</button>
                <button class="pct-btn pct-btn-primary" onclick="goBackToQuery()">重新查詢</button>
              </div>
            </div>
          `;
        default:
          return '';
      }
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
      // Token 驗證
      const verifyBtn = document.getElementById('verify-btn');
      if (verifyBtn) {
        verifyBtn.onclick = async () => {
          const tokenInput = document.getElementById('token-input');
          const token = tokenInput.value.trim();
          
          if (!token) {
            showError('token-error', '請輸入 Token');
            return;
          }

          state.loading = true;
          state.token = token;
          hideError('token-error');
          this.render();

          try {
            state.view = 'query';
            utils.showToast('Token 設定成功', 'success');
          } catch (error) {
            showError('token-error', 'Token 驗證失敗');
          } finally {
            state.loading = false;
            this.render();
          }
        };
      }

      // 查詢執行
      const startQueryBtn = document.getElementById('start-query-btn');
      if (startQueryBtn) {
        startQueryBtn.onclick = async () => {
          const validation = this.validateQueryInput();
          if (!validation.valid) {
            showError('query-error', validation.message);
            return;
          }

          hideError('query-error');
          
          state.view = 'result';
          state.loading = true;
          state.data = [];
          state.filteredData = [];
          this.render();

          progress.show('正在查詢...');

          try {
            let result;
            
            if (state.selectedMode === 'code') {
              const codeInput = document.getElementById('code-input');
              const codes = utils.splitInput(codeInput.value);
              result = await api.queryProducts({ planCode: codes.join(',') });
            } else if (state.selectedMode === 'name') {
              const nameInput = document.getElementById('name-input');
              result = await api.queryProducts({ planCodeName: nameInput.value.trim() });
            } else if (state.selectedMode === 'status') {
              result = await api.queryProducts({});
            } else if (state.selectedMode === 'channel') {
              result = await api.queryProducts({});
            }

            progress.update(50, '處理查詢結果...');

            if (result && result.records && result.records.length > 0) {
              let channelData = [];
              try {
                const channelResult = await api.queryChannels('');
                channelData = channelResult.planCodeSaleDates?.records || [];
              } catch (error) {
                console.warn('通路資料查詢失敗:', error);
              }
              
              progress.update(90, '整理資料...');
              state.data = dataProcessor.processData(result.records, channelData);
              
              // 依照選擇的狀態進行篩選
              if (state.selectedMode === 'status' && state.selectedOptions.status) {
                state.data = state.data.filter(item => item.mainStatus === {
                  'onsale': 'onsale',
                  'stopped': 'stopped', 
                  'notyet': 'notyet',
                  'error': 'error'
                }[state.selectedOptions.status]);
              }
              
              progress.update(100, '完成');
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
            progress.hide();
            this.render();
          }
        };
      }

      // 搜尋功能
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        let searchTimeout;
        searchInput.oninput = (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            const keyword = e.target.value.trim();
            state.searchKeyword = keyword;
            
            if (keyword) {
              state.filteredData = state.data.filter(row =>
                Object.values(row).some(value =>
                  String(value).toLowerCase().includes(keyword.toLowerCase())
                )
              );
            } else {
              state.filteredData = [];
            }
            
            virtualScroll.update();
          }, 300);
        };
      }
    },

    validateQueryInput() {
      if (!state.selectedMode) {
        return { valid: false, message: '請選擇查詢模式' };
      }

      switch (state.selectedMode) {
        case 'code':
          const codeInput = document.getElementById('code-input');
          if (!codeInput || !codeInput.value.trim()) {
            return { valid: false, message: '請輸入商品代號' };
          }
          break;
        case 'name':
          const nameInput = document.getElementById('name-input');
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
  };

  // 輔助函式
  function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
  }

  function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
      errorElement.classList.remove('show');
      errorElement.textContent = '';
    }
  }

  // 全域函式
  window.closeTool = () => {
    const mask = document.querySelector('.pct-modal-mask');
    if (mask) mask.remove();
    window.__PRODUCT_QUERY_TOOL_V2__ = false;
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

  window.skipToken = () => {
    const tokenInput = document.getElementById('token-input');
    state.token = tokenInput ? tokenInput.value.trim() : '';
    state.view = 'query';
    utils.showToast('已略過驗證', 'warning');
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
      row.mainStatus,
      row.channels.map(ch => ch.channel).join(' ')
    ]);
    
    const text = [headers, ...rows].map(row => row.join('\t')).join('\n');
    utils.copyToClipboard(text);
  };

  window.sortTable = (field) => {
    const direction = state.sort.field === field && state.sort.direction === 'asc' ? 'desc' : 'asc';
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

    state.sort = { field, direction };
    renderer.render();
  };

  window.handleVirtualScroll = () => {
    virtualScroll.update();
  };

  window.scrollToTop = () => {
    const container = document.querySelector('.pct-table-container');
    if (container) {
      container.scrollTop = 0;
    }
  };

  window.abortQuery = () => {
    if (state.abortController) {
      state.abortController.abort();
    }
    progress.hide();
    utils.showToast('查詢已中止', 'warning');
  };

  // 初始化
  const { mask, container } = createContainer();
  injectStyles();

  const tokenResult = utils.extractToken();
  if (tokenResult) {
    state.token = tokenResult.token;
    state.view = 'query';
    utils.showToast(`已自動偵測到 Token (${tokenResult.source})`, 'info');
  }

  renderer.render();

})();
