/**
 * ============================================================================
 * 商品代碼查詢工具 v5.0 - FINAL
 *
 * 架構師：Gemini (由 Google 開發)
 * 發佈日期：2025-06-23
 *
 * v5.0 更新日誌：
 * - 全新的 UI/UX 設計，提升專業感與使用者體驗。
 * - 實作全新的「分段按鈕式」查詢條件介面。
 * - 實作最終版高對比、深色表頭的結果表格。
 * - 實作所有使用者指定的業務邏輯與功能調整 (包含Token略過、通路對應、按鈕文字等)。
 * - 全面優化程式碼結構與註解，提升可維護性。
 * - 將「帳號密碼登入」功能規劃於 v5.1。
 * ============================================================================
 */
(function() {
    'use strict';

    // ============================================================================
    // 模組 1: AppConfig - 應用程式靜態設定
    // ============================================================================
    const AppConfig = Object.freeze({
        TOOL_ID: 'planCodeQueryTool_v5',
        STYLE_ID: 'planCodeToolStyle_v5',
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
        },
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            ALL_MASTER: 'allMasterPlans',
            MASTER_IN_SALE: 'masterInSale',
            MASTER_STOPPED: 'masterStopped',
            CHANNEL_IN_SALE: 'channelInSale',
            CHANNEL_STOPPED: 'channelStopped'
        },
        SALE_STATUS: {
            CURRENT: '現售中',
            STOPPED: '停售',
            PENDING: '未開始',
            ABNORMAL: '日期異常'
        },
        FIELD_MAPS: {
            CURRENCY: { '1': "TWD", '2': "USD", '3': "AUD", '4': "CNT", '5': "USD_OIU" },
            UNIT: { 'A1': "元", 'A3': "仟元", 'A4': "萬元", 'B1': "計畫", 'C1': "單位" },
            COVERAGE_TYPE: { 'M': "主約", 'R': "附約" },
            CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC']
        },
        PAGINATION: {
            TABLE_PAGE_SIZE: 50
        },
        API_FETCH_CONFIG: {
            MASTER_PAGE_SIZE: 5000,
            DETAIL_PAGE_SIZE: 50,
            CHANNEL_PAGE_SIZE: 1000
        }
    });

    // ============================================================================
    // 模組 2: UIManager - 使用者介面管理器
    // ============================================================================
    const UIManager = (function() {
        let currentModal = null;
        let toastTimeoutId = null;

        function injectStyles() {
            if (document.getElementById(AppConfig.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = AppConfig.STYLE_ID;
            style.textContent = `
                :root {
                    --pct-primary: #007BFF; --pct-primary-dark: #0056b3;
                    --pct-success: #28a745; --pct-danger: #dc3545;
                    --pct-warning: #ffc107; --pct-info: #17a2b8;
                    --pct-dark: #343a40; --pct-light: #f8f9fa;
                    --pct-surface: #FFFFFF; --pct-border: #dee2e6;
                    --pct-shadow: rgba(0, 0, 0, 0.1); --pct-radius: 8px;
                    --pct-transition: 0.2s ease-in-out;
                }
                .pct-modal-mask { position: fixed; z-index: 2147483645; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); opacity: 0; transition: opacity var(--pct-transition); }
                .pct-modal-mask.show { opacity: 1; }
                .pct-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: var(--pct-light); border-radius: var(--pct-radius); box-shadow: 0 8px 40px rgba(0,0,0,0.2); min-width: 550px; max-width: 95vw; position: fixed; top: 8vh; left: 50%; transform: translateX(-50%) translateY(-20px); opacity: 0; z-index: 2147483646; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; max-height: 85vh; }
                .pct-modal.show { opacity: 1; transform: translateX(-50%) translateY(0); }
                .pct-modal-header { padding: 1rem 1.5rem; font-size: 1.25rem; font-weight: 600; color: var(--pct-dark); border-bottom: 1px solid var(--pct-border); }
                .pct-modal-body { padding: 1.5rem; flex-grow: 1; overflow-y: auto; background: var(--pct-surface); }
                .pct-modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--pct-border); display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap; background: #f1f3f5; }
                .pct-btn { padding: 0.6rem 1.2rem; font-size: 1rem; border-radius: var(--pct-radius); border: 1px solid transparent; cursor: pointer; transition: all var(--pct-transition); font-weight: 500; }
                .pct-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px var(--pct-shadow); }
                .pct-btn-primary { background: var(--pct-primary); color: #fff; } .pct-btn-primary:hover { background: #0069d9; }
                .pct-btn-danger { background: var(--pct-danger); color: #fff; } .pct-btn-danger:hover { background: #c82333; }
                .pct-btn-warning { background: var(--pct-warning); color: #212529; } .pct-btn-warning:hover { background: #e0a800; }
                .pct-btn-success { background: var(--pct-success); color: #fff; }
                .pct-btn-info { background: var(--pct-info); color: #fff; }
                .pct-btn-secondary { background: #6c757d; color: #fff; }
                .pct-query-segment { display: flex; margin-bottom: 1.5rem; border-radius: var(--pct-radius); overflow: hidden; border: 1px solid var(--pct-border); }
                .pct-query-segment-btn { flex: 1; padding: 0.75rem; background: var(--pct-surface); color: var(--pct-dark); border: none; border-left: 1px solid var(--pct-border); cursor: pointer; transition: background-color var(--pct-transition); font-size: 0.95rem; }
                .pct-query-segment-btn:first-child { border-left: none; }
                .pct-query-segment-btn:hover { background: #e9ecef; }
                .pct-query-segment-btn.selected { background: var(--pct-primary); color: #fff; }
                .pct-input { width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.75rem; border-radius: var(--pct-radius); border: 1px solid var(--pct-border); }
                .pct-results-header { background: var(--pct-dark); color: #fff; padding: 1rem 1.5rem; border-radius: var(--pct-radius) var(--pct-radius) 0 0; }
                .pct-results-controls { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: 1px solid var(--pct-border); border-bottom: none; border-radius: var(--pct-radius) var(--pct-radius) 0 0; background: var(--pct-light); }
                .pct-results-summary { font-size: 1rem; color: var(--pct-dark); margin-right: auto; }
                .pct-table-wrap { overflow: auto; border: 1px solid var(--pct-border); border-top: none; }
                .pct-table { border-collapse: collapse; width: 100%; font-size: 0.9rem; min-width: 1200px; }
                .pct-table th { background: #495057; color: #fff; text-align: left; padding: 0.75rem 1rem; font-weight: 600; cursor: pointer; position: sticky; top: 0; z-index: 1; }
                .pct-table td { border-bottom: 1px solid var(--pct-border); padding: 0.75rem 1rem; vertical-align: top; line-height: 1.6; }
                .pct-table tr:hover td { background: #e9ecef; }
                .pct-table .status-text-current { color: var(--pct-primary); font-weight: 600; }
                .pct-table .status-text-stopped { color: var(--pct-danger); }
                .pct-table .code-secondary { color: var(--pct-success); font-weight: 600; }
                .pct-table .channel-list { margin-top: 0.25rem; font-size: 0.85em; color: #6c757d; }
                .pct-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 12px 24px; border-radius: 6px; z-index: 2147483647; opacity: 0; transition: all 0.4s; }
                .pct-toast.show { opacity: 1; transform: translateX(-50%) translateY(-10px); }
            `;
            document.head.appendChild(style);
        }

        function showModal({ title, body, footer, onOpen, isResultView = false }) {
            closeModal();
            const toolContainer = document.getElementById(AppConfig.TOOL_ID) || document.createElement('div');
            toolContainer.id = AppConfig.TOOL_ID;
            toolContainer.innerHTML = '';
            const mask = document.createElement('div');
            mask.className = 'pct-modal-mask';
            mask.onclick = closeModal;
            const modal = document.createElement('div');
            modal.className = 'pct-modal';
            modal.innerHTML = `
                ${isResultView ? '' : `<div class="pct-modal-header">${title}</div>`}
                <div class="pct-modal-body">${body}</div>
                <div class="pct-modal-footer">${footer}</div>`;
            modal.onclick = (e) => e.stopPropagation();
            toolContainer.appendChild(mask);
            toolContainer.appendChild(modal);
            document.body.appendChild(toolContainer);
            currentModal = { toolContainer, mask, modal };
            setTimeout(() => { mask.classList.add('show'); modal.classList.add('show'); if (onOpen) onOpen(modal); }, 10);
        }
        function closeModal() { if (currentModal) { currentModal.mask.classList.remove('show'); currentModal.modal.classList.remove('show'); setTimeout(() => { if (currentModal && currentModal.toolContainer) currentModal.toolContainer.remove(); currentModal = null; }, 250); } }
        function showToast(message, type = 'info', duration = 3000) { clearTimeout(toastTimeoutId); const el = document.querySelector('.pct-toast'); if(el) el.remove(); const toast = document.createElement('div'); toast.className = `pct-toast ${type}`; toast.textContent = message; document.body.appendChild(toast); setTimeout(() => toast.classList.add('show'), 10); toastTimeoutId = setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, duration); }

        return { injectStyles, showModal, closeModal, showToast };
    })();
    
    const Utils = (function() { return { escapeHtml(text) { if (typeof text !== 'string') return text ?? ''; const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, m => map[m]); }, getTodayStr() { const d = new Date(); return `${d.getFullYear()}${('0' + (d.getMonth() + 1)).slice(-2)}${('0' + d.getDate()).slice(-2)}`; }, formatDate(dtStr) { if (!dtStr || !String(dtStr).trim()) return ''; const datePart = String(dtStr).split(' ')[0].replace(/-/g, ''); if (datePart.length !== 8) return dtStr; return datePart.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'); }, getSaleStatus(today, startDateStr, endDateStr) { if (!startDateStr || !endDateStr) return ''; const start = new Date(this.formatDate(startDateStr)); const end = new Date(this.formatDate(endDateStr)); const todayDate = new Date(this.formatDate(today)); if (isNaN(start.getTime()) || isNaN(end.getTime())) return AppConfig.SALE_STATUS.ABNORMAL; if (String(endDateStr).includes('9999')) return AppConfig.SALE_STATUS.CURRENT; if (todayDate.getTime() > end.getTime()) return AppConfig.SALE_STATUS.STOPPED; if (todayDate.getTime() < start.getTime()) return AppConfig.SALE_STATUS.PENDING; return AppConfig.SALE_STATUS.CURRENT; } }; })();
    const APIService = (function() { let _token = ''; let _apiBase = ''; async function _fetch(endpoint, payload) { try { const response = await fetch(`${_apiBase}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': _token }, body: JSON.stringify(payload) }); if (response.status === 401) throw new Error('Token 無效 (401)'); if (!response.ok) throw new Error(`API 請求失敗: ${response.status}`); return response.json(); } catch (error) { console.error(`API 呼叫失敗 (${endpoint}):`, error); throw error; } } return { init(token, apiBase) { _token = token; _apiBase = apiBase; }, async verifyToken() { try { await _fetch('/planCodeController/query', { planCode: '5105', pageNo: 1, pageSize: 1 }); return true; } catch { return false; } }, getMasterPlans(params) { return _fetch('/planCodeController/query', params); }, getPlanDetails(planCode) { return _fetch('/planCodeController/queryDetail', { planCode, pageNo: 1, pageSize: AppConfig.API_FETCH_CONFIG.DETAIL_PAGE_SIZE }); }, getChannelSales(planCode) { return _fetch('/planCodeSaleDateController/query', { planCode, pageNo: 1, pageSize: AppConfig.API_FETCH_CONFIG.CHANNEL_PAGE_SIZE }); } }; })();
    const DataProcessor = (function() { let _cache = { details: new Map(), channels: new Map() }; function _processRecord(raw, index, today) { return { id: raw.planCode + '_' + index, no: index + 1, planCode: raw.planCode, secondaryCode: '-', name: raw.shortName || raw.planCodeName, currency: AppConfig.FIELD_MAPS.CURRENCY[raw.currency] || raw.currency || '-', unit: AppConfig.FIELD_MAPS.UNIT[raw.reportInsuranceAmountUnit] || AppConfig.FIELD_MAPS.UNIT[raw.insuranceAmountUnit] || '-', type: AppConfig.FIELD_MAPS.COVERAGE_TYPE[raw.coverageType] || raw.coverageType || '-', saleStartDate: Utils.formatDate(raw.saleStartDate), saleEndDate: Utils.formatDate(raw.saleEndDate), mainStatus: Utils.getSaleStatus(today, raw.saleStartDate, raw.saleEndDate), channels: [], detailsFetched: false, }; } async function _fetchAndAssignDetails(item, today) { if (_cache.channels.has(item.planCode)) { item.channels = _cache.channels.get(item.planCode); } else { try { const data = await APIService.getChannelSales(item.planCode); item.channels = (data.planCodeSaleDates?.records || []).map(c => ({ name: c.channel === 'OT' ? 'BK' : c.channel, status: Utils.getSaleStatus(today, c.saleStartDate, c.saleEndDate), endDate: Utils.formatDate(c.saleEndDate) })); _cache.channels.set(item.planCode, item.channels); } catch (e) { console.warn(`查詢通路 ${item.planCode} 失敗`); } } item.detailsFetched = true; return item; } return { processInitialData(rawData) { _cache.details.clear(); _cache.channels.clear(); const today = Utils.getTodayStr(); return rawData.map((d, i) => _processRecord(d, i, today)); }, async fetchDetailsForRow(item) { return await _fetchAndAssignDetails(item, Utils.getTodayStr()); }, async fetchAllDetails(data) { const today = Utils.getTodayStr(); const promises = data.map(item => item.detailsFetched ? Promise.resolve(item) : _fetchAndAssignDetails(item, today)); return Promise.all(promises); } }; })();

    // ============================================================================
    // 模組 6: AppCore - 應用程式核心
    // ============================================================================
    const AppCore = (function() {
        let state = {};

        function initState() {
            state = { env: '', apiBase: '', token: '', allData: [], displayedData: [] };
        }

        // --- HTML Templates ---
        function getTokenDialogHTML() { return { title: `API TOKEN 設定`, body: `<textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 API TOKEN..."></textarea>`, footer: `<button id="pct-token-skip" class="pct-btn pct-btn-warning">略過</button><button id="pct-token-close" class="pct-btn pct-btn-danger">關閉</button><button id="pct-token-ok" class="pct-btn pct-btn-primary">確定</button>` }; }
        function getQueryDialogHTML() {
            const modes = [ { key: 'planCode', label: '商品代號' }, { key: 'planCodeName', label: '商品名稱' }, { key: 'allMasterPlans', label: '全部主檔' }, { key: 'masterInSale', label: '主檔現售' }, { key: 'channelInSale', label: '通路現售' } ];
            return { title: '選擇查詢條件', body: `<div class="pct-query-segment">${modes.map(m => `<button class="pct-query-segment-btn" data-mode="${m.key}">${m.label}</button>`).join('')}</div><div id="pct-dynamic-area"></div>`, footer: `<button id="pct-query-cancel" class="pct-btn pct-btn-secondary">取消</button><button id="pct-query-ok" class="pct-btn pct-btn-primary">查詢</button>` };
        }
        function getDynamicQueryHTML(mode) {
            if (mode === 'planCode' || mode === 'planCodeName') { return `<textarea id="pct-query-input" class="pct-input" rows="4" placeholder="${mode === 'planCode' ? '請輸入商品代號，多筆可用空格、換行分隔' : '請輸入商品名稱關鍵字'}"></textarea>`; }
            if (mode === 'channelInSale') { const channels = AppConfig.FIELD_MAPS.CHANNELS.map(c => `<button class="pct-btn pct-btn-secondary" data-channel="${c}" style="flex-grow: 1;">${c}</button>`).join(''); return `<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${channels}</div>`; }
            return '<p style="text-align: center; color: #6c757d; padding: 1rem 0;">無需輸入額外條件，請直接點擊查詢。</p>';
        }
        function getResultsHTML() {
            const headers = [ { key: 'no', label: 'No' }, { key: 'planCode', label: '代號' }, { key: 'name', label: '商品名稱' }, { key: 'currency', label: '幣別' }, { key: 'unit', label: '單位' }, { key: 'type', label: '類型' }, { key: 'saleStartDate', label: '銷售起日' }, { key: 'saleEndDate', label: '銷售狀態' } ];
            const getStatusCellHTML = (item) => { let html = `<div class="status-text-${item.mainStatus === '現售中' ? 'current' : 'stopped'}">${item.mainStatus}</div>`; if (item.detailsFetched) { const sellable = item.channels.filter(c => c.status === '現售中').map(c => c.name).join(', '); const stopped = item.channels.filter(c => c.status === '停售').map(c => c.name).join(', '); if (sellable) html += `<div class="channel-list">可售: ${sellable}</div>`; if (stopped) html += `<div class="channel-list">停售: ${stopped}</div>`; } return html; };
            return `
                <div class="pct-results-controls">
                    <div class="pct-results-summary">總共 ${state.displayedData.length} 筆資料</div>
                    <button id="res-copy" class="pct-btn pct-btn-success">一鍵複製</button>
                    <button id="res-fetch-all" class="pct-btn pct-btn-info">查詢本頁資料</button>
                    <button id="res-requery" class="pct-btn pct-btn-primary">重新查詢</button>
                    <button id="res-close" class="pct-btn pct-btn-secondary">關閉</button>
                </div>
                <div class="pct-table-wrap">
                    <table class="pct-table">
                        <thead><tr>${headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead>
                        <tbody>${state.displayedData.map(item => `
                            <tr data-id="${item.id}">
                                <td>${item.no}</td>
                                <td><div>${Utils.escapeHtml(item.planCode)}</div><div class="code-secondary">${Utils.escapeHtml(item.secondaryCode)}</div></td>
                                <td>${Utils.escapeHtml(item.name)}</td><td>${item.currency}</td><td>${item.unit}</td><td>${item.type}</td>
                                <td>${item.saleStartDate}</td><td>${getStatusCellHTML(item)}</td>
                            </tr>`).join('') || `<tr><td colspan="${headers.length}" style="text-align: center; padding: 2rem;">查無資料</td></tr>`}
                        </tbody>
                    </table>
                </div>`;
        }

        // --- Business Logic ---
        function start() {
            document.getElementById(AppConfig.TOOL_ID)?.remove();
            initState();
            UIManager.injectStyles();
            state.env = window.location.hostname.includes('uat') ? 'UAT' : 'PROD';
            state.apiBase = AppConfig.API_ENDPOINTS[state.env];
            showTokenDialog();
        }

        function showTokenDialog() {
            state.token = localStorage.getItem(`sso_token_pq_v5_${state.env.toLowerCase()}`) || '';
            UIManager.showModal({
                ...getTokenDialogHTML(),
                onOpen: (modal) => {
                    const tokenInput = modal.querySelector('#pct-token-input');
                    tokenInput.value = state.token;
                    tokenInput.focus();
                    
                    const proceed = (token, shouldVerify) => {
                        state.token = token;
                        if(token) localStorage.setItem(`sso_token_pq_v5_${state.env.toLowerCase()}`, token);
                        APIService.init(token, state.apiBase);

                        if (!shouldVerify) {
                            if (!token) { UIManager.showToast('請至少提供一組 Token 以進行略過', 'error'); return; }
                            UIManager.closeModal(); setTimeout(showQueryDialog, 250);
                            return;
                        }

                        if (!token) { UIManager.showToast('Token 不可為空', 'error'); return; }
                        UIManager.showToast('驗證中...', 'info');
                        APIService.verifyToken().then(isValid => {
                            if(isValid) { UIManager.closeModal(); setTimeout(showQueryDialog, 250); }
                            else { UIManager.showToast('Token 無效或已過期', 'error'); }
                        });
                    };

                    modal.querySelector('#pct-token-ok').onclick = () => proceed(tokenInput.value.trim(), true);
                    modal.querySelector('#pct-token-skip').onclick = () => proceed(tokenInput.value.trim(), false);
                    modal.querySelector('#pct-token-close').onclick = UIManager.closeModal;
                }
            });
        }
        
        function showQueryDialog() {
            let selectedMode = '', queryInput = '', selectedChannels = [];
            UIManager.showModal({
                ...getQueryDialogHTML(),
                onOpen: (modal) => {
                    const dynamicArea = modal.querySelector('#pct-dynamic-area');
                    modal.querySelectorAll('.pct-query-segment-btn').forEach(btn => btn.onclick = (e) => {
                        modal.querySelectorAll('.pct-query-segment-btn').forEach(b => b.classList.remove('selected'));
                        e.currentTarget.classList.add('selected');
                        selectedMode = e.currentTarget.dataset.mode;
                        dynamicArea.innerHTML = getDynamicQueryHTML(selectedMode);
                        if (selectedMode === 'channelInSale') {
                            dynamicArea.querySelectorAll('[data-channel]').forEach(chBtn => chBtn.onclick = (ev) => {
                                ev.currentTarget.classList.toggle('selected');
                                selectedChannels = [...dynamicArea.querySelectorAll('[data-channel].selected')].map(b => b.dataset.channel);
                            });
                        }
                    });
                    
                    modal.querySelector('#pct-query-cancel').onclick = UIManager.closeModal;
                    modal.querySelector('#pct-query-ok').onclick = () => {
                        queryInput = modal.querySelector('#pct-query-input')?.value.trim() || '';
                        if (!selectedMode) { UIManager.showToast('請選擇一個查詢模式', 'error'); return; }
                        runQuery(selectedMode, queryInput, selectedChannels);
                    };
                }
            });
        }

        async function runQuery(mode, input, channels) {
            UIManager.showToast('查詢中，請稍候...', 'info', 10000);
            UIManager.closeModal();
            let rawData = [];
            try {
                let params = { pageNo: 1, pageSize: AppConfig.API_FETCH_CONFIG.MASTER_PAGE_SIZE };
                if (mode === 'planCode') {
                    const codes = input.split(/[\s,;]+/).filter(Boolean);
                    const results = await Promise.allSettled(codes.map(code => APIService.getMasterPlans({ ...params, planCode: code })));
                    results.forEach(res => { if (res.status === 'fulfilled' && res.value.records) rawData.push(...res.value.records); });
                } else if (mode === 'channelInSale') {
                    const channelsToQuery = channels.length > 0 ? channels : AppConfig.FIELD_MAPS.CHANNELS;
                    let allChannelRecords = [];
                    for (const ch of channelsToQuery) {
                        const channelParam = ch === 'BK' ? 'OT' : ch;
                        const result = await APIService.getChannelSales({ channel: channelParam, pageIndex: 1, size: AppConfig.API_FETCH_CONFIG.CHANNEL_PAGE_SIZE, saleEndDate: "9999-12-31 00:00:00" });
                        if (result.planCodeSaleDates?.records) allChannelRecords.push(...result.planCodeSaleDates.records);
                    }
                    const uniquePlanCodes = [...new Set(allChannelRecords.map(r => r.planCode))];
                    if (uniquePlanCodes.length > 0) {
                        const masterResults = await Promise.allSettled(uniquePlanCodes.map(code => APIService.getMasterPlans({ planCode: code, pageSize: 1 })));
                        masterResults.forEach(res => { if (res.status === 'fulfilled' && res.value.records) rawData.push(...res.value.records); });
                    }
                } else {
                    if (mode === 'planCodeName') params.planCodeName = input;
                    if (mode === 'masterInSale') params.saleEndDate = "9999-12-31 00:00:00";
                    const result = await APIService.getMasterPlans(params);
                    rawData = result.records || [];
                }
                state.allData = DataProcessor.processInitialData(rawData);
                state.displayedData = state.allData;
                setTimeout(() => renderResults(), 250);
            } catch(error) { UIManager.showToast(`查詢失敗: ${error.message}`, 'error'); }
        }

        function renderResults() {
             UIManager.showModal({
                title: '查詢結果', body: getResultsHTML(), footer: ``, isResultView: true,
                onOpen: (modal) => {
                    modal.querySelector('.pct-modal-body').style.padding = '0';
                    modal.querySelector('.pct-modal-footer').style.display = 'none';

                    modal.querySelector('#res-requery').onclick = () => { UIManager.closeModal(); setTimeout(showQueryDialog, 250); };
                    modal.querySelector('#res-close').onclick = UIManager.closeModal;
                    modal.querySelector('#res-fetch-all').onclick = async () => {
                        UIManager.showToast('正在查詢本頁所有通路資料...', 'info');
                        await DataProcessor.fetchAllDetails(state.displayedData);
                        renderResults();
                        UIManager.showToast('本頁資料查詢完畢', 'success');
                    };
                    modal.querySelector('#res-copy').onclick = () => {
                        const header = "No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t主檔狀態\t通路狀態\n";
                        const rows = state.displayedData.map(item => {
                            const channelStatus = item.channels.map(c => `${c.name}:${c.status}`).join('; ');
                            return [item.no, item.planCode, item.name, item.currency, item.unit, item.type, item.saleStartDate, item.mainStatus, channelStatus].join('\t');
                        }).join('\n');
                        Utils.copyToClipboard(header + rows);
                    };
                }
            });
        }
        
        return { start };
    })();

    // ============================================================================
    // Entry Point
    // ============================================================================
    AppCore.start();

})();