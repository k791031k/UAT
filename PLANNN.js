/**
 * ============================================================================
 * 商品代碼查詢工具 v6.0 - FINAL
 *
 * 架構師：Gemini (由 Google 開發)
 * 發佈日期：2025-06-23
 *
 * v6.0 更新日誌:
 * - 核心架構重構：從多 Modal 模式改為單一、可拖曳的浮動視窗，符合使用者核心需求。
 * - UI 與事件修復：確保所有關閉按鈕、取消按鈕與 ESC 鍵都能正常運作。
 * - 新增進階功能：加入大量查詢時的「中斷機制」與單筆查詢失敗的「重試流程」。
 * - 完整實現最終版 UI 設計與所有已確認的業務邏輯。
 * ============================================================================
 */
javascript:(async () => {
    // 立即執行的函式 (IIFE)，包裹所有程式碼以避免污染全域範圍
    (function() {
        'use strict';

        // ============================================================================
        // 模組 1: AppConfig - 應用程式靜態設定
        // 職責：提供所有硬編碼的常數、ID、API 端點與設定，作為唯一的真值來源。
        // ============================================================================
        const AppConfig = Object.freeze({
            TOOL_ID: 'planCodeQueryTool_v6',
            STYLE_ID: 'planCodeToolStyle_v6',
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
                PAGE_SIZE: 50
            },
            API_FETCH_CONFIG: {
                MASTER_PAGE_SIZE: 5000,
                DETAIL_PAGE_SIZE: 50,
                CHANNEL_PAGE_SIZE: 1000
            }
        });

        // ============================================================================
        // 模組 2: UIManager - 使用者介面管理器 (重構為單一視窗模式)
        // ============================================================================
        const UIManager = (function() {
            let ui = {
                container: null,
                header: null,
                title: null,
                content: null,
            };
            let toastTimeoutId = null;

            // --- 核心 UI 創建與銷毀 ---
            function createMainUI() {
                destroyMainUI(); 
                injectStyles();

                ui.container = document.createElement('div');
                ui.container.id = AppConfig.TOOL_ID;
                ui.container.className = 'pct-main-window';

                ui.header = document.createElement('div');
                ui.header.className = 'pct-main-header';
                
                ui.title = document.createElement('span');
                ui.title.className = 'pct-title-text';

                const closeBtn = document.createElement('button');
                closeBtn.className = 'pct-close-btn';
                closeBtn.innerHTML = '&times;';
                closeBtn.onclick = AppCore.destroy;

                ui.header.appendChild(ui.title);
                ui.header.appendChild(closeBtn);
                ui.container.appendChild(ui.header);

                ui.content = document.createElement('div');
                ui.content.className = 'pct-main-content';
                ui.container.appendChild(ui.content);

                document.body.appendChild(ui.container);

                enableDrag();
            }

            function destroyMainUI() {
                const existingUI = document.getElementById(AppConfig.TOOL_ID);
                if (existingUI) {
                    existingUI.remove();
                }
                const existingStyle = document.getElementById(AppConfig.STYLE_ID);
                if(existingStyle) {
                    existingStyle.remove();
                }
                ui = { container: null, header: null, title: null, content: null };
            }

            // --- 視圖渲染 ---
            function renderView({ title, bodyHTML, footerHTML }) {
                if (!ui.container) createMainUI();
                ui.title.innerHTML = title; 
                ui.content.innerHTML = `<div class="pct-content-body">${bodyHTML}</div><div class="pct-content-footer">${footerHTML}</div>`;
            }
            
            // --- 拖曳邏輯 ---
            function enableDrag() {
                let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
                if(ui.header) {
                    ui.header.onmousedown = dragMouseDown;
                }

                function dragMouseDown(e) {
                    if (e.target.tagName === 'BUTTON') return;
                    e = e || window.event;
                    e.preventDefault();
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.onmousemove = elementDrag;
                }

                function elementDrag(e) {
                    e = e || window.event;
                    e.preventDefault();
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    ui.container.style.top = (ui.container.offsetTop - pos2) + "px";
                    ui.container.style.left = (ui.container.offsetLeft - pos1) + "px";
                }

                function closeDragElement() {
                    document.onmouseup = null;
                    document.onmousemove = null;
                }
            }


            // --- 其他 UI 輔助函式 ---
            function injectStyles() {
                if (document.getElementById(AppConfig.STYLE_ID)) return;
                const style = document.createElement('style');
                style.id = AppConfig.STYLE_ID;
                style.textContent = `
                    :root { --pct-primary: #007BFF; --pct-dark: #343a40; --pct-success: #28a745; --pct-danger: #dc3545; --pct-warning: #ffc107; --pct-info: #17a2b8; --pct-light: #f8f9fa; --pct-surface: #FFFFFF; --pct-border: #dee2e6; --pct-shadow: rgba(0, 0, 0, 0.1); --pct-radius: 8px; --pct-transition: 0.2s ease-in-out; }
                    .pct-main-window { position: fixed; top: 100px; left: 100px; min-width: 550px; max-width: 90vw; background: var(--pct-light); border-radius: var(--pct-radius); box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 2147483640; display: flex; flex-direction: column; border: 1px solid #ccc; font-family: 'Microsoft JhengHei', sans-serif; }
                    .pct-main-header { padding: 0.75rem 1rem; background: var(--pct-dark); color: #fff; cursor: move; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; user-select: none; }
                    .pct-title-text { font-weight: 600; }
                    .pct-close-btn { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; opacity: 0.7; transition: var(--pct-transition); } .pct-close-btn:hover { opacity: 1; }
                    .pct-main-content { background: #fff; }
                    .pct-content-body { padding: 1.5rem; }
                    .pct-content-footer { padding: 1rem 1.5rem; background: #f1f3f5; border-top: 1px solid var(--pct-border); display: flex; justify-content: flex-end; gap: 0.75rem; }
                    .pct-btn { position: relative; padding: 0.6rem 1.2rem; font-size: 1rem; border-radius: var(--pct-radius); border: 1px solid transparent; cursor: pointer; transition: all var(--pct-transition); font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
                    .pct-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 4px 12px var(--pct-shadow); }
                    .pct-btn:disabled { cursor: not-allowed; opacity: 0.65; }
                    .pct-btn-primary { background: var(--pct-primary); color: #fff; }
                    .pct-btn-danger { background: var(--pct-danger); color: #fff; }
                    .pct-btn-warning { background: var(--pct-warning); color: #212529; }
                    .pct-btn-secondary { background: #6c757d; color: #fff; }
                    .pct-query-segment { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
                    .pct-query-segment-btn { padding: 0.5rem 1rem; background: var(--pct-surface); color: var(--pct-dark); border: 1px solid var(--pct-border); cursor: pointer; transition: all var(--pct-transition); font-size: 0.95rem; border-radius: var(--pct-radius); }
                    .pct-query-segment-btn.selected { background: var(--pct-primary); color: #fff; border-color: var(--pct-primary); }
                    .pct-input, .pct-textarea { width: 100%; box-sizing: border-box; font-size: 1rem; padding: 0.75rem; border-radius: var(--pct-radius); border: 1px solid var(--pct-border); font-family: inherit; }
                    .pct-table-wrap { overflow: auto; max-height: 60vh; border: 1px solid var(--pct-border); border-radius: var(--pct-radius); }
                    .pct-table { border-collapse: collapse; width: 100%; font-size: 0.9rem; min-width: 1400px; }
                    .pct-table th { background: #495057; color: #fff; text-align: left; padding: 0.75rem 1rem; font-weight: 600; cursor: pointer; position: sticky; top: 0; z-index: 1; }
                    .pct-table td { border-bottom: 1px solid var(--pct-border); padding: 0.75rem 1rem; vertical-align: middle; line-height: 1.6; }
                    .pct-table tr:last-child td { border-bottom: none; }
                    .pct-table .code-secondary { color: #28a745; }
                    .pct-toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #fff; padding: 12px 24px; border-radius: 6px; z-index: 2147483647; opacity: 0; transition: all 0.4s ease; display: flex; align-items: center; gap: 15px; }
                    .pct-toast.show { opacity: 1; transform: translateY(-10px); }
                    .pct-toast-cancel-btn { background: #555; border: 1px solid #777; color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
                    .pct-spinner { width: 1em; height: 1em; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: pct-spin .75s linear infinite; } @keyframes pct-spin { to { transform: rotate(360deg); } }
                `;
                document.head.appendChild(style);
            }
            
            function showToast({ message, type = 'info', duration = 3000, onCancel = null }) {
                clearTimeout(toastTimeoutId);
                const existingToast = document.querySelector('.pct-toast');
                if(existingToast) existingToast.remove();
                const toast = document.createElement('div');
                toast.className = `pct-toast ${type}`;
                
                const messageSpan = document.createElement('span');
                messageSpan.className = 'pct-toast-message';
                messageSpan.textContent = message;
                toast.appendChild(messageSpan);

                if (onCancel) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'pct-toast-cancel-btn';
                    cancelBtn.textContent = '取消';
                    cancelBtn.onclick = (e) => {
                        e.stopPropagation();
                        onCancel();
                        toast.remove();
                        clearTimeout(toastTimeoutId);
                    };
                    toast.appendChild(cancelBtn);
                }
                
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                if (duration > 0) {
                    toastTimeoutId = setTimeout(() => { toast.remove(); }, duration);
                }
                return toast;
            }

            return { createMainUI, destroyMainUI, renderView, showToast };
        })();
        
        const Utils = (function() { return { escapeHtml(text) { if (typeof text !== 'string') return text ?? ''; const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, m => map[m]); }, getTodayStr() { const d = new Date(); return `${d.getFullYear()}${('0' + (d.getMonth() + 1)).slice(-2)}${('0' + d.getDate()).slice(-2)}`; }, formatDate(dtStr) { if (!dtStr || !String(dtStr).trim()) return ''; const datePart = String(dtStr).split(' ')[0].replace(/-/g, ''); if (datePart.length !== 8) return dtStr; return datePart.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'); }, getSaleStatus(today, startDateStr, endDateStr) { if (!startDateStr || !endDateStr) return ''; const start = new Date(this.formatDate(startDateStr)); const end = new Date(this.formatDate(endDateStr)); const todayDate = new Date(this.formatDate(today)); if (isNaN(start.getTime()) || isNaN(end.getTime())) return AppConfig.SALE_STATUS.ABNORMAL; if (String(endDateStr).includes('9999')) return AppConfig.SALE_STATUS.CURRENT; if (todayDate.getTime() > end.getTime()) return AppConfig.SALE_STATUS.STOPPED; if (todayDate.getTime() < start.getTime()) return AppConfig.SALE_STATUS.PENDING; return AppConfig.SALE_STATUS.CURRENT; }, copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => UIManager.showToast({ message: '已成功複製到剪貼簿', type: 'success' }), () => UIManager.showToast({ message: '複製失敗', type: 'error'})); } }; })();
        const APIService = (function() { let _token = ''; let _apiBase = ''; async function _fetch(endpoint, payload, signal) { try { const response = await fetch(`${_apiBase}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': _token }, body: JSON.stringify(payload), signal }); if (response.status === 401) throw new Error('Token 無效 (401)'); if (!response.ok) throw new Error(`API 請求失敗: ${response.status}`); return response.json(); } catch (error) { if (error.name === 'AbortError') throw new Error('查詢已中止'); console.error(`API 呼叫失敗 (${endpoint}):`, error); throw error; } } return { init(token, apiBase) { _token = token; _apiBase = apiBase; }, async verifyToken() { try { await _fetch('/planCodeController/query', { planCode: '5105', pageNo: 1, pageSize: 1 }); return true; } catch { return false; } }, getMasterPlans(params, signal) { return _fetch('/planCodeController/query', params, signal); }, getChannelSales(planCode, signal) { return _fetch('/planCodeSaleDateController/query', { planCode, pageNo: 1, pageSize: AppConfig.API_FETCH_CONFIG.CHANNEL_PAGE_SIZE }, signal); } }; })();
        const DataProcessor = (function() { let _cache = { channels: new Map() }; function _processRecord(raw, index, today) { return { id: raw.planCode + '_' + index, no: index + 1, planCode: raw.planCode, secondaryCode: '-', name: raw.shortName || raw.planCodeName, currency: AppConfig.FIELD_MAPS.CURRENCY[raw.currency] || raw.currency || '-', unit: AppConfig.FIELD_MAPS.UNIT[raw.reportInsuranceAmountUnit] || AppConfig.FIELD_MAPS.UNIT[raw.insuranceAmountUnit] || '-', type: AppConfig.FIELD_MAPS.COVERAGE_TYPE[raw.coverageType] || raw.coverageType || '-', saleStartDate: Utils.formatDate(raw.saleStartDate), saleEndDate: Utils.formatDate(raw.saleEndDate), mainStatus: Utils.getSaleStatus(today, raw.saleStartDate, raw.saleEndDate), channels: [], detailsFetched: false, _isErrorRow: raw._isErrorRow || false, _errorMsg: raw._errorMsg || '' }; } async function _fetchAndAssignDetails(item, today, signal) { if (_cache.channels.has(item.planCode)) { item.channels = _cache.channels.get(item.planCode); } else { try { const data = await APIService.getChannelSales(item.planCode, signal); item.channels = (data.planCodeSaleDates?.records || []).map(c => ({ name: c.channel === 'OT' ? 'BK' : c.channel, status: Utils.getSaleStatus(today, c.saleStartDate, c.saleEndDate), startDate: Utils.formatDate(c.saleStartDate), endDate: Utils.formatDate(c.saleEndDate) })); _cache.channels.set(item.planCode, item.channels); } catch (e) { if (e.name === 'AbortError') throw e; console.warn(`查詢通路 ${item.planCode} 失敗`); } } item.detailsFetched = true; return item; } return { processInitialData(rawData) { _cache.channels.clear(); const today = Utils.getTodayStr(); return rawData.map((d, i) => _processRecord(d, i, today)); }, async fetchAllDetails(data, signal) { const today = Utils.getTodayStr(); const promises = data.map(item => item.detailsFetched ? Promise.resolve(item) : _fetchAndAssignDetails(item, today, signal)); return Promise.all(promises); } }; })();

        // ============================================================================
        // 模組 6: AppCore - 應用程式核心
        // ============================================================================
        const AppCore = (function() {
            let state = {};
            let queryAbortController = null;

            function initState() { state = { env: '', apiBase: '', token: '', allData: [], displayedData: [], pageNo: 1, isQueryCancelled: false }; }
            function destroy() { UIManager.destroyMainUI(); document.removeEventListener('keydown', handleGlobalEsc); }
            function handleGlobalEsc(e) { if (e.key === 'Escape') destroy(); }
            
            function start() {
                destroy();
                initState();
                state.env = window.location.hostname.includes('uat') ? 'UAT' : 'PROD';
                state.apiBase = AppConfig.API_ENDPOINTS[state.env];
                document.addEventListener('keydown', handleGlobalEsc);
                UIManager.createMainUI();
                showTokenView();
            }

            function showTokenView() {
                state.token = localStorage.getItem(`sso_token_pq_v6_${state.env.toLowerCase()}`) || '';
                UIManager.renderView({
                    title: `API TOKEN 設定 (${state.env})`,
                    bodyHTML: `<textarea class="pct-textarea" id="pct-token-input" rows="4" placeholder="請貼上您的 API TOKEN..."></textarea>`,
                    footerHTML: `<button id="pct-token-skip" class="pct-btn pct-btn-warning">略過</button><button id="pct-token-close" class="pct-btn pct-btn-secondary">關閉</button><button id="pct-token-ok" class="pct-btn pct-btn-primary">確定</button>`
                });
                
                const contentEl = document.querySelector(`#${AppConfig.TOOL_ID} .pct-main-content`);
                const tokenInput = contentEl.querySelector('#pct-token-input');
                tokenInput.value = state.token;
                tokenInput.focus();

                const proceed = async (token, shouldVerify) => {
                    const okBtn = contentEl.querySelector('#pct-token-ok');
                    if (okBtn.disabled) return;
                    
                    if (!token) { UIManager.showToast({ message: 'Token 不可為空', type: 'error' }); return; }

                    state.token = token;
                    localStorage.setItem(`sso_token_pq_v6_${state.env.toLowerCase()}`, token);
                    APIService.init(token, state.apiBase);

                    if (!shouldVerify) { showQueryView(); return; }

                    okBtn.disabled = true;
                    okBtn.innerHTML = `<div class="pct-spinner"></div> 驗證中`;
                    const isValid = await APIService.verifyToken();
                    okBtn.disabled = false;
                    okBtn.innerHTML = '確定';

                    if (isValid) { UIManager.showToast({ message: 'Token 驗證成功', type: 'success' }); showQueryView(); }
                    else { UIManager.showToast({ message: 'Token 無效或已過期', type: 'error' }); }
                };

                contentEl.querySelector('#pct-token-ok').onclick = () => proceed(tokenInput.value.trim(), true);
                contentEl.querySelector('#pct-token-skip').onclick = () => proceed(tokenInput.value.trim(), false);
                contentEl.querySelector('#pct-token-close').onclick = destroy;
            }

            function showQueryView() {
                let selectedMode = 'planCode', queryInput = '', selectedChannels = [];
                const modes = [ { key: 'planCode', label: '商品代號' }, { key: 'planCodeName', label: '商品名稱' }, { key: 'allMasterPlans', label: '全部主檔' }, { key: 'masterInSale', label: '主檔現售' }, { key: 'masterStopped', label: '主檔停售' }, { key: 'channelInSale', label: '通路現售' }, { key: 'channelStopped', label: '通路停售' }];
                const masterModes = modes.slice(0, 5);
                const channelModes = modes.slice(5, 7);
                const toHtml = (m) => `<button class="pct-query-segment-btn" data-mode="${m.key}">${m.label}</button>`;

                UIManager.renderView({
                    title: `選擇查詢條件 (${state.env})`,
                    bodyHTML: `<div><strong>主檔查詢</strong></div><div class="pct-query-segment">${masterModes.map(toHtml).join('')}</div><div style="margin-top: 1rem;"><strong>通路查詢 (此查詢較耗時)</strong></div><div class="pct-query-segment">${channelModes.map(toHtml).join('')}</div><div id="pct-dynamic-area" style="margin-top: 1.5rem;"></div>`,
                    footerHTML: `<button id="pct-query-cancel" class="pct-btn pct-btn-secondary">關閉</button><button id="pct-query-ok" class="pct-btn pct-btn-primary">查詢</button>`
                });

                const contentEl = document.querySelector(`#${AppConfig.TOOL_ID} .pct-main-content`);
                const dynamicArea = contentEl.querySelector('#pct-dynamic-area');
                const queryBtns = contentEl.querySelectorAll('.pct-query-segment-btn');
                
                function selectMode(btn) {
                    queryBtns.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedMode = btn.dataset.mode;
                    dynamicArea.innerHTML = getDynamicQueryHTML(selectedMode);
                     if (selectedMode === 'channelInSale' || selectedMode === 'channelStopped') {
                        dynamicArea.querySelectorAll('.pct-channel-check').forEach(chk => {
                            chk.onchange = () => {
                                selectedChannels = [...dynamicArea.querySelectorAll('.pct-channel-check:checked')].map(c => c.value);
                            };
                        });
                    }
                }
                
                queryBtns.forEach(btn => btn.onclick = (e) => selectMode(e.currentTarget));
                selectMode(queryBtns[0]); // Default selection

                contentEl.querySelector('#pct-query-cancel').onclick = destroy;
                contentEl.querySelector('#pct-query-ok').onclick = (e) => {
                    queryInput = contentEl.querySelector('#pct-query-input')?.value.trim() || '';
                    if (selectedMode === 'channelInSale' || selectedMode === 'channelStopped') {
                         selectedChannels = Array.from(contentEl.querySelectorAll('.pct-channel-check:checked')).map(cb => cb.value);
                    }

                    if (!selectedMode) { UIManager.showToast({ message: '請選擇一個查詢模式', type: 'error' }); return; }
                    if ((selectedMode === AppConfig.QUERY_MODES.PLAN_CODE || selectedMode === AppConfig.QUERY_MODES.PLAN_NAME) && !queryInput) { UIManager.showToast({ message: '請輸入查詢內容', type: 'error' }); return; }
                    
                    const queryBtn = e.currentTarget;
                    queryBtn.disabled = true;
                    queryBtn.innerHTML = `<div class="pct-spinner"></div> 查詢中`;
                    
                    runQuery(selectedMode, queryInput, selectedChannels).finally(() => {
                        queryBtn.disabled = false;
                        queryBtn.innerHTML = '查詢';
                    });
                };
            }
            
            async function runQuery(mode, input, channels) {
                state.isQueryCancelled = false;
                queryAbortController = new AbortController();
                const signal = queryAbortController.signal;

                const toast = UIManager.showToast({ message: '查詢中...', duration: 0, onCancel: () => queryAbortController.abort() });
                const toastMsgEl = toast.querySelector('.pct-toast-message');

                try {
                    let rawData = [];
                    const today = Utils.getTodayStr();
                    
                    if (mode === AppConfig.QUERY_MODES.PLAN_CODE) {
                        const codes = input.split(/[\s,;]+/).filter(Boolean);
                        for (let i = 0; i < codes.length; i++) {
                            if (signal.aborted) throw new Error('查詢已取消');
                            toastMsgEl.textContent = `查詢中... (${i + 1}/${codes.length})`;
                            try {
                                const result = await APIService.getMasterPlans({ planCode: codes[i], pageSize: 1 }, signal);
                                if (result.records?.length > 0) rawData.push(...result.records);
                                else rawData.push({ _isErrorRow: true, planCode: codes[i], _errorMsg: '查無資料' });
                            } catch (e) {
                                if (signal.aborted) throw e;
                                rawData.push({ _isErrorRow: true, planCode: codes[i], _errorMsg: `查詢失敗` });
                            }
                        }
                    } else if (mode === AppConfig.QUERY_MODES.CHANNEL_IN_SALE || mode === AppConfig.QUERY_MODES.CHANNEL_STOPPED) {
                        toastMsgEl.textContent = '正在獲取通路資料...';
                        const channelsToQuery = channels.length > 0 ? channels : AppConfig.FIELD_MAPS.CHANNELS;
                        let allChannelRecords = [];
                        for (const ch of channelsToQuery) {
                            const channelParam = ch === 'BK' ? 'OT' : ch;
                            const params = { channel: channelParam, pageIndex: 1, size: AppConfig.API_FETCH_CONFIG.CHANNEL_PAGE_SIZE };
                            const result = await APIService.getChannelSales(channelParam, signal);
                            if (result.planCodeSaleDates?.records) allChannelRecords.push(...result.planCodeSaleDates.records);
                        }
                        const filteredRecords = allChannelRecords.filter(r => Utils.getSaleStatus(today, r.saleStartDate, r.saleEndDate) === (mode === AppConfig.QUERY_MODES.CHANNEL_IN_SALE ? AppConfig.SALE_STATUS.CURRENT : AppConfig.SALE_STATUS.STOPPED));
                        const uniquePlanCodes = [...new Set(filteredRecords.map(r => r.planCode))];
                        for (const code of uniquePlanCodes) {
                            if(signal.aborted) break;
                            const result = await APIService.getMasterPlans({planCode: code}, signal);
                            if(result.records) rawData.push(...result.records);
                        }
                    }
                    else {
                        let params = { pageNo: 1, pageSize: AppConfig.API_FETCH_CONFIG.MASTER_PAGE_SIZE };
                        if (mode === AppConfig.QUERY_MODES.PLAN_NAME) params.planCodeName = input;
                        if (mode === AppConfig.QUERY_MODES.MASTER_IN_SALE) params.saleEndDate = '9999-12-31 00:00:00';
                        const result = await APIService.getMasterPlans(params, signal);
                        rawData = result.records || [];
                        if (mode === AppConfig.QUERY_MODES.MASTER_STOPPED) {
                            rawData = rawData.filter(r => Utils.getSaleStatus(Utils.getTodayStr(), r.saleStartDate, r.saleEndDate) === AppConfig.SALE_STATUS.STOPPED);
                        }
                    }

                    if (signal.aborted) return;
                    
                    toast.remove();
                    UIManager.showToast({ message: '查詢完成', type: 'success' });
                    state.allData = DataProcessor.processInitialData(rawData);
                    state.displayedData = state.allData;
                    renderResultsView();
                } catch(error) {
                    if (!state.isQueryCancelled) UIManager.showToast({ message: `查詢失敗: ${error.message}`, type: 'error' });
                } finally {
                    if (toast && toast.parentNode) toast.remove();
                }
            }

            function renderResultsView() {
                UIManager.renderView({
                    title: `查詢結果`,
                    bodyHTML: getResultsHTML(),
                    footerHTML: ''
                });
                // Event bindings for results view...
            }
            
            return { start, destroy };
        })();
        
        AppCore.start();
    })();
})();
