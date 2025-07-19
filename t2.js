javascript:(function() {
  'use strict';

  // 清理舊工具實例
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  /**
   * 配置管理模組
   */
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '19.0.0-Fixed',
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
    BATCH_SIZES: { MULTI_CODE_QUERY: 10, DETAIL_LOAD: 20 }
  });

  /**
   * 狀態管理模組
   */
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '',
      token: '',
      tokenCheckEnabled: true,
      queryMode: '',
      queryInput: '',
      masterStatusSelection: new Set(),
      channelStatusSelection: '',
      channelSelection: new Set(),
      allProcessedData: [],
      pageNo: 1,
      pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false,
      filterSpecial: false,
      searchKeyword: '',
      sortKey: 'no',
      sortAsc: true,
      activeFrontendFilters: new Set(),
      cacheDetail: new Map(),
      cacheChannel: new Map(),
      cacheProduct: new Map(),
      currentQueryController: null,
      searchDebounceTimer: null
    };
    
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    const resetQueryState = () => {
      set({ 
        allProcessedData: [], 
        pageNo: 1, 
        filterSpecial: false, 
        searchKeyword: '', 
        isFullView: false, 
        activeFrontendFilters: new Set() 
      });
      state.cacheDetail.clear();
      state.cacheChannel.clear();
      state.cacheProduct.clear();
    };
    
    return { get, set, resetQueryState };
  })();

  /**
   * 工具函式模組
   */
  const UtilsModule = (() => {
    const escapeHtml = t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t;
    
    const formatToday = () => {
      const d = new Date();
      return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`;
    };
    
    const formatDateForUI = dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
    
    const formatDateForComparison = dt => {
      if (!dt) return '';
      const p = String(dt).split(' ')[0];
      return /^\d{8}$/.test(p) ? p.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : p;
    };
    
    const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
      if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
      const today = new Date(formatDateForComparison(todayStr));
      const sS = new Date(formatDateForComparison(saleStartStr));
      const sE = new Date(formatDateForComparison(saleEndStr));
      
      if (isNaN(today.getTime()) || isNaN(sS.getTime()) || isNaN(sE.getTime())) {
        return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
      }
      if (sS.getTime() > sE.getTime()) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
      if (today < sS) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
      if (today > sE) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
      return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
    };
    
    const checkSpecialStatus = item => {
      const reasons = [];
      const { mainStatus, channels = [], rawSaleEndDate, rawSaleStartDate, saleEndDate, saleStartDate } = item;
      
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.STOPPED && channels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) {
        reasons.push('主約已停售，但部分通路仍在售。');
      }
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.IN_SALE && channels.length > 0 && channels.every(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) {
        reasons.push('主約為現售，但所有通路皆非現售狀態。');
      }
      
      const mainEndDate = new Date(formatDateForComparison(rawSaleEndDate));
      if (!isNaN(mainEndDate.getTime())) {
        channels.forEach(c => {
          const channelEndDate = new Date(formatDateForComparison(c.rawEnd));
          if (!isNaN(channelEndDate.getTime()) && channelEndDate > mainEndDate) {
            reasons.push(`通路[${c.channel}]迄日(${c.saleEndDate})晚於主約迄日(${saleEndDate})。`);
          }
        });
      }
      
      const mainStartDate = new Date(formatDateForComparison(rawSaleStartDate));
      if (!isNaN(mainStartDate.getTime())) {
        channels.forEach(c => {
          const channelStartDate = new Date(formatDateForComparison(c.rawStart));
          if (!isNaN(channelStartDate.getTime()) && channelStartDate < mainStartDate) {
            reasons.push(`通路[${c.channel}]起日(${c.saleStartDate})早於主約起日(${saleStartDate})。`);
          }
        });
      }
      
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL) {
        reasons.push('主約本身的銷售起迄日期異常(起日>迄日)。');
      }
      
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
    
    return {
      escapeHtml, formatToday, formatDateForUI, getSaleStatus, checkSpecialStatus,
      channelUIToAPI, channelAPIToUI, currencyConvert, unitConvert, coverageTypeConvert,
      copyTextToClipboard, splitInput, toHalfWidthUpperCase
    };
  })();

  /**
   * UI 介面管理模組
   */
  const UIModule = (() => {
    const injectStyle = () => {
      const s = document.createElement('style');
      s.id = ConfigModule.STYLE_ID;
      s.textContent = `
        :root{
          --primary-color:#4A90E2;
          --primary-dark-color:#357ABD;
          --secondary-color:#6C757D;
          --secondary-dark-color:#5A6268;
          --success-color:#5CB85C;
          --success-dark-color:#4CAE4C;
          --error-color:#D9534F;
          --error-dark-color:#C9302C;
          --warning-color:#F0AD4E;
          --warning-dark-color:#EC971F;
          --info-color:#5BC0DE;
          --info-dark-color:#46B8DA;
          --background-light:#F8F8F8;
          --surface-color:#FFFFFF;
          --border-color:#E0E0E0;
          --text-color-dark:#1a1a1a;
          --text-color-light:#333333;
          --box-shadow-light:rgba(0,0,0,0.08);
          --box-shadow-medium:rgba(0,0,0,0.15);
          --box-shadow-strong:rgba(0,0,0,0.3);
          --border-radius-base:6px;
          --border-radius-lg:10px;
          --transition-speed:0.25s;
        }
        
        .pct-modal-mask{
          position:fixed;
          z-index:2147483646;
          top:0;
          left:0;
          width:100vw;
          height:100vh;
          background:rgba(0,0,0,0.25);
          opacity:0;
          transition:opacity var(--transition-speed) ease-out;
        }
        .pct-modal-mask.show{opacity:1;}
        
        .pct-modal{
          font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;
          background:var(--surface-color);
          border-radius:var(--border-radius-lg);
          box-shadow:0 4px 24px var(--box-shadow-strong);
          padding:0;
          max-width:95vw;
          position:fixed;
          top:60px;
          left:50%;
          transform:translateX(-50%) translateY(-20px);
          opacity:0;
          z-index:2147483647;
          transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);
          display:flex;
          flex-direction:column;
        }
        .pct-modal[data-size="query"] { width: 520px; height: 420px; }
        .pct-modal[data-size="results"] { width: 1050px; height: 700px; }
        .pct-modal.show{
          opacity:1;
          transform:translateX(-50%) translateY(0);
        }
        .pct-modal.dragging{transition:none;}
        
        .pct-modal-header{
          padding:16px 50px 16px 20px;
          line-height:1;
          font-size:20px;
          font-weight:bold;
          border-bottom:1px solid var(--border-color);
          color:var(--text-color-dark);
          cursor:grab;
          position:relative;
        }
        .pct-modal-header.dragging{cursor:grabbing;}
        
        .pct-modal-close-btn{
          position:absolute;
          top:50%;
          right:15px;
          transform:translateY(-50%);
          background:transparent;
          border:none;
          font-size:24px;
          line-height:1;
          color:var(--secondary-color);
          cursor:pointer;
          padding:5px;
          width:34px;
          height:34px;
          border-radius:50%;
          transition:background-color .2s, color .2s;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .pct-modal-close-btn:hover{
          background-color:var(--background-light);
          color:var(--text-color-dark);
        }
        
        .pct-modal-body{
          padding:16px 20px 8px 20px;
          flex-grow:1;
          overflow-y:auto;
          min-height:50px;
        }
        .pct-modal[data-size="query"] .pct-modal-body { height: 260px; }
        
        .pct-modal-footer{
          padding:12px 20px 16px 20px;
          border-top:1px solid var(--border-color);
          display:flex;
          justify-content:space-between;
          gap:10px;
          flex-wrap:wrap;
          align-items:center;
          min-height:60px;
        }
        .pct-modal-footer-left,.pct-modal-footer-right{
          display:flex;
          gap:10px;
          align-items:center;
        }
        
        .pct-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          margin:0;
          padding:8px 18px;
          font-size:15px;
          border-radius:var(--border-radius-base);
          border:1px solid transparent;
          background:var(--primary-color);
          color:#fff;
          cursor:pointer;
          transition:all var(--transition-speed);
          font-weight:600;
          box-shadow:0 2px 5px var(--box-shadow-light);
          white-space:nowrap;
        }
        .pct-btn:hover{
          background:var(--primary-dark-color);
          transform:translateY(-1px) scale(1.01);
          box-shadow:0 4px 8px var(--box-shadow-medium);
        }
        .pct-btn:disabled{
          background:#CED4DA;
          color:#A0A0A0;
          cursor:not-allowed;
          transform:none;
          box-shadow:none;
        }
        .pct-btn-secondary{background:var(--secondary-color);}
        .pct-btn-secondary:hover{background:var(--secondary-dark-color);}
        .pct-btn.pct-btn-outline {
          background-color: transparent;
          border-color: var(--secondary-color);
          color: var(--secondary-color);
        }
        .pct-btn.pct-btn-outline:hover {
          background-color: var(--background-light);
          color: var(--text-color-dark);
        }
        .pct-btn.pct-btn-outline.pct-btn-primary {
          background-color: var(--primary-color);
          color: #fff;
        }
        
        .pct-filter-btn{
          font-size:14px;
          padding:5px 12px;
          background:var(--warning-color);
          color:var(--text-color-dark);
          border:1px solid var(--warning-dark-color);
          border-radius:5px;
          cursor:pointer;
          font-weight:600;
        }
        .pct-filter-btn.active{
          background:var(--warning-dark-color);
          color:white;
        }
        
        .pct-input{
          width:100%;
          font-size:16px;
          padding:9px 12px;
          border-radius:5px;
          border:1px solid var(--border-color);
          box-sizing:border-box;
          margin-top:5px;
        }
        .pct-input:focus{
          border-color:var(--primary-color);
          box-shadow:0 0 0 2px rgba(74,144,226,0.2);
          outline:none;
        }
        
        .pct-error{
          color:var(--error-color);
          font-size:13px;
          margin:8px 0 0 0;
          display:block;
        }
        
        .pct-form-group{margin-bottom:20px;}
        
        .pct-mode-card-grid{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:10px;
          margin-bottom:15px;
        }
        
        .pct-mode-card, .pct-sub-option, .pct-channel-option {
          background: var(--background-light);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-base);
          padding: 12px;
          text-align: center;
          cursor: pointer;
          transition: all .2s ease-out;
          font-weight: 500;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 45px;
        }
        .pct-mode-card:hover, .pct-sub-option:hover, .pct-channel-option:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px var(--box-shadow-medium);
          background-color: #f0f7ff;
          border-color: var(--primary-color);
        }
        .pct-mode-card.selected, .pct-sub-option.selected, .pct-channel-option.selected {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
          font-weight: bold;
        }
        
        .pct-sub-option-grid, .pct-channel-option-grid{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:8px;
        }
        
        .pct-table-wrap{
          flex:1;
          overflow:auto;
          margin:15px 0;
          border:1px solid var(--border-color);
          border-radius:var(--border-radius-base);
        }
        
        .pct-table{
          border-collapse:collapse;
          width:100%;
          font-size:13px;
          background:var(--surface-color);
          table-layout:fixed;
          min-width:1000px;
        }
        .pct-table th, .pct-table td{
          border:1px solid #ddd;
          padding:6px 4px;
          vertical-align:top;
          word-wrap:break-word;
        }
        .pct-table th {
          background:#f8f8f8;
          position:sticky;
          top:0;
          z-index:1;
          cursor:pointer;
          text-align:center;
          font-weight:bold;
          font-size:12px;
        }
        .pct-table th:nth-child(1), .pct-table th:nth-child(2), .pct-table th:nth-child(9) { width: 6.8%; }
        .pct-table th:nth-child(3) { width: 19.3%; }
        .pct-table th:nth-child(4) { width: 5.7%; }
        .pct-table th:nth-child(5), .pct-table th:nth-child(6) { width: 4.5%; }
        .pct-table th:nth-child(7), .pct-table th:nth-child(8) { width: 11.4%; }
        .pct-table th:nth-child(10) { width: 9.1%; }
        .pct-table th:nth-child(11) { width: 13.6%; }
        .pct-table th[data-key]{
          position:relative;
          padding-right:20px;
        }
        .pct-table th[data-key]::after{
          content:'';
          position:absolute;
          right:8px;
          top:50%;
          transform:translateY(-50%);
          opacity:0.3;
          font-size:12px;
          transition:opacity 0.2s;
          border:4px solid transparent;
        }
        .pct-table th[data-key].sort-asc::after{
          border-bottom-color:var(--primary-color);
          opacity:1;
        }
        .pct-table th[data-key].sort-desc::after{
          border-top-color:var(--primary-color);
          opacity:1;
        }
        .pct-table tr:hover{background:#e3f2fd;}
        .pct-table tr.special-row{
          background:#fffde7;
          border-left:4px solid var(--warning-color);
          cursor:help;
        }
        .pct-table tr.clickable-row { cursor: pointer; }
        .pct-table td.clickable-cell { cursor: cell; }
        .pct-channel-insale { color: var(--primary-color); font-weight: bold; }
        .pct-channel-offsale { color: var(--error-color); }
        .pct-channel-separator { margin: 0 4px; color: #ccc; }
        
        .pct-toast{
          position:fixed;
          left:50%;
          top:30px;
          transform:translateX(-50%);
          background:rgba(0,0,0,0.8);
          color:#fff;
          padding:10px 22px;
          border-radius:var(--border-radius-base);
          font-size:16px;
          z-index:2147483647;
          opacity:0;
          pointer-events:none;
          transition:opacity .3s,transform .3s;
          box-shadow:0 4px 12px rgba(0,0,0,0.2);
          white-space:nowrap;
        }
        .pct-toast.show{
          opacity:1;
          transform:translateX(-50%) translateY(0);
          pointer-events:auto;
        }
        .pct-toast.success{background:var(--success-color);}
        .pct-toast.error{background:var(--error-color);}
        .pct-toast.warning{background:var(--warning-color);color:var(--text-color-dark);}
        .pct-toast.info{background:var(--info-color);}
        
        .pct-confirm-toast{
          display:flex;
          align-items:center;
          gap:15px;
        }
        .pct-confirm-toast .pct-btn{
          padding:5px 10px;
          font-size:14px;
        }
        
        .pct-pagination{
          display:flex;
          justify-content:center;
          align-items:center;
          gap:10px;
        }
        .pct-pagination-info{
          font-size:14px;
          color:var(--text-color-light);
        }
        
        .pct-progress-container{
          display:none;
          align-items:center;
          gap:16px;
          padding:12px;
          background-color:#f0f8ff;
          border-radius:var(--border-radius-base);
          margin-bottom:16px;
        }
        .pct-progress-bar-wrapper{
          flex-grow:1;
          height:10px;
          background-color:rgba(0,0,0,0.1);
          border-radius:5px;
          overflow:hidden;
        }
        .pct-progress-bar{
          width:0%;
          height:100%;
          background-color:var(--primary-color);
          transition:width .4s ease-out;
          border-radius:5px;
        }
        .pct-progress-text{
          font-size:14px;
          color:var(--text-color-dark);
          white-space:nowrap;
        }
        .pct-abort-btn{
          background-color:var(--error-color) !important;
          color:white !important;
          padding:5px 14px !important;
          font-size:14px !important;
        }
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
        setTimeout(() => { 
          mask.classList.add('show'); 
          modal.classList.add('show'); 
        }, 10);
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
    
    const showError = (msg, elId) => {
      const el = document.getElementById(elId);
      if (el) {
        el.textContent = msg;
        el.style.display = 'block';
      } else {
        Toast.show(msg, 'error');
      }
    };
    
    const hideError = (elId) => {
      const el = document.getElementById(elId);
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    };

    return { injectStyle, Toast, Modal, Progress, showError, hideError };
  })();

  /**
   * 事件管理模組
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
      document.removeEventListener('keydown', handleEscKey);
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
   * API 服務模組
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
        return res.ok && (typeof data.total !== 'undefined' || typeof data.records !== 'undefined');
      } catch (e) {
        return false;
      }
    };

    return { callApi, verifyToken };
  })();

  /**
   * 資料處理模組
   */
  const DataModule = (() => {
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
            const res = await ApiModule.callApi('/planCodeController/query', { 
              planCode: c, 
              currentPage: 1, 
              pageSize: 10 
            }, signal);
            return (res.records && res.records.length > 0) ? res.records : [{ 
              planCode: c, 
              _apiStatus: '查無資料', 
              _isErrorRow: true 
            }];
          } catch (e) {
            if (e.name === 'AbortError') throw e;
            return [{ 
              planCode: c, 
              _apiStatus: `查詢失敗(${e.message})`, 
              _isErrorRow: true 
            }];
          }
        });
        
        allRecords.push(...(await Promise.all(promises)).flat());
      }
      return { records: allRecords };
    };
    
    const queryChannelData = async (mode, channels, signal) => {
      const channelsToQuery = channels.length > 0 ? channels : ConfigModule.FIELD_MAPS.CHANNELS;
      
      const query = async (ch, inSale) => {
        const params = { 
          planCode: "", 
          channel: UtilsModule.channelUIToAPI(ch), 
          saleEndDate: inSale ? "9999-12-31 00:00:00" : "", 
          pageIndex: 1, 
          size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL 
        };
        const res = await ApiModule.callApi('/planCodeSaleDateController/query', params, signal);
        return (res.planCodeSaleDates?.records || []).map(r => ({ 
          ...r, 
          channel: UtilsModule.channelAPIToUI(r.channel) 
        }));
      };
      
      const queryAll = async (chList) => (await Promise.all(chList.map(c => query(c, false)))).flat();
      const queryCurrent = async (chList) => (await Promise.all(chList.map(c => query(c, true)))).flat();

      if (mode === '停售') {
        const [all, current] = await Promise.all([queryAll(channelsToQuery), queryCurrent(channelsToQuery)]);
        const currentSet = new Set(current.map(i => `${i.planCode}_${i.channel}`));
        return all.filter(i => !currentSet.has(`${i.planCode}_${i.channel}`));
      } else {
        return await queryCurrent(channelsToQuery);
      }
    };
    
    const processRawDataForTable = (rawData) => {
      const today = UtilsModule.formatToday();
      return rawData.map((item, index) => {
        if (item._isErrorRow) {
          return { 
            no: index + 1, 
            planCode: String(item.planCode || '-'), // 確保字串格式
            shortName: '-', 
            currency: '-', 
            unit: '-', 
            coverageType: '-', 
            saleStartDate: '-', 
            rawSaleStartDate: null, 
            saleEndDate: `查詢狀態: ${UtilsModule.escapeHtml(item._apiStatus)}`, 
            rawSaleEndDate: null, 
            mainStatus: '-', 
            polpln: '...', 
            channels: [], 
            specialReason: '', 
            _isErrorRow: true, 
            _loadingDetails: false 
          };
        }
        
        return {
          no: index + 1,
          planCode: String(item.planCode || '-'), // 確保字串格式，保持前導零
          shortName: item.shortName || item.planName || '-',
          currency: UtilsModule.currencyConvert(item.currency || item.cur),
          unit: UtilsModule.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
          coverageType: UtilsModule.coverageTypeConvert(item.coverageType || item.type),
          saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate),
          rawSaleStartDate: item.saleStartDate,
          saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate),
          rawSaleEndDate: item.saleEndDate,
          mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate),
          polpln: '...', 
          channels: [], 
          specialReason: '',
          _isErrorRow: false, 
          _originalItem: item, 
          _loadingDetails: true
        };
      });
    };
    
    const processChannelDataForTable = (rawData) => {
      const today = UtilsModule.formatToday();
      const groupedByPlanCode = rawData.reduce((acc, cur) => {
        if (!acc[cur.planCode]) {
          acc[cur.planCode] = {
            no: Object.keys(acc).length + 1, 
            planCode: String(cur.planCode), // 確保字串格式
            shortName: '...', 
            currency: '...', 
            unit: '...', 
            coverageType: '...',
            saleStartDate: '...', 
            rawSaleStartDate: null, 
            saleEndDate: '...', 
            rawSaleEndDate: null,
            mainStatus: '...', 
            polpln: '...', 
            channels: [], 
            specialReason: '',
            _isErrorRow: false, 
            _loadingProduct: true, 
            _loadingDetails: true
          };
        }
        acc[cur.planCode].channels.push({
          channel: cur.channel,
          saleStartDate: UtilsModule.formatDateForUI(cur.saleStartDate),
          saleEndDate: UtilsModule.formatDateForUI(cur.saleEndDate),
          rawStart: cur.saleStartDate, 
          rawEnd: cur.saleEndDate,
          status: UtilsModule.getSaleStatus(today, cur.saleStartDate, cur.saleEndDate)
        });
        return acc;
      }, {});
      
      return Object.values(groupedByPlanCode);
    };

    const getProductDetails = async (planCode, signal) => {
      const { cacheProduct } = StateModule.get();
      if (cacheProduct.has(planCode)) return cacheProduct.get(planCode);
      
      const res = await ApiModule.callApi('/planCodeController/query', { 
        planCode, 
        currentPage: 1, 
        pageSize: 1 
      }, signal);
      const productData = (res.records && res.records.length > 0) ? res.records[0] : null;
      if(productData) cacheProduct.set(planCode, productData);
      return productData;
    };

    const getPolplnData = async (planCode, signal) => {
      const { cacheDetail } = StateModule.get();
      if (cacheDetail.has(planCode)) return cacheDetail.get(planCode);
      
      const detail = await ApiModule.callApi('/planCodeController/queryDetail', { 
        planCode, 
        currentPage: 1, 
        pageSize: 50 
      }, signal);
      const polplnRecords = (detail.records || []).map(r => r.polpln);
      const processedPolpln = processMultiplePolpln(polplnRecords);
      cacheDetail.set(planCode, processedPolpln);
      return processedPolpln;
    };

    const getChannelDetails = async (planCode, signal) => {
      const { cacheChannel } = StateModule.get();
      if (cacheChannel.has(planCode)) return cacheChannel.get(planCode);
      
      const sale = await ApiModule.callApi('/planCodeSaleDateController/query', { 
        planCode, 
        currentPage: 1, 
        pageSize: 50 
      }, signal);
      const channels = (sale.planCodeSaleDates?.records || []).map(r => ({
        channel: UtilsModule.channelAPIToUI(r.channel),
        saleStartDate: UtilsModule.formatDateForUI(r.saleStartDate),
        saleEndDate: UtilsModule.formatDateForUI(r.saleEndDate),
        rawStart: r.saleStartDate, 
        rawEnd: r.saleEndDate
      }));
      cacheChannel.set(planCode, channels);
      return channels;
    };
    
    const loadDetailsForSingleRow = async (item, signal) => {
      const today = UtilsModule.formatToday();
      const [polpln, channels] = await Promise.all([
        getPolplnData(item.planCode, signal),
        getChannelDetails(item.planCode, signal)
      ]);
      
      item.polpln = polpln || '無資料';
      item.channels = channels.map(c => ({
        ...c, 
        status: UtilsModule.getSaleStatus(today, c.rawStart, c.rawEnd)
      }));
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
   * 主控制器模組
   */
  const ControllerModule = (() => {
    
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

    const showTokenDialog = () => {
      const { env } = StateModule.get();
      const html = `
        <div class="pct-modal-header">設定 Token (${env})</div>
        <button class="pct-modal-close-btn">×</button>
        <div class="pct-modal-body">
          <div class="pct-form-group">
            <label for="pct-token-input">請貼上您的 SSO-TOKEN 或 euisToken：</label>
            <textarea id="pct-token-input" class="pct-input" rows="4" placeholder="(使用者在此貼上 Token...)"></textarea>
            <span id="token-error" class="pct-error" style="display:none;"></span>
          </div>
        </div>
        <div class="pct-modal-footer">
          <div class="pct-modal-footer-left"></div>
          <div class="pct-modal-footer-right">
            <button id="pct-skip-verification" class="pct-btn pct-btn-outline">略過</button>
            <button id="pct-verify-token" class="pct-btn">驗證</button>
          </div>
        </div>
      `;

      UIModule.Modal.show(html, (modal) => {
        modal.setAttribute('data-size', 'query');
        
        const tokenInput = document.getElementById('pct-token-input');
        const verifyBtn = document.getElementById('pct-verify-token');
        const skipBtn = document.getElementById('pct-skip-verification');

        const handleVerifyToken = async () => {
          const token = tokenInput.value.trim();
          if (!token) {
            UIModule.showError('請輸入 Token', 'token-error');
            return;
          }
          
          UIModule.hideError('token-error');
          verifyBtn.disabled = true;
          verifyBtn.textContent = '驗證中...';
          
          try {
            if (await ApiModule.verifyToken(token)) {
              StateModule.set({ token });
              UIModule.Toast.show('Token 驗證成功', 'success');
              showQueryDialog();
            } else {
              UIModule.showError('Token 驗證失敗，請檢查後重試', 'token-error');
            }
          } catch (error) {
            UIModule.showError(`驗證過程中發生錯誤: ${error.message}`, 'token-error');
          } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '驗證';
          }
        };

        const handleSkipVerification = () => {
          const token = tokenInput.value.trim();
          StateModule.set({ token, tokenCheckEnabled: false });
          UIModule.Toast.show('已略過驗證', 'warning');
          showQueryDialog();
        };

        verifyBtn.addEventListener('click', handleVerifyToken);
        skipBtn.addEventListener('click', handleSkipVerification);
        
        tokenInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            handleVerifyToken();
          }
        });
      });
    };

    const showQueryDialog = () => {
      StateModule.resetQueryState();
      const { env } = StateModule.get();
      
      const html = `
        <div class="pct-modal-header">選擇查詢條件 (${env})</div>
        <button class="pct-modal-close-btn">×</button>
        <div class="pct-modal-body">
          <div class="pct-form-group">
            <label>查詢模式:</label>
            <div class="pct-mode-card-grid">
              <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_CODE}">商品代號</div>
              <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_NAME}">商品名稱</div>
              <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.MASTER_CLASSIFIED}">商品銷售時間</div>
              <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED}">通路銷售時間</div>
            </div>
            
            <div id="pct-dynamic-options" style="display:none;">
              <!-- 動態選項將在這裡插入 -->
            </div>
            
            <span id="query-error" class="pct-error" style="display:none;"></span>
          </div>
        </div>
        <div class="pct-modal-footer">
          <div class="pct-modal-footer-left">
            <button id="pct-change-token" class="pct-btn pct-btn-outline">修改 Token</button>
          </div>
          <div class="pct-modal-footer-right">
            <button id="pct-start-query" class="pct-btn" disabled>開始查詢</button>
          </div>
        </div>
      `;

      UIModule.Modal.show(html, (modal) => {
        modal.setAttribute('data-size', 'query');
        
        const modeCards = modal.querySelectorAll('.pct-mode-card');
        const dynamicOptions = document.getElementById('pct-dynamic-options');
        const startQueryBtn = document.getElementById('pct-start-query');
        const changeTokenBtn = document.getElementById('pct-change-token');

        const updateDynamicOptions = (mode) => {
          let content = '';
          
          switch (mode) {
            case ConfigModule.QUERY_MODES.PLAN_CODE:
              content = `
                <label for="pct-plan-code-input">商品代碼：(多筆可用空格、逗號或換行分隔)</label>
                <textarea id="pct-plan-code-input" class="pct-input" rows="3" placeholder="(使用者在此輸入商品代碼...)"></textarea>
              `;
              break;
              
            case ConfigModule.QUERY_MODES.PLAN_NAME:
              content = `
                <label for="pct-plan-name-input">商品名稱關鍵字：</label>
                <input type="text" id="pct-plan-name-input" class="pct-input" placeholder="例如：健康、終身">
              `;
              break;
              
            case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
              content = `
                <label>主約銷售狀態：</label>
                <div class="pct-sub-option-grid">
                  <div class="pct-sub-option" data-status="${ConfigModule.MASTER_STATUS_TYPES.IN_SALE}">🟢 現售</div>
                  <div class="pct-sub-option" data-status="${ConfigModule.MASTER_STATUS_TYPES.STOPPED}">🔴 停售</div>
                  <div class="pct-sub-option" data-status="${ConfigModule.MASTER_STATUS_TYPES.PENDING}">🔵 尚未開賣</div>
                  <div class="pct-sub-option" data-status="${ConfigModule.MASTER_STATUS_TYPES.ABNORMAL}">🟡 日期異常</div>
                </div>
              `;
              break;
              
            case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
              content = `
                <label>選擇通路：(可多選)</label>
                <div class="pct-channel-option-grid">
                  ${ConfigModule.FIELD_MAPS.CHANNELS.map(ch => 
                    `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`
                  ).join('')}
                </div>
                <label style="margin-top:10px;">銷售範圍：</label>
                <div class="pct-sub-option-grid">
                  <div class="pct-sub-option" data-range="現售">現售商品</div>
                  <div class="pct-sub-option" data-range="停售">停售商品</div>
                </div>
              `;
              break;
          }
          
          if (content) {
            dynamicOptions.innerHTML = content;
            dynamicOptions.style.display = 'block';
            bindDynamicEvents();
          } else {
            dynamicOptions.style.display = 'none';
          }
          
          checkCanStartQuery();
        };

        const bindDynamicEvents = () => {
          // 綁定主約狀態選擇
          document.querySelectorAll('.pct-sub-option[data-status]').forEach(option => {
            option.addEventListener('click', () => {
              option.classList.toggle('selected');
              updateMasterStatusSelection();
              checkCanStartQuery();
            });
          });

          // 綁定通路選擇
          document.querySelectorAll('.pct-channel-option').forEach(option => {
            option.addEventListener('click', () => {
              option.classList.toggle('selected');
              updateChannelSelection();
              checkCanStartQuery();
            });
          });

          // 綁定範圍選擇
          document.querySelectorAll('.pct-sub-option[data-range]').forEach(option => {
            option.addEventListener('click', () => {
              document.querySelectorAll('.pct-sub-option[data-range]').forEach(o => o.classList.remove('selected'));
              option.classList.add('selected');
              StateModule.set({ channelStatusSelection: option.dataset.range });
              checkCanStartQuery();
            });
          });

          // 綁定輸入框事件
          const codeInput = document.getElementById('pct-plan-code-input');
          const nameInput = document.getElementById('pct-plan-name-input');
          
          if (codeInput) {
            codeInput.addEventListener('input', EventModule.autoFormatInput);
            codeInput.addEventListener('input', checkCanStartQuery);
          }
          
          if (nameInput) {
            nameInput.addEventListener('input', EventModule.autoFormatInput);
            nameInput.addEventListener('input', checkCanStartQuery);
          }
        };

        const updateMasterStatusSelection = () => {
          const selected = new Set();
          document.querySelectorAll('.pct-sub-option[data-status].selected').forEach(option => {
            selected.add(option.dataset.status);
          });
          StateModule.set({ masterStatusSelection: selected });
        };

        const updateChannelSelection = () => {
          const selected = new Set();
          document.querySelectorAll('.pct-channel-option.selected').forEach(option => {
            selected.add(option.dataset.channel);
          });
          StateModule.set({ channelSelection: selected });
        };

        const checkCanStartQuery = () => {
          const state = StateModule.get();
          let canStart = false;

          switch (state.queryMode) {
            case ConfigModule.QUERY_MODES.PLAN_CODE:
              const codeInput = document.getElementById('pct-plan-code-input');
              canStart = codeInput && codeInput.value.trim() !== '';
              break;
              
            case ConfigModule.QUERY_MODES.PLAN_NAME:
              const nameInput = document.getElementById('pct-plan-name-input');
              canStart = nameInput && nameInput.value.trim() !== '';
              break;
              
            case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
              canStart = state.masterStatusSelection.size > 0;
              break;
              
            case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
              canStart = state.channelSelection.size > 0 && state.channelStatusSelection !== '';
              break;
          }

          startQueryBtn.disabled = !canStart;
        };

        // 綁定模式卡片事件
        modeCards.forEach(card => {
          card.addEventListener('click', () => {
            // 防止畫面跳動：記住當前滾動位置
            const currentScrollTop = modal.querySelector('.pct-modal-body').scrollTop;
            
            modeCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            const mode = card.dataset.mode;
            StateModule.set({ 
              queryMode: mode, 
              masterStatusSelection: new Set(), 
              channelSelection: new Set(), 
              channelStatusSelection: '' 
            });
            
            updateDynamicOptions(mode);
            
            // 恢復滾動位置，防止跳動
            modal.querySelector('.pct-modal-body').scrollTop = currentScrollTop;
          });
        });

        // 綁定其他按鈕事件
        changeTokenBtn.addEventListener('click', showTokenDialog);
        startQueryBtn.addEventListener('click', handleStartQuery);
      });
    };

    const handleStartQuery = async () => {
      const state = StateModule.get();
      UIModule.hideError('query-error');

      try {
        let queryInput = '';
        
        switch (state.queryMode) {
          case ConfigModule.QUERY_MODES.PLAN_CODE:
            const codeInput = document.getElementById('pct-plan-code-input');
            if (!codeInput || !codeInput.value.trim()) {
              throw new Error('請輸入商品代碼');
            }
            queryInput = codeInput.value.trim();
            break;
            
          case ConfigModule.QUERY_MODES.PLAN_NAME:
            const nameInput = document.getElementById('pct-plan-name-input');
            if (!nameInput || !nameInput.value.trim()) {
              throw new Error('請輸入商品名稱關鍵字');
            }
            queryInput = nameInput.value.trim();
            break;
            
          case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
            if (state.masterStatusSelection.size === 0) {
              throw new Error('請選擇至少一個主約銷售狀態');
            }
            break;
            
          case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
            if (state.channelSelection.size === 0) {
              throw new Error('請選擇至少一個通路');
            }
            if (!state.channelStatusSelection) {
              throw new Error('請選擇銷售範圍');
            }
            break;
            
          default:
            throw new Error('請選擇查詢模式');
        }

        StateModule.set({ queryInput });
        await executeQuery();
        
      } catch (error) {
        UIModule.showError(error.message, 'query-error');
      }
    };

    const executeQuery = async () => {
      const state = StateModule.get();
      const controller = new AbortController();
      StateModule.set({ currentQueryController: controller });

      try {
        UIModule.Progress.show('正在查詢中...');
        
        let rawData;
        
        switch (state.queryMode) {
          case ConfigModule.QUERY_MODES.PLAN_CODE:
            const codes = UtilsModule.splitInput(state.queryInput);
            rawData = await DataModule.queryMultiplePlanCodes(codes, controller.signal, UIModule.Progress.update);
            break;
            
          case ConfigModule.QUERY_MODES.PLAN_NAME:
            UIModule.Progress.update(50, '查詢商品名稱...');
            rawData = await ApiModule.callApi('/planCodeController/query', {
              planCodeName: state.queryInput,
              currentPage: 1,
              pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER
            }, controller.signal);
            break;
            
          case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
            UIModule.Progress.update(30, '查詢主約銷售狀態...');
            const allProducts = await ApiModule.callApi('/planCodeController/query', {
              currentPage: 1,
              pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER
            }, controller.signal);
            
            // 根據選擇的狀態篩選
            const today = UtilsModule.formatToday();
            rawData = {
              records: allProducts.records.filter(item => {
                const status = UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate);
                return state.masterStatusSelection.has(status);
              })
            };
            break;
            
          case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
            UIModule.Progress.update(30, '查詢通路銷售資料...');
            const channelRecords = await DataModule.queryChannelData(
              state.channelStatusSelection, 
              Array.from(state.channelSelection), 
              controller.signal
            );
            rawData = { records: channelRecords };
            break;
        }

        UIModule.Progress.update(80, '處理資料中...');
        
        let processedData;
        if (state.queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
          processedData = DataModule.processChannelDataForTable(rawData.records);
        } else {
          processedData = DataModule.processRawDataForTable(rawData.records);
        }

        StateModule.set({ allProcessedData: processedData });
        UIModule.Progress.update(100, '查詢完成');
        
        setTimeout(() => {
          UIModule.Progress.hide();
          showResultsDialog();
        }, 500);

      } catch (error) {
        UIModule.Progress.hide();
        if (error.name !== 'AbortError') {
          UIModule.Toast.show(`查詢失敗: ${error.message}`, 'error');
        }
      } finally {
        StateModule.set({ currentQueryController: null });
      }
    };

    const showResultsDialog = () => {
      const state = StateModule.get();
      const totalCount = state.allProcessedData.length;

      const html = `
        <div class="pct-modal-header">查詢結果 (${state.env})</div>
        <button class="pct-modal-close-btn">×</button>
        <div class="pct-modal-body">
          <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0;">
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="font-size: 14px; color: #666;">搜尋:</span>
                <input type="text" id="pct-search-input" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; font-size: 13px;" placeholder="">
              </div>
              <div id="pct-status-filters" style="display: flex; gap: 5px;"></div>
            </div>
            
            <div class="pct-table-wrap">
              <table class="pct-table">
                <thead>
                  <tr>
                    <th data-key="no">No<span style="visibility:hidden;">▲</span></th>
                    <th data-key="planCode">代號</th>
                    <th data-key="shortName">名稱</th>
                    <th data-key="currency">幣別</th>
                    <th data-key="unit">單位</th>
                    <th data-key="coverageType">類型</th>
                    <th data-key="saleStartDate">主約銷售日</th>
                    <th data-key="saleEndDate">主約停賣日</th>
                    <th data-key="mainStatus">險種狀態</th>
                    <th data-key="polpln">商品名稱(POLPLN)</th>
                    <th>銷售通路</th>
                  </tr>
                </thead>
                <tbody id="pct-table-body">
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="pct-modal-footer">
          <div class="pct-modal-footer-left">
            <button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button>
            <button id="pct-filter-special" class="pct-btn pct-btn-outline">篩選特殊</button>
          </div>
          <div class="pct-modal-footer-center">
            <div class="pct-pagination">
              <button id="pct-prev-page" class="pct-btn pct-btn-outline">◀</button>
              <span class="pct-pagination-info" id="pct-page-info">-</span>
              <button id="pct-next-page" class="pct-btn pct-btn-outline">▶</button>
            </div>
          </div>
          <div class="pct-modal-footer-right">
            <button id="pct-copy-all" class="pct-btn pct-btn-secondary">一鍵複製</button>
            <button id="pct-back-to-query" class="pct-btn">重新查詢</button>
          </div>
        </div>
      `;

      UIModule.Modal.show(html, (modal) => {
        modal.setAttribute('data-size', 'results');
        
        // 修正查詢結果視窗的標題列間距
        const header = modal.querySelector('.pct-modal-header');
        if (header) {
          header.style.padding = '12px 50px 12px 20px';
        }
        
        setupResultsDialog(modal);
        rerenderTable();
        
        UIModule.Toast.show(`查詢完成，共找到 ${totalCount} 筆資料`, 'success');
      });
    };

    const setupResultsDialog = (modal) => {
      const searchInput = document.getElementById('pct-search-input');
      const toggleViewBtn = document.getElementById('pct-toggle-view');
      const filterSpecialBtn = document.getElementById('pct-filter-special');
      const prevPageBtn = document.getElementById('pct-prev-page');
      const nextPageBtn = document.getElementById('pct-next-page');
      const copyAllBtn = document.getElementById('pct-copy-all');
      const backToQueryBtn = document.getElementById('pct-back-to-query');
      const tableBody = document.getElementById('pct-table-body');

      // 搜尋功能
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          StateModule.set({ searchKeyword: searchInput.value.trim(), pageNo: 1 });
          rerenderTable();
        }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
      });

      // 表格事件委派
      tableBody.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;

        const planCode = row.dataset.plancode;
        if (!planCode) return;

        if (target.classList.contains('clickable-cell')) {
          // 複製儲存格內容
          const cellValue = target.textContent.trim();
          if (cellValue && cellValue !== '...' && cellValue !== '-') {
            UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show);
          }
        } else if (target.classList.contains('load-details-btn')) {
          // 載入詳細資料
          loadDetailsForRow(planCode);
        } else if (target.classList.contains('load-product-btn')) {
          // 載入主檔資料
          loadProductForRow(planCode);
        } else if (row.classList.contains('clickable-row')) {
          // 整行重載
          loadDetailsForRow(planCode);
        }
      });

      // 表格標題排序
      modal.querySelectorAll('th[data-key]').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.key;
          const state = StateModule.get();
          
          if (state.sortKey === key) {
            StateModule.set({ sortAsc: !state.sortAsc });
          } else {
            StateModule.set({ sortKey: key, sortAsc: true });
          }
          
          rerenderTable();
        });
      });

      // 其他按鈕事件
      toggleViewBtn.addEventListener('click', () => {
        const state = StateModule.get();
        StateModule.set({ isFullView: !state.isFullView, pageNo: 1 });
        toggleViewBtn.textContent = state.isFullView ? '分頁顯示' : '一頁顯示';
        rerenderTable();
      });

      filterSpecialBtn.addEventListener('click', () => {
        const state = StateModule.get();
        StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 });
        filterSpecialBtn.classList.toggle('pct-btn-primary', state.filterSpecial);
        rerenderTable();
      });

      prevPageBtn.addEventListener('click', () => {
        const state = StateModule.get();
        if (state.pageNo > 1) {
          StateModule.set({ pageNo: state.pageNo - 1 });
          rerenderTable();
        }
      });

      nextPageBtn.addEventListener('click', () => {
        const state = StateModule.get();
        const filteredData = getFilteredData();
        const maxPage = Math.ceil(filteredData.length / state.pageSize);
        if (state.pageNo < maxPage) {
          StateModule.set({ pageNo: state.pageNo + 1 });
          rerenderTable();
        }
      });

      copyAllBtn.addEventListener('click', copyAllResults);
      backToQueryBtn.addEventListener('click', showQueryDialog);
    };

    const getFilteredData = () => {
      const state = StateModule.get();
      let data = [...state.allProcessedData];

      // 搜尋篩選
      if (state.searchKeyword) {
        const keyword = state.searchKeyword.toLowerCase();
        data = data.filter(item => 
          Object.values(item).some(value => 
            String(value).toLowerCase().includes(keyword)
          )
        );
      }

      // 特殊狀態篩選
      if (state.filterSpecial) {
        data = data.filter(item => item.specialReason && item.specialReason.trim() !== '');
      }

      // 前端篩選器篩選
      if (state.activeFrontendFilters.size > 0) {
        data = data.filter(item => 
          state.activeFrontendFilters.has(item.mainStatus)
        );
      }

      // 排序
      data = DataModule.sortData(data, state.sortKey, state.sortAsc);

      return data;
    };

    const rerenderTable = () => {
      const state = StateModule.get();
      const filteredData = getFilteredData();
      
      // 修正：確保只顯示實際篩選結果的數量
      const totalItems = filteredData.length;
      
      // 分頁處理
      let displayData = filteredData;
      if (!state.isFullView) {
        const startIdx = (state.pageNo - 1) * state.pageSize;
        const endIdx = startIdx + state.pageSize;
        displayData = filteredData.slice(startIdx, endIdx);
      }

      // 更新表格內容
      const tableBody = document.getElementById('pct-table-body');
      if (tableBody) {
        tableBody.innerHTML = displayData.map(item => renderTableRow(item)).join('');
      }

      // 更新排序指示器
      document.querySelectorAll('th[data-key]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.key === state.sortKey) {
          th.classList.add(state.sortAsc ? 'sort-asc' : 'sort-desc');
        }
      });

      // 更新分頁資訊
      updatePaginationInfo(totalItems);
      
      // 更新狀態篩選器
      updateStatusFilters();
    };

    const renderTableRow = (item) => {
      const specialClass = item.specialReason ? 'special-row' : '';
      const clickableClass = (item._loadingDetails || item._loadingProduct) ? 'clickable-row' : '';
      
      return `
        <tr class="${specialClass} ${clickableClass}" data-plancode="${item.planCode}" ${item.specialReason ? `title="${UtilsModule.escapeHtml(item.specialReason)}"` : ''}>
          <td class="clickable-cell">${item.no}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td>
          <td class="clickable-cell" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${UtilsModule.escapeHtml(item.shortName)}">${UtilsModule.escapeHtml(item.shortName)}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td>
          <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td>
          <td>${renderStatusPill(item.mainStatus)}</td>
          <td>${renderPolplnCell(item)}</td>
          <td>${renderChannelsCell(item.channels)}</td>
        </tr>
      `;
    };

    const renderStatusPill = (status) => {
      const statusConfig = ConfigModule.STATUS_COLORS || {};
      const config = statusConfig[status] || { text: status, emoji: '' };
      return `<span class="clickable-cell" style="display: inline-block; min-width: 80px; text-align: center; padding: 2px 6px; background: #f0f0f0; border-radius: 12px; font-size: 11px;">${config.emoji} ${config.text}</span>`;
    };

    const renderPolplnCell = (item) => {
      if (item._loadingDetails) {
        return `<button class="load-details-btn" style="padding: 2px 8px; border: 1px solid #ddd; background: #f9f9f9; border-radius: 3px; cursor: pointer; font-size: 11px;">載入</button>`;
      }
      return `<span class="clickable-cell">${UtilsModule.escapeHtml(item.polpln)}</span>`;
    };

    const renderChannelsCell = (channels) => {
      if (!channels || channels.length === 0) return '-';
      
      // 按狀態分組並排序
      const activeChannels = channels.filter(ch => ch.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)
        .sort((a, b) => a.channel.localeCompare(b.channel));
      const inactiveChannels = channels.filter(ch => ch.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)
        .sort((a, b) => a.channel.localeCompare(b.channel));
      
      const activeHTML = activeChannels.map(ch => 
        `<span class="pct-channel-insale" title="${ch.channel} (${ch.status}): ${ch.saleStartDate}-${ch.saleEndDate}">${ch.channel}</span>`
      ).join(' ');
      
      const inactiveHTML = inactiveChannels.map(ch => 
        `<span class="pct-channel-offsale" title="${ch.channel} (${ch.status}): ${ch.saleStartDate}-${ch.saleEndDate}">${ch.channel}</span>`
      ).join(' ');
      
      const separator = activeChannels.length > 0 && inactiveChannels.length > 0 ? 
        '<span class="pct-channel-separator">|</span>' : '';
      
      return activeHTML + separator + inactiveHTML;
    };

    const updatePaginationInfo = (totalItems) => {
      const state = StateModule.get();
      const pageInfo = document.getElementById('pct-page-info');
      const prevBtn = document.getElementById('pct-prev-page');
      const nextBtn = document.getElementById('pct-next-page');

      if (state.isFullView) {
        pageInfo.textContent = `全部 ${totalItems} 筆`;
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      } else {
        const maxPage = Math.ceil(totalItems / state.pageSize);
        pageInfo.textContent = `${state.pageNo} / ${maxPage}`;
        prevBtn.style.display = 'inline-flex';
        nextBtn.style.display = 'inline-flex';
        prevBtn.disabled = state.pageNo <= 1;
        nextBtn.disabled = state.pageNo >= maxPage;
      }
    };

    const updateStatusFilters = () => {
      const state = StateModule.get();
      const container = document.getElementById('pct-status-filters');
      
      if (state.queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
        const statuses = [
          ConfigModule.MASTER_STATUS_TYPES.IN_SALE,
          ConfigModule.MASTER_STATUS_TYPES.STOPPED,
          ConfigModule.MASTER_STATUS_TYPES.PENDING,
          ConfigModule.MASTER_STATUS_TYPES.ABNORMAL
        ];
        
        container.innerHTML = statuses.map(status => {
          const isActive = state.activeFrontendFilters.has(status);
          return `<button class="pct-filter-btn ${isActive ? 'active' : ''}" data-status="${status}">${status}</button>`;
        }).join('');
        
        container.querySelectorAll('.pct-filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            if (state.activeFrontendFilters.has(status)) {
              state.activeFrontendFilters.delete(status);
            } else {
              state.activeFrontendFilters.add(status);
            }
            StateModule.set({ pageNo: 1 });
            rerenderTable();
          });
        });
      } else {
        container.innerHTML = '';
      }
    };

    const loadDetailsForRow = async (planCode) => {
      const state = StateModule.get();
      const item = state.allProcessedData.find(d => d.planCode === planCode);
      if (!item || !item._loadingDetails) return;

      try {
        const controller = new AbortController();
        await DataModule.loadDetailsForSingleRow(item, controller.signal);
      } catch (error) {
        if (error.name !== 'AbortError') {
          UIModule.Toast.show(`載入詳細資料失敗: ${error.message}`, 'error');
        }
      }
    };

    const loadProductForRow = async (planCode) => {
      const state = StateModule.get();
      const item = state.allProcessedData.find(d => d.planCode === planCode);
      if (!item || !item._loadingProduct) return;

      try {
        const controller = new AbortController();
        await DataModule.loadProductForSingleRow(item, controller.signal);
      } catch (error) {
        if (error.name !== 'AbortError') {
          UIModule.Toast.show(`載入主檔資料失敗: ${error.message}`, 'error');
        }
      }
    };

    const copyAllResults = () => {
      const filteredData = getFilteredData();
      if (filteredData.length === 0) {
        UIModule.Toast.show('無資料可複製', 'warning');
        return;
      }

      // 準備表頭
      const headers = [
        'No', '代號', '名稱', '幣別', '單位', '類型', 
        '主約銷售日', '主約停賣日', '險種狀態', '商品名稱(POLPLN)', '銷售通路'
      ];

      // 準備資料行
      const rows = filteredData.map(item => [
        item.no,
        item.planCode,
        item.shortName,
        item.currency,
        item.unit,
        item.coverageType,
        item.saleStartDate,
        item.saleEndDate,
        item.mainStatus,
        item.polpln,
        item.channels.map(ch => ch.channel).join(' ')
      ]);

      // 組合成 TSV 格式
      const tsvContent = [headers, ...rows]
        .map(row => row.join('\t'))
        .join('\n');

      UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
    };

    return { 
      initialize, 
      showTokenDialog, 
      showQueryDialog, 
      showResultsDialog,
      rerenderTable,
      loadDetailsForRow,
      loadProductForRow
    };
  })();

  /**
   * 載入詳細資料的批量處理
   */
  const loadDetailsInBatches = async () => {
    const state = StateModule.get();
    const itemsNeedingDetails = state.allProcessedData.filter(item => 
      item._loadingDetails && !item._isErrorRow
    );
    
    if (itemsNeedingDetails.length === 0) return;

    const BATCH_SIZE = ConfigModule.BATCH_SIZES.DETAIL_LOAD;
    const controller = new AbortController();
    StateModule.set({ currentQueryController: controller });

    try {
      UIModule.Progress.show('載入詳細資料中...');
      
      for (let i = 0; i < itemsNeedingDetails.length; i += BATCH_SIZE) {
        const batch = itemsNeedingDetails.slice(i, i + BATCH_SIZE);
        const progress = ((i + batch.length) / itemsNeedingDetails.length) * 100;
        
        UIModule.Progress.update(progress, `載入詳細資料 ${i + batch.length}/${itemsNeedingDetails.length}...`);
        
        await Promise.all(
          batch.map(item => DataModule.loadDetailsForSingleRow(item, controller.signal))
        );
        
        ControllerModule.rerenderTable();
        
        // 避免請求過於頻繁
        if (i + BATCH_SIZE < itemsNeedingDetails.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      UIModule.Progress.hide();
      UIModule.Toast.show('詳細資料載入完成', 'success');
      
    } catch (error) {
      UIModule.Progress.hide();
      if (error.name !== 'AbortError') {
        UIModule.Toast.show(`批量載入失敗: ${error.message}`, 'error');
      }
    } finally {
      StateModule.set({ currentQueryController: null });
    }
  };

  /**
   * 載入主檔資料的批量處理
   */
  const loadProductsInBatches = async () => {
    const state = StateModule.get();
    const itemsNeedingProducts = state.allProcessedData.filter(item => 
      item._loadingProduct && !item._isErrorRow
    );
    
    if (itemsNeedingProducts.length === 0) return;

    const BATCH_SIZE = ConfigModule.BATCH_SIZES.DETAIL_LOAD;
    const controller = new AbortController();
    StateModule.set({ currentQueryController: controller });

    try {
      UIModule.Progress.show('載入主檔資料中...');
      
      for (let i = 0; i < itemsNeedingProducts.length; i += BATCH_SIZE) {
        const batch = itemsNeedingProducts.slice(i, i + BATCH_SIZE);
        const progress = ((i + batch.length) / itemsNeedingProducts.length) * 100;
        
        UIModule.Progress.update(progress, `載入主檔資料 ${i + batch.length}/${itemsNeedingProducts.length}...`);
        
        await Promise.all(
          batch.map(item => DataModule.loadProductForSingleRow(item, controller.signal))
        );
        
        ControllerModule.rerenderTable();
        
        // 避免請求過於頻繁
        if (i + BATCH_SIZE < itemsNeedingProducts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      UIModule.Progress.hide();
      UIModule.Toast.show('主檔資料載入完成', 'success');
      
    } catch (error) {
      UIModule.Progress.hide();
      if (error.name !== 'AbortError') {
        UIModule.Toast.show(`批量載入失敗: ${error.message}`, 'error');
      }
    } finally {
      StateModule.set({ currentQueryController: null });
    }
  };

  /**
   * 自動載入詳細資料
   */
  const autoLoadDetails = () => {
    const state = StateModule.get();
    
    // 檢查是否有需要載入主檔資料的項目
    const needsProduct = state.allProcessedData.some(item => item._loadingProduct);
    if (needsProduct) {
      setTimeout(loadProductsInBatches, 1000);
      return;
    }
    
    // 檢查是否有需要載入詳細資料的項目
    const needsDetails = state.allProcessedData.some(item => item._loadingDetails);
    if (needsDetails) {
      setTimeout(loadDetailsInBatches, 1000);
    }
  };

  /**
   * 工具初始化入口
   */
  const initializeTool = () => {
    try {
      ControllerModule.initialize();
      
      // 監聽查詢完成事件，自動載入詳細資料
      const originalShowResultsDialog = ControllerModule.showResultsDialog;
      ControllerModule.showResultsDialog = function(...args) {
        originalShowResultsDialog.apply(this, args);
        setTimeout(autoLoadDetails, 2000);
      };
      
    } catch (error) {
      console.error('工具初始化失敗:', error);
      alert(`工具初始化失敗: ${error.message}`);
    }
  };

  // 啟動工具
  initializeTool();

})();
