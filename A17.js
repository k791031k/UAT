/**
 * @description 凱基人壽案件查詢工具 (現代化重構版)
 * @version 3.0.0
 * @author JavaScript 架構師 (重構並現代化)
 * @date 2025-06-21
 * 
 * 主要改進：
 * - 採用現代卡片式設計語言
 * - 優化色彩系統與對比度 (WCAG 2.1 AA)
 * - 實現微動效與流暢過渡動畫
 * - 模組化架構設計
 * - 響應式佈局優化
 * - 無障礙設計支援
 */

javascript: (async () => {
'use strict';

// ==========================================================================
// 1. 設計系統與常數定義 (Design System & Constants)
// ==========================================================================

const DesignSystem = {
  // 現代化色彩系統 - 符合 WCAG 2.1 AA 標準
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe', 
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      900: '#0c4a6e'
    },
    secondary: {
      50: '#fafafa',
      100: '#f4f4f5',
      500: '#71717a',
      600: '#52525b',
      700: '#3f3f46',
      900: '#18181b'
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d'
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309'
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c'
    },
    info: {
      50: '#f0f9ff',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8'
    }
  },
  
  // 現代化陰影系統
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    card: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    cardHover: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  },
  
  // 響應式斷點
  breakpoints: {
    sm: '640px',
    md: '768px', 
    lg: '1024px',
    xl: '1280px'
  },
  
  // 動畫時間
  transitions: {
    fast: '150ms',
    base: '250ms',
    slow: '350ms'
  }
};

const Constants = {
  API_URLS: {
    UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/caseQuery/query',
    PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/caseQuery/query',
  },
  
  STORAGE_KEYS: {
    TOKEN: 'euisToken',
    A17_TEXT_SETTINGS: 'kgilifeQueryTool_A17TextSettings_v3',
    UI_PREFERENCES: 'kgilifeQueryTool_UIPreferences_v1'
  },
  
  DOM_IDS: {
    TOOL_MAIN_CONTAINER: 'kgilifeQueryToolMainContainer_v3',
  },
  
  Z_INDEX: {
    OVERLAY: 2147483640,
    MAIN_UI: 2147483630,
    NOTIFICATION: 2147483647,
    TOOLTIP: 2147483635
  },
  
  QUERYABLE_FIELD_DEFS: [
    { key: 'receiptNumber', name: '送金單號碼', color: DesignSystem.colors.primary[600], icon: '📄' },
    { key: 'applyNumber', name: '受理號碼', color: DesignSystem.colors.info[600], icon: '📋' },
    { key: 'policyNumber', name: '保單號碼', color: DesignSystem.colors.success[600], icon: '📜' },
    { key: 'approvalNumber', name: '確認書編號', color: DesignSystem.colors.warning[600], icon: '✅' },
    { key: 'insuredId', name: '被保人ＩＤ', color: DesignSystem.colors.secondary[600], icon: '👤' },
  ],
  
  FIELD_DISPLAY_NAMES: {
    applyNumber: '受理號碼',
    policyNumber: '保單號碼', 
    approvalNumber: '確認書編號',
    receiptNumber: '送金單號碼',
    insuredId: '被保人ＩＤ',
    statusCombined: '狀態',
    mainStatus: '主狀態',
    subStatus: '次狀態',
    uwApproverUnit: '分公司',
    uwApprover: '核保員',
    approvalUser: '覆核',
    _queriedValue: '查詢值',
    _rowNumber: '序號',
    _apiQueryStatus: '查詢結果',
    _actions: '操作',
  },
  
  MAIN_DISPLAY_FIELDS_ORDER: [
    'applyNumber', 'policyNumber', 'approvalNumber', 'receiptNumber',
    'insuredId', 'statusCombined', 'uwApproverUnit', 'uwApprover', 'approvalUser'
  ],
  
  UNIT_CODE_MAPPINGS: {
    H: '核保部', B: '北一', C: '台中', K: '高雄',
    N: '台南', P: '北二', T: '桃竹', G: '保作'
  },
  
  A17_UNIT_BUTTON_DEFS: [
    { id: 'H', label: 'H-總公司', color: DesignSystem.colors.primary[600] },
    { id: 'B', label: 'B-北一', color: DesignSystem.colors.success[600] },
    { id: 'P', label: 'P-北二', color: DesignSystem.colors.warning[600] },
    { id: 'T', label: 'T-桃竹', color: DesignSystem.colors.info[600] },
    { id: 'C', label: 'C-台中', color: DesignSystem.colors.warning[700] },
    { id: 'N', label: 'N-台南', color: DesignSystem.colors.info[700] },
    { id: 'K', label: 'K-高雄', color: DesignSystem.colors.error[600] },
    { id: 'UNDEF', label: '查無單位', color: DesignSystem.colors.secondary[500] }
  ],
  
  UNIT_MAP_FIELD_API_KEY: 'uwApproverUnit',
  
  A17_DEFAULT_TEXT_CONTENT: "DEAR,\n\n依據【管理報表：A17 新契約異常帳務】所載內容，報表中列示之送金單號碼，涉及多項帳務異常情形，例如：溢繳、短收、取消件需退費、以及無相對應之案件等問題。\n\n本週我們已逐筆查詢該等異常帳務，結果顯示，這些送金單應對應至下表所列之新契約案件。為利後續帳務處理，敬請協助確認各案件之實際帳務狀況，並如有需調整或處理事項，請一併協助辦理，謝謝。",
};

// ==========================================================================
// 2. 狀態管理系統 (State Management System)
// ==========================================================================

let state = {};

const StateManager = {
  getInitialState() {
    return {
      currentApiUrl: '',
      apiAuthToken: null,
      isQueryCancelled: false,
      originalQueryResults: [],
      baseA17MasterData: [],
      isEditMode: false,
      
      // UI 狀態
      uiState: {
        theme: 'light',
        compactMode: false,
        animationsEnabled: true
      },
      
      dragState: {
        dragging: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0
      },
      
      tableState: {
        sort: { key: null, direction: 'asc' },
        filterTerm: '',
        currentPage: 1,
        itemsPerPage: 50
      },
      
      a17Mode: {
        isActive: false,
        selectedUnits: new Set(),
        textSettings: {
          mainContent: Constants.A17_DEFAULT_TEXT_CONTENT,
          mainFontSize: 12,
          mainLineHeight: 1.5,
          mainFontColor: '#333333',
          dateFontSize: 8,
          dateLineHeight: 1.2,
          dateFontColor: '#555555',
          genDateOffset: -3,
          compDateOffset: 0,
        },
      },
      
      csvImport: {
        fileName: '',
        rawHeaders: [],
        rawData: [],
        isA17CsvPrepared: false,
        a17DisplayCols: [],
        a17MergeKey: null,
        a17MergeApiType: null,
      },
      
      history: [],
    };
  },

  reset() {
    state = this.getInitialState();
    this.loadToken();
    this.loadA17TextSettings();
    this.loadUIPreferences();
  },

  loadToken() {
    state.apiAuthToken = localStorage.getItem(Constants.STORAGE_KEYS.TOKEN);
  },

  setToken(token) {
    state.apiAuthToken = token;
    localStorage.setItem(Constants.STORAGE_KEYS.TOKEN, token);
  },

  clearToken() {
    state.apiAuthToken = null;
    localStorage.removeItem(Constants.STORAGE_KEYS.TOKEN);
  },

  loadA17TextSettings() {
    const saved = localStorage.getItem(Constants.STORAGE_KEYS.A17_TEXT_SETTINGS);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state.a17Mode.textSettings, parsed);
    } catch (e) {
      console.error("載入A17文本設定失敗:", e);
    }
  },

  saveA17TextSettings(settings) {
    try {
      const settingsToSave = JSON.stringify(settings);
      localStorage.setItem(Constants.STORAGE_KEYS.A17_TEXT_SETTINGS, settingsToSave);
      Object.assign(state.a17Mode.textSettings, settings);
    } catch (e) {
      console.error("儲存A17文本設定失敗:", e);
    }
  },

  loadUIPreferences() {
    const saved = localStorage.getItem(Constants.STORAGE_KEYS.UI_PREFERENCES);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state.uiState, parsed);
    } catch (e) {
      console.error("載入UI偏好設定失敗:", e);
    }
  },

  saveUIPreferences() {
    try {
      const prefsToSave = JSON.stringify(state.uiState);
      localStorage.setItem(Constants.STORAGE_KEYS.UI_PREFERENCES, prefsToSave);
    } catch (e) {
      console.error("儲存UI偏好設定失敗:", e);
    }
  },

  pushSnapshot(description = '操作') {
    const snapshot = structuredClone({
      originalQueryResults: state.originalQueryResults,
      baseA17MasterData: state.baseA17MasterData,
      csvImport: state.csvImport,
      a17Mode: {
        isActive: state.a17Mode.isActive,
        selectedUnits: new Set(state.a17Mode.selectedUnits),
        textSettings: structuredClone(state.a17Mode.textSettings)
      }
    });

    state.history.push({ description, snapshot, timestamp: Date.now() });
    
    if (state.history.length > 10) {
      state.history.shift();
    }
    
    UIManager.updateUndoButton();
  },

  undo() {
    if (state.history.length === 0) {
      UIManager.displayNotification("沒有更多操作可復原", 'info');
      return;
    }

    const lastState = state.history.pop();
    state.originalQueryResults = lastState.snapshot.originalQueryResults;
    state.baseA17MasterData = lastState.snapshot.baseA17MasterData;
    state.csvImport = lastState.snapshot.csvImport;
    state.a17Mode = lastState.snapshot.a17Mode;
    state.isEditMode = false;

    TableManager.renderTable();
    UIManager.displayNotification(`已復原: ${lastState.description}`, 'success');
    UIManager.updateUndoButton();
  },
};

// ==========================================================================
// 3. 工具函式 (Utilities)
// ==========================================================================

const Utils = {
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
      return unsafe === null || unsafe === undefined ? '' : String(unsafe);
    }
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '`': '&#96;'
    };
    
    return unsafe.replace(/[&<>"'`]/g, m => map[m] || m);
  },

  extractName(strVal) {
    if (!strVal || typeof strVal !== 'string') return '';
    const matchResult = strVal.match(/^[\u4e00-\u9fa5\uff0a*\u00b7\uff0e]+/);
    return matchResult ? matchResult[0] : strVal.split(' ')[0];
  },

  getFirstLetter(unitString) {
    if (!unitString || typeof unitString !== 'string') return 'UNDEF';
    for (const char of unitString) {
      const upperChar = char.toUpperCase();
      if (upperChar >= 'A' && upperChar <= 'Z') return upperChar;
    }
    return 'UNDEF';
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  },

  // 新增：防抖函式
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 新增：節流函式
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // 新增：動畫工具
  animate(element, keyframes, options = {}) {
    if (!state.uiState.animationsEnabled) return Promise.resolve();
    
    const defaultOptions = {
      duration: 250,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    };
    
    return element.animate(keyframes, { ...defaultOptions, ...options }).finished;
  }
};

// ==========================================================================
// 4. 現代化 UI 管理器 (Modern UI Manager)
// ==========================================================================

const UIManager = {
  mainUI: null,
  _documentEventListeners: {},
  _tooltips: new Map(),

  init() {
    this.injectModernStyles();
    this.setupGlobalEventListeners();
  },

  injectModernStyles() {
    const id = `#${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}`;
    const styleId = `${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_ModernStyles`;
    
    if (document.getElementById(styleId)) return;

    const css = `
      /* 現代化重置與基礎樣式 */
      ${id} { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        box-sizing: border-box; 
        line-height: 1.6;
        color: ${DesignSystem.colors.secondary[900]};
        --transition-base: ${DesignSystem.transitions.base} cubic-bezier(0.4, 0, 0.2, 1);
        --shadow-card: ${DesignSystem.shadows.card};
        --shadow-card-hover: ${DesignSystem.shadows.cardHover};
      }
      ${id} *, ${id} *::before, ${id} *::after { box-sizing: inherit; }

      /* 現代化卡片系統 */
      ${id} .modern-card {
        background: white;
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        border: 1px solid ${DesignSystem.colors.secondary[200]};
        transition: all var(--transition-base);
        overflow: hidden;
      }

      ${id} .modern-card:hover {
        box-shadow: var(--shadow-card-hover);
        transform: translateY(-2px);
        border-color: ${DesignSystem.colors.primary[300]};
      }

      ${id} .modern-card.interactive {
        cursor: pointer;
      }

      ${id} .modern-card.interactive:active {
        transform: translateY(0px) scale(0.98);
      }

      /* 現代化按鈕系統 */
      ${id} .modern-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: all var(--transition-base);
        text-decoration: none;
        white-space: nowrap;
        user-select: none;
        position: relative;
        overflow: hidden;
      }

      ${id} .modern-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s;
      }

      ${id} .modern-btn:hover::before {
        left: 100%;
      }

      ${id} .modern-btn:hover {
        transform: translateY(-1px);
        box-shadow: ${DesignSystem.shadows.md};
      }

      ${id} .modern-btn:active {
        transform: translateY(0px) scale(0.98);
      }

      ${id} .modern-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
      }

      ${id} .modern-btn:disabled:hover {
        box-shadow: none;
      }

      /* 按鈕變體 */
      ${id} .modern-btn.primary {
        background: linear-gradient(135deg, ${DesignSystem.colors.primary[500]}, ${DesignSystem.colors.primary[600]});
        color: white;
      }

      ${id} .modern-btn.primary:hover {
        background: linear-gradient(135deg, ${DesignSystem.colors.primary[600]}, ${DesignSystem.colors.primary[700]});
      }

      ${id} .modern-btn.secondary {
        background: ${DesignSystem.colors.secondary[100]};
        color: ${DesignSystem.colors.secondary[700]};
        border: 1px solid ${DesignSystem.colors.secondary[300]};
      }

      ${id} .modern-btn.secondary:hover {
        background: ${DesignSystem.colors.secondary[200]};
        border-color: ${DesignSystem.colors.secondary[400]};
      }

      ${id} .modern-btn.success {
        background: linear-gradient(135deg, ${DesignSystem.colors.success[500]}, ${DesignSystem.colors.success[600]});
        color: white;
      }

      ${id} .modern-btn.warning {
        background: linear-gradient(135deg, ${DesignSystem.colors.warning[500]}, ${DesignSystem.colors.warning[600]});
        color: white;
      }

      ${id} .modern-btn.error {
        background: linear-gradient(135deg, ${DesignSystem.colors.error[500]}, ${DesignSystem.colors.error[600]});
        color: white;
      }

      ${id} .modern-btn.ghost {
        background: transparent;
        color: ${DesignSystem.colors.primary[600]};
        border: 1px solid ${DesignSystem.colors.primary[300]};
      }

      ${id} .modern-btn.ghost:hover {
        background: ${DesignSystem.colors.primary[50]};
        border-color: ${DesignSystem.colors.primary[400]};
      }

      /* 現代化輸入框系統 */
      ${id} .modern-input-group {
        position: relative;
        margin-bottom: 16px;
      }

      ${id} .modern-input-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: ${DesignSystem.colors.secondary[700]};
        margin-bottom: 6px;
      }

      ${id} .modern-input, ${id} .modern-textarea, ${id} .modern-select {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid ${DesignSystem.colors.secondary[300]};
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background: white;
        transition: all var(--transition-base);
        outline: none;
      }

      ${id} .modern-input:focus, ${id} .modern-textarea:focus, ${id} .modern-select:focus {
        border-color: ${DesignSystem.colors.primary[500]};
        box-shadow: 0 0 0 3px ${DesignSystem.colors.primary[100]};
      }

      ${id} .modern-input:hover, ${id} .modern-textarea:hover, ${id} .modern-select:hover {
        border-color: ${DesignSystem.colors.secondary[400]};
      }

      ${id} .modern-textarea {
        min-height: 100px;
        resize: vertical;
      }

      /* 現代化表格系統 */
      ${id} .modern-table-container {
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: var(--shadow-card);
        border: 1px solid ${DesignSystem.colors.secondary[200]};
      }

      ${id} .modern-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      ${id} .modern-table th {
        background: linear-gradient(135deg, ${DesignSystem.colors.secondary[50]}, ${DesignSystem.colors.secondary[100]});
        padding: 16px 12px;
        text-align: left;
        font-weight: 600;
        color: ${DesignSystem.colors.secondary[700]};
        border-bottom: 2px solid ${DesignSystem.colors.secondary[200]};
        position: sticky;
        top: 0;
        z-index: 10;
        cursor: pointer;
        transition: all var(--transition-base);
        user-select: none;
      }

      ${id} .modern-table th:hover {
        background: linear-gradient(135deg, ${DesignSystem.colors.secondary[100]}, ${DesignSystem.colors.secondary[200]});
      }

      ${id} .modern-table td {
        padding: 12px;
        border-bottom: 1px solid ${DesignSystem.colors.secondary[200]};
        transition: all var(--transition-base);
      }

      ${id} .modern-table tbody tr {
        transition: all var(--transition-base);
      }

      ${id} .modern-table tbody tr:hover {
        background: ${DesignSystem.colors.primary[50]};
      }

      ${id} .modern-table tbody tr:nth-child(even) {
        background: ${DesignSystem.colors.secondary[50]};
      }

      ${id} .modern-table tbody tr:nth-child(even):hover {
        background: ${DesignSystem.colors.primary[100]};
      }

      /* 現代化通知系統 */
      ${id} .modern-notification {
        position: fixed;
        top: 24px;
        right: 24px;
        max-width: 400px;
        background: white;
        border-radius: 12px;
        box-shadow: ${DesignSystem.shadows.lg};
        border: 1px solid ${DesignSystem.colors.secondary[200]};
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: ${Constants.Z_INDEX.NOTIFICATION};
        transform: translateX(calc(100% + 32px));
        transition: all var(--transition-base);
        font-size: 14px;
      }

      ${id} .modern-notification.show {
        transform: translateX(0);
      }

      ${id} .modern-notification.success {
        border-left: 4px solid ${DesignSystem.colors.success[500]};
      }

      ${id} .modern-notification.error {
        border-left: 4px solid ${DesignSystem.colors.error[500]};
      }

      ${id} .modern-notification.warning {
        border-left: 4px solid ${DesignSystem.colors.warning[500]};
      }

      ${id} .modern-notification.info {
        border-left: 4px solid ${DesignSystem.colors.info[500]};
      }

      ${id} .modern-notification-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      ${id} .modern-notification-content {
        flex: 1;
        color: ${DesignSystem.colors.secondary[700]};
      }

      ${id} .modern-notification-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: ${DesignSystem.colors.secondary[500]};
        padding: 4px;
        border-radius: 4px;
        transition: all var(--transition-base);
      }

      ${id} .modern-notification-close:hover {
        background: ${DesignSystem.colors.secondary[100]};
        color: ${DesignSystem.colors.secondary[700]};
      }

      /* 現代化對話框系統 */
      ${id} .modern-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: ${Constants.Z_INDEX.OVERLAY};
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all var(--transition-base);
      }

      ${id} .modern-dialog-overlay.show {
        opacity: 1;
      }

      ${id} .modern-dialog {
        background: white;
        border-radius: 16px;
        box-shadow: ${DesignSystem.shadows.xl};
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.9) translateY(20px);
        transition: all var(--transition-base);
      }

      ${id} .modern-dialog-overlay.show .modern-dialog {
        transform: scale(1) translateY(0);
      }

      ${id} .modern-dialog-header {
        padding: 24px 24px 16px;
        border-bottom: 1px solid ${DesignSystem.colors.secondary[200]};
        background: linear-gradient(135deg, ${DesignSystem.colors.secondary[50]}, white);
      }

      ${id} .modern-dialog-title {
        font-size: 20px;
        font-weight: 600;
        color: ${DesignSystem.colors.secondary[900]};
        margin: 0;
      }

      ${id} .modern-dialog-body {
        padding: 24px;
        overflow-y: auto;
      }

      ${id} .modern-dialog-footer {
        padding: 16px 24px 24px;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        border-top: 1px solid ${DesignSystem.colors.secondary[200]};
        background: ${DesignSystem.colors.secondary[50]};
      }

      /* 現代化載入動畫 */
      ${id} .modern-spinner {
        width: 24px;
        height: 24px;
        border: 3px solid ${DesignSystem.colors.secondary[300]};
        border-top: 3px solid ${DesignSystem.colors.primary[500]};
        border-radius: 50%;
        animation: modernSpin 1s linear infinite;
      }

      @keyframes modernSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* 現代化工具提示 */
      ${id} .modern-tooltip {
        position: absolute;
        background: ${DesignSystem.colors.secondary[900]};
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        z-index: ${Constants.Z_INDEX.TOOLTIP};
        opacity: 0;
        transform: translateY(4px);
        transition: all var(--transition-base);
        pointer-events: none;
      }

      ${id} .modern-tooltip.show {
        opacity: 1;
        transform: translateY(0);
      }

      ${id} .modern-tooltip::before {
        content: '';
        position: absolute;
        top: -4px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid ${DesignSystem.colors.secondary[900]};
      }

      /* 響應式設計 */
      @media (max-width: ${DesignSystem.breakpoints.md}) {
        ${id} .modern-btn {
          padding: 10px 16px;
          font-size: 13px;
        }
        
        ${id} .modern-dialog {
          margin: 16px;
          max-width: calc(100vw - 32px);
        }
        
        ${id} .modern-notification {
          right: 16px;
          left: 16px;
          max-width: none;
        }
      }

      /* 無障礙設計 */
      ${id} .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      ${id} .focus-visible {
        outline: 2px solid ${DesignSystem.colors.primary[500]};
        outline-offset: 2px;
      }

      /* 動畫偏好設定 */
      @media (prefers-reduced-motion: reduce) {
        ${id} *, ${id} *::before, ${id} *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = css.replace(/\s\s+/g, ' ');
    document.head.appendChild(styleEl);
  },

  setupGlobalEventListeners() {
    // 鍵盤快捷鍵
    this._documentEventListeners['keydown'] = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'z':
            if (!e.shiftKey) {
              e.preventDefault();
              StateManager.undo();
            }
            break;
          case 'f':
            e.preventDefault();
            const filterInput = this.mainUI?.querySelector(`#${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_Filter`);
            if (filterInput) filterInput.focus();
            break;
        }
      }
    };
    
    document.addEventListener('keydown', this._documentEventListeners['keydown']);
  },

  displayNotification(message, type = 'info', duration = 4000) {
    const id = `${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_ModernNotification`;
    document.getElementById(id)?.remove();

    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `modern-notification ${type}`;

    const iconMap = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };

    notification.innerHTML = `
      <div class="modern-notification-icon">${iconMap[type] || iconMap.info}</div>
      <div class="modern-notification-content">${Utils.escapeHtml(message)}</div>
      <button class="modern-notification-close" aria-label="關閉通知">×</button>
    `;

    const closeBtn = notification.querySelector('.modern-notification-close');
    closeBtn.onclick = () => this.hideNotification(notification);

    document.body.appendChild(notification);

    // 顯示動畫
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // 自動隱藏
    if (duration > 0) {
      setTimeout(() => this.hideNotification(notification), duration);
    }

    return notification;
  },

  hideNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
  },

  createModernDialog(title, content, options = {}) {
    const {
      size = 'md',
      showHeader = true,
      showFooter = true,
      footerButtons = [],
      onClose = null,
      closeOnEscape = true,
      closeOnOverlay = true
    } = options;

    const dialogId = `${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_ModernDialog_${Date.now()}`;
    
    const overlay = document.createElement('div');
    overlay.id = `${dialogId}_overlay`;
    overlay.className = 'modern-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = `modern-dialog modern-dialog-${size}`;

    let dialogHTML = '';

    if (showHeader) {
      dialogHTML += `
        <div class="modern-dialog-header">
          <h2 class="modern-dialog-title">${Utils.escapeHtml(title)}</h2>
        </div>
      `;
    }

    dialogHTML += `
      <div class="modern-dialog-body">
        ${content}
      </div>
    `;

    if (showFooter && footerButtons.length > 0) {
      const buttonsHTML = footerButtons.map(btn => 
        `<button class="modern-btn ${btn.variant || 'secondary'}" data-action="${btn.action}">${Utils.escapeHtml(btn.text)}</button>`
      ).join('');
      
      dialogHTML += `
        <div class="modern-dialog-footer">
          ${buttonsHTML}
        </div>
      `;
    }

    dialog.innerHTML = dialogHTML;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 事件處理
    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 250);
      if (onClose) onClose();
    };

    if (closeOnEscape) {
      const escListener = (e) => {
        if (e.key === 'Escape') {
          close();
          document.removeEventListener('keydown', escListener);
        }
      };
      document.addEventListener('keydown', escListener);
    }

    if (closeOnOverlay) {
      overlay.onclick = (e) => {
        if (e.target === overlay) close();
      };
    }

    // 按鈕事件
    dialog.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        if (action === 'close') {
          close();
        } else if (options.onButtonClick) {
          options.onButtonClick(action, close);
        }
      };
    });

    // 顯示動畫
    requestAnimationFrame(() => {
      overlay.classList.add('show');
    });

    return { overlay, dialog, close };
  },

  showTooltip(element, text, position = 'top') {
    const tooltipId = `tooltip_${Date.now()}`;
    const tooltip = document.createElement('div');
    tooltip.id = tooltipId;
    tooltip.className = 'modern-tooltip';
    tooltip.textContent = text;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left, top;

    switch (position) {
      case 'top':
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        top = rect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        left = rect.left + (rect.width - tooltipRect.width) / 2;
        top = rect.bottom + 8;
        break;
      case 'left':
        left = rect.left - tooltipRect.width - 8;
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        break;
      case 'right':
        left = rect.right + 8;
        top = rect.top + (rect.height - tooltipRect.height) / 2;
        break;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    requestAnimationFrame(() => {
      tooltip.classList.add('show');
    });

    this._tooltips.set(element, tooltip);

    return tooltip;
  },

  hideTooltip(element) {
    const tooltip = this._tooltips.get(element);
    if (tooltip) {
      tooltip.classList.remove('show');
      setTimeout(() => tooltip.remove(), 150);
      this._tooltips.delete(element);
    }
  },

  showEnvSelectionDialog() {
    return new Promise(resolve => {
      const content = `
        <div style="text-align: center; padding: 20px 0;">
          <p style="margin-bottom: 24px; color: ${DesignSystem.colors.secondary[600]};">
            請選擇要查詢的環境
          </p>
          <div style="display: flex; gap: 16px; justify-content: center;">
            <button class="modern-btn primary" data-action="uat">
              🧪 測試環境 (UAT)
            </button>
            <button class="modern-btn success" data-action="prod">
              🚀 正式環境 (PROD)
            </button>
          </div>
        </div>
      `;

      const { close } = this.createModernDialog('選擇查詢環境', content, {
        size: 'sm',
        showFooter: false,
        closeOnEscape: true,
        closeOnOverlay: false,
        onButtonClick: (action) => {
          if (action === 'uat' || action === 'prod') {
            resolve(action);
            close();
          }
        },
        onClose: () => resolve(null)
      });
    });
  },

  showTokenDialog(attempt = 1) {
    return new Promise(resolve => {
      const isRetry = attempt > 1;
      const content = `
        <div style="padding: 8px 0;">
          ${isRetry ? `
            <div style="background: ${DesignSystem.colors.error[50]}; border: 1px solid ${DesignSystem.colors.error[200]}; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
              <div style="color: ${DesignSystem.colors.error[700]}; font-weight: 500;">⚠️ Token 驗證失敗</div>
              <div style="color: ${DesignSystem.colors.error[600]}; font-size: 13px; margin-top: 4px;">請檢查 Token 是否正確，或聯繫系統管理員</div>
            </div>
          ` : ''}
          
          <div class="modern-input-group">
            <label class="modern-input-label" for="token-input">API Token</label>
            <input type="password" id="token-input" class="modern-input" 
                   placeholder="請輸入您的 API Token..." 
                   autocomplete="off">
            <div style="font-size: 12px; color: ${DesignSystem.colors.secondary[500]}; margin-top: 6px;">
              💡 Token 將安全地儲存在本地，用於 API 驗證
            </div>
          </div>
        </div>
      `;

      const buttons = [
        { text: '略過', action: 'skip', variant: 'ghost' },
        { text: '關閉工具', action: 'close', variant: 'secondary' },
        { text: isRetry ? '重試' : '確認', action: 'submit', variant: 'primary' }
      ];

      // 多次失敗後禁用重試按鈕
      if (attempt > 3) {
        buttons[2].disabled = true;
        buttons[2].text = '已禁用';
      }

      const { dialog, close } = this.createModernDialog('API Token 設定', content, {
        size: 'md',
        footerButtons: buttons,
        closeOnEscape: true,
        onButtonClick: (action) => {
          const input = dialog.querySelector('#token-input');
          const value = input.value.trim();

          switch (action) {
            case 'submit':
              if (attempt <= 3) {
                resolve({ action: 'submit', value });
                close();
              }
              break;
            case 'skip':
              resolve({ action: 'skip' });
              close();
              break;
            case 'close':
              resolve({ action: 'close' });
              close();
              break;
          }
        },
        onClose: () => resolve({ action: 'cancel' })
      });

      // 自動聚焦輸入框
      setTimeout(() => {
        const input = dialog.querySelector('#token-input');
        if (input) input.focus();
      }, 300);
    });
  },

  showQuerySetupDialog() {
    return new Promise(resolve => {
      const queryButtonsHtml = Constants.QUERYABLE_FIELD_DEFS.map(def => `
        <button class="modern-btn ghost query-type-btn" 
                data-apikey="${def.key}" 
                style="border-color: ${def.color}; color: ${def.color};">
          <span style="font-size: 16px;">${def.icon}</span>
          ${Utils.escapeHtml(def.name)}
        </button>
      `).join('');

      const content = `
        <div style="padding: 8px 0;">
          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; color: ${DesignSystem.colors.secondary[700]}; font-size: 16px;">
              1️⃣ 選擇查詢欄位類型
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
              ${queryButtonsHtml}
            </div>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; color: ${DesignSystem.colors.secondary[700]}; font-size: 16px;">
              2️⃣ 輸入查詢值
            </h3>
            <div class="modern-input-group">
              <textarea id="query-values-input" class="modern-textarea" 
                        placeholder="請輸入查詢值（可多筆，以換行/空格/逗號/分號分隔）..." 
                        rows="4"></textarea>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 12px;">
              <button class="modern-btn secondary" id="csv-import-btn">
                📁 從 CSV/TXT 匯入
              </button>
              <button class="modern-btn ghost" id="clear-input-btn">
                🗑️ 清除輸入
              </button>
            </div>
            
            <input type="file" id="file-input-hidden" accept=".csv,.txt" style="display: none;">
            <div id="csv-filename-display" style="font-size: 12px; color: ${DesignSystem.colors.success[600]}; margin-top: 8px;"></div>
          </div>
        </div>
      `;

      const buttons = [
        { text: '取消', action: 'cancel', variant: 'secondary' },
        { text: '開始查詢', action: 'submit', variant: 'primary' }
      ];

      const { dialog, close } = this.createModernDialog('查詢條件設定', content, {
        size: 'lg',
        footerButtons: buttons,
        closeOnEscape: true,
        onButtonClick: (action) => {
          if (action === 'cancel') {
            resolve(null);
            close();
          } else if (action === 'submit') {
            const selectedBtn = dialog.querySelector('.query-type-btn.selected');
            const queryValues = dialog.querySelector('#query-values-input').value.trim();
            
            if (!selectedBtn) {
              this.displayNotification('請選擇查詢欄位類型', 'warning');
              return;
            }
            
            if (!queryValues && !state.csvImport.isA17CsvPrepared) {
              this.displayNotification('請輸入查詢值或匯入 CSV', 'warning');
              return;
            }

            resolve({
              selectedApiKey: selectedBtn.dataset.apikey,
              queryValues: queryValues
            });
            close();
          }
        },
        onClose: () => resolve(null)
      });

      // 綁定查詢類型按鈕事件
      const typeButtons = dialog.querySelectorAll('.query-type-btn');
      let selectedQueryDef = Constants.QUERYABLE_FIELD_DEFS[0];

      const setActiveButton = (apiKey) => {
        selectedQueryDef = Constants.QUERYABLE_FIELD_DEFS.find(d => d.key === apiKey);
        typeButtons.forEach(btn => {
          const isSelected = btn.dataset.apikey === apiKey;
          if (isSelected) {
            btn.classList.add('selected');
            btn.style.background = selectedQueryDef.color;
            btn.style.color = 'white';
            btn.style.borderColor = selectedQueryDef.color;
          } else {
            btn.classList.remove('selected');
            btn.style.background = 'transparent';
            btn.style.color = btn.dataset.apikey === Constants.QUERYABLE_FIELD_DEFS.find(d => d.key === btn.dataset.apikey)?.key 
              ? Constants.QUERYABLE_FIELD_DEFS.find(d => d.key === btn.dataset.apikey).color 
              : DesignSystem.colors.secondary[600];
            btn.style.borderColor = btn.dataset.apikey === Constants.QUERYABLE_FIELD_DEFS.find(d => d.key === btn.dataset.apikey)?.key 
              ? Constants.QUERYABLE_FIELD_DEFS.find(d => d.key === btn.dataset.apikey).color 
              : DesignSystem.colors.secondary[300];
          }
        });

        const queryInput = dialog.querySelector('#query-values-input');
        queryInput.placeholder = `請輸入 ${selectedQueryDef.name}（可多筆...）`;
      };

      // 初始化第一個按鈕為選中狀態
      setActiveButton(selectedQueryDef.key);

      typeButtons.forEach(btn => {
        btn.onclick = () => {
          setActiveButton(btn.dataset.apikey);
          dialog.querySelector('#query-values-input').focus();
        };
      });

      // CSV 匯入功能
      dialog.querySelector('#csv-import-btn').onclick = () => {
        dialog.querySelector('#file-input-hidden').click();
      };

      dialog.querySelector('#file-input-hidden').onchange = (e) => {
        CSVManager.handleFileSelect(e);
      };

      // 清除輸入功能
      dialog.querySelector('#clear-input-btn').onclick = () => {
        dialog.querySelector('#query-values-input').value = '';
        dialog.querySelector('#csv-filename-display').textContent = '';
        dialog.querySelector('#file-input-hidden').value = '';
        state.csvImport = StateManager.getInitialState().csvImport;
        this.displayNotification('所有輸入已清除', 'success');
      };
    });
  },

  showLoadingDialog() {
    const content = `
      <div style="text-align: center; padding: 20px 0;">
        <div class="modern-spinner" style="margin: 0 auto 16px;"></div>
        <h3 id="loading-title" style="margin: 0 0 8px 0; color: ${DesignSystem.colors.secondary[700]};">
          查詢準備中...
        </h3>
        <p id="loading-message" style="margin: 0; color: ${DesignSystem.colors.secondary[500]}; font-size: 14px;">
          正在初始化查詢流程
        </p>
        <div style="margin-top: 24px;">
          <button class="modern-btn error" id="terminate-btn">
            ⏹️ 終止查詢
          </button>
        </div>
      </div>
    `;

    const { dialog, close } = this.createModernDialog('查詢進行中', content, {
      size: 'sm',
      showFooter: false,
      closeOnEscape: false,
      closeOnOverlay: false
    });

    const titleEl = dialog.querySelector('#loading-title');
    const messageEl = dialog.querySelector('#loading-message');
    const terminateBtn = dialog.querySelector('#terminate-btn');

    terminateBtn.onclick = () => {
      state.isQueryCancelled = true;
      titleEl.textContent = '正在終止查詢...';
      messageEl.textContent = '請稍候，將在完成當前請求後停止';
      terminateBtn.disabled = true;
      terminateBtn.textContent = '⏳ 終止中...';
      this.displayNotification('查詢終止請求已發送', 'warning', 4000);
    };

    const update = (count, total, value) => {
      const percentage = Math.round((count / total) * 100);
      titleEl.textContent = `查詢進度 ${count}/${total} (${percentage}%)`;
      messageEl.textContent = `正在處理: ${Utils.escapeHtml(value)}`;
    };

    return { update, close };
  },

  updateUndoButton() {
    if (!this.mainUI) return;
    
    const undoBtn = this.mainUI.querySelector(`#${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnUndo`);
    if (undoBtn) {
      const canUndo = state.history.length > 0;
      undoBtn.disabled = !canUndo;
      undoBtn.innerHTML = `
        <span style="font-size: 16px;">↶</span>
        復原 (${state.history.length})
      `;
      
      if (canUndo) {
        const lastAction = state.history[state.history.length - 1];
        this.showTooltip(undoBtn, `復原: ${lastAction.description}`);
      }
    }
  },

  createMainUI() {
    this.mainUI?.remove();

    const ui = document.createElement('div');
    this.mainUI = ui;
    ui.id = Constants.DOM_IDS.TOOL_MAIN_CONTAINER;
    
    ui.style.cssText = `
      position: fixed;
      z-index: ${Constants.Z_INDEX.MAIN_UI};
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 95vw;
      max-width: 1400px;
      height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: ${DesignSystem.shadows.xl};
      border: 1px solid ${DesignSystem.colors.secondary[200]};
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 標題欄
    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
      background: linear-gradient(135deg, ${DesignSystem.colors.primary[500]}, ${DesignSystem.colors.primary[600]});
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      user-select: none;
    `;
    
    titleBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">🏢</span>
        <h1 style="margin: 0; font-size: 18px; font-weight: 600;">凱基人壽案件查詢結果</h1>
      </div>
      <div style="font-size: 12px; opacity: 0.9;">v3.0 現代化版本</div>
    `;

    // 控制區
    const controlsBar = document.createElement('div');
    controlsBar.style.cssText = `
      background: ${DesignSystem.colors.secondary[50]};
      border-bottom: 1px solid ${DesignSystem.colors.secondary[200]};
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    `;

    controlsBar.innerHTML = `
      <button class="modern-btn secondary" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnUndo">
        <span style="font-size: 16px;">↶</span>
        復原 (0)
      </button>
      
      <button class="modern-btn primary" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnRequery">
        <span style="font-size: 16px;">🔄</span>
        重新查詢
      </button>
      
      <button class="modern-btn info" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnA17">
        <span style="font-size: 16px;">📊</span>
        A17作業
      </button>
      
      <button class="modern-btn success" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnCopy">
        <span style="font-size: 16px;">📋</span>
        複製表格
      </button>
      
      <button class="modern-btn warning" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnEdit">
        <span style="font-size: 16px;">✏️</span>
        編輯模式
      </button>
      
      <button class="modern-btn ghost" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnAddRow" style="display: none;">
        <span style="font-size: 16px;">➕</span>
        新增列
      </button>
      
      <div style="flex: 1;"></div>
      
      <div class="modern-input-group" style="margin: 0; min-width: 200px;">
        <input type="text" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_Filter" 
               class="modern-input" placeholder="🔍 搜尋表格內容..." 
               style="margin: 0; padding: 8px 12px; font-size: 13px;">
      </div>
      
      <button class="modern-btn error" id="${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_btnClose">
        <span style="font-size: 16px;">✕</span>
        關閉工具
      </button>
    `;

    // A17 控制區
    const a17Controls = document.createElement('div');
    a17Controls.id = `${Constants.DOM_IDS.TOOL_MAIN_CONTAINER}_A17
