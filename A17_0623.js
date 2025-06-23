/**
 * @name KGI Life Case Query Tool
 * @version vFinal-Enhanced (Refactored + Features)
 * @description 一個用於查詢凱基人壽案件進度的瀏覽器書籤工具。此版本為最終增強版，包含可中斷的查詢流程與單筆錯誤重試機制。
 * @author Refactored by 資深 JavaScript 架構師與 UI/UX 顧問
 * @license MIT
 */
javascript: (async function() {
    "use strict";

    // --- Core Constants Module ---
    const Constants = (function() {
        const TOOL_MAIN_CONTAINER_ID = 'kgilifeQueryToolMainContainer_vFinalEnhanced';
        const Z_INDEX = {
            OVERLAY: 2147483640,
            MAIN_UI: 2147483630,
            NOTIFICATION: 2147483647
        };
        const API = {
            URL_UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/caseQuery/query',
            URL_PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/caseQuery/query',
            TOKEN_STORAGE_KEY: 'euisToken',
        };
        const QUERYABLE_FIELD_DEFINITIONS = [
            { queryApiKey: 'receiptNumber', queryDisplayName: '送金單號碼', color: '#007bff' },
            { queryApiKey: 'applyNumber', queryDisplayName: '受理號碼', color: '#6f42c1' },
            { queryApiKey: 'policyNumber', queryDisplayName: '保單號碼', color: '#28a745' },
            { queryApiKey: 'approvalNumber', queryDisplayName: '確認書編號', color: '#fd7e14' },
            { queryApiKey: 'insuredId', queryDisplayName: '被保人ＩＤ', color: '#17a2b8' }
        ];
        const FIELD_DISPLAY_NAMES_MAP = {
            applyNumber: '受理號碼', policyNumber: '保單號碼', approvalNumber: '確認書編號',
            receiptNumber: '送金單號碼', insuredId: '被保人ＩＤ', statusCombined: '狀態',
            mainStatus: '主狀態', subStatus: '次狀態', uwApproverUnit: '分公司',
            uwApprover: '核保員', approvalUser: '覆核', _queriedValue_: '查詢值',
            NO: '序號', _apiQueryStatus: '查詢結果'
        };
        const ALL_DISPLAY_FIELDS_API_KEYS_MAIN = ['applyNumber', 'policyNumber', 'approvalNumber', 'receiptNumber', 'insuredId', 'statusCombined', 'uwApproverUnit', 'uwApprover', 'approvalUser'];
        const UNIT_CODE_MAPPINGS = { H: '核保部', B: '北一', C: '台中', K: '高雄', N: '台南', P: '北二', T: '桃竹', G: '保服' };
        const A17_UNIT_BUTTONS_DEFS = [
            { id: 'H', label: 'H-總公司', color: '#007bff' }, { id: 'B', label: 'B-北一', color: '#28a745' },
            { id: 'P', label: 'P-北二', color: '#ffc107' }, { id: 'T', label: 'T-桃竹', color: '#17a2b8' },
            { id: 'C', label: 'C-台中', color: '#fd7e14' }, { id: 'N', label: 'N-台南', color: '#6f42c1' },
            { id: 'K', label: 'K-高雄', color: '#e83e8c' }, { id: 'UNDEF', label: '查無單位', color: '#546e7a' }
        ];
        const UNIT_MAP_FIELD_API_KEY = 'uwApproverUnit';
        const A17_TEXT_SETTINGS_STORAGE_KEY = 'kgilifeQueryTool_A17TextSettings_v3';
        const A17_DEFAULT_TEXT_CONTENT = "DEAR,\n\n依據【管理報表：A17 新契約異常帳務】所載內容，報表中列示之送金單號碼，涉及多項帳務異常情形，例如：溢繳、短收、取消件需退費、以及無相對應之案件等問題。\n\n本週我們已逐筆查詢該等異常帳務，結果顯示，這些送金單應對應至下表所列之新契約案件。為利後續帳務處理，敬請協助確認各案件之實際帳務狀況，並如有需調整或處理事項，請一併協助辦理，謝謝。";

        return Object.freeze({
            TOOL_MAIN_CONTAINER_ID, Z_INDEX, API, QUERYABLE_FIELD_DEFINITIONS,
            FIELD_DISPLAY_NAMES_MAP, ALL_DISPLAY_FIELDS_API_KEYS_MAIN,
            UNIT_CODE_MAPPINGS, A17_UNIT_BUTTONS_DEFS, UNIT_MAP_FIELD_API_KEY,
            A17_TEXT_SETTINGS_STORAGE_KEY, A17_DEFAULT_TEXT_CONTENT
        });
    })();

    const DataStore = (function(Constants) {
        let state = {
            currentApiUrl: '',
            apiAuthToken: localStorage.getItem(Constants.API.TOKEN_STORAGE_KEY),
            selectedQueryDefinition: Constants.QUERYABLE_FIELD_DEFINITIONS[0],
            originalQueryResults: [],
            isQueryCancelled: false,
            ui: {
                mainUIElement: null, tableBodyElement: null, tableHeadElement: null,
                currentHeaders: [],
            },
        };
        const setApiAuthToken = (token) => {
            state.apiAuthToken = token;
            token ? localStorage.setItem(Constants.API.TOKEN_STORAGE_KEY, token) : localStorage.removeItem(Constants.API.TOKEN_STORAGE_KEY);
        };
        const updateResultRow = (index, newRowData) => {
            if (state.originalQueryResults[index]) {
                state.originalQueryResults[index] = { ...state.originalQueryResults[index], ...newRowData };
            }
        };
        return {
            getState: () => state,
            setApiAuthToken,
            updateResultRow,
            cancelQuery: () => { state.isQueryCancelled = true; },
            resetQueryCancelFlag: () => { state.isQueryCancelled = false; },
            isQueryCancelled: () => state.isQueryCancelled,
        };
    })(Constants);

    const UIManager = (function(Constants) {
        const createDialogBase = (idSuffix, contentHtml, onCancel) => {
            const id = Constants.TOOL_MAIN_CONTAINER_ID + idSuffix;
            document.getElementById(id + '_overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = id + '_overlay';
            overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:${Constants.Z_INDEX.OVERLAY};display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei',Arial,sans-serif;backdrop-filter:blur(2px);`;
            const dialog = document.createElement('div');
            dialog.style.cssText = `background:#fff;padding:20px 25px;border-radius:8px;box-shadow:0 5px 20px rgba(0,0,0,0.25);min-width:320px;animation:qtDialogAppear 0.2s ease-out;`;
            dialog.innerHTML = contentHtml;
            if (onCancel) {
                const cancelBtnContainer = document.createElement('div');
                cancelBtnContainer.style.textAlign = 'center';
                cancelBtnContainer.style.marginTop = '15px';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '取消查詢';
                cancelBtn.className = 'qt-dialog-btn qt-dialog-btn-red';
                cancelBtn.onclick = () => {
                    cancelBtn.textContent = '正在停止...';
                    cancelBtn.disabled = true;
                    onCancel();
                };
                cancelBtnContainer.appendChild(cancelBtn);
                dialog.appendChild(cancelBtnContainer);
            }
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            const styleEl = document.createElement('style');
            styleEl.textContent = `@keyframes qtDialogAppear{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}.qt-dialog-btn{border:none;padding:8px 15px;border-radius:4px;font-size:13px;cursor:pointer;margin-left:8px;}.qt-dialog-btn-red{background:#dc3545;color:white;}.qt-dialog-btn-green{background:#28a745;color:white;}.qt-dialog-btn-orange{background:#fd7e14;color:white;}.qt-dialog-btn-blue{background:#007bff;color:white;}.qt-dialog-btn-grey{background:#6c757d;color:white;}.qt-dialog-title{margin:0 0 15px 0;font-size:18px;text-align:center;font-weight:600;}.qt-input,.qt-textarea{width:calc(100% - 18px);padding:9px;border:1px solid #ccc;border-radius:4px;margin-bottom:15px;}.qt-textarea{min-height:70px;}.qt-dialog-flex-end{display:flex;justify-content:flex-end;margin-top:15px;}`;
            dialog.appendChild(styleEl);
            return { overlay, dialog };
        };
        const displaySystemNotification = (message, isError = false, duration = 3000) => {
            const id = Constants.TOOL_MAIN_CONTAINER_ID + '_Notification';
            document.getElementById(id)?.remove();
            const n = document.createElement('div'); n.id = id;
            n.style.cssText = `position:fixed;top:20px;right:20px;background-color:${isError?'#dc3545':'#28a745'};color:white;padding:10px 15px;border-radius:5px;z-index:${Constants.Z_INDEX.NOTIFICATION};font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.2);transform:translateX(calc(100% + 25px));transition:transform 0.3s ease-in-out;`;
            n.textContent = message; document.body.appendChild(n);
            setTimeout(()=>n.style.transform='translateX(0)',50);
            setTimeout(()=>{n.style.transform='translateX(calc(100% + 25px))';setTimeout(()=>n.remove(),300)},duration);
        };
        return { createDialogBase, displaySystemNotification };
    })(Constants);
    
    const ApiService = (function(Constants, DataStore) {
        async function performApiQuery(queryValue, apiKey) {
            const state = DataStore.getState();
            const reqBody = { currentPage: 1, pageSize: 10 };
            reqBody[apiKey] = queryValue;
            const fetchOpts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody),
            };
            if (state.apiAuthToken) fetchOpts.headers['SSO-TOKEN'] = state.apiAuthToken;
            try {
                const res = await fetch(state.currentApiUrl, fetchOpts);
                if (res.status === 401) {
                    DataStore.setApiAuthToken(null);
                    return { error: 'token_invalid', data: null };
                }
                if (!res.ok) throw new Error(`API Error ${res.status}`);
                const data = await res.json();
                return { error: null, data: data, success: data?.records?.length > 0 };
            } catch (e) {
                return { error: 'network_error', data: null };
            }
        }
        return { performApiQuery };
    })(Constants, DataStore);
    
    const Controller = (function(Constants, DataStore, ApiService, UIManager) {
        async function retrySingleQuery(rowIndex, buttonElement) {
            const state = DataStore.getState();
            const rowData = state.originalQueryResults[rowIndex];
            if (!rowData) return;

            buttonElement.textContent = '...';
            buttonElement.disabled = true;

            const queryValue = rowData[Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_];
            const apiKey = state.selectedQueryDefinition.queryApiKey;
            const apiResult = await ApiService.performApiQuery(queryValue, apiKey);
            
            let newStatus = '❌ 查詢失敗';
            let updatedRowData = {};

            if (apiResult.success) {
                newStatus = '✔️ 成功 (重試)';
                const rec = apiResult.data.records[0];
                Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                    updatedRowData[Constants.FIELD_DISPLAY_NAMES_MAP[dKey] || dKey] = rec[dKey] ?? '';
                });
            } else if (apiResult.error === 'token_invalid') {
                newStatus = '❌ TOKEN失效';
            } else if (!apiResult.error) {
                newStatus = '➖ 查無資料 (重試)';
            }
            
            updatedRowData[Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = newStatus;
            DataStore.updateResultRow(rowIndex, updatedRowData);
            TableRenderer.populateTableRows(state.originalQueryResults);
        }
        return { retrySingleQuery };
    })(Constants, DataStore, ApiService, UIManager);

    const TableRenderer = (function(Constants, DataStore, Controller) {
        function populateTableRows(data) {
            const state = DataStore.getState();
            const tableBody = state.ui.tableBodyElement;
            if (!tableBody) return;
            tableBody.innerHTML = '';
            
            data.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                tr.style.backgroundColor = rowIndex % 2 ? '#f8f9fa':'#ffffff';
                
                state.ui.currentHeaders.forEach((headerKey) => {
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:6px;border-bottom:1px solid #dee2e6;font-size:12px;text-align:center;';
                    let cellValue = row[headerKey] ?? '';
                    
                    if (headerKey === Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus && typeof cellValue === 'string' && cellValue.includes('❌')) {
                        const statusSpan = document.createElement('span');
                        statusSpan.textContent = cellValue;
                        td.appendChild(statusSpan);

                        const retryBtn = document.createElement('button');
                        retryBtn.textContent = '重試';
                        retryBtn.className = 'qt-dialog-btn qt-dialog-btn-orange';
                        retryBtn.style.cssText = 'margin-left:8px;padding:2px 6px;font-size:10px;';
                        retryBtn.onclick = (e) => {
                            e.stopPropagation();
                            Controller.retrySingleQuery(rowIndex, retryBtn);
                        };
                        td.appendChild(retryBtn);

                        const editBtn = document.createElement('button');
                        editBtn.textContent = '編輯重試';
                        editBtn.className = 'qt-dialog-btn qt-dialog-btn-blue';
                        editBtn.style.cssText = 'margin-left:4px;padding:2px 6px;font-size:10px;';
                        editBtn.onclick = (e) => {
                            e.stopPropagation();
                            const newValue = prompt(`請為「序號 ${row.NO}」輸入新查詢值:`, row[Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]);
                            if (newValue && newValue.trim()) {
                                const updatedData = { ...row, [Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]: newValue.trim() };
                                DataStore.updateResultRow(rowIndex, updatedData);
                                Controller.retrySingleQuery(rowIndex, editBtn);
                            }
                        };
                        td.appendChild(editBtn);
                    } else {
                        td.textContent = cellValue;
                    }
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
        }
        return { populateTableRows };
    })(Constants, DataStore, Controller);

    const App = (function(Constants, DataStore, UIManager, ApiService, TableRenderer) {
        // Dialogs are created here for simplicity, but could be in their own module
        const dialogs = {
            env: () => new Promise(resolve => {
                const { overlay } = UIManager.createDialogBase('_EnvSelect', `<h3 class="qt-dialog-title">選擇查詢環境</h3><div style="display:flex;gap:10px;justify-content:center;"><button id="qt-env-uat" class="qt-dialog-btn qt-dialog-btn-green">測試 (UAT)</button><button id="qt-env-prod" class="qt-dialog-btn qt-dialog-btn-orange">正式 (PROD)</button></div><div style="text-align:center;margin-top:15px;"><button id="qt-env-cancel" class="qt-dialog-btn qt-dialog-btn-grey">取消</button></div>`);
                const close = val => { overlay.remove(); resolve(val); };
                overlay.querySelector('#qt-env-uat').onclick = () => close('uat');
                overlay.querySelector('#qt-env-prod').onclick = () => close('prod');
                overlay.querySelector('#qt-env-cancel').onclick = () => close(null);
            }),
            token: () => new Promise(resolve => {
                 const { overlay } = UIManager.createDialogBase('_Token', `<h3 class="qt-dialog-title">API TOKEN 設定</h3><input type="password" id="qt-token-input" class="qt-input" placeholder="請輸入您的 API TOKEN"><div style="display:flex;justify-content:space-between;margin-top:15px;"><button id="qt-token-skip" class="qt-dialog-btn qt-dialog-btn-orange">略過</button><div><button id="qt-token-close-tool" class="qt-dialog-btn qt-dialog-btn-red">關閉</button><button id="qt-token-ok" class="qt-dialog-btn qt-dialog-btn-blue">確定</button></div></div>`);
                 const input = overlay.querySelector('#qt-token-input');
                 const close = val => { overlay.remove(); resolve(val); };
                 overlay.querySelector('#qt-token-ok').onclick = () => close(input.value.trim());
                 overlay.querySelector('#qt-token-close-tool').onclick = () => close('_close_');
                 overlay.querySelector('#qt-token-skip').onclick = () => close('_skip_');
            }),
            query: () => new Promise(resolve => {
                const queryButtons = Constants.QUERYABLE_FIELD_DEFINITIONS.map(d => `<button class="qt-dialog-btn" data-apikey="${d.queryApiKey}" style="background-color:${d.color};color:white;">${d.queryDisplayName}</button>`).join('');
                const { overlay } = UIManager.createDialogBase('_QuerySetup', `<h3 class="qt-dialog-title">查詢條件設定</h3><div>${queryButtons}</div><textarea id="qt-queryvalues-input" class="qt-textarea" placeholder="輸入查詢值..."></textarea><div class="qt-dialog-flex-end"><button class="qt-dialog-btn qt-dialog-btn-grey" id="cancel">取消</button><button class="qt-dialog-btn qt-dialog-btn-blue" id="ok">開始查詢</button></div>`);
                const input = overlay.querySelector('#qt-queryvalues-input');
                const close = val => { overlay.remove(); resolve(val); };
                overlay.querySelector('#ok').onclick = () => close({ queryValues: input.value.trim() });
                overlay.querySelector('#cancel').onclick = () => close(null);
                overlay.querySelectorAll('[data-apikey]').forEach(btn => btn.onclick = () => DataStore.getState().selectedQueryDefinition = Constants.QUERYABLE_FIELD_DEFINITIONS.find(d => d.queryApiKey === btn.dataset.apikey));
            })
        };

        async function execute() {
            const state = DataStore.getState();
            const env = await dialogs.env();
            if (!env) return UIManager.displaySystemNotification('操作已取消', true);
            state.currentApiUrl = env === 'prod' ? Constants.API.URL_PROD : Constants.API.URL_UAT;

            if (!state.apiAuthToken) {
                const token = await dialogs.token();
                if (token === '_close_') return;
                if (token && token !== '_skip_') DataStore.setApiAuthToken(token);
            }

            const setup = await dialogs.query();
            if (!setup) return;
            const queryValues = setup.queryValues.split(/[\s,;\n]+/).filter(Boolean);
            if (!queryValues.length) return UIManager.displaySystemNotification('未輸入查詢值', true);

            DataStore.resetQueryCancelFlag();
            const { overlay, dialog } = UIManager.createDialogBase('_Loading', `<h3 id="qt-loading-title">查詢中...</h3><p id="qt-loading-msg"></p>`, DataStore.cancelQuery);
            const loadingMsg = dialog.querySelector('#qt-loading-msg');

            state.originalQueryResults = [];
            for (const [i, value] of queryValues.entries()) {
                if (DataStore.isQueryCancelled()) {
                    UIManager.displaySystemNotification('查詢已由使用者手動停止', false);
                    break;
                }
                loadingMsg.textContent = `處理中 (${i + 1}/${queryValues.length}): ${value}`;
                
                const resultRow = {
                    [Constants.FIELD_DISPLAY_NAMES_MAP.NO]: i + 1,
                    [Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]: value,
                };
                
                const apiResult = await ApiService.performApiQuery(value, state.selectedQueryDefinition.queryApiKey);
                
                let statusText = '❌ 查詢失敗';
                if (apiResult.error === 'token_invalid') {
                    overlay.remove();
                    return UIManager.displaySystemNotification('Token失效，請重新執行', true);
                } else if (apiResult.success) {
                    statusText = '✔️ 成功';
                } else if (!apiResult.error) {
                    statusText = '➖ 查無資料';
                }
                resultRow[Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = statusText;
                
                const rec = apiResult.success ? apiResult.data.records[0] : {};
                Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                    resultRow[Constants.FIELD_DISPLAY_NAMES_MAP[dKey] || dKey] = rec[dKey] ?? '-';
                });
                state.originalQueryResults.push(resultRow);
            }
            overlay.remove();
            renderMainUI(state.originalQueryResults);
        }

        function renderMainUI(data) {
             const state = DataStore.getState();
             state.ui.mainUIElement?.remove();
             const mainUI = document.createElement('div');
             state.ui.mainUIElement = mainUI;
             mainUI.id = Constants.TOOL_MAIN_CONTAINER_ID;
             mainUI.style.cssText = `position:fixed;z-index:${Constants.Z_INDEX.MAIN_UI};left:50%;top:50%;transform:translate(-50%,-50%);background:#f8f9fa;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);width:auto;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;`;
             
             const titleBar = document.createElement('div');
             titleBar.textContent = '凱基人壽案件查詢結果';
             titleBar.style.cssText = `padding:10px 15px;background-color:#343a40;color:white;font-weight:bold;text-align:center;border-top-left-radius:9px;border-top-right-radius:9px;cursor:grab;`;
             mainUI.appendChild(titleBar);
             
             const contentWrapper = document.createElement('div');
             contentWrapper.style.cssText = 'padding:15px;overflow-y:auto;display:flex;flex-direction:column;flex-grow:1;';
             const controlsHeader = document.createElement('div');
             controlsHeader.innerHTML = `<div id="${Constants.TOOL_MAIN_CONTAINER_ID}_SummarySection" style="font-weight:bold;"></div>`;
             contentWrapper.appendChild(controlsHeader);
             
             const tableScrollWrap = document.createElement('div');
             tableScrollWrap.style.cssText = 'flex-grow:1;overflow:auto;border:1px solid #ccc;border-radius:5px;background:white;margin-top:10px;';
             const tableEl = document.createElement('table');
             tableEl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
             
             const tHREl = document.createElement('thead');
             tHREl.style.cssText = 'position:sticky;top:0;z-index:1;background-color:#343a40;color:white;';
             state.ui.tableHeadElement = tHREl;
             
             const tBREl = document.createElement('tbody');
             state.ui.tableBodyElement = tBREl;
             
             let headers = [Constants.FIELD_DISPLAY_NAMES_MAP.NO, Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_, ...Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.map(k=>Constants.FIELD_DISPLAY_NAMES_MAP[k]), Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus];
             state.ui.currentHeaders = headers;
             const hr = document.createElement('tr');
             headers.forEach(hTxt => {
                const th = document.createElement('th');
                th.textContent = hTxt;
                th.style.padding = '8px 6px';
                hr.appendChild(th);
             });
             tHREl.appendChild(hr);

             tableEl.appendChild(tHREl);
             tableEl.appendChild(tBREl);
             tableScrollWrap.appendChild(tableEl);
             contentWrapper.appendChild(tableScrollWrap);
             mainUI.appendChild(contentWrapper);
             document.body.appendChild(mainUI);
             
             TableRenderer.populateTableRows(data);
        }

        function init() {
            if (document.getElementById(Constants.TOOL_MAIN_CONTAINER_ID)) {
                return UIManager.displaySystemNotification('工具已開啟', true);
            }
            execute();
        }

        return { init };
    })(Constants, DataStore, UIManager, ApiService, TableRenderer);

    App.init();
})();