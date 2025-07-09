javascript:(function() {
  'use strict';

  /**
   * ===================================================================
   * 商品查詢小工具 v10.0.0 (最終完美版)
   *
   * - [UI/UX 優化] 根據您的最新需求進行全面調整：
   * 1.  調整所有相關名詞 (e.g., "選擇查詢條件")。
   * 2.  為「商品銷售時間」下的狀態牌卡設定指定顏色。
   * 3.  新增「返回上一頁」按鈕，方便隨時修改 Token。
   * 4.  將查詢結果的標題置中顯示。
   * - [風格還原] UI/CSS 完全基於您最滿意的 v6.0.0 版本風格。
   * - [功能完整] 包含所有新舊功能，並解決了破版問題。
   * ===================================================================
   */

  // 清理舊工具實例
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  /**
   * ========== 模組 1：配置管理 (ConfigModule) ==========
   */
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '10.0.0-Final',
    QUERY_MODES: {
      PLAN_CODE: 'planCode',
      PLAN_NAME: 'planCodeName',
      MASTER_CLASSIFIED: 'masterClassified', // 商品銷售時間
      CHANNEL_CLASSIFIED: 'channelClassified' // 通路銷售時間
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
    DEFAULT_QUERY_PARAMS: { PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 5000, PAGE_SIZE_DETAIL: 50, PAGE_SIZE_TABLE: 50 },
    DEBOUNCE_DELAY: { SEARCH: 800 },
    BATCH_SIZES: { MULTI_CODE_QUERY: 10, DETAIL_LOAD: 20 }
  });

  /**
   * ========== 模組 2：狀態管理 (StateModule) ==========
   */
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '', token: '', tokenSource: 'none', // 'none', 'stored', 'manual'
      queryMode: '', queryInput: '', masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set(),
      allProcessedData: [], pageNo: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false, filterSpecial: false, searchKeyword: '', sortKey: 'no', sortAsc: true,
      activeFrontendFilters: new Set(),
      cacheDetail: new Map(), cacheChannel: new Map(),
      currentQueryController: null, searchDebounceTimer: null
    };
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    const resetQueryState = () => {
      set({ allProcessedData: [], pageNo: 1, filterSpecial: false, searchKeyword: '', isFullView: false, activeFrontendFilters: new Set() });
      state.cacheDetail.clear(); state.cacheChannel.clear();
    };
    return { get, set, resetQueryState };
  })();

  /**
   * ========== 模組 3：通用工具函式庫 (UtilsModule) ==========
   */
  const UtilsModule = (() => {
    const escapeHtml = t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t;
    const formatToday = () => { const d = new Date(); return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`; };
    const formatDateForUI = dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
    const formatDateForComparison = dt => { if (!dt) return ''; const p = String(dt).split(' ')[0]; return /^\d{8}$/.test(p) ? p.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : p; };
    const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
        if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        const today = new Date(formatDateForComparison(todayStr)), sS = new Date(formatDateForComparison(saleStartStr)), sE = new Date(formatDateForComparison(saleEndStr));
        if (isNaN(today.getTime()) || isNaN(sS.getTime()) || isNaN(sE.getTime())) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        if (sS.getTime() > sE.getTime()) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        if (today < sS) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
        if (today > sE) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
        return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
    };
    const checkSpecialStatus = item => {
        const todayStr = formatToday(); const mainStatus = item.mainStatus; const channels = item.channels || []; const reasons = [];
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.STOPPED && channels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約已停售，但部分通路仍在售。'); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.IN_SALE && channels.length > 0 && channels.every(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約為現售，但所有通路皆非現售狀態。'); }
        const mainEndDate = new Date(formatDateForComparison(item.rawSaleEndDate)), mainStartDate = new Date(formatDateForComparison(item.rawSaleStartDate));
        if (!isNaN(mainEndDate.getTime())) { channels.forEach(c => { const channelEndDate = new Date(formatDateForComparison(c.rawEnd)); if (!isNaN(channelEndDate.getTime()) && channelEndDate > mainEndDate) { reasons.push(`通路[${c.channel}]迄日(${c.saleEndDate})晚於主約迄日(${item.saleEndDate})。`); } }); }
        if (!isNaN(mainStartDate.getTime())) { channels.forEach(c => { const channelStartDate = new Date(formatDateForComparison(c.rawStart)); if (!isNaN(channelStartDate.getTime()) && channelStartDate < mainStartDate) { reasons.push(`通路[${c.channel}]起日(${c.saleStartDate})早於主約起日(${item.saleStartDate})。`); } }); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL) { reasons.push('主約本身的銷售起迄日期異常(起日>迄日)。'); }
        return reasons.join('\n');
    };
    const channelUIToAPI = c => c === 'BK' ? 'OT' : c, channelAPIToUI = c => c === 'OT' ? 'BK' : c;
    const currencyConvert = v => ConfigModule.FIELD_MAPS.CURRENCY[String(v)] || v || '', unitConvert = v => ConfigModule.FIELD_MAPS.UNIT[String(v)] || v || '', coverageTypeConvert = v => ConfigModule.FIELD_MAPS.COVERAGE_TYPE[String(v)] || v || '';
    const copyTextToClipboard = (t, showToast) => { if (!navigator.clipboard) { const e = document.createElement('textarea'); e.value = t; document.body.appendChild(e); e.select(); document.execCommand('copy'); document.body.removeChild(e); showToast('已複製 (舊版)', 'success'); } else { navigator.clipboard.writeText(t).then(() => showToast('已複製', 'success')).catch(() => showToast('複製失敗', 'error')); } };
    const splitInput = i => i.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
    return { escapeHtml, formatToday, formatDateForUI, formatDateForComparison, getSaleStatus, checkSpecialStatus, channelUIToAPI, channelAPIToUI, currencyConvert, unitConvert, coverageTypeConvert, copyTextToClipboard, splitInput };
  })();

  /**
   * ========== 模組 4：UI 介面管理器 (UIModule) ==========
   */
  const UIModule = (() => {
    const injectStyle = () => {
      const s = document.createElement('style'); s.id = ConfigModule.STYLE_ID;
      s.textContent = `
        :root{--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#5CB85C;--success-dark-color:#4CAE4C;--error-color:#D9534F;--error-dark-color:#C9302C;--warning-color:#F0AD4E;--warning-dark-color:#EC971F;--info-color:#5BC0DE;--info-dark-color:#46B8DA;--background-light:#F8F8F8;--surface-color:#FFFFFF;--border-color:#E0E0E0;--text-color-dark:#1a1a1a;--text-color-light:#333333;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;}
        .pct-modal-mask{position:fixed;z-index:2147483646;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);opacity:0;transition:opacity var(--transition-speed) ease-out;}
        .pct-modal-mask.show{opacity:1;}
        .pct-modal{font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
        .pct-modal[data-size="query"] { width: 520px; }
        .pct-modal[data-size="results"] { width: 1200px; }
        .pct-modal.show{opacity:1;transform:translateX(-50%) translateY(0);}
        .pct-modal.dragging{transition:none;}
        .pct-modal-header{display:flex;justify-content:center;align-items:center;padding:16px 20px 8px 20px;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;position:relative;}
        .pct-modal-header.dragging{cursor:grabbing;}
        .pct-modal-close-btn{position:absolute;top:50%;right:15px;transform:translateY(-50%);background:transparent;border:none;font-size:24px;line-height:1;color:var(--secondary-color);cursor:pointer;padding:5px;width:34px;height:34px;border-radius:50%;transition:background-color .2s, color .2s;display:flex;align-items:center;justify-content:center;}
        .pct-modal-close-btn:hover{background-color:var(--background-light);color:var(--text-color-dark);}
        .pct-modal-body{padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
        .pct-modal-footer{padding:12px 20px 16px 20px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;}
        .pct-modal-footer-left{display:flex;gap:10px;align-items:center;}
        .pct-modal-footer-right{display:flex;gap:10px;align-items:center;}
        .pct-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:none;background:var(--primary-color);color:#fff;cursor:pointer;transition:background var(--transition-speed),transform var(--transition-speed),box-shadow var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap;}
        .pct-btn:hover{background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);}
        .pct-btn:disabled{background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;}
        .pct-btn-secondary{background:var(--secondary-color);} .pct-btn-secondary:hover{background:var(--secondary-dark-color);}
        .pct-btn-info{background:var(--info-color);} .pct-btn-info:hover{background:var(--info-dark-color);}
        .pct-btn-success{background:var(--success-color);} .pct-btn-success:hover{background:var(--success-dark-color);}
        .pct-filter-btn{font-size:14px;padding:5px 12px;background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);border-radius:5px;cursor:pointer;font-weight:600;white-space:nowrap;}
        .pct-filter-btn.active{background:var(--warning-dark-color);color:white;}
        .pct-input{width:100%;font-size:16px;padding:9px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;margin-top:5px;}
        .pct-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
        .pct-error{color:var(--error-color);font-size:13px;margin:8px 0 0 0;display:block;}
        .pct-form-group{margin-bottom:20px;}
        .pct-mode-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;}
        .pct-mode-card{background:var(--background-light);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:18px 10px;text-align:center;cursor:pointer;transition:all .2s ease-out;font-weight:500;font-size:15px;display:flex;align-items:center;justify-content:center;min-height:65px;}
        .pct-mode-card.selected{background:var(--primary-color);color:white;border-color:var(--primary-color);font-weight:bold;}
        .pct-status-card { color: white; }
        .pct-status-card.insale { background-color: var(--success-color); } .pct-status-card.insale:hover { background-color: var(--success-dark-color); }
        .pct-status-card.stopped { background-color: var(--info-color); } .pct-status-card.stopped:hover { background-color: var(--info-dark-color); }
        .pct-status-card.pending { background-color: var(--secondary-color); } .pct-status-card.pending:hover { background-color: var(--secondary-dark-color); }
        .pct-status-card.abnormal { background-color: var(--warning-color); color: var(--text-color-dark); } .pct-status-card.abnormal:hover { background-color: var(--warning-dark-color); }
        .pct-sub-option-grid,.pct-channel-option-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;}
        .pct-sub-option,.pct-channel-option{background:var(--background-light);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:8px 15px;cursor:pointer;transition:all .2s ease-out;font-weight:500;}
        .pct-sub-option.selected,.pct-channel-option.selected{background:var(--primary-color);color:white;border-color:var(--primary-color);}
        .pct-table-wrap{max-height:60vh;overflow:auto;margin:15px 0;}
        .pct-table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface-color);min-width:1200px;}
        .pct-table th, .pct-table td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top;}
        .pct-table th{background:#f8f8f8;position:sticky;top:0;z-index:1;cursor:pointer;}
        .pct-table th[data-key]:after{content:'';position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:0.3;font-size:12px;transition:opacity 0.2s;border:4px solid transparent;}
        .pct-table th[data-key].sort-asc:after{content:'';border-bottom-color:var(--primary-color);opacity:1;}
        .pct-table th[data-key].sort-desc:after{content:'';border-top-color:var(--primary-color);opacity:1;}
        .pct-table tr.special-row{background:#fffde7;border-left:4px solid var(--warning-color);cursor:help;}
        .pct-table tr:hover{background:#e3f2fd;}
        .pct-table td{cursor:cell;}
        .pct-filter-controls{display:flex;align-items:center;gap:16px;margin-bottom:16px;}
        .pct-search-container{flex:1 1 300px;position:relative;}
        .pct-search-input{width:100%;font-size:14px;padding:8px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;}
        .pct-status-filters{display:flex;gap:10px;}
        .pct-status-filter-btn{font-size:13px;padding:5px 12px !important;flex-shrink:0;}
        .pct-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;}
        .pct-toast.pct-toast-show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
        .pct-toast.success{background:var(--success-color);} .pct-toast.error{background:var(--error-color);} .pct-toast.warning{background:var(--warning-color);color:var(--text-color-dark);} .pct-toast.info{background:var(--info-color);}
        .pct-confirm-toast{display:flex;align-items:center;gap:15px;} .pct-confirm-toast .pct-btn{padding:5px 10px;font-size:14px;}
        .pct-summary{font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:15px;flex-wrap:wrap;}
        .pct-summary b{color:var(--warning-color);}
        .pct-pagination{display:flex;justify-content:center;align-items:center;gap:10px;}
        .pct-pagination-info{font-size:14px;color:var(--text-color-light);}
        .pct-progress-container{display:none;align-items:center;gap:16px;padding:12px;background-color:#f0f8ff;border-radius:var(--border-radius-base);margin-bottom:16px;}
        .pct-progress-bar-wrapper{flex-grow:1;height:10px;background-color:rgba(0,0,0,0.1);border-radius:5px;overflow:hidden;}
        .pct-progress-bar{width:0%;height:100%;background-color:var(--primary-color);transition:width .4s ease-out;border-radius:5px;}
        .pct-progress-text{font-size:14px;color:var(--text-color-dark);white-space:nowrap;}
        .pct-abort-btn{background-color:var(--error-color) !important;color:white !important;padding:5px 14px !important;font-size:14px !important;}
      `; document.head.appendChild(s);
    };
    const Toast = {
      show: (msg, type = 'info', duration = 3000) => { let e = document.getElementById('pct-toast'); if (e) e.remove(); e = document.createElement('div'); e.id = 'pct-toast'; document.body.appendChild(e); e.className = `pct-toast ${type}`; e.textContent = msg; e.classList.add('pct-toast-show'); if (duration > 0) { setTimeout(() => { e.classList.remove('pct-toast-show'); e.addEventListener('transitionend', () => e.remove(), { once: true }); }, duration); } },
      confirm: (msg, onConfirm) => {
        Toast.show('', 'warning', 0);
        const toastEl = document.getElementById('pct-toast');
        toastEl.innerHTML = `<div class="pct-confirm-toast"><span>${msg}</span><button id="pct-confirm-ok" class="pct-btn pct-btn-primary">確認</button><button id="pct-confirm-cancel" class="pct-btn">取消</button></div>`;
        document.getElementById('pct-confirm-ok').onclick = () => { Toast.close(); onConfirm(true); };
        document.getElementById('pct-confirm-cancel').onclick = () => { Toast.close(); onConfirm(false); };
      },
      close: () => { document.getElementById('pct-toast')?.remove(); }
    };
    const Modal = {
      close: () => { document.getElementById(ConfigModule.TOOL_ID)?.remove(); document.getElementById('pctModalMask')?.remove(); StateModule.get().currentQueryController?.abort(); },
      show: (html, onOpen) => { Modal.close(); let mask = document.createElement('div'); mask.id = 'pctModalMask'; mask.className = 'pct-modal-mask'; document.body.appendChild(mask); let modal = document.createElement('div'); modal.id = ConfigModule.TOOL_ID; modal.className = 'pct-modal'; modal.innerHTML = html; document.body.appendChild(modal); setTimeout(() => { mask.classList.add('show'); modal.classList.add('show'); }, 10); modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown); modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close); if (onOpen) setTimeout(() => onOpen(modal), 50); }
    };
    const showError = (msg, elId) => { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.style.display = 'block'; } else { Toast.show(msg, 'error'); } };
    const hideError = (elId) => { const el = document.getElementById(elId); if (el) { el.style.display = 'none'; el.textContent = ''; } };
    const Progress = {
      show: (text) => {
          let p = document.getElementById('pct-progress-container');
          const anchor = document.querySelector('.pct-modal-body');
          if (!p && anchor) {
              p = document.createElement('div');
              p.id = 'pct-progress-container';
              p.className = 'pct-progress-container';
              anchor.prepend(p);
          }
          if(p) {
            p.style.display = 'flex';
            p.innerHTML = `<span class="pct-progress-text">${text}</span><div class="pct-progress-bar-wrapper"><div id="pct-progress-bar" class="pct-progress-bar"></div></div><button id="pct-abort-btn" class="pct-btn pct-abort-btn">中止</button>`;
            document.getElementById('pct-abort-btn').onclick = () => {
                StateModule.get().currentQueryController?.abort();
                Progress.hide();
                UIModule.Toast.show('查詢已中止', 'warning');
            };
          }
      },
      update: (percentage, text) => { const bar = document.getElementById('pct-progress-bar'); if (bar) bar.style.width = `${percentage}%`; const textEl = document.querySelector('.pct-progress-text'); if (textEl && text) textEl.textContent = text; },
      hide: () => { const p = document.getElementById('pct-progress-container'); if(p) p.style.display = 'none'; }
    };

    return { injectStyle, Toast, Modal, showError, hideError, Progress };
  })();

  /**
   * ========== 模組 5：事件管理器 (EventModule) ==========
   */
  const EventModule = (() => {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, modal: null };
    const dragMouseDown = e => { const m = document.getElementById(ConfigModule.TOOL_ID); if (!m || e.target.classList.contains('pct-modal-close-btn')) return; dragState.isDragging = true; dragState.modal = m; dragState.initialX = e.clientX - m.getBoundingClientRect().left; dragState.initialY = e.clientY - m.getBoundingClientRect().top; m.classList.add('dragging'); e.currentTarget.classList.add('dragging'); document.addEventListener('mousemove', elementDrag); document.addEventListener('mouseup', closeDragElement); e.preventDefault(); };
    const elementDrag = e => { if (!dragState.isDragging) return; const { modal, initialX, initialY } = dragState; const cX = e.clientX - initialX, cY = e.clientY - initialY; modal.style.left = `${cX + modal.offsetWidth / 2}px`; modal.style.top = `${cY}px`; e.preventDefault(); };
    const closeDragElement = () => { if (!dragState.isDragging) return; dragState.isDragging = false; const m = dragState.modal; if (m) { m.classList.remove('dragging'); m.querySelector('.pct-modal-header')?.classList.remove('dragging'); } document.removeEventListener('mousemove', elementDrag); document.removeEventListener('mouseup', closeDragElement); };
    const setupGlobalKeyListener = () => { document.addEventListener('keydown', handleEscKey); };
    const removeGlobalKeyListener = () => { document.removeEventListener('keydown', handleEscKey); };
    const handleEscKey = (e) => { if (e.key === 'Escape') { UIModule.Modal.close(); removeGlobalKeyListener(); } };
    return { dragMouseDown, setupGlobalKeyListener };
  })();

  /**
   * ========== 模組 6：API 服務層 (ApiModule) ==========
   */
  const ApiModule = (() => {
    const callApi = async (endpoint, params, signal) => { const { apiBase, token } = StateModule.get(); const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token }, body: JSON.stringify(params), signal: signal }); if (!response.ok) { let errorText = await response.text(); try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || errorJson.error || errorText; } catch (e) { } throw new Error(`API 請求失敗: ${errorText}`); } return response.json(); };
    const verifyToken = async (token) => { try { const res = await ApiModule.callApi('/planCodeController/query', { planCode: '5105', currentPage: 1, pageSize: 1 }, null); return !!res.records; } catch (e) { return false; } };
    return { callApi, verifyToken };
  })();

  /**
   * ========== 模組 7：資料處理與查詢邏輯層 (DataModule) ==========
   */
  const DataModule = (() => {
    const queryMultiplePlanCodes = async (codes, signal, onProgress) => { const BATCH_SIZE = ConfigModule.BATCH_SIZES.MULTI_CODE_QUERY; const allRecords = []; const totalBatches = Math.ceil(codes.length / BATCH_SIZE); for (let i = 0; i < codes.length; i += BATCH_SIZE) { const batch = codes.slice(i, i + BATCH_SIZE); const batchNum = i / BATCH_SIZE + 1; onProgress(batchNum / totalBatches * 100, `批量查詢第 ${batchNum}/${totalBatches} 批...`); const promises = batch.map(async c => { try { const res = await ApiModule.callApi('/planCodeController/query', { planCode: c, currentPage: 1, pageSize: 10 }, signal); return (res.records && res.records.length > 0) ? res.records : [{ planCode: c, _apiStatus: '查無資料', _isErrorRow: true }]; } catch (e) { if (e.name === 'AbortError') throw e; return [{ planCode: c, _apiStatus: '查詢失敗', _isErrorRow: true }]; } }); allRecords.push(...(await Promise.all(promises)).flat()); } return { records: allRecords }; };
    const queryChannelData = async (mode, channels, signal) => { const channelsToQuery = channels.length > 0 ? channels : ConfigModule.FIELD_MAPS.CHANNELS; const query = async (ch, inSale) => { const params = { planCode: "", channel: UtilsModule.channelUIToAPI(ch), saleEndDate: inSale ? "9999-12-31 00:00:00" : "", pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }; const res = await ApiModule.callApi('/planCodeSaleDateController/query', params, signal); return (res.planCodeSaleDates?.records || []).map(r => ({ ...r, channel: UtilsModule.channelAPIToUI(r.channel) })); }; const queryAll = async (chList) => (await Promise.all(chList.map(c => query(c, false)))).flat(); const queryCurrent = async (chList) => (await Promise.all(chList.map(c => query(c, true)))).flat(); if (mode === '停售') { const [all, current] = await Promise.all([queryAll(channelsToQuery), queryCurrent(channelsToQuery)]); const currentSet = new Set(current.map(i => `${i.planCode}_${i.channel}`)); return all.filter(i => !currentSet.has(`${i.planCode}_${i.channel}`)); } else { return await queryCurrent(channelsToQuery); } };
    const processRawDataForTable = (rawData) => { const today = UtilsModule.formatToday(); return rawData.map((item, index) => { if (item._isErrorRow) return { no: index + 1, planCode: item.planCode || '-', shortName: '-', currency: '-', unit: '-', coverageType: '-', saleStartDate: '-', rawSaleStartDate: null, saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, rawSaleEndDate: null, mainStatus: '-', polpln: '...', channels: [], specialReason: '', _isErrorRow: true, _loading: false }; return { no: index + 1, planCode: item.planCode || '-', shortName: item.shortName || item.planName || '-', currency: UtilsModule.currencyConvert(item.currency || item.cur), unit: UtilsModule.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit), coverageType: UtilsModule.coverageTypeConvert(item.coverageType || item.type), saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate), rawSaleStartDate: item.saleStartDate, saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate), rawSaleEndDate: item.saleEndDate, mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate), polpln: '...', channels: [], specialReason: '', _isErrorRow: false, _originalItem: item, _loading: true }; }); };
    const loadDetailDataInBackground = async (processedData, onProgress) => { const today = UtilsModule.formatToday(); const BATCH_SIZE = ConfigModule.BATCH_SIZES.DETAIL_LOAD; const itemsToLoad = processedData.filter(item => !item._isErrorRow); const totalBatches = Math.ceil(itemsToLoad.length / BATCH_SIZE); for (let i = 0; i < itemsToLoad.length; i += BATCH_SIZE) { const batchNum = i / BATCH_SIZE + 1; onProgress(batchNum / totalBatches * 100, `載入詳細資料 ${batchNum}/${totalBatches}...`); await Promise.all(itemsToLoad.slice(i, i + BATCH_SIZE).map(async (item) => { const globalIndex = processedData.findIndex(p => p.no === item.no); try { const [polpln, channels] = await Promise.all([getPolplnData(item._originalItem), getChannelDetails(item._originalItem)]); const data = StateModule.get().allProcessedData[globalIndex]; if (data) { data.polpln = polpln || '無資料'; data.channels = channels.map(c => ({...c, status: UtilsModule.getSaleStatus(today, c.rawStart, c.rawEnd)})); data.specialReason = UtilsModule.checkSpecialStatus(data); data._loading = false; ControllerModule.updateSingleRowInTable(globalIndex); } } catch (e) { if (e.name !== 'AbortError') { const data = StateModule.get().allProcessedData[globalIndex]; if (data) { data.polpln = '載入失敗'; data._loading = false; ControllerModule.updateSingleRowInTable(globalIndex); } } } })); } };
    const getPolplnData = async (item) => { const { cacheDetail } = StateModule.get(); if (cacheDetail.has(item.planCode)) return cacheDetail.get(item.planCode); const detail = await ApiModule.callApi('/planCodeController/queryDetail', { planCode: item.planCode, currentPage: 1, pageSize: 50 }); const polpln = (detail.records || []).map(r => r.polpln).filter(Boolean).join(', '); cacheDetail.set(item.planCode, polpln); return polpln; };
    const getChannelDetails = async (item) => { const { cacheChannel } = StateModule.get(); if (cacheChannel.has(item.planCode)) return cacheChannel.get(item.planCode); const sale = await ApiModule.callApi('/planCodeSaleDateController/query', { planCode: item.planCode, currentPage: 1, pageSize: 50 }); const channels = (sale.planCodeSaleDates?.records || []).map(r => ({ channel: UtilsModule.channelAPIToUI(r.channel), saleStartDate: UtilsModule.formatDateForUI(r.saleStartDate), saleEndDate: UtilsModule.formatDateForUI(r.saleEndDate), rawStart: r.saleStartDate, rawEnd: r.saleEndDate })); cacheChannel.set(item.planCode, channels); return channels; };
    const sortData = (data, key, asc) => { if (!key) return data; return [...data].sort((a, b) => { let valA = a[key], valB = b[key]; if (key && key.includes('Date')) { valA = new Date(UtilsModule.formatDateForComparison(a['raw' + key.charAt(0).toUpperCase() + key.slice(1)])); valB = new Date(UtilsModule.formatDateForComparison(b['raw' + key.charAt(0).toUpperCase() + key.slice(1)])); if (isNaN(valA.getTime())) return 1; if (isNaN(valB.getTime())) return -1; } if (valA < valB) return asc ? -1 : 1; if (valA > valB) return asc ? 1 : -1; return 0; }); };
    return { queryMultiplePlanCodes, queryChannelData, processRawDataForTable, loadDetailDataInBackground, sortData };
  })();

  /**
   * ========== 模組 8：主控制器/應用程式邏輯 (ControllerModule) ==========
   */
  const ControllerModule = (() => {
    const initialize = async () => {
      UIModule.injectStyle();
      EventModule.setupGlobalKeyListener();
      const storedToken = [localStorage.getItem('SSO-TOKEN'), sessionStorage.getItem('SSO-TOKEN')].find(t => t && t.trim() !== 'null');
      if (storedToken) {
        StateModule.set({ token: storedToken, tokenSource: 'stored' });
        UIModule.Toast.show('正在驗證 Token...', 'info');
        if (await ApiModule.verifyToken(storedToken)) {
          UIModule.Toast.show('Token 驗證成功', 'success');
          showQueryDialog();
        } else {
          UIModule.Toast.show('Token 無效或過期，請重新設定', 'warning');
          StateModule.set({ token: '', tokenSource: 'none' });
          showTokenDialog();
        }
      } else {
        showTokenDialog();
      }
    };

    const showTokenDialog = () => {
      const { env } = StateModule.get();
      UIModule.Modal.show(`
        <div class="pct-modal-header"><span>設定 Token</span><button class="pct-modal-close-btn">&times;</button></div>
        <div class="pct-modal-body"><div class="pct-form-group"><label for="pct-token-input" class="pct-label">請輸入 SSO-TOKEN：</label><textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 SSO-TOKEN">${StateModule.get().token}</textarea><div class="pct-error" id="pct-token-err" style="display:none;"></div></div></div>
        <div class="pct-modal-footer"><div class="pct-modal-footer-right"><button class="pct-btn" id="pct-token-ok">驗證並繼續</button></div></div>
      `, modal => {
        modal.setAttribute('data-size', 'query');
        const tokenInput = modal.querySelector('#pct-token-input');
        modal.querySelector('#pct-token-ok').onclick = async () => { const val = tokenInput.value.trim(); if (!val) { UIModule.showError('請輸入 Token', 'pct-token-err'); return; } UIModule.Toast.show('正在檢查...', 'info'); StateModule.set({ token: val }); if (await ApiModule.verifyToken(val)) { UIModule.Toast.show('Token 驗證成功', 'success'); StateModule.set({ tokenSource: 'manual' }); showQueryDialog(); } else { UIModule.showError('Token 驗證失敗', 'pct-token-err'); StateModule.set({ token: '' }); } };
      });
    };

    const showQueryDialog = () => {
        const { tokenSource } = StateModule.get();
        const modeLabel = m => ({[ConfigModule.QUERY_MODES.PLAN_CODE]:'商品代號', [ConfigModule.QUERY_MODES.PLAN_NAME]:'商品名稱', [ConfigModule.QUERY_MODES.MASTER_CLASSIFIED]:'商品銷售時間', [ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED]:'通路銷售時間'}[m] || m);
        const footerLeftHTML = tokenSource === 'manual' ? `<button class="pct-btn pct-btn-secondary" id="pct-back-to-token">返回修改 Token</button>` : `<button class="pct-btn pct-btn-secondary" id="pct-query-clear">清除</button>`;
        
        UIModule.Modal.show(`
            <div class="pct-modal-header"><span>選擇查詢條件</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body"><div id="pct-mode-wrap" class="pct-mode-card-grid">${Object.values(ConfigModule.QUERY_MODES).map(m=>`<div class="pct-mode-card" data-mode="${m}">${modeLabel(m)}</div>`).join('')}</div><div id="pct-dynamic-query-content"></div><div id="pct-query-err" class="pct-error" style="display:none;"></div></div>
            <div class="pct-modal-footer"><div class="pct-modal-footer-left">${footerLeftHTML}</div><div class="pct-modal-footer-right"><button class="pct-btn" id="pct-query-ok">開始查詢</button></div></div>
        `, modal => {
            modal.setAttribute('data-size', 'query');
            let localState = { mode: '', input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() };
            const dynamicContent = modal.querySelector('#pct-dynamic-query-content');
            const okBtn = modal.querySelector('#pct-query-ok');

            const statusCardClass = (status) => {
                switch(status) {
                    case ConfigModule.MASTER_STATUS_TYPES.IN_SALE: return 'insale';
                    case ConfigModule.MASTER_STATUS_TYPES.STOPPED: return 'stopped';
                    case ConfigModule.MASTER_STATUS_TYPES.PENDING: return 'pending';
                    case ConfigModule.MASTER_STATUS_TYPES.ABNORMAL: return 'abnormal';
                    default: return '';
                }
            };
            const updateUI = () => {
                modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.mode));
                let content = '';
                switch (localState.mode) {
                    case ConfigModule.QUERY_MODES.PLAN_CODE: content = `<div class="pct-form-group"><label class="pct-label">商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆可用空格、逗號或換行分隔"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.PLAN_NAME: content = `<div class="pct-form-group"><label class="pct-label">商品名稱：</label><textarea class="pct-input" id="pct-query-input" rows="3"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: content = `<div class="pct-form-group"><div class="pct-mode-card-grid">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<div class="pct-mode-card pct-status-card ${statusCardClass(s)}" data-type="masterStatus" data-value="${s}">${s}</div>`).join('')}</div><p style="font-size:12px;color:#666;margin-top:15px;">ⓘ 將掃描所有主檔資料，執行時間可能較長。</p></div>`; break;
                    case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: content = `<div class="pct-form-group"><label class="pct-label">通路：(可多選)</label><div class="pct-channel-option-grid">${ConfigModule.FIELD_MAPS.CHANNELS.map(c=>`<div class="pct-channel-option" data-type="channels" data-value="${c}">${c}</div>`).join('')}</div></div><div class="pct-form-group"><label class="pct-label">銷售範圍：</label><div class="pct-sub-option-grid">${['現售','停售'].map(s=>`<div class="pct-sub-option" data-type="channelStatus" data-value="${s}">${s}</div>`).join('')}</div></div>`; break;
                }
                dynamicContent.innerHTML = content;
                const inputEl = dynamicContent.querySelector('#pct-query-input'); if (inputEl) { inputEl.value = localState.input; inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); okBtn.click(); }}; }
                dynamicContent.querySelectorAll('[data-value]').forEach(el => { const type = el.dataset.type; if (type === 'masterStatus') el.classList.toggle('selected', localState.masterStatus.has(el.dataset.value)); else if (type === 'channels') el.classList.toggle('selected', localState.channels.has(el.dataset.value)); else if (type === 'channelStatus') el.classList.toggle('selected', localState.channelStatus === el.dataset.value); });
            };

            modal.querySelector('#pct-mode-wrap').onclick = e => { const card = e.target.closest('.pct-mode-card'); if (card) { localState = { mode: card.dataset.mode, input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() }; updateUI(); } };
            dynamicContent.addEventListener('click', e => { const option = e.target.closest('[data-value]'); if (!option) return; const {type, value} = option.dataset; if (type === 'masterStatus') { if(localState.masterStatus.has(value)) localState.masterStatus.delete(value); else localState.masterStatus.add(value); } else if (type === 'channels') { if(localState.channels.has(value)) localState.channels.delete(value); else localState.channels.add(value); } else if (type === 'channelStatus') { localState.channelStatus = localState.channelStatus === value ? '' : value; } updateUI(); });
            dynamicContent.addEventListener('input', e => { if (e.target.id === 'pct-query-input') localState.input = e.target.value; });
            const backBtn = modal.querySelector('#pct-back-to-token'); if(backBtn) backBtn.onclick = showTokenDialog;
            const clearBtn = modal.querySelector('#pct-query-clear'); if(clearBtn) clearBtn.onclick = () => { localState = { mode: '', input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() }; updateUI(); };
            
            okBtn.onclick = () => {
                UIModule.hideError('pct-query-err');
                if (localState.mode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED) {
                    if (localState.masterStatus.size === 0) { UIModule.showError('請至少選擇一個商品銷售時間', 'pct-query-err'); return; }
                    if (localState.masterStatus.size === Object.keys(ConfigModule.MASTER_STATUS_TYPES).length) {
                        UIModule.Toast.confirm('將掃描全部資料，確定嗎？', (confirmed) => { if (confirmed) { StateModule.set({ queryMode: localState.mode, masterStatusSelection: localState.masterStatus }); executeQuery(); } });
                        return;
                    }
                }
                if (localState.mode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED && !localState.channelStatus) { UIModule.showError('請選擇通路銷售範圍', 'pct-query-err'); return; }
                if (!localState.mode) { UIModule.showError('請選擇查詢模式', 'pct-query-err'); return; }

                StateModule.set({ queryMode: localState.mode, queryInput: localState.input, masterStatusSelection: localState.masterStatus, channelStatusSelection: localState.channelStatus, channelSelection: localState.channels });
                executeQuery();
            };
            updateUI();
        });
    };
    
    const executeQuery = async () => {
        UIModule.Modal.close();
        await new Promise(r => setTimeout(r, 100));
        renderTable(); 
        
        const controller = new AbortController();
        StateModule.set({ currentQueryController: controller });
        const oldState = { ...StateModule.get() };
        StateModule.resetQueryState();
        StateModule.set({ queryMode: oldState.queryMode, activeFrontendFilters: oldState.masterStatusSelection, tokenSource: oldState.tokenSource });
        
        const { queryMode, queryInput, masterStatusSelection, channelStatusSelection, channelSelection } = oldState;

        try {
            UIModule.Progress.show('開始查詢...');
            let rawData = [];
            if (queryMode === ConfigModule.QUERY_MODES.PLAN_CODE) { rawData = (await DataModule.queryMultiplePlanCodes(UtilsModule.splitInput(queryInput), controller.signal, UIModule.Progress.update)).records; }
            else if (queryMode === ConfigModule.QUERY_MODES.PLAN_NAME) { UIModule.Progress.update(50, '正在查詢主檔...'); const params = { planCodeName: queryInput, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }; rawData = (await ApiModule.callApi('/planCodeController/query', params, controller.signal)).records || []; }
            else if (queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED) { UIModule.Progress.update(20, '正在取得所有主檔資料...'); const allMaster = await ApiModule.callApi('/planCodeController/query', { planCodeName: '', currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, controller.signal); UIModule.Progress.update(60, '正在處理資料...'); rawData = (allMaster.records || []); }
            else if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) { UIModule.Progress.update(50, '正在查詢通路資料...'); rawData = await DataModule.queryChannelData(channelStatusSelection, [...channelSelection], controller.signal); }
            
            UIModule.Progress.update(80, '格式化資料...');
            const processedData = DataModule.processRawDataForTable(rawData);
            StateModule.set({ allProcessedData: processedData });
            renderTable();

            await DataModule.loadDetailDataInBackground(processedData, UIModule.Progress.update);
            UIModule.Progress.hide();
            UIModule.Toast.show(`查詢與載入完成`, 'success');

        } catch (e) {
            if (e.name !== 'AbortError') { UIModule.Progress.hide(); UIModule.Toast.show(`查詢失敗: ${e.message}`, 'error'); renderTable(); }
        } finally {
            StateModule.set({ currentQueryController: null });
        }
    };

    const renderTable = () => {
        const state = StateModule.get();
        let filteredData = state.allProcessedData;
        if (state.activeFrontendFilters.size > 0) { filteredData = filteredData.filter(r => state.activeFrontendFilters.has(r.mainStatus)); }
        if (state.filterSpecial) { filteredData = filteredData.filter(r => r.specialReason); }
        if (state.searchKeyword.trim()) { const keyword = state.searchKeyword.toLowerCase(); filteredData = filteredData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(keyword))); }
        
        const sortedData = DataModule.sortData(filteredData, state.sortKey, state.sortAsc);
        const totalPages = state.pageSize > 0 ? Math.ceil(sortedData.length / state.pageSize) : 1;
        const pageData = state.isFullView ? sortedData : sortedData.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize);
        
        const headers = [ { key: 'no', label: 'No' }, { key: 'planCode', label: '代號' }, { key: 'shortName', label: '名稱' }, { key: 'currency', label: '幣別' }, { key: 'unit', label: '單位' }, { key: 'coverageType', label: '類型' }, { key: 'saleStartDate', label: '起日' }, { key: 'saleEndDate', label: '迄日' }, { key: 'mainStatus', label: '主約狀態' }, { key: 'polpln', label: 'POLPLN' }, { key: null, label: '通路資訊' } ];

        const modalHTML = `
            <div class="pct-modal-header"><span>查詢結果</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body">
                <div id="pct-progress-container" class="pct-progress-container"></div>
                <div class="pct-filter-controls">
                    <div class="pct-search-container"><input type="text" class="pct-search-input" id="pct-search-input" placeholder="搜尋表格內容..." value="${UtilsModule.escapeHtml(state.searchKeyword)}"></div>
                    ${state.queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED ? `<div class="pct-status-filters">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<button class="pct-btn pct-status-filter-btn${state.activeFrontendFilters.has(s)?' pct-btn-primary':' pct-btn-secondary'}" data-status="${s}">${s}</button>`).join('')}</div>` : ''}
                </div>
                <div class="pct-table-wrap"><table class="pct-table">
                    <thead><tr>${headers.map(h => `<th data-key="${h.key||''}">${h.label}</th>`).join('')}</tr></thead>
                    <tbody>${pageData.map(r=>r._isErrorRow?`<tr class="error-row"><td colspan=11>代號 ${UtilsModule.escapeHtml(r.planCode)} 查詢失敗</td></tr>`:`<tr${r.specialReason?` class="special-row" title="${UtilsModule.escapeHtml(r.specialReason)}"`:''}>${headers.slice(0,-1).map(h=>`<td data-raw="${UtilsModule.escapeHtml(r[h.key]||'')}">${UtilsModule.escapeHtml(r[h.key]||'')}</td>`).join('')}<td data-raw="${(r.channels||[]).map(c=>`${c.channel}:${c.saleEndDate}`).join('; ')}">${(r.channels||[]).map(c=>`<span>${UtilsModule.escapeHtml(c.channel)}:${UtilsModule.escapeHtml(c.saleEndDate)}</span>`).join('<br>')}</td></tr>`).join('')}</tbody>
                </table></div>
            </div>
            <div class="pct-modal-footer">
                <div class="pct-modal-footer-left"><button class="pct-btn pct-btn-secondary" id="pct-view-toggle">${state.isFullView?'分頁顯示':'一頁顯示'}</button>${state.allProcessedData.some(r=>r.specialReason)?`<button class="pct-btn ${state.filterSpecial?'pct-filter-btn-active':'pct-filter-btn'}" id="pct-table-filter">${state.filterSpecial?'顯示全部':'篩選特殊'}</button>`:''}</div>
                <div class="pct-pagination" style="display:${state.isFullView?'none':'flex'}"><button id="pct-table-prev" class="pct-btn" ${state.pageNo<=1?'disabled':''}>◀</button><span class="pct-pagination-info">${state.pageNo} / ${totalPages}</span><button id="pct-table-next" class="pct-btn" ${state.pageNo>=totalPages?'disabled':''}>▶</button></div>
                <div class="pct-modal-footer-right"><button class="pct-btn pct-btn-info" id="pct-table-detail">查詢資料</button><button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button><button class="pct-btn" id="pct-table-requery">重新查詢</button></div>
            </div>`;
        
        UIModule.Modal.show(modalHTML, modal => {
            modal.setAttribute('data-size', 'results');
            modal.querySelector('#pct-search-input').addEventListener('input', e => { clearTimeout(state.searchDebounceTimer); state.searchDebounceTimer = setTimeout(() => { StateModule.set({ searchKeyword: e.target.value, pageNo: 1 }); renderTable(); }, ConfigModule.DEBOUNCE_DELAY.SEARCH); });
            modal.querySelector('#pct-view-toggle').onclick = () => { StateModule.set({ isFullView: !state.isFullView, pageNo: 1 }); renderTable(); };
            modal.querySelector('#pct-table-prev').onclick = () => { if(state.pageNo > 1) { StateModule.set({pageNo: state.pageNo - 1}); renderTable(); }};
            modal.querySelector('#pct-table-next').onclick = () => { if(state.pageNo < totalPages) { StateModule.set({pageNo: state.pageNo + 1}); renderTable(); }};
            modal.querySelector('#pct-table-filter')?.addEventListener('click', () => { StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); renderTable(); });
            modal.querySelector('#pct-table-detail').onclick = () => handleDetailQuery();
            modal.querySelector('#pct-table-copy').onclick = () => { const text = `${headers.map(h=>h.label).join('\t')}\n` + sortedData.map(r => [r.no, r.planCode, r.shortName, r.currency, r.unit, r.coverageType, r.saleStartDate, r.saleEndDate, r.mainStatus, r.polpln, (r.channels||[]).map(c=>`${c.channel}:${c.saleEndDate}(${c.status})`).join(' / ')].join('\t')).join('\n'); UtilsModule.copyTextToClipboard(text, UIModule.Toast.show); };
            modal.querySelector('#pct-table-requery').onclick = showQueryDialog;
            modal.querySelectorAll('.pct-table th[data-key]').forEach(th => { th.classList.toggle('sort-asc', state.sortKey === th.dataset.key && state.sortAsc); th.classList.toggle('sort-desc', state.sortKey === th.dataset.key && !state.sortAsc); th.onclick = () => { const key = th.dataset.key; if (key) { StateModule.set({ sortAsc: state.sortKey === key ? !state.sortAsc : true, sortKey: key, pageNo: 1 }); renderTable(); }}; });
            modal.querySelectorAll('.pct-table td').forEach(td => td.onclick = () => UtilsModule.copyTextToClipboard(td.dataset.raw, UIModule.Toast.show));
            modal.querySelectorAll('.pct-status-filter-btn').forEach(btn => btn.onclick = () => { const status = btn.dataset.status; if (state.activeFrontendFilters.has(status)) state.activeFrontendFilters.delete(status); else state.activeFrontendFilters.add(status); StateModule.set({ pageNo: 1 }); renderTable(); });
        });
    };
    
    const updateSingleRowInTable = (rowIndex) => {
        const modal = document.getElementById(ConfigModule.TOOL_ID);
        if (!modal) return;
        const state = StateModule.get();
        const displayIndex = state.isFullView ? rowIndex : rowIndex - (state.pageNo - 1) * state.pageSize;
        if (displayIndex < 0 || (!state.isFullView && displayIndex >= state.pageSize)) return;
        const tableBody = modal.querySelector('.pct-table tbody');
        if (!tableBody || !tableBody.rows[displayIndex]) return;
        const targetRow = tableBody.rows[displayIndex];
        const item = state.allProcessedData[rowIndex];
        if (item) {
            targetRow.cells[9].textContent = item.polpln;
            targetRow.cells[9].dataset.raw = item.polpln;
            targetRow.cells[10].innerHTML = (item.channels||[]).map(c=>`<span>${UtilsModule.escapeHtml(c.channel)}:${UtilsModule.escapeHtml(c.saleEndDate)}</span>`).join('<br>');
            if (item.specialReason) { targetRow.classList.add('special-row'); targetRow.title = item.specialReason; }
            else { targetRow.classList.remove('special-row'); targetRow.removeAttribute('title'); }
        }
    };
    
    const handleDetailQuery = async () => {
        const state = StateModule.get();
        UIModule.Progress.show('開始更新詳細資料...');
        await DataModule.loadDetailDataInBackground(state.allProcessedData, UIModule.Progress.update);
        UIModule.Progress.hide();
        UIModule.Toast.show('詳細資料更新完成', 'success');
    };

    return { initialize, updateSingleRowInTable };
  })();

  ControllerModule.initialize();
})();
