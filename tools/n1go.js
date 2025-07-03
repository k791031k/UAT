javascript:(function(){
'use strict';

/**
 * ===================================================================
 * 商品查詢小工具 v3.2.1 (重構優化版)
 *
 * 重構目標：
 * - 效能優化：顯著減少 DOM 操作，提升渲染與更新速度。
 * - 程式碼品質：去除冗餘邏輯，提升可讀性與可維護性。
 * - 維持不變：功能、UI、API 接口與所有命名均與原版保持一致。
 * ===================================================================
 */

// 清理舊工具實例，確保腳本可重複執行
(function cleanup(){
  const cleanupIds = ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask', 'pct-toast-container'];
  cleanupIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.remove();
  });
  document.querySelectorAll('.pct-modal-mask').forEach(el => el.remove());
})();

/**
 * ===================================================================
 * 模組 1：配置管理 (ConfigModule)
 * 職責：統一管理所有應用程式常數、設定值與配置參數。
 * 此模組為唯讀，確保配置在執行期間的穩定性。
 * ===================================================================
 */
const ConfigModule = Object.freeze({
  TOOL_ID: 'planCodeQueryToolInstance',
  STYLE_ID: 'planCodeToolStyle',
  VERSION: '3.2.1',

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
    CURRENCY: {'1':'TWD','2':'USD','3':'AUD','4':'CNT','5':'USD_OIU','6':'EUR','7':'JPY'},
    UNIT: {'A1':'元','A3':'仟元','A4':'萬元','B1':'計畫','C1':'單位'},
    COVERAGE_TYPE: {'M':'主約','R':'附約'},
    CHANNELS: ['AG','BR','BK','WS','EC']
  },

  DEFAULT_QUERY_PARAMS: {
    PAGE_SIZE_MASTER: 10000,
    PAGE_SIZE_CHANNEL: 5000,
    PAGE_SIZE_DETAIL: 50,
    PAGE_SIZE_TABLE: 50
  },

  UI_SETTINGS: {
    MODAL_WIDTH: '1200px',
    MAX_INPUT_LENGTH: 4,
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 2000
  }
});

/**
 * ===================================================================
 * 模組 2：工具函式 (UtilsModule)
 * 職責：提供通用的輔助函式，包含格式化、轉換、驗證等功能。
 * 這些函式不依賴任何特定狀態，具有高可重用性。
 * ===================================================================
 */
const UtilsModule = (() => {
  // HTML 安全處理，防止 XSS
  const escapeHtml = (text) => {
    if (typeof text !== 'string') return text;
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (match) => entityMap[match]);
  };

  // 日期處理相關函式
  const dateUtils = {
    formatToday: () => new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    formatDateForUI: (dateStr) => (dateStr ? String(dateStr).split(' ')[0].replace(/-/g, '') : ''),
    formatDateForComparison: (dateStr) => {
      if (!dateStr) return '';
      const cleanDate = String(dateStr).split(' ')[0];
      return /^\d{8}$/.test(cleanDate) ? cleanDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : cleanDate;
    }
  };

  // 根據起迄日判斷銷售狀態
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

  // 通路代碼在 UI 和 API 之間的轉換
  const channelUtils = {
    uiToApi: (code) => (code === 'BK' ? 'OT' : code),
    apiToUi: (code) => (code === 'OT' ? 'BK' : code)
  };

  // 欄位值轉換
  const fieldConverters = {
    currency: (val) => ConfigModule.FIELD_MAPS.CURRENCY[String(val)] || val || '',
    unit: (val) => ConfigModule.FIELD_MAPS.UNIT[String(val)] || val || '',
    coverageType: (val) => ConfigModule.FIELD_MAPS.COVERAGE_TYPE[String(val)] || val || ''
  };

  // 輸入處理函式
  const inputUtils = {
    normalizeInput: (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/[\uff01-\uff5e]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
                .replace(/\u3000/g, ' ')
                .toUpperCase();
    },
    splitInput: (input) => input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean)
  };

  // 複製到剪貼簿
  const copyToClipboard = async (text, showToastCallback) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastCallback('已複製查詢結果', 'success');
    } catch (err) {
      showToastCallback('複製失敗', 'error');
    }
  };

  // 檢查商品是否處於特殊狀態
  const checkSpecialStatus = (item) => {
    const todayStr = dateUtils.formatToday();
    const mainStatus = getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
    const channels = item.channels || [];
    if (mainStatus === ConfigModule.SALE_STATUS.ABNORMAL) return true;
    if (mainStatus === ConfigModule.SALE_STATUS.STOPPED && channels.some(c => c.status === ConfigModule.SALE_STATUS.CURRENT)) return true;
    if (mainStatus === ConfigModule.SALE_STATUS.CURRENT && channels.length > 0 && channels.every(c => [ConfigModule.SALE_STATUS.STOPPED, ConfigModule.SALE_STATUS.PENDING].includes(c.status))) return true;
    return false;
  };
  
  // 獲取狀態對應的 CSS class
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
 * 職責：管理所有 CSS 樣式的注入與移除。
 * 樣式內容保持與原版一致，確保 UI 不變。
 * ===================================================================
 */
const StyleModule = (() => {
  const cssContent = `
    :root {
      --primary-color: #4A90E2; --primary-dark-color: #357ABD; --secondary-color: #6C757D; --secondary-dark-color: #5A6268;
      --success-color: #5CB85C; --success-dark-color: #4CAE4C; --error-color: #D9534F; --error-dark-color: #C9302C; 
      --warning-color: #F0AD4E; --warning-dark-color: #EC971F; --info-color: #5BC0DE; --info-dark-color: #46B8DA;
      --background-light: #F8F8F8; --surface-color: #FFFFFF; --border-color: #E0E0E0; --text-color-dark: #1a1a1a;
      --text-color-light: #333333; --border-radius-base: 6px; --border-radius-lg: 10px; --transition-speed: 0.25s;
      --box-shadow-light: rgba(0, 0, 0, 0.08); --box-shadow-medium: rgba(0, 0, 0, 0.15); --box-shadow-strong: rgba(0, 0, 0, 0.3);
    }
    .pct-modal-mask { position:fixed; z-index:2147483646; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.18); opacity:0; transition:opacity var(--transition-speed) ease-out; }
    .pct-modal-mask.show { opacity:1; }
    .pct-modal { font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif; background:var(--surface-color); border-radius:var(--border-radius-lg); box-shadow:0 4px 24px var(--box-shadow-strong); padding:0; width:${ConfigModule.UI_SETTINGS.MODAL_WIDTH}; max-width:95vw; position:fixed; top:60px; left:50%; transform:translateX(-50%) translateY(-20px); opacity:0; z-index:2147483647; transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1); display:flex; flex-direction:column; }
    .pct-modal.show { opacity:1; transform:translateX(-50%) translateY(0); }
    .pct-modal.dragging { transition:none; }
    .pct-modal-header { padding:16px 20px 8px 20px; font-size:20px; font-weight:bold; border-bottom:1px solid var(--border-color); color:var(--text-color-dark); cursor:grab; }
    .pct-modal-header.dragging { cursor:grabbing; }
    .pct-modal-body { padding:16px 20px 8px 20px; flex-grow:1; overflow-y:auto; min-height:50px; }
    .pct-modal-footer { padding:12px 20px 16px 20px; text-align:right; border-top:1px solid var(--border-color); display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
    .pct-btn { display:inline-flex; align-items:center; justify-content:center; margin:0; padding:8px 18px; font-size:15px; border-radius:var(--border-radius-base); border:none; background:var(--primary-color); color:#fff; cursor:pointer; transition:background var(--transition-speed),transform var(--transition-speed),box-shadow var(--transition-speed); font-weight:600; box-shadow:0 2px 5px var(--box-shadow-light); white-space:nowrap; }
    .pct-btn:hover { background:var(--primary-dark-color); transform:translateY(-1px) scale(1.01); box-shadow:0 4px 8px var(--box-shadow-medium); }
    .pct-btn:active { transform:translateY(0); box-shadow:0 1px 3px var(--box-shadow-light); }
    .pct-btn:disabled { background:#CED4DA; color:#A0A0A0; cursor:not-allowed; transform:none; box-shadow:none; }
    .pct-btn-secondary { background:var(--secondary-color); color:#fff; } .pct-btn-secondary:hover { background:var(--secondary-dark-color); }
    .pct-btn-info { background:var(--info-color); } .pct-btn-info:hover { background:var(--info-dark-color); }
    .pct-btn-success { background:var(--success-color); } .pct-btn-success:hover { background:var(--success-dark-color); }
    .pct-btn-danger { background:var(--error-color); } .pct-btn-danger:hover { background:var(--error-dark-color); }
    .pct-btn-retry { background:var(--warning-color); color:var(--text-color-dark); border:1px solid var(--warning-dark-color); font-size:13px; margin-left:10px; }
    .pct-btn-retry:hover { background:var(--warning-dark-color); color:white; }
    .pct-filter-btn { font-size:14px; padding:5px 12px; background:var(--warning-color); color:var(--text-color-dark); border:1px solid var(--warning-dark-color); border-radius:5px; cursor:pointer; transition:background .2s,transform .2s; font-weight:600; box-shadow:0 1px 3px var(--box-shadow-light); white-space:nowrap; }
    .pct-filter-btn:hover { background:var(--warning-dark-color); transform:translateY(-1px); }
    .pct-filter-btn-active { background:var(--warning-dark-color); color:white; box-shadow:0 2px 6px rgba(240,173,78,0.4); }
    .pct-filter-btn-active:hover { background:var(--warning-color); }
    .pct-input { width:100%; font-size:16px; padding:9px 12px; border-radius:5px; border:1px solid var(--border-color); box-sizing:border-box; margin-top:5px; transition:border-color var(--transition-speed),box-shadow var(--transition-speed); }
    .pct-input:focus { border-color:var(--primary-color); box-shadow:0 0 0 2px rgba(74,144,226,0.2); outline:none; }
    .pct-input:disabled { background:var(--background-light); color:var(--text-color-light); opacity:0.7; cursor:not-allowed; }
    .pct-error { color:var(--error-color); font-size:13px; margin:8px 0 0 0; display:block; }
    .pct-label { font-weight:bold; color:var(--text-color-dark); display:block; margin-bottom:5px; }
    .pct-form-group { margin-bottom:20px; }
    .pct-mode-card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:20px; }
    .pct-mode-card { background:var(--background-light); border:1px solid var(--border-color); border-radius:var(--border-radius-base); padding:18px 10px; text-align:center; cursor:pointer; transition:all var(--transition-speed) ease-out; font-weight:500; font-size:15px; color:var(--text-color-dark); display:flex; align-items:center; justify-content:center; min-height:65px; box-shadow:0 2px 6px var(--box-shadow-light); }
    .pct-mode-card:hover { border-color:var(--primary-color); transform:translateY(-3px) scale(1.02); box-shadow:0 6px 15px rgba(74,144,226,0.2); }
    .pct-mode-card.selected { background:var(--primary-color); color:white; border-color:var(--primary-color); transform:translateY(-1px); box-shadow:0 4px 10px var(--primary-dark-color); font-weight:bold; }
    .pct-mode-card.selected:hover { background:var(--primary-dark-color); }
    .pct-sub-option-grid,.pct-channel-option-grid { display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; margin-bottom:15px; }
    .pct-sub-option,.pct-channel-option { background:var(--background-light); border:1px solid var(--border-color); border-radius:var(--border-radius-base); padding:8px 15px; cursor:pointer; transition:all var(--transition-speed) ease-out; font-weight:500; font-size:14px; color:var(--text-color-dark); white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; }
    .pct-sub-option:hover,.pct-channel-option:hover { border-color:var(--primary-color); transform:translateY(-1px); box-shadow:0 2px 6px var(--box-shadow-light); }
    .pct-sub-option.selected,.pct-channel-option.selected { background:var(--primary-color); color:white; border-color:var(--primary-color); transform:translateY(0); box-shadow:0 1px 3px var(--primary-dark-color); }
    .pct-sub-option.selected:hover,.pct-channel-option.selected:hover { background:var(--primary-dark-color); }
    .pct-table-wrap { max-height:55vh; overflow:auto; margin:15px 0; }
    .pct-table { border-collapse:collapse; width:100%; font-size:14px; background:var(--surface-color); min-width:800px; }
    .pct-table th,.pct-table td { border:1px solid #ddd; padding:8px 10px; text-align:left; vertical-align:top; cursor:pointer; }
    .pct-table th { background:#f8f8f8; color:var(--text-color-dark); font-weight:bold; cursor:pointer; position:sticky; top:0; z-index:1; white-space:nowrap; }
    .pct-table th:hover { background:#e9ecef; }
    .pct-table th[data-key] { position:relative; user-select:none; padding-right:25px; }
    .pct-table th[data-key]:after { content:'↕'; position:absolute; right:8px; top:50%; transform:translateY(-50%); opacity:0.3; font-size:12px; transition:opacity 0.2s; }
    .pct-table th[data-key]:hover:after { opacity:0.7; }
    .pct-table th[data-key].sort-asc:after { content:'↑'; opacity:1; color:var(--primary-color); font-weight:bold; }
    .pct-table th[data-key].sort-desc:after { content:'↓'; opacity:1; color:var(--primary-color); font-weight:bold; }
    .pct-table tr.special-row { background:#fffde7; border-left:4px solid var(--warning-color); }
    .pct-table tr:hover { background:#e3f2fd; }
    .pct-table tr.error-row { background:#ffebee; }
    .pct-table td small { display:block; font-size:11px; color:var(--text-color-light); margin-top:2px; }
    .pct-status-onsale { color:#1976d2; font-weight:bold; }
    .pct-status-offsale { color:#e53935; font-weight:bold; }
    .pct-status-pending { color:var(--info-color); font-weight:bold; }
    .pct-status-abnormal { color:#8A2BE2; font-weight:bold; }
    .pct-td-copy { cursor:pointer; transition:background .15s; }
    .pct-td-copy:hover { background:#f0f7ff; }
    .pct-search-container { margin-bottom:15px; position:relative; }
    .pct-search-input { width:100%; font-size:14px; padding:8px 35px 8px 12px; border-radius:5px; border:1px solid var(--border-color); box-sizing:border-box; transition:border-color var(--transition-speed),box-shadow var(--transition-speed); }
    .pct-search-input:focus { border-color:var(--primary-color); box-shadow:0 0 0 2px rgba(74,144,226,0.2); outline:none; }
    .pct-search-icon { position:absolute; right:10px; top:50%; transform:translateY(-50%); color:var(--text-color-light); pointer-events:none; }
    .pct-search-clear { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-color-light); cursor:pointer; font-size:16px; padding:2px; border-radius:3px; transition:background-color 0.2s; }
    .pct-search-clear:hover { background-color:var(--background-light); }
    .pct-toast { position:fixed; left:50%; top:30px; transform:translateX(-50%); background:var(--text-color-dark); color:#fff; padding:10px 22px; border-radius:var(--border-radius-base); font-size:16px; z-index:2147483647; opacity:0; pointer-events:none; transition:opacity .3s,transform .3s; box-shadow:0 4px 12px var(--box-shadow-medium); white-space:nowrap; }
    .pct-toast.pct-toast-show { opacity:1; transform:translateX(-50%) translateY(0); pointer-events:auto; }
    .pct-toast.success { background:var(--success-color); }
    .pct-toast.error { background:var(--error-color); }
    .pct-toast.warning { background:var(--warning-color); color:var(--text-color-dark); }
    .pct-toast.info { background:var(--info-color); }
    .pct-toast.persistent { /* 持續顯示的 Toast 樣式 */ }
    .pct-summary { font-size:15px; margin-bottom:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; color:var(--text-color-dark); }
    .pct-summary b { color:var(--warning-color); }
    .pct-pagination { display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:15px; flex-wrap:wrap; }
    .pct-pagination-info { margin-right:auto; font-size:14px; color:var(--text-color-light); }
    .pct-page-input { width:60px; text-align:center; padding:4px; border:1px solid var(--border-color); border-radius:3px; }
    .pct-page-controls { display:flex; align-items:center; gap:5px; }
    .pct-cancel-query { position:fixed; top:80px; right:20px; z-index:2147483648; }
    @media (max-width:768px){
      .pct-modal{width:98vw;top:20px;max-height:95vh;} .pct-modal-header{font-size:18px;padding:12px 15px 6px 15px;}
      .pct-modal-body{padding:12px 15px 6px 15px;} .pct-modal-footer{flex-direction:column;align-items:stretch;padding:10px 15px 12px 15px;}
      .pct-btn,.pct-btn-secondary,.pct-btn-info,.pct-btn-success{width:100%;margin:4px 0;padding:10px 15px;}
      .pct-mode-card-grid{grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;} .pct-mode-card{font-size:13px;padding:10px 8px;min-height:45px;}
      .pct-input{font-size:14px;padding:8px 10px;} .pct-table-wrap{max-height:40vh;margin:10px 0;}
      .pct-table th,.pct-table td{padding:6px 8px;font-size:12px;} .pct-toast{top:10px;width:90%;left:5%;transform:translateX(0);text-align:center;white-space:normal;}
      .pct-pagination{flex-direction:column;align-items:flex-start;gap:8px;} .pct-pagination-info{width:100%;text-align:center;} .pct-pagination .pct-btn{width:100%;}
    }
  `;
  const inject = () => {
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
 * 職責：集中管理應用程式的所有可變狀態。
 * 透過 getter/setter 模式，提供統一的狀態訪問與修改介面。
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
    totalRecords: 0,
    showAllPages: false,
    sortKey: '',
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
        allProcessedData: [], rawData: [], totalRecords: 0, pageNo: 1,
        filterSpecial: false, detailQueryCount: 0
      });
    },
    getToken: getTokenFromStorage
  };
})();

/**
 * ===================================================================
 * 模組 5：API 服務 (ApiModule)
 * 職責：處理所有與後端 API 的通訊。
 * 封裝了 fetch 呼叫、參數建構、錯誤處理與資料快取邏輯。
 * ===================================================================
 */
const ApiModule = (() => {
  // 通用的 API 請求函式
  const callApi = async (endpoint, params, signal = null) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': StateModule.get('token') },
      body: JSON.stringify(params),
      signal
    });
    if (!response.ok) {
      if (signal?.aborted) throw new DOMException('查詢已中止', 'AbortError');
      const errorText = await response.text();
      let errorMessage = `API 請求失敗: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage += ` - ${errorJson.message || errorJson.error || ''}`;
      } catch (e) { errorMessage += ` - ${errorText}`; }
      throw new Error(errorMessage);
    }
    return response.json();
  };
  
  // 驗證 Token 的有效性
  const verifyToken = async (token, apiBase) => {
    try {
      const response = await callApi(`${apiBase}/planCodeController/query`, { planCode: '5105', currentPage: 1, pageSize: 1 });
      return !!response.records;
    } catch (error) {
      return false;
    }
  };

  // 根據不同模式建構主檔查詢參數
  const buildMasterQueryParams = (mode, input, pageNo, pageSize) => {
    const { QUERY_MODES } = ConfigModule;
    const params = { currentPage: pageNo, pageSize };
    switch (mode) {
      case QUERY_MODES.PLAN_CODE: params.planCode = input; break;
      case QUERY_MODES.PLAN_NAME: params.planCodeName = input; break;
      case QUERY_MODES.ALL_MASTER_PLANS: params.planCode = '　'; break; // AP要求全查需使用全形空白
      case QUERY_MODES.MASTER_IN_SALE: params.saleEndDate = '9999-12-31 00:00:00'; break;
    }
    return params;
  };
  
  // 批量查詢多筆商品代碼
  const queryMultiplePlanCodes = async (planCodes, signal) => {
    const BATCH_SIZE = 10;
    let allRecords = [];
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
    return { records: allRecords, totalRecords: allRecords.length };
  };
  
  // 查詢通路資料
  const queryChannelData = async (queryMode, queryChannels, signal) => {
    const { uiToApi, apiToUi } = UtilsModule.channelUtils;
    const apiBase = StateModule.get('apiBase');
    const channelsToQuery = queryChannels.length > 0 ? queryChannels : ConfigModule.FIELD_MAPS.CHANNELS;

    const queryByType = async (channels, saleEndDate) => {
      const results = await Promise.all(
        channels.map(async (uiChannel) => {
          try {
            const params = {
              channel: uiToApi(uiChannel), saleEndDate,
              pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
              orderBys: ["planCode asc"]
            };
            const result = await callApi(`${apiBase}/planCodeSaleDateController/query`, params, signal);
            const records = result.planCodeSaleDates?.records || [];
            records.forEach(r => {
              r._sourceChannel = uiChannel;
              r.channel = apiToUi(r.channel);
            });
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
      const [allData, currentData] = await Promise.all([
        queryByType(channelsToQuery, ""),
        queryByType(channelsToQuery, "9999-12-31 00:00:00")
      ]);
      const currentSet = new Set(currentData.map(item => `${item.planCode}_${item.channel}`));
      return allData.filter(item => !currentSet.has(`${item.planCode}_${apiToUi(item.channel)}`));
    } else {
      return queryByType(channelsToQuery, "9999-12-31 00:00:00");
    }
  };

  // 獲取 POLPLN 資料 (含快取)
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

  // 獲取通路資料 (含快取)
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
 * 職責：管理所有使用者介面元件的建立、渲染與更新。
 * 封裝了 Toast、Modal 和 Table 的渲染邏輯。
 * ===================================================================
 */
const UIModule = (() => {
  // Toast 訊息管理器
  const Toast = {
    show(message, type = 'info', duration = ConfigModule.UI_SETTINGS.TOAST_DURATION, persistent = false) {
      if (persistent && StateModule.get('persistentToastId')) {
        const oldToast = document.getElementById(StateModule.get('persistentToastId'));
        if (oldToast) oldToast.remove();
      }
      const el = document.createElement('div');
      el.id = persistent ? `pct-toast-${Date.now()}` : 'pct-toast';
      el.className = `pct-toast ${type} ${persistent ? 'persistent' : ''}`;
      el.textContent = message;
      document.body.appendChild(el);
      el.classList.add('pct-toast-show');
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
        if (toast) {
          toast.classList.remove('pct-toast-show');
          toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }
        StateModule.set({ persistentToastId: null });
      }
    }
  };

  // 模態視窗管理器
  const Modal = (() => {
    let modal, mask, header;
    let isDragging = false, initialX, initialY;

    const close = () => {
      const currentModal = document.getElementById(ConfigModule.TOOL_ID);
      if(currentModal) currentModal.remove();
      const currentMask = document.getElementById('pctModalMask');
      if(currentMask) currentMask.remove();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onEscKey);

      const controller = StateModule.get('currentQueryController');
      if (controller) {
        controller.abort();
        StateModule.set({ currentQueryController: null, isQuerying: false });
      }
      Toast.hide();
    };
    
    const onMouseDown = (e) => {
      isDragging = true;
      initialX = e.clientX - modal.getBoundingClientRect().left;
      initialY = e.clientY - modal.getBoundingClientRect().top;
      modal.classList.add('dragging');
      header.classList.add('dragging');
      e.preventDefault();
    };
    
    const onMouseMove = (e) => {
      if (isDragging) {
        const currentX = e.clientX - initialX;
        const currentY = e.clientY - initialY;
        modal.style.left = `${Math.max(0, Math.min(currentX, window.innerWidth - modal.offsetWidth))}px`;
        modal.style.top = `${Math.max(0, Math.min(currentY, window.innerHeight - modal.offsetHeight))}px`;
        modal.style.transform = 'none';
      }
    };
    
    const onMouseUp = () => {
      if(isDragging) {
        isDragging = false;
        modal.classList.remove('dragging');
        header.classList.remove('dragging');
      }
    };

    const onEscKey = (e) => { if (e.key === 'Escape') close(); };

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

      setTimeout(() => {
        mask.classList.add('show');
        modal.classList.add('show');
      }, 10);
      
      header = modal.querySelector('.pct-modal-header');
      if (header) {
        header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('keydown', onEscKey);

      if (onOpen) onOpen(modal);
    };

    return { show, close };
  })();

  // 表格渲染器
  const Table = {
    renderSummary: (data, hasSpecialData) => {
      const specialCount = data.filter(r => r.special).length;
      return `<div class="pct-summary">共 ${data.length} 筆${hasSpecialData ? `，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆` : ''}</div>`;
    },
    renderSearchBox: (keyword) => `
      <div class="pct-search-container">
        <input type="text" class="pct-search-input" id="pct-search-input" placeholder="搜尋商品代號、名稱、POLPLN..." value="${UtilsModule.escapeHtml(keyword)}">
        ${keyword ? '<button class="pct-search-clear" id="pct-search-clear" title="清除搜尋">✕</button>' : '<span class="pct-search-icon">🔍</span>'}
      </div>`,
    renderTableHTML: (data, sortKey, sortAsc) => {
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
      const cells = [
        {value: row.no},
        {value: row.planCode},
        {value: row.shortName},
        {value: row.currency},
        {value: row.unit},
        {value: row.coverageType},
        {value: row.saleStartDate},
        {value: row.saleEndDate},
        {value: row.mainStatus, class: mainStatusClass},
        {value: row.polpln || ''},
      ].map(cell => `<td class="pct-td-copy ${cell.class || ''}" data-raw="${escapeHtml(cell.value)}">${escapeHtml(cell.value)}</td>`).join('');
      return `<tr${row.special ? ' class="special-row"' : ''}>${cells}<td>${channelHtml}</td></tr>`;
    },
    renderTableText: (data) => {
      let text = "No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n";
      data.forEach(row => {
        const channelStr = (row.channels || []).map(c => `${c.channel}:${c.saleEndDate}（${c.status}）`).join(' / ');
        text += `${row.no}\t${row.planCode}\t${row.shortName}\t${row.currency}\t${row.unit}\t${row.coverageType}\t${row.saleStartDate}\t${row.saleEndDate}\t${row.mainStatus}\t${row.polpln || ''}\t${channelStr}\n`;
      });
      return text;
    }
  };
  
  // 表單渲染器
  const Form = {
    renderTokenDialog: (env, token) => `
      <div class="pct-modal-header"><span id="pct-modal-title">商品查詢小工具（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
      <div class="pct-modal-body">
        <div class="pct-form-group">
          <label for="pct-token-input" class="pct-label">請輸入 SSO-TOKEN：</label>
          <textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 SSO-TOKEN" autocomplete="off">${token || ''}</textarea>
          <div class="pct-error" id="pct-token-err" style="display:none;"></div>
        </div>
      </div>
      <div class="pct-modal-footer">
        <button class="pct-btn" id="pct-token-ok">驗證並繼續</button>
        <button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過檢核</button>
        <button class="pct-btn pct-btn-danger" id="pct-token-cancel">關閉</button>
      </div>`,
    renderQueryDialog: (env) => {
      const { QUERY_MODES } = ConfigModule;
      const modes = [
        { mode: QUERY_MODES.PLAN_CODE, label: '商品代號' },
        { mode: QUERY_MODES.PLAN_NAME, label: '商品名稱' },
        { mode: QUERY_MODES.ALL_MASTER_PLANS, label: '查詢全部' },
        { mode: 'masterDataCategory', label: '查詢主檔' },
        { mode: 'channelDataCategory', label: '查詢通路' }
      ];
      return `
        <div class="pct-modal-header"><span id="pct-modal-title">查詢條件設定（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
        <div class="pct-modal-body">
          <div class="pct-form-group"><div class="pct-label">查詢模式：</div>
            <div id="pct-mode-wrap" class="pct-mode-card-grid">
              ${modes.map(({mode, label}) => `<div class="pct-mode-card" data-mode="${mode}">${label}</div>`).join('')}
            </div>
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
 * 職責：統一處理所有使用者互動事件。
 * 採用事件委派來提升效能，並將 DOM 元素快取以減少重複查詢。
 * ===================================================================
 */
const EventModule = (() => {
  const showError = (el, msg) => { if (el) { el.textContent = msg; el.style.display = 'block'; }};
  const hideError = (el) => { if (el) { el.style.display = 'none'; }};

  // Token 對話框事件
  const handleTokenDialog = (modal) => {
    const tokenInput = modal.querySelector('#pct-token-input');
    const errEl = modal.querySelector('#pct-token-err');
    
    modal.querySelector('#pct-token-ok').onclick = async () => {
      const val = tokenInput.value.trim();
      if (!val) return showError(errEl, '請輸入 Token');
      UIModule.Toast.show('檢查 Token 中...', 'info');
      StateModule.set({ token: val });
      localStorage.setItem('SSO-TOKEN', val);
      localStorage.setItem('euisToken', val);
      const isValid = await ApiModule.verifyToken(val, StateModule.get('apiBase'));
      isValid ? (UIModule.Toast.show('Token 驗證成功', 'success'), ControllerModule.showQueryDialog()) : showError(errEl, 'Token 驗證失敗');
    };
    modal.querySelector('#pct-token-skip').onclick = () => {
      const val = tokenInput.value.trim();
      if (val) {
        StateModule.set({ token: val });
        localStorage.setItem('SSO-TOKEN', val);
        localStorage.setItem('euisToken', val);
      }
      UIModule.Toast.show('已略過 Token 驗證', 'warning');
      ControllerModule.showQueryDialog();
    };
    modal.querySelector('#pct-token-cancel').onclick = UIModule.Modal.close;
    tokenInput.focus();
  };
  
  // 查詢對話框事件
  const handleQueryDialog = (modal) => {
    const state = StateModule.get();
    const dynamicContent = modal.querySelector('#pct-dynamic-query-content');
    const errEl = modal.querySelector('#pct-query-err');
    let localState = {
      primaryMode: state.queryMode,
      input: state.queryInput,
      subOptions: [...state.querySubOption],
      channels: [...state.queryChannels]
    };

    const renderDynamicContent = () => {
      const { QUERY_MODES, UI_SETTINGS, FIELD_MAPS } = ConfigModule;
      let html = '';
      switch (localState.primaryMode) {
        case QUERY_MODES.PLAN_CODE:
          html = `<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆請用空格、逗號、分號或換行分隔"></textarea></div>`;
          break;
        case QUERY_MODES.PLAN_NAME:
          html = `<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea></div>`;
          break;
        case QUERY_MODES.ALL_MASTER_PLANS:
          html = `<div style="text-align:center;padding:20px;">將查詢所有主檔商品。</div>`;
          break;
        case 'masterDataCategory':
          html = `<div class="pct-form-group"><div class="pct-label">選擇主檔查詢範圍：</div><div class="pct-sub-option-grid" data-type="sub-option"><div class="pct-sub-option" data-value="${QUERY_MODES.MASTER_IN_SALE}">現售商品</div><div class="pct-sub-option" data-value="${QUERY_MODES.MASTER_STOPPED}">停售商品</div></div></div>`;
          break;
        case 'channelDataCategory':
          html = `<div class="pct-form-group"><div class="pct-label">選擇通路：(可多選，不選則查全部)</div><div class="pct-channel-option-grid" data-type="channel">${FIELD_MAPS.CHANNELS.map(ch => `<div class="pct-channel-option" data-value="${ch}">${ch}</div>`).join('')}</div></div>` +
                 `<div class="pct-form-group"><div class="pct-label">選擇通路銷售範圍：</div><div class="pct-sub-option-grid" data-type="sub-option"><div class="pct-sub-option" data-value="${QUERY_MODES.CHANNEL_IN_SALE}">現售通路</div><div class="pct-sub-option" data-value="${QUERY_MODES.CHANNEL_STOPPED}">停售通路</div></div></div>`;
          break;
      }
      dynamicContent.innerHTML = html;
      updateSelections();
    };
    
    const updateSelections = () => {
      modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.primaryMode));
      const inputEl = dynamicContent.querySelector('#pct-query-input');
      if (inputEl) inputEl.value = localState.input;
      dynamicContent.querySelectorAll('[data-type="sub-option"] [data-value]').forEach(el => el.classList.toggle('selected', localState.subOptions.includes(el.dataset.value)));
      dynamicContent.querySelectorAll('[data-type="channel"] [data-value]').forEach(el => el.classList.toggle('selected', localState.channels.includes(el.dataset.value)));
    };

    modal.querySelector('#pct-mode-wrap').onclick = (e) => {
      const card = e.target.closest('.pct-mode-card');
      if (card) {
        localState = { primaryMode: card.dataset.mode, input: '', subOptions: [], channels: [] };
        renderDynamicContent();
        hideError(errEl);
      }
    };
    
    dynamicContent.addEventListener('input', (e) => {
        if (e.target.id === 'pct-query-input') {
            localState.input = UtilsModule.inputUtils.normalizeInput(e.target.value);
            if (e.target.value !== localState.input) e.target.value = localState.input;
        }
    });

    dynamicContent.addEventListener('click', (e) => {
      const option = e.target.closest('[data-value]');
      if (!option) return;
      const {type} = option.parentElement.dataset;
      const {value} = option.dataset;
      if (type === 'sub-option') {
          localState.subOptions = localState.subOptions.includes(value) ? [] : [value];
          updateSelections();
      } else if (type === 'channel') {
          const idx = localState.channels.indexOf(value);
          idx > -1 ? localState.channels.splice(idx, 1) : localState.channels.push(value);
      }
      option.classList.toggle('selected');
      hideError(errEl);
    });
    
    modal.querySelector('#pct-query-clear-selection').onclick = () => {
      localState = { primaryMode: '', input: '', subOptions: [], channels: [] };
      renderDynamicContent();
      UIModule.Toast.show('已清除所有查詢條件', 'info');
    };

    modal.querySelector('#pct-query-ok').onclick = () => {
      const { primaryMode, input, subOptions, channels } = localState;
      let finalMode = primaryMode;
      if (primaryMode === 'masterDataCategory' || primaryMode === 'channelDataCategory') {
        if (subOptions.length !== 1) return showError(errEl, '請選擇一個查詢範圍');
        finalMode = subOptions[0];
      }
      if (!finalMode) return showError(errEl, '請選擇查詢模式');
      if ([ConfigModule.QUERY_MODES.PLAN_CODE, ConfigModule.QUERY_MODES.PLAN_NAME].includes(finalMode) && !input) return showError(errEl, '請輸入查詢內容');
      
      StateModule.set({ queryMode: finalMode, queryInput: input, querySubOption: subOptions, queryChannels: channels });
      ControllerModule.executeQuery();
    };
    modal.querySelector('#pct-query-cancel').onclick = UIModule.Modal.close;

    renderDynamicContent();
  };

  // 表格事件
  const handleTableEvents = (modal, displayedData) => {
    const state = StateModule.get();
    const totalPages = Math.ceil(displayedData.length / state.pageSize);

    // 使用事件委派處理所有點擊事件
    modal.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.id || (target.closest('[data-key]') ? 'sort' : null) || (target.closest('.pct-btn-retry') ? 'retry' : null) || (target.closest('.pct-td-copy') ? 'copy' : null);
        if (!action) return;

        switch (action) {
            case 'pct-search-clear':
                StateModule.set({ searchKeyword: '', pageNo: 1 });
                ControllerModule.renderTable();
                break;
            case 'pct-table-prev':
                if (state.pageNo > 1) { StateModule.set({ pageNo: state.pageNo - 1 }); ControllerModule.renderTable(); }
                break;
            case 'pct-table-next':
                if (state.pageNo < totalPages) { StateModule.set({ pageNo: state.pageNo + 1 }); ControllerModule.renderTable(); }
                break;
            case 'pct-page-jump-btn':
                const pageNum = parseInt(modal.querySelector('#pct-page-jump-input').value, 10);
                if (pageNum >= 1 && pageNum <= totalPages) { StateModule.set({ pageNo: pageNum }); ControllerModule.renderTable(); }
                else { UIModule.Toast.show(`請輸入 1 到 ${totalPages} 的頁碼`, 'warning'); }
                break;
            case 'pct-table-show-all':
                StateModule.set({ showAllPages: !state.showAllPages, pageNo: 1 });
                ControllerModule.renderTable();
                break;
            case 'pct-table-detail': ControllerModule.handleDetailQuery(); break;
            case 'pct-table-copy': UtilsModule.copyToClipboard(UIModule.Table.renderTableText(displayedData), UIModule.Toast.show); break;
            case 'pct-table-filter':
                StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 });
                ControllerModule.renderTable();
                break;
            case 'pct-table-requery': ControllerModule.showQueryDialog(); break;
            case 'pct-table-close': UIModule.Modal.close(); break;
            case 'sort':
                const key = target.closest('[data-key]').dataset.key;
                const newSortAsc = state.sortKey === key ? !state.sortAsc : true;
                StateModule.set({ sortKey: key, sortAsc: newSortAsc, pageNo: 1 });
                ControllerModule.renderTable();
                break;
            case 'retry': ControllerModule.querySinglePlanCode(target.closest('.pct-btn-retry').dataset.plan); break;
            case 'copy': UtilsModule.copyToClipboard(target.closest('.pct-td-copy').dataset.raw, UIModule.Toast.show); break;
        }
    });

    // 處理輸入和鍵盤事件
    const searchInput = modal.querySelector('#pct-search-input');
    searchInput.addEventListener('input', () => {
        clearTimeout(state.searchDebounceTimer);
        const timer = setTimeout(() => {
            StateModule.set({ searchKeyword: searchInput.value, pageNo: 1 });
            ControllerModule.renderTable();
        }, ConfigModule.UI_SETTINGS.DEBOUNCE_DELAY);
        StateModule.set({ searchDebounceTimer: timer });
    });
    modal.querySelector('#pct-page-jump-input')?.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') modal.querySelector('#pct-page-jump-btn').click();
    });
  };

  return { handleTokenDialog, handleQueryDialog, handleTableEvents };
})();

/**
 * ===================================================================
 * 模組 8：資料處理 (DataModule)
 * 職責：負責資料轉換、處理、排序與特殊狀態檢查。
 * 這是資料流的核心，確保前端顯示的資料是正確且一致的。
 * ===================================================================
 */
const DataModule = (() => {
  // 資料排序邏輯
  const sortData = (data, key, asc) => {
    return [...data].sort((a, b) => {
      let valA = a[key], valB = b[key];
      if (key.includes('Date')) {
        valA = new Date(UtilsModule.dateUtils.formatDateForComparison(valA));
        valB = new Date(UtilsModule.dateUtils.formatDateForComparison(valB));
      }
      const order = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return asc ? order : -order;
    });
  };

  // 將原始 API 回應轉換為表格顯示用的資料結構
  const processRawData = (rawData) => {
    const todayStr = UtilsModule.dateUtils.formatToday();
    return rawData.map((item, index) => {
      if (item._isErrorRow) {
        return { no: index + 1, planCode: item.planCode, saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, _isErrorRow: true };
      }
      const { dateUtils, fieldConverters, getSaleStatus } = UtilsModule;
      return {
        no: index + 1,
        planCode: item.planCode || '-',
        shortName: item.shortName || item.planName || '-',
        currency: fieldConverters.currency(item.currency || item.cur),
        unit: fieldConverters.unit(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
        coverageType: fieldConverters.coverageType(item.coverageType || item.type),
        saleStartDate: dateUtils.formatDateForUI(item.saleStartDate),
        saleEndDate: dateUtils.formatDateForUI(item.saleEndDate),
        mainStatus: getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate),
        polpln: '載入中...',
        channels: [],
        special: false,
        _originalItem: item,
        _loading: true
      };
    });
  };
  
  // 背景載入詳細資料 (POLPLN 和通路)
  const loadDetailsInBackground = async (processedData, forceFetch, onProgress) => {
    const BATCH_SIZE = 20;
    const todayStr = UtilsModule.dateUtils.formatToday();
    const signal = StateModule.get('currentQueryController')?.signal;

    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new DOMException('查詢已中止', 'AbortError');
        
        UIModule.Toast.show(`載入詳細資料 ${i + 1}-${Math.min(i + BATCH_SIZE, processedData.length)} / ${processedData.length}`, 'info', null, true);
        
        const batch = processedData.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item, batchIndex) => {
            if (item._isErrorRow || !item._loading) return;
            const globalIndex = i + batchIndex;
            try {
                const [polpln, channels] = await Promise.all([
                    ApiModule.getPolplnData(item._originalItem, forceFetch, signal),
                    ApiModule.getChannelData(item._originalItem, forceFetch, todayStr, signal)
                ]);
                item.polpln = polpln || '無資料';
                item.channels = channels;
                item.special = UtilsModule.checkSpecialStatus(item);
                item._loading = false;
                onProgress(globalIndex, item);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                item.polpln = '載入失敗';
                item._loading = false;
                onProgress(globalIndex, item);
            }
        }));
    }
  };

  return { sortData, processRawData, loadDetailsInBackground };
})();

/**
 * ===================================================================
 * 模組 9：主控制器 (ControllerModule)
 * 職責：協調各模組運作，是整個應用程式的指揮中心。
 * 管理應用的生命週期，從初始化、查詢執行到結果渲染。
 * ===================================================================
 */
const ControllerModule = (() => {
  let uiRefs = {}; // 快取 UI 元素參考

  // 初始化流程
  const initialize = async () => {
    StyleModule.inject();
    const token = StateModule.getToken();
    if (!token) return showTokenDialog();
    UIModule.Toast.show('驗證 Token 中...', 'info');
    const isValid = await ApiModule.verifyToken(token, StateModule.get('apiBase'));
    if (isValid) {
      UIModule.Toast.show('Token 驗證成功', 'success');
      showQueryDialog();
    } else {
      UIModule.Toast.show('Token 無效，請重新設定', 'warning');
      localStorage.removeItem('SSO-TOKEN');
      localStorage.removeItem('euisToken');
      StateModule.set({ token: '' });
      showTokenDialog();
    }
  };

  const showTokenDialog = () => UIModule.Modal.show(UIModule.Form.renderTokenDialog(StateModule.get('environment'), StateModule.get('token')), EventModule.handleTokenDialog);
  const showQueryDialog = () => UIModule.Modal.show(UIModule.Form.renderQueryDialog(StateModule.get('environment')), EventModule.handleQueryDialog);

  const showCancelQueryButton = (show) => {
    let btn = document.getElementById('pct-cancel-query-btn');
    if (show) {
      if (btn) return;
      btn = document.createElement('button');
      btn.id = 'pct-cancel-query-btn';
      btn.className = 'pct-btn pct-btn-danger pct-cancel-query';
      btn.textContent = '中止查詢';
      btn.onclick = () => StateModule.get('currentQueryController')?.abort();
      document.body.appendChild(btn);
    } else {
      if (btn) btn.remove();
    }
  };

  // 執行查詢的主流程
  const executeQuery = async () => {
    UIModule.Modal.close();
    StateModule.resetQuery();
    StateModule.set({ currentQueryController: new AbortController(), isQuerying: true });
    showCancelQueryButton(true);
    UIModule.Toast.show('查詢中...', 'info', null, true);

    try {
      const { queryMode, queryInput, queryChannels } = StateModule.get();
      const { QUERY_MODES } = ConfigModule;
      let result;
      
      if (queryMode === QUERY_MODES.PLAN_CODE && queryInput.includes(',')) {
        const planCodes = UtilsModule.inputUtils.splitInput(queryInput);
        result = await ApiModule.queryMultiplePlanCodes(planCodes, StateModule.get('currentQueryController').signal);
      } else if ([QUERY_MODES.CHANNEL_IN_SALE, QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
        const records = await ApiModule.queryChannelData(queryMode, queryChannels, StateModule.get('currentQueryController').signal);
        result = { records, totalRecords: records.length };
      } else {
        const params = ApiModule.buildMasterQueryParams(queryMode, queryInput, 1, ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER);
        const apiResult = await ApiModule.callApi(`${StateModule.get('apiBase')}/planCodeController/query`, params, StateModule.get('currentQueryController').signal);
        let records = apiResult.records || [];
        if (queryMode === QUERY_MODES.MASTER_STOPPED) {
            records = records.filter(item => UtilsModule.getSaleStatus(UtilsModule.dateUtils.formatToday(), item.saleStartDate, item.saleEndDate) === ConfigModule.SALE_STATUS.STOPPED);
        }
        result = { records, totalRecords: records.length };
      }
      
      StateModule.set({ rawData: result.records, totalRecords: result.totalRecords });
      const processedData = DataModule.processRawData(result.records);
      StateModule.set({ allProcessedData: processedData });
      
      renderTable();
      UIModule.Toast.show(`基本資料載入完成，共 ${processedData.length} 筆`, 'success', 2000, true);
      
      await DataModule.loadDetailsInBackground(processedData, false, updateSingleRowInTable);
      UIModule.Toast.show('所有詳細資料載入完成', 'success');

    } catch (error) {
      if (error.name === 'AbortError') UIModule.Toast.show('查詢已中止', 'warning');
      else UIModule.Toast.show(`查詢失敗: ${error.message}`, 'error');
      StateModule.set({ allProcessedData: [], totalRecords: 0 });
      if(!document.getElementById(ConfigModule.TOOL_ID)) renderTable();
    } finally {
      StateModule.set({ isQuerying: false, currentQueryController: null });
      showCancelQueryButton(false);
      UIModule.Toast.hide();
    }
  };

  // 渲染或更新整個表格視窗
  const renderTable = () => {
    const state = StateModule.get();
    const { allProcessedData, searchKeyword, filterSpecial, sortKey, sortAsc, showAllPages, pageNo, pageSize } = state;

    let filteredData = filterSpecial ? allProcessedData.filter(r => r.special) : allProcessedData;
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filteredData = filteredData.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(keyword)));
    }

    const sortedData = sortKey ? DataModule.sortData(filteredData, sortKey, sortAsc) : filteredData;
    const pageData = showAllPages ? sortedData : sortedData.slice((pageNo - 1) * pageSize, pageNo * pageSize);
    const hasSpecialData = allProcessedData.some(r => r.special);

    const existingModal = document.getElementById(ConfigModule.TOOL_ID);
    if (existingModal) {
      updateTableContent(sortedData, pageData, hasSpecialData, state);
    } else {
      createNewTableModal(sortedData, pageData, hasSpecialData, state);
    }
  };

  const createNewTableModal = (displayedData, pageData, hasSpecialData, state) => {
    const env = state.environment;
    const modalHtml = `
      <div class="pct-modal-header"><span id="pct-modal-title">查詢結果（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
      <div class="pct-modal-body"></div>
      <div class="pct-modal-footer"></div>
    `;
    UIModule.Modal.show(modalHtml, (modal) => {
      uiRefs.modal = modal;
      uiRefs.body = modal.querySelector('.pct-modal-body');
      uiRefs.footer = modal.querySelector('.pct-modal-footer');
      updateTableContent(displayedData, pageData, hasSpecialData, state);
      EventModule.handleTableEvents(modal, displayedData);
    });
  };

  const updateTableContent = (displayedData, pageData, hasSpecialData, state) => {
    const { searchKeyword, sortKey, sortAsc, showAllPages, pageNo, pageSize, filterSpecial } = state;
    const totalPages = Math.ceil(displayedData.length / pageSize);
    
    uiRefs.body.innerHTML = `
      ${UIModule.Table.renderSummary(displayedData, hasSpecialData)}
      ${UIModule.Table.renderSearchBox(searchKeyword)}
      ${UIModule.Table.renderTableHTML(pageData, sortKey, sortAsc)}
    `;
    uiRefs.tableBody = uiRefs.body.querySelector('.pct-table tbody'); // 快取 table body

    const paginationHtml = showAllPages ?
      `<div class="pct-pagination-info">顯示全部 ${displayedData.length} 筆資料</div>` :
      `<button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${pageNo <= 1 ? 'disabled' : ''}>上一頁</button>
       <button class="pct-btn pct-btn-secondary" id="pct-table-next" ${pageNo >= totalPages ? 'disabled' : ''}>下一頁</button>
       <div class="pct-pagination-info">第 ${pageNo} / ${totalPages} 頁 (共 ${displayedData.length} 筆)</div>
       <div class="pct-page-controls">
         <input type="number" class="pct-page-input" id="pct-page-jump-input" min="1" max="${totalPages}" value="${pageNo}">
         <button class="pct-btn pct-btn-secondary" id="pct-page-jump-btn">跳轉</button>
       </div>`;

    uiRefs.footer.innerHTML = `
      <div class="pct-pagination">${paginationHtml}</div>
      <div style="flex-grow:1;"></div>
      <button class="pct-btn pct-btn-secondary" id="pct-table-show-all">${showAllPages ? '分頁顯示' : '顯示全部'}</button>
      <button class="pct-btn pct-btn-info" id="pct-table-detail">查詢全部</button>
      <button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>
      ${hasSpecialData ? `<button class="pct-btn ${filterSpecial ? 'pct-filter-btn-active' : 'pct-filter-btn'}" id="pct-table-filter">${filterSpecial ? '顯示全部' : '篩選特殊狀態'}</button>` : ''}
      <button class="pct-btn" id="pct-table-requery">重新查詢</button>
      <button class="pct-btn pct-btn-danger" id="pct-table-close">關閉</button>
    `;
  };
  
  // 優化後的單行更新，直接操作快取的 table body
  const updateSingleRowInTable = (globalIndex, item) => {
      if (!uiRefs.tableBody) return;
      const { pageNo, pageSize, showAllPages } = StateModule.get();
      const rowIndexInPage = globalIndex - (pageNo - 1) * pageSize;
      if (showAllPages || (rowIndexInPage >= 0 && rowIndexInPage < pageSize)) {
          const targetRow = uiRefs.tableBody.rows[showAllPages ? globalIndex : rowIndexInPage];
          if (targetRow) {
              const newRowHtml = UIModule.Table._createRowHtml(item);
              const tempEl = document.createElement('tbody');
              tempEl.innerHTML = newRowHtml;
              targetRow.replaceWith(tempEl.firstChild);
          }
      }
  };

  // 處理「查詢全部」按鈕點擊
  const handleDetailQuery = async () => {
    const newCount = StateModule.get('detailQueryCount') + 1;
    StateModule.set({ detailQueryCount: newCount });
    if (newCount > 1 && !confirm('再次點擊將清空快取並重新查詢所有數據，確定繼續嗎？')) {
        return UIModule.Toast.show('已取消操作。', 'info');
    }
    UIModule.Toast.show(newCount === 1 ? '補齊尚未載入的數據...' : '清空快取並重新查詢所有數據...', 'info', 3000);
    
    const processedData = StateModule.get('allProcessedData');
    await DataModule.loadDetailsInBackground(processedData, newCount > 1, updateSingleRowInTable);
    UIModule.Toast.show('詳細資料更新完成', 'success');
  };

  // 處理單筆商品代碼的重新查詢
  const querySinglePlanCode = async (planCode) => {
    UIModule.Toast.show(`重新查詢 ${planCode}...`, 'info');
    try {
      const result = await ApiModule.callApi(`${StateModule.get('apiBase')}/planCodeController/query`, {
          planCode, currentPage: 1, pageSize: 10
      });
      if (result.records?.length > 0) {
        const processedNewData = DataModule.processRawData(result.records);
        const allData = StateModule.get('allProcessedData');
        const idx = allData.findIndex(r => r.planCode === planCode && r._isErrorRow);
        if (idx > -1) {
          allData.splice(idx, 1, ...processedNewData);
          processedNewData[0].no = idx + 1; // 維持原來的編號
        }
        StateModule.set({ allProcessedData: allData });
        renderTable();
        UIModule.Toast.show(`${planCode} 查詢成功`, 'success');
        await DataModule.loadDetailsInBackground(processedNewData, true, updateSingleRowInTable);
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
ControllerModule.initialize();

})();
