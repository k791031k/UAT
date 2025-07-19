javascript:(function() {
  'use strict';

  // 清理舊工具實例，確保環境乾淨
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  /**
   * 配置管理模組
   * 儲存所有靜態設定與常數。
   */
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '20.1.0-SilentPreload',
    QUERY_MODES: {
      PLAN_CODE: 'planCode',
      PLAN_NAME: 'planCodeName',
      MASTER_CLASSIFIED: 'masterClassified',
      CHANNEL_CLASSIFIED: 'channelClassified'
    },
    MASTER_STATUS_TYPES: {
      IN_SALE: '現售',
      STOPPED: '停售',
      PENDING: '尚未開賣',
      ABNORMAL: '日期異常'
    },
    API_ENDPOINTS: {
      UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
      PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
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
    DEBOUNCE_DELAY: { SEARCH: 1000 },
    BATCH_SIZES: { DETAIL_LOAD: 20 }
  });

  /**
   * 狀態管理模組
   * 新增 preloadPromise 來追蹤背景載入的狀態。
   */
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '',
      token: '',
      tokenCheckEnabled: true,
      
      // --- 【修改】預載狀態管理 ---
      isPreloading: false,
      preloadPromise: null, // 用於儲存預載 Promise 物件
      
      productMap: new Map(),
      channelMap: new Map(),

      lastQuery: {
        queryMode: '',
        queryInput: '',
        masterStatusSelection: new Set(),
        channelStatusSelection: '',
        channelSelection: new Set(),
      },
      
      currentResults: [],
      pageNo: 1,
      pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false,
      filterSpecial: false,
      searchKeyword: '',
      sortKey: 'no',
      sortAsc: true,
      activeFrontendFilters: new Set(),
      
      cacheDetail: new Map(),
      
      currentQueryController: null,
      searchDebounceTimer: null
    };
    
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    
    const resetQueryState = () => {
      set({
        currentResults: [],
        pageNo: 1,
        filterSpecial: false,
        searchKeyword: '',
        isFullView: false,
        activeFrontendFilters: new Set()
      });
    };
    
    const backupQuery = () => {
        const state = get();
        const inputEl = document.getElementById('pct-query-input');
        const currentQuery = {
            queryMode: state.queryMode,
            queryInput: inputEl ? inputEl.value.trim() : '',
            masterStatusSelection: state.masterStatusSelection,
            channelStatusSelection: state.channelStatusSelection,
            channelSelection: state.channelSelection,
        };
        set({ lastQuery: currentQuery });
    };
    
    return { get, set, resetQueryState, backupQuery };
  })();

  /**
   * 工具函式模組
   */
  const UtilsModule = (() => {
    const escapeHtml = t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t;
    const formatToday = () => { const d = new Date(); return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`; };
    const formatDateForUI = dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
    const formatDateForComparison = dt => { if (!dt) return ''; const p = String(dt).split(' ')[0]; return /^\d{8}$/.test(p) ? p.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : p; };
    const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
        if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        const today = new Date(formatDateForComparison(todayStr));
        const sS = new Date(formatDateForComparison(saleStartStr));
        const sE = new Date(formatDateForComparison(saleEndStr));
        if (isNaN(today.getTime()) || isNaN(sS.getTime()) || isNaN(sE.getTime())) { return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL; }
        if (sS.getTime() > sE.getTime()) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        if (today < sS) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
        if (today > sE) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
        return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
    };
    const checkSpecialStatus = item => {
        const reasons = [];
        const { mainStatus, channels = [], rawSaleEndDate, rawSaleStartDate, saleEndDate, saleStartDate } = item;
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.STOPPED && channels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約已停售，但部分通路仍在售。'); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.IN_SALE && channels.length > 0 && channels.every(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約為現售，但所有通路皆非現售狀態。'); }
        const mainEndDate = new Date(formatDateForComparison(rawSaleEndDate));
        if (!isNaN(mainEndDate.getTime())) { channels.forEach(c => { const channelEndDate = new Date(formatDateForComparison(c.rawEnd)); if (!isNaN(channelEndDate.getTime()) && channelEndDate > mainEndDate) { reasons.push(`通路[${c.channel}]迄日(${c.saleEndDate})晚於主約迄日(${saleEndDate})。`); } }); }
        const mainStartDate = new Date(formatDateForComparison(rawSaleStartDate));
        if (!isNaN(mainStartDate.getTime())) { channels.forEach(c => { const channelStartDate = new Date(formatDateForComparison(c.rawStart)); if (!isNaN(channelStartDate.getTime()) && channelStartDate < mainStartDate) { reasons.push(`通路[${c.channel}]起日(${c.saleStartDate})早於主約起日(${saleStartDate})。`); } }); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL) { reasons.push('主約本身的銷售起迄日期異常(起日>迄日)。'); }
        return reasons.join('\n');
    };
    const channelUIToAPI = c => c === 'BK' ? 'OT' : c;
    const channelAPIToUI = c => c === 'OT' ? 'BK' : c;
    const currencyConvert = v => ConfigModule.FIELD_MAPS.CURRENCY[String(v)] || v || '';
    const unitConvert = v => ConfigModule.FIELD_MAPS.UNIT[String(v)] || v || '';
    const coverageTypeConvert = v => ConfigModule.FIELD_MAPS.COVERAGE_TYPE[String(v)] || v || '';
    const copyTextToClipboard = (t, showToast) => {
      if (!navigator.clipboard) { const e = document.createElement('textarea'); e.value = t; document.body.appendChild(e); e.select(); document.execCommand('copy'); document.body.removeChild(e); showToast('已複製 (舊版)', 'success');
      } else { navigator.clipboard.writeText(t).then(() => showToast('已複製', 'success')).catch(() => showToast('複製失敗', 'error')); }
    };
    const splitInput = i => i.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
    const toHalfWidthUpperCase = str => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();
    return { escapeHtml, formatToday, formatDateForUI, getSaleStatus, checkSpecialStatus, channelUIToAPI, channelAPIToUI, currencyConvert, unitConvert, coverageTypeConvert, copyTextToClipboard, splitInput, toHalfWidthUpperCase };
  })();
  
  /**
   * UI 介面管理模組
   */
  const UIModule = (() => {
    const createElement = (tag, options = {}) => { const el = document.createElement(tag); Object.entries(options).forEach(([key, value]) => { if (key === 'children' && Array.isArray(value)) { value.forEach(child => child && el.appendChild(child)); } else if (key === 'dataset' && typeof value === 'object') { Object.assign(el.dataset, value); } else if (key === 'style' && typeof value === 'object') { Object.assign(el.style, value); } else { el[key] = value; } }); return el; };
    const injectStyle = () => {
      const styleContent = `
        :root{--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#5CB85C;--success-dark-color:#4CAE4C;--error-color:#D9534F;--error-dark-color:#C9302C;--warning-color:#F0AD4E;--warning-dark-color:#EC971F;--info-color:#5BC0DE;--info-dark-color:#46B8DA;--background-light:#F8F8F8;--surface-color:#FFFFFF;--border-color:#E0E0E0;--text-color-dark:#1a1a1a;--text-color-light:#333333;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;}
        .pct-modal-mask{position:fixed;z-index:2147483646;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);opacity:0;transition:opacity var(--transition-speed) ease-out;} .pct-modal-mask.show{opacity:1;}
        .pct-modal{font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
        .pct-modal[data-size="query"]{width:520px;height:auto;max-height:90vh;} .pct-modal[data-size="results"]{width:1050px;height:80vh;max-height:800px;}
        .pct-modal.show{opacity:1;transform:translateX(-50%) translateY(0);} .pct-modal.dragging{transition:none;}
        .pct-modal-header{padding:16px 50px 16px 20px;line-height:1;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;position:relative;}
        .pct-modal.pct-view-results .pct-modal-header{padding-top:12px;padding-bottom:12px;line-height:normal;}
        .pct-modal-header.dragging{cursor:grabbing;}
        .pct-modal-close-btn{position:absolute;top:50%;right:15px;transform:translateY(-50%);background:transparent;border:none;font-size:24px;line-height:1;color:var(--secondary-color);cursor:pointer;padding:5px;width:34px;height:34px;border-radius:50%;transition:background-color .2s, color .2s;display:flex;align-items:center;justify-content:center;}
        .pct-modal-close-btn:hover{background-color:var(--background-light);color:var(--text-color-dark);}
        .pct-modal-body{padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
        .pct-modal-footer{padding:12px 20px 16px 20px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;min-height:60px;}
        .pct-modal-footer-left,.pct-modal-footer-center,.pct-modal-footer-right{display:flex;gap:10px;align-items:center;}
        .pct-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:all var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap;}
        .pct-btn:hover{background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);}
        .pct-btn:disabled{background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;}
        .pct-btn-secondary{background:var(--secondary-color);} .pct-btn-secondary:hover{background:var(--secondary-dark-color);}
        .pct-btn.pct-btn-outline{background-color:transparent;border-color:var(--secondary-color);color:var(--secondary-color);}
        .pct-btn.pct-btn-outline:hover{background-color:var(--background-light);color:var(--text-color-dark);}
        .pct-btn.pct-btn-outline.pct-btn-primary{background-color:var(--primary-color);color:#fff;}
        .pct-filter-btn{font-size:14px;padding:5px 12px;background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);border-radius:5px;cursor:pointer;font-weight:600;}
        .pct-filter-btn.active{background:var(--warning-dark-color);color:white;}
        .pct-input{width:100%;font-size:16px;padding:9px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;margin-top:5px;}
        .pct-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
        .pct-error{color:var(--error-color);font-size:13px;margin:8px 0 0 0;display:block;min-height:1em;}
        .pct-form-group{margin-bottom:20px;}
        .pct-mode-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px;}
        .pct-mode-card,.pct-sub-option,.pct-channel-option{background:var(--background-light);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:12px;text-align:center;cursor:pointer;transition:all .2s ease-out;font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;min-height:45px;}
        .pct-mode-card:hover,.pct-sub-option:hover,.pct-channel-option:hover{transform:translateY(-2px);box-shadow:0 4px 8px var(--box-shadow-medium);background-color:#f0f7ff;border-color:var(--primary-color);}
        .pct-mode-card.selected,.pct-sub-option.selected,.pct-channel-option.selected{background:var(--primary-color);color:white;border-color:var(--primary-color);font-weight:bold;}
        .pct-sub-option-grid,.pct-channel-option-grid{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
        .pct-table-wrap{flex:1;overflow:auto;margin:15px 0;border:1px solid var(--border-color);border-radius:var(--border-radius-base);min-height:200px;}
        .pct-table{border-collapse:collapse;width:100%;font-size:13px;background:var(--surface-color);table-layout:fixed;min-width:1000px;}
        .pct-table th,.pct-table td{border:1px solid #ddd;padding:6px 4px;vertical-align:top;word-wrap:break-word;}
        .pct-table th{background:#f8f8f8;position:sticky;top:0;z-index:1;cursor:pointer;text-align:center;font-weight:bold;font-size:12px;}
        .pct-table th:nth-child(1){width:4%;} .pct-table th:nth-child(2){width:6%;} .pct-table th:nth-child(3){width:18%;} .pct-table th:nth-child(4){width:5%;} .pct-table th:nth-child(5){width:5%;} .pct-table th:nth-child(6){width:4%;} .pct-table th:nth-child(7){width:7%;} .pct-table th:nth-child(8){width:7%;} .pct-table th:nth-child(9){width:7%;} .pct-table th:nth-child(10){width:15%;} .pct-table th:nth-child(11){width:22%;}
        .pct-table th[data-key]{position:relative;padding-right:20px;}
        .pct-table th[data-key]::after{content:'';position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:0.3;font-size:12px;transition:opacity 0.2s;border:4px solid transparent;}
        .pct-table th[data-key].sort-asc::after{border-bottom-color:var(--primary-color);opacity:1;}
        .pct-table th[data-key].sort-desc::after{border-top-color:var(--primary-color);opacity:1;}
        .pct-table tr:hover{background:#e3f2fd;}
        .pct-table tr.special-row{background:#fffde7;border-left:4px solid var(--warning-color);cursor:help;}
        .pct-table td.clickable-cell{cursor:cell;}
        .pct-channel-insale{color:var(--primary-color);font-weight:bold;}
        .pct-channel-offsale{color:var(--error-color);}
        .pct-channel-separator{margin:0 4px;color:#ccc;}
        .pct-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;}
        .pct-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
        .pct-toast.success{background:var(--success-color);} .pct-toast.error{background:var(--error-color);} .pct-toast.warning{background:var(--warning-color);color:var(--text-color-dark);} .pct-toast.info{background:var(--info-color);}
        .pct-confirm-toast{display:flex;align-items:center;gap:15px;} .pct-confirm-toast .pct-btn{padding:5px 10px;font-size:14px;}
        .pct-pagination{display:flex;justify-content:center;align-items:center;gap:10px;} .pct-pagination-info{font-size:14px;color:var(--text-color-light);}
        .load-details-btn{padding:2px 8px;border:1px solid #ddd;background:#f9f9f9;border-radius:3px;cursor:pointer;font-size:11px;}
        .load-details-btn:disabled{cursor:not-allowed;background:#eee;}
        .load-details-error{color:var(--error-color);font-size:11px;cursor:help;margin-left:4px;}
      `;
      const s = createElement('style', { id: ConfigModule.STYLE_ID, textContent: styleContent });
      document.head.appendChild(s);
    };
    const Toast = {
      show: (msg, type = 'info', duration = 3000) => { let e = document.getElementById('pct-toast'); if (e) e.remove(); e = createElement('div', { id: 'pct-toast', className: `pct-toast ${type}`, textContent: msg }); document.body.appendChild(e); requestAnimationFrame(() => e.classList.add('show')); if (duration > 0) { setTimeout(() => { e.classList.remove('show'); e.addEventListener('transitionend', () => e.remove(), { once: true }); }, duration); } },
      confirm: (msg, onConfirm) => { Toast.show('', 'warning', 0); const toastEl = document.getElementById('pct-toast'); toastEl.innerHTML = ''; toastEl.appendChild(createElement('div', { className: 'pct-confirm-toast', children: [createElement('span', { textContent: msg }), createElement('button', { id: 'pct-confirm-ok', className: 'pct-btn', textContent: '確認', onclick: () => { Toast.close(); onConfirm(true); } }), createElement('button', { id: 'pct-confirm-cancel', className: 'pct-btn pct-btn-secondary', textContent: '取消', onclick: () => { Toast.close(); onConfirm(false); } })] })); },
      close: () => { document.getElementById('pct-toast')?.remove(); }
    };
    const Modal = {
      close: () => { document.getElementById(ConfigModule.TOOL_ID)?.remove(); document.getElementById('pctModalMask')?.remove(); StateModule.get().currentQueryController?.abort(); },
      show: (modalContent, onOpen) => { Modal.close(); const mask = createElement('div', { id: 'pctModalMask', className: 'pct-modal-mask' }); document.body.appendChild(mask); const modal = createElement('div', { id: ConfigModule.TOOL_ID, className: 'pct-modal', children: modalContent }); document.body.appendChild(modal); setTimeout(() => { mask.classList.add('show'); modal.classList.add('show'); }, 10); modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown); modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close); if (onOpen) setTimeout(() => onOpen(modal), 50); }
    };
    const showError = (msg, elId) => { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.style.display = 'block'; } else { Toast.show(msg, 'error'); } };
    const hideError = (elId) => { const el = document.getElementById(elId); if (el) { el.style.display = 'none'; el.textContent = ''; } };
    return { injectStyle, Toast, Modal, showError, hideError, createElement };
  })();

  /**
   * 事件管理模組
   */
  const EventModule = (() => {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, modal: null };
    const dragMouseDown = e => { const modal = document.getElementById(ConfigModule.TOOL_ID); if (!modal || e.target.classList.contains('pct-modal-close-btn')) return; dragState.isDragging = true; dragState.modal = modal; dragState.initialX = e.clientX - modal.getBoundingClientRect().left; dragState.initialY = e.clientY - modal.getBoundingClientRect().top; modal.classList.add('dragging'); e.currentTarget.classList.add('dragging'); document.addEventListener('mousemove', elementDrag); document.addEventListener('mouseup', closeDragElement); e.preventDefault(); };
    const elementDrag = e => { if (!dragState.isDragging) return; const { modal, initialX, initialY } = dragState; const newX = e.clientX - initialX; const newY = e.clientY - initialY; modal.style.left = `${newX + modal.offsetWidth / 2}px`; modal.style.top = `${newY}px`; e.preventDefault(); };
    const closeDragElement = () => { if (!dragState.isDragging) return; dragState.isDragging = false; const { modal } = dragState; if (modal) { modal.classList.remove('dragging'); modal.querySelector('.pct-modal-header')?.classList.remove('dragging'); } document.removeEventListener('mousemove', elementDrag); document.removeEventListener('mouseup', closeDragElement); };
    const handleEscKey = (e) => { if (e.key === 'Escape') { UIModule.Modal.close(); document.removeEventListener('keydown', handleEscKey); } };
    const setupGlobalKeyListener = () => { document.removeEventListener('keydown', handleEscKey); document.addEventListener('keydown', handleEscKey); };
    const autoFormatInput = (event) => { const input = event.target; const { value, selectionStart, selectionEnd } = input; input.value = UtilsModule.toHalfWidthUpperCase(value); input.setSelectionRange(selectionStart, selectionEnd); };
    return { dragMouseDown, setupGlobalKeyListener, autoFormatInput };
  })();

  /**
   * API 服務模組
   */
  const ApiModule = (() => {
    const callApi = async (endpoint, params, signal) => { const { apiBase, token } = StateModule.get(); const headers = { 'Content-Type': 'application/json' }; if (token) { headers['SSO-TOKEN'] = token; } const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: headers, body: JSON.stringify(params), signal: signal }); if (!response.ok) { let errorText = await response.text(); try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || errorJson.error || errorText; } catch (e) { /* Ignore */ } throw new Error(`API 請求失敗: ${errorText}`); } return response.json(); };
    const verifyToken = async (token) => { try { const tempState = StateModule.get(); const res = await fetch(`${tempState.apiBase}/planCodeController/query`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token }, body: JSON.stringify({ planCode: '5105', currentPage: 1, pageSize: 1 }) }); const data = await res.json(); return res.ok && (typeof data.total !== 'undefined' || typeof data.records !== 'undefined'); } catch (e) { return false; } };
    return { callApi, verifyToken };
  })();

  /**
   * 資料處理模組
   */
  const DataModule = (() => {
    const fetchAllBaseData = async (signal) => {
        const fetchProducts = ApiModule.callApi('/planCodeController/query', { currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, signal);
        const fetchChannels = ApiModule.callApi('/planCodeSaleDateController/query', { planCode: "", channel: "", saleEndDate: "", pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }, signal);
        const [productRes, channelRes] = await Promise.all([fetchProducts, fetchChannels]);
        const productMap = buildProductMap(productRes.records || []);
        const channelMap = buildChannelMap(channelRes.planCodeSaleDates?.records || []);
        StateModule.set({ productMap, channelMap });
    };
    const buildProductMap = (records) => { const map = new Map(); const today = UtilsModule.formatToday(); records.forEach(item => { map.set(item.planCode, { planCode: String(item.planCode || '-'), shortName: item.shortName || item.planName || '-', currency: UtilsModule.currencyConvert(item.currency || item.cur), unit: UtilsModule.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit), coverageType: UtilsModule.coverageTypeConvert(item.coverageType || item.type), saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate), rawSaleStartDate: item.saleStartDate, saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate), rawSaleEndDate: item.saleEndDate, mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate), }); }); return map; };
    const buildChannelMap = (records) => { const map = new Map(); const today = UtilsModule.formatToday(); records.forEach(r => { const planCode = r.planCode; if (!map.has(planCode)) { map.set(planCode, []); } map.get(planCode).push({ channel: UtilsModule.channelAPIToUI(r.channel), saleStartDate: UtilsModule.formatDateForUI(r.saleStartDate), saleEndDate: UtilsModule.formatDateForUI(r.saleEndDate), rawStart: r.saleStartDate, rawEnd: r.saleEndDate, status: UtilsModule.getSaleStatus(today, r.saleStartDate, r.saleEndDate) }); }); return map; };
    const queryLocalData = () => {
        const state = StateModule.get();
        const { productMap, channelMap, lastQuery } = state;
        let results = [];
        switch (lastQuery.queryMode) {
            case ConfigModule.QUERY_MODES.PLAN_CODE:
                UtilsModule.splitInput(lastQuery.queryInput).forEach(code => { productMap.has(code) ? results.push(productMap.get(code)) : results.push({ planCode: code, _isErrorRow: true, _apiStatus: '查無此代號主檔' }); });
                break;
            case ConfigModule.QUERY_MODES.PLAN_NAME:
                const nameKeyword = lastQuery.queryInput.toLowerCase();
                productMap.forEach(p => { if (p.shortName.toLowerCase().includes(nameKeyword)) results.push(p); });
                break;
            case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                productMap.forEach(p => { if (lastQuery.masterStatusSelection.has(p.mainStatus)) results.push(p); });
                break;
            case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                const targetChannels = Array.from(lastQuery.channelSelection);
                const targetStatus = lastQuery.channelStatusSelection;
                productMap.forEach(p => { const productChannels = channelMap.get(p.planCode) || []; const hasMatch = productChannels.some(ch => { const channelMatch = targetChannels.length === 0 || targetChannels.includes(ch.channel); if (!channelMatch) return false; const isInSale = ch.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE; return (targetStatus === '現售' && isInSale) || (targetStatus === '停售' && !isInSale); }); if (hasMatch) results.push(p); });
                break;
        }
        return enrichData(results);
    };
    const enrichData = (data) => { const { channelMap } = StateModule.get(); return data.map((item, index) => { if (item._isErrorRow) return { no: index + 1, planCode: String(item.planCode), shortName: '-', saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, mainStatus: '-', polpln: '...', channels: [], specialReason: '', _isErrorRow: true, }; const channels = channelMap.get(item.planCode) || []; const enrichedItem = { ...item, no: index + 1, polpln: '...', channels: channels, _loadingDetails: true, }; enrichedItem.specialReason = UtilsModule.checkSpecialStatus(enrichedItem); return enrichedItem; }); };
    const getPolplnData = async (planCode, signal) => {
        const { cacheDetail } = StateModule.get();
        if (cacheDetail.has(planCode)) return cacheDetail.get(planCode);
        const extractPolpln = (s) => { if (!s || typeof s !== 'string') return ""; let t = s.trim(); if (t.endsWith("%%")) t = t.substring(0, t.length - 2); return t.replace(/^\d+/, "").replace(/\d+$/, "").trim() || ""; };
        const detail = await ApiModule.callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL }, signal);
        const records = (detail.records || []).map(r => extractPolpln(r.polpln)).filter(Boolean);
        if (records.length === 0) { cacheDetail.set(planCode, "無資料"); return "無資料"; }
        const first = records[0];
        const result = records.every(p => p === first) ? first : "-";
        cacheDetail.set(planCode, result);
        return result;
    };
    const sortData = (data, key, asc) => { if (!key || key === 'no') return data; return [...data].sort((a, b) => { let valA = a[key], valB = b[key]; if (key.toLowerCase().includes('date')) { valA = a['raw' + key.charAt(0).toUpperCase() + key.slice(1)]; valB = b['raw' + key.charAt(0).toUpperCase() + key.slice(1)]; } if (valA < valB) return asc ? -1 : 1; if (valA > valB) return asc ? 1 : -1; return 0; }); };
    return { fetchAllBaseData, queryLocalData, getPolplnData, sortData };
  })();

  /**
   * 主控制器模組
   */
  const ControllerModule = (() => {
    
    const initialize = async () => {
      UIModule.injectStyle();
      EventModule.setupGlobalKeyListener();
      const storedToken = [localStorage.getItem('SSO-TOKEN'), sessionStorage.getItem('SSO-TOKEN'), localStorage.getItem('euisToken'), sessionStorage.getItem('euisToken')].find(t => t && t.trim() !== 'null' && t.trim() !== '');
      if (storedToken) {
        StateModule.set({ token: storedToken, tokenCheckEnabled: true });
        UIModule.Toast.show('正在自動驗證 Token...', 'info', 2000);
        if (await ApiModule.verifyToken(storedToken)) {
          UIModule.Toast.show('Token 驗證成功', 'success');
          proceedToQueryScreen();
        } else {
          UIModule.Toast.show('自動驗證失敗，請手動輸入', 'warning');
          StateModule.set({ token: '' });
          showTokenDialog();
        }
      } else {
        showTokenDialog();
      }
    };
    
    // 【修改】新的初始化流程
    const proceedToQueryScreen = () => {
        // 1. 立即顯示查詢畫面給使用者
        showQueryDialog();
        // 2. 在背景開始執行「無感」的資料預載
        startSilentPreload();
    };

    const startSilentPreload = () => {
        const controller = new AbortController();
        StateModule.set({ currentQueryController: controller, isPreloading: true });

        const preloadPromise = DataModule.fetchAllBaseData(controller.signal)
            .then(() => {
                UIModule.Toast.show('背景資料已就緒', 'success', 2000);
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("背景預載資料失敗:", error);
                    UIModule.Toast.show(`背景資料載入失敗: ${error.message}`, 'error', 5000);
                }
            })
            .finally(() => {
                StateModule.set({ isPreloading: false, currentQueryController: null });
            });
        
        // 將 promise 存入 state，以便後續等待
        StateModule.set({ preloadPromise });
    };
    
    const showTokenDialog = () => {
        const { env } = StateModule.get();
        const modalContent = [ UIModule.createElement('div', { className: 'pct-modal-header', textContent: `設定 Token (${env})` }), UIModule.createElement('button', { className: 'pct-modal-close-btn', textContent: '×' }), UIModule.createElement('div', { className: 'pct-modal-body', children: [ UIModule.createElement('div', { className: 'pct-form-group', children: [ UIModule.createElement('label', { htmlFor: 'pct-token-input', textContent: '請貼上您的 SSO-TOKEN 或 euisToken：' }), UIModule.createElement('textarea', { id: 'pct-token-input', className: 'pct-input', rows: 4, placeholder: '(使用者在此貼上 Token...)' }), UIModule.createElement('span', { id: 'token-error', className: 'pct-error' }) ] }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer', children: [ UIModule.createElement('div', { className: 'pct-modal-footer-left' }), UIModule.createElement('div', { className: 'pct-modal-footer-right', children: [ UIModule.createElement('button', { id: 'pct-skip-verification', className: 'pct-btn pct-btn-outline', textContent: '略過' }), UIModule.createElement('button', { id: 'pct-verify-token', className: 'pct-btn', textContent: '驗證並初始化' }) ] }) ] }) ];
        UIModule.Modal.show(modalContent, (modal) => {
            modal.setAttribute('data-size', 'query');
            const tokenInput = document.getElementById('pct-token-input');
            const verifyBtn = document.getElementById('pct-verify-token');
            const skipBtn = document.getElementById('pct-skip-verification');
            const handleVerifyToken = async () => { const token = tokenInput.value.trim(); if (!token) { UIModule.showError('請輸入 Token', 'token-error'); return; } UIModule.hideError('token-error'); verifyBtn.disabled = true; verifyBtn.textContent = '驗證中...'; try { if (await ApiModule.verifyToken(token)) { StateModule.set({ token }); UIModule.Toast.show('Token 驗證成功', 'success'); proceedToQueryScreen(); } else { UIModule.showError('Token 驗證失敗，請檢查後重試', 'token-error'); } } catch (error) { UIModule.showError(`驗證過程中發生錯誤: ${error.message}`, 'token-error'); } finally { verifyBtn.disabled = false; verifyBtn.textContent = '驗證並初始化'; } };
            const handleSkipVerification = () => { const token = tokenInput.value.trim(); StateModule.set({ token, tokenCheckEnabled: false }); UIModule.Toast.show('已略過驗證', 'warning'); proceedToQueryScreen(); };
            verifyBtn.onclick = handleVerifyToken; skipBtn.onclick = handleSkipVerification; tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) handleVerifyToken(); });
        });
    };

    const showQueryDialog = () => {
        StateModule.resetQueryState();
        const { env, lastQuery } = StateModule.get();
        const modalContent = [ UIModule.createElement('div', { className: 'pct-modal-header', textContent: `選擇查詢條件 (${env})` }), UIModule.createElement('button', { className: 'pct-modal-close-btn', textContent: '×' }), UIModule.createElement('div', { className: 'pct-modal-body', children: [ UIModule.createElement('div', { className: 'pct-form-group', children: [ UIModule.createElement('label', { textContent: '查詢模式:' }), UIModule.createElement('div', { className: 'pct-mode-card-grid', children: [ UIModule.createElement('div', { className: 'pct-mode-card', textContent: '商品代號', dataset: { mode: ConfigModule.QUERY_MODES.PLAN_CODE } }), UIModule.createElement('div', { className: 'pct-mode-card', textContent: '商品名稱', dataset: { mode: ConfigModule.QUERY_MODES.PLAN_NAME } }), UIModule.createElement('div', { className: 'pct-mode-card', textContent: '商品銷售時間', dataset: { mode: ConfigModule.QUERY_MODES.MASTER_CLASSIFIED } }), UIModule.createElement('div', { className: 'pct-mode-card', textContent: '通路銷售時間', dataset: { mode: ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED } }) ] }), UIModule.createElement('div', { id: 'pct-dynamic-options', style: { display: 'none' } }), UIModule.createElement('span', { id: 'query-error', className: 'pct-error' }) ] }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer', children: [ UIModule.createElement('div', { className: 'pct-modal-footer-left', children: [ UIModule.createElement('button', { id: 'pct-change-token', className: 'pct-btn pct-btn-outline', textContent: '修改 Token' }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer-right', children: [ UIModule.createElement('button', { id: 'pct-start-query', className: 'pct-btn', textContent: '開始查詢', disabled: true }) ] }) ] }) ];
        UIModule.Modal.show(modalContent, (modal) => {
            modal.setAttribute('data-size', 'query');
            const modeCards = modal.querySelectorAll('.pct-mode-card');
            const dynamicOptions = document.getElementById('pct-dynamic-options');
            const startQueryBtn = document.getElementById('pct-start-query');
            const updateDynamicOptions = (mode) => {
                let contentElements = []; dynamicOptions.innerHTML = '';
                const lastInput = (mode === ConfigModule.QUERY_MODES.PLAN_CODE || mode === ConfigModule.QUERY_MODES.PLAN_NAME) ? lastQuery.queryInput : '';
                switch (mode) {
                    case ConfigModule.QUERY_MODES.PLAN_CODE: contentElements = [ UIModule.createElement('label', { htmlFor: 'pct-query-input', textContent: '商品代碼：(多筆可用空格、逗號或換行分隔)' }), UIModule.createElement('textarea', { id: 'pct-query-input', className: 'pct-input', rows: 4, value: lastInput }) ]; break;
                    case ConfigModule.QUERY_MODES.PLAN_NAME: contentElements = [ UIModule.createElement('label', { htmlFor: 'pct-query-input', textContent: '商品名稱關鍵字：' }), UIModule.createElement('input', { type: 'text', id: 'pct-query-input', className: 'pct-input', value: lastInput }) ]; break;
                    case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: contentElements = [ UIModule.createElement('label', { textContent: '主約銷售狀態：' }), UIModule.createElement('div', { className: 'pct-sub-option-grid', children: Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s => UIModule.createElement('div', { className: `pct-sub-option ${lastQuery.masterStatusSelection.has(s) ? 'selected' : ''}`, textContent: s, dataset: { status: s } })) }) ]; break;
                    case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: contentElements = [ UIModule.createElement('label', { textContent: '選擇通路：(可多選，不選代表全部)' }), UIModule.createElement('div', { className: 'pct-channel-option-grid', children: ConfigModule.FIELD_MAPS.CHANNELS.map(ch => UIModule.createElement('div', { className: `pct-channel-option ${lastQuery.channelSelection.has(ch) ? 'selected' : ''}`, textContent: ch, dataset: { channel: ch } })) }), UIModule.createElement('label', { textContent: '銷售範圍：', style: { marginTop: '10px' }}), UIModule.createElement('div', { className: 'pct-sub-option-grid', children: ['現售', '停售'].map(range => UIModule.createElement('div', { className: `pct-sub-option ${lastQuery.channelStatusSelection === range ? 'selected' : ''}`, textContent: `${range}商品`, dataset: { range: range } })) }) ]; break;
                }
                if (contentElements.length > 0) { contentElements.forEach(el => dynamicOptions.appendChild(el)); dynamicOptions.style.display = 'block'; bindDynamicEvents(); } else { dynamicOptions.style.display = 'none'; }
                checkCanStartQuery();
            };
            const bindDynamicEvents = () => {
                document.querySelectorAll('.pct-sub-option[data-status]').forEach(o => o.onclick = () => { o.classList.toggle('selected'); updateMasterStatusSelection(); checkCanStartQuery(); });
                document.querySelectorAll('.pct-channel-option').forEach(o => o.onclick = () => { o.classList.toggle('selected'); updateChannelSelection(); checkCanStartQuery(); });
                document.querySelectorAll('.pct-sub-option[data-range]').forEach(o => o.onclick = () => { const current = o.classList.contains('selected'); document.querySelectorAll('.pct-sub-option[data-range]').forEach(el => el.classList.remove('selected')); if (!current) { o.classList.add('selected'); StateModule.set({ channelStatusSelection: o.dataset.range }); } else { StateModule.set({ channelStatusSelection: '' }); } checkCanStartQuery(); });
                const input = document.getElementById('pct-query-input'); if (input) { input.addEventListener('input', EventModule.autoFormatInput); input.addEventListener('input', checkCanStartQuery); }
            };
            const updateMasterStatusSelection = () => { const s = new Set(); document.querySelectorAll('.pct-sub-option[data-status].selected').forEach(o => s.add(o.dataset.status)); StateModule.set({ masterStatusSelection: s }); };
            const updateChannelSelection = () => { const s = new Set(); document.querySelectorAll('.pct-channel-option.selected').forEach(o => s.add(o.dataset.channel)); StateModule.set({ channelSelection: s }); };
            const checkCanStartQuery = () => { const state = StateModule.get(); let canStart = false; switch (state.queryMode) { case ConfigModule.QUERY_MODES.PLAN_CODE: case ConfigModule.QUERY_MODES.PLAN_NAME: const i = document.getElementById('pct-query-input'); canStart = i && i.value.trim() !== ''; break; case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: canStart = state.masterStatusSelection.size > 0; break; case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: canStart = state.channelStatusSelection !== ''; break; } startQueryBtn.disabled = !canStart; };
            modeCards.forEach(card => card.onclick = () => { const currentScrollTop = modal.querySelector('.pct-modal-body').scrollTop; modeCards.forEach(c => c.classList.remove('selected')); card.classList.add('selected'); const mode = card.dataset.mode; StateModule.set({ queryMode: mode }); updateDynamicOptions(mode); modal.querySelector('.pct-modal-body').scrollTop = currentScrollTop; });
            if (lastQuery.queryMode) { modal.querySelector(`.pct-mode-card[data-mode="${lastQuery.queryMode}"]`)?.click(); }
            document.getElementById('pct-change-token').onclick = showTokenDialog;
            startQueryBtn.onclick = handleStartQuery;
        });
    };
    
    // 【修改】查詢處理流程，增加等待機制
    const handleStartQuery = async () => {
        const startQueryBtn = document.getElementById('pct-start-query');
        const originalText = startQueryBtn.textContent;
        UIModule.hideError('query-error');
        
        const { isPreloading, preloadPromise } = StateModule.get();
        
        // 如果背景正在預載，則等待它完成
        if (isPreloading && preloadPromise) {
            startQueryBtn.disabled = true;
            startQueryBtn.textContent = '準備資料中...';
            await preloadPromise;
            startQueryBtn.textContent = originalText;
            startQueryBtn.disabled = false;
        }
        
        // 保存本次查詢條件
        StateModule.backupQuery();

        const results = DataModule.queryLocalData();
        StateModule.set({ currentResults: results });
        showResultsDialog();
    };

    // ... showResultsDialog 和其餘函式保持不變 ...
    const showResultsDialog = () => {
        const state = StateModule.get(); const totalCount = state.currentResults.length;
        const modalContent = [ UIModule.createElement('div', { className: 'pct-modal-header', textContent: `查詢結果 (${state.env})` }), UIModule.createElement('button', { className: 'pct-modal-close-btn', textContent: '×' }), UIModule.createElement('div', { className: 'pct-modal-body', children: [ UIModule.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' }, children: [ UIModule.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }, children: [ UIModule.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [ UIModule.createElement('span', { style: { fontSize: '14px', color: '#666' }, textContent: '搜尋:' }), UIModule.createElement('input', { type: 'text', id: 'pct-search-input', style: { padding: '4px 8px', border: '1px solid #ddd', borderRadius: '4px', width: '200px', fontSize: '13px' } }) ] }), UIModule.createElement('button', { id: 'pct-load-all-details', className: 'pct-btn pct-btn-outline', textContent: '載入全部 POLPLN', style: { padding: '5px 12px', fontSize: '14px' } }), UIModule.createElement('div', { id: 'pct-status-filters', style: { display: 'flex', gap: '5px' } }) ] }), UIModule.createElement('div', { className: 'pct-table-wrap', children: [ UIModule.createElement('table', { className: 'pct-table', children: [ UIModule.createElement('thead', { children: [ UIModule.createElement('tr', { children: [ UIModule.createElement('th', { dataset: { key: 'no' }, textContent: 'No' }), UIModule.createElement('th', { dataset: { key: 'planCode' }, textContent: '代號' }), UIModule.createElement('th', { dataset: { key: 'shortName' }, textContent: '名稱' }), UIModule.createElement('th', { dataset: { key: 'currency' }, textContent: '幣別' }), UIModule.createElement('th', { dataset: { key: 'unit' }, textContent: '單位' }), UIModule.createElement('th', { dataset: { key: 'coverageType' }, textContent: '類型' }), UIModule.createElement('th', { dataset: { key: 'saleStartDate' }, textContent: '主約銷售日' }), UIModule.createElement('th', { dataset: { key: 'saleEndDate' }, textContent: '主約停賣日' }), UIModule.createElement('th', { dataset: { key: 'mainStatus' }, textContent: '險種狀態' }), UIModule.createElement('th', { dataset: { key: 'polpln' }, textContent: '商品名稱(POLPLN)' }), UIModule.createElement('th', { textContent: '銷售通路' }), ] }) ] }), UIModule.createElement('tbody', { id: 'pct-table-body' }) ] }) ] }) ] }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer', children: [ UIModule.createElement('div', { className: 'pct-modal-footer-left', children: [ UIModule.createElement('button', { id: 'pct-toggle-view', className: 'pct-btn pct-btn-outline', textContent: '一頁顯示' }), UIModule.createElement('button', { id: 'pct-filter-special', className: 'pct-btn pct-btn-outline', textContent: '篩選特殊' }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer-center', children: [ UIModule.createElement('div', { className: 'pct-pagination', children: [ UIModule.createElement('button', { id: 'pct-prev-page', className: 'pct-btn pct-btn-outline', textContent: '◀' }), UIModule.createElement('span', { id: 'pct-page-info', className: 'pct-pagination-info' }), UIModule.createElement('button', { id: 'pct-next-page', className: 'pct-btn pct-btn-outline', textContent: '▶' }) ] }) ] }), UIModule.createElement('div', { className: 'pct-modal-footer-right', children: [ UIModule.createElement('button', { id: 'pct-copy-all', className: 'pct-btn pct-btn-secondary', textContent: '一鍵複製' }), UIModule.createElement('button', { id: 'pct-back-to-query', className: 'pct-btn', textContent: '重新查詢' }) ] }) ] }) ];
        UIModule.Modal.show(modalContent, (modal) => {
            modal.setAttribute('data-size', 'results'); modal.classList.add('pct-view-results');
            setupResultsDialog(modal); rerenderTable();
            UIModule.Toast.show(`查詢完成，共找到 ${totalCount} 筆資料`, 'success');
            document.dispatchEvent(new CustomEvent('pct:resultsShown'));
        });
    };
    const setupResultsDialog = (modal) => {
        modal.addEventListener('click', (e) => {
            const target = e.target; const row = target.closest('tr'); const planCode = row?.dataset.plancode;
            if (target.id === 'pct-load-all-details') loadAllDetailsInBatches();
            else if (target.id === 'pct-toggle-view') handleToggleView(target);
            else if (target.id === 'pct-filter-special') handleFilterSpecial(target);
            else if (target.id === 'pct-prev-page') handlePageChange(-1);
            else if (target.id === 'pct-next-page') handlePageChange(1);
            else if (target.id === 'pct-copy-all') copyAllResults();
            else if (target.id === 'pct-back-to-query') showQueryDialog();
            else if (target.closest('th[data-key]')) handleSort(target.closest('th[data-key]'));
            else if (target.matches('.load-details-btn') && planCode) loadSingleDetail(planCode, target);
            else if (target.matches('.clickable-cell') && planCode) { const cellValue = target.textContent.trim(); if (cellValue && cellValue !== '...' && cellValue !== '-') { UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show); } }
        });
        const searchInput = document.getElementById('pct-search-input');
        searchInput.addEventListener('input', () => { clearTimeout(StateModule.get().searchDebounceTimer); const timer = setTimeout(() => { StateModule.set({ searchKeyword: searchInput.value.trim(), pageNo: 1 }); rerenderTable(); }, ConfigModule.DEBOUNCE_DELAY.SEARCH); StateModule.set({ searchDebounceTimer: timer }); });
    };
    const getFilteredData = () => { const state = StateModule.get(); let data = [...state.currentResults]; if (state.searchKeyword) { const keyword = state.searchKeyword.toLowerCase(); data = data.filter(item => Object.values(item).some(value => String(value).toLowerCase().includes(keyword))); } if (state.filterSpecial) { data = data.filter(item => item.specialReason && item.specialReason.trim() !== ''); } data = DataModule.sortData(data, state.sortKey, state.sortAsc); return data; };
    const rerenderTable = () => { const state = StateModule.get(); const filteredData = getFilteredData(); const totalItems = filteredData.length; let displayData = state.isFullView ? filteredData : filteredData.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize); const tableBody = document.getElementById('pct-table-body'); if (tableBody) { tableBody.innerHTML = ''; displayData.forEach(item => tableBody.appendChild(renderTableRow(item))); } updateSortIndicators(); updatePaginationInfo(totalItems); };
    const renderTableRow = (item) => { const tr = UIModule.createElement('tr', { className: `${item.specialReason ? 'special-row' : ''}`, dataset: { plancode: item.planCode }, title: item.specialReason ? UtilsModule.escapeHtml(item.specialReason) : '' }); const renderStatusPill = (status) => `<span class="clickable-cell" style="display:inline-block;min-width:80px;text-align:center;padding:2px 6px;background:#f0f0f0;border-radius:12px;font-size:11px;">${status}</span>`; const renderPolplnCell = (item) => { if (item._loadingDetails) return UIModule.createElement('button', { className: 'load-details-btn', textContent: '載入' }); if (item.polplnError) return UIModule.createElement('span', { className: 'load-details-error', textContent: '載入失敗', title: item.polplnError }); return UIModule.createElement('span', { className: 'clickable-cell', textContent: UtilsModule.escapeHtml(item.polpln) }); }; const renderChannelsCell = (channels) => { if (!channels || channels.length === 0) return '-'; const active = channels.filter(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE).sort((a,b) => a.channel.localeCompare(b.channel)); const inactive = channels.filter(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE).sort((a,b) => a.channel.localeCompare(b.channel)); const activeHTML = active.map(c => `<span class="pct-channel-insale" title="${c.channel} (${c.status}): ${c.saleStartDate}-${c.saleEndDate}">${c.channel}</span>`).join(' '); const inactiveHTML = inactive.map(c => `<span class="pct-channel-offsale" title="${c.channel} (${c.status}): ${c.saleStartDate}-${c.saleEndDate}">${c.channel}</span>`).join(' '); return activeHTML + (active.length > 0 && inactive.length > 0 ? '<span class="pct-channel-separator">|</span>' : '') + inactiveHTML; }; tr.innerHTML = `<td class="clickable-cell">${item.no}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td><td class="clickable-cell" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${UtilsModule.escapeHtml(item.shortName)}">${UtilsModule.escapeHtml(item.shortName)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td><td>${renderStatusPill(item.mainStatus)}</td><td></td><td>${renderChannelsCell(item.channels)}</td>`; tr.children[9].appendChild(renderPolplnCell(item)); return tr; };
    const handleToggleView = (btn) => { const state = StateModule.get(); StateModule.set({ isFullView: !state.isFullView, pageNo: 1 }); btn.textContent = StateModule.get().isFullView ? '分頁顯示' : '一頁顯示'; rerenderTable(); };
    const handleFilterSpecial = (btn) => { const state = StateModule.get(); StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); btn.classList.toggle('pct-btn-primary', StateModule.get().filterSpecial); rerenderTable(); };
    const handlePageChange = (delta) => { const state = StateModule.get(); const filteredData = getFilteredData(); const maxPage = Math.ceil(filteredData.length / state.pageSize); const newPage = state.pageNo + delta; if (newPage >= 1 && newPage <= maxPage) { StateModule.set({ pageNo: newPage }); rerenderTable(); } };
    const handleSort = (th) => { const key = th.dataset.key; const state = StateModule.get(); if (state.sortKey === key) { StateModule.set({ sortAsc: !state.sortAsc }); } else { StateModule.set({ sortKey: key, sortAsc: true }); } rerenderTable(); };
    const updateSortIndicators = () => { const state = StateModule.get(); document.querySelectorAll('th[data-key]').forEach(th => { th.classList.remove('sort-asc', 'sort-desc'); if (th.dataset.key === state.sortKey) { th.classList.add(state.sortAsc ? 'sort-asc' : 'sort-desc'); } }); };
    const updatePaginationInfo = (totalItems) => { const state = StateModule.get(); const pageInfo = document.getElementById('pct-page-info'); const prevBtn = document.getElementById('pct-prev-page'); const nextBtn = document.getElementById('pct-next-page'); if (state.isFullView) { pageInfo.textContent = `全部 ${totalItems} 筆`; prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; } else { const maxPage = Math.ceil(totalItems / state.pageSize) || 1; pageInfo.textContent = `${state.pageNo} / ${maxPage}`; prevBtn.style.display = 'inline-flex'; nextBtn.style.display = 'inline-flex'; prevBtn.disabled = state.pageNo <= 1; nextBtn.disabled = state.pageNo >= maxPage; } };
    const loadSingleDetail = async (planCode, btn) => { const item = StateModule.get().currentResults.find(d => d.planCode === planCode); if (!item || !item._loadingDetails) return; btn.textContent = '載入中...'; btn.disabled = true; const controller = new AbortController(); try { const polpln = await DataModule.getPolplnData(planCode, controller.signal); item.polpln = polpln; } catch (error) { if (error.name !== 'AbortError') { item.polplnError = error.message; UIModule.Toast.show(`載入 POLPLN 失敗: ${error.message}`, 'error'); } } finally { item._loadingDetails = false; rerenderTable(); } };
    const loadAllDetailsInBatches = async () => { const state = StateModule.get(); const itemsToLoad = state.currentResults.filter(item => item._loadingDetails && !item._isErrorRow); if (itemsToLoad.length === 0) { UIModule.Toast.show('所有 POLPLN 資料均已載入', 'info'); return; } const BATCH_SIZE = ConfigModule.BATCH_SIZES.DETAIL_LOAD; const controller = new AbortController(); StateModule.set({ currentQueryController: controller }); UIModule.Toast.show(`開始批次載入 ${itemsToLoad.length} 筆 POLPLN...`, 'info'); try { for (let i = 0; i < itemsToLoad.length; i += BATCH_SIZE) { const batch = itemsToLoad.slice(i, i + BATCH_SIZE); await Promise.all(batch.map(async item => { try { item.polpln = await DataModule.getPolplnData(item.planCode, controller.signal); } catch (err) { item.polplnError = err.message; } finally { item._loadingDetails = false; } })); rerenderTable(); if (i + BATCH_SIZE < itemsToLoad.length) { await new Promise(resolve => setTimeout(resolve, 200)); } } UIModule.Toast.show('POLPLN 批次載入完成', 'success'); } catch (error) { if (error.name !== 'AbortError') { console.error("POLPLN 批次載入失敗:", error); UIModule.Toast.show(`批次載入失敗: ${error.message}`, 'error'); } } finally { StateModule.set({ currentQueryController: null }); } };
    const copyAllResults = () => { const filteredData = getFilteredData(); if (filteredData.length === 0) { UIModule.Toast.show('無資料可複製', 'warning'); return; } const headers = ['No', '代號', '名稱', '幣別', '單位', '類型', '主約銷售日', '主約停賣日', '險種狀態', '商品名稱(POLPLN)', '銷售通路']; const rows = filteredData.map(item => [item.no, item.planCode, item.shortName, item.currency, item.unit, item.coverageType, item.saleStartDate, item.saleEndDate, item.mainStatus, item.polpln, item.channels.map(ch => ch.channel).join(' ')]); const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n'); UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show); };
    return { initialize, showTokenDialog, showQueryDialog, showResultsDialog, rerenderTable };
  })();

  /**
   * 工具初始化入口
   */
  const initializeTool = () => {
    try {
      document.addEventListener('pct:resultsShown', () => {
          setTimeout(() => {
              const itemsToLoad = StateModule.get().currentResults.filter(item => item._loadingDetails && !item._isErrorRow);
              if (itemsToLoad.length > 50) { UIModule.Toast.show(`發現 ${itemsToLoad.length} 筆 POLPLN 待載入，建議手動點擊按鈕載入。`, 'info', 5000);
              } else if (itemsToLoad.length > 0) {
                // 自動觸發批次載入
                const loadBtn = document.getElementById('pct-load-all-details');
                if(loadBtn) loadBtn.click();
              }
          }, 1000);
      }, { once: true });
      ControllerModule.initialize();
    } catch (error) {
      console.error('工具初始化失敗:', error);
      alert(`工具初始化失敗: ${error.message}`);
    }
  };

  // 啟動工具
  initializeTool();

})();
