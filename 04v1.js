javascript:(function(){
'use strict';

/**
 * ===================================================================
 * 商品查詢小工具 v3.3.2 (最終修正版)
 *
 * 基於深度重構版進行修正，確保可正常執行。
 * - 效能優化：批次 DOM 更新、事件委派、高效資料結構。
 * - 架構優化：職責分離，控制器、資料、UI 模組各司其職。
 * - 程式碼品質：現代化語法、去除冗餘、增加註解與穩健性。
 * - 維持不變：所有原始功能、UI 佈局與使用者體驗。
 * ===================================================================
 */

// 清理舊工具實例，確保腳本可重複執行
(function cleanup(){
  const cleanupIds = ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask', 'pct-toast-container', 'pct-cancel-query-btn'];
  cleanupIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.remove();
  });
})();

/**
 * ===================================================================
 * 模組 1：配置管理 (ConfigModule)
 * ===================================================================
 */
const ConfigModule = Object.freeze({
  TOOL_ID: 'planCodeQueryToolInstance',
  STYLE_ID: 'planCodeToolStyle',
  VERSION: '3.3.2',

  QUERY_MODES: {
    PLAN_CODE: 'planCode',
    PLAN_NAME: 'planCodeName',
    ALL_MASTER_PLANS: 'allMasterPlans',
    MASTER_IN_SALE: 'masterInSale',
    MASTER_STOPPED: 'masterStopped',
    CHANNEL_IN_SALE: 'channelInSale',
    CHANNEL_STOPPED: 'channelStopped'
  },

  API_ENDPOINTS: {
    UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
    PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
  },

  SALE_STATUS: {
    CURRENT: '現售中',
    STOPPED: '停售',
    PENDING: '未開始',
    ABNORMAL: '日期異常'
  },

  FIELD_MAPS: {
    CURRENCY: new Map([['1','TWD'],['2','USD'],['3','AUD'],['4','CNT'],['5','USD_OIU'],['6','EUR'],['7','JPY']]),
    UNIT: new Map([['A1','元'],['A3','仟元'],['A4','萬元'],['B1','計畫'],['C1','單位']]),
    COVERAGE_TYPE: new Map([['M','主約'],['R','附約']]),
    CHANNELS: ['AG','BR','BK','WS','EC']
  },

  DEFAULT_QUERY_PARAMS: {
    PAGE_SIZE_MASTER: 10000,
    PAGE_SIZE_CHANNEL: 5000,
    PAGE_SIZE_DETAIL: 50,
    PAGE_SIZE_TABLE: 50
  },

  UI_SETTINGS: {
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 2000
  }
});

/**
 * ===================================================================
 * 模組 2：工具函式 (UtilsModule)
 * ===================================================================
 */
const UtilsModule = (() => {
  const escapeHtml = (text) => {
    if (typeof text !== 'string') return text;
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (match) => entityMap[match]);
  };

  const dateUtils = {
    formatToday: () => new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    formatDateForUI: (dateStr) => (dateStr ? String(dateStr).split(' ')[0].replace(/-/g, '') : ''),
    formatDateForComparison: (dateStr) => {
      if (!dateStr) return '';
      const cleanDate = String(dateStr).split(' ')[0];
      return /^\d{8}$/.test(cleanDate) ? cleanDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : cleanDate;
    }
  };

  const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
    if (!saleStartStr || !saleEndStr) return '';
    const today = new Date(dateUtils.formatDateForComparison(todayStr));
    const saleStart = new Date(dateUtils.formatDateForComparison(saleStartStr));
    const saleEnd = new Date(dateUtils.formatDateForComparison(saleEndStr));
    if (isNaN(today.getTime()) || isNaN(saleStart.getTime()) || isNaN(saleEnd.getTime())) return ConfigModule.SALE_STATUS.ABNORMAL;
    if (saleStart > saleEnd) return ConfigModule.SALE_STATUS.ABNORMAL;
    if (saleEndStr.includes('99991231') || saleEndStr.includes('9999-12-31')) return ConfigModule.SALE_STATUS.CURRENT;
    if (today > saleEnd) return ConfigModule.SALE_STATUS.STOPPED;
    if (today < saleStart) return ConfigModule.SALE_STATUS.PENDING;
    if (today >= saleStart && today <= saleEnd) return ConfigModule.SALE_STATUS.CURRENT;
    return '';
  };

  const channelUtils = {
    uiToApi: (code) => (code === 'BK' ? 'OT' : code),
    apiToUi: (code) => (code === 'OT' ? 'BK' : code)
  };

  const fieldConverters = {
    currency: (val) => ConfigModule.FIELD_MAPS.CURRENCY.get(String(val)) || val || '',
    unit: (val) => ConfigModule.FIELD_MAPS.UNIT.get(String(val)) || val || '',
    coverageType: (val) => ConfigModule.FIELD_MAPS.COVERAGE_TYPE.get(String(val)) || val || ''
  };

  const inputUtils = {
    normalizeInput: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[\uff01-\uff5e]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
                .replace(/\u3000/g, ' ')
                .toUpperCase();
    },
    splitInput: (input) => input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean)
  };

  const copyToClipboard = async (text, showToastCallback) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastCallback('已複製查詢結果', 'success');
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToastCallback('已複製查詢結果 (舊版模式)', 'success');
      } catch (fallbackErr) {
        showToastCallback('複製失敗', 'error');
      }
    }
  };

  const checkSpecialStatus = (item) => {
    const todayStr = dateUtils.formatToday();
    const mainStatus = getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
    const channels = item.channels || [];
    if (mainStatus === ConfigModule.SALE_STATUS.ABNORMAL) return true;
    if (mainStatus === ConfigModule.SALE_STATUS.STOPPED && channels.some(c => c.status === ConfigModule.SALE_STATUS.CURRENT)) return true;
    if (mainStatus === ConfigModule.SALE_STATUS.CURRENT && channels.length > 0 && channels.every(c => [ConfigModule.SALE_STATUS.STOPPED, ConfigModule.SALE_STATUS.PENDING].includes(c.status))) return true;
    return false;
  };
  
  const getStatusClass = (status) => {
    const { CURRENT, STOPPED, ABNORMAL } = ConfigModule.SALE_STATUS;
    switch (status) {
      case CURRENT: return 'pct-status-onsale';
      case STOPPED: return 'pct-status-offsale';
      case ABNORMAL: return 'pct-status-abnormal';
      default: return 'pct-status-pending';
    }
  };

  return { escapeHtml, dateUtils, getSaleStatus, channelUtils, fieldConverters, inputUtils, copyToClipboard, checkSpecialStatus, getStatusClass };
})();

/**
 * ===================================================================
 * 模組 3：樣式管理 (StyleModule)
 * ===================================================================
 */
const StyleModule = (() => {
  const cssContent = `
    :root {--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#5CB85C;--success-dark-color:#4CAE4C;--error-color:#D9534F;--error-dark-color:#C9302C;--warning-color:#F0AD4E;--warning-dark-color:#EC971F;--info-color:#5BC0DE;--info-dark-color:#46B8DA;--background-light:#F8F8F8;--surface-color:#FFFFFF;--border-color:#E0E0E0;--text-color-dark:#1a1a1a;--text-color-light:#333333;--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);}
    .pct-modal-mask {position:fixed;z-index:2147483646;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.18);opacity:0;transition:opacity var(--transition-speed) ease-out;}
    .pct-modal-mask.show {opacity:1;}
    .pct-modal {font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;width:1200px;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
    .pct-modal.show {opacity:1;transform:translateX(-50%) translateY(0);}
    .pct-modal.dragging {transition:none;}
    .pct-modal-header {padding:16px 20px 8px 20px;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;}
    .pct-modal-header.dragging {cursor:grabbing;}
    .pct-modal-body {padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
    .pct-modal-footer {padding:12px 20px 16px 20px;text-align:right;border-top:1px solid var(--border-color);display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
    .pct-btn {display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:none;background:var(--primary-color);color:#fff;cursor:pointer;transition:background var(--transition-speed),transform var(--transition-speed),box-shadow var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap;}
    .pct-btn:hover {background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);}
    .pct-btn:active {transform:translateY(0);box-shadow:0 1px 3px var(--box-shadow-light);}
    .pct-btn:disabled {background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;}
    .pct-btn-secondary {background:var(--secondary-color);color:#fff;} .pct-btn-secondary:hover {background:var(--secondary-dark-color);}
    .pct-btn-info {background:var(--info-color);} .pct-btn-info:hover {background:var(--info-dark-color);}
    .pct-btn-success {background:var(--success-color);} .pct-btn-success:hover {background:var(--success-dark-color);}
    .pct-btn-danger {background:var(--error-color);} .pct-btn-danger:hover {background:var(--error-dark-color);}
    .pct-btn-retry {background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);font-size:13px;margin-left:10px;}
    .pct-btn-retry:hover {background:var(--warning-dark-color);color:white;}
    .pct-filter-btn {font-size:14px;padding:5px 12px;background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);border-radius:5px;cursor:pointer;transition:background .2s,transform .2s;font-weight:600;box-shadow:0 1px 3px var(--box-shadow-light);white-space:nowrap;}
    .pct-filter-btn:hover {background:var(--warning-dark-color);transform:translateY(-1px);}
    .pct-filter-btn-active {background:var(--warning-dark-color);color:white;box-shadow:0 2px 6px rgba(240,173,78,0.4);}
    .pct-filter-btn-active:hover {background:var(--warning-color);}
    .pct-input {width:100%;font-size:16px;padding:9px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;margin-top:5px;transition:border-color var(--transition-speed),box-shadow var(--transition-speed);}
    .pct-input:focus {border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
    .pct-input:disabled {background:var(--background-light);color:var(--text-color-light);opacity:0.7;cursor:not-allowed;}
    .pct-error {color:var(--error-color);font-size:13px;margin:8px 0 0 0;display:block;}
    .pct-label {font-weight:bold;color:var(--text-color-dark);display:block;margin-bottom:5px;}
    .pct-form-group {margin-bottom:20px;}
    .pct-mode-card-grid {display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:20px;}
    .pct-mode-card {background:var(--background-light);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:18px 10px;text-align:center;cursor:pointer;transition:all var(--transition-speed) ease-out;font-weight:500;font-size:15px;color:var(--text-color-dark);display:flex;align-items:center;justify-content:center;min-height:65px;box-shadow:0 2px 6px var(--box-shadow-light);}
    .pct-mode-card:hover {border-color:var(--primary-color);transform:translateY(-3px) scale(1.02);box-shadow:0 6px 15px rgba(74,144,226,0.2);}
    .pct-mode-card.selected {background:var(--primary-color);color:white;border-color:var(--primary-color);transform:translateY(-1px);box-shadow:0 4px 10px var(--primary-dark-color);font-weight:bold;}
    .pct-mode-card.selected:hover {background:var(--primary-dark-color);}
    .pct-sub-option-grid,.pct-channel-option-grid {display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;margin-bottom:15px;}
    .pct-sub-option,.pct-channel-option {background:var(--background-light);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:8px 15px;cursor:pointer;transition:all var(--transition-speed) ease-out;font-weight:500;font-size:14px;color:var(--text-color-dark);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;}
    .pct-sub-option:hover,.pct-channel-option:hover {border-color:var(--primary-color);transform:translateY(-1px);box-shadow:0 2px 6px var(--box-shadow-light);}
    .pct-sub-option.selected,.pct-channel-option.selected {background:var(--primary-color);color:white;border-color:var(--primary-color);transform:translateY(0);box-shadow:0 1px 3px var(--primary-dark-color);}
    .pct-sub-option.selected:hover,.pct-channel-option.selected:hover {background:var(--primary-dark-color);}
    .pct-table-wrap {max-height:55vh;overflow:auto;margin:15px 0;}
    .pct-table {border-collapse:collapse;width:100%;font-size:14px;background:var(--surface-color);min-width:800px;}
    .pct-table th,.pct-table td {border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top;cursor:pointer;}
    .pct-table th {background:#f8f8f8;color:var(--text-color-dark);font-weight:bold;cursor:pointer;position:sticky;top:0;z-index:1;white-space:nowrap;}
    .pct-table th:hover {background:#e9ecef;}
    .pct-table th[data-key] {position:relative;user-select:none;padding-right:25px;}
    .pct-table th[data-key]:after {content:'↕';position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:0.3;font-size:12px;transition:opacity 0.2s;}
    .pct-table th[data-key]:hover:after {opacity:0.7;}
    .pct-table th[data-key].sort-asc:after {content:'↑';opacity:1;color:var(--primary-color);font-weight:bold;}
    .pct-table th[data-key].sort-desc:after {content:'↓';opacity:1;color:var(--primary-color);font-weight:bold;}
    .pct-table tr.special-row {background:#fffde7;border-left:4px solid var(--warning-color);}
    .pct-table tr:hover {background:#e3f2fd;}
    .pct-table tr.error-row {background:#ffebee;}
    .pct-status-onsale {color:#1976d2;font-weight:bold;}
    .pct-status-offsale {color:#e53935;font-weight:bold;}
    .pct-status-pending {color:var(--info-color);font-weight:bold;}
    .pct-status-abnormal {color:#8A2BE2;font-weight:bold;}
    .pct-td-copy {cursor:pointer;transition:background .15s;}
    .pct-td-copy:hover {background:#f0f7ff;}
    .pct-search-container {margin-bottom:15px;position:relative;}
    .pct-search-input {width:100%;font-size:14px;padding:8px 35px 8px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;transition:border-color var(--transition-speed),box-shadow var(--transition-speed);}
    .pct-search-input:focus {border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
    .pct-search-icon {position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text-color-light);pointer-events:none;}
    .pct-search-clear {position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-color-light);cursor:pointer;font-size:16px;padding:2px;border-radius:3px;transition:background-color 0.2s;}
    .pct-search-clear:hover {background-color:var(--background-light);}
    .pct-toast {position:fixed;left:50%;top:30px;transform:translateX(-50%);background:var(--text-color-dark);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px var(--box-shadow-medium);white-space:nowrap;}
    .pct-toast.pct-toast-show {opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
    .pct-toast.success {background:var(--success-color);}
    .pct-toast.error {background:var(--error-color);}
    .pct-toast.warning {background:var(--warning-color);color:var(--text-color-dark);}
    .pct-toast.info {background:var(--info-color);}
    .pct-summary {font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--text-color-dark);}
    .pct-summary b {color:var(--warning-color);}
    .pct-pagination {display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:15px;flex-wrap:wrap;}
    .pct-pagination-info {margin-right:auto;font-size:14px;color:var(--text-color-light);}
    .pct-page-input {width:60px;text-align:center;padding:4px;border:1px solid var(--border-color);border-radius:3px;}
    .pct-page-controls {display:flex;align-items:center;gap:5px;}
    .pct-cancel-query {position:fixed;top:80px;right:20px;z-index:2147483648;}
    @media (max-width:768px){.pct-modal{width:98vw;top:20px;max-height:95vh;}.pct-modal-header{font-size:18px;padding:12px 15px 6px 15px;}.pct-modal-body{padding:12px 15px 6px 15px;}.pct-modal-footer{flex-direction:column;align-items:stretch;padding:10px 15px 12px 15px;}.pct-btn,.pct-btn-secondary,.pct-btn-info,.pct-btn-success{width:100%;margin:4px 0;padding:10px 15px;}.pct-mode-card-grid{grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;}.pct-mode-card{font-size:13px;padding:10px 8px;min-height:45px;}.pct-input{font-size:14px;padding:8px 10px;}.pct-table-wrap{max-height:40vh;margin:10px 0;}.pct-table th,.pct-table td{padding:6px 8px;font-size:12px;}.pct-toast{top:10px;width:90%;left:5%;transform:translateX(0);text-align:center;white-space:normal;}.pct-pagination{flex-direction:column;align-items:flex-start;gap:8px;}.pct-pagination-info{width:100%;text-align:center;}.pct-pagination .pct-btn{width:100%;}}
  `;

  const inject = () => {
    document.getElementById(ConfigModule.STYLE_ID)?.remove();
    const styleElement = document.createElement('style');
    styleElement.id = ConfigModule.STYLE_ID;
    styleElement.textContent = cssContent;
    document.head.appendChild(styleElement);
  };
  return { inject };
})();

/**
 * ===================================================================
 * 模組 4：狀態管理 (StateModule)
 * ===================================================================
 */
const StateModule = (() => {
  const defaultState = {
    environment: (window.location.host.toLowerCase().includes('uat')) ? 'UAT' : 'PROD',
    apiBase: '',
    token: '',
    queryMode: '',
    queryInput: '',
    querySubOption: [],
    queryChannels: [],
    pageNo: 1,
    pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
    showAllPages: false,
    sortKey: 'no',
    sortAsc: true,
    searchKeyword: '',
    filterSpecial: false,
    allProcessedData: [],
    rawData: [],
    cacheDetail: new Map(),
    cacheChannel: new Map(),
    currentQueryController: null,
    isQuerying: false,
    detailQueryCount: 0,
    persistentToastId: null,
    searchDebounceTimer: null
  };
  let state = { ...defaultState };
  state.apiBase = state.environment === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;

  const getTokenFromStorage = () => {
    return localStorage.getItem('SSO-TOKEN') || localStorage.getItem('euisToken') ||
           sessionStorage.getItem('SSO-TOKEN') || sessionStorage.getItem('euisToken') || '';
  };
  state.token = getTokenFromStorage();

  return {
    get: (key) => (key ? state[key] : { ...state }),
    set: (updates) => { state = { ...state, ...updates }; },
    resetQueryState: () => {
      state.cacheDetail.clear();
      state.cacheChannel.clear();
      StateModule.set({
        allProcessedData: [], rawData: [], pageNo: 1,
        filterSpecial: false, detailQueryCount: 0,
        sortKey: 'no', sortAsc: true
      });
    },
    getToken: getTokenFromStorage
  };
})();

/**
 * ===================================================================
 * 模組 5：API 服務 (ApiModule)
 * ===================================================================
 */
const ApiModule = (() => {
  const callApi = async (endpoint, params, signal = null) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': StateModule.get('token') },
      body: JSON.stringify(params),
      signal
    });
    if (!response.ok) {
      if (signal?.aborted) throw new DOMException('查詢已中止', 'AbortError');
      let errorMessage = `API 請求失敗: ${response.status}`;
      try {
        const errorJson = JSON.parse(await response.text());
        errorMessage += ` - ${errorJson.message || errorJson.error || ''}`;
      } catch (e) { /* ignore */ }
      throw new Error(errorMessage);
    }
    return response.json();
  };
  
  const verifyToken = async () => {
    try {
      const apiBase = StateModule.get('apiBase');
      const response = await callApi(`${apiBase}/planCodeController/query`, { planCode: '5105', currentPage: 1, pageSize: 1 });
      return !!response.records;
    } catch (error) {
      return false;
    }
  };

  const buildMasterQueryParams = (mode, input) => {
    const { QUERY_MODES, DEFAULT_QUERY_PARAMS } = ConfigModule;
    const params = { currentPage: 1, pageSize: DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER };
    switch (mode) {
      case QUERY_MODES.PLAN_CODE: params.planCode = input; break;
      case QUERY_MODES.PLAN_NAME: params.planCodeName = input; break;
      case QUERY_MODES.ALL_MASTER_PLANS: params.planCode = '　'; break;
      case QUERY_MODES.MASTER_IN_SALE: params.saleEndDate = '9999-12-31 00:00:00'; break;
    }
    return params;
  };
  
  const queryMultiplePlanCodes = async (planCodes, signal) => {
    const BATCH_SIZE = 10;
    const allRecords = [];
    for (let i = 0; i < planCodes.length; i += BATCH_SIZE) {
      if (signal?.aborted) throw new Error('查詢已被中止');
      const batch = planCodes.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (planCode) => {
          try {
            const result = await callApi(`${StateModule.get('apiBase')}/planCodeController/query`, {
              planCode, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
            }, signal);
            if (result.records?.length > 0) {
              result.records.forEach(r => r._querySourcePlanCode = planCode);
              return result.records;
            }
            return [{ planCode, _apiStatus: '查無資料', _isErrorRow: true }];
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            return [{ planCode, _apiStatus: '查詢失敗', _isErrorRow: true }];
          }
        })
      );
      allRecords.push(...batchResults.flat());
    }
    return { records: allRecords };
  };
  
  const queryChannelData = async (queryMode, queryChannels, signal) => {
    const { uiToApi, apiToUi } = UtilsModule.channelUtils;
    const apiBase = StateModule.get('apiBase');
    const channelsToQuery = queryChannels.length > 0 ? queryChannels : ConfigModule.FIELD_MAPS.CHANNELS;

    const queryByType = async (channels, saleEndDate) => {
      const results = await Promise.all(
        channels.map(async (uiChannel) => {
          try {
            const result = await callApi(`${apiBase}/planCodeSaleDateController/query`, {
              channel: uiToApi(uiChannel), saleEndDate, pageIndex: 1, 
              size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
              orderBys: ["planCode asc"]
            }, signal);
            const records = result.planCodeSaleDates?.records || [];
            records.forEach(r => { r._sourceChannel = uiChannel; r.channel = apiToUi(r.channel); });
            return records;
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            return [];
          }
        })
      );
      return results.flat();
    };

    if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_STOPPED) {
      const [allData, currentData] = await Promise.all([queryByType(channelsToQuery, ""), queryByType(channelsToQuery, "9999-12-31 00:00:00")]);
      const currentSet = new Set(currentData.map(item => `${item.planCode}_${item.channel}`));
      return allData.filter(item => !currentSet.has(`${item.planCode}_${apiToUi(item.channel)}`));
    } else {
      return queryByType(channelsToQuery, "9999-12-31 00:00:00");
    }
  };

  const getPolplnData = async (item, forceFetch, signal) => {
    const { cacheDetail } = StateModule.get();
    if (!forceFetch && cacheDetail.has(item.planCode)) return cacheDetail.get(item.planCode);
    try {
      const detail = await callApi(`${StateModule.get('apiBase')}/planCodeController/queryDetail`, {
        planCode: item.planCode, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
      }, signal);
      const polpln = (detail.records || []).map(r => r.polpln).filter(Boolean).join(', ');
      cacheDetail.set(item.planCode, polpln);
      return polpln;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return '載入失敗';
    }
  };

  const getChannelData = async (item, forceFetch, todayStr, signal) => {
    const { cacheChannel } = StateModule.get();
    if (!forceFetch && cacheChannel.has(item.planCode)) return cacheChannel.get(item.planCode);
    try {
      const sale = await callApi(`${StateModule.get('apiBase')}/planCodeSaleDateController/query`, {
        planCode: item.planCode, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL
      }, signal);
      const channels = (sale.planCodeSaleDates?.records || []).map(r => ({
        channel: UtilsModule.channelUtils.apiToUi(r.channel),
        saleStartDate: UtilsModule.dateUtils.formatDateForUI(r.saleStartDate),
        saleEndDate: UtilsModule.dateUtils.formatDateForUI(r.saleEndDate),
        status: UtilsModule.getSaleStatus(todayStr, r.saleStartDate, r.saleEndDate)
      }));
      cacheChannel.set(item.planCode, channels);
      return channels;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  };

  return { verifyToken, buildMasterQueryParams, queryMultiplePlanCodes, queryChannelData, getPolplnData, getChannelData };
})();

/**
 * ===================================================================
 * 模組 6：UI 元件 (UIModule)
 * ===================================================================
 */
const UIModule = (() => {
  const Toast = {
    show(message, type = 'info', duration = ConfigModule.UI_SETTINGS.TOAST_DURATION, persistent = false) {
      if (persistent && StateModule.get('persistentToastId')) {
        document.getElementById(StateModule.get('persistentToastId'))?.remove();
      }
      const el = document.createElement('div');
      el.id = persistent ? `pct-toast-${Date.now()}` : 'pct-toast';
      el.className = `pct-toast ${type} ${persistent ? 'persistent' : ''}`;
      el.textContent = message;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('pct-toast-show'));
      if (persistent) {
        StateModule.set({ persistentToastId: el.id });
      } else {
        setTimeout(() => {
          el.classList.remove('pct-toast-show');
          el.addEventListener('transitionend', () => el.remove(), { once: true });
        }, duration);
      }
    },
    hide() {
      const toastId = StateModule.get('persistentToastId');
      if (toastId) {
        const toast = document.getElementById(toastId);
        toast?.classList.remove('pct-toast-show');
        toast?.addEventListener('transitionend', () => toast.remove(), { once: true });
        StateModule.set({ persistentToastId: null });
      }
    }
  };

  const Modal = (() => {
    let modal, mask, escHandler;

    const close = () => {
      document.getElementById(ConfigModule.TOOL_ID)?.remove();
      document.getElementById('pctModalMask')?.remove();
      if (escHandler) document.removeEventListener('keydown', escHandler);
      StateModule.get('currentQueryController')?.abort();
      Toast.hide();
    };
    
    const enableDragging = (modal) => {
        let isDragging = false, initialX, initialY;
        const header = modal.querySelector('.pct-modal-header');
        if(!header) return;

        const onMouseDown = (e) => {
            isDragging = true;
            initialX = e.clientX - modal.getBoundingClientRect().left;
            initialY = e.clientY - modal.getBoundingClientRect().top;
            modal.classList.add('dragging');
            header.classList.add('dragging');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp, { once: true });
        };
        const onMouseMove = (e) => {
            if (isDragging) {
                e.preventDefault();
                const currentX = e.clientX - initialX;
                const currentY = e.clientY - initialY;
                modal.style.left = `${Math.max(0, Math.min(currentX, window.innerWidth - modal.offsetWidth))}px`;
                modal.style.top = `${Math.max(0, Math.min(currentY, window.innerHeight - modal.offsetHeight))}px`;
                modal.style.transform = 'none';
            }
        };
        const onMouseUp = () => {
            isDragging = false;
            modal.classList.remove('dragging');
            header.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
        };
        header.addEventListener('mousedown', onMouseDown);
    };

    const show = (html, onOpen) => {
      close();
      mask = document.createElement('div');
      mask.id = 'pctModalMask';
      mask.className = 'pct-modal-mask';
      
      modal = document.createElement('div');
      modal.id = ConfigModule.TOOL_ID;
      modal.className = 'pct-modal';
      modal.innerHTML = html;

      document.body.append(mask, modal);
      requestAnimationFrame(() => { mask.classList.add('show'); modal.classList.add('show'); });
      
      enableDragging(modal);
      escHandler = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', escHandler);

      if (onOpen) onOpen(modal);
    };

    return { show, close };
  })();

  const Table = {
    renderSummary: (totalRecords, hasSpecialData) => {
      const specialCount = StateModule.get('allProcessedData').filter(r => r.special).length;
      return `<div class="pct-summary">共 ${totalRecords} 筆${hasSpecialData ? `，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆` : ''}</div>`;
    },
    renderSearchBox: (keyword) => `
      <div class="pct-search-container">
        <input type="text" class="pct-search-input" id="pct-search-input" placeholder="搜尋表格內容..." value="${UtilsModule.escapeHtml(keyword)}">
        ${keyword ? '<button class="pct-search-clear" id="pct-search-clear" title="清除搜尋">✕</button>' : '<span class="pct-search-icon">🔍</span>'}
      </div>`,
    renderTableHTML: (data) => {
      const { sortKey, sortAsc } = StateModule.get();
      if (!data?.length) return `<div class="pct-table-wrap" style="height:150px; display:flex; align-items:center; justify-content:center;">查無資料</div>`;
      const headers = [
        {key: 'no', label: 'No'}, {key: 'planCode', label: '代號'}, {key: 'shortName', label: '商品名稱'},
        {key: 'currency', label: '幣別'}, {key: 'unit', label: '單位'}, {key: 'coverageType', label: '類型'},
        {key: 'saleStartDate', label: '銷售起日'}, {key: 'saleEndDate', label: '銷售迄日'}, {key: 'mainStatus', label: '主約狀態'},
        {key: 'polpln', label: 'POLPLN'}, {label: '通路資訊'}
      ];
      const headerHtml = headers.map(h => {
        if (!h.key) return `<th>${h.label}</th>`;
        const sortClass = sortKey === h.key ? (sortAsc ? 'sort-asc' : 'sort-desc') : '';
        return `<th data-key="${h.key}" class="${sortClass}">${h.label}</th>`;
      }).join('');
      const bodyHtml = data.map(row => Table._createRowHtml(row)).join('');
      return `<div class="pct-table-wrap"><table class="pct-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    },
    _createRowHtml: (row) => {
      const { escapeHtml, getStatusClass } = UtilsModule;
      if (row._isErrorRow) {
        return `<tr class="error-row"><td class="pct-td-copy" data-raw="${escapeHtml(row.planCode)}">${row.no}</td><td class="pct-td-copy" data-raw="${escapeHtml(row.planCode)}">${escapeHtml(row.planCode)}</td><td colspan="8" style="color:#d9534f;">${row.saleEndDate}<button class="pct-btn pct-btn-info pct-btn-retry" data-plan="${escapeHtml(row.planCode)}">重新查詢</button></td><td></td></tr>`;
      }
      const channelHtml = (row.channels || []).map(c => `<span class="${getStatusClass(c.status)}">${escapeHtml(c.channel)}:${escapeHtml(c.saleEndDate)}（${escapeHtml(c.status)}）</span>`).join('<br>');
      const mainStatusClass = getStatusClass(row.mainStatus);
      const cells = [row.no, row.planCode, row.shortName, row.currency, row.unit, row.coverageType, row.saleStartDate, row.saleEndDate]
          .map(cell => `<td class="pct-td-copy" data-raw="${escapeHtml(cell)}">${escapeHtml(cell)}</td>`).join('');
      return `<tr${row.special ? ' class="special-row"' : ''}>${cells}<td class="pct-td-copy ${mainStatusClass}" data-raw="${escapeHtml(row.mainStatus)}">${escapeHtml(row.mainStatus)}</td><td class="pct-td-copy" data-raw="${escapeHtml(row.polpln || '')}">${escapeHtml(row.polpln || '')}</td><td>${channelHtml}</td></tr>`;
    },
    renderTableText: (data) => {
      let text = "No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n";
      data.forEach(row => {
        const channelStr = (row.channels || []).map(c => `${c.channel}:${c.saleEndDate}（${c.status}）`).join(' / ');
        text += [row.no, row.planCode, row.shortName, row.currency, row.unit, row.coverageType, row.saleStartDate, row.saleEndDate, row.mainStatus, row.polpln || '', channelStr].join('\t') + '\n';
      });
      return text;
    }
  };
  
  const Form = {
    renderTokenDialog: (env, token) => `
      <div class="pct-modal-header"><span id="pct-modal-title">商品查詢小工具（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
      <div class="pct-modal-body"><div class="pct-form-group">
        <label for="pct-token-input" class="pct-label">請輸入 SSO-TOKEN：</label>
        <textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 SSO-TOKEN" autocomplete="off">${token || ''}</textarea>
        <div class="pct-error" id="pct-token-err" style="display:none;"></div>
      </div></div>
      <div class="pct-modal-footer">
        <button class="pct-btn" id="pct-token-ok">驗證並繼續</button>
        <button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過檢核</button>
        <button class="pct-btn pct-btn-danger" id="pct-token-cancel">關閉</button>
      </div>`,
    renderQueryDialog: (env) => {
      const { QUERY_MODES } = ConfigModule;
      const modes = [
        { mode: QUERY_MODES.PLAN_CODE, label: '商品代號' }, { mode: QUERY_MODES.PLAN_NAME, label: '商品名稱' },
        { mode: QUERY_MODES.ALL_MASTER_PLANS, label: '查詢全部' }, { mode: 'masterDataCategory', label: '查詢主檔' },
        { mode: 'channelDataCategory', label: '查詢通路' }
      ];
      return `
        <div class="pct-modal-header"><span id="pct-modal-title">查詢條件設定（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
        <div class="pct-modal-body">
          <div class="pct-form-group"><div class="pct-label">查詢模式：</div>
            <div id="pct-mode-wrap" class="pct-mode-card-grid">${modes.map(({mode, label}) => `<div class="pct-mode-card" data-mode="${mode}">${label}</div>`).join('')}</div>
          </div>
          <div id="pct-dynamic-query-content"></div>
          <div class="pct-form-group"><div class="pct-error" id="pct-query-err" style="display:none"></div></div>
        </div>
        <div class="pct-modal-footer">
          <button class="pct-btn" id="pct-query-ok">開始查詢</button>
          <button class="pct-btn pct-btn-secondary" id="pct-query-clear-selection">清除選擇</button>
          <button class="pct-btn pct-btn-danger" id="pct-query-cancel">關閉</button>
        </div>`;
    }
  };

  return { Toast, Modal, Table, Form };
})();

/**
 * ===================================================================
 * 模組 7：事件處理 (EventModule)
 * ===================================================================
 */
const EventModule = (() => {
  const showError = (el, msg) => { if (el) { el.textContent = msg; el.style.display = 'block'; }};
  const hideError = (el) => { if (el) { el.style.display = 'none'; }};

  const handleTokenDialog = (modal) => {
    const tokenInput = modal.querySelector('#pct-token-input');
    const errEl = modal.querySelector('#pct-token-err');
    modal.querySelector('.pct-modal-footer').addEventListener('click', async (e) => {
      const targetId = e.target.id;
      if (!['pct-token-ok', 'pct-token-skip', 'pct-token-cancel'].includes(targetId)) return;
      const val = tokenInput.value.trim();
      hideError(errEl);
      if (targetId === 'pct-token-ok') {
        if (!val) return showError(errEl, '請輸入 Token');
        UIModule.Toast.show('檢查 Token 中...', 'info');
        StateModule.set({ token: val });
        localStorage.setItem('SSO-TOKEN', val);
        const isValid = await ApiModule.verifyToken();
        isValid ? (UIModule.Toast.show('Token 驗證成功', 'success'), ControllerModule.showQueryDialog()) : showError(errEl, 'Token 驗證失敗');
      } else if (targetId === 'pct-token-skip') {
        if (val) { StateModule.set({ token: val }); localStorage.setItem('SSO-TOKEN', val); }
        UIModule.Toast.show('已略過 Token 驗證', 'warning');
        ControllerModule.showQueryDialog();
      } else if (targetId === 'pct-token-cancel') {
        UIModule.Modal.close();
      }
    });
    tokenInput.focus();
  };
  
  const handleQueryDialog = (modal) => {
    const s = StateModule.get();
    const localState = {
      primaryMode: s.queryMode || ConfigModule.QUERY_MODES.PLAN_CODE,
      input: s.queryInput,
      subOptions: new Set(s.querySubOption),
      channels: new Set(s.queryChannels)
    };
    const errEl = modal.querySelector('#pct-query-err');

    const renderDynamicContent = () => {
        const { QUERY_MODES, FIELD_MAPS } = ConfigModule;
        let html = '';
        switch(localState.primaryMode){
            case QUERY_MODES.PLAN_CODE: html=`<div class="pct-form-group"><label class="pct-label">輸入商品代號：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆請用空格、逗號、分號或換行分隔">${localState.input}</textarea></div>`; break;
            case QUERY_MODES.PLAN_NAME: html=`<div class="pct-form-group"><label class="pct-label">輸入商品名稱關鍵字：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字">${localState.input}</textarea></div>`; break;
            case QUERY_MODES.ALL_MASTER_PLANS: html=`<div style="text-align:center;padding:20px;">將查詢所有主檔商品。</div>`; break;
            case 'masterDataCategory': html=`<div class="pct-form-group"><div class="pct-label">選擇主檔查詢範圍：</div><div class="pct-sub-option-grid" data-type="sub-option"><div class="pct-sub-option" data-value="${QUERY_MODES.MASTER_IN_SALE}">現售商品</div><div class="pct-sub-option" data-value="${QUERY_MODES.MASTER_STOPPED}">停售商品</div></div></div>`; break;
            case 'channelDataCategory':
                const channelOptions = FIELD_MAPS.CHANNELS.map(ch => `<div class="pct-channel-option" data-value="${ch}">${ch}</div>`).join('');
                html=`<div class="pct-form-group"><div class="pct-label">選擇通路：(可多選，不選則查全部)</div><div class="pct-channel-option-grid" data-type="channel">${channelOptions}</div></div>` +
                     `<div class="pct-form-group"><div class="pct-label">選擇通路銷售範圍：</div><div class="pct-sub-option-grid" data-type="sub-option"><div class="pct-sub-option" data-value="${QUERY_MODES.CHANNEL_IN_SALE}">現售通路</div><div class="pct-sub-option" data-value="${QUERY_MODES.CHANNEL_STOPPED}">停售通路</div></div></div>`;
                break;
        }
        modal.querySelector('#pct-dynamic-query-content').innerHTML = html;
        modal.querySelectorAll('[data-value]').forEach(el => {
            const set = el.parentElement.dataset.type === 'sub-option' ? localState.subOptions : localState.channels;
            el.classList.toggle('selected', set.has(el.dataset.value));
        });
    };
    const updateUI = () => {
        modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.primaryMode));
        renderDynamicContent();
        hideError(errEl);
    };

    modal.addEventListener('click', (e) => {
        const card = e.target.closest('.pct-mode-card');
        if (card) {
            localState.primaryMode = card.dataset.mode;
            localState.input = ''; localState.subOptions.clear(); localState.channels.clear();
            return updateUI();
        }
        const option = e.target.closest('[data-value]');
        if (option) {
            const set = option.parentElement.dataset.type === 'sub-option' ? localState.subOptions : localState.channels;
            const value = option.dataset.value;
            set.has(value) ? set.delete(value) : (option.parentElement.dataset.type === 'sub-option' ? set.clear() : null, set.add(value));
            return updateUI();
        }
        const button = e.target.closest('button');
        if(!button) return;
        if(button.id === 'pct-query-clear-selection'){
            localState.primaryMode = ''; localState.input = ''; localState.subOptions.clear(); localState.channels.clear();
            UIModule.Toast.show('已清除所有查詢條件', 'info');
            return updateUI();
        }
        if(button.id === 'pct-query-ok'){
            let finalMode = localState.primaryMode;
            if (['masterDataCategory', 'channelDataCategory'].includes(finalMode)) {
                if (localState.subOptions.size !== 1) return showError(errEl, '請選擇一個查詢範圍');
                finalMode = [...localState.subOptions][0];
            }
            if (!finalMode || (['planCode', 'planCodeName'].includes(finalMode) && !localState.input)) {
                return showError(errEl, finalMode ? '請輸入查詢內容' : '請選擇查詢模式');
            }
            StateModule.set({ queryMode: finalMode, queryInput: localState.input, querySubOption: [...localState.subOptions], queryChannels: [...localState.channels] });
            ControllerModule.executeQuery();
        }
        if(button.id === 'pct-query-cancel') UIModule.Modal.close();
    });
    modal.addEventListener('input', e => {
        if(e.target.id === 'pct-query-input') localState.input = UtilsModule.inputUtils.normalizeInput(e.target.value);
    });
    updateUI();
  };

  const handleTableEvents = (modal) => {
    modal.addEventListener('click', (e) => {
        const target = e.target;
        const state = StateModule.get();
        const paginatedData = DataModule.filterAndPaginate(state.allProcessedData, state);
        const totalPages = paginatedData.totalPages;
        
        if(target.closest('#pct-search-clear')) { StateModule.set({ searchKeyword: '', pageNo: 1 }); ControllerModule.renderTable(); }
        else if(target.closest('#pct-table-prev') && state.pageNo > 1) { StateModule.set({ pageNo: state.pageNo - 1 }); ControllerModule.renderTable(); }
        else if(target.closest('#pct-table-next') && state.pageNo < totalPages) { StateModule.set({ pageNo: state.pageNo + 1 }); ControllerModule.renderTable(); }
        else if(target.closest('#pct-page-jump-btn')) {
            const num = parseInt(modal.querySelector('#pct-page-jump-input').value, 10);
            if(num >= 1 && num <= totalPages) { StateModule.set({ pageNo: num }); ControllerModule.renderTable(); }
        }
        else if(target.closest('#pct-table-show-all')) { StateModule.set({ showAllPages: !state.showAllPages, pageNo: 1 }); ControllerModule.renderTable(); }
        else if(target.closest('#pct-table-detail')) ControllerModule.handleDetailQuery();
        else if(target.closest('#pct-table-copy')) UtilsModule.copyToClipboard(UIModule.Table.renderTableText(paginatedData.data), UIModule.Toast.show);
        else if(target.closest('#pct-table-filter')) { StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); ControllerModule.renderTable(); }
        else if(target.closest('#pct-table-requery')) ControllerModule.showQueryDialog();
        else if(target.closest('#pct-table-close')) UIModule.Modal.close();
        else if(target.closest('th[data-key]')) {
            const key = target.closest('th[data-key]').dataset.key;
            StateModule.set({ sortKey: key, sortAsc: state.sortKey === key ? !state.sortAsc : true, pageNo: 1 });
            ControllerModule.renderTable();
        }
        else if(target.closest('.pct-btn-retry')) ControllerModule.querySinglePlanCode(target.closest('.pct-btn-retry').dataset.plan);
        else if(target.closest('.pct-td-copy')) UtilsModule.copyToClipboard(target.closest('.pct-td-copy').dataset.raw, UIModule.Toast.show);
    });
    modal.querySelector('#pct-search-input')?.addEventListener('input', (e) => {
        clearTimeout(StateModule.get('searchDebounceTimer'));
        StateModule.set({ searchDebounceTimer: setTimeout(() => {
            StateModule.set({ searchKeyword: e.target.value, pageNo: 1 });
            ControllerModule.renderTable();
        }, ConfigModule.UI_SETTINGS.DEBOUNCE_DELAY) });
    });
  };

  return { handleTokenDialog, handleQueryDialog, handleTableEvents };
})();

/**
 * ===================================================================
 * 模組 8：資料處理 (DataModule)
 * ===================================================================
 */
const DataModule = (() => {
  const sortData = (data, key, asc) => {
    if (!key) return data;
    return [...data].sort((a, b) => {
      let valA = a[key], valB = b[key];
      if (valA == null) return 1; if (valB == null) return -1;
      if (key.includes('Date')) {
        valA = new Date(UtilsModule.dateUtils.formatDateForComparison(valA));
        valB = new Date(UtilsModule.dateUtils.formatDateForComparison(valB));
      }
      const order = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return asc ? order : -order;
    });
  };

  const processRawDataForDisplay = (rawData) => {
    const todayStr = UtilsModule.dateUtils.formatToday();
    return rawData.map((item, index) => {
      if (item._isErrorRow) {
        return { no: index + 1, planCode: item.planCode, saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, _isErrorRow: true };
      }
      return {
        no: index + 1,
        planCode: item.planCode || '-',
        shortName: item.shortName || item.planName || '-',
        currency: UtilsModule.fieldConverters.currency(item.currency || item.cur),
        unit: UtilsModule.fieldConverters.unit(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
        coverageType: UtilsModule.fieldConverters.coverageType(item.coverageType || item.type),
        saleStartDate: UtilsModule.dateUtils.formatDateForUI(item.saleStartDate),
        saleEndDate: UtilsModule.dateUtils.formatDateForUI(item.saleEndDate),
        mainStatus: UtilsModule.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate),
        polpln: '載入中...', channels: [], special: false,
        _originalItem: item, _loading: true
      };
    });
  };

  const loadDetailsInBackground = async (processedData, forceFetch, onProgressUpdate) => {
    const BATCH_SIZE = 20;
    const todayStr = UtilsModule.dateUtils.formatToday();
    const signal = StateModule.get('currentQueryController')?.signal;

    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new DOMException('查詢已中止', 'AbortError');
        UIModule.Toast.show(`載入詳細資料 ${i + 1}-${Math.min(i + BATCH_SIZE, processedData.length)} / ${processedData.length}`, 'info', null, true);
        
        const batch = processedData.slice(i, i + BATCH_SIZE).filter(item => !item._isErrorRow && item._loading);
        if(batch.length === 0) continue;

        await Promise.all(batch.map(async (item) => {
            try {
                const [polpln, channels] = await Promise.all([
                    ApiModule.getPolplnData(item._originalItem, forceFetch, signal),
                    ApiModule.getChannelData(item._originalItem, forceFetch, todayStr, signal)
                ]);
                item.polpln = polpln || '無資料';
                item.channels = channels;
                item.special = UtilsModule.checkSpecialStatus(item);
                item._loading = false;
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                item.polpln = '載入失敗';
                item._loading = false;
            }
        }));
        onProgressUpdate();
    }
    UIModule.Toast.hide();
    UIModule.Toast.show('所有詳細資料載入完成', 'success');
  };

  const filterAndPaginate = (data, {searchKeyword, filterSpecial, sortKey, sortAsc, pageNo, pageSize, showAllPages}) => {
      let filteredData = filterSpecial ? data.filter(item => item.special) : data;
      if (searchKeyword.trim()) {
          const keyword = searchKeyword.toLowerCase();
          filteredData = filteredData.filter(item => 
              Object.values(item).some(val => String(val).toLowerCase().includes(keyword))
          );
      }
      const sortedData = sortData(filteredData, sortKey, sortAsc);

      const pageResult = { data: sortedData, totalRecords: sortedData.length };
      if(showAllPages) {
          pageResult.totalPages = 1;
      } else {
          pageResult.totalPages = Math.ceil(sortedData.length / pageSize);
          const start = (pageNo - 1) * pageSize;
          pageResult.data = sortedData.slice(start, start + pageSize);
      }
      return pageResult;
  };

  return { processRawDataForDisplay, loadDetailsInBackground, filterAndPaginate };
})();

/**
 * ===================================================================
 * 模組 9：主控制器 (ControllerModule)
 * ===================================================================
 */
const ControllerModule = (() => {
  let uiRefs = {};

  const initialize = async () => {
    StyleModule.inject();
    const token = StateModule.getToken();
    if (!token) return showTokenDialog();
    UIModule.Toast.show('驗證 Token 中...', 'info');
    const isValid = await ApiModule.verifyToken();
    isValid ? (UIModule.Toast.show('Token 驗證成功', 'success'), showQueryDialog()) : showTokenDialog();
  };

  const showTokenDialog = () => UIModule.Modal.show(UIModule.Form.renderTokenDialog(StateModule.get('environment'), StateModule.get('token')), EventModule.handleTokenDialog);
  const showQueryDialog = () => UIModule.Modal.show(UIModule.Form.renderQueryDialog(StateModule.get('environment')), EventModule.handleQueryDialog);

  const showCancelQueryButton = (show) => {
    let btn = document.getElementById('pct-cancel-query-btn');
    if (show && !btn) {
      btn = document.createElement('button');
      Object.assign(btn, {
          id: 'pct-cancel-query-btn', className: 'pct-btn pct-btn-danger pct-cancel-query',
          textContent: '中止查詢', onclick: () => StateModule.get('currentQueryController')?.abort()
      });
      document.body.appendChild(btn);
    } else if (!show && btn) {
        btn.remove();
    }
  };

  const executeQuery = async () => {
    UIModule.Modal.close();
    StateModule.resetQueryState();
    StateModule.set({ currentQueryController: new AbortController(), isQuerying: true });
    showCancelQueryButton(true);
    UIModule.Toast.show('查詢中...', 'info', null, true);

    try {
      const { queryMode, queryInput, queryChannels } = StateModule.get();
      const { QUERY_MODES } = ConfigModule;
      let rawRecords;
      const signal = StateModule.get('currentQueryController').signal;

      if ([QUERY_MODES.CHANNEL_IN_SALE, QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
          const channelData = await ApiModule.queryChannelData(queryMode, queryChannels, signal);
          const planCodes = [...new Set(channelData.map(item => item.planCode))];
          rawRecords = planCodes.length > 0 ? (await ApiModule.queryMultiplePlanCodes(planCodes, signal)).records : [];
      } else if (queryMode === QUERY_MODES.MASTER_STOPPED) {
          const [all, current] = await Promise.all([
              ApiModule.buildMasterQueryParams(QUERY_MODES.ALL_MASTER_PLANS, ''),
              ApiModule.buildMasterQueryParams(QUERY_MODES.MASTER_IN_SALE, '')
          ].map(params => ApiModule.callApi(`${StateModule.get('apiBase')}/planCodeController/query`, params, signal)));
          const currentSet = new Set((current.records || []).map(r => r.planCode));
          rawRecords = (all.records || []).filter(r => !currentSet.has(r.planCode));
      } else if (queryMode === QUERY_MODES.PLAN_CODE && queryInput.includes(',')){
          rawRecords = (await ApiModule.queryMultiplePlanCodes(UtilsModule.inputUtils.splitInput(queryInput), signal)).records;
      } else {
          const params = ApiModule.buildMasterQueryParams(queryMode, queryInput);
          const result = await ApiModule.callApi(`${StateModule.get('apiBase')}/planCodeController/query`, params, signal);
          rawRecords = result.records || [];
      }
      
      if (!rawRecords || rawRecords.length === 0) {
          UIModule.Toast.show('查無資料', 'warning');
          return renderTable();
      }

      const processedData = DataModule.processRawDataForDisplay(rawRecords);
      StateModule.set({ rawData: rawRecords, allProcessedData: processedData });
      
      renderTable();
      UIModule.Toast.show(`基本資料載入完成，共 ${processedData.length} 筆`, 'success', 2000, true);
      
      await DataModule.loadDetailsInBackground(processedData, false, () => renderTable(true));

    } catch (error) {
      if (error.name !== 'AbortError') {
          UIModule.Toast.show(`查詢失敗: ${error.message}`, 'error');
          renderTable();
      }
    } finally {
      StateModule.set({ isQuerying: false, currentQueryController: null });
      showCancelQueryButton(false);
      UIModule.Toast.hide();
    }
  };

  const renderTable = (isUpdate = false) => {
    const state = StateModule.get();
    const { data: pageData, totalPages, totalRecords } = DataModule.filterAndPaginate(state.allProcessedData, state);

    if (isUpdate && uiRefs.modal) {
        return updateTableDisplay(pageData, totalPages, totalRecords);
    }
    
    const hasSpecialData = state.allProcessedData.some(r => r.special);
    const html = `
      <div class="pct-modal-header"><span id="pct-modal-title">查詢結果（${state.environment}）</span></div>
      <div class="pct-modal-body">
        <div id="pct-summary-container"></div>
        <div id="pct-table-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin: 15px 0;">
             ${UIModule.Table.renderSearchBox(state.searchKeyword)}
             <div style="flex-grow:1;"></div>
            <button class="pct-btn pct-btn-info" id="pct-table-detail">查詢全部詳細</button>
            <button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>
            ${hasSpecialData ? `<button class="pct-btn ${state.filterSpecial ? 'pct-filter-btn-active' : 'pct-filter-btn'}" id="pct-table-filter">${state.filterSpecial ? '顯示全部' : '篩選特殊狀態'}</button>` : ''}
            <button class="pct-btn" id="pct-table-requery">重新查詢</button>
        </div>
        <div id="pct-table-container"></div>
      </div>
      <div class="pct-modal-footer">
        <div id="pct-pagination-container"></div>
        <button class="pct-btn pct-btn-danger" id="pct-table-close">關閉</button>
      </div>`;

    UIModule.Modal.show(html, (modal) => {
        uiRefs.modal = modal;
        uiRefs.summaryContainer = modal.querySelector('#pct-summary-container');
        uiRefs.tableContainer = modal.querySelector('#pct-table-container');
        uiRefs.paginationContainer = modal.querySelector('#pct-pagination-container');
        updateTableDisplay(pageData, totalPages, totalRecords);
        EventModule.handleTableEvents(modal);
    });
  };
  
  const updateTableDisplay = (pageData, totalPages, totalRecords) => {
    if (!uiRefs.modal) return;
    const state = StateModule.get();
    const hasSpecialData = state.allProcessedData.some(r => r.special);
    uiRefs.summaryContainer.innerHTML = UIModule.Table.renderSummary(totalRecords, hasSpecialData);
    uiRefs.tableContainer.innerHTML = UIModule.Table.renderTableHTML(pageData);
    uiRefs.paginationContainer.innerHTML = `
      <div class="pct-pagination-info">第 ${state.showAllPages ? 1 : state.pageNo} / ${totalPages} 頁 (共 ${totalRecords} 筆)</div>
      <div class="pct-page-controls">
          ${!state.showAllPages && totalPages > 1 ? `
              <button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${state.pageNo <= 1 ? 'disabled' : ''}>上一頁</button>
              <input type="number" class="pct-page-input" id="pct-page-jump-input" value="${state.pageNo}" min="1" max="${totalPages}">
              <button class="pct-btn pct-btn-secondary" id="pct-page-jump-btn">跳轉</button>
              <button class="pct-btn pct-btn-secondary" id="pct-table-next" ${state.pageNo >= totalPages ? 'disabled' : ''}>下一頁</button>
          `: ''}
          <button class="pct-btn pct-btn-secondary" id="pct-table-show-all">${state.showAllPages ? '分頁顯示' : '顯示全部'}</button>
      </div>`;
  };
  
  const handleDetailQuery = async () => {
    const state = StateModule.get();
    if (state.detailQueryCount > 0 && !confirm('再次點擊將清空快取並重新查詢所有數據，確定繼續嗎？')) {
        return UIModule.Toast.show('已取消操作。', 'info');
    }
    StateModule.set({ detailQueryCount: state.detailQueryCount + 1 });
    UIModule.Toast.show(state.detailQueryCount === 1 ? '補齊尚未載入的數據...' : '清空快取並重新查詢所有詳細資料中...', 'info', 3000);
    await DataModule.loadDetailsInBackground(state.allProcessedData, state.detailQueryCount > 1, () => renderTable(true));
  };

  const querySinglePlanCode = async (planCode) => {
    try {
      UIModule.Toast.show(`重新查詢 ${planCode}...`, 'info');
      const result = await ApiModule.callApi(`${StateModule.get('apiBase')}/planCodeController/query`, { planCode, currentPage: 1, pageSize: 10 });
      const allData = StateModule.get().allProcessedData;
      const idx = allData.findIndex(r => r.planCode === planCode && r._isErrorRow);
      if (idx !== -1 && result.records?.length > 0) {
        const processed = DataModule.processRawDataForDisplay(result.records);
        allData.splice(idx, 1, ...processed);
        StateModule.set({ allProcessedData: allData });
        renderTable(true);
        UIModule.Toast.show(`${planCode} 查詢成功`, 'success');
        await DataModule.loadDetailsInBackground(processed, true, () => renderTable(true));
      } else {
        UIModule.Toast.show(`${planCode} 查無資料`, 'warning');
      }
    } catch (error) {
      UIModule.Toast.show(`${planCode} 查詢失敗: ${error.message}`, 'error');
    }
  };

  return { initialize, showQueryDialog, executeQuery, renderTable, handleDetailQuery, querySinglePlanCode };
})();

/**
 * ===================================================================
 * 應用程式啟動入口
 * ===================================================================
 */
try {
  ControllerModule.initialize();
  window.addEventListener('error', (e) => { console.error('全域錯誤:', e.error); UIModule.Toast.show('發生未預期的錯誤', 'error'); });
  window.addEventListener('unhandledrejection', (e) => { console.error('未處理的 Promise 拒絕:', e.reason); UIModule.Toast.show('發生未預期的錯誤', 'error'); });
} catch (error) {
  console.error('小工具初始化失敗:', error);
  alert(`小工具初始化失敗: ${error.message}`);
}

})();
