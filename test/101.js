javascript:(function() {
  'use strict';

  /**
   * ===================================================================
   * 商品查詢小工具 v18.1.0 (重構優化版)
   *
   * @version 18.1.0
   * @description
   * - [重構] 核心邏輯與功能完全承襲 v18.0.0，未做任何更動。
   * - [優化] 提升程式碼可讀性與可維護性，將大型函式拆解。
   * - [優化] 結果表格全面採用「事件委派」處理點擊，提升效能。
   * - [優化] 增加更詳盡的 JSDoc 註解，方便理解與後續維護。
   * - [修正] 調整查詢結果視窗的標題列間距，使其更為緊湊。
   * ===================================================================
   */

  // 清理舊工具實例，確保環境乾淨
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  /**
   * ========================================================
   * 模組 1：配置管理 (ConfigModule)
   * @description 集中管理所有靜態設定、常數與 API 端點。
   * ========================================================
   */
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '18.1.0-Refactored',
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
    DEFAULT_QUERY_PARAMS: { PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 5000, PAGE_SIZE_DETAIL: 50, PAGE_SIZE_TABLE: 50 },
    DEBOUNCE_DELAY: { SEARCH: 1000 },
    BATCH_SIZES: { MULTI_CODE_QUERY: 10, DETAIL_LOAD: 20 }
  });

  /**
   * ========================================================
   * 模組 2：狀態管理 (StateModule)
   * @description 統一管理整個工具的動態狀態。
   * ========================================================
   */
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '', token: '', tokenCheckEnabled: true,
      queryMode: '', queryInput: '', masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set(),
      allProcessedData: [], pageNo: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false, filterSpecial: false, searchKeyword: '', sortKey: 'no', sortAsc: true,
      activeFrontendFilters: new Set(),
      cacheDetail: new Map(), cacheChannel: new Map(), cacheProduct: new Map(),
      currentQueryController: null, searchDebounceTimer: null
    };
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    const resetQueryState = () => {
      set({ allProcessedData: [], pageNo: 1, filterSpecial: false, searchKeyword: '', isFullView: false, activeFrontendFilters: new Set() });
      state.cacheDetail.clear(); state.cacheChannel.clear(); state.cacheProduct.clear();
    };
    return { get, set, resetQueryState };
  })();

  /**
   * ========================================================
   * 模組 3：通用工具函式庫 (UtilsModule)
   * @description 提供純函式工具，如格式化、轉換等。
   * ========================================================
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
        if (!navigator.clipboard) {
            const e = document.createElement('textarea');
            e.value = t;
            document.body.appendChild(e);
            e.select();
            document.execCommand('copy');
            document.body.removeChild(e);
            showToast('已複製 (舊版)', 'success');
        } else {
            navigator.clipboard.writeText(t)
                .then(() => showToast('已複製', 'success'))
                .catch(() => showToast('複製失敗', 'error'));
        }
    };
    
    const splitInput = i => i.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
    const toHalfWidthUpperCase = str => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();
    
    return { escapeHtml, formatToday, formatDateForUI, getSaleStatus, checkSpecialStatus, channelUIToAPI, channelAPIToUI, currencyConvert, unitConvert, coverageTypeConvert, copyTextToClipboard, splitInput, toHalfWidthUpperCase };
  })();

  /**
   * ========================================================
   * 模組 4：UI 介面管理器 (UIModule)
   * @description 負責所有 DOM 操作、樣式注入與 UI 元件產生。
   * ========================================================
   */
  const UIModule = (() => {
    const injectStyle = () => {
      const s = document.createElement('style'); s.id = ConfigModule.STYLE_ID;
      s.textContent = `
        :root{--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#5CB85C;--success-dark-color:#4CAE4C;--error-color:#D9534F;--error-dark-color:#C9302C;--warning-color:#F0AD4E;--warning-dark-color:#EC971F;--info-color:#5BC0DE;--info-dark-color:#46B8DA;--background-light:#F8F8F8;--surface-color:#FFFFFF;--border-color:#E0E0E0;--text-color-dark:#1a1a1a;--text-color-light:#333333;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;}
        .pct-modal-mask{position:fixed;z-index:2147483646;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);opacity:0;transition:opacity var(--transition-speed) ease-out;}
        .pct-modal-mask.show{opacity:1;}
        .pct-modal{font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
        .pct-modal[data-size="query"] { width: 520px; } .pct-modal[data-size="results"] { width: 1050px; }
        .pct-modal.show{opacity:1;transform:translateX(-50%) translateY(0);}
        .pct-modal.dragging{transition:none;}
        .pct-modal-header{padding:16px 50px 16px 20px;line-height:1;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;position:relative;}
        .pct-modal-header.dragging{cursor:grabbing;}
        .pct-modal-close-btn{position:absolute;top:50%;right:15px;transform:translateY(-50%);background:transparent;border:none;font-size:24px;line-height:1;color:var(--secondary-color);cursor:pointer;padding:5px;width:34px;height:34px;border-radius:50%;transition:background-color .2s, color .2s;display:flex;align-items:center;justify-content:center;}
        .pct-modal-close-btn:hover{background-color:var(--background-light);color:var(--text-color-dark);}
        .pct-modal-body{padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
        .pct-modal[data-size="query"] .pct-modal-body { height: 260px; }
        .pct-modal-footer{padding:12px 20px 16px 20px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;}
        .pct-modal-footer-left,.pct-modal-footer-right{display:flex;gap:10px;align-items:center;}
        .pct-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:all var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap;}
        .pct-btn:hover{background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);}
        .pct-btn:disabled{background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;}
        .pct-btn-secondary{background:var(--secondary-color);} .pct-btn-secondary:hover{background:var(--secondary-dark-color);}
        .pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
        .pct-btn.pct-btn-outline:hover { background-color: var(--background-light); color: var(--text-color-dark); }
        .pct-btn.pct-btn-outline.pct-btn-primary { background-color: var(--primary-color); color: #fff; }
        .pct-filter-btn{font-size:14px;padding:5px 12px;background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);border-radius:5px;cursor:pointer;font-weight:600;}
        .pct-filter-btn.active{background:var(--warning-dark-color);color:white;}
        .pct-input{width:100%;font-size:16px;padding:9px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;margin-top:5px;}
        .pct-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
        .pct-error{color:var(--error-color);font-size:13px;margin:8px 0 0 0;display:block;}
        .pct-form-group{margin-bottom:20px;}
        .pct-mode-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;}
        .pct-mode-card, .pct-sub-option, .pct-channel-option { background: var(--background-light); border: 1px solid var(--border-color); border-radius: var(--border-radius-base); padding: 10px; text-align: center; cursor: pointer; transition: all .2s ease-out; font-weight: 500; font-size: 15px; display: flex; align-items: center; justify-content: center; min-height: 50px; }
        .pct-mode-card:hover, .pct-sub-option:hover, .pct-channel-option:hover { transform: translateY(-2px); box-shadow: 0 4px 8px var(--box-shadow-medium); background-color: #f0f7ff; border-color: var(--primary-color); }
        .pct-mode-card.selected, .pct-sub-option.selected, .pct-channel-option.selected { background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
        .pct-sub-option-grid, .pct-channel-option-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;}
        .pct-table-wrap{max-height:60vh;overflow:auto;margin:15px 0;}
        .pct-table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface-color);table-layout:fixed;min-width:1000px;}
        .pct-table th, .pct-table td{border:1px solid #ddd;padding:5px;vertical-align:top;word-wrap:break-word;}
        .pct-table th { background:#f8f8f8;position:sticky;top:0;z-index:1;cursor:pointer;text-align:center;}
        .pct-table th:nth-child(1), .pct-table th:nth-child(2), .pct-table th:nth-child(9) { width: 6.8%; }
        .pct-table th:nth-child(3) { width: 19.3%; } .pct-table th:nth-child(4) { width: 5.7%; }
        .pct-table th:nth-child(5), .pct-table th:nth-child(6) { width: 4.5%; }
        .pct-table th:nth-child(7), .pct-table th:nth-child(8) { width: 11.4%; }
        .pct-table th:nth-child(10) { width: 9.1%; } .pct-table th:nth-child(11) { width: 13.6%; }
        .pct-table th[data-key]::after{content:'';position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:0.3;font-size:12px;transition:opacity 0.2s;border:4px solid transparent;}
        .pct-table th[data-key].sort-asc::after{border-bottom-color:var(--primary-color);opacity:1;}
        .pct-table th[data-key].sort-desc::after{border-top-color:var(--primary-color);opacity:1;}
        .pct-table tr:hover{background:#e3f2fd;}
        .pct-table tr.special-row{background:#fffde7;border-left:4px solid var(--warning-color);cursor:help;}
        .pct-table tr.clickable-row { cursor: pointer; }
        .pct-table td.clickable-cell { cursor: cell; }
        .pct-channel-insale { color: var(--primary-color); font-weight: bold; }
        .pct-channel-offsale { color: var(--error-color); }
        .pct-channel-separator { margin: 0 4px; color: #ccc; }
        .pct-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;}
        .pct-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
        .pct-toast.success{background:var(--success-color);} .pct-toast.error{background:var(--error-color);} .pct-toast.warning{background:var(--warning-color);color:var(--text-color-dark);} .pct-toast.info{background:var(--info-color);}
        .pct-confirm-toast{display:flex;align-items:center;gap:15px;} .pct-confirm-toast .pct-btn{padding:5px 10px;font-size:14px;}
        .pct-pagination{display:flex;justify-content:center;align-items:center;gap:10px;}
        .pct-pagination-info{font-size:14px;color:var(--text-color-light);}
        .pct-progress-container{display:none;align-items:center;gap:16px;padding:12px;background-color:#f0f8ff;border-radius:var(--border-radius-base);margin-bottom:16px;}
        .pct-progress-bar-wrapper{flex-grow:1;height:10px;background-color:rgba(0,0,0,0.1);border-radius:5px;overflow:hidden;}
        .pct-progress-bar{width:0%;height:100%;background-color:var(--primary-color);transition:width .4s ease-out;border-radius:5px;}
        .pct-progress-text{font-size:14px;color:var(--text-color-dark);white-space:nowrap;}
        .pct-abort-btn{background-color:var(--error-color) !important;color:white !important;padding:5px 14px !important;font-size:14px !important;}
      `;
      document.head.appendChild(s);
    };

    const Toast = {
      show: (msg, type = 'info', duration = 3000) => {
        let e = document.getElementById('pct-toast');
        if (e) e.remove();
        e = document.createElement('div');
        e.id = 'pct-toast';
        document.body.appendChild(e);
        e.className = `pct-toast ${type}`;
        e.textContent = msg;
        e.classList.add('show');
        if (duration > 0) {
          setTimeout(() => {
            e.classList.remove('show');
            e.addEventListener('transitionend', () => e.remove(), { once: true });
          }, duration);
        }
      },
      confirm: (msg, onConfirm) => {
        Toast.show('', 'warning', 0);
        const toastEl = document.getElementById('pct-toast');
        toastEl.innerHTML = `<div class="pct-confirm-toast"><span>${msg}</span><button id="pct-confirm-ok" class="pct-btn">確認</button><button id="pct-confirm-cancel" class="pct-btn pct-btn-secondary">取消</button></div>`;
        document.getElementById('pct-confirm-ok').onclick = () => { Toast.close(); onConfirm(true); };
        document.getElementById('pct-confirm-cancel').onclick = () => { Toast.close(); onConfirm(false); };
      },
      close: () => { document.getElementById('pct-toast')?.remove(); }
    };

    const Modal = {
      close: () => {
        document.getElementById(ConfigModule.TOOL_ID)?.remove();
        document.getElementById('pctModalMask')?.remove();
        StateModule.get().currentQueryController?.abort();
      },
      show: (html, onOpen) => {
        Modal.close();
        let mask = document.createElement('div');
        mask.id = 'pctModalMask';
        mask.className = 'pct-modal-mask';
        document.body.appendChild(mask);
        let modal = document.createElement('div');
        modal.id = ConfigModule.TOOL_ID;
        modal.className = 'pct-modal';
        modal.innerHTML = html;
        document.body.appendChild(modal);
        setTimeout(() => { mask.classList.add('show'); modal.classList.add('show'); }, 10);
        modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown);
        modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close);
        if (onOpen) setTimeout(() => onOpen(modal), 50);
      }
    };

    const Progress = {
      show: (text) => {
        const anchor = document.querySelector('.pct-modal-body');
        if (!anchor) return;
        let p = document.getElementById('pct-progress-container');
        if (!p) {
            p = document.createElement('div');
            p.id = 'pct-progress-container';
            p.className = 'pct-progress-container';
            anchor.prepend(p);
        }
        p.style.display = 'flex';
        p.innerHTML = `<span class="pct-progress-text">${text}</span><div class="pct-progress-bar-wrapper"><div id="pct-progress-bar" class="pct-progress-bar"></div></div><button id="pct-abort-btn" class="pct-btn pct-abort-btn">中止查詢</button>`;
        document.getElementById('pct-abort-btn').onclick = () => {
            StateModule.get().currentQueryController?.abort();
            Progress.hide();
            Toast.show('查詢已中止', 'warning');
        };
      },
      update: (percentage, text) => {
        const bar = document.getElementById('pct-progress-bar');
        if (bar) bar.style.width = `${percentage}%`;
        const textEl = document.querySelector('#pct-progress-container .pct-progress-text');
        if (textEl && text) textEl.textContent = text;
      },
      hide: () => {
        const p = document.getElementById('pct-progress-container');
        if(p) p.style.display = 'none';
      }
    };
    
    const showError = (msg, elId) => { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.style.display = 'block'; } else { Toast.show(msg, 'error'); } };
    const hideError = (elId) => { const el = document.getElementById(elId); if (el) { el.style.display = 'none'; el.textContent = ''; } };

    return { injectStyle, Toast, Modal, Progress, showError, hideError };
  })();

  /**
   * ========================================================
   * 模組 5：事件管理器 (EventModule)
   * @description 處理通用事件，如拖曳、鍵盤監聽等。
   * ========================================================
   */
  const EventModule = (() => {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, modal: null };

    const dragMouseDown = e => {
      const modal = document.getElementById(ConfigModule.TOOL_ID);
      if (!modal || e.target.classList.contains('pct-modal-close-btn')) return;
      dragState.isDragging = true;
      dragState.modal = modal;
      dragState.initialX = e.clientX - modal.getBoundingClientRect().left;
      dragState.initialY = e.clientY - modal.getBoundingClientRect().top;
      modal.classList.add('dragging');
      e.currentTarget.classList.add('dragging');
      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('mouseup', closeDragElement);
      e.preventDefault();
    };

    const elementDrag = e => {
      if (!dragState.isDragging) return;
      const { modal, initialX, initialY } = dragState;
      const newX = e.clientX - initialX;
      const newY = e.clientY - initialY;
      modal.style.left = `${newX + modal.offsetWidth / 2}px`;
      modal.style.top = `${newY}px`;
      e.preventDefault();
    };

    const closeDragElement = () => {
      if (!dragState.isDragging) return;
      dragState.isDragging = false;
      const { modal } = dragState;
      if (modal) {
        modal.classList.remove('dragging');
        modal.querySelector('.pct-modal-header')?.classList.remove('dragging');
      }
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('mouseup', closeDragElement);
    };

    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        UIModule.Modal.close();
        document.removeEventListener('keydown', handleEscKey);
      }
    };
    
    const setupGlobalKeyListener = () => {
        document.removeEventListener('keydown', handleEscKey); // Avoid duplicates
        document.addEventListener('keydown', handleEscKey);
    };
    
    const autoFormatInput = (event) => {
        const input = event.target;
        const { value, selectionStart, selectionEnd } = input;
        input.value = UtilsModule.toHalfWidthUpperCase(value);
        input.setSelectionRange(selectionStart, selectionEnd);
    };

    return { dragMouseDown, setupGlobalKeyListener, autoFormatInput };
  })();

  /**
   * ========================================================
   * 模組 6：API 服務層 (ApiModule)
   * @description 封裝所有對後端 API 的請求。
   * ========================================================
   */
  const ApiModule = (() => {
    const callApi = async (endpoint, params, signal) => {
      const { apiBase, token } = StateModule.get();
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['SSO-TOKEN'] = token;
      }
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(params),
        signal: signal
      });

      if (!response.ok) {
        let errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorText = errorJson.message || errorJson.error || errorText;
        } catch (e) { /* Ignore parsing error */ }
        throw new Error(`API 請求失敗: ${errorText}`);
      }
      return response.json();
    };

    const verifyToken = async (token) => {
      try {
        const tempState = StateModule.get();
        const res = await fetch(`${tempState.apiBase}/planCodeController/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
            body: JSON.stringify({ planCode: '5105', currentPage: 1, pageSize: 1 })
        });
        const data = await res.json();
        // 成功的 API 回應通常包含 total 或 records 屬性
        return res.ok && (typeof data.total !== 'undefined' || typeof data.records !== 'undefined');
      } catch (e) {
        return false;
      }
    };

    return { callApi, verifyToken };
  })();

  /**
   * ========================================================
   * 模組 7：資料處理與查詢邏輯層 (DataModule)
   * @description 負責資料的獲取、處理、加工與快取。
   * ========================================================
   */
  const DataModule = (() => {
    // [v18核心邏輯] POLPLN 加工計算
    const extractPolpln = (polplnString) => {
      if (!polplnString || typeof polplnString !== 'string') return "";
      let t = polplnString.trim();
      if (t.endsWith("%%")) t = t.substring(0, t.length - 2);
      return t.replace(/^\d+/, "").replace(/\d+$/, "").trim() || "";
    };
    const processMultiplePolpln = (polplnRecords) => {
      if (!polplnRecords || polplnRecords.length === 0) return "-";
      if (polplnRecords.length === 1) return extractPolpln(polplnRecords[0]) || "-";
      const extractedPolplns = polplnRecords.map(r => extractPolpln(r)).filter(p => p !== "");
      if (extractedPolplns.length === 0) return "-";
      const firstPolpln = extractedPolplns[0];
      return extractedPolplns.every(p => p === firstPolpln) ? firstPolpln : "-";
    };

    const queryMultiplePlanCodes = async (codes, signal, onProgress) => {
      const BATCH_SIZE = ConfigModule.BATCH_SIZES.MULTI_CODE_QUERY;
      const allRecords = [];
      const totalBatches = Math.ceil(codes.length / BATCH_SIZE);
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        const batchNum = i / BATCH_SIZE + 1;
        onProgress(batchNum / totalBatches * 100, `批量查詢第 ${batchNum}/${totalBatches} 批...`);
        const promises = batch.map(async c => {
          try {
            const res = await ApiModule.callApi('/planCodeController/query', { planCode: c, currentPage: 1, pageSize: 10 }, signal);
            return (res.records && res.records.length > 0) ? res.records : [{ planCode: c, _apiStatus: '查無資料', _isErrorRow: true }];
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            return [{ planCode: c, _apiStatus: `查詢失敗(${e.message})`, _isErrorRow: true }];
          }
        });
        allRecords.push(...(await Promise.all(promises)).flat());
      }
      return { records: allRecords };
    };
    
    const queryChannelData = async (mode, channels, signal) => {
      const channelsToQuery = channels.length > 0 ? channels : ConfigModule.FIELD_MAPS.CHANNELS;
      const query = async (ch, inSale) => {
        const params = { planCode: "", channel: UtilsModule.channelUIToAPI(ch), saleEndDate: inSale ? "9999-12-31 00:00:00" : "", pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL };
        const res = await ApiModule.callApi('/planCodeSaleDateController/query', params, signal);
        return (res.planCodeSaleDates?.records || []).map(r => ({ ...r, channel: UtilsModule.channelAPIToUI(r.channel) }));
      };
      
      const queryAll = async (chList) => (await Promise.all(chList.map(c => query(c, false)))).flat();
      const queryCurrent = async (chList) => (await Promise.all(chList.map(c => query(c, true)))).flat();

      if (mode === '停售') {
        const [all, current] = await Promise.all([queryAll(channelsToQuery), queryCurrent(channelsToQuery)]);
        const currentSet = new Set(current.map(i => `${i.planCode}_${i.channel}`));
        return all.filter(i => !currentSet.has(`${i.planCode}_${i.channel}`));
      } else { // 現售
        return await queryCurrent(channelsToQuery);
      }
    };
    
    // 標準流程：處理商品主檔資料
    const processRawDataForTable = (rawData) => {
      const today = UtilsModule.formatToday();
      return rawData.map((item, index) => {
        if (item._isErrorRow) {
            return { no: index + 1, planCode: item.planCode || '-', shortName: '-', currency: '-', unit: '-', coverageType: '-', saleStartDate: '-', rawSaleStartDate: null, saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, rawSaleEndDate: null, mainStatus: '-', polpln: '...', channels: [], specialReason: '', _isErrorRow: true, _loadingDetails: false };
        }
        return {
            no: index + 1,
            planCode: item.planCode || '-',
            shortName: item.shortName || item.planName || '-',
            currency: UtilsModule.currencyConvert(item.currency || item.cur),
            unit: UtilsModule.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
            coverageType: UtilsModule.coverageTypeConvert(item.coverageType || item.type),
            saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate),
            rawSaleStartDate: item.saleStartDate,
            saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate),
            rawSaleEndDate: item.saleEndDate,
            mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate),
            polpln: '...', channels: [], specialReason: '',
            _isErrorRow: false, _originalItem: item, _loadingDetails: true
        };
      });
    };
    
    // [v18核心架構] 反向流程：處理通路資料
    const processChannelDataForTable = (rawData) => {
      const today = UtilsModule.formatToday();
      const groupedByPlanCode = rawData.reduce((acc, cur) => {
        if (!acc[cur.planCode]) {
          acc[cur.planCode] = {
            no: Object.keys(acc).length + 1, planCode: cur.planCode,
            shortName: '...', currency: '...', unit: '...', coverageType: '...',
            saleStartDate: '...', rawSaleStartDate: null, saleEndDate: '...', rawSaleEndDate: null,
            mainStatus: '...', polpln: '...', channels: [], specialReason: '',
            _isErrorRow: false, _loadingProduct: true, _loadingDetails: true // 同時需要載入主檔與細節
          };
        }
        acc[cur.planCode].channels.push({
          channel: cur.channel,
          saleStartDate: UtilsModule.formatDateForUI(cur.saleStartDate),
          saleEndDate: UtilsModule.formatDateForUI(cur.saleEndDate),
          rawStart: cur.saleStartDate, rawEnd: cur.saleEndDate,
          status: UtilsModule.getSaleStatus(today, cur.saleStartDate, cur.saleEndDate)
        });
        return acc;
      }, {});
      return Object.values(groupedByPlanCode);
    };

    // --- 資料載入與快取函式 ---
    const getProductDetails = async (planCode, signal) => {
      const { cacheProduct } = StateModule.get();
      if (cacheProduct.has(planCode)) return cacheProduct.get(planCode);
      const res = await ApiModule.callApi('/planCodeController/query', { planCode, currentPage: 1, pageSize: 1 }, signal);
      const productData = (res.records && res.records.length > 0) ? res.records[0] : null;
      if(productData) cacheProduct.set(planCode, productData);
      return productData;
    };

    const getPolplnData = async (planCode, signal) => {
      const { cacheDetail } = StateModule.get();
      if (cacheDetail.has(planCode)) return cacheDetail.get(planCode);
      const detail = await ApiModule.callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }, signal);
      const polplnRecords = (detail.records || []).map(r => r.polpln);
      const processedPolpln = processMultiplePolpln(polplnRecords);
      cacheDetail.set(planCode, processedPolpln);
      return processedPolpln;
    };

    const getChannelDetails = async (planCode, signal) => {
      const { cacheChannel } = StateModule.get();
      if (cacheChannel.has(planCode)) return cacheChannel.get(planCode);
      const sale = await ApiModule.callApi('/planCodeSaleDateController/query', { planCode, currentPage: 1, pageSize: 50 }, signal);
      const channels = (sale.planCodeSaleDates?.records || []).map(r => ({
          channel: UtilsModule.channelAPIToUI(r.channel),
          saleStartDate: UtilsModule.formatDateForUI(r.saleStartDate),
          saleEndDate: UtilsModule.formatDateForUI(r.saleEndDate),
          rawStart: r.saleStartDate, rawEnd: r.saleEndDate
      }));
      cacheChannel.set(planCode, channels);
      return channels;
    };
    
    // --- 組合資料載入流程 ---
    const loadDetailsForSingleRow = async (item, signal) => {
      const today = UtilsModule.formatToday();
      const [polpln, channels] = await Promise.all([
          getPolplnData(item.planCode, signal),
          getChannelDetails(item.planCode, signal)
      ]);
      item.polpln = polpln || '無資料';
      item.channels = channels.map(c => ({...c, status: UtilsModule.getSaleStatus(today, c.rawStart, c.rawEnd)}));
      item.specialReason = UtilsModule.checkSpecialStatus(item);
      item._loadingDetails = false;
      ControllerModule.rerenderTable();
    };

    const loadProductForSingleRow = async (item, signal) => {
      const today = UtilsModule.formatToday();
      const productData = await getProductDetails(item.planCode, signal);
      if (productData) {
        Object.assign(item, {
          shortName: productData.shortName || productData.planName || '-',
          currency: UtilsModule.currencyConvert(productData.currency || productData.cur),
          unit: UtilsModule.unitConvert(productData.reportInsuranceAmountUnit || productData.insuranceAmountUnit),
          coverageType: UtilsModule.coverageTypeConvert(productData.coverageType || productData.type),
          saleStartDate: UtilsModule.formatDateForUI(productData.saleStartDate),
          rawSaleStartDate: productData.saleStartDate,
          saleEndDate: UtilsModule.formatDateForUI(productData.saleEndDate),
          rawSaleEndDate: productData.saleEndDate,
          mainStatus: UtilsModule.getSaleStatus(today, productData.saleStartDate, productData.saleEndDate),
        });
      } else {
        item.shortName = '查無主檔';
      }
      item._loadingProduct = false;
      // 主檔載完後，繼續載入POLPLN等細節
      // [2025-07-09] 修正：確保此處的細節載入能被觸發
      await loadDetailsForSingleRow(item, signal);
    };
    
    const sortData = (data, key, asc) => {
        if (!key || key === 'no') return data;
        return [...data].sort((a, b) => {
            let valA = a[key], valB = b[key];
            if (key.toLowerCase().includes('date')) {
                valA = a['raw' + key.charAt(0).toUpperCase() + key.slice(1)];
                valB = b['raw' + key.charAt(0).toUpperCase() + key.slice(1)];
            }
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
    };
    
    return {
      queryMultiplePlanCodes, queryChannelData,
      processRawDataForTable, processChannelDataForTable,
      loadDetailsForSingleRow, loadProductForSingleRow,
      sortData
    };
  })();

  /**
   * ========================================================
   * 模組 8：主控制器/應用程式邏輯 (ControllerModule)
   * @description 負責協調各模組，驅動整個應用程式的流程。
   * ========================================================
   */
  const ControllerModule = (() => {
    
    /**
     * 初始化工具，檢查 Token 並顯示對應畫面。
     */
    const initialize = async () => {
      UIModule.injectStyle();
      EventModule.setupGlobalKeyListener();
      const storedToken = [
        localStorage.getItem('SSO-TOKEN'),
        sessionStorage.getItem('SSO-TOKEN'),
        localStorage.getItem('euisToken'),
        sessionStorage.getItem('euisToken')
      ].find(t => t && t.trim() !== 'null' && t.trim() !== '');

      if (storedToken) {
        StateModule.set({ token: storedToken, tokenCheckEnabled: true });
        UIModule.Toast.show('正在自動驗證 Token...', 'info', 2000);
        if (await ApiModule.verifyToken(storedToken)) {
          UIModule.Toast.show('Token 驗證成功', 'success');
          showQueryDialog();
        } else {
          UIModule.Toast.show('自動驗證失敗，請手動輸入或略過', 'warning');
          StateModule.set({ token: '' });
          showTokenDialog();
        }
      } else {
        showTokenDialog();
      }
    };

    /**
     * 顯示 Token 輸入對話框
     */
    const showTokenDialog = () => {
      const { env } = StateModule.get();
      const html = `
        <div class="pct-modal-header"><span>設定 Token (${env})</span><button class="pct-modal-close-btn">&times;</button></div>
        <div class="pct-modal-body">
          <div class="pct-form-group">
            <label for="pct-token-input" class="pct-label">請貼上您的 SSO-TOKEN 或 euisToken：</label>
            <textarea class="pct-input" id="pct-token-input" rows="4" placeholder="貼上您的 Token..."></textarea>
            <div class="pct-error" id="pct-token-err" style="display:none;"></div>
          </div>
        </div>
        <div class="pct-modal-footer">
          <div class="pct-modal-footer-right">
            <button class="pct-btn" id="pct-token-ok">驗證</button>
            <button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過</button>
          </div>
        </div>`;
        
      UIModule.Modal.show(html, modal => {
        modal.setAttribute('data-size', 'query');
        const tokenInput = modal.querySelector('#pct-token-input');
        
        const handleVerify = async () => {
            const val = tokenInput.value.trim();
            if (!val) { UIModule.showError('請輸入 Token', 'pct-token-err'); return; }
            UIModule.Toast.show('正在檢查...', 'info', 2000);
            StateModule.set({ token: val, tokenCheckEnabled: true });
            if (await ApiModule.verifyToken(val)) {
                localStorage.setItem('SSO-TOKEN', val);
                UIModule.Toast.show('Token 驗證成功', 'success');
                showQueryDialog();
            } else {
                UIModule.showError('Token 驗證失敗', 'pct-token-err');
                StateModule.set({ token: '' });
            }
        };

        const handleSkip = () => {
            const val = tokenInput.value.trim();
            StateModule.set({ token: val, tokenCheckEnabled: false });
            if (val) localStorage.setItem('SSO-TOKEN', val); else localStorage.removeItem('SSO-TOKEN');
            UIModule.Toast.show('已略過驗證，若查詢失敗請檢查 Token', 'warning');
            showQueryDialog();
        };

        modal.querySelector('#pct-token-ok').onclick = handleVerify;
        modal.querySelector('#pct-token-skip').onclick = handleSkip;
        tokenInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleVerify(); }};
      });
    };
    
    /**
     * 顯示主查詢條件對話框
     */
    const showQueryDialog = () => {
        const { env } = StateModule.get();
        const modeLabel = m => ({[ConfigModule.QUERY_MODES.PLAN_CODE]:'商品代號', [ConfigModule.QUERY_MODES.PLAN_NAME]:'商品名稱', [ConfigModule.QUERY_MODES.MASTER_CLASSIFIED]:'商品銷售時間', [ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED]:'通路銷售時間'}[m] || m);

        const html = `
            <div class="pct-modal-header"><span>選擇查詢條件 (${env})</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body">
                <div id="pct-mode-wrap" class="pct-mode-card-grid">${Object.values(ConfigModule.QUERY_MODES).map(m=>`<div class="pct-mode-card" data-mode="${m}">${modeLabel(m)}</div>`).join('')}</div>
                <div id="pct-dynamic-query-content" style="margin-top: 15px;"></div>
                <div id="pct-query-err" class="pct-error" style="display:none;"></div>
            </div>
            <div class="pct-modal-footer">
                <div class="pct-modal-footer-left"><button class="pct-btn pct-btn-secondary" id="pct-back-to-token">修改 Token</button></div>
                <div class="pct-modal-footer-right"><button class="pct-btn" id="pct-query-ok">開始查詢</button></div>
            </div>`;

        UIModule.Modal.show(html, modal => {
            modal.setAttribute('data-size', 'query');
            let localState = { mode: '', input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() };
            const dynamicContent = modal.querySelector('#pct-dynamic-query-content');
            
            const updateDynamicContent = () => {
                let content = '';
                switch (localState.mode) {
                    case ConfigModule.QUERY_MODES.PLAN_CODE: content = `<div class="pct-form-group"><label class="pct-label">商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆可用空格、逗號或換行分隔"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.PLAN_NAME: content = `<div class="pct-form-group"><label class="pct-label">商品名稱：</label><textarea class="pct-input" id="pct-query-input" rows="3"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: content = `<div class="pct-form-group"><label class="pct-label">主檔銷售時間：</label><div class="pct-sub-option-grid">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<div class="pct-sub-option" data-type="masterStatus" data-value="${s}">${s}</div>`).join('')}</div><p style="font-size:12px;color:#666;margin-top:15px;">ⓘ 將掃描所有主檔資料，執行時間可能較長。</p></div>`; break;
                    case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: content = `<div class="pct-form-group"><label class="pct-label">通路：(可多選)</label><div class="pct-channel-option-grid">${ConfigModule.FIELD_MAPS.CHANNELS.map(c=>`<div class="pct-channel-option" data-type="channels" data-value="${c}">${c}</div>`).join('')}</div></div><div class="pct-form-group"><label class="pct-label">銷售範圍：</label><div class="pct-sub-option-grid">${['現售','停售'].map(s=>`<div class="pct-sub-option" data-type="channelStatus" data-value="${s}">${s}</div>`).join('')}</div></div>`; break;
                }
                dynamicContent.innerHTML = content;
                // Re-bind events for new content
                dynamicContent.querySelectorAll('.pct-input').forEach(el => el.addEventListener('input', EventModule.autoFormatInput));
                const inputEl = dynamicContent.querySelector('#pct-query-input'); 
                if (inputEl) { 
                    inputEl.value = localState.input;
                    inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQueryClick(); }};
                    inputEl.addEventListener('input', e => localState.input = e.target.value);
                }
                updateSelections();
            };

            const updateSelections = () => {
                modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.mode));
                dynamicContent.querySelectorAll('[data-value]').forEach(el => {
                    const { type, value } = el.dataset;
                    let isSelected = false;
                    if (type === 'masterStatus') isSelected = localState.masterStatus.has(value);
                    else if (type === 'channels') isSelected = localState.channels.has(value);
                    else if (type === 'channelStatus') isSelected = localState.channelStatus === value;
                    el.classList.toggle('selected', isSelected);
                });
            };

            const handleQueryClick = () => {
                UIModule.hideError('pct-query-err');
                const { token, tokenCheckEnabled } = StateModule.get();
                if (!token && tokenCheckEnabled) { UIModule.Toast.show('Token 未設定，請返回修改', 'error'); return; }
                if (!localState.mode) { UIModule.showError('請選擇查詢模式', 'pct-query-err'); return; }
                if (localState.mode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED && localState.masterStatus.size === 0) { UIModule.showError('請至少選擇一個商品銷售時間', 'pct-query-err'); return; }
                if (localState.mode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED && !localState.channelStatus) { UIModule.showError('請選擇通路銷售範圍', 'pct-query-err'); return; }

                StateModule.set({ queryMode: localState.mode, queryInput: localState.input, masterStatusSelection: localState.masterStatus, channelStatusSelection: localState.channelStatus, channelSelection: localState.channels });
                executeQuery();
            };

            // Event Listeners
            modal.querySelector('#pct-mode-wrap').addEventListener('click', e => {
                const card = e.target.closest('.pct-mode-card');
                if (card) {
                    localState.mode = card.dataset.mode;
                    updateDynamicContent();
                    updateSelections();
                }
            });

            dynamicContent.addEventListener('click', e => {
                const option = e.target.closest('[data-value]');
                if (!option) return;
                const { type, value } = option.dataset;
                if (type === 'masterStatus') { localState.masterStatus.has(value) ? localState.masterStatus.delete(value) : localState.masterStatus.add(value); }
                else if (type === 'channels') { localState.channels.has(value) ? localState.channels.delete(value) : localState.channels.add(value); }
                else if (type === 'channelStatus') { localState.channelStatus = localState.channelStatus === value ? '' : value; }
                updateSelections();
            });

            modal.querySelector('#pct-back-to-token').onclick = showTokenDialog;
            modal.querySelector('#pct-query-ok').onclick = handleQueryClick;
            
            updateDynamicContent(); // Initial render
        });
    };
    
    /**
     * 執行主查詢流程
     */
    const executeQuery = async () => {
        UIModule.Modal.close();
        await new Promise(r => setTimeout(r, 100)); // 等待 Modal 關閉動畫
        rerenderTable(); // 立即顯示空的結果表格
        
        const controller = new AbortController();
        StateModule.set({ currentQueryController: controller });
        const oldState = { ...StateModule.get() };
        StateModule.resetQueryState();
        StateModule.set({ queryMode: oldState.queryMode, activeFrontendFilters: oldState.masterStatusSelection });
        
        const { queryMode, queryInput, masterStatusSelection, channelStatusSelection, channelSelection } = oldState;
        
        try {
            UIModule.Progress.show('開始查詢...');
            let rawData = [], processedData = [];
            let detailLoader;

            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                // [v18核心架構] 通路查詢的反向載入流程
                rawData = await DataModule.queryChannelData(channelStatusSelection, [...channelSelection], controller.signal);
                processedData = DataModule.processChannelDataForTable(rawData);
                detailLoader = () => Promise.all(processedData.filter(i => i._loadingProduct).map(item => DataModule.loadProductForSingleRow(item, controller.signal)));
            } else {
                // 原有標準流程
                if (queryMode === ConfigModule.QUERY_MODES.PLAN_CODE) {
                    rawData = (await DataModule.queryMultiplePlanCodes(UtilsModule.splitInput(queryInput), controller.signal, UIModule.Progress.update)).records;
                } else if (queryMode === ConfigModule.QUERY_MODES.PLAN_NAME) {
                    rawData = (await ApiModule.callApi('/planCodeController/query', { planCodeName: queryInput, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, controller.signal)).records || [];
                } else if (queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED) {
                    rawData = (await ApiModule.callApi('/planCodeController/query', { planCodeName: '', currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, controller.signal)).records || [];
                }
                processedData = DataModule.processRawDataForTable(rawData);
                detailLoader = () => Promise.all(processedData.filter(i => i._loadingDetails).map(item => DataModule.loadDetailsForSingleRow(item, controller.signal)));
            }
            
            StateModule.set({ allProcessedData: processedData });
            rerenderTable();
            
            // [2025-07-09] 修正：確保 detailLoader 被呼叫
            if (detailLoader) {
                UIModule.Progress.update(80, '載入詳細資料...');
                await detailLoader();
            }
            
            UIModule.Progress.hide();
            UIModule.Toast.show(`查詢與載入完成`, 'success');
        } catch (e) {
            if (e.name !== 'AbortError') {
                UIModule.Progress.hide();
                UIModule.Toast.show(`查詢失敗: ${e.message}`, 'error', 5000);
                rerenderTable(); // 顯示錯誤訊息
            }
        } finally {
            StateModule.set({ currentQueryController: null });
        }
    };
    
    /**
     * [v18核心功能] 處理表格中可點擊行的重載邏輯
     * @param {string} planCode 商品代碼
     */
    const handleRowClick = async (planCode) => {
        const item = StateModule.get().allProcessedData.find(p => p.planCode === planCode);
        if (!item || (!item._loadingProduct && !item._loadingDetails)) return;
        
        const controller = new AbortController(); // 為單筆查詢建立獨立的 AbortController
        try {
            if (item._loadingProduct) {
                UIModule.Toast.show(`重新查詢 ${planCode} 的商品資訊...`, 'info');
                await DataModule.loadProductForSingleRow(item, controller.signal);
            } else if (item._loadingDetails) {
                UIModule.Toast.show(`重新查詢 ${planCode} 的 POLPLN 與通路...`, 'info');
                await DataModule.loadDetailsForSingleRow(item, controller.signal);
            }
        } catch(e) {
            if (e.name !== 'AbortError') {
                UIModule.Toast.show(`重新查詢 ${planCode} 失敗: ${e.message}`, 'error');
            }
        }
    };
    
    /**
     * 重新渲染整個結果表格
     * 這是 UI 更新的主要入口，處理所有顯示邏輯
     */
    const rerenderTable = () => {
        const state = StateModule.get();
        
        // 1. 資料處理
        let filteredData = state.allProcessedData;
        if (state.activeFrontendFilters.size > 0) { filteredData = filteredData.filter(r => state.activeFrontendFilters.has(r.mainStatus)); }
        if (state.filterSpecial) { filteredData = filteredData.filter(r => r.specialReason); }
        if (state.searchKeyword.trim()) {
            const keyword = state.searchKeyword.toLowerCase();
            filteredData = filteredData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(keyword)));
        }
        const sortedData = DataModule.sortData(filteredData, state.sortKey, state.sortAsc);
        const totalPages = state.pageSize > 0 ? Math.ceil(sortedData.length / state.pageSize) : 1;
        const pageData = state.isFullView ? sortedData : sortedData.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize);

        // 2. 產生 HTML (拆分)
        const headers = [
            { key: 'no', label: 'No' }, { key: 'planCode', label: '代號' }, { key: 'shortName', label: '名稱' },
            { key: 'currency', label: '幣別' }, { key: 'unit', label: '單位' }, { key: 'coverageType', label: '類型' },
            { key: 'saleStartDate', label: '主約銷售日' }, { key: 'saleEndDate', label: '主約停賣日' }, { key: 'mainStatus', label: '險種狀態' },
            { key: 'polpln', label: '商品名稱' }, { key: 'channels', label: '銷售通路' }
        ];

        const getChannelHTML = (channels = []) => {
            const inSale = channels.filter(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE).sort((a,b) => a.channel.localeCompare(b.channel));
            const offSale = channels.filter(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE).sort((a,b) => a.channel.localeCompare(b.channel));
            const renderChannelSpan = c => `<span class="pct-channel-${c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE ? 'insale' : 'offsale'}" title="${c.channel} (${c.status}): ${c.saleStartDate}-${c.saleEndDate}">${c.channel}</span>`;
            
            let parts = [];
            if (inSale.length > 0) parts.push(inSale.map(renderChannelSpan).join(' '));
            if (offSale.length > 0) parts.push(offSale.map(renderChannelSpan).join(' '));
            
            return parts.join('<span class="pct-channel-separator">|</span>') || '...';
        };

        const tableBodyHTML = pageData.map((r, index) => {
            if (r._isErrorRow) return `<tr class="error-row"><td colspan="${headers.length}">代號 ${UtilsModule.escapeHtml(r.planCode)}: ${r.saleEndDate}</td></tr>`;
            
            let rowClass = '';
            if (r.specialReason) rowClass += ' special-row';
            if (r._loadingProduct || r._loadingDetails) rowClass += ' clickable-row';
            
            const specialAttr = r.specialReason ? `title="${UtilsModule.escapeHtml(r.specialReason)}"` : '';

            return `
                <tr data-plan-code="${r.planCode}" class="${rowClass.trim()}" ${specialAttr}>
                    <td class="clickable-cell" data-raw="${state.isFullView ? index + 1 : (state.pageNo - 1) * state.pageSize + index + 1}">${state.isFullView ? index + 1 : (state.pageNo - 1) * state.pageSize + index + 1}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.planCode)}">${UtilsModule.escapeHtml(r.planCode)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.shortName)}">${UtilsModule.escapeHtml(r.shortName)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.currency)}">${UtilsModule.escapeHtml(r.currency)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.unit)}">${UtilsModule.escapeHtml(r.unit)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.coverageType)}">${UtilsModule.escapeHtml(r.coverageType)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.saleStartDate)}">${UtilsModule.escapeHtml(r.saleStartDate)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.saleEndDate)}">${UtilsModule.escapeHtml(r.saleEndDate)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.mainStatus)}">${UtilsModule.escapeHtml(r.mainStatus)}</td>
                    <td class="clickable-cell" data-raw="${UtilsModule.escapeHtml(r.polpln)}">${UtilsModule.escapeHtml(r.polpln)}</td>
                    <td data-raw="${(r.channels||[]).map(c=>`${c.channel}:${c.saleEndDate}`).join('; ')}">${getChannelHTML(r.channels)}</td>
                </tr>`;
        }).join('');

        const modalHTML = `
            <div class="pct-modal-header"><span>查詢結果 (${state.env})</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body">
                <div id="pct-progress-container" class="pct-progress-container" style="display:none;"></div>
                <div class="pct-filter-controls">
                    <div class="pct-search-container"><input type="text" class="pct-search-input" id="pct-search-input" placeholder="可搜尋表格內所有資訊..." value="${UtilsModule.escapeHtml(state.searchKeyword)}"></div>
                    ${state.queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED ? `<div class="pct-status-filters">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<button class="pct-btn pct-status-filter-btn ${state.activeFrontendFilters.has(s)?'pct-btn-primary':'pct-btn-outline'}" data-status="${s}">${s}</button>`).join('')}</div>` : ''}
                </div>
                <div class="pct-table-wrap"><table class="pct-table">
                    <thead><tr>${headers.map(h => `<th data-key="${h.key||''}" class="${state.sortKey === h.key ? (state.sortAsc ? 'sort-asc' : 'sort-desc') : ''}">${h.label}</th>`).join('')}</tr></thead>
                    <tbody>${tableBodyHTML}</tbody>
                </table></div>
            </div>
            <div class="pct-modal-footer">
                <div class="pct-modal-footer-left">
                    <button class="pct-btn pct-btn-secondary" id="pct-view-toggle">${state.isFullView?'分頁顯示':'一頁顯示'}</button>
                    ${state.allProcessedData.some(r=>r.specialReason)?`<button class="pct-btn ${state.filterSpecial?'active':''} pct-filter-btn" id="pct-table-filter">${state.filterSpecial?'顯示全部':'篩選特殊'}</button>`:''}
                </div>
                <div class="pct-pagination" style="display:${state.isFullView?'none':'flex'}"><button id="pct-table-prev" class="pct-btn" ${state.pageNo<=1?'disabled':''}>◀</button><span class="pct-pagination-info">${state.pageNo} / ${totalPages}</span><button id="pct-table-next" class="pct-btn" ${state.pageNo>=totalPages?'disabled':''}>▶</button></div>
                <div class="pct-modal-footer-right"><button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button><button class="pct-btn" id="pct-table-requery">重新查詢</button></div>
            </div>`;

        // 3. 渲染與綁定事件
        UIModule.Modal.show(modalHTML, modal => {
            modal.setAttribute('data-size', 'results');
            
            // --- 事件委派 (Event Delegation) ---
            const table = modal.querySelector('.pct-table');
            if (table) {
                table.addEventListener('click', e => {
                    const th = e.target.closest('th[data-key]');
                    const td = e.target.closest('td.clickable-cell');
                    const tr = e.target.closest('tr.clickable-row');

                    if (th) { // 排序
                        const key = th.dataset.key;
                        if (key) {
                            StateModule.set({ sortAsc: state.sortKey === key ? !state.sortAsc : true, sortKey: key, pageNo: 1 });
                            rerenderTable();
                        }
                    } else if (td) { // 複製單元格
                        UtilsModule.copyTextToClipboard(td.dataset.raw, UIModule.Toast.show);
                    } else if (tr) { // 重新載入行
                        handleRowClick(tr.dataset.planCode);
                    }
                });
            }

            // --- 其他事件綁定 ---
            const searchInput = modal.querySelector('#pct-search-input');
            searchInput.addEventListener('input', EventModule.autoFormatInput);
            searchInput.addEventListener('input', e => {
                clearTimeout(state.searchDebounceTimer);
                state.searchDebounceTimer = setTimeout(() => {
                    StateModule.set({ searchKeyword: e.target.value, pageNo: 1 });
                    rerenderTable();
                }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
            });
            
            modal.querySelector('#pct-view-toggle').onclick = () => { StateModule.set({ isFullView: !state.isFullView, pageNo: 1 }); rerenderTable(); };
            modal.querySelector('#pct-table-prev').onclick = () => { if(state.pageNo > 1) { StateModule.set({pageNo: state.pageNo - 1}); rerenderTable(); }};
            modal.querySelector('#pct-table-next').onclick = () => { if(state.pageNo < totalPages) { StateModule.set({pageNo: state.pageNo + 1}); rerenderTable(); }};
            modal.querySelector('#pct-table-filter')?.addEventListener('click', () => { StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); rerenderTable(); });
            modal.querySelector('#pct-table-copy').onclick = () => {
                const copyText = `${headers.map(h=>h.label).join('\t')}\n` + sortedData.map((r, i) => [i+1, r.planCode, r.shortName, r.currency, r.unit, r.coverageType, r.saleStartDate, r.saleEndDate, r.mainStatus, r.polpln, (r.channels||[]).map(c=>`${c.channel}:${c.saleEndDate}(${c.status})`).join(' / ')].join('\t')).join('\n');
                UtilsModule.copyTextToClipboard(copyText, UIModule.Toast.show);
            };
            modal.querySelector('#pct-table-requery').onclick = showQueryDialog;
            modal.querySelectorAll('.pct-status-filter-btn').forEach(btn => {
                btn.onclick = () => {
                    const status = btn.dataset.status;
                    const filters = state.activeFrontendFilters;
                    filters.has(status) ? filters.delete(status) : filters.add(status);
                    StateModule.set({ pageNo: 1, activeFrontendFilters: filters });
                    rerenderTable();
                };
            });
        });
    };

    return { initialize, rerenderTable };
  })();

  // 啟動工具
  ControllerModule.initialize();
})();
