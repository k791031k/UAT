javascript:(function() {
  'use strict';

  // --- 清理舊工具實例，確保環境乾淨 ---
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  // --- 模組 1：配置管理 (ConfigModule) ---
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '20.1.0-Skip-Fix',
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
    DEFAULT_QUERY_PARAMS: { PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 5000, PAGE_SIZE_TABLE: 50 },
    DEBOUNCE_DELAY: { SEARCH: 300 },
    SMART_LOAD_THRESHOLD: 25,
  });

  // --- 模組 2：狀態管理 (StateModule) ---
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '', token: '',
      masterProductDB: [],
      channelStatusDB: new Map(),
      isDataReady: false,
      queryMode: '', queryInput: '', masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set(),
      allProcessedData: [], pageNo: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false, filterSpecial: false, searchKeyword: '', sortKey: 'no', sortAsc: true,
      cachePolpln: new Map(),
      currentQueryController: null, searchDebounceTimer: null
    };
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    return { get, set };
  })();

  // --- 模組 3：通用工具函式庫 (UtilsModule) ---
  const UtilsModule = (() => {
    const escapeHtml = t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t;
    const formatToday = () => { const d = new Date(); return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`; };
    const formatDateForUI = dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
    const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
      if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
      const today = new Date(todayStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
      const sS = new Date(String(saleStartStr).split(' ')[0]);
      const sE = new Date(String(saleEndStr).split(' ')[0]);
      if (isNaN(today.getTime()) || isNaN(sS.getTime()) || isNaN(sE.getTime()) || sS.getTime() > sE.getTime()) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
      if (today < sS) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
      if (today > sE) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
      return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
    };
    const checkSpecialStatus = (item, today) => {
      const reasons = [];
      const { mainStatus, channelsData = [], saleEndDate } = item;
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.STOPPED && channelsData.some(c => getSaleStatus(today, c.saleStartDate, c.saleEndDate) === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約已停售，但部分通路仍在售。'); }
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.IN_SALE && channelsData.length > 0 && channelsData.every(c => getSaleStatus(today, c.saleStartDate, c.saleEndDate) !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約為現售，但所有通路皆非現售狀態。'); }
      const mainEndDate = new Date(String(saleEndDate).split(' ')[0]);
      if (!isNaN(mainEndDate.getTime())) {
          channelsData.forEach(c => {
              const channelEndDate = new Date(String(c.saleEndDate).split(' ')[0]);
              if (!isNaN(channelEndDate.getTime()) && channelEndDate > mainEndDate) {
                  reasons.push(`通路[${c.channel}]迄日(${formatDateForUI(c.saleEndDate)})晚於主約迄日(${formatDateForUI(saleEndDate)})。`);
              }
          });
      }
      if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL) { reasons.push('主約本身的銷售起迄日期異常(起日>迄日)。'); }
      return reasons.join('\n');
    };
    const copyTextToClipboard = (t, showToast) => {
        if (!navigator.clipboard) {
            const e = document.createElement('textarea'); e.value = t; document.body.appendChild(e); e.select(); document.execCommand('copy'); document.body.removeChild(e); showToast('已複製 (舊版)', 'success');
        } else {
            navigator.clipboard.writeText(t).then(() => showToast('已複製', 'success')).catch(() => showToast('複製失敗', 'error'));
        }
    };
    const splitInput = i => i.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
    return { escapeHtml, formatToday, formatDateForUI, getSaleStatus, checkSpecialStatus, copyTextToClipboard, splitInput };
  })();

  // --- 模組 4：UI 介面管理器 (UIModule) ---
  const UIModule = (() => {
    const injectStyle = () => {
      if (document.getElementById(ConfigModule.STYLE_ID)) return;
      const s = document.createElement('style'); s.id = ConfigModule.STYLE_ID;
      s.textContent = `
:root{--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#5CB85C;--success-dark-color:#4CAE4C;--error-color:#D9534F;--error-dark-color:#C9302C;--warning-color:#F0AD4E;--warning-dark-color:#EC971F;--info-color:#5BC0DE;--info-dark-color:#46B8DA;--background-light:#F8F8F8;--surface-color:#FFFFFF;--border-color:#E0E0E0;--text-color-dark:#1a1a1a;--text-color-light:#333333;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;}
.pct-modal-mask{position:fixed;z-index:2147483647;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);opacity:0;transition:opacity var(--transition-speed) ease-out;display:flex;align-items:center;justify-content:center;}
.pct-modal-mask.show{opacity:1;}
.pct-loader{color:var(--text-color-dark);background:var(--surface-color);padding:30px 40px;border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);text-align:center;}
.pct-loader h3{margin:0 0 15px;font-size:20px;}
.pct-loader p{margin:10px 0 0;font-size:14px;color:var(--text-color-light);}
.pct-loader .pct-btn{margin-top:20px;}
.pct-modal{font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
.pct-modal[data-size="query"]{width:520px;} .pct-modal[data-size="results"]{width:1050px;}
.pct-modal.show{opacity:1;transform:translateX(-50%) translateY(0);}
.pct-modal.dragging{transition:none;}
.pct-modal-header{padding:16px 50px 16px 20px;line-height:1;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;position:relative;text-align:left;}
.pct-modal-header.dragging{cursor:grabbing;}
.pct-modal-close-btn{position:absolute;top:50%;right:15px;transform:translateY(-50%);background:transparent;border:none;font-size:24px;line-height:1;color:var(--secondary-color);cursor:pointer;padding:5px;width:34px;height:34px;border-radius:50%;transition:background-color .2s, color .2s;display:flex;align-items:center;justify-content:center;}
.pct-modal-close-btn:hover{background-color:var(--background-light);color:var(--text-color-dark);}
.pct-modal-body{padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;}
.pct-modal-footer{padding:12px 20px 16px 20px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;}
.pct-modal-footer-left,.pct-modal-footer-right{display:flex;gap:10px;align-items:center;}
.pct-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:all var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap;}
.pct-btn:hover{background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);}
.pct-btn:disabled{background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;}
.pct-btn-secondary{background:var(--secondary-color);} .pct-btn-secondary:hover{background:var(--secondary-dark-color);}
.pct-table-wrap{max-height:60vh;overflow:auto;margin:15px 0;}
.pct-table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface-color);table-layout:fixed;min-width:1000px;}
.pct-table th,.pct-table td{border:1px solid #ddd;padding:5px;vertical-align:top;word-wrap:break-word;}
.pct-table th{background:#f8f8f8;position:sticky;top:0;z-index:1;cursor:pointer;text-align:center;}
.pct-table tr.special-row{background:#fffde7;border-left:4px solid var(--warning-color);cursor:help;}
.pct-channel-insale{color:var(--primary-color);font-weight:bold;}
.pct-channel-offsale{color:var(--error-color);}
.pct-channel-separator{margin:0 4px;color:#ccc;}
.pct-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483648;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;}
.pct-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
.pct-toast.success{background:var(--success-color);} .pct-toast.error{background:var(--error-color);color:white;} .pct-toast.info{background:var(--info-color);} .pct-toast.warning{background:var(--warning-color); color:var(--text-color-dark);}
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
        if (duration > 0) { setTimeout(() => { e.classList.remove('show'); e.addEventListener('transitionend', () => e.remove(), { once: true }); }, duration); }
      },
    };
    const Modal = {
      close: () => {
        document.getElementById(ConfigModule.TOOL_ID)?.remove();
        const mask = document.getElementById('pctModalMask');
        if (mask) {
            mask.classList.remove('show');
            mask.addEventListener('transitionend', () => mask.remove(), { once: true });
        }
        StateModule.get().currentQueryController?.abort();
      },
      show: (html, onOpen) => {
        Modal.close();
        let mask = document.createElement('div');
        mask.id = 'pctModalMask';
        mask.className = 'pct-modal-mask show';
        document.body.appendChild(mask);
        let modal = document.createElement('div');
        modal.id = ConfigModule.TOOL_ID;
        modal.className = 'pct-modal';
        modal.innerHTML = html;
        document.body.appendChild(modal);
        setTimeout(() => { modal.classList.add('show'); }, 10);
        modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown);
        modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close);
        if (onOpen) setTimeout(() => onOpen(modal), 50);
      },
      showLoader: (message) => {
        Modal.close();
        let mask = document.createElement('div');
        mask.id = 'pctModalMask';
        mask.className = 'pct-modal-mask';
        mask.innerHTML = `<div class="pct-loader">${message}</div>`;
        document.body.appendChild(mask);
        setTimeout(() => mask.classList.add('show'), 10);
      },
      updateLoader: (message) => {
        const loader = document.querySelector('#pctModalMask .pct-loader');
        if (loader) { loader.innerHTML = message; }
      }
    };
    return { injectStyle, Toast, Modal };
  })();

  // --- 模組 5：事件管理器 (EventModule) ---
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
      if (modal) { modal.classList.remove('dragging'); modal.querySelector('.pct-modal-header')?.classList.remove('dragging'); }
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('mouseup', closeDragElement);
    };
    const handleEscKey = (e) => {
      if (e.key === 'Escape') { UIModule.Modal.close(); document.removeEventListener('keydown', handleEscKey); }
    };
    const setupGlobalKeyListener = () => {
      document.removeEventListener('keydown', handleEscKey);
      document.addEventListener('keydown', handleEscKey);
    };
    return { dragMouseDown, setupGlobalKeyListener };
  })();

  // --- 模組 6：API 服務層 (ApiModule) ---
  const ApiModule = (() => {
    async function callApi(endpoint, params, signal) {
      const { apiBase, token } = StateModule.get();
      const headers = { 'Content-Type': 'application/json' };
      if (token) { headers['SSO-TOKEN'] = token; }
      const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: headers, body: JSON.stringify(params), signal: signal });
      if (!response.ok) {
        let errorText = await response.text();
        try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || errorJson.error || errorText; } catch (e) {}
        throw new Error(`API 請求失敗 (${response.status}): ${errorText}`);
      }
      return response.json();
    }
    async function verifyToken() {
      try {
        await callApi('/planCodeController/query', { planCode: '5105', currentPage: 1, pageSize: 1 });
        return true;
      } catch (e) { return false; }
    }
    async function getAllProducts(signal) {
      const params = { pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER, currentPage: 1, planCodeName: '', planCode: '' };
      const res = await callApi('/planCodeController/query', params, signal);
      return res.records || [];
    }
    async function getAllChannelStates(signal) {
      const allChannels = ConfigModule.FIELD_MAPS.CHANNELS;
      const promises = allChannels.map(channel =>
          callApi('/planCodeSaleDateController/query', { planCode: "", channel: channel === 'BK' ? 'OT' : channel, pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }, signal)
      );
      const results = await Promise.all(promises);
      const channelDataMap = new Map();
      results.flatMap(res => res.planCodeSaleDates?.records || []).forEach(r => {
          const planCode = r.planCode;
          if (!channelDataMap.has(planCode)) {
              channelDataMap.set(planCode, []);
          }
          channelDataMap.get(planCode).push({
              channel: r.channel === 'OT' ? 'BK' : r.channel,
              saleStartDate: r.saleStartDate,
              saleEndDate: r.saleEndDate,
          });
      });
      return channelDataMap;
    }
    async function getPolplnData(planCode, signal) {
        const { cachePolpln } = StateModule.get();
        if (cachePolpln.has(planCode)) return cachePolpln.get(planCode);
        const detail = await callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }, signal);
        const polplnRecords = (detail.records || []).map(r => r.polpln);
        let processedPolpln = "-";
        if (polplnRecords && polplnRecords.length > 0) {
            const first = polplnRecords[0].replace(/^\d+/, "").replace(/\d+$/, "").trim();
            processedPolpln = polplnRecords.every(p => p.replace(/^\d+/, "").replace(/\d+$/, "").trim() === first) ? first : "-";
        }
        cachePolpln.set(planCode, processedPolpln);
        return processedPolpln;
    }
    return { verifyToken, getAllProducts, getAllChannelStates, getPolplnData };
  })();

  // --- 模組 7：資料處理與查詢邏輯層 (DataModule) ---
  const DataModule = (() => {
    function processDataForTable(rawData) {
        const { channelStatusDB } = StateModule.get();
        const today = UtilsModule.formatToday();
        const fieldMaps = ConfigModule.FIELD_MAPS;
        return rawData.map((item, index) => {
            const channelsData = channelStatusDB.get(item.planCode) || [];
            const processedItem = {
                no: index + 1,
                planCode: item.planCode || '-',
                shortName: item.shortName || item.planName || '-',
                currency: fieldMaps.CURRENCY[String(item.currency || item.cur)] || item.currency || item.cur || '',
                unit: fieldMaps.UNIT[String(item.reportInsuranceAmountUnit || item.insuranceAmountUnit)] || item.reportInsuranceAmountUnit || item.insuranceAmountUnit || '',
                coverageType: fieldMaps.COVERAGE_TYPE[String(item.coverageType || item.type)] || item.coverageType || item.type || '',
                saleStartDate: item.saleStartDate,
                saleEndDate: item.saleEndDate,
                mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate),
                polpln: '...',
                channelsData: channelsData,
                _needsPolplnLoad: true
            };
            processedItem.specialReason = UtilsModule.checkSpecialStatus(processedItem, today);
            return processedItem;
        });
    }
    function sortData(data, key, asc) {
      if (!key || key === 'no') return data;
      return [...data].sort((a, b) => {
        let valA = a[key], valB = b[key];
        if (key.toLowerCase().includes('date')) {
            valA = a[key] ? new Date(String(a[key]).split(' ')[0]).getTime() : 0;
            valB = b[key] ? new Date(String(b[key]).split(' ')[0]).getTime() : 0;
        }
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }
    return { processDataForTable, sortData };
  })();

  // --- 模組 8：主控制器 (ControllerModule) ---
  const ControllerModule = (() => {

    function rerenderTable() {
      const state = StateModule.get();
      let filteredData = state.allProcessedData;
      const searchKeyword = state.searchKeyword.toLowerCase();
      if (searchKeyword) {
          filteredData = filteredData.filter(r => 
              r.planCode.toLowerCase().includes(searchKeyword) ||
              r.shortName.toLowerCase().includes(searchKeyword) ||
              r.polpln.toLowerCase().includes(searchKeyword)
          );
      }
      if (state.filterSpecial) { filteredData = filteredData.filter(r => r.specialReason); }
      const sortedData = DataModule.sortData(filteredData, state.sortKey, state.sortAsc);
      const totalPages = Math.ceil(sortedData.length / state.pageSize);
      const pageData = state.isFullView ? sortedData : sortedData.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize);
      const headers = [
          { key: 'no', label: 'No' }, { key: 'planCode', label: '代號' }, { key: 'shortName', label: '名稱' },
          { key: 'currency', label: '幣別' }, { key: 'unit', label: '單位' }, { key: 'coverageType', label: '類型' },
          { key: 'saleStartDate', label: '主約銷售日' }, { key: 'saleEndDate', label: '主約停賣日' }, { key: 'mainStatus', label: '險種狀態' },
          { key: 'polpln', label: '商品名稱' }, { key: 'channels', label: '銷售通路' }
      ];
      const today = UtilsModule.formatToday();
      const getChannelHTML = (channelsData = []) => {
        const channelsWithStatus = channelsData.map(c => ({...c, status: UtilsModule.getSaleStatus(today, c.saleStartDate, c.saleEndDate)}));
        const inSale = channelsWithStatus.filter(c => c.status === '現售').sort((a,b) => a.channel.localeCompare(b.channel));
        const offSale = channelsWithStatus.filter(c => c.status !== '現售').sort((a,b) => a.channel.localeCompare(b.channel));
        const render = c => `<span class="${c.status === '現售' ? 'pct-channel-insale' : 'pct-channel-offsale'}" title="${c.channel} (${c.status}): ${UtilsModule.formatDateForUI(c.saleStartDate)}-${UtilsModule.formatDateForUI(c.saleEndDate)}">${c.channel}</span>`;
        return [inSale.map(render).join(' '), offSale.map(render).join(' ')].filter(Boolean).join('<span class="pct-channel-separator"> | </span>') || '無通路資料';
      };
      const tableBodyHTML = pageData.map((r, index) => {
        const rowNum = state.isFullView ? index + 1 : (state.pageNo - 1) * state.pageSize + index + 1;
        return `<tr data-plan-code="${r.planCode}" class="${r.specialReason ? 'special-row' : ''}" title="${UtilsModule.escapeHtml(r.specialReason || '')}">
                    <td>${rowNum}</td><td>${r.planCode}</td><td>${UtilsModule.escapeHtml(r.shortName)}</td>
                    <td>${r.currency}</td><td>${r.unit}</td><td>${r.coverageType}</td>
                    <td>${UtilsModule.formatDateForUI(r.saleStartDate)}</td><td>${UtilsModule.formatDateForUI(r.saleEndDate)}</td>
                    <td>${r.mainStatus}</td><td data-polpln-load="${r._needsPolplnLoad}">${r.polpln}</td>
                    <td>${getChannelHTML(r.channelsData)}</td>
                </tr>`;
      }).join('');
      const modalHTML = `<div class="pct-modal-header"><span>查詢結果 (${state.env}) v${ConfigModule.VERSION}</span><button class="pct-modal-close-btn">&times;</button></div>
          <div class="pct-modal-body">
              <div style="display:flex;gap:15px;margin-bottom:15px;">
                  <input type="text" id="pct-search-input" placeholder="搜尋 代號/名稱/POLPLN..." style="flex-grow:1;padding:8px;" value="${UtilsModule.escapeHtml(state.searchKeyword)}">
                  <button class="pct-btn" id="pct-table-filter" style="${state.allProcessedData.some(r=>r.specialReason)?'':'display:none;'}">${state.filterSpecial?'顯示全部':'篩選特殊'}</button>
                  <button class="pct-btn" id="pct-refresh-data">同步最新資料</button>
              </div>
              <div class="pct-table-wrap"><table class="pct-table">
                  <thead><tr>${headers.map(h => `<th data-key="${h.key}">${h.label}</th>`).join('')}</tr></thead>
                  <tbody>${tableBodyHTML}</tbody>
              </table></div>
          </div>
          <div class="pct-modal-footer">
              <div class="pct-modal-footer-left"><button class="pct-btn" id="pct-view-toggle">${state.isFullView?'分頁顯示':'一頁顯示'}</button></div>
              <div class="pct-pagination" style="display:${state.isFullView?'none':'flex'}"><button id="pct-table-prev" class="pct-btn" ${state.pageNo<=1?'disabled':''}>◀</button><span style="padding:0 10px;">${state.pageNo} / ${totalPages > 0 ? totalPages : 1}</span><button id="pct-table-next" class="pct-btn" ${state.pageNo>=totalPages?'disabled':''}>▶</button></div>
              <div class="pct-modal-footer-right"><button class="pct-btn" id="pct-table-copy">一鍵複製</button><button class="pct-btn" id="pct-table-requery">重新查詢</button></div>
          </div>`;
      UIModule.Modal.show(modalHTML, modal => {
        modal.setAttribute('data-size', 'results');
        modal.querySelector('#pct-search-input').addEventListener('input', e => {
            clearTimeout(StateModule.get().searchDebounceTimer);
            StateModule.set({ searchDebounceTimer: setTimeout(() => { StateModule.set({ searchKeyword: e.target.value, pageNo: 1 }); rerenderTable(); }, ConfigModule.DEBOUNCE_DELAY.SEARCH) });
        });
        modal.querySelector('#pct-table-filter').onclick = () => { StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); rerenderTable(); };
        modal.querySelector('#pct-refresh-data').onclick = () => preloadData(true);
        modal.querySelector('#pct-view-toggle').onclick = () => { StateModule.set({ isFullView: !state.isFullView, pageNo: 1 }); rerenderTable(); };
        modal.querySelector('#pct-table-prev').onclick = () => { if(StateModule.get().pageNo > 1) { StateModule.set({pageNo: StateModule.get().pageNo - 1}); rerenderTable(); }};
        modal.querySelector('#pct-table-next').onclick = () => { if(StateModule.get().pageNo < totalPages) { StateModule.set({pageNo: StateModule.get().pageNo + 1}); rerenderTable(); }};
        modal.querySelector('#pct-table-copy').onclick = () => {
            const dataToCopy = sortedData;
            const copyText = `${headers.map(h=>h.label).join('\t')}\n` + dataToCopy.map((r, i) => [i+1, r.planCode, r.shortName, r.currency, r.unit, r.coverageType, UtilsModule.formatDateForUI(r.saleStartDate), UtilsModule.formatDateForUI(r.saleEndDate), r.mainStatus, r.polpln, r.channelsData.map(c=>`${c.channel}`).join('/')].join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(copyText, UIModule.Toast.show);
        };
        modal.querySelector('#pct-table-requery').onclick = showQueryDialog;
        modal.querySelector('thead').addEventListener('click', e => {
            const th = e.target.closest('th[data-key]');
            if (th) {
                const key = th.dataset.key;
                const state = StateModule.get();
                StateModule.set({ sortAsc: state.sortKey === key ? !state.sortAsc : true, sortKey: key, pageNo: 1 });
                rerenderTable();
            }
        });
        modal.querySelector('tbody').addEventListener('click', e => {
            const polplnCell = e.target.closest('td[data-polpln-load="true"]');
            if (polplnCell) {
                const planCode = polplnCell.parentElement.dataset.planCode;
                handlePolplnLoad(planCode);
            }
        });
      });
    }
    async function handlePolplnLoad(planCode) {
        const item = StateModule.get().allProcessedData.find(p => p.planCode === planCode);
        if (!item || !item._needsPolplnLoad) return;
        const cell = document.querySelector(`tr[data-plan-code="${planCode}"] td[data-polpln-load]`);
        if (cell) cell.textContent = '載入中...';
        try {
            const polpln = await ApiModule.getPolplnData(planCode, null);
            item.polpln = polpln;
            item._needsPolplnLoad = false;
            if (cell) {
                cell.textContent = polpln;
                cell.dataset.polplnLoad = 'false';
            }
        } catch(e) {
            UIModule.Toast.show(`載入 ${planCode} POLPLN 失敗`, 'error');
            if (cell) cell.textContent = '載入失敗';
        }
    }
    function executeQuery() {
        const { queryMode, queryInput, masterStatusSelection, channelStatusSelection, channelSelection, masterProductDB, channelStatusDB } = StateModule.get();
        let results = [];
        const today = UtilsModule.formatToday();
        switch (queryMode) {
            case ConfigModule.QUERY_MODES.PLAN_CODE: {
                const codes = new Set(UtilsModule.splitInput(queryInput));
                results = masterProductDB.filter(p => codes.has(p.planCode));
                break;
            }
            case ConfigModule.QUERY_MODES.PLAN_NAME: {
                const keyword = queryInput.toLowerCase();
                results = masterProductDB.filter(p => (p.shortName || '').toLowerCase().includes(keyword) || (p.planName || '').toLowerCase().includes(keyword));
                break;
            }
            case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: {
                results = masterProductDB.filter(p => masterStatusSelection.has(UtilsModule.getSaleStatus(today, p.saleStartDate, p.saleEndDate)));
                break;
            }
            case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: {
                const targetChannels = channelSelection.size > 0 ? [...channelSelection] : ConfigModule.FIELD_MAPS.CHANNELS;
                const matchingPlanCodes = new Set();
                for (const [planCode, channels] of channelStatusDB.entries()) {
                    const hasMatch = channels.some(c => 
                        targetChannels.includes(c.channel) &&
                        UtilsModule.getSaleStatus(today, c.saleStartDate, c.saleEndDate) === channelStatusSelection
                    );
                    if (hasMatch) {
                        matchingPlanCodes.add(planCode);
                    }
                }
                results = masterProductDB.filter(p => matchingPlanCodes.has(p.planCode));
                break;
            }
        }
        StateModule.set({ allProcessedData: DataModule.processDataForTable(results), pageNo: 1, filterSpecial: false, searchKeyword: '' });
        rerenderTable();
        UIModule.Toast.show(`查詢到 ${results.length} 筆資料`, 'success');
        if (results.length > 0 && results.length < ConfigModule.SMART_LOAD_THRESHOLD) {
            UIModule.Toast.show(`正在自動載入 ${results.length} 筆 POLPLN...`, 'info');
            results.forEach(r => handlePolplnLoad(r.planCode));
        }
    }
    async function preloadData(isRefresh = false) {
      if (!isRefresh) {
          UIModule.Modal.showLoader('<h3>正在準備資料...</h3><p>初次啟動，正在下載商品主檔與通路資料，請稍候。</p>');
      } else {
          UIModule.Toast.show('正在同步最新資料...', 'info');
      }
      const controller = new AbortController();
      StateModule.set({ currentQueryController: controller });
      try {
          if (!isRefresh) UIModule.Modal.updateLoader('<h3>正在準備資料...</h3><p>Step 1/2: 下載商品主檔...</p>');
          const productsPromise = ApiModule.getAllProducts(controller.signal);
          if (!isRefresh) UIModule.Modal.updateLoader('<h3>正在準備資料...</h3><p>Step 2/2: 下載全通路狀態檔...</p>');
          const channelsPromise = ApiModule.getAllChannelStates(controller.signal);
          const [productDB, channelDB] = await Promise.all([productsPromise, channelsPromise]);
          StateModule.set({ masterProductDB: productDB, channelStatusDB: channelDB, isDataReady: true, currentQueryController: null });
          UIModule.Toast.show(`資料準備完成 (共 ${productDB.length} 筆商品)`, 'success', 4000);
          if (isRefresh) {
              executeQuery();
          } else {
              showQueryDialog();
          }
      } catch (error) {
          if (error.name === 'AbortError') return;
          UIModule.Modal.updateLoader(`<h3>資料載入失敗</h3><p style="color:var(--error-color);">${error.message}</p><button id="pct-preload-retry" class="pct-btn">重試</button>`);
          document.getElementById('pct-preload-retry').onclick = () => preloadData(isRefresh);
      }
    }
    function showTokenDialog() {
      const { env } = StateModule.get();
      const html = `<div class="pct-modal-header"><span>設定 Token (${env})</span><button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body"><div class="pct-form-group"><label class="pct-label">請貼上您的 SSO-TOKEN：</label><textarea class="pct-input" id="pct-token-input" rows="4"></textarea></div></div><div class="pct-modal-footer"><div class="pct-modal-footer-right"><button class="pct-btn" id="pct-token-ok">驗證並繼續</button><button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過驗證</button></div></div>`;
      UIModule.Modal.show(html, modal => {
        modal.setAttribute('data-size', 'query');
        const tokenInput = modal.querySelector('#pct-token-input');
        const handleVerify = async () => {
            const val = tokenInput.value.trim();
            if (!val) { UIModule.Toast.show('請輸入 Token', 'error'); return; }
            StateModule.set({ token: val });
            if (await ApiModule.verifyToken()) {
              localStorage.setItem('SSO-TOKEN', val);
              UIModule.Toast.show('Token 驗證成功', 'success');
              preloadData();
            } else { UIModule.Toast.show('Token 驗證失敗', 'error'); }
        };
        const handleSkip = () => {
            const val = tokenInput.value.trim();
            StateModule.set({ token: val });
            if (val) {
                localStorage.setItem('SSO-TOKEN', val);
                UIModule.Toast.show('已略過驗證並儲存 Token', 'warning');
            } else {
                localStorage.removeItem('SSO-TOKEN');
                UIModule.Toast.show('已略過驗證', 'info');
            }
            preloadData();
        };
        modal.querySelector('#pct-token-ok').onclick = handleVerify;
        modal.querySelector('#pct-token-skip').onclick = handleSkip;
        tokenInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleVerify(); }};
      });
    }
    function showQueryDialog() {
      const { env } = StateModule.get();
      const modeLabel = m => ({[ConfigModule.QUERY_MODES.PLAN_CODE]:'商品代號', [ConfigModule.QUERY_MODES.PLAN_NAME]:'商品名稱', [ConfigModule.QUERY_MODES.MASTER_CLASSIFIED]:'商品銷售時間', [ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED]:'通路銷售時間'}[m]);
      const html = `<div class="pct-modal-header"><span>選擇查詢條件 (${env})</span><button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body"><div class="pct-mode-card-grid">${Object.values(ConfigModule.QUERY_MODES).map(m=>`<div class="pct-mode-card" data-mode="${m}">${modeLabel(m)}</div>`).join('')}</div><div id="pct-dynamic-query-content" style="margin-top:15px;"></div></div><div class="pct-modal-footer"><div class="pct-modal-footer-right"><button class="pct-btn" id="pct-query-ok" disabled>開始查詢</button></div></div>`;
      UIModule.Modal.show(html, modal => {
        modal.setAttribute('data-size', 'query');
        const queryBtn = modal.querySelector('#pct-query-ok');
        const dynamicContent = modal.querySelector('#pct-dynamic-query-content');
        const updateDynamicContent = (mode) => {
            let content = '';
            StateModule.set({ queryMode: mode });
            queryBtn.disabled = true;
            switch (mode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE: content = `<label class="pct-label">商品代碼：</label><textarea class="pct-input" rows="3" placeholder="多筆可用空格、逗號或換行分隔"></textarea>`; break;
                case ConfigModule.QUERY_MODES.PLAN_NAME: content = `<label class="pct-label">商品名稱：</label><textarea class="pct-input" rows="3"></textarea>`; break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: content = `<label class="pct-label">商品銷售時間：</label><div class="pct-sub-option-grid" data-type="masterStatus">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<div class="pct-sub-option" data-value="${s}">${s}</div>`).join('')}</div>`; break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: content = `<label class="pct-label">通路：(可多選)</label><div class="pct-channel-option-grid">${ConfigModule.FIELD_MAPS.CHANNELS.map(c=>`<div class="pct-channel-option" data-value="${c}">${c}</div>`).join('')}</div><label class="pct-label" style="margin-top:15px;">銷售範圍：</label><div class="pct-sub-option-grid" data-type="channelStatus">${['現售','停售'].map(s=>`<div class="pct-sub-option" data-value="${s}">${s}</div>`).join('')}</div>`; break;
            }
            dynamicContent.innerHTML = content;
            dynamicContent.querySelector('textarea')?.addEventListener('input', (e) => { queryBtn.disabled = e.target.value.trim() === ''; });
            dynamicContent.addEventListener('click', (e) => {
                const option = e.target.closest('.pct-sub-option, .pct-channel-option');
                if(!option) return;
                const parent = option.parentElement;
                if(parent.dataset.type !== 'masterStatus' && !option.classList.contains('pct-channel-option')) {
                    parent.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
                }
                option.classList.toggle('selected');
                queryBtn.disabled = false;
            });
        };
        modal.querySelector('#pct-mode-wrap').addEventListener('click', e => {
            const card = e.target.closest('.pct-mode-card');
            if (card) {
                modal.querySelectorAll('.pct-mode-card.selected').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                updateDynamicContent(card.dataset.mode);
            }
        });
        queryBtn.onclick = () => {
            const masterStatusEl = dynamicContent.querySelector('.pct-sub-option-grid[data-type="masterStatus"]');
            const channelStatusEl = dynamicContent.querySelector('.pct-sub-option-grid[data-type="channelStatus"]');
            StateModule.set({
                queryInput: dynamicContent.querySelector('textarea')?.value || '',
                masterStatusSelection: masterStatusEl ? new Set(Array.from(masterStatusEl.querySelectorAll('.selected')).map(el => el.dataset.value)) : new Set(),
                channelSelection: new Set(Array.from(dynamicContent.querySelectorAll('.pct-channel-option.selected')).map(el => el.dataset.value)),
                channelStatusSelection: channelStatusEl?.querySelector('.selected')?.dataset.value || ''
            });
            executeQuery();
        };
      });
    }
    async function initialize() {
      UIModule.injectStyle();
      EventModule.setupGlobalKeyListener();
      const storedToken = localStorage.getItem('SSO-TOKEN');
      if (storedToken) {
        StateModule.set({ token: storedToken });
        preloadData();
      } else { showTokenDialog(); }
    }
    return { initialize };
  })();

  // --- 啟動工具 ---
  ControllerModule.initialize();

})();
