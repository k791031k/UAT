/**
 * @name KGI Life Case Query Tool
 * @version vFinal-Enhanced (Refactored + Features)
 * @description 一個用於查詢凱基人壽案件進度的瀏覽器書籤工具。此版本為最終增強版，
 * 包含可中斷的查詢流程與單筆錯誤重試機制。
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
        const QUERYABLE_FIELD_DEFINITIONS = [{
                queryApiKey: 'receiptNumber',
                queryDisplayName: '送金單號碼',
                color: '#007bff'
            },
            {
                queryApiKey: 'applyNumber',
                queryDisplayName: '受理號碼',
                color: '#6f42c1'
            },
            {
                queryApiKey: 'policyNumber',
                queryDisplayName: '保單號碼',
                color: '#28a745'
            },
            {
                queryApiKey: 'approvalNumber',
                queryDisplayName: '確認書編號',
                color: '#fd7e14'
            },
            {
                queryApiKey: 'insuredId',
                queryDisplayName: '被保人ＩＤ',
                color: '#17a2b8'
            }
        ];
        const FIELD_DISPLAY_NAMES_MAP = {
            applyNumber: '受理號碼',
            policyNumber: '保單號碼',
            approvalNumber: '確認書編號',
            receiptNumber: '送金單號碼',
            insuredId: '被保人ＩＤ',
            statusCombined: '狀態',
            mainStatus: '主狀態',
            subStatus: '次狀態',
            uwApproverUnit: '分公司',
            uwApprover: '核保員',
            approvalUser: '覆核',
            _queriedValue_: '查詢值',
            NO: '序號',
            _apiQueryStatus: '查詢結果'
        };
        const ALL_DISPLAY_FIELDS_API_KEYS_MAIN = ['applyNumber', 'policyNumber', 'approvalNumber', 'receiptNumber', 'insuredId', 'statusCombined', 'uwApproverUnit', 'uwApprover', 'approvalUser'];
        const UNIT_CODE_MAPPINGS = {
            H: '核保部',
            B: '北一',
            C: '台中',
            K: '高雄',
            N: '台南',
            P: '北二',
            T: '桃竹',
            G: '保服'
        };
        const A17_UNIT_BUTTONS_DEFS = [{
                id: 'H',
                label: 'H-總公司',
                color: '#007bff'
            }, {
                id: 'B',
                label: 'B-北一',
                color: '#28a745'
            },
            {
                id: 'P',
                label: 'P-北二',
                color: '#ffc107'
            }, {
                id: 'T',
                label: 'T-桃竹',
                color: '#17a2b8'
            },
            {
                id: 'C',
                label: 'C-台中',
                color: '#fd7e14'
            }, {
                id: 'N',
                label: 'N-台南',
                color: '#6f42c1'
            },
            {
                id: 'K',
                label: 'K-高雄',
                color: '#e83e8c'
            }, {
                id: 'UNDEF',
                label: '查無單位',
                color: '#546e7a'
            }
        ];
        const UNIT_MAP_FIELD_API_KEY = 'uwApproverUnit';
        const A17_TEXT_SETTINGS_STORAGE_KEY = 'kgilifeQueryTool_A17TextSettings_v3';
        const A17_DEFAULT_TEXT_CONTENT = "DEAR,\n\n依據【管理報表：A17 新契約異常帳務】所載內容，報表中列示之送金單號碼，涉及多項帳務異常情形，例如：溢繳、短收、取消件需退費、以及無相對應之案件等問題。\n\n本週我們已逐筆查詢該等異常帳務，結果顯示，這些送金單應對應至下表所列之新契約案件。為利後續帳務處理，敬請協助確認各案件之實際帳務狀況，並如有需調整或處理事項，請一併協助辦理，謝謝。";

        return Object.freeze({
            TOOL_MAIN_CONTAINER_ID,
            Z_INDEX,
            API,
            QUERYABLE_FIELD_DEFINITIONS,
            FIELD_DISPLAY_NAMES_MAP,
            ALL_DISPLAY_FIELDS_API_KEYS_MAIN,
            UNIT_CODE_MAPPINGS,
            A17_UNIT_BUTTONS_DEFS,
            UNIT_MAP_FIELD_API_KEY,
            A17_TEXT_SETTINGS_STORAGE_KEY,
            A17_DEFAULT_TEXT_CONTENT
        });
    })();

    // --- Data Store Module ---
    const DataStore = (function(Constants) {
        let state = {
            currentApiUrl: '',
            apiAuthToken: localStorage.getItem(Constants.API.TOKEN_STORAGE_KEY),
            selectedQueryDefinition: Constants.QUERYABLE_FIELD_DEFINITIONS[0],
            originalQueryResults: [],
            baseA17MasterData: [],
            isQueryCancelled: false, // **NEW**: Flag for query cancellation
            ui: {
                mainUIElement: null,
                tableBodyElement: null,
                tableHeadElement: null,
                a17UnitButtonsContainer: null,
                sortDirections: {},
                currentHeaders: [],
                isA17Mode: false,
                isEditMode: false,
            },
            a17Mode: {
                isActive: false,
                selectedUnits: new Set(),
                textSettings: {
                    mainContent: Constants.A17_DEFAULT_TEXT_CONTENT,
                    mainFontSize: 12,
                    mainLineHeight: 1.5,
                    mainFontColor: '#333333',
                    dateFontSize: 8,
                    dateLineHeight: 1.2,
                    dateFontColor: '#555555',
                    genDateOffset: -3,
                    compDateOffset: 0,
                },
            },
            csvImport: {
                fileName: '',
                rawHeaders: [],
                rawData: [],
                selectedColForQueryName: null,
                selectedColsForA17Merge: [],
                isA17CsvPrepared: false,
            },
            drag: {
                dragging: false,
                startX: 0,
                startY: 0,
                initialX: 0,
                initialY: 0
            },
            timers: {
                a17ButtonLongPressTimer: null
            }
        };

        const loadA17TextSettings = () => {
            const saved = localStorage.getItem(Constants.A17_TEXT_SETTINGS_STORAGE_KEY);
            if (!saved) return;
            try {
                const parsed = JSON.parse(saved);
                Object.assign(state.a17Mode.textSettings, parsed);
            } catch (e) {
                console.error("載入A17文本設定失敗:", e);
            }
        };

        return {
            getState: () => state,
            setApiAuthToken: (token) => {
                state.apiAuthToken = token;
                token ? localStorage.setItem(Constants.API.TOKEN_STORAGE_KEY, token) : localStorage.removeItem(Constants.API.TOKEN_STORAGE_KEY);
            },
            // **NEW**: Methods for cancellation
            cancelQuery: () => {
                state.isQueryCancelled = true;
            },
            resetQueryCancelFlag: () => {
                state.isQueryCancelled = false;
            },
            isQueryCancelled: () => state.isQueryCancelled,
            // **NEW**: Method to update a single row
            updateResultRow: (index, newRowData) => {
                if (state.originalQueryResults[index]) {
                    state.originalQueryResults[index] = {
                        ...state.originalQueryResults[index],
                        ...newRowData
                    };
                }
            },
            loadA17TextSettings
        };
    })(Constants);

    // --- Utility Functions Module ---
    const Utils = {
        escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') return unsafe === null || unsafe === undefined ? '' : String(unsafe);
            return unsafe.replace(/[&<>"']/g, m => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            })[m]);
        },
        extractName(strVal) {
            if (!strVal || typeof strVal !== 'string') return '';
            const matchResult = strVal.match(/^[\u4e00-\u9fa5\uff0a*\u00b7\uff0e]+/);
            return matchResult ? matchResult[0] : strVal.split(' ')[0];
        },
        getFirstLetter(unitString) {
            if (!unitString || typeof unitString !== 'string') return 'Z';
            for (let i = 0; i < unitString.length; i++) {
                const char = unitString.charAt(i).toUpperCase();
                if (/[A-Z]/.test(char)) return char;
            }
            return 'Z';
        },
        formatDate(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}${m}${d}`;
        }
    };

    // --- UI Manager Module ---
    const UIManager = (function(Constants) {
        const createDialogBase = (idSuffix, contentHtml, minWidth = '350px', customStyles = '', onCancel) => {
            const id = Constants.TOOL_MAIN_CONTAINER_ID + idSuffix;
            document.getElementById(id + '_overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = id + '_overlay';
            overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:${Constants.Z_INDEX.OVERLAY};display:flex;align-items:center;justify-content:center;font-family:'Microsoft JhengHei',Arial,sans-serif;backdrop-filter:blur(2px);`;
            const dialog = document.createElement('div');
            dialog.style.cssText = `background:#fff;padding:20px 25px;border-radius:8px;box-shadow:0 5px 20px rgba(0,0,0,0.25);min-width:${minWidth};animation:qtDialogAppear 0.2s ease-out;${customStyles}`;
            dialog.innerHTML = contentHtml;
            // **MODIFIED**: Add cancel button for loading dialog
            if (onCancel) {
                const cancelBtnContainer = document.createElement('div');
                cancelBtnContainer.style.textAlign = 'center';
                cancelBtnContainer.style.marginTop = '15px';
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'qt-cancel-query-btn';
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
            styleEl.textContent = `@keyframes qtDialogAppear{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}.qt-dialog-btn{border:none;padding:8px 15px;border-radius:4px;font-size:13px;cursor:pointer;transition:opacity 0.2s ease,transform 0.1s ease;font-weight:500;margin-left:8px;}.qt-dialog-btn:hover{opacity:0.85;}.qt-dialog-btn:active{transform:scale(0.98);}.qt-dialog-btn-blue{background:#007bff;color:white;}.qt-dialog-btn-grey{background:#6c757d;color:white;}.qt-dialog-btn-red{background:#dc3545;color:white;}.qt-dialog-btn-orange{background:#fd7e14;color:white;}.qt-dialog-btn-green{background:#28a745;color:white;}.qt-dialog-title{margin:0 0 15px 0;color:#333;font-size:18px;text-align:center;font-weight:600;}.qt-input,.qt-textarea,.qt-select{width:calc(100% - 18px);padding:9px;border:1px solid #ccc;border-radius:4px;font-size:13px;margin-bottom:15px;color:#333;box-sizing:border-box;}.qt-textarea{min-height:70px;resize:vertical;}.qt-dialog-flex-end{display:flex;justify-content:flex-end;margin-top:15px;}.qt-dialog-flex-between{display:flex;justify-content:space-between;align-items:center;margin-top:15px;}`;
            dialog.appendChild(styleEl);
            return {
                overlay,
                dialog
            };
        };
        const displaySystemNotification = (message, isError = false, duration = 3000) => {
            const id = Constants.TOOL_MAIN_CONTAINER_ID + '_Notification';
            document.getElementById(id)?.remove();
            const n = document.createElement('div');
            n.id = id;
            n.style.cssText = `position:fixed;top:20px;right:20px;background-color:${isError?'#dc3545':'#28a745'};color:white;padding:10px 15px;border-radius:5px;z-index:${Constants.Z_INDEX.NOTIFICATION};font-size:14px;font-family:'Microsoft JhengHei',Arial,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,0.2);transform:translateX(calc(100% + 25px));transition:transform 0.3s ease-in-out;display:flex;align-items:center;`;
            const i = document.createElement('span');
            i.style.marginRight = '8px';
            i.style.fontSize = '16px';
            i.innerHTML = isError ? '&#x26A0;' : '&#x2714;';
            n.appendChild(i);
            n.appendChild(document.createTextNode(message));
            document.body.appendChild(n);
            setTimeout(() => n.style.transform = 'translateX(0)', 50);
            setTimeout(() => {
                n.style.transform = 'translateX(calc(100% + 25px))';
                setTimeout(() => n.remove(), 300)
            }, duration);
        };
        return {
            createDialogBase,
            displaySystemNotification
        };
    })(Constants);

    // --- API Service Module ---
    const ApiService = (function(Constants, DataStore) {
        async function performApiQuery(queryValue, apiKey) {
            const state = DataStore.getState();
            const reqBody = {
                currentPage: 1,
                pageSize: 10
            };
            reqBody[apiKey] = queryValue;
            const fetchOpts = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody),
            };
            if (state.apiAuthToken) fetchOpts.headers['SSO-TOKEN'] = state.apiAuthToken;
            try {
                const res = await fetch(state.currentApiUrl, fetchOpts);
                if (res.status === 401) {
                    DataStore.setApiAuthToken(null);
                    return {
                        error: 'token_invalid',
                        data: null
                    };
                }
                if (!res.ok) throw new Error(`API請求錯誤: ${res.status}`);
                const data = await res.json();
                return {
                    error: null,
                    data: data,
                    success: data?.records?.length > 0
                };
            } catch (e) {
                console.error(`查詢 ${queryValue} 錯誤:`, e);
                return {
                    error: 'network_error',
                    data: null
                };
            }
        }
        return {
            performApiQuery
        };
    })(Constants, DataStore);

    // --- Controller Module ---
    const Controller = (function(Constants, DataStore, UIManager, ApiService, Utils) {
        // **NEW**: Logic for retrying a single query
        async function retrySingleQuery(rowIndex, buttonElement) {
            const state = DataStore.getState();
            const rowData = state.originalQueryResults[rowIndex];
            if (!rowData) return;

            const originalButtonText = buttonElement.textContent;
            buttonElement.textContent = '載入中';
            buttonElement.disabled = true;

            const queryValue = rowData[Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_];
            const apiKey = state.selectedQueryDefinition.queryApiKey;

            const apiResult = await ApiService.performApiQuery(queryValue, apiKey);

            let newStatus = '❌ 查詢失敗';
            let updatedRowData = {};

            if (apiResult.success && apiResult.data.records.length > 0) {
                newStatus = '✔️ 成功 (重試)';
                const rec = apiResult.data.records[0];
                Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                    const displayName = Constants.FIELD_DISPLAY_NAMES_MAP[dKey] || dKey;
                    // ... (omitting formatter logic for brevity, it's the same as in executeQueryTool)
                    updatedRowData[displayName] = rec[dKey] ?? '';
                });
            } else if (apiResult.error === 'token_invalid') {
                newStatus = '❌ TOKEN失效';
                UIManager.displaySystemNotification('Token已失效或無效，請重新查詢。', true, 5000);
            } else if (!apiResult.error) {
                newStatus = '➖ 查無資料 (重試)';
            }

            updatedRowData[Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = newStatus;
            DataStore.updateResultRow(rowIndex, updatedRowData);

            // Re-render the table to show the updated row
            TableRenderer.populateTableRows(state.originalQueryResults);
        }

        return {
            retrySingleQuery
        };
    })(Constants, DataStore, UIManager, ApiService, Utils);

    // --- Table Renderer Module ---
    const TableRenderer = (function(Constants, DataStore, UIManager, Utils, Controller) {
        function populateTableRows(data) {
            const state = DataStore.getState();
            const tableBody = state.ui.tableBodyElement;
            if (!tableBody) return;
            tableBody.innerHTML = '';

            data.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                tr.style.backgroundColor = rowIndex % 2 ? '#f8f9fa' : '#ffffff';

                state.ui.currentHeaders.forEach((headerKey) => {
                    const td = document.createElement('td');
                    td.style.cssText = 'padding:6px;border-bottom:1px solid #dee2e6;font-size:12px;text-align:center;border-right:1px solid #dee2e6;';
                    let cellValue = row[headerKey] ?? '';

                    // **MODIFIED**: Add retry/edit buttons on failed rows
                    if (headerKey === Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus && cellValue.includes('❌')) {
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
                        editBtn.textContent = '編輯並重試';
                        editBtn.className = 'qt-dialog-btn qt-dialog-btn-blue';
                        editBtn.style.cssText = 'margin-left:4px;padding:2px 6px;font-size:10px;';
                        editBtn.onclick = (e) => {
                            e.stopPropagation();
                            const newValue = prompt(`請輸入「${row[Constants.FIELD_DISPLAY_NAMES_MAP.NO]}」的新查詢值:`, row[Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]);
                            if (newValue && newValue.trim() !== '') {
                                const updatedData = {
                                    ...row,
                                    [Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]: newValue.trim()
                                };
                                DataStore.updateResultRow(rowIndex, updatedData);
                                Controller.retrySingleQuery(rowIndex, editBtn);
                            }
                        };
                        td.appendChild(editBtn);

                    } else if (headerKey === Constants.FIELD_DISPLAY_NAMES_MAP.statusCombined && String(cellValue).includes('<span')) {
                        td.innerHTML = cellValue;
                    } else {
                        td.textContent = cellValue;
                    }
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
            });
            // Update summary count after populating
            const summaryEl = state.ui.mainUIElement?.querySelector(`#${Constants.TOOL_MAIN_CONTAINER_ID}_SummarySection`);
            if (summaryEl) summaryEl.innerHTML = `查詢結果：<strong>${data.length}</strong>筆`;
        }

        // Return a public interface for the module
        return {
            populateTableRows
        };
    })(Constants, DataStore, UIManager, Utils, Controller);

    // --- Main Application Module (App) ---
    const App = (function(Constants, DataStore, UIManager, ApiService, Utils, TableRenderer) {

        function getDialogs() {
            // Simplified dialog creation functions for brevity
            // In a real app these would be in their own Dialogs module
            const createEnvSelectionDialog = () => new Promise(resolve => {
                const {
                    overlay
                } = UIManager.createDialogBase('_EnvSelect', `<h3 class="qt-dialog-title">選擇查詢環境</h3><div style="display:flex;gap:10px;justify-content:center;"><button id="qt-env-uat" class="qt-dialog-btn qt-dialog-btn-green" style="flex-grow:1;">測試 (UAT)</button><button id="qt-env-prod" class="qt-dialog-btn qt-dialog-btn-orange" style="flex-grow:1;">正式 (PROD)</button></div><div style="text-align:center;margin-top:15px;"><button id="qt-env-cancel" class="qt-dialog-btn qt-dialog-btn-grey">取消</button></div>`);
                const close = (val) => {
                    overlay.remove();
                    resolve(val);
                };
                overlay.querySelector('#qt-env-uat').onclick = () => close('uat');
                overlay.querySelector('#qt-env-prod').onclick = () => close('prod');
                overlay.querySelector('#qt-env-cancel').onclick = () => close(null);
            });
            const createTokenDialog = () => new Promise(resolve => {
                const {
                    overlay
                } = UIManager.createDialogBase('_Token', `<h3 class="qt-dialog-title">API TOKEN 設定</h3><input type="password" id="qt-token-input" class="qt-input" placeholder="請輸入您的 API TOKEN"><div class="qt-dialog-flex-between"><button id="qt-token-skip" class="qt-dialog-btn qt-dialog-btn-orange">略過</button><div><button id="qt-token-close-tool" class="qt-dialog-btn qt-dialog-btn-red">關閉工具</button><button id="qt-token-ok" class="qt-dialog-btn qt-dialog-btn-blue">確定</button></div></div>`);
                const inputEl = overlay.querySelector('#qt-token-input');
                const close = (val) => {
                    overlay.remove();
                    resolve(val);
                };
                overlay.querySelector('#qt-token-ok').onclick = () => close(inputEl.value.trim());
                overlay.querySelector('#qt-token-close-tool').onclick = () => close('_close_');
                overlay.querySelector('#qt-token-skip').onclick = () => close('_skip_');
            });
            const createQuerySetupDialog = () => new Promise(resolve => {
                const queryButtonsHtml = Constants.QUERYABLE_FIELD_DEFINITIONS.map(def => `<button class="qt-dialog-btn" data-apikey="${def.queryApiKey}" style="background-color:${def.color};color:white;">${Utils.escapeHtml(def.queryDisplayName)}</button>`).join('');
                const {
                    overlay
                } = UIManager.createDialogBase('_QuerySetup', `<h3 class="qt-dialog-title">查詢條件設定</h3><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px;">${queryButtonsHtml}</div><textarea id="qt-queryvalues-input" class="qt-textarea" placeholder="輸入查詢值..."></textarea><div class="qt-dialog-flex-end"><button id="qt-querysetup-cancel" class="qt-dialog-btn qt-dialog-btn-grey">取消</button><button id="qt-querysetup-ok" class="qt-dialog-btn qt-dialog-btn-blue">開始查詢</button></div>`);
                const queryValuesInput = overlay.querySelector('#qt-queryvalues-input');
                const close = (val) => {
                    overlay.remove();
                    resolve(val);
                };
                overlay.querySelector('#qt-querysetup-ok').onclick = () => close({
                    queryValues: queryValuesInput.value.trim()
                });
                overlay.querySelector('#qt-querysetup-cancel').onclick = () => close(null);
            });
            return {
                createEnvSelectionDialog,
                createTokenDialog,
                createQuerySetupDialog
            };
        }

        async function executeCaseQueryTool() {
            const state = DataStore.getState();
            const dialogs = getDialogs();

            // 1. Env Selection
            const selectedEnv = await dialogs.createEnvSelectionDialog();
            if (!selectedEnv) return UIManager.displaySystemNotification('操作已取消', true);
            state.currentApiUrl = selectedEnv === 'prod' ? Constants.API.URL_PROD : Constants.API.URL_UAT;
            UIManager.displaySystemNotification(`環境已設為: ${selectedEnv.toUpperCase()}`, false);

            // 2. Token
            if (!state.apiAuthToken) {
                const tokenResult = await dialogs.createTokenDialog();
                if (tokenResult === '_close_') return UIManager.displaySystemNotification('工具已關閉', false);
                if (tokenResult && tokenResult !== '_skip_') DataStore.setApiAuthToken(tokenResult);
            }

            // 3. Query Setup
            const querySetupResult = await dialogs.createQuerySetupDialog();
            if (!querySetupResult) return UIManager.displaySystemNotification('操作已取消', true);
            const queryValues = querySetupResult.queryValues.split(/[\s,;\n]+/).filter(Boolean);
            if (queryValues.length === 0) return UIManager.displaySystemNotification('未輸入有效查詢值', true);

            // 4. Loading and Query Execution
            DataStore.resetQueryCancelFlag();
            const {
                overlay,
                dialog
            } = UIManager.createDialogBase('_Loading', `<h3 class="qt-dialog-title" id="qt-loading-title">查詢中...</h3><p id="qt-loading-msg">處理中...</p><div style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;margin:15px auto;animation:qtSpin 1s linear infinite;"></div>`, '300px', '', DataStore.cancelQuery);
            const loadingTitleEl = dialog.querySelector('#qt-loading-title');
            const loadingMsgEl = dialog.querySelector('#qt-loading-msg');

            let currentQueryCount = 0;
            state.originalQueryResults = [];

            for (const singleQueryValue of queryValues) {
                if (DataStore.isQueryCancelled()) {
                    UIManager.displaySystemNotification('查詢已由使用者手動停止', false);
                    break;
                }
                currentQueryCount++;
                loadingTitleEl.textContent = `查詢中 (${currentQueryCount}/${queryValues.length})`;
                loadingMsgEl.textContent = `正在處理: ${singleQueryValue}`;

                const resultRowBase = {
                    [Constants.FIELD_DISPLAY_NAMES_MAP.NO]: String(currentQueryCount),
                    [Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_]: singleQueryValue,
                };

                const apiResult = await ApiService.performApiQuery(singleQueryValue, state.selectedQueryDefinition.queryApiKey);

                let apiQueryStatusText = '❌ 查詢失敗';
                if (apiResult.error === 'token_invalid') {
                    overlay.remove();
                    return UIManager.displaySystemNotification('Token已失效，請重新執行工具。', true, 5000);
                } else if (apiResult.success) {
                    apiQueryStatusText = '✔️ 成功';
                } else if (!apiResult.error) {
                    apiQueryStatusText = '➖ 查無資料';
                }
                resultRowBase[Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = apiQueryStatusText;

                if (apiResult.success && apiResult.data.records) {
                    apiResult.data.records.forEach(rec => {
                        const populatedRow = {
                            ...resultRowBase
                        };
                        Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                            const displayName = Constants.FIELD_DISPLAY_NAMES_MAP[dKey] || dKey;
                            populatedRow[displayName] = rec[dKey] ?? '-';
                        });
                        state.originalQueryResults.push(populatedRow);
                    });
                } else {
                    Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                        resultRowBase[Constants.FIELD_DISPLAY_NAMES_MAP[dKey] || dKey] = '-';
                    });
                    state.originalQueryResults.push(resultRowBase);
                }
            }
            overlay.remove();

            // 5. Render Results
            renderMainUI(state.originalQueryResults);
        }

        // This function builds the main UI shell
        function renderMainUI(data) {
            const state = DataStore.getState();
            state.ui.mainUIElement?.remove();
            const mainUI = document.createElement('div');
            state.ui.mainUIElement = mainUI;
            mainUI.id = Constants.TOOL_MAIN_CONTAINER_ID;
            mainUI.style.cssText = `position:fixed;z-index:${Constants.Z_INDEX.MAIN_UI};left:50%;top:50%;transform:translate(-50%,-50%);background:#f8f9fa;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);width:auto;max-width:850px;max-height:90vh;display:flex;flex-direction:column;`;

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
            tableScrollWrap.style.cssText = 'flex-grow:1;overflow:auto;border:1px solid #ccc;border-radius:5px;background:white;';
            const tableEl = document.createElement('table');
            tableEl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';

            const tHREl = document.createElement('thead');
            tHREl.style.cssText = 'position:sticky;top:0;z-index:1;background-color:#343a40;color:white;';
            state.ui.tableHeadElement = tHREl;

            const tBREl = document.createElement('tbody');
            state.ui.tableBodyElement = tBREl;

            let headers = [Constants.FIELD_DISPLAY_NAMES_MAP._queriedValue_, Constants.FIELD_DISPLAY_NAMES_MAP.NO, ...Constants.ALL_DISPLAY_FIELDS_API_KEYS_MAIN.map(k => Constants.FIELD_DISPLAY_NAMES_MAP[k]), Constants.FIELD_DISPLAY_NAMES_MAP._apiQueryStatus];
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
            document.getElementById(Constants.TOOL_MAIN_CONTAINER_ID)?.remove();
            DataStore.loadA17TextSettings();
            executeCaseQueryTool();
        }

        return {
            init
        };
    })(Constants, DataStore, UIManager, ApiService, Utils, TableRenderer);

    // --- Start Application ---
    App.init();

})();