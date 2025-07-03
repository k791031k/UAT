javascript:(function(){
'use strict';

/**
 * ===================================================================
 * 商品查詢小工具 v3.2.0 (效能優化重構版)
 * * 重構優化：
 * - 效能優化：使用 Set/Map 優化查找，減少重複DOM查詢
 * - 去除重複語法：提取公共邏輯，統一處理方式
 * - 語法現代化：ES6+ 語法，優化 async/await
 * - 保持所有欄位名稱、API接口、功能邏輯不變
 * ===================================================================
 */

// 清理舊工具實例
(() => {
  ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask', 'pct-toast-container']
    .forEach(id => document.getElementById(id)?.remove());
  document.querySelectorAll('.pct-modal-mask').forEach(el => el.remove());
})();

/**
 * ========== 模組 1：配置管理 (ConfigModule) ==========
 */
const ConfigModule = (() => {
  const config = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '3.2.0',
    
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
      CURRENCY: new Map([
        ['1', 'TWD'], ['2', 'USD'], ['3', 'AUD'], 
        ['4', 'CNT'], ['5', 'USD_OIU'], ['6', 'EUR'], ['7', 'JPY']
      ]),
      UNIT: new Map([
        ['A1', '元'], ['A3', '仟元'], ['A4', '萬元'],
        ['B1', '計畫'], ['C1', '單位']
      ]),
      COVERAGE_TYPE: new Map([['M', '主約'], ['R', '附約']]),
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
  
  return {
    get: () => config,
    getQueryModes: () => config.QUERY_MODES,
    getApiEndpoints: () => config.API_ENDPOINTS,
    getSaleStatus: () => config.SALE_STATUS,
    getFieldMaps: () => config.FIELD_MAPS,
    getDefaultParams: () => config.DEFAULT_QUERY_PARAMS,
    getUISettings: () => config.UI_SETTINGS
  };
})();

/**
 * ========== 模組 2：工具函式 (UtilsModule) ==========
 */
const UtilsModule = (() => {
  const config = ConfigModule.get();
  
  const entityMap = new Map([
    ['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], 
    ['"', '&quot;'], ["'", '&#039;']
  ]);
  
  const escapeHtml = text => 
    typeof text === 'string' ? 
      text.replace(/[&<>"']/g, match => entityMap.get(match)) : text;
  
  const dateUtils = {
    _todayCache: null,
    _todayDate: null,
    
    formatToday() {
      const now = new Date();
      const today = now.toDateString();
      
      if (this._todayDate !== today) {
        this._todayDate = today;
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        this._todayCache = `${year}${month}${day}`;
      }
      
      return this._todayCache;
    },
    
    formatDateForUI: dateStr => 
      dateStr ? String(dateStr).split(' ')[0].replace(/-/g, '') : '',
    
    formatDateForComparison(dateStr) {
      if (!dateStr) return '';
      const cleanDate = String(dateStr).split(' ')[0];
      return /^\d{8}$/.test(cleanDate) 
        ? cleanDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
        : cleanDate;
    }
  };

  const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
    if (!saleStartStr || !saleEndStr) return '';
    if (saleEndStr.includes('99991231') || saleEndStr.includes('9999-12-31')) {
      return config.SALE_STATUS.CURRENT;
    }
    
    const today = new Date(dateUtils.formatDateForComparison(todayStr));
    const saleStart = new Date(dateUtils.formatDateForComparison(saleStartStr));
    const saleEnd = new Date(dateUtils.formatDateForComparison(saleEndStr));
    
    if ([today, saleStart, saleEnd].some(d => isNaN(d))) {
      return '日期格式錯誤';
    }
    
    if (saleStart > saleEnd) return config.SALE_STATUS.ABNORMAL;
    if (today > saleEnd) return config.SALE_STATUS.STOPPED;
    if (today < saleStart) return config.SALE_STATUS.PENDING;
    return config.SALE_STATUS.CURRENT;
  };
  
  const channelMap = new Map([['BK', 'OT'], ['OT', 'BK']]);
  const channelUtils = {
    uiToApi: code => channelMap.get(code) || code,
    apiToUi: code => channelMap.get(code) || code
  };

  const fieldConverters = {
    currency: val => config.FIELD_MAPS.CURRENCY.get(String(val)) || val || '',
    unit: val => config.FIELD_MAPS.UNIT.get(String(val)) || val || '',
    coverageType: val => config.FIELD_MAPS.COVERAGE_TYPE.get(String(val)) || val || ''
  };
  
  const inputUtils = {
    _fullToHalfMap: new Map([
      ['，', ','], ['；', ';'], ['：', ':'], ['？', '?'], ['！', '!'],
      ['（', '('], ['）', ')'], ['【', '['], ['】', ']'],
      ['「', '"'], ['」', '"'], ['『', "'"], ['』', "'"],
      ['　', ' '], ['／', '/'], ['＼', '\\'], ['｜', '|']
    ]),
    
    normalizeInput(str, maxLength = null) {
      if (typeof str !== 'string') return str;
      let result = str;
      for (const [full, half] of this._fullToHalfMap) {
        result = result.replaceAll(full, half);
      }
      result = result.replace(/[\uff01-\uff5e]/g, char => 
        String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      ).replace(/\u3000/g, ' ');
      result = result.toUpperCase();
      return maxLength && result.length > maxLength ? 
        result.substring(0, maxLength) : result;
    },
    
    splitInput: input => input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean)
  };

  const copyToClipboard = async (text, showToastCallback) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        showToastCallback('已複製查詢結果', 'success');
      } else {
        const textarea = document.createElement('textarea');
        Object.assign(textarea, { value: text });
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        showToastCallback('已複製查詢結果 (舊版瀏覽器)', 'success');
      }
    } catch {
      showToastCallback('複製失敗', 'error');
    }
  };

  const checkSpecialStatus = item => {
    const todayStr = dateUtils.formatToday();
    const mainStatus = getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
    const channels = item.channels || [];
    
    if (mainStatus === config.SALE_STATUS.ABNORMAL) return true;
    if (channels.length === 0) return false;
    
    const currentChannels = channels.filter(c => c.status === config.SALE_STATUS.CURRENT);
    const nonCurrentChannels = channels.filter(c => 
      [config.SALE_STATUS.STOPPED, config.SALE_STATUS.PENDING].includes(c.status)
    );
    return (mainStatus === config.SALE_STATUS.STOPPED && currentChannels.length > 0) ||
           (mainStatus === config.SALE_STATUS.CURRENT && nonCurrentChannels.length === channels.length);
  };

  return {
    escapeHtml, dateUtils, getSaleStatus, channelUtils, 
    fieldConverters, inputUtils, copyToClipboard, checkSpecialStatus
  };
})();

/**
 * ========== 模組 3：樣式管理 (StyleModule) ==========
 */
const StyleModule = (() => {
  const config = ConfigModule.get();
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
    .pct-modal { font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif; background:var(--surface-color); border-radius:var(--border-radius-lg); box-shadow:0 4px 24px var(--box-shadow-strong); padding:0; width:${config.UI_SETTINGS.MODAL_WIDTH}; max-width:95vw; position:fixed; top:60px; left:50%; transform:translateX(-50%) translateY(-20px); opacity:0; z-index:2147483647; transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1); display:flex; flex-direction:column; }
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
  return {
    inject: () => {
      document.getElementById(config.STYLE_ID)?.remove();
      const style = document.createElement('style');
      Object.assign(style, { id: config.STYLE_ID, textContent: cssContent });
      document.head.appendChild(style);
    },
    remove: () => document.getElementById(config.STYLE_ID)?.remove()
  };
})();

/**
 * ========== 模組 4：狀態管理 (StateModule) ==========
 */
const StateModule = (() => {
  const apiEndpoints = ConfigModule.getApiEndpoints();
  const isUAT = window.location.host.toLowerCase().includes('uat');
  
  let state = {
    environment: isUAT ? 'UAT' : 'PROD',
    apiBase: isUAT ? apiEndpoints.UAT : apiEndpoints.PROD,
    token: '',
    queryMode: '',
    queryInput: '',
    querySubOption: [],
    queryChannels: [],
    pageNo: 1,
    pageSize: ConfigModule.getDefaultParams().PAGE_SIZE_TABLE,
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

  const getToken = () => {
    const tokenKeys = ['SSO-TOKEN', 'euisToken'];
    const storages = [localStorage, sessionStorage];
    
    for (const storage of storages) {
      for (const key of tokenKeys) {
        const token = storage.getItem(key);
        if (token?.trim() && token !== 'null') {
          return token.trim();
        }
      }
    }
    return '';
  };
  state.token = getToken();
  
  return {
    get: () => ({ ...state }),
    set: updates => { state = { ...state, ...updates }; },
    
    resetQuery() {
      Object.assign(state, {
        allProcessedData: [],
        rawData: [],
        totalRecords: 0,
        pageNo: 1,
        filterSpecial: false,
        detailQueryCount: 0
      });
      state.cacheDetail.clear();
      state.cacheChannel.clear();
    },
    
    getToken,
    getEnvironment: () => state.environment,
    getApiBase: () => state.apiBase,
    getCurrentToken: () => state.token,
    getQueryState: () => ({
      mode: state.queryMode,
      input: state.queryInput,
      subOption: state.querySubOption,
      channels: state.queryChannels
    }),
    getPaginationState: () => ({
      pageNo: state.pageNo,
      pageSize: state.pageSize,
      totalRecords: state.totalRecords,
      showAllPages: state.showAllPages
    }),
    getSortState: () => ({
      sortKey: state.sortKey,
      sortAsc: state.sortAsc
    }),
    getDataState: () => ({
      allProcessedData: state.allProcessedData,
      rawData: state.rawData,
      cacheDetail: state.cacheDetail,
      cacheChannel: state.cacheChannel
    })
  };
})();

/**
 * ========== 模組 5：API 服務 (ApiModule) ==========
 */
const ApiModule = (() => {
  const stateModule = StateModule;
  const config = ConfigModule.get();
  
  const callApi = async (endpoint, params, signal = null) => {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'SSO-TOKEN': stateModule.getCurrentToken()
      },
      body: JSON.stringify(params),
      ...(signal && { signal })
    };
    
    const response = await fetch(endpoint, fetchOptions);
    
    if (!response.ok) {
      if (signal?.aborted) {
        throw new DOMException('查詢已中止', 'AbortError');
      }
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || await response.text();
      } catch {
        errorMessage = await response.text();
      }
      throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
    return response.json();
  };

  const verifyToken = async (token, apiBase) => {
    try {
      const response = await fetch(`${apiBase}/planCodeController/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
        body: JSON.stringify({ planCode: '5105', currentPage: 1, pageSize: 1 })
      });
      if (!response.ok) return false;
      const data = await response.json();
      return !!data.records;
    } catch {
      return false;
    }
  };

  const buildMasterQueryParams = (mode, input, pageNo, pageSize) => {
    const params = { currentPage: pageNo, pageSize };
    const queryModes = ConfigModule.getQueryModes();
    
    const paramMap = {
      [queryModes.PLAN_CODE]: { planCode: input },
      [queryModes.PLAN_NAME]: { planCodeName: input },
      [queryModes.ALL_MASTER_PLANS]: { planCodeName: '' },
      [queryModes.MASTER_IN_SALE]: { saleEndDate: '9999-12-31 00:00:00' }
    };
    if (!paramMap[mode]) {
      throw new Error('無效的主檔查詢模式');
    }
    return { ...params, ...paramMap[mode] };
  };

  const queryMultiplePlanCodes = async (planCodes, signal) => {
    const BATCH_SIZE = 10;
    const allRecords = [];
    const apiBase = stateModule.getApiBase();
    
    for (let i = 0; i < planCodes.length; i += BATCH_SIZE) {
      if (signal?.aborted) throw new Error('查詢已被中止');
      
      const batch = planCodes.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async planCode => {
        try {
          const params = {
            planCode,
            currentPage: 1,
            pageSize: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
          };
          const result = await callApi(`${apiBase}/planCodeController/query`, params, signal);
          
          if (result.records?.length > 0) {
            result.records.forEach(record => record._querySourcePlanCode = planCode);
            return result.records;
          }
          return [{ planCode, _apiStatus: '查無資料', _isErrorRow: true }];
        } catch (error) {
           if (error.name === 'AbortError') throw error;
          return [{ planCode, _apiStatus: '查詢失敗', _isErrorRow: true }];
        }
      });
      const batchResults = await Promise.all(batchPromises);
      allRecords.push(...batchResults.flat());
    }
    return { records: allRecords, totalRecords: allRecords.length };
  };
  
  const queryChannelData = async (queryMode, queryChannels, signal) => {
    const channelsToQuery = queryChannels.length > 0 ? queryChannels : config.FIELD_MAPS.CHANNELS;
    const apiBase = stateModule.getApiBase();
    const utils = UtilsModule;

    const queryChannelByType = async (channels, saleEndDate) => {
      const channelPromises = channels.map(async uiChannel => {
        try {
          const apiChannel = utils.channelUtils.uiToApi(uiChannel);
          const baseParams = {
            planCode: "", channel: apiChannel, saleEndDate,
            pageIndex: 1, size: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
            orderBys: ["planCode asc"]
          };
          const result = await callApi(`${apiBase}/planCodeSaleDateController/query`, baseParams, signal);
          const channelRecords = result.planCodeSaleDates?.records || [];
          
          channelRecords.forEach(r => {
            r._sourceChannel = uiChannel;
            r.channel = utils.channelUtils.apiToUi(r.channel);
          });
          return channelRecords;
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          return [];
        }
      });
      const results = await Promise.all(channelPromises);
      return results.flat();
    };

    const queryModes = ConfigModule.getQueryModes();
    
    if (queryMode === queryModes.CHANNEL_STOPPED) {
      const [allChannelData, currentSaleData] = await Promise.all([
        queryChannelByType(channelsToQuery, ""),
        queryChannelByType(channelsToQuery, "9999-12-31 00:00:00")
      ]);
      const currentSaleSet = new Set(currentSaleData.map(item => `${item.planCode}_${item.channel}`));
      const stoppedChannelData = allChannelData.filter(item => {
        const key = `${item.planCode}_${utils.channelUtils.apiToUi(item.channel)}`;
        return !currentSaleSet.has(key);
      });
      return removeDuplicateChannelRecords(stoppedChannelData);
    }
    const channelData = await queryChannelByType(channelsToQuery, "9999-12-31 00:00:00");
    return removeDuplicateChannelRecords(channelData);
  };

  const removeDuplicateChannelRecords = records => {
    const seenEntries = new Set();
    return records.filter(record => {
      const identifier = record.planCode + (record._sourceChannel || '');
      if (seenEntries.has(identifier)) return false;
      seenEntries.add(identifier);
      return true;
    });
  };
  
  const getPolplnData = async (item, forceFetch, signal) => {
    const dataState = stateModule.getDataState();
    const apiBase = stateModule.getApiBase();
    
    if (!forceFetch && dataState.cacheDetail.has(item.planCode)) {
        return dataState.cacheDetail.get(item.planCode);
    }

    try {
      const detail = await callApi(`${apiBase}/planCodeController/queryDetail`, {
        planCode: item.planCode, currentPage: 1, pageSize: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
      }, signal);
      const polpln = (detail.records || []).map(r => r.polpln).filter(Boolean).join(', ');
      dataState.cacheDetail.set(item.planCode, polpln);
      return polpln;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return '';
    }
  };

  const getChannelData = async (item, forceFetch, todayStr, signal) => {
    const dataState = stateModule.getDataState();
    const apiBase = stateModule.getApiBase();
    const utils = UtilsModule;
    
    if (!forceFetch && dataState.cacheChannel.has(item.planCode)) {
        return dataState.cacheChannel.get(item.planCode);
    }
    
    try {
      const sale = await callApi(`${apiBase}/planCodeSaleDateController/query`, {
        planCode: item.planCode, currentPage: 1, pageSize: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL
      }, signal);
      const channels = (sale.planCodeSaleDates?.records || []).map(r => ({
        channel: utils.channelUtils.apiToUi(r.channel),
        saleStartDate: utils.dateUtils.formatDateForUI(r.saleStartDate),
        saleEndDate: utils.dateUtils.formatDateForUI(r.saleEndDate),
        status: utils.getSaleStatus(todayStr, r.saleStartDate, r.saleEndDate),
        rawStart: r.saleStartDate,
        rawEnd: r.saleEndDate
      }));
      dataState.cacheChannel.set(item.planCode, channels);
      return channels;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return [];
    }
  };

  return {
    callApi, verifyToken, buildMasterQueryParams,
    queryMultiplePlanCodes, queryChannelData,
    getPolplnData, getChannelData
  };
})();

/**
 * ========== 模組 6：UI 元件 (UIModule) ==========
 */
const UIModule = (() => {
  const config = ConfigModule.get();
  const utils = UtilsModule;
  const stateModule = StateModule;
  
  const ToastManager = {
    show(message, type = 'info', duration = config.UI_SETTINGS.TOAST_DURATION, persistent = false) {
      const state = stateModule.get();
      if (persistent && state.persistentToastId) {
        document.getElementById(state.persistentToastId)?.remove();
      }
      
      let el = document.getElementById('pct-toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pct-toast';
        document.body.appendChild(el);
      }
      
      Object.assign(el, {
        className: `pct-toast ${type} ${persistent ? 'persistent' : ''}`,
        textContent: message
      });
      el.classList.add('pct-toast-show');
      
      if (persistent) {
        stateModule.set({ persistentToastId: el.id });
      } else {
        setTimeout(() => {
          if (el?.classList.contains('pct-toast-show')) {
            el.classList.remove('pct-toast-show');
            el.addEventListener('transitionend', () => el.remove(), { once: true });
          }
        }, duration);
      }
    },
    hide() {
      const state = stateModule.get();
      if (state.persistentToastId) {
        const toast = document.getElementById(state.persistentToastId);
        if (toast) {
          toast.classList.remove('pct-toast-show');
          toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }
        stateModule.set({ persistentToastId: null });
      }
    }
  };
  
  const ModalManager = {
    show(html, onOpen) {
      this.close();
      const mask = document.createElement('div');
      Object.assign(mask, {
        id: 'pctModalMask',
        className: 'pct-modal-mask',
        onclick: e => e.target === mask && this.close()
      });
      document.body.appendChild(mask);

      const modal = document.createElement('div');
      Object.assign(modal, {
        id: config.TOOL_ID,
        className: 'pct-modal',
        innerHTML: html
      });
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'pct-modal-title');
      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        mask.classList.add('show');
        modal.classList.add('show');
      });
      this.enableDragging(modal);
      
      const escHandler = e => {
        if (e.key === 'Escape') {
          this.close();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      onOpen?.(modal);
    },
    close() {
      [config.TOOL_ID, 'pctModalMask', 'pct-toast'].forEach(id => document.getElementById(id)?.remove());
      const state = stateModule.get();
      if (state.currentQueryController) {
        state.currentQueryController.abort();
        stateModule.set({ currentQueryController: null });
      }
      stateModule.set({ isQuerying: false });
      ToastManager.hide();
    },
    enableDragging(modal) {
      let isDragging = false, currentX, currentY, initialX, initialY;
      const header = modal.querySelector('.pct-modal-header');
      if (!header) return;
      
      const handleMouseDown = e => {
        isDragging = true;
        initialX = e.clientX - modal.getBoundingClientRect().left;
        initialY = e.clientY - modal.getBoundingClientRect().top;
        modal.classList.add('dragging');
        header.classList.add('dragging');
        e.preventDefault();
      };
      const handleMouseMove = e => {
        if (!isDragging) return;
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;
        Object.assign(modal.style, {
          left: `${Math.max(0, Math.min(currentX, maxX))}px`,
          top: `${Math.max(0, Math.min(currentY, maxY))}px`,
          transform: 'none'
        });
        e.preventDefault();
      };
      const handleMouseUp = () => {
        isDragging = false;
        modal.classList.remove('dragging');
        header.classList.remove('dragging');
      };
      header.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  const TableRenderer = {
    renderSummary: (data, hasSpecialData) => {
      const specialCount = data.filter(r => r.special).length;
      return `<div class="pct-summary">共 ${data.length} 筆${ hasSpecialData ? `，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆` : '' }</div>`;
    },
    renderSearchBox() {
      const state = stateModule.get();
      const searchValue = utils.escapeHtml(state.searchKeyword);
      return `
        <div class="pct-search-container">
          <input type="text" class="pct-search-input" id="pct-search-input" placeholder="搜尋商品代號、名稱、POLPLN 或其他內容..." value="${searchValue}">
          ${state.searchKeyword ? '<button class="pct-search-clear" id="pct-search-clear" title="清除搜尋">✕</button>' : '<span class="pct-search-icon">🔍</span>' }
        </div>
      `;
    },
    renderTableHTML(data) {
      if (!data?.length) {
        return '<div class="pct-table-wrap" style="height:150px; display:flex; align-items:center; justify-content:center; color:var(--text-color-light);">查無資料</div>';
      }
      const state = stateModule.get();
      const saleStatus = ConfigModule.getSaleStatus();
      const headers = [
        {key: 'no', label: 'No'}, {key: 'planCode', label: '代號'}, {key: 'shortName', label: '商品名稱'},
        {key: 'currency', label: '幣別'}, {key: 'unit', label: '單位'}, {key: 'coverageType', label: '類型'},
        {key: 'saleStartDate', label: '銷售起日'}, {key: 'saleEndDate', label: '銷售迄日'}, {key: 'mainStatus', label: '主約狀態'},
        {key: 'polpln', label: 'POLPLN'}, {key: '', label: '通路資訊'}
      ];
      const headerHtml = headers.map(header => {
        if (!header.key) return `<th>${header.label}</th>`;
        const sortClass = state.sortKey === header.key ? (state.sortAsc ? 'sort-asc' : 'sort-desc') : '';
        return `<th data-key="${header.key}" class="${sortClass}">${header.label}</th>`;
      }).join('');

      const rowsHtml = data.map(row => {
        if (row._isErrorRow) {
          return `<tr class="error-row">
            <td class="pct-td-copy" data-raw="${utils.escapeHtml(row.planCode)}">${row.no}</td>
            <td class="pct-td-copy" data-raw="${utils.escapeHtml(row.planCode)}">${utils.escapeHtml(row.planCode)}</td>
            <td colspan="8" style="color:#d9534f;">${row.saleEndDate}
              <button class="pct-btn pct-btn-info pct-btn-retry" data-plan="${utils.escapeHtml(row.planCode)}">重新查詢</button>
            </td>
            <td></td>
          </tr>`;
        }
        const channelHtml = (row.channels || []).map(c => {
          const statusClass = {
            [saleStatus.CURRENT]: 'pct-status-onsale', [saleStatus.STOPPED]: 'pct-status-offsale',
            [saleStatus.ABNORMAL]: 'pct-status-abnormal'
          }[c.status] || 'pct-status-pending';
          return `<span class="${statusClass}">${utils.escapeHtml(c.channel)}:${utils.escapeHtml(c.saleEndDate)}（${utils.escapeHtml(c.status)}）</span>`;
        }).join('<br>');
        
        const mainStatusClass = {
          [saleStatus.CURRENT]: 'pct-status-onsale', [saleStatus.STOPPED]: 'pct-status-offsale',
          [saleStatus.ABNORMAL]: 'pct-status-abnormal'
        }[row.mainStatus] || 'pct-status-pending';
        
        const cells = [
          row.no, row.planCode, row.shortName, row.currency, 
          row.unit, row.coverageType, row.saleStartDate, row.saleEndDate
        ].map(value => `<td class="pct-td-copy" data-raw="${utils.escapeHtml(value)}">${utils.escapeHtml(value)}</td>`).join('');

        return `<tr${row.special ? ' class="special-row"' : ''}>
          ${cells}
          <td class="pct-td-copy ${mainStatusClass}" data-raw="${utils.escapeHtml(row.mainStatus)}">${utils.escapeHtml(row.mainStatus)}</td>
          <td class="pct-td-copy" data-raw="${utils.escapeHtml(row.polpln || '')}">${utils.escapeHtml(row.polpln || '')}</td>
          <td>${channelHtml}</td>
        </tr>`;
      }).join('');
      
      return `<div class="pct-table-wrap"><table class="pct-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
    },
    renderTableText: data => 
      `No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n` +
      data.map(row => {
        const channelStr = (row.channels || []).map(c => `${c.channel}:${c.saleEndDate}（${c.status}）`).join(' / ');
        return [
          row.no, row.planCode, row.shortName, row.currency, 
          row.unit, row.coverageType, row.saleStartDate, 
          row.saleEndDate, row.mainStatus, row.polpln, channelStr
        ].join('\t');
      }).join('\n')
  };

  const FormRenderer = {
    renderTokenDialog() {
      const env = stateModule.getEnvironment();
      const token = stateModule.getCurrentToken();
      return `
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
        </div>
      `;
    },
    renderQueryDialog() {
      const env = stateModule.getEnvironment();
      const queryModes = ConfigModule.getQueryModes();
      const primaryQueryModes = [
        queryModes.PLAN_CODE, queryModes.PLAN_NAME, queryModes.ALL_MASTER_PLANS,
        'masterDataCategory', 'channelDataCategory'
      ];
      const modeCards = primaryQueryModes.map(mode => `<div class="pct-mode-card" data-mode="${mode}">${this.getModeLabel(mode)}</div>`).join('');
      return `
        <div class="pct-modal-header"><span id="pct-modal-title">查詢條件設定（${env === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
        <div class="pct-modal-body">
          <div class="pct-form-group">
            <div class="pct-label">查詢模式：</div>
            <div id="pct-mode-wrap" class="pct-mode-card-grid">${modeCards}</div>
          </div>
          <div id="pct-dynamic-query-content"></div>
          <div class="pct-form-group"><div class="pct-error" id="pct-query-err" style="display:none"></div></div>
        </div>
        <div class="pct-modal-footer">
          <button class="pct-btn" id="pct-query-ok">開始查詢</button>
          <button class="pct-btn pct-btn-secondary" id="pct-query-clear-selection">清除選擇</button>
          <button class="pct-btn pct-btn-danger" id="pct-query-cancel">關閉</button>
        </div>
      `;
    },
    getModeLabel: mode => ({
      [ConfigModule.getQueryModes().PLAN_CODE]: '商品代號',
      [ConfigModule.getQueryModes().PLAN_NAME]: '商品名稱',
      [ConfigModule.getQueryModes().ALL_MASTER_PLANS]: '查詢全部',
      'masterDataCategory': '查詢主檔',
      'channelDataCategory': '查詢通路'
    }[mode] || mode)
  };

  return {
    Toast: ToastManager,
    Modal: ModalManager,
    Table: TableRenderer,
    Form: FormRenderer
  };
})();

/**
 * ========== 模組 7：事件處理 (EventModule) ==========
 */
const EventModule = (() => {
  const stateModule = StateModule;
  const uiModule = UIModule;
  const apiModule = ApiModule;
  const config = ConfigModule.get();
  const utils = UtilsModule;
  
  const handleError = (msg, elementId = 'pct-token-err', show = true) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = show ? msg : '';
      el.style.display = show ? 'block' : 'none';
    } else if (show) {
      uiModule.Toast.show(msg, 'error');
    }
  };
  
  const handleTokenDialog = modal => {
    const tokenInput = modal.querySelector('#pct-token-input');
    
    const saveToken = val => {
      stateModule.set({ token: val });
      ['SSO-TOKEN', 'euisToken'].forEach(key => localStorage.setItem(key, val));
    };
    
    modal.addEventListener('click', async (e) => {
        const targetId = e.target.id;
        if (!['pct-token-ok', 'pct-token-skip', 'pct-token-cancel'].includes(targetId)) return;

        const val = tokenInput.value.trim();
        handleError('', 'pct-token-err', false);

        if (targetId === 'pct-token-ok') {
            if (!val) return handleError('請輸入 Token', 'pct-token-err');
            uiModule.Toast.show('檢查 Token 中...', 'info');
            saveToken(val);
            const isValid = await apiModule.verifyToken(val, stateModule.getApiBase());
            if (isValid) {
                uiModule.Toast.show('Token 驗證成功', 'success');
                ControllerModule.showQueryDialog();
            } else {
                handleError('Token 驗證失敗，請重新輸入', 'pct-token-err');
            }
        } else if (targetId === 'pct-token-skip') {
            if (val) saveToken(val);
            uiModule.Toast.show('已略過 Token 驗證，直接進入查詢', 'warning');
            ControllerModule.showQueryDialog();
        } else if (targetId === 'pct-token-cancel') {
            uiModule.Modal.close();
        }
    });
    tokenInput.focus();
  };

  const handleQueryDialog = modal => {
    const queryState = stateModule.getQueryState();
    const localState = {
      primaryMode: queryState.mode || ConfigModule.getQueryModes().PLAN_CODE,
      queryInput: queryState.input,
      subOptions: new Set(queryState.subOption),
      channels: new Set(queryState.channels)
    };
    const elements = {
      dynamicContent: modal.querySelector('#pct-dynamic-query-content'),
      modeWrap: modal.querySelector('#pct-mode-wrap'),
      errEl: modal.querySelector('#pct-query-err')
    };

    const contentTemplates = {
        [ConfigModule.getQueryModes().PLAN_CODE]: `<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆請用空格、逗號、分號或換行分隔"></textarea></div>`,
        [ConfigModule.getQueryModes().PLAN_NAME]: `<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea></div>`,
        [ConfigModule.getQueryModes().ALL_MASTER_PLANS]: `<div style="text-align: center; padding: 20px; color: var(--text-color-light);">將查詢所有主檔商品。</div>`,
        'masterDataCategory': () => `
          <div class="pct-form-group"><div class="pct-label">選擇主檔查詢範圍：</div>
            <div class="pct-sub-option-grid" data-type="sub-option">
              <div class="pct-sub-option" data-value="${ConfigModule.getQueryModes().MASTER_IN_SALE}">現售商品</div>
              <div class="pct-sub-option" data-value="${ConfigModule.getQueryModes().MASTER_STOPPED}">停售商品</div>
            </div>
          </div>`,
        'channelDataCategory': () => {
            const channels = ConfigModule.getFieldMaps().CHANNELS.map(ch => `<div class="pct-channel-option" data-value="${ch}">${ch}</div>`).join('');
            return `
              <div class="pct-form-group"><div class="pct-label">選擇通路：(可多選，不選則查全部)</div><div class="pct-channel-option-grid" data-type="channel">${channels}</div></div>
              <div class="pct-form-group"><div class="pct-label">選擇通路銷售範圍：</div>
                <div class="pct-sub-option-grid" data-type="sub-option">
                  <div class="pct-sub-option" data-value="${ConfigModule.getQueryModes().CHANNEL_IN_SALE}">現售通路</div>
                  <div class="pct-sub-option" data-value="${ConfigModule.getQueryModes().CHANNEL_STOPPED}">停售通路</div>
                </div>
              </div>`;
        }
    };
    
    const render = () => {
        elements.modeWrap.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.primaryMode));
        const template = contentTemplates[localState.primaryMode];
        elements.dynamicContent.innerHTML = typeof template === 'function' ? template() : template || '';
        
        const inputEl = elements.dynamicContent.querySelector('#pct-query-input');
        if (inputEl) inputEl.value = localState.queryInput;
        
        elements.dynamicContent.querySelectorAll('[data-value]').forEach(el => {
            const set = el.classList.contains('pct-sub-option') ? localState.subOptions : localState.channels;
            el.classList.toggle('selected', set.has(el.dataset.value));
        });
        handleError('', 'pct-query-err', false);
    };

    elements.modeWrap.addEventListener('click', e => {
        const card = e.target.closest('.pct-mode-card');
        if (card) {
            localState.primaryMode = card.dataset.mode;
            localState.queryInput = '';
            localState.subOptions.clear();
            localState.channels.clear();
            render();
        }
    });

    elements.dynamicContent.addEventListener('input', e => {
        if (e.target.matches('#pct-query-input')) {
            localState.queryInput = utils.inputUtils.normalizeInput(e.target.value);
            if (e.target.value !== localState.queryInput) e.target.value = localState.queryInput;
        }
    });

    elements.dynamicContent.addEventListener('click', e => {
        const option = e.target.closest('[data-value]');
        if (!option) return;
        const { type } = option.parentElement.dataset;
        const { value } = option.dataset;
        const targetSet = type === 'sub-option' ? localState.subOptions : localState.channels;
        
        if (targetSet.has(value)) {
            targetSet.delete(value);
        } else {
            if (type === 'sub-option') targetSet.clear();
            targetSet.add(value);
        }
        render();
    });

    modal.querySelector('.pct-modal-footer').addEventListener('click', e => {
        const targetId = e.target.id;
        if(targetId === 'pct-query-clear-selection'){
            localState.primaryMode = '';
            localState.queryInput = '';
            localState.subOptions.clear();
            localState.channels.clear();
            render();
            uiModule.Toast.show('已清除所有查詢條件', 'info');
        } else if (targetId === 'pct-query-ok') {
            let finalMode = localState.primaryMode;
            if (['masterDataCategory', 'channelDataCategory'].includes(localState.primaryMode)) {
                if (localState.subOptions.size !== 1) return handleError('請選擇一個查詢範圍', 'pct-query-err');
                finalMode = [...localState.subOptions][0];
            }
            if (!finalMode) return handleError('請選擇查詢模式', 'pct-query-err');
            if (['planCode', 'planCodeName'].includes(finalMode) && !localState.queryInput) return handleError('請輸入查詢內容', 'pct-query-err');
            
            stateModule.set({
                queryMode: finalMode,
                queryInput: localState.queryInput,
                querySubOption: [...localState.subOptions],
                queryChannels: [...localState.channels],
            });
            ControllerModule.executeQuery();
        } else if (targetId === 'pct-query-cancel') {
            uiModule.Modal.close();
        }
    });

    render();
  };

  const handleTableEvents = (modal, displayedData, totalPages) => {
    modal.addEventListener('click', e => {
        const target = e.target;
        const targetId = target.id;
        const state = stateModule.get();

        if (targetId === 'pct-search-clear') {
            stateModule.set({ searchKeyword: '', pageNo: 1 });
            return ControllerModule.renderTable();
        }
        if (targetId === 'pct-table-prev' && state.pageNo > 1) {
            stateModule.set({ pageNo: state.pageNo - 1 });
            return ControllerModule.renderTable();
        }
        if (targetId === 'pct-table-next' && state.pageNo < totalPages) {
            stateModule.set({ pageNo: state.pageNo + 1 });
            return ControllerModule.renderTable();
        }
        if (targetId === 'pct-page-jump-btn') {
            const pageNum = parseInt(modal.querySelector('#pct-page-jump-input').value, 10);
            if (pageNum >= 1 && pageNum <= totalPages) {
                stateModule.set({ pageNo: pageNum });
                ControllerModule.renderTable();
            } else { uiModule.Toast.show(`請輸入 1 到 ${totalPages} 的頁碼`, 'warning'); }
            return;
        }
        if (targetId === 'pct-table-show-all') {
            stateModule.set({ showAllPages: !state.showAllPages, pageNo: 1 });
            return ControllerModule.renderTable();
        }
        if (targetId === 'pct-table-detail') return ControllerModule.handleDetailQuery();
        if (targetId === 'pct-table-copy') return utils.copyToClipboard(uiModule.Table.renderTableText(displayedData), uiModule.Toast.show);
        if (targetId === 'pct-table-filter') {
            stateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 });
            return ControllerModule.renderTable();
        }
        if (targetId === 'pct-table-requery') return ControllerModule.showQueryDialog();
        if (targetId === 'pct-table-close') return uiModule.Modal.close();

        const sortHeader = target.closest('th[data-key]');
        if(sortHeader){
            const key = sortHeader.dataset.key;
            const newSortAsc = state.sortKey === key ? !state.sortAsc : true;
            stateModule.set({ sortKey: key, sortAsc: newSortAsc, pageNo: 1 });
            return ControllerModule.renderTable();
        }
        
        const retryBtn = target.closest('.pct-btn-retry');
        if(retryBtn) return ControllerModule.querySinglePlanCode(retryBtn.dataset.plan);

        const copyCell = target.closest('.pct-td-copy');
        if(copyCell) return utils.copyToClipboard(copyCell.dataset.raw, uiModule.Toast.show);
    });

    const searchInput = modal.querySelector('#pct-search-input');
    searchInput?.addEventListener('input', e => {
        clearTimeout(stateModule.get().searchDebounceTimer);
        const timer = setTimeout(() => {
            stateModule.set({ searchKeyword: e.target.value, pageNo: 1 });
            ControllerModule.renderTable();
        }, config.UI_SETTINGS.DEBOUNCE_DELAY);
        stateModule.set({ searchDebounceTimer: timer });
    });
  };

  return { handleTokenDialog, handleQueryDialog, handleTableEvents };
})();

/**
 * ========== 模組 8：資料處理 (DataModule) ==========
 */
const DataModule = (() => {
  const config = ConfigModule.get();
  const utils = UtilsModule;
  const apiModule = ApiModule;

  const sortData = (data, sortKey, sortAsc) => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      let valA = a[sortKey], valB = b[sortKey];
      if (valA == null) return 1; if (valB == null) return -1;
      if (sortKey.includes('Date')) {
        valA = new Date(utils.dateUtils.formatDateForComparison(valA));
        valB = new Date(utils.dateUtils.formatDateForComparison(valB));
      }
      const order = valA < valB ? -1 : (valA > valB ? 1 : 0);
      return sortAsc ? order : -order;
    });
  };

  const processRawData = (rawData) => {
    const todayStr = utils.dateUtils.formatToday();
    return rawData.map((item, index) => {
      if (item._isErrorRow) {
        return { no: index + 1, planCode: item.planCode, saleEndDate: `查詢狀態: ${utils.escapeHtml(item._apiStatus)}`, _isErrorRow: true };
      }
      return {
        no: index + 1,
        planCode: item.planCode || '-',
        shortName: item.shortName || item.planName || '-',
        currency: utils.fieldConverters.currency(item.currency || item.cur),
        unit: utils.fieldConverters.unit(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
        coverageType: utils.fieldConverters.coverageType(item.coverageType || item.type),
        saleStartDate: utils.dateUtils.formatDateForUI(item.saleStartDate),
        saleEndDate: utils.dateUtils.formatDateForUI(item.saleEndDate),
        mainStatus: utils.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate),
        polpln: '載入中...',
        channels: [],
        special: false,
        _originalItem: item,
        _loading: true
      };
    });
  };

  const loadDetailsInBackground = async (processedData, forceFetch, onProgress) => {
    const BATCH_SIZE = 10;
    const todayStr = utils.dateUtils.formatToday();
    const signal = StateModule.get().currentQueryController?.signal;

    for (let i = 0; i < processedData.length; i += BATCH_SIZE) {
      if (signal?.aborted) throw new DOMException('查詢已中止', 'AbortError');
      UIModule.Toast.show(`載入詳細資料 ${i + 1}-${Math.min(i + BATCH_SIZE, processedData.length)} / ${processedData.length}`, 'info', null, true);
      
      const batch = processedData.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item, batchIndex) => {
        if (item._isErrorRow || !item._loading) return;
        const globalIndex = i + batchIndex;
        try {
          const [polpln, channels] = await Promise.all([
            apiModule.getPolplnData(item._originalItem, forceFetch, signal),
            apiModule.getChannelData(item._originalItem, forceFetch, todayStr, signal)
          ]);
          item.polpln = polpln || '無資料';
          item.channels = channels;
          item.special = utils.checkSpecialStatus(item);
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

  const filterData = (data, searchKeyword, filterSpecial) => {
    let filteredData = filterSpecial ? data.filter(item => item.special) : data;
    if (searchKeyword?.trim()) {
      const keyword = searchKeyword.toLowerCase();
      const searchFields = ['planCode', 'shortName', 'polpln', 'currency', 'unit', 'coverageType'];
      filteredData = filteredData.filter(item => 
        searchFields.some(field => String(item[field] || '').toLowerCase().includes(keyword)) ||
        (item.channels || []).some(channel => `${channel.channel}:${channel.saleEndDate}（${channel.status}）`.toLowerCase().includes(keyword))
      );
    }
    return filteredData;
  };

  const paginateData = (data, pageNo, pageSize, showAllPages) => {
    if (showAllPages) {
      return { data, totalPages: 1, hasPrev: false, hasNext: false };
    }
    const totalPages = Math.ceil(data.length / pageSize);
    const start = (pageNo - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      totalPages,
      hasPrev: pageNo > 1,
      hasNext: pageNo < totalPages
    };
  };

  return { sortData, processRawData, loadDetailsInBackground, filterData, paginateData };
})();

/**
 * ========== 模組 9：主控制器 (ControllerModule) ==========
 */
const ControllerModule = (() => {
  const stateModule = StateModule;
  const uiModule = UIModule;
  const apiModule = ApiModule;
  const dataModule = DataModule;
  const eventModule = EventModule;
  const config = ConfigModule.get();
  
  let uiRefs = {}; // DOM 元素快取

  const initialize = async () => {
    StyleModule.inject();
    const token = stateModule.getToken();
    if (!token) return showTokenDialog();
    uiModule.Toast.show('驗證 Token 中...', 'info');
    const isValid = await apiModule.verifyToken(token, stateModule.getApiBase());
    isValid ? showQueryDialog() : showTokenDialog();
  };

  const showTokenDialog = () => uiModule.Modal.show(uiModule.Form.renderTokenDialog(), eventModule.handleTokenDialog);
  const showQueryDialog = () => uiModule.Modal.show(uiModule.Form.renderQueryDialog(), eventModule.handleQueryDialog);

  const showCancelQueryButton = (show) => {
    let btn = document.getElementById('pct-cancel-query-btn');
    if (show) {
      if(btn) return;
      btn = document.createElement('button');
      Object.assign(btn, {
          id: 'pct-cancel-query-btn',
          className: 'pct-btn pct-btn-danger pct-cancel-query',
          textContent: '中止查詢',
          onclick: () => stateModule.get().currentQueryController?.abort()
      });
      document.body.appendChild(btn);
    } else {
        btn?.remove();
    }
  };

  const executeQuery = async () => {
    uiModule.Modal.close();
    stateModule.resetQuery();
    stateModule.set({ currentQueryController: new AbortController(), isQuerying: true });
    showCancelQueryButton(true);
    uiModule.Toast.show('查詢中...', 'info', null, true);

    try {
      const { queryMode, queryInput, queryChannels } = stateModule.getQueryState();
      const { QUERY_MODES } = ConfigModule;
      let rawRecords;

      if (queryMode === QUERY_MODES.MASTER_STOPPED) {
        const [all, current] = await Promise.all([
          apiModule.callApi(`${stateModule.getApiBase()}/planCodeController/query`, { currentPage: 1, pageSize: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }),
          apiModule.callApi(`${stateModule.getApiBase()}/planCodeController/query`, { saleEndDate: '9999-12-31 00:00:00', currentPage: 1, pageSize: config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER })
        ]);
        const currentSet = new Set((current.records || []).map(r => r.planCode));
        rawRecords = (all.records || []).filter(r => !currentSet.has(r.planCode));
      } else if ([QUERY_MODES.CHANNEL_IN_SALE, QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
        const channelData = await apiModule.queryChannelData(queryMode, queryChannels, stateModule.get().currentQueryController.signal);
        const planCodes = [...new Set(channelData.map(item => item.planCode))];
        rawRecords = planCodes.length > 0 ? (await apiModule.queryMultiplePlanCodes(planCodes, stateModule.get().currentQueryController.signal)).records : [];
      } else {
        const params = apiModule.buildMasterQueryParams(queryMode, queryInput, 1, config.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER);
        const result = await apiModule.callApi(`${stateModule.getApiBase()}/planCodeController/query`, params, stateModule.get().currentQueryController.signal);
        rawRecords = result.records || [];
      }
      
      if (!rawRecords || rawRecords.length === 0) return uiModule.Toast.show('查無資料', 'warning');

      const processedData = dataModule.processRawData(rawRecords);
      stateModule.set({ rawData: rawRecords, allProcessedData: processedData, totalRecords: processedData.length });
      
      renderTable();
      uiModule.Toast.show(`基本資料載入完成，共 ${processedData.length} 筆`, 'success', 2000, true);
      
      await dataModule.loadDetailsInBackground(processedData, false, (index, item) => {
        if((index + 1) % 5 === 0) updateTableDisplay();
      });
      updateTableDisplay(); // Final update
      uiModule.Toast.show('所有詳細資料載入完成', 'success');

    } catch (error) {
      if (error.name !== 'AbortError') uiModule.Toast.show(`查詢失敗: ${error.message}`, 'error');
    } finally {
      stateModule.set({ isQuerying: false, currentQueryController: null });
      showCancelQueryButton(false);
      uiModule.Toast.hide();
    }
  };

  const renderTable = () => {
    const state = stateModule.get();
    const data = applyFiltersAndSort(state);
    
    const hasSpecialData = state.allProcessedData.some(r => r.special);
    const pagination = dataModule.paginateData(data, state.pageNo, state.pageSize, state.showAllPages);
    
    const html = `
      <div class="pct-modal-header"><span id="pct-modal-title">查詢結果（${state.environment === 'PROD' ? '正式環境' : '測試環境'}）</span></div>
      <div class="pct-modal-body">
        ${uiModule.Table.renderSummary(data, hasSpecialData)}
        ${uiModule.Table.renderSearchBox()}
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
            ${hasSpecialData ? `<button class="pct-filter-btn ${state.filterSpecial ? 'pct-filter-btn-active' : ''}" id="pct-table-filter">${state.filterSpecial ? '顯示全部' : '篩選特殊狀態'}</button>` : ''}
            <button class="pct-btn pct-btn-info" id="pct-table-detail">查詢全部</button>
            <button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>
            <button class="pct-btn" id="pct-table-requery">重新查詢</button>
        </div>
        ${uiModule.Table.renderTableHTML(pagination.data)}
        <div class="pct-pagination">
            <div class="pct-pagination-info">第 ${state.showAllPages ? 1 : state.pageNo} / ${pagination.totalPages} 頁 (共 ${data.length} 筆)</div>
            ${!state.showAllPages && pagination.totalPages > 1 ? `
            <div class="pct-page-controls">
                <button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${!pagination.hasPrev ? 'disabled' : ''}>上一頁</button>
                <input type="number" class="pct-page-input" id="pct-page-jump-input" value="${state.pageNo}" min="1" max="${pagination.totalPages}">
                <button class="pct-btn pct-btn-secondary" id="pct-page-jump-btn">跳轉</button>
                <button class="pct-btn pct-btn-secondary" id="pct-table-next" ${!pagination.hasNext ? 'disabled' : ''}>下一頁</button>
            </div>` : ''}
            <button class="pct-btn pct-btn-secondary" id="pct-table-show-all">${state.showAllPages ? '分頁顯示' : '顯示全部'}</button>
        </div>
      </div>
      <div class="pct-modal-footer"><button class="pct-btn pct-btn-danger" id="pct-table-close">關閉</button></div>
    `;

    uiModule.Modal.show(html, (modal) => {
        uiRefs.modal = modal;
        uiRefs.body = modal.querySelector('.pct-modal-body');
        eventModule.handleTableEvents(modal, data, pagination.totalPages);
    });
  };
  
  const updateTableDisplay = () => {
    if (!uiRefs.body) return;
    const state = stateModule.get();
    const data = applyFiltersAndSort(state);
    const pagination = dataModule.paginateData(data, state.pageNo, state.pageSize, state.showAllPages);
    
    uiRefs.body.querySelector('.pct-summary').outerHTML = uiModule.Table.renderSummary(data, state.allProcessedData.some(r => r.special));
    uiRefs.body.querySelector('.pct-table-wrap').outerHTML = uiModule.Table.renderTableHTML(pagination.data);
  };
  
  const applyFiltersAndSort = (state) => {
    const data = dataModule.filterData(state.allProcessedData, state.searchKeyword, state.filterSpecial);
    return dataModule.sortData(data, state.sortKey, state.sortAsc);
  };

  const handleDetailQuery = async () => {
    const state = stateModule.get();
    if (state.detailQueryCount > 0 && !confirm('您已點擊過「查詢全部」。再次點擊將清空所有快取並重新查詢所有數據，您確定要繼續嗎？')) {
        return uiModule.Toast.show('已取消操作。', 'info');
    }
    stateModule.set({ detailQueryCount: state.detailQueryCount + 1 });
    uiModule.Toast.show(state.detailQueryCount === 1 ? '補齊尚未載入的數據...' : '清空快取並重新查詢所有詳細資料中...', 'info', 3000);
    await dataModule.loadDetailsInBackground(state.allProcessedData, state.detailQueryCount > 1, (index, item) => updateTableDisplay());
    uiModule.Toast.show('詳細資料更新完成', 'success');
  };

  const querySinglePlanCode = async planCode => {
    try {
      uiModule.Toast.show(`重新查詢 ${planCode}...`, 'info');
      const result = await apiModule.callApi(`${stateModule.getApiBase()}/planCodeController/query`, { planCode, currentPage: 1, pageSize: 10 });
      
      const allData = stateModule.get().allProcessedData;
      const idx = allData.findIndex(r => r.planCode === planCode && r._isErrorRow);

      if (idx !== -1 && result.records?.length > 0) {
        const processed = dataModule.processRawData(result.records);
        allData.splice(idx, 1, ...processed);
        stateModule.set({ allProcessedData: allData });
        updateTableDisplay();
        uiModule.Toast.show(`${planCode} 查詢成功`, 'success');
        await dataModule.loadDetailsInBackground(processed, true, (index, item) => updateTableDisplay());
      } else {
        uiModule.Toast.show(`${planCode} 查無資料`, 'warning');
      }
    } catch (error) {
      uiModule.Toast.show(`${planCode} 查詢失敗: ${error.message}`, 'error');
    }
  };

  return { initialize, showQueryDialog, executeQuery, renderTable, updateTableDisplay, handleDetailQuery, querySinglePlanCode };
})();

/**
 * ========== 主程式初始化 ==========
 */
ControllerModule.initialize();

})();
