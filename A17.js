function fib(num) {
    if (num <= 2) return 1;
    return fib(num - 1) + fib(num - 2);
}
console.log(fib(5));
javascript: (async function() {
    "use strict";

    // --- Core Constants Module ---
    // 目的: 集中管理應用程式中所有不會改變的常數，提高可讀性和維護性。
    // 職責: 定義 API 端點、儲存鍵、Z-index 值、查詢欄位定義、顯示名稱映射、單位代碼映射、A17 相關定義等。
    const Constants = (function() {
        const TOOL_MAIN_CONTAINER_ID = 'kgilifeQueryToolMainContainer_vFinalOptimized';

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
            receiptNumber: '送金單',
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
            T: '桃園',
            G: '保作'
        };

        const A17_UNIT_BUTTONS_DEFS = [{
                id: 'H',
                label: 'H-總公司',
                color: '#007bff'
            },
            {
                id: 'B',
                label: 'B-北一',
                color: '#28a745'
            },
            {
                id: 'P',
                label: 'P-北二',
                color: '#ffc107'
            },
            {
                id: 'T',
                label: 'T-桃園',
                color: '#17a2b8'
            },
            {
                id: 'C',
                label: 'C-台中',
                color: '#fd7e14'
            },
            {
                id: 'N',
                label: 'N-台南',
                color: '#6f42c1'
            },
            {
                id: 'K',
                label: 'K-高雄',
                color: '#e83e8c'
            },
            {
                id: 'UNDEF',
                label: '查無單位',
                color: '#546e7a'
            }
        ];

        const UNIT_MAP_FIELD_API_KEY = 'uwApproverUnit';
        const A17_TEXT_SETTINGS_STORAGE_KEY = 'kgilifeQueryTool_A17TextSettings_v3_Optimized';
        const A17_DEFAULT_TEXT_CONTENT = "DEAR,\n\n依據【管理報表：A17 新契約異常帳務】所載內容，報表中列示之送金單號碼，涉及多項帳務異常情形，例如：溢繳、短收、取消件需退費、以及無相對應之案件等問題。\n\n本週我們已逐筆查詢該等異常帳務，結果顯示，這些送金單應對應至下表所列之新契約案件。為利後續帳務處理，敬請協助確認各案件之實際帳務狀況，並如有需調整或處理事項，請一併協助辦理，謝謝。";

        // WCAG AA 標準色 (對比度至少 4.5:1 for small text)
        // 這些顏色選擇基於原始顏色進行微調，確保在白色背景下有足夠對比
        const COLOR_PALETTE = {
            PRIMARY: '#007bff', // 藍色 (按鈕、重點) - 原 #007bff
            SECONDARY: '#6c757d', // 灰色 (次要按鈕) - 原 #6c757d
            SUCCESS: '#28a745', // 綠色 (成功訊息、確認按鈕) - 原 #28a745
            DANGER: '#dc3545', // 紅色 (錯誤訊息、刪除按鈕) - 原 #dc3545
            WARNING: '#ffc107', // 黃色 (警告、跳過) - 原 #ffc107
            INFO: '#17a2b8', // 青色 (資訊、次要功能) - 原 #17a2b8
            PURPLE: '#6f42c1', // 紫色 (A17 按鈕) - 原 #6f42c1
            ORANGE: '#fd7e14', // 橘色 (重新查詢、重設) - 原 #fd7e14
            TEXT_DARK: '#333333', // 深色文字
            TEXT_MUTED: '#555555', // 次要文字
            TABLE_HEADER_BG: '#343a40', // 表格頭部背景
            TABLE_BORDER: '#dee2e6', // 表格邊框
            TABLE_ROW_EVEN: '#f8f9fa', // 表格偶數行背景
            TABLE_ROW_ODD: '#ffffff', // 表格奇數行背景
            HOVER_HIGHLIGHT: '#e9ecef', // 表格行 hover 背景
            EDIT_HIGHLIGHT: '#d4edda', // 編輯成功背景
        };

        return {
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
            A17_DEFAULT_TEXT_CONTENT,
            COLOR_PALETTE
        };
    })();

    // --- Utility Functions Module ---
    // 目的: 提供應用程式中通用的輔助函式，提高程式碼的重複利用性。
    // 職責: 處理 HTML 字串轉義、日期格式化、姓名提取、單位首字母提取等。
    const Utils = (function() {
        /**
         * 對 HTML 字串進行轉義，防止 XSS 攻擊。
         * @param {string} unsafe - 可能包含不安全 HTML 字符的字串。
         * @returns {string} 轉義後的字串。
         */
        function escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') return unsafe === null || unsafe === undefined ? '' : String(unsafe);
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return unsafe.replace(/[&<>"']/g, m => map[m]);
        }

        /**
         * 從包含姓名和雜項資訊的字串中提取純姓名。
         * @param {string} strVal - 包含姓名的字串。
         * @returns {string} 提取出的姓名。
         */
        function extractName(strVal) {
            if (!strVal || typeof strVal !== 'string') return '';
            const matchResult = strVal.match(/^[\u4e00-\u9fa5\uff0a\u00b7\uff0e]+/); // 匹配中文字符、全角星號、半角點、全角點
            return matchResult ? matchResult[0] : strVal.split(' ')[0];
        }

        /**
         * 從單位字串中提取第一個英文字母作為單位代碼前綴。
         * @param {string} unitString - 單位字串。
         * @returns {string} 單位代碼前綴 (大寫英文字母) 或 'Z' (如果沒有找到)。
         */
        function getFirstLetter(unitString) {
            if (!unitString || typeof unitString !== 'string') return 'Z';
            for (let i = 0; i < unitString.length; i++) {
                const char = unitString.charAt(i).toUpperCase();
                if (/[A-Z]/.test(char)) return char;
            }
            return 'Z';
        }

        /**
         * 將 Date 物件格式化為 अनुरूपMMDD 字串。
         * @param {Date} date - Date 物件。
         * @returns {string} 格式化後的日期字串。
         */
        function formatDate(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}${m}${d}`;
        }

        return {
            escapeHtml,
            extractName,
            getFirstLetter,
            formatDate
        };
    })();

    // --- UI Manager Module ---
    // 目的: 集中管理所有與使用者介面相關的函式，包括顯示通知、建立對話框、管理樣式。
    // 職責: 顯示系統通知、建立各種彈出視窗的基本結構和樣式。
    const UIManager = (function(Constants, Utils) {
        const {
            Z_INDEX,
            TOOL_MAIN_CONTAINER_ID,
            COLOR_PALETTE
        } = Constants;

        /**
         * 顯示系統通知訊息。
         * @param {string} message - 要顯示的訊息。
         * @param {boolean} isError - 是否為錯誤訊息 (影響顏色和圖示)。
         * @param {number} duration - 訊息顯示的持續時間 (毫秒)。
         */
        function displaySystemNotification(message, isError = false, duration = 3000) {
            const id = TOOL_MAIN_CONTAINER_ID + '_Notification';
            document.getElementById(id)?.remove(); // 移除舊的通知

            const notification = document.createElement('div');
            notification.id = id;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background-color: ${isError ? COLOR_PALETTE.DANGER : COLOR_PALETTE.SUCCESS};
                color: white;
                padding: 12px 18px; /* 增加 padding */
                border-radius: 8px; /* 更圓潤 */
                z-index: ${Z_INDEX.NOTIFICATION};
                font-size: 14px;
                font-family: 'Microsoft JhengHei', Arial, sans-serif;
                box-shadow: 0 4px 15px rgba(0,0,0,0.25); /* 更明顯陰影 */
                transform: translateX(calc(100% + 25px));
                transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out; /* 增加 opacity 過渡 */
                display: flex;
                align-items: center;
                opacity: 0; /* 初始透明 */
            `;

            const icon = document.createElement('span');
            icon.style.marginRight = '10px'; // 增加圖示與文字間距
            icon.style.fontSize = '18px'; // 增大圖示
            icon.innerHTML = isError ? '&#x26A0;&#xFE0F;' : '&#x2705;&#xFE0F;'; // ⚠️ 或 ✅ (帶有文本變體選擇器，確保在不同系統顯示為彩色emoji)
            notification.appendChild(icon);
            notification.appendChild(document.createTextNode(message));
            document.body.appendChild(notification);

            // 淡入
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
                notification.style.opacity = '0.95';
            }, 50);

            // 淡出並移除
            setTimeout(() => {
                notification.style.transform = 'translateX(calc(100% + 25px))';
                notification.style.opacity = '0';
                setTimeout(() => notification.remove(), 300); // 等待動畫結束後移除
            }, duration);
        }

        /**
         * 建立一個基礎的對話框結構和樣式。
         * @param {string} idSuffix - 用於建立唯一 ID 的後綴。
         * @param {string} contentHtml - 對話框內部的 HTML 內容。
         * @param {string} minWidth - 對話框的最小寬度。
         * @param {string} maxWidth - 對話框的最大寬度。
         * @param {string} customStyles - 額外的 CSS 樣式。
         * @returns {{overlay: HTMLDivElement, dialog: HTMLDivElement}} 包含遮罩和對話框元素的物件。
         */
        function createDialogBase(idSuffix, contentHtml, minWidth = '350px', maxWidth = '600px', customStyles = '') {
            const id = TOOL_MAIN_CONTAINER_ID + idSuffix;
            document.getElementById(id + '_overlay')?.remove(); // 確保每次只存在一個實例

            const overlay = document.createElement('div');
            overlay.id = id + '_overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7); /* 更深一點的遮罩 */
                z-index: ${Z_INDEX.OVERLAY};
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Microsoft JhengHei', Arial, sans-serif;
                backdrop-filter: blur(3px); /* 更強的模糊效果 */
            `;

            const dialog = document.createElement('div');
            dialog.id = id + '_dialog';
            dialog.style.cssText = `
                background: #fff;
                padding: 25px 30px; /* 增加 padding */
                border-radius: 12px; /* 更圓潤 */
                box-shadow: 0 8px 30px rgba(0,0,0,0.3); /* 更明顯陰影 */
                min-width: ${minWidth};
                max-width: ${maxWidth};
                width: auto;
                animation: qtDialogAppear 0.25s ease-out; /* 更流暢的動畫 */
                ${customStyles}
                /* 行動裝置友善性 */
                @media (max-width: 768px) {
                    min-width: 90%;
                    max-width: 95%;
                    padding: 20px;
                    margin: 10px; /* 防止貼邊 */
                    box-sizing: border-box; /* 確保 padding 不超出寬度 */
                }
            `;
            // --- 修正 `innerHTML` TrustedHTML 錯誤的關鍵部分 ---
            // 使用 DOMParser 來繞過 TrustedHTML 的限制
            const parser = new DOMParser();
            const doc = parser.parseFromString(contentHtml, 'text/html');
            // 將解析後的 body 內容逐一附加到 dialog 中
            Array.from(doc.body.children).forEach(child => {
                dialog.appendChild(child);
            });
            // --- 修正結束 ---

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // 注入通用樣式 (例如按鈕、輸入框)
            const styleEl = document.createElement('style');
            styleEl.textContent = `
                @keyframes qtDialogAppear {
                    from { opacity: 0; transform: translateY(-20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* 卡片式按鈕與 hover 效果 */
                .qt-card-btn {
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px; /* 更圓潤 */
                    font-size: 14px;
                    cursor: pointer;
                    transition: transform 0.25s ease-out, box-shadow 0.25s ease-out, background-color 0.2s ease, opacity 0.2s ease;
                    font-weight: 600;
                    margin-left: 10px;
                    display: inline-flex; /* 使內部內容居中 */
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1); /* 預設陰影 */
                    background-color: ${COLOR_PALETTE.PRIMARY}; /* 預設主色 */
                    color: white;
                    min-width: 80px; /* 最小寬度避免內容過少時按鈕太小 */
                    text-decoration: none; /* 移除可能的底線 */
                }
                .qt-card-btn:hover {
                    transform: translateY(-3px) scale(1.01); /* 微縮放和上浮 */
                    box-shadow: 0 8px 18px rgba(0,0,0,0.25); /* 加深陰影 */
                    opacity: 0.9;
                }
                .qt-card-btn:active {
                    transform: translateY(0) scale(0.98); /* 按下效果 */
                    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                    opacity: 1;
                }

                /* 各種顏色按鈕 */
                .qt-card-btn-blue { background: ${COLOR_PALETTE.PRIMARY}; }
                .qt-card-btn-grey { background: ${COLOR_PALETTE.SECONDARY}; }
                .qt-card-btn-red { background: ${COLOR_PALETTE.DANGER}; }
                .qt-card-btn-orange { background: ${COLOR_PALETTE.ORANGE}; }
                .qt-card-btn-green { background: ${COLOR_PALETTE.SUCCESS}; }
                .qt-card-btn-purple { background: ${COLOR_PALETTE.PURPLE}; }
                .qt-card-btn-info { background: ${COLOR_PALETTE.INFO}; } /* 新增資訊色按鈕 */


                /* 禁用狀態 */
                .qt-card-btn.disabled, .qt-card-btn[disabled] {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .qt-dialog-title {
                    margin: 0 0 20px 0; /* 增加標題下邊距 */
                    color: ${COLOR_PALETTE.TEXT_DARK};
                    font-size: 22px; /* 增大標題字體 */
                    text-align: center;
                    font-weight: 700;
                }
                .qt-input, .qt-textarea, .qt-select {
                    width: calc(100% - 22px); /* 調整 padding */
                    padding: 12px; /* 增加 padding */
                    border: 1px solid #ccc;
                    border-radius: 8px; /* 更圓潤 */
                    font-size: 15px; /* 增大字體 */
                    margin-bottom: 18px; /* 增加下邊距 */
                    color: ${COLOR_PALETTE.TEXT_DARK};
                    box-sizing: border-box;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .qt-input:focus, .qt-textarea:focus, .qt-select:focus {
                    border-color: ${COLOR_PALETTE.PRIMARY};
                    box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.2); /* 更柔和的焦點陰影 */
                    outline: none;
                }
                .qt-textarea {
                    min-height: 100px; /* 增加高度 */
                    resize: vertical;
                }
                .qt-dialog-flex-end {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 25px; /* 增加上邊距 */
                    gap: 12px; /* 按鈕間距 */
                    flex-wrap: wrap; /* 行動裝置換行 */
                }
                .qt-dialog-flex-between {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 25px;
                    flex-wrap: wrap; /* 行動裝置換行 */
                    gap: 12px; /* 間距 */
                }

                /* 查詢類型按鈕 (Flat Design + Hover) */
                .qt-querytype-btn {
                    padding: 12px 18px; /* 增加 padding */
                    border-radius: 8px; /* 更圓潤 */
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.25s ease-out, box-shadow 0.25s ease-out, opacity 0.2s ease;
                    border: 2px solid transparent; /* 預設透明邊框 */
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* 預設輕微陰影 */
                    flex-grow: 1; /* 讓按鈕平均分佈 */
                    min-width: 140px; /* 最小寬度 */
                    color: white; /* 確保文字顏色為白 */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .qt-querytype-btn:hover {
                    transform: translateY(-4px); /* 提升效果 */
                    box-shadow: 0 8px 15px rgba(0,0,0,0.2); /* 加深陰影 */
                    opacity: 0.9;
                }
                .qt-querytype-btn.active {
                    border: 2px solid white; /* 選中時的白色邊框 */
                    box-shadow: 0 0 0 5px rgba(255,255,255,0.7), 0 0 15px rgba(0,0,0,0.4); /* 外發光效果 */
                    transform: scale(1.03); /* 選中時微放大 */
                    z-index: 2; /* 確保高亮按鈕在頂層 */
                }
            `;
            dialog.appendChild(styleEl);

            return {
                overlay,
                dialog
            };
        }

        /**
         * 根據對話框 ID 關閉它。
         * @param {string} idSuffix - 對話框 ID 的後綴。
         */
        function closeDialog(idSuffix) {
            document.getElementById(TOOL_MAIN_CONTAINER_ID + idSuffix + '_overlay')?.remove();
        }

        return {
            displaySystemNotification,
            createDialogBase,
            closeDialog
        };
    })(Constants, Utils);

    // --- Data Store Module ---
    // 目的: 管理應用程式的各種狀態和數據，提供統一的數據存取接口。
    // 職責: 儲存原始查詢結果、A17 模式數據、CSV 導入狀態、Token 等。
    const DataStore = (function(Constants) {
        const {
            API,
            A17_TEXT_SETTINGS_STORAGE_KEY,
            A17_DEFAULT_TEXT_CONTENT
        } = Constants;

        let currentApiUrl = '';
        let apiAuthToken = localStorage.getItem(API.TOKEN_STORAGE_KEY);
        let selectedQueryDefinition = Constants.QUERYABLE_FIELD_DEFINITIONS[0];
        let originalQueryResults = [];
        let baseA17MasterData = []; // 用於 A17 模式的基準數據 (包含 CSV 合併和 API 查詢結果)

        // UI 狀態 (為了避免全域污染，將所有 UI 相關狀態集中管理)
        const uiState = {
            mainUIElement: null,
            tableBodyElement: null,
            tableHeadElement: null,
            a17UnitButtonsContainer: null,
            sortDirections: {}, // 紀錄各欄位的排序方向
            currentHeaders: [], // 當前表格顯示的標頭
            isA17Mode: false,
            isEditMode: false,
        };

        // A17 模式專屬狀態
        const a17ModeState = {
            isActive: false,
            selectedUnits: new Set(),
            textSettings: {
                mainContent: A17_DEFAULT_TEXT_CONTENT,
                mainFontSize: 12,
                mainLineHeight: 1.5,
                mainFontColor: '#333333',
                dateFontSize: 8,
                dateLineHeight: 1.2,
                dateFontColor: '#555555',
                genDateOffset: -3, // 預設生成日期為今天-3天
                compDateOffset: 0, // 預設對比日期為今天
            }
        };

        // CSV 導入狀態
        const csvImportState = {
            fileName: '',
            rawHeaders: [], // 原始 CSV 頭部
            rawData: [], // 原始 CSV 數據 (不含頭部)
            selectedColForQueryName: null, // 用於查詢值的 CSV 欄位名稱
            selectedColsForA17Merge: [], // 用於 A17 合併顯示的 CSV 欄位名稱
            isA17CsvPrepared: false, // 是否已準備好用於 A17 合併的 CSV
        };

        // 拖曳狀態
        const dragState = {
            dragging: false,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        };

        let a17ButtonLongPressTimer = null; // 長按計時器

        function setCurrentApiUrl(url) {
            currentApiUrl = url;
        }

        function getCurrentApiUrl() {
            return currentApiUrl;
        }

        function setApiAuthToken(token) {
            apiAuthToken = token;
            if (token) {
                localStorage.setItem(API.TOKEN_STORAGE_KEY, token);
            } else {
                localStorage.removeItem(API.TOKEN_STORAGE_KEY);
            }
        }

        function getApiAuthToken() {
            return apiAuthToken;
        }

        function setSelectedQueryDefinition(def) {
            selectedQueryDefinition = def;
        }

        function getSelectedQueryDefinition() {
            return selectedQueryDefinition;
        }

        function setOriginalQueryResults(results) {
            originalQueryResults = results;
        }

        function getOriginalQueryResults() {
            return originalQueryResults;
        }

        function setBaseA17MasterData(data) {
            baseA17MasterData = data;
        }

        function getBaseA17MasterData() {
            return baseA17MasterData;
        }

        function loadA17TextSettings() {
            const saved = localStorage.getItem(A17_TEXT_SETTINGS_STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    for (const key in a17ModeState.textSettings) {
                        // 僅更新存在的屬性，避免舊儲存格式導致問題
                        if (parsed.hasOwnProperty(key)) {
                            a17ModeState.textSettings[key] = parsed[key];
                        }
                    }
                } catch (e) {
                    console.error("載入A17文本設定失敗:", e);
                }
            }
        }

        function saveA17TextSettings() {
            localStorage.setItem(A17_TEXT_SETTINGS_STORAGE_KEY, JSON.stringify(a17ModeState.textSettings));
        }

        function resetA17TextSettings() {
            a17ModeState.textSettings = {
                mainContent: A17_DEFAULT_TEXT_CONTENT,
                mainFontSize: 12,
                mainLineHeight: 1.5,
                mainFontColor: '#333333',
                dateFontSize: 8,
                dateLineHeight: 1.2,
                dateFontColor: '#555555',
                genDateOffset: -3,
                compDateOffset: 0,
            };
            saveA17TextSettings(); // 重設後也儲存
        }

        return {
            uiState,
            a17ModeState,
            csvImportState,
            dragState,
            a17ButtonLongPressTimer, // 直接暴露，因為它是計時器 ID
            setCurrentApiUrl,
            getCurrentApiUrl,
            setApiAuthToken,
            getApiAuthToken,
            setSelectedQueryDefinition,
            getSelectedQueryDefinition,
            setOriginalQueryResults,
            getOriginalQueryResults,
            setBaseA17MasterData,
            getBaseA17MasterData,
            loadA17TextSettings,
            saveA17TextSettings,
            resetA17TextSettings,
        };
    })(Constants);

    // --- API Service Module ---
    // 目的: 處理所有與外部 API 互動的邏輯，包括發送請求和處理響應。
    // 職責: 執行案例查詢 API 請求，處理 Token 失效和網路錯誤。
    const ApiService = (function(Constants, UIManager, DataStore) {
        const {
            API
        } = Constants;
        const {
            displaySystemNotification
        } = UIManager;
        const {
            getApiAuthToken,
            setApiAuthToken,
            getCurrentApiUrl
        } = DataStore;

        /**
         * 執行 API 查詢。
         * @param {string} queryValue - 查詢值。
         * @param {string} apiKey - 查詢的 API 鍵。
         * @returns {Promise<{error: string|null, data: object|null, success: boolean}>} 查詢結果。
         */
        async function performApiQuery(queryValue, apiKey) {
            const reqBody = {
                currentPage: 1,
                pageSize: 10
            }; // 預設只查詢第一頁10筆
            reqBody[apiKey] = queryValue;

            const fetchOpts = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reqBody),
            };

            const authToken = getApiAuthToken();
            if (authToken) {
                fetchOpts.headers['SSO-TOKEN'] = authToken;
            }

            let retries = 1; // 首次嘗試 + 1 次重試
            while (retries >= 0) {
                try {
                    const res = await fetch(getCurrentApiUrl(), fetchOpts);
                    const data = await res.json();

                    if (res.status === 401) {
                        setApiAuthToken(null); // Token 失效，清除本地儲存
                        return {
                            error: 'token_invalid',
                            data: null
                        };
                    }

                    if (!res.ok) {
                        throw new Error(`API請求錯誤: ${res.status} ${res.statusText}`);
                    }

                    return {
                        error: null,
                        data: data,
                        success: data && data.records && data.records.length > 0
                    };

                } catch (e) {
                    console.error(`查詢 ${queryValue} 錯誤 (嘗試 ${2 - retries}):`, e);
                    if (retries > 0) {
                        displaySystemNotification(`查詢 ${queryValue} 失敗，2秒後重試...`, true, 1800);
                        await new Promise(r => setTimeout(r, 2000));
                        retries--;
                    } else {
                        return {
                            error: 'network_error',
                            data: null
                        };
                    }
                }
            }
        }

        return {
            performApiQuery
        };
    })(Constants, UIManager, DataStore);

    // --- Dialogs Module ---
    // 目的: 集中管理所有應用程式中使用的對話框邏輯。
    // 職責: 創建環境選擇、Token 輸入、查詢設定、CSV 用途選擇、CSV 欄位選擇等對話框。
    const Dialogs = (function(Constants, UIManager, DataStore, Utils) { // 確保 Utils 被傳入
        const {
            QUERYABLE_FIELD_DEFINITIONS,
            API,
            COLOR_PALETTE
        } = Constants;
        const {
            displaySystemNotification,
            createDialogBase,
            closeDialog
        } = UIManager;
        const {
            setSelectedQueryDefinition,
            csvImportState,
            getSelectedQueryDefinition
        } = DataStore;
        const {
            escapeHtml
        } = Utils; // 引用 Utils 模組

        /**
         * 創建環境選擇對話框。
         * @returns {Promise<string|null>} 使用者選擇的環境 ('test' 或 'prod')，或 null (取消)。
         */
        function createEnvSelectionDialog() {
            return new Promise(resolve => {
                const contentHtml = `
                    <h3 class="qt-dialog-title">選擇查詢環境</h3>
                    <div style="display:flex; gap:15px; justify-content:center; margin-bottom:15px;">
                        <button id="qt-env-uat" class="qt-card-btn qt-card-btn-green" style="flex-grow:1;">測試 (UAT)</button>
                        <button id="qt-env-prod" class="qt-card-btn qt-card-btn-orange" style="flex-grow:1;">正式 (PROD)</button>
                    </div>
                    <div style="text-align:center;">
                        <button id="qt-env-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_EnvSelect', contentHtml, '320px', 'auto');
                [cite: 5]

                const handleClose = (value) => {
                    closeDialog('_EnvSelect');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose(null);
                };
                document.addEventListener('keydown', escListener);

                overlay.querySelector('#qt-env-uat').onclick = () => handleClose('test');
                overlay.querySelector('#qt-env-prod').onclick = () => handleClose('prod');
                overlay.querySelector('#qt-env-cancel').onclick = () => handleClose(null);
            });
        }

        /**
         * 創建 Token 輸入對話框。
         * @param {number} attempt - 當前嘗試次數，用於顯示錯誤訊息。
         * @returns {Promise<string|null>} 輸入的 Token, 或 '_close_tool_', '_skip_token_', '_token_dialog_cancel_'。
         */
        function createTokenDialog(attempt = 1) {
            return new Promise(resolve => {
                const contentHtml = `
                    <h3 class="qt-dialog-title">API TOKEN 設定</h3>
                    <input type="password" id="qt-token-input" class="qt-input" placeholder="請輸入您的 API TOKEN">
                    ${attempt > 1 ? `<p style="color:${COLOR_PALETTE.DANGER}; font-size:12px; text-align:center; margin-bottom:10px;">Token驗證失敗，請重新輸入。</p>` : ''}
                    <div class="qt-dialog-flex-between">
                        <button id="qt-token-skip" class="qt-card-btn qt-card-btn-orange" style="margin-left:0;">略過</button>
                        <div>
                            <button id="qt-token-close-tool" class="qt-card-btn qt-card-btn-red">關閉工具</button>
                            <button id="qt-token-ok" class="qt-card-btn qt-card-btn-blue">${attempt > 1 ? '重試' : '確定'}</button>
                        </div>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_Token', contentHtml, '320px', 'auto');
                [cite: 5]
                const inputEl = overlay.querySelector('#qt-token-input');
                inputEl.focus();

                // 處理多次驗證失敗後禁用確定按鈕
                if (attempt >= 2) { // 將 >2 改為 >=2，讓第三次嘗試時即禁用
                    const okBtn = overlay.querySelector('#qt-token-ok');
                    okBtn.disabled = true;
                    okBtn.classList.add('disabled');
                    displaySystemNotification('Token多次驗證失敗，請檢查。', true, 4000);
                }

                const handleClose = (value) => {
                    closeDialog('_Token');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose('_token_dialog_cancel_');
                };
                document.addEventListener('keydown', escListener);

                overlay.querySelector('#qt-token-ok').onclick = () => handleClose(inputEl.value.trim());
                overlay.querySelector('#qt-token-close-tool').onclick = () => handleClose('_close_tool_');
                overlay.querySelector('#qt-token-skip').onclick = () => handleClose('_skip_token_');
            });
        }

        /**
         * 創建查詢設定對話框。
         * @returns {Promise<{selectedApiKey: string, queryValues: string}|null>} 查詢設定，或 null (取消)。
         */
        function createQuerySetupDialog() {
            return new Promise(resolve => {
                const queryButtonsHtml = Constants.QUERYABLE_FIELD_DEFINITIONS.map(def => `
                    <button class="qt-querytype-btn" data-apikey="${def.queryApiKey}" style="background-color:${def.color};">
                        ${Utils.escapeHtml(def.queryDisplayName)}
                    </button>
                `).join('');

                const contentHtml = `
                    <h3 class="qt-dialog-title">查詢條件設定</h3>
                    <div style="margin-bottom:10px; font-size:14px; color:${COLOR_PALETTE.TEXT_MUTED}; font-weight:500;">選擇查詢欄位類型：</div>
                    <div id="qt-querytype-buttons" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
                        ${queryButtonsHtml}
                    </div>
                    <div style="margin-bottom:8px; font-size:14px; color:${COLOR_PALETTE.TEXT_MUTED}; font-weight:500;">輸入查詢值 (可多筆，以換行/空格/逗號/分號分隔)：</div>
                    <textarea id="qt-queryvalues-input" class="qt-textarea" placeholder="請先選擇上方查詢欄位類型"></textarea>
                    <div style="margin-bottom:15px; display:flex; align-items:center; flex-wrap:wrap; gap:10px;">
                        <button id="qt-csv-import-btn" class="qt-card-btn qt-card-btn-grey" style="margin-left:0; padding:8px 15px; font-size:13px; min-width:unset;">從CSV/TXT匯入...</button>
                        <span id="qt-csv-filename-display" style="font-size:12px; color:${COLOR_PALETTE.TEXT_MUTED}; margin-left:5px;"></span>
                    </div>
                    <div class="qt-dialog-flex-between">
                        <button id="qt-clear-all-input-btn" class="qt-card-btn qt-card-btn-orange" style="margin-left:0;">清除所有輸入</button>
                        <div>
                            <button id="qt-querysetup-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                            <button id="qt-querysetup-ok" class="qt-card-btn qt-card-btn-blue">開始查詢</button>
                        </div>
                    </div>
                    <input type="file" id="qt-file-input-hidden" accept=".csv,.txt" style="display:none;">
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_QuerySetup', contentHtml, '520px', 'auto');
                [cite: 5]

                const queryValuesInput = overlay.querySelector('#qt-queryvalues-input');
                const typeButtons = overlay.querySelectorAll('.qt-querytype-btn');
                const csvImportBtn = overlay.querySelector('#qt-csv-import-btn');
                const fileInputHidden = overlay.querySelector('#qt-file-input-hidden');
                const csvFilenameDisplay = overlay.querySelector('#qt-csv-filename-display');

                const setActiveButton = (apiKey) => {
                    typeButtons.forEach(btn => {
                        const isSelected = btn.dataset.apikey === apiKey;
                        btn.classList.toggle('active', isSelected);
                        if (isSelected) {
                            setSelectedQueryDefinition(Constants.QUERYABLE_FIELD_DEFINITIONS.find(d => d.queryApiKey === apiKey));
                            queryValuesInput.placeholder = `請輸入${getSelectedQueryDefinition().queryDisplayName}(可多筆...)`;
                        }
                    });
                };

                typeButtons.forEach(btn => btn.onclick = () => {
                    setActiveButton(btn.dataset.apikey);
                    queryValuesInput.focus();
                });

                setActiveButton(getSelectedQueryDefinition().queryApiKey); // 預設選中第一個

                csvImportBtn.onclick = () => fileInputHidden.click();
                fileInputHidden.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    csvFilenameDisplay.textContent = `已選: ${file.name}`;
                    try {
                        const text = await file.text();
                        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                        if (lines.length === 0) {
                            displaySystemNotification('CSV檔案為空', true);
                            return;
                        }
                        const headers = lines[0].split(/[,;\t]/).map(h => h.trim().replace(/^"|"$/g, ''));

                        const purpose = await createCSVPurposeDialog();
                        if (!purpose) {
                            csvFilenameDisplay.textContent = '';
                            fileInputHidden.value = '';
                            return;
                        }

                        if (purpose === 'fillQueryValues') {
                            const columnIndex = await createCSVColumnSelectionDialog(headers, "選擇包含查詢值的欄位：");
                            if (columnIndex === null || columnIndex === undefined) {
                                csvFilenameDisplay.textContent = '';
                                fileInputHidden.value = '';
                                return;
                            }
                            const values = [];
                            for (let i = 1; i < lines.length; i++) {
                                const cols = lines[i].split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
                                if (cols[columnIndex] && cols[columnIndex].trim() !== "") {
                                    values.push(cols[columnIndex].trim());
                                }
                            }
                            queryValuesInput.value = Array.from(new Set(values)).join('\n'); // 去重並換行顯示
                            displaySystemNotification('查詢值已從CSV填入', false);

                            DataStore.csvImportState = {
                                ...DataStore.csvImportState,
                                fileName: file.name,
                                rawHeaders: headers,
                                rawData: lines.slice(1).map(line => line.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''))),
                                selectedColForQueryName: headers[columnIndex],
                                isA17CsvPrepared: false,
                                selectedColsForA17Merge: []
                            };

                        } else if (purpose === 'prepareA17Merge') {
                            const selectedHeadersForA17 = await createCSVColumnCheckboxDialog(headers, "勾選要在A17表格中顯示的CSV欄位：");
                            if (!selectedHeadersForA17 || selectedHeadersForA17.length === 0) {
                                csvFilenameDisplay.textContent = '';
                                fileInputHidden.value = '';
                                return;
                            }
                            DataStore.csvImportState = {
                                ...DataStore.csvImportState,
                                fileName: file.name,
                                rawHeaders: headers,
                                rawData: lines.slice(1).map(line => line.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''))),
                                selectedColsForA17Merge: selectedHeadersForA17,
                                isA17CsvPrepared: true,
                                selectedColForQueryName: null
                            };
                            displaySystemNotification(`已選 ${selectedHeadersForA17.length} 個CSV欄位供A17合併`, false);
                        }
                    } catch (err) {
                        console.error("處理CSV錯誤:", err);
                        displaySystemNotification('讀取CSV失敗', true);
                        csvFilenameDisplay.textContent = '';
                    } finally {
                        fileInputHidden.value = ''; // 清空 file input，以便下次再次選擇相同文件也能觸發 onchange
                    }
                };

                overlay.querySelector('#qt-clear-all-input-btn').onclick = () => {
                    queryValuesInput.value = '';
                    csvFilenameDisplay.textContent = '';
                    DataStore.csvImportState = {
                        fileName: '',
                        rawHeaders: [],
                        rawData: [],
                        selectedColForQueryName: null,
                        selectedColsForA17Merge: [],
                        isA17CsvPrepared: false
                    };
                    fileInputHidden.value = '';
                    displaySystemNotification('所有輸入已清除', false);
                };

                const handleClose = (value) => {
                    closeDialog('_QuerySetup');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose(null);
                };
                document.addEventListener('keydown', escListener);

                overlay.querySelector('#qt-querysetup-ok').onclick = () => {
                    const values = queryValuesInput.value.trim();
                    if (!getSelectedQueryDefinition()) {
                        displaySystemNotification('請選查詢欄位類型', true);
                        return;
                    }
                    if (!values && !csvImportState.isA17CsvPrepared) { // 如果沒有手動輸入值，且不是 A17 CSV 模式，則報錯
                        displaySystemNotification(`請輸入${getSelectedQueryDefinition().queryDisplayName}或匯入CSV`, true);
                        queryValuesInput.focus();
                        return;
                    }
                    handleClose({
                        selectedApiKey: getSelectedQueryDefinition().queryApiKey,
                        queryValues: values
                    });
                };
                overlay.querySelector('#qt-querysetup-cancel').onclick = () => handleClose(null);
            });
        }

        /**
         * 創建 CSV 用途選擇對話框。
         * @returns {Promise<string|null>} 用途 ('fillQueryValues' 或 'prepareA17Merge')，或 null (取消)。
         */
        function createCSVPurposeDialog() {
            return new Promise(resolve => {
                const contentHtml = `
                    <h3 class="qt-dialog-title">選擇CSV檔案用途</h3>
                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px;">
                        <button id="qt-csv-purpose-query" class="qt-card-btn qt-card-btn-blue" style="margin-left:0; padding:12px 20px; font-size:15px;">將CSV某欄位作為查詢值</button>
                        <button id="qt-csv-purpose-a17" class="qt-card-btn qt-card-btn-green" style="margin-left:0; padding:12px 20px; font-size:15px;">勾選CSV欄位供A17合併顯示</button>
                    </div>
                    <div style="text-align:center;">
                        <button id="qt-csv-purpose-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_CSVPurpose', contentHtml, '350px', 'auto');
                [cite: 5]

                const handleClose = (value) => {
                    closeDialog('_CSVPurpose');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose(null);
                };
                document.addEventListener('keydown', escListener);

                overlay.querySelector('#qt-csv-purpose-query').onclick = () => handleClose('fillQueryValues');
                overlay.querySelector('#qt-csv-purpose-a17').onclick = () => handleClose('prepareA17Merge');
                overlay.querySelector('#qt-csv-purpose-cancel').onclick = () => handleClose(null);
            });
        }

        /**
         * 創建 CSV 欄位選擇對話框 (單選)。
         * @param {string[]} headers - CSV 文件的所有標頭。
         * @param {string} title - 對話框標題。
         * @returns {Promise<number|null>} 選擇的欄位索引，或 null (取消)。
         */
        function createCSVColumnSelectionDialog(headers, title) {
            return new Promise(resolve => {
                let optionsHtml = headers.map((header, index) => `
                    <button class="qt-card-btn qt-card-btn-blue" data-index="${index}"
                            style="margin:5px; width:calc(50% - 10px); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; min-width:unset; padding:8px 12px; font-size:13px;">
                        ${Utils.escapeHtml(header)}
                    </button>
                `).join('');

                const contentHtml = `
                    <h3 class="qt-dialog-title">${Utils.escapeHtml(title)}</h3>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center; max-height:300px; overflow-y:auto; margin-bottom:20px; border:1px solid #eee; padding:15px; border-radius:8px; background-color: ${COLOR_PALETTE.TABLE_ROW_EVEN};">
                        ${optionsHtml}
                    </div>
                    <div style="text-align:center;">
                        <button id="qt-csvcol-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_CSVColSelect', contentHtml, '450px', 'auto');
                [cite: 5]

                const handleClose = (value) => {
                    closeDialog('_CSVColSelect');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose(null);
                };
                document.addEventListener('keydown', escListener);

                dialog.querySelectorAll('.qt-card-btn[data-index]').forEach(btn => {
                    btn.onclick = () => handleClose(parseInt(btn.dataset.index));
                });
                overlay.querySelector('#qt-csvcol-cancel').onclick = () => handleClose(null);
            });
        }

        /**
         * 創建 CSV 欄位選擇對話框 (多選)。
         * @param {string[]} headers - CSV 文件的所有標頭。
         * @param {string} title - 對話框標題。
         * @returns {Promise<string[]|null>} 選擇的欄位名稱陣列，或 null (取消)。
         */
        function createCSVColumnCheckboxDialog(headers, title) {
            return new Promise(resolve => {
                let checkboxesHtml = headers.map((header, index) => `
                    <div style="margin-bottom:10px; display:flex; align-items:center;">
                        <input type="checkbox" id="qt-csv-header-cb-${index}" value="${Utils.escapeHtml(header)}" style="margin-right:10px; transform:scale(1.25);">
                        <label for="qt-csv-header-cb-${index}" style="font-size:15px; color:${COLOR_PALETTE.TEXT_DARK}; font-weight:500; cursor:pointer;">${Utils.escapeHtml(header)}</label>
                    </div>
                `).join('');

                const contentHtml = `
                    <h3 class="qt-dialog-title">${Utils.escapeHtml(title)}</h3>
                    <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; border:1px solid #e0e0e0; padding:15px; border-radius:8px; background-color: ${COLOR_PALETTE.TABLE_ROW_EVEN};">
                        ${checkboxesHtml}
                    </div>
                    <div class="qt-dialog-flex-end">
                        <button id="qt-csvcb-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                        <button id="qt-csvcb-ok" class="qt-card-btn qt-card-btn-blue">確定勾選</button>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_CSVCheckbox', contentHtml, '450px', 'auto');
                [cite: 5]

                const handleClose = (value) => {
                    closeDialog('_CSVCheckbox');
                    document.removeEventListener('keydown', escListener);
                    resolve(value);
                };
                const escListener = (e) => {
                    if (e.key === 'Escape') handleClose(null);
                };
                document.addEventListener('keydown', escListener);

                overlay.querySelector('#qt-csvcb-ok').onclick = () => {
                    const selected = [];
                    dialog.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => selected.push(cb.value));
                    if (selected.length === 0) {
                        displaySystemNotification('請至少勾選一個欄位', true);
                        return;
                    }
                    handleClose(selected);
                };
                overlay.querySelector('#qt-csvcb-cancel').onclick = () => handleClose(null);
            });
        }

        /**
         * 創建 A17 文本設定對話框。
         * @returns {Promise<boolean|null>} true (儲存) 或 null (取消)。
         */
        function createA17TextSettingDialog() {
            return new Promise(resolve => {
                const s = DataStore.a17ModeState.textSettings; // 引用當前狀態中的設定
                const contentHtml = `
                    <h3 class="qt-dialog-title">A17 通知文本設定</h3>
                    <div style="display:grid; grid-template-columns: 1fr; gap: 15px;">
                        <div>
                            <label for="qt-a17-mainContent" style="font-weight:bold; font-size:14px; display:block; margin-bottom:8px; color:${COLOR_PALETTE.TEXT_DARK};">主文案內容：</label>
                            <textarea id="qt-a17-mainContent" class="qt-textarea" style="height:150px;"></textarea>
                            <div style="display:flex; gap:15px; margin-top:8px; flex-wrap:wrap; align-items:center;">
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">字體大小: <input type="number" id="qt-a17-mainFontSize" value="${s.mainFontSize}" min="8" max="24" step="0.5" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> pt
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">行高: <input type="number" id="qt-a17-mainLineHeight" value="${s.mainLineHeight}" min="1" max="3" step="0.1" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> 倍
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">顏色: <input type="color" id="qt-a17-mainFontColor" value="${s.mainFontColor}" style="padding:1px; height:25px; vertical-align:middle;"></label>
                            </div>
                        </div>
                        <div>
                            <label style="font-weight:bold; font-size:14px; display:block; margin-bottom:8px; color:${COLOR_PALETTE.TEXT_DARK};">動態日期設定 (相對於今天)：</label>
                            <div style="display:flex; gap:20px; align-items:center; margin-bottom:8px;flex-wrap:wrap;">
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">產檔時間偏移: <input type="number" id="qt-a17-genDateOffset" value="${s.genDateOffset}" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> 天
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">對比時間偏移: <input type="number" id="qt-a17-compDateOffset" value="${s.compDateOffset}" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> 天
                            </div>
                            <div style="display:flex; gap:15px; flex-wrap:wrap;">
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">日期字體大小: <input type="number" id="qt-a17-dateFontSize" value="${s.dateFontSize}" min="6" max="16" step="0.5" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> pt
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">日期行高: <input type="number" id="qt-a17-dateLineHeight" value="${s.dateLineHeight}" min="1" max="3" step="0.1" class="qt-input" style="width:65px; padding:4px; margin-bottom:0;"></label> 倍
                                <label style="font-size:13px; color:${COLOR_PALETTE.TEXT_MUTED};">日期顏色: <input type="color" id="qt-a17-dateFontColor" value="${s.dateFontColor}" style="padding:1px; height:25px; vertical-align:middle;"></label>
                            </div>
                        </div>
                        <div>
                            <label style="font-weight:bold; font-size:14px; display:block; margin-bottom:8px; color:${COLOR_PALETTE.TEXT_DARK};">預覽效果 (此區可臨時編輯，僅影響本次複製)：</label>
                            <div id="qt-a17-preview" contenteditable="true" style="border:1px solid #ccc; padding:15px; min-height:120px; max-height:220px; overflow-y:auto; font-size:${s.mainFontSize}pt; line-height:${s.mainLineHeight}; color:${s.mainFontColor}; background:${COLOR_PALETTE.TABLE_ROW_EVEN}; border-radius:8px;"></div>
                        </div>
                    </div>
                    <div class="qt-dialog-flex-between" style="margin-top:30px;">
                        <button id="qt-a17-text-reset" class="qt-card-btn qt-card-btn-orange" style="margin-left:0;">重設預設</button>
                        <div>
                            <button id="qt-a17-text-cancel" class="qt-card-btn qt-card-btn-grey">取消</button>
                            <button id="qt-a17-text-save" class="qt-card-btn qt-card-btn-blue">儲存設定</button>
                        </div>
                    </div>
                `;
                const {
                    overlay,
                    dialog
                } = createDialogBase('_A17TextSettings', contentHtml, '600px', '700px');
                [cite: 5]

                // 初始填充主文案內容
                dialog.querySelector('#qt-a17-mainContent').value = s.mainContent;

                const previewEl = overlay.querySelector('#qt-a17-preview');

                // 從 UI 獲取當前設定值的函式
                const getSettingsFromUI = () => ({
                    mainContent: overlay.querySelector('#qt-a17-mainContent').value,
                    mainFontSize: parseFloat(overlay.querySelector('#qt-a17-mainFontSize').value),
                    mainLineHeight: parseFloat(overlay.querySelector('#qt-a17-mainLineHeight').value),
                    mainFontColor: overlay.querySelector('#qt-a17-mainFontColor').value,
                    dateFontSize: parseFloat(overlay.querySelector('#qt-a17-dateFontSize').value),
                    dateLineHeight: parseFloat(overlay.querySelector('#qt-a17-dateLineHeight').value),
                    dateFontColor: overlay.querySelector('#qt-a17-dateFontColor').value,
                    genDateOffset: parseInt(overlay.querySelector('#qt-a17-genDateOffset').value),
                    compDateOffset: parseInt(overlay.querySelector('#qt-a17-compDateOffset').value)
                });

                // 更新預覽區內容的函式
                const updatePreview = () => {
                    const currentUISettings = getSettingsFromUI();
                    const today = new Date();
                    const genDate = new Date(today);
                    genDate.setDate(today.getDate() + currentUISettings.genDateOffset);
                    const compDate = new Date(today);
                    compDate.setDate(today.getDate() + currentUISettings.compDateOffset);
                    const genDateStr = Utils.formatDate(genDate);
                    const compDateStr = Utils.formatDate(compDate);

                    let previewContent = Utils.escapeHtml(currentUISettings.mainContent).replace(/\n/g, '<br>') +
                        `<br><br><span class="qt-a17-dynamic-date" style="font-size:${currentUISettings.dateFontSize}pt; line-height:${currentUISettings.dateLineHeight}; color:${currentUISettings.dateFontColor};">
                            產檔時間：${genDateStr}<br>對比時間：${compDateStr}
                        </span>`;
                    previewEl.innerHTML = previewContent;
                    previewEl.style.fontSize = currentUISettings.mainFontSize + 'pt';
                    previewEl.style.lineHeight = currentUISettings.mainLineHeight;
                    previewEl.style.color = currentUISettings.mainFontColor;
                };

                // 綁定所有輸入變動事件到 updatePreview
                ['#qt-a17-mainContent', '#qt-a17-mainFontSize', '#qt-a17-mainLineHeight', '#qt-a17-mainFontColor',
                    '#qt-a17-dateFontSize', '#qt-a17-dateLineHeight', '#qt-a17-dateFontColor',
                    '#qt-a17-genDateOffset', '#qt-a17-compDateOffset'
                ].forEach(selector => {
                    const el = overlay.querySelector(selector);
                    if (el) { // 確保元素存在
                        if (el.type === 'color') el.onchange = updatePreview;
                        else el.oninput = updatePreview;
                    }
                });

                // 初始化預覽
                updatePreview();

                // 按鈕事件
                overlay.querySelector('#qt-a17-text-save').onclick = () => {
                    const newSettings = getSettingsFromUI();
                    if (!newSettings.mainContent.trim()) {
                        displaySystemNotification('主文案內容不可為空', true);
                        return;
                    }
                    DataStore.a17ModeState.textSettings = newSettings;
                    DataStore.saveA17TextSettings(); // 儲存到 localStorage
                    displaySystemNotification('A17文本設定已儲存', false);
                    remove();
                    resolve(true);
                };

                overlay.querySelector('#qt-a17-text-cancel').onclick = () => {
                    remove();
                    resolve(null);
                };

                overlay.querySelector('#qt-a17-text-reset').onclick = () => {
                    // 重設為 Constants 中的預設值，並更新 UI
                    DataStore.resetA17TextSettings(); // 重設 DataStore 中的設定
                    const defaultSettings = DataStore.a17ModeState.textSettings; // 取得重設後的預設值
                    overlay.querySelector('#qt-a17-mainContent').value = defaultSettings.mainContent;
                    overlay.querySelector('#qt-a17-mainFontSize').value = defaultSettings.mainFontSize;
                    overlay.querySelector('#qt-a17-mainLineHeight').value = defaultSettings.mainLineHeight;
                    overlay.querySelector('#qt-a17-mainFontColor').value = defaultSettings.mainFontColor;
                    overlay.querySelector('#qt-a17-dateFontSize').value = defaultSettings.dateFontSize;
                    overlay.querySelector('#qt-a17-dateLineHeight').value = defaultSettings.dateLineHeight;
                    overlay.querySelector('#qt-a17-dateFontColor').value = defaultSettings.dateFontColor;
                    overlay.querySelector('#qt-a17-genDateOffset').value = defaultSettings.genDateOffset;
                    overlay.querySelector('#qt-a17-compDateOffset').value = defaultSettings.compDateOffset;
                    updatePreview(); // 更新預覽
                    displaySystemNotification('已重設為預設通知文設定', false, 1500);
                };
            });
        }

        return {
            createEnvSelectionDialog,
            createTokenDialog,
            createQuerySetupDialog,
            createCSVPurposeDialog,
            createCSVColumnSelectionDialog,
            createCSVColumnCheckboxDialog,
            createA17TextSettingDialog
        };
    })(Constants, UIManager, DataStore, Utils);

    // --- Table Renderer Module ---
    // 目的: 負責主要查詢結果表格的渲染、互動、排序、篩選及編輯功能。
    // 職責: 建立表格 UI、填充數據、綁定事件、處理單元格編輯、行增刪、篩選和排序。
    const TableRenderer = (function(Constants, UIManager, DataStore, Utils, Dialogs) { // 確保 Dialogs 被傳入
        const {
            FIELD_DISPLAY_NAMES_MAP,
            ALL_DISPLAY_FIELDS_API_KEYS_MAIN,
            TOOL_MAIN_CONTAINER_ID,
            COLOR_PALETTE,
            UNIT_CODE_MAPPINGS,
            A17_UNIT_BUTTONS_DEFS,
            UNIT_MAP_FIELD_API_KEY
        } = Constants;
        const {
            displaySystemNotification
        } = UIManager;
        const {
            uiState,
            dragState,
            getOriginalQueryResults,
            getBaseA17MasterData,
            a17ModeState,
            csvImportState
        } = DataStore;

        let mainUIEscListener = null; // 用於關閉主 UI 的 ESC 鍵監聽器

        /**
         * 渲染主要結果表格 UI。
         * @param {Array<Object>} dataToRender - 要顯示的數據。
         */
        function renderResultsTableUI(dataToRender) {
            // 清理舊的 UI 和事件監聽器
            uiState.mainUIElement?.remove();
            if (mainUIEscListener) {
                document.removeEventListener('keydown', mainUIEscListener);
                mainUIEscListener = null;
            }

            const mainUI = document.createElement('div');
            uiState.mainUIElement = mainUI;
            mainUI.id = TOOL_MAIN_CONTAINER_ID;
            mainUI.style.cssText = `
                position:fixed;z-index:${Constants.Z_INDEX.MAIN_UI};left:50%;top:50%;transform:translate(-50%,-50%);
                background:#f8f9fa;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);padding:0;
                width:auto;max-width:850px;max-height:90vh;display:flex;flex-direction:column;
                font-family:'Microsoft JhengHei',Arial,sans-serif;font-size:13px;border:1px solid #dee2e6;user-select:none;` [cite: 5]
            mainUI.style.cssText = `
                position: fixed;
                z-index: ${Constants.Z_INDEX.MAIN_UI};
                left: 50%;
                top: 50%;
                transform: translate(-50%,-50%);
                background: ${COLOR_PALETTE.TABLE_ROW_EVEN};
                border-radius: 12px; /* 更圓潤 */
                box-shadow: 0 12px 40px rgba(0,0,0,0.25); /* 更明顯的陰影 */
                padding: 0;
                width: auto;
                max-width: 90vw; /* 響應式調整 */
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                font-family: 'Microsoft JhengHei', Arial, sans-serif;
                font-size: 13px;
                border: 1px solid ${COLOR_PALETTE.TABLE_BORDER};
                user-select: none;
                transition: all 0.3s ease; /* 整體過渡效果 */

                /* 行動裝置友善性 */
                @media (max-width: 768px) {
                    width: 95%;
                    max-width: 95%;
                    max-height: 95vh;
                    left: 2.5%; /* 調整位置以適應寬度 */
                    transform: none; /* 移除中心定位，避免計算錯誤 */
                    top: 2.5%;
                }
            `;

            const titleBar = document.createElement('div');
            titleBar.textContent = '凱基人壽案件查詢結果';
            titleBar.style.cssText = `
                padding:10px 15px;margin:-0px -0px 10px -0px;background-color:#343a40;color:white;
                font-weight:bold;font-size:14px;text-align:center;border-top-left-radius:9px;border-top-right-radius:9px;
                cursor:grab;user-select:none;` [cite: 5]
            titleBar.style.cssText = `
                padding: 12px 20px;
                background-color: ${COLOR_PALETTE.TABLE_HEADER_BG};
                color: white;
                font-weight: bold;
                font-size: 15px;
                text-align: center;
                border-top-left-radius: 11px;
                border-top-right-radius: 11px;
                cursor: grab;
                user-select: none;
                transition: background-color 0.2s ease;
            `;
            mainUI.appendChild(titleBar);

            const contentWrapper = document.createElement('div');
            contentWrapper.style.cssText = `padding:15px;overflow-y:auto;display:flex;flex-direction:column;flex-grow:1;` [cite: 5]
            contentWrapper.style.cssText = `
                padding: 15px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                flex-grow: 1;
            `;
            mainUI.appendChild(contentWrapper);

            const controlsHeader = document.createElement('div');
            controlsHeader.style.cssText = `
                display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;
                padding-bottom:10px;border-bottom:1px solid #e0e0e0;flex-wrap:wrap;gap:8px;` [cite: 5]
            controlsHeader.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid ${COLOR_PALETTE.TABLE_BORDER};
                flex-wrap: wrap;
                gap: 10px; /* 按鈕間距 */
            `;

            const summarySec = document.createElement('div');
            summarySec.id = TOOL_MAIN_CONTAINER_ID + '_SummarySection';
            summarySec.style.cssText = `font-size:13px;font-weight:bold;color:#2c3e50;white-space:nowrap;` [cite: 5]
            summarySec.style.cssText = `
                font-size: 13px;
                font-weight: bold;
                color: ${COLOR_PALETTE.TEXT_DARK};
                white-space: nowrap;
                flex-shrink: 0;
            `;
            controlsHeader.appendChild(summarySec);

            const filterInput = document.createElement('input');
            filterInput.type = 'text';
            filterInput.id = TOOL_MAIN_CONTAINER_ID + '_TableFilterInput';
            filterInput.placeholder = '篩選表格內容...';
            filterInput.className = 'qt-input';
            filterInput.style.width = '180px';
            filterInput.style.marginBottom = '0';
            [cite: 5]
            filterInput.style.width = '180px';
            filterInput.style.marginBottom = '0';
            filterInput.style.flexShrink = '0';

            const buttonsGroupLeft = document.createElement('div');
            buttonsGroupLeft.style.cssText = `display:flex;gap:6px;align-items:center;` [cite: 5]
            buttonsGroupLeft.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
            const buttonsGroupRight = document.createElement('div');
            buttonsGroupRight.style.cssText = `display:flex;gap:6px;align-items:center;margin-left:auto;` [cite: 5]
            buttonsGroupRight.style.cssText = 'display:flex;gap:8px;align-items:center;margin-left:auto;flex-wrap:wrap;';

            [{
                    id: 'ClearConditions',
                    text: '清除條件',
                    cls: 'qt-dialog-btn-grey',
                    group: buttonsGroupLeft
                },
                [cite: 5] {
                    id: 'Requery',
                    text: '重新查詢',
                    cls: 'qt-dialog-btn-orange',
                    group: buttonsGroupLeft
                },
                [cite: 5] {
                    id: 'A17',
                    text: 'A17作業',
                    cls: 'qt-dialog-btn-purple',
                    group: buttonsGroupLeft
                },
                [cite: 5] {
                    id: 'CopyTable',
                    text: '複製表格',
                    cls: 'qt-dialog-btn-green',
                    group: buttonsGroupLeft
                },
                [cite: 5] {
                    id: 'EditMode',
                    text: '編輯模式',
                    cls: 'qt-dialog-btn-blue',
                    group: buttonsGroupLeft
                },
                [cite: 5] {
                    id: 'AddRow',
                    text: '+ 新增列',
                    cls: 'qt-dialog-btn-blue',
                    group: buttonsGroupLeft,
                    style: 'display:none;'
                } [cite: 5]
            ].forEach(cfg => {
                const btn = document.createElement('button');
                btn.id = TOOL_MAIN_CONTAINER_ID + '_btn' + cfg.id;
                btn.textContent = cfg.text;
                btn.className = `qt-dialog-btn ${cfg.cls}`;
                [cite: 5]
                if (cfg.style) btn.style.cssText += cfg.style;
                // 修正按鈕對齊，去除預設的 margin-left
                btn.style.marginLeft = '0px';
                cfg.group.appendChild(btn);
            });

            const closeBtn = document.createElement('button');
            closeBtn.id = TOOL_MAIN_CONTAINER_ID + '_btnCloseTool';
            closeBtn.textContent = '關閉工具';
            closeBtn.className = 'qt-dialog-btn qt-dialog-btn-red';
            [cite: 5]
            closeBtn.style.marginLeft = '0px'; // 修正按鈕對齊
            buttonsGroupRight.appendChild(closeBtn);

            // 將篩選框和按鈕組加入 controlsHeader
            controlsHeader.appendChild(filterInput);
            controlsHeader.appendChild(buttonsGroupLeft);
            controlsHeader.appendChild(buttonsGroupRight);
            contentWrapper.appendChild(controlsHeader);

            const a17UnitBtnsCtr = document.createElement('div');
            a17UnitBtnsCtr.id = TOOL_MAIN_CONTAINER_ID + '_A17UnitBtns';
            a17UnitBtnsCtr.style.cssText = `margin-bottom:10px;display:none;flex-wrap:wrap;gap:6px;justify-content:flex-start;` [cite: 5]
            a17UnitBtnsCtr.style.cssText = 'margin-bottom:12px;display:none;flex-wrap:wrap;gap:8px;justify-content:flex-start;';
            contentWrapper.appendChild(a17UnitBtnsCtr);
            uiState.a17UnitButtonsContainer = a17UnitBtnsCtr;

            const a17TextControls = document.createElement('div');
            a17TextControls.id = TOOL_MAIN_CONTAINER_ID + '_A17TextControls';
            a17TextControls.style.cssText = `margin-bottom:10px;display:none;align-items:center;gap:10px;` [cite: 5]
            a17TextControls.style.cssText = 'margin-bottom:12px;display:none;align-items:center;gap:15px;flex-wrap:wrap;';
            a17TextControls.innerHTML = `
                <label style="font-size:12px;color:#333;display:flex;align-items:center;cursor:pointer;">
                    <input type="checkbox" id="${TOOL_MAIN_CONTAINER_ID}_cbA17IncludeText" checked style="margin-right:4px;">
                    A17含通知文
                </label>
                <button id="${TOOL_MAIN_CONTAINER_ID}_btnA17EditText" class="qt-dialog-btn qt-dialog-btn-blue" style="margin-left:0;padding:5px 10px;font-size:12px;">編輯通知文</button>`;
            [cite: 5]
            a17TextControls.innerHTML = `
                <label style="font-size:13px;color:${COLOR_PALETTE.TEXT_DARK};display:flex;align-items:center;cursor:pointer;font-weight:500;">
                    <input type="checkbox" id="${TOOL_MAIN_CONTAINER_ID}_cbA17IncludeText" checked style="margin-right:6px; transform:scale(1.1);">A17含通知文
                </label>
                <button id="${TOOL_MAIN_CONTAINER_ID}_btnA17EditText" class="qt-card-btn qt-card-btn-blue" style="margin-left:0;padding:6px 12px;font-size:12px; min-width:unset;">編輯通知文</button>
            `;
            contentWrapper.appendChild(a17TextControls);


            const tableScrollWrap = document.createElement('div');
            tableScrollWrap.id = TOOL_MAIN_CONTAINER_ID + '_TableScrollWrapper'; // 添加ID
            tableScrollWrap.style.cssText = `flex-grow:1;overflow:auto;border:1px solid #ccc;border-radius:5px;background:white;` [cite: 5]
            tableScrollWrap.style.cssText = `
                flex-grow: 1;
                overflow: auto;
                border: 1px solid ${COLOR_PALETTE.TABLE_BORDER};
                border-radius: 8px; /* 更圓潤 */
                background: white;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.05); /* 內陰影 */
            `;
            const tableEl = document.createElement('table');
            tableEl.id = TOOL_MAIN_CONTAINER_ID + '_ResultsTable';
            tableEl.style.cssText = `width:100%;border-collapse:collapse;font-size:12px;` [cite: 5]
            tableEl.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            `;
            tableScrollWrap.appendChild(tableEl);
            contentWrapper.appendChild(tableScrollWrap);

            const tHREl = document.createElement('thead');
            tHREl.style.cssText = `position:sticky;top:0;z-index:1;background-color:#343a40;color:white;` [cite: 5]
            tHREl.style.cssText = `
                position: sticky;
                top: 0;
                z-index: 1;
                background-color: ${COLOR_PALETTE.TABLE_HEADER_BG};
                color: white;
            `;
            tableEl.appendChild(tHREl);
            uiState.tableHeadElement = tHREl;

            const tBREl = document.createElement('tbody');
            tableEl.appendChild(tBREl);
            [cite: 5]
            uiState.tableBodyElement = tBREl;

            document.body.appendChild(mainUI);

            // --- 事件綁定 ---
            titleBar.onmousedown = (e) => {
                if (e.target !== titleBar) return;
                e.preventDefault();
                dragState.dragging = true;
                [cite: 5]
                dragState.startX = e.clientX;
                [cite: 5]
                dragState.startY = e.clientY;
                [cite: 5]

                // 在拖曳開始時，保存元素的初始位置
                const rect = mainUI.getBoundingClientRect();
                dragState.initialX = rect.left;
                dragState.initialY = rect.top;

                titleBar.style.cursor = 'grabbing';
                // 拖曳時取消 transform: translate，直接修改 left/top
                // 因為 transform: translate 會導致定位計算複雜，直接用 left/top 配合 fixed
                mainUI.style.left = `${rect.left}px`;
                mainUI.style.top = `${rect.top}px`;
                mainUI.style.transform = 'none'; // 移除中心定位
            };
            document.onmousemove = (e) => {
                if (dragState.dragging) {
                    const dx = e.clientX - dragState.startX;
                    [cite: 5]
                    const dy = e.clientY - dragState.startY;
                    [cite: 5]
                    mainUI.style.left = (dragState.initialX + dx) + 'px';
                    [cite: 5]
                    mainUI.style.top = (dragState.initialY + dy) + 'px';
                    [cite: 5]
                }
            };
            document.onmouseup = () => {
                if (dragState.dragging) {
                    dragState.dragging = false;
                    [cite: 5]
                    titleBar.style.cursor = 'grab';
                    [cite: 5]
                }
            };

            filterInput.oninput = () => applyTableFilter();
            [cite: 5]
            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnClearConditions`).onclick = handleClearConditions;
            [cite: 5]
            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnRequery`).onclick = () => {
                mainUI.remove();
                [cite: 5]
                document.removeEventListener('keydown', mainUIEscListener);
                [cite: 5]
                App.executeCaseQueryTool(); // 重新觸發主流程
            };

            const a17Btn = mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnA17`);
            a17Btn.onmousedown = (e) => {
                if (e.button !== 0) return;
                [cite: 5]
                DataStore.a17ButtonLongPressTimer = setTimeout(() => {
                    DataStore.a17ButtonLongPressTimer = null;
                    [cite: 5]
                    toggleA17Mode(true);
                    [cite: 5]
                }, 700);
                [cite: 5]
            };
            a17Btn.onmouseup = () => {
                if (DataStore.a17ButtonLongPressTimer) {
                    clearTimeout(DataStore.a17ButtonLongPressTimer);
                    [cite: 5]
                    DataStore.a17ButtonLongPressTimer = null;
                    [cite: 5]
                    toggleA17Mode(false);
                    [cite: 5]
                }
            };
            a17Btn.onmouseleave = () => { // 鼠標移開時取消長按計時器
                if (DataStore.a17ButtonLongPressTimer) {
                    clearTimeout(DataStore.a17ButtonLongPressTimer);
                    [cite: 5]
                    DataStore.a17ButtonLongPressTimer = null;
                    [cite: 5]
                }
            };

            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnCopyTable`).onclick = handleCopyTable;
            [cite: 5]
            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnEditMode`).onclick = toggleEditMode;
            [cite: 5]
            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnAddRow`).onclick = handleAddRowToTable;
            [cite: 5]
            closeBtn.onclick = () => {
                mainUI.remove();
                [cite: 5]
                document.removeEventListener('keydown', mainUIEscListener);
                [cite: 5]
            };
            mainUI.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnA17EditText`).onclick = async () => {
                await Dialogs.createA17TextSettingDialog(); // 使用 Dialogs 模組的函式
            };

            // 全局 ESC 鍵監聽器，用於關閉主 UI (排除所有 overlay 存在的狀況)
            mainUIEscListener = (e) => {
                if (e.key === 'Escape' && uiState.mainUIElement && !document.querySelector(`[id^="${TOOL_MAIN_CONTAINER_ID}_"][id$="_overlay"]`)) {
                    uiState.mainUIElement.remove();
                    document.removeEventListener('keydown', mainUIEscListener);
                }
            };
            document.addEventListener('keydown', mainUIEscListener);

            // 初始化或更新介面
            updateSummaryCount(dataToRender.length);
            [cite: 5]
            if (uiState.isA17Mode) {
                renderA17ModeUI();
                [cite: 5]
                populateTableRows(getBaseA17MasterData());
                [cite: 5]
                createA17UnitButtons(); // 確保重新創建按鈕
                updateA17UnitButtonCounts();
                [cite: 5]
            } else {
                renderNormalModeUI();
                [cite: 5]
                populateTableRows(dataToRender);
                [cite: 5]
            }
        }

        /**
         * 更新表格頂部的總結計數。
         * @param {number} visibleRowCount - 當前可見的行數。
         */
        function updateSummaryCount(visibleRowCount) {
            const summaryEl = uiState.mainUIElement?.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_SummarySection`);
            if (!summaryEl) return;
            [cite: 5]

            let baseDataCount = uiState.isA17Mode ? getBaseA17MasterData().length : getOriginalQueryResults().length;
            [cite: 5]
            let text = `查詢結果：<strong>${baseDataCount}</strong>筆`;
            [cite: 5]

            const filterInput = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_TableFilterInput`);
            const isFiltered = (filterInput && filterInput.value.trim() !== '') || (uiState.isA17Mode && a17ModeState.selectedUnits.size > 0);
            [cite: 5]

            if (isFiltered && visibleRowCount !== baseDataCount) {
                [cite: 5]
                text += ` (篩選後顯示 <strong>${visibleRowCount}</strong> 筆)`;
                [cite: 5]
            }
            summaryEl.innerHTML = text;
            [cite: 5]
        }

        /**
         * 渲染表格標頭。
         * @param {string[]} headers - 要顯示的標頭鍵陣列。
         */
        function renderTableHeaders(headers) {
            uiState.tableHeadElement.innerHTML = '';
            [cite: 5]
            const headerRow = document.createElement('tr');
            headers.forEach((hTxt, idx) => {
                [cite: 5]
                const th = document.createElement('th');
                th.textContent = Utils.escapeHtml(hTxt);
                th.style.cssText = `padding:8px 6px;text-align:center;white-space:nowrap;cursor:pointer;user-select:none;font-weight:600;font-size:12px;border-right:1px solid #4a6075;`;
                [cite: 5]
                if (idx === headers.length - 1) th.style.borderRight = 'none';
                [cite: 5]
                // 突出顯示查詢值欄位，在非A17模式下
                if (idx === 0 && !uiState.isA17Mode && hTxt === FIELD_DISPLAY_NAMES_MAP._queriedValue_) {
                    [cite: 5]
                    th.style.backgroundColor = Constants.QUERYABLE_FIELD_DEFINITIONS.find(d => d.queryApiKey === DataStore.getSelectedQueryDefinition().queryApiKey)?.color || COLOR_PALETTE.PRIMARY;
                }
                th.onclick = () => sortTableByColumn(hTxt);
                [cite: 5]
                headerRow.appendChild(th);
                [cite: 5]
            });

            if (uiState.isEditMode) {
                [cite: 5]
                const thAction = document.createElement('th');
                thAction.textContent = "操作";
                [cite: 5]
                thAction.style.cssText = `padding:8px 6px;text-align:center;white-space:nowrap;font-weight:600;font-size:12px;`;
                [cite: 5]
                headerRow.appendChild(thAction);
                [cite: 5]
            }
            uiState.tableHeadElement.appendChild(headerRow);
            [cite: 5]
            uiState.currentHeaders = headers;
        }

        /**
         * 填充表格行數據。
         * @param {Array<Object>} data - 要填充的數據陣列。
         */
        function populateTableRows(data) {
            uiState.tableBodyElement.innerHTML = '';
            [cite: 5]
            data.forEach((row, rowIndex) => {
                [cite: 5]
                const tr = document.createElement('tr');
                tr.style.backgroundColor = rowIndex % 2 ? '#f8f9fa' : '#ffffff';
                [cite: 5]
                tr.onmouseover = () => {
                    if (!tr.classList.contains('qt-editing-row')) tr.style.backgroundColor = '#e9ecef';
                };
                [cite: 5]
                tr.onmouseout = () => {
                    if (!tr.classList.contains('qt-editing-row')) tr.style.backgroundColor = rowIndex % 2 ? '#f8f9fa' : '#ffffff';
                };
                [cite: 5]

                uiState.currentHeaders.forEach((headerKey, colIndex) => {
                    [cite: 5]
                    const td = document.createElement('td');
                    td.style.cssText = `padding:6px;border-bottom:1px solid #dee2e6;font-size:12px;text-align:center;border-right:1px solid #dee2e6;`;
                    [cite: 5]
                    if (colIndex === uiState.currentHeaders.length - 1) td.style.borderRight = 'none';
                    [cite: 5]

                    let cellValue = row[headerKey] === null || row[headerKey] === undefined ? '' : String(row[headerKey]);
                    [cite: 5]

                    // 特殊處理狀態欄位，保留 HTML
                    if (headerKey === FIELD_DISPLAY_NAMES_MAP.statusCombined && typeof cellValue === 'string' && cellValue.includes('<span')) {
                        [cite: 5]
                        td.innerHTML = cellValue;
                        [cite: 5]
                    } else {
                        td.textContent = cellValue;
                        [cite: 5]
                    }

                    // A17 模式下突出顯示分公司欄位
                    if (uiState.isA17Mode && headerKey === FIELD_DISPLAY_NAMES_MAP.uwApproverUnit) {
                        [cite: 5]
                        td.style.backgroundColor = '#e6f7ff';
                        [cite: 5]
                        td.style.fontWeight = '500';
                        [cite: 5]
                    }

                    // 編輯模式下的點擊行為
                    if (uiState.isEditMode && ((colIndex > 1 && !row._isNewRow) || (row._isNewRow && headerKey !== FIELD_DISPLAY_NAMES_MAP.NO && headerKey !== FIELD_DISPLAY_NAMES_MAP._apiQueryStatus))) {
                        [cite: 5]
                        // 排除序號和查詢結果欄位，因為它們是自動生成的或只讀的
                        td.onclick = (e) => {
                            [cite: 5]
                            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') { // 避免重複啟動編輯
                                startCellEdit(td, row, headerKey, rowIndex);
                                [cite: 5]
                            }
                        };
                    } else if (!uiState.isEditMode) {
                        [cite: 5]
                        // 非編輯模式下點擊複製內容
                        td.onclick = () => {
                            [cite: 5]
                            navigator.clipboard.writeText(td.textContent || td.innerText).then(() => {
                                [cite: 5]
                                displaySystemNotification(`已複製: ${td.textContent || td.innerText}`, false, 1000);
                                [cite: 5]
                            }).catch(err => {
                                [cite: 5]
                                displaySystemNotification('複製失敗', true);
                                [cite: 5]
                            });
                        };
                    }
                    tr.appendChild(td);
                    [cite: 5]
                });

                if (uiState.isEditMode) {
                    [cite: 5]
                    const tdAction = document.createElement('td');
                    tdAction.style.cssText = `padding:6px;border-bottom:1px solid #dee2e6;text-align:center;`;
                    [cite: 5]
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '🗑️';
                    [cite: 5] // 垃圾桶圖示
                    deleteBtn.className = 'qt-card-btn qt-card-btn-red';
                    [cite: 5]
                    deleteBtn.style.padding = '3px 6px';
                    [cite: 5]
                    deleteBtn.style.fontSize = '10px';
                    [cite: 5]
                    deleteBtn.style.marginLeft = '0'; // 避免 margin-left
                    deleteBtn.style.minWidth = 'auto'; // 避免卡片按鈕的 min-width 影響
                    deleteBtn.onclick = () => handleDeleteRow(rowIndex);
                    [cite: 5]
                    tdAction.appendChild(deleteBtn);
                    [cite: 5]
                    tr.appendChild(tdAction);
                    [cite: 5]
                }
                uiState.tableBodyElement.appendChild(tr);
                [cite: 5]
            });
            updateSummaryCount(data.length);
            [cite: 5]
        }

        /**
         * 根據指定欄位對表格數據進行排序。
         * @param {string} headerKeyToSortBy - 要排序的欄位鍵。
         */
        function sortTableByColumn(headerKeyToSortBy) {
            const currentData = uiState.isA17Mode ? [...getBaseA17MasterData()] : [...getOriginalQueryResults()];
            [cite: 5]
            if (currentData.length === 0) return;
            [cite: 5]

            // 切換排序方向
            const direction = (uiState.sortDirections[headerKeyToSortBy] || 'desc') === 'asc' ? 'desc' : 'asc';
            [cite: 5]
            uiState.sortDirections = {};
            [cite: 5] // 清除其他欄位的排序方向
            uiState.sortDirections[headerKeyToSortBy] = direction;
            [cite: 5]

            currentData.sort((a, b) => {
                [cite: 5]
                let valA = a[headerKeyToSortBy] === null || a[headerKeyToSortBy] === undefined ? '' : String(a[headerKeyToSortBy]);
                [cite: 5]
                let valB = b[headerKeyToSortBy] === null || b[headerKeyToSortBy] === undefined ? '' : String(b[headerKeyToSortBy]);
                [cite: 5]

                const isNumeric = headerKeyToSortBy === FIELD_DISPLAY_NAMES_MAP.NO ||
                    (!isNaN(parseFloat(valA)) && isFinite(valA) && !isNaN(parseFloat(valB)) && isFinite(valB) && valA.trim() !== '' && valB.trim() !== '');
                [cite: 5]

                let comparison = 0;
                [cite: 5]
                if (isNumeric) {
                    [cite: 5]
                    comparison = parseFloat(valA) - parseFloat(valB);
                    [cite: 5]
                } else {
                    comparison = valA.localeCompare(valB, 'zh-Hant-TW');
                    [cite: 5]
                }
                return direction === 'asc' ? comparison : -comparison;
                [cite: 5]
            });

            if (uiState.isA17Mode) {
                [cite: 5]
                DataStore.setBaseA17MasterData(currentData);
                [cite: 5]
            } else {
                DataStore.setOriginalQueryResults(currentData);
                [cite: 5]
            }
            populateTableRows(currentData);
            [cite: 5]
            displaySystemNotification(`已按「${headerKeyToSortBy}」${direction === 'asc' ? '升序' : '降序'}排列`, false);
            [cite: 5]

            // 更新表頭箭頭
            uiState.tableHeadElement.querySelectorAll('th').forEach(th => {
                [cite: 5]
                const currentHeaderText = th.textContent.replace(/[\u25B2\u25BC\s]*$/, '').trim();
                [cite: 5]
                th.innerHTML = Utils.escapeHtml(currentHeaderText);
                [cite: 5] // 清除舊的箭頭
                if (currentHeaderText === headerKeyToSortBy) {
                    [cite: 5]
                    th.innerHTML += (direction === 'asc' ? ' <span style="font-size:10px;">▲</span>' : ' <span style="font-size:10px;">▼</span>');
                    [cite: 5]
                }
            });
        }

        /**
         * 應用表格篩選。
         */
        function applyTableFilter() {
            const filterInput = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_TableFilterInput`);
            const filterText = filterInput ? filterInput.value.trim().toLowerCase() : '';
            [cite: 5]

            const baseData = uiState.isA17Mode ? getBaseA17MasterData() : getOriginalQueryResults();
            [cite: 5]
            let filteredData = baseData;
            [cite: 5]

            // 全文篩選
            if (filterText) {
                [cite: 5]
                filteredData = baseData.filter(row => [cite: 5] uiState.currentHeaders.some(headerKey => [cite: 5]
                    (String(row[headerKey] || '').toLowerCase().includes(filterText))[cite: 5]
                ));
            }

            // A17 單位篩選
            if (uiState.isA17Mode && a17ModeState.selectedUnits.size > 0) {
                [cite: 5]
                let unitFilteredData = [];
                [cite: 5]
                a17ModeState.selectedUnits.forEach(unitId => {
                    [cite: 5]
                    unitFilteredData = unitFilteredData.concat([cite: 5] filteredData.filter(row => {
                        [cite: 5]
                        const unitVal = String(row[FIELD_DISPLAY_NAMES_MAP[UNIT_MAP_FIELD_API_KEY]] || '');
                        [cite: 5]
                        if (unitId === 'UNDEF') {
                            [cite: 5]
                            const knownPrefixes = Constants.A17_UNIT_BUTTONS_DEFS.filter(b => b.id !== 'UNDEF').map(b => b.id.toUpperCase());
                            [cite: 5]
                            return unitVal.trim() === '' || !knownPrefixes.some(prefix => unitVal.toUpperCase().startsWith(prefix));
                            [cite: 5]
                        }
                        return unitVal.toUpperCase().startsWith(unitId.toUpperCase());
                        [cite: 5]
                    }));
                });
                [cite: 5]
                filteredData = Array.from(new Set(unitFilteredData.map(JSON.stringify))).map(JSON.parse);
                [cite: 5] // 去重
            }
            populateTableRows(filteredData);
            [cite: 5]
        }

        /**
         * 處理清除所有條件。
         */
        function handleClearConditions() {
            uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_TableFilterInput`).value = '';
            [cite: 5]
            uiState.sortDirections = {}; // 清除排序方向 

            if (uiState.isA17Mode) {
                [cite: 5]
                a17ModeState.selectedUnits.clear();
                [cite: 5] // 清除選中的單位
                uiState.a17UnitButtonsContainer.querySelectorAll('button.highlighted').forEach(btn => {
                    [cite: 5]
                    btn.classList.remove('highlighted');
                    [cite: 5]
                    btn.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`; // 恢復預設陰影
                    btn.style.transform = 'none'; // 恢復預設狀態
                });
                // 清除 CSV 導入狀態，但保留原始數據
                DataStore.csvImportState = {
                    fileName: '',
                    rawHeaders: [],
                    rawData: [],
                    selectedColForQueryName: null,
                    selectedColsForA17Merge: [],
                    isA17CsvPrepared: false
                };
                // 重置 baseA17MasterData 為原始查詢結果，並重新排序
                DataStore.setBaseA17MasterData([...getOriginalQueryResults()]);
                [cite: 5]
                DataStore.getBaseA17MasterData().sort((a, b) => (parseInt(a[FIELD_DISPLAY_NAMES_MAP.NO]) || 0) - (parseInt(b[FIELD_DISPLAY_NAMES_MAP.NO]) || 0));
                [cite: 5]
                populateTableRows(DataStore.getBaseA17MasterData());
                [cite: 5]
                updateA17UnitButtonCounts();
                [cite: 5] // 重新計算 A17 單位按鈕數量
            } else {
                // 重置原始查詢結果，並重新排序 (如果已排序過)
                getOriginalQueryResults().sort((a, b) => (parseInt(a[FIELD_DISPLAY_NAMES_MAP.NO]) || 0) - (parseInt(b[FIELD_DISPLAY_NAMES_MAP.NO]) || 0));
                [cite: 5]
                populateTableRows(getOriginalQueryResults());
                [cite: 5]
            }
            renderTableHeaders(uiState.currentHeaders); // 重新渲染表頭以清除排序箭頭
            displaySystemNotification('所有條件已清除，表格已重置為按序號排序', false);
            [cite: 5]
        }

        /**
         * 函式名稱：toggleEditMode
         * 功能說明：切換表格的編輯模式。
         * 參數說明：無。
         * 回傳值說明：無。
         */
        function toggleEditMode() {
            uiState.isEditMode = !uiState.isEditMode;
            [cite: 5]
            const editBtn = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnEditMode`);
            [cite: 5]
            const addRowBtn = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnAddRow`);
            [cite: 5]

            editBtn.textContent = uiState.isEditMode ? '完成編輯' : '編輯模式';
            [cite: 5]
            editBtn.className = `qt-card-btn ${uiState.isEditMode ? 'qt-card-btn-red' : 'qt-card-btn-blue'}`;
            [cite: 5]
            addRowBtn.style.display = uiState.isEditMode ? 'inline-block' : 'none';
            [cite: 5]

            const currentData = uiState.isA17Mode ? getBaseA17MasterData() : getOriginalQueryResults();
            [cite: 5]
            renderTableHeaders(uiState.currentHeaders);
            [cite: 5] // 重新渲染表頭以顯示/隱藏操作欄
            populateTableRows(currentData);
            [cite: 5] // 重新填充表格以應用編輯模式的單元格點擊行為

            displaySystemNotification(uiState.isEditMode ? '已進入編輯模式' : '已退出編輯模式', false);
            [cite: 5]
        }

        /**
         * 啟用單元格編輯功能。
         * @param {HTMLTableCellElement} td - 要編輯的單元格。
         * @param {object} rowData - 該行對應的數據物件。
         * @param {string} headerKey - 該單元格對應的數據鍵。
         * @param {number} rowIndex - 該行在數據陣列中的索引。
         */
        function startCellEdit(td, rowData, headerKey, rowIndex) {
            if (td.querySelector('input, select')) return;
            [cite: 5]
            td.classList.add('qt-editing-cell');
            [cite: 5]
            const originalText = td.textContent;
            [cite: 5]
            td.innerHTML = '';
            [cite: 5] // 清空單元格內容

            let inputElement;

            // 特殊處理 A17 模式下「分公司」欄位的編輯 (參考舊版 A17B 邏輯)
            if (uiState.isA17Mode && headerKey === FIELD_DISPLAY_NAMES_MAP.uwApproverUnit) {
                [cite: 5]
                inputElement = document.createElement('select');
                [cite: 5]
                inputElement.className = 'qt-select';
                [cite: 5]
                inputElement.style.cssText = 'width:100%;padding:4px;font-size:12px;border:1px solid #007bff;margin:0;background:transparent;';
                [cite: 5]

                const defaultOption = document.createElement('option');
                defaultOption.value = "";
                defaultOption.textContent = "--選擇分公司--";
                inputElement.appendChild(defaultOption);

                Constants.A17_UNIT_BUTTONS_DEFS.forEach(unitDef => {
                    [cite: 5]
                    if (unitDef.id === 'UNDEF') return;
                    [cite: 5] // 不包括「查無單位」選項
                    const option = document.createElement('option');
                    option.value = unitDef.id;
                    option.textContent = unitDef.label;
                    const currentUnitPrefix = String(rowData[headerKey] || '').split('-')[0].toUpperCase();
                    if (unitDef.id === currentUnitPrefix) {
                        [cite: 5]
                        option.selected = true;
                        [cite: 5]
                    }
                    inputElement.appendChild(option);
                    [cite: 5]
                });

                inputElement.onchange = () => finishCellEdit(td, inputElement, rowData, headerKey, originalText, rowIndex, 'select');
                [cite: 5]

            } else {
                // 一般文本輸入框
                inputElement = document.createElement('input');
                [cite: 5]
                inputElement.type = 'text';
                [cite: 5]
                inputElement.className = 'qt-input';
                [cite: 5]
                inputElement.style.cssText = 'width:100%;padding:4px;font-size:12px;border:1px solid #007bff;margin:0;';
                [cite: 5]
                inputElement.value = originalText;
                [cite: 5]

                // 綁定 Enter 鍵和 Escape 鍵 (參考舊版 A17B 邏輯)
                inputElement.onkeydown = (e) => {
                    [cite: 5]
                    if (e.key === 'Enter') {
                        [cite: 5]
                        e.preventDefault();
                        [cite: 5]
                        finishCellEdit(td, inputElement, rowData, headerKey, originalText, rowIndex, 'input');
                        [cite: 5]
                    } else if (e.key === 'Escape') {
                        [cite: 5]
                        td.textContent = originalText;
                        [cite: 5]
                        td.classList.remove('qt-editing-cell');
                        [cite: 5]
                    }
                };
            }

            // 失去焦點時完成編輯（需要延遲以處理點擊事件的順序） (參考舊版 A17B 邏輯)
            inputElement.onblur = () => {
                [cite: 5]
                setTimeout(() => {
                    [cite: 5]
                    // 確保元素仍然在 DOM 中才處理
                    if (td.contains(inputElement)) {
                        [cite: 5]
                        finishCellEdit(td, inputElement, rowData, headerKey, originalText, rowIndex, inputElement.tagName.toLowerCase());
                        [cite: 5]
                    }
                }, 100);
                [cite: 5]
            };

            td.appendChild(inputElement);
            [cite: 5]
            inputElement.focus();
            [cite: 5]
            if (inputElement.select) {
                [cite: 5] // 選中所有文字
                inputElement.select();
                [cite: 5]
            }
        }

        /**
         * 完成單元格編輯並更新數據。
         * @param {HTMLTableCellElement} td - 被編輯的單元格。
         * @param {HTMLInputElement|HTMLSelectElement} inputElement - 編輯用的輸入框或選擇框。
         * @param {object} rowData - 該行對應的數據物件。
         * @param {string} headerKey - 該單元格對應的數據鍵。
         * @param {string} originalText - 原始文本內容。
         * @param {number} rowIndex - 該行在數據陣列中的索引。
         * @param {string} inputType - 輸入元素的類型 ('input' 或 'select')。
         */
        function finishCellEdit(td, inputElement, rowData, headerKey, originalText, rowIndex, inputType = 'input') {
            const newValue = inputElement.value.trim();
            [cite: 5]
            td.classList.remove('qt-editing-cell');
            [cite: 5]

            let displayValue = newValue;
            [cite: 5]
            if (inputType === 'select' && newValue) {
                [cite: 5]
                const selectedUnitDef = Constants.A17_UNIT_BUTTONS_DEFS.find(def => def.id === newValue);
                [cite: 5]
                displayValue = selectedUnitDef?.label || newValue;
                [cite: 5]
                // 如果是分公司欄位，將值儲存為 "代碼-名稱" 格式，例如 "B-北一"
                if (selectedUnitDef) {
                    [cite: 5]
                    rowData[headerKey] = selectedUnitDef.id + '-' + selectedUnitDef.label.split('-')[1];
                    [cite: 5] // 儲存為 "B-北一"
                } else {
                    rowData[headerKey] = newValue;
                }
            } else {
                rowData[headerKey] = newValue;
                [cite: 5] // 更新數據物件
            }
            td.textContent = displayValue;
            [cite: 5] // 更新顯示內容

            // 判斷是否真正有值改變
            const currentStoredValue = String(rowData[headerKey] || '');
            const originalStoredValue = (inputType === 'select' && String(originalText || '').split('-')[0]) || originalText; // 對於下拉選擇框，比較代碼前綴

            if (currentStoredValue !== originalStoredValue) {
                [cite: 5] // 這裡需要更精確的比較
                displaySystemNotification(`「${headerKey}」已更新`, false, 1500);
                [cite: 5]
                td.style.backgroundColor = COLOR_PALETTE.EDIT_HIGHLIGHT; // 成功編輯後高亮顯示
                setTimeout(() => {
                    // 恢復原來的背景色
                    td.style.backgroundColor = (rowIndex % 2 ? COLOR_PALETTE.TABLE_ROW_EVEN : COLOR_PALETTE.TABLE_ROW_ODD);
                }, 800); // 0.8秒後恢復

                if (uiState.isA17Mode && headerKey === FIELD_DISPLAY_NAMES_MAP.uwApproverUnit) {
                    [cite: 5]
                    updateA17UnitButtonCounts();
                    [cite: 5] // 分公司欄位變化時更新單位按鈕計數
                    if (a17ModeState.selectedUnits.size > 0) {
                        [cite: 5]
                        applyTableFilter();
                        [cite: 5] // 如果有篩選條件，重新應用篩選
                    }
                }
            } else {
                [cite: 5]
                td.textContent = originalText;
                [cite: 5]
            }
        }

        /**
         * 新增一列到表格中。
         * @param {number} maxNo - 最大序號
         */
        function handleAddRowToTable() {
            if (!uiState.isEditMode) {
                [cite: 5]
                displaySystemNotification('請先進入編輯模式', true);
                [cite: 5]
                return;
                [cite: 5]
            }

            const newRow = {
                _isNewRow: true
            };
            [cite: 5] // 標記為新行
            let maxNo = 0;
            [cite: 5]
            const targetDataset = uiState.isA17Mode ? getBaseA17MasterData() : getOriginalQueryResults();
            [cite: 5]

            // 計算當前最大序號
            targetDataset.forEach(row => {
                [cite: 5]
                const currentNo = parseInt(row[FIELD_DISPLAY_NAMES_MAP.NO]);
                [cite: 5]
                if (!isNaN(currentNo) && currentNo > maxNo) {
                    [cite: 5]
                    maxNo = currentNo;
                    [cite: 5]
                }
            });
            newRow[FIELD_DISPLAY_NAMES_MAP.NO] = String(maxNo + 1);
            [cite: 5] // 新行序號

            // 初始化所有顯示欄位為空字串
            uiState.currentHeaders.forEach(header => {
                [cite: 5]
                if (header !== FIELD_DISPLAY_NAMES_MAP.NO && header !== "操作" && header !== FIELD_DISPLAY_NAMES_MAP._apiQueryStatus) {
                    [cite: 5]
                    newRow[header] = '';
                    [cite: 5]
                }
            });
            newRow[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = '✏️ 未查詢'; // 新增的行狀態

            if (uiState.isA17Mode) {
                [cite: 5]
                targetDataset.push(newRow);
                [cite: 5] // 添加到 A17 數據中
                populateTableRows(targetDataset);
                [cite: 5]
                updateA17UnitButtonCounts(); // 新增行可能影響單位計數
            } else {
                [cite: 5]
                targetDataset.push(newRow);
                [cite: 5] // 添加到原始查詢結果中
                populateTableRows(targetDataset);
                [cite: 5]
            }
            displaySystemNotification('已新增一列，請編輯內容', false);
            [cite: 5]

            // 滾動到表格底部
            const tableWrapper = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_TableScrollWrapper`);
            [cite: 5]
            if (tableWrapper) {
                [cite: 5]
                tableWrapper.scrollTop = tableWrapper.scrollHeight;
                [cite: 5]
            }
        }

        /**
         * 刪除表格中的一行數據。
         * @param {number} rowIndex - 要刪除的行索引。
         */
        function handleDeleteRow(rowIndex) {
            if (!uiState.isEditMode) return;
            [cite: 5]

            const targetDataset = uiState.isA17Mode ? getBaseA17MasterData() : getOriginalQueryResults();
            [cite: 5]

            if (rowIndex >= 0 && rowIndex < targetDataset.length) {
                [cite: 5]
                targetDataset.splice(rowIndex, 1);
                [cite: 5] // 刪除數據
                populateTableRows(targetDataset);
                [cite: 5] // 重新渲染表格
                displaySystemNotification('已刪除該列資料', false);
                [cite: 5]
                if (uiState.isA17Mode) {
                    [cite: 5]
                    updateA17UnitButtonCounts();
                    [cite: 5]
                }
            }
        }

        /**
         * 切換 A17 模式的 UI 顯示和數據處理邏輯。
         * @param {boolean} forceEnter - 是否強制進入 A17 模式 (即使未匯入 CSV)。
         */
        function toggleA17Mode(forceEnter = false) {
            const a17TextControls = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_A17TextControls`);
            const a17Btn = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_btnA17`);

            if (uiState.isA17Mode) {
                // 退出 A17 模式
                uiState.isA17Mode = false;
                [cite: 5]
                a17ModeState.isActive = false;
                [cite: 5]
                a17ModeState.selectedUnits.clear();
                [cite: 5] // 清除選中的單位
                uiState.a17UnitButtonsContainer.style.display = 'none';
                [cite: 5]
                a17TextControls.style.display = 'none';
                [cite: 5]
                a17Btn.classList.remove('highlighted'); // 移除高亮
                a17Btn.style.boxShadow = `0 4px 8px rgba(0,0,0,0.1)`; // 恢復預設陰影

                renderNormalModeUI();
                [cite: 5]
                populateTableRows(getOriginalQueryResults());
                [cite: 5]
                displaySystemNotification('已退出A17作業模式', false);
                [cite: 5]
            } else {
                // 進入 A17 模式
                if (!forceEnter && !csvImportState.isA17CsvPrepared) {
                    [cite: 5]
                    displaySystemNotification('請先透過「匯入CSV/TXT」按鈕選擇「勾選CSV欄位供A17合併」並完成設定。或長按「A17作業」按鈕強制進入。', true, 6000);
                    [cite: 5]
                    return;
                }

                uiState.isA17Mode = true;
                [cite: 5]
                a17ModeState.isActive = true;
                [cite: 5]
                uiState.a17UnitButtonsContainer.style.display = 'flex';
                [cite: 5]
                a17TextControls.style.display = 'flex';
                [cite: 5]
                a17Btn.classList.add('highlighted'); // 高亮 A17 按鈕
                a17Btn.style.boxShadow = `0 0 0 2px white, 0 0 0 4px ${COLOR_PALETTE.PURPLE}`; // 增加邊框陰影效果
                a17Btn.style.transform = 'scale(1.03)'; // 進入模式時輕微放大

                if (forceEnter && !csvImportState.isA17CsvPrepared) {
                    [cite: 5]
                    // 長按強制進入，沒有 CSV 數據，則使用原始 API 數據作為基礎
                    const processedData = getOriginalQueryResults().map(row => {
                        [cite: 5]
                        const newRow = {};
                        [cite: 5]
                        newRow[FIELD_DISPLAY_NAMES_MAP._queriedValue_] = row[FIELD_DISPLAY_NAMES_MAP._queriedValue_];
                        [cite: 5]
                        newRow[FIELD_DISPLAY_NAMES_MAP.NO] = row[FIELD_DISPLAY_NAMES_MAP.NO];
                        [cite: 5]
                        ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                            [cite: 5]
                            const displayName = FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey;
                            [cite: 5]
                            if (row.hasOwnProperty(displayName)) {
                                [cite: 5]
                                newRow[displayName] = row[displayName];
                                [cite: 5]
                            }
                        });
                        newRow[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = row[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus];
                        [cite: 5]
                        return newRow;
                        [cite: 5]
                    });
                    DataStore.setBaseA17MasterData(processedData);
                    [cite: 5]
                } else {
                    // 使用 CSV 和 API 數據進行合併
                    const mergedData = [];
                    [cite: 5]
                    const keyCsvHeader = csvImportState.rawHeaders.find(h => h.includes('送金單'));
                    [cite: 5] // 假設送金單是 CSV 中的關鍵字
                    const keyCsvIndex = keyCsvHeader ? csvImportState.rawHeaders.indexOf(keyCsvHeader) : (csvImportState.rawHeaders.length > 0 ? 0 : -1);
                    [cite: 5]

                    csvImportState.rawData.forEach((csvRowData, index) => {
                        [cite: 5]
                        let mergedRow = {};
                        [cite: 5]
                        mergedRow[FIELD_DISPLAY_NAMES_MAP.NO] = String(index + 1);
                        [cite: 5]

                        // 導入選定的 CSV 欄位
                        csvImportState.selectedColsForA17Merge.forEach(selectedCsvHeader => {
                            [cite: 5]
                            const originalCsvIndex = csvImportState.rawHeaders.indexOf(selectedCsvHeader);
                            [cite: 5]
                            if (originalCsvIndex !== -1) {
                                [cite: 5]
                                mergedRow[selectedCsvHeader] = csvRowData[originalCsvIndex];
                                [cite: 5]
                            }
                        });

                        // 嘗試匹配 API 數據
                        const csvKeyValue = (keyCsvIndex !== -1) ? csvRowData[keyCsvIndex] : null;
                        [cite: 5]
                        let apiFound = false;
                        [cite: 5]
                        if (csvKeyValue) {
                            [cite: 5]
                            const matchingApiRow = getOriginalQueryResults().find(apiRow => [cite: 5]
                                (apiRow[FIELD_DISPLAY_NAMES_MAP.receiptNumber] === csvKeyValue || apiRow[FIELD_DISPLAY_NAMES_MAP._queriedValue_] === csvKeyValue)[cite: 5]
                            );

                            if (matchingApiRow) {
                                [cite: 5]
                                apiFound = true;
                                [cite: 5]
                                ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                                    [cite: 5]
                                    const displayName = FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey;
                                    [cite: 5]
                                    // 只有當 CSV 中沒有該欄位時，才從 API 數據填充
                                    if (!mergedRow.hasOwnProperty(displayName) && matchingApiRow.hasOwnProperty(displayName)) {
                                        [cite: 5]
                                        mergedRow[displayName] = matchingApiRow[displayName];
                                        [cite: 5]
                                    }
                                });
                                // API 查詢狀態
                                mergedRow[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = matchingApiRow[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] || '✔️ 成功';
                                [cite: 5]
                            }
                        }

                        if (!apiFound) {
                            [cite: 5]
                            // 如果沒有匹配到 API 數據，則相關欄位填寫 '-'
                            ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                                [cite: 5]
                                const displayName = FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey;
                                [cite: 5]
                                if (!mergedRow.hasOwnProperty(displayName)) {
                                    [cite: 5]
                                    mergedRow[displayName] = '-';
                                    [cite: 5]
                                }
                            });
                            mergedRow[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = '➖ 無對應API資料';
                            [cite: 5]
                        }
                        mergedData.push(mergedRow);
                        [cite: 5]
                    });
                    DataStore.setBaseA17MasterData(mergedData);
                    [cite: 5]
                }

                renderA17ModeUI();
                [cite: 5]
                populateTableRows(getBaseA17MasterData());
                [cite: 5]
                createA17UnitButtons();
                [cite: 5] // 重新創建 A17 單位篩選按鈕
                updateA17UnitButtonCounts();
                [cite: 5] // 更新計數
                displaySystemNotification('已進入A17作業模式', false);
                [cite: 5]
            }
        }

        /**
         * 渲染正常查詢模式下的表格標頭。
         */
        function renderNormalModeUI() {
            let headers = [FIELD_DISPLAY_NAMES_MAP._queriedValue_, FIELD_DISPLAY_NAMES_MAP.NO];
            [cite: 5]
            ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                [cite: 5]
                headers.push(FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey);
                [cite: 5]
            });
            headers.push(FIELD_DISPLAY_NAMES_MAP._apiQueryStatus);
            [cite: 5]
            renderTableHeaders(headers);
            [cite: 5]
        }

        /**
         * 渲染 A17 模式下的表格標頭。
         */
        function renderA17ModeUI() {
            let headers = [];
            [cite: 5]
            if (csvImportState.isA17CsvPrepared && csvImportState.selectedColsForA17Merge.length > 0) {
                [cite: 5]
                // 如果是 CSV 導入模式，則優先顯示 CSV 選中的欄位
                csvImportState.selectedColsForA17Merge.forEach(csvHeader => {
                    [cite: 5]
                    if (!headers.includes(csvHeader)) {
                        [cite: 5]
                        headers.push(csvHeader);
                        [cite: 5]
                    }
                });
                // 再添加 API 的核心欄位，避免重複
                ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                    [cite: 5]
                    const displayName = FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey;
                    [cite: 5]
                    if (!headers.includes(displayName)) {
                        [cite: 5]
                        headers.push(displayName);
                        [cite: 5]
                    }
                });
            } else {
                // 如果是強制進入 A17 模式，或沒有 CSV 數據，則顯示常規 API 查詢的欄位
                headers.push(FIELD_DISPLAY_NAMES_MAP._queriedValue_);
                [cite: 5]
                headers.push(FIELD_DISPLAY_NAMES_MAP.NO);
                [cite: 5]
                ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(apiKey => {
                    [cite: 5]
                    headers.push(FIELD_DISPLAY_NAMES_MAP[apiKey] || apiKey);
                    [cite: 5]
                });
            }

            // 最後添加查詢狀態欄位
            if (!headers.includes(FIELD_DISPLAY_NAMES_MAP._apiQueryStatus)) {
                [cite: 5]
                headers.push(FIELD_DISPLAY_NAMES_MAP._apiQueryStatus);
                [cite: 5]
            }
            renderTableHeaders(headers);
            [cite: 5]
        }


        /**
         * 創建 A17 單位篩選按鈕。
         */
        function createA17UnitButtons() {
            uiState.a17UnitButtonsContainer.innerHTML = '';
            [cite: 5]
            Constants.A17_UNIT_BUTTONS_DEFS.forEach(unitDef => {
                [cite: 5]
                const btn = document.createElement('button');
                btn.dataset.unitId = unitDef.id;
                [cite: 5]
                btn.textContent = `${unitDef.label} (0)`;
                [cite: 5] // 初始計數為 0
                btn.className = `qt-card-btn`; // 使用統一的卡片按鈕樣式
                btn.style.backgroundColor = unitDef.color;
                [cite: 5]
                btn.style.color = 'white';
                [cite: 5]
                btn.style.marginLeft = '0'; // 覆蓋通用樣式
                btn.style.padding = '6px 10px';
                [cite: 5]
                btn.style.fontSize = '12px';
                [cite: 5]
                btn.style.minWidth = '85px'; // 讓按鈕大小更一致
                btn.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`; // 預設陰影
                btn.style.transform = 'none'; // 覆蓋 hover 效果

                btn.onmouseover = () => { // 自定義 hover
                    if (!btn.classList.contains('highlighted')) {
                        btn.style.transform = 'translateY(-2px)';
                        btn.style.boxShadow = `0 4px 8px rgba(0,0,0,0.2)`;
                    }
                };
                btn.onmouseout = () => { // 自定義 mouseout
                    if (!btn.classList.contains('highlighted')) {
                        btn.style.transform = 'none';
                        btn.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`;
                    }
                };
                btn.onmousedown = () => {
                    btn.style.transform = 'translateY(0) scale(0.98)';
                    btn.style.boxShadow = `0 1px 2px rgba(0,0,0,0.15)`;
                };
                btn.onmouseup = () => {
                    if (!btn.classList.contains('highlighted')) {
                        btn.style.transform = 'translateY(-2px)';
                        btn.style.boxShadow = `0 4px 8px rgba(0,0,0,0.2)`;
                    }
                };


                btn.onclick = () => {
                    [cite: 5]
                    if (btn.classList.contains('disabled')) return;
                    [cite: 5] // 禁用狀態不可點擊
                    const unitId = btn.dataset.unitId;
                    [cite: 5]
                    if (a17ModeState.selectedUnits.has(unitId)) {
                        [cite: 5]
                        a17ModeState.selectedUnits.delete(unitId);
                        [cite: 5]
                        btn.classList.remove('highlighted');
                        [cite: 5]
                        btn.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`;
                        [cite: 5]
                        btn.style.transform = 'none';
                    } else {
                        a17ModeState.selectedUnits.add(unitId);
                        [cite: 5]
                        btn.classList.add('highlighted');
                        [cite: 5]
                        btn.style.boxShadow = `0 0 0 2px white, 0 0 0 4px ${unitDef.color}`; // 高亮邊框
                        btn.style.transform = 'scale(1.03)';
                    }
                    applyTableFilter();
                    [cite: 5]
                    displaySystemNotification(`已選擇 ${a17ModeState.selectedUnits.size} 個單位`, false, 1500);
                    [cite: 5]
                };
                uiState.a17UnitButtonsContainer.appendChild(btn);
                [cite: 5]
            });
        }

        /**
         * 更新 A17 單位篩選按鈕的計數。
         */
        function updateA17UnitButtonCounts() {
            if (!uiState.isA17Mode) return;
            [cite: 5]

            const unitCounts = {};
            [cite: 5]
            const dataToCount = getBaseA17MasterData();
            [cite: 5] // 總是基於所有 A17 數據進行計數

            dataToCount.forEach(row => {
                [cite: 5]
                const unitFull = String(row[FIELD_DISPLAY_NAMES_MAP.uwApproverUnit] || '');
                [cite: 5]
                let unitPrefix = 'UNDEF';
                [cite: 5] // 預設為查無單位

                for (const code in UNIT_CODE_MAPPINGS) {
                    [cite: 5]
                    if (unitFull.toUpperCase().startsWith(code)) {
                        [cite: 5]
                        unitPrefix = code;
                        [cite: 5]
                        break;
                        [cite: 5]
                    }
                }
                // 如果單位字串為空，也計入「查無單位」
                if (unitFull.trim() === '') {
                    [cite: 5]
                    unitPrefix = 'UNDEF';
                    [cite: 5]
                }
                unitCounts[unitPrefix] = (unitCounts[unitPrefix] || 0) + 1;
                [cite: 5]
            });

            uiState.a17UnitButtonsContainer.querySelectorAll('button').forEach(btn => {
                [cite: 5]
                const unitId = btn.dataset.unitId;
                [cite: 5]
                const count = unitCounts[unitId] || 0;
                [cite: 5]
                const unitDef = Constants.A17_UNIT_BUTTONS_DEFS.find(def => def.id === unitId);
                [cite: 5]

                if (unitDef) {
                    [cite: 5]
                    btn.textContent = `${unitDef.label} (${count})`;
                    [cite: 5]
                    if (count === 0) {
                        [cite: 5]
                        btn.classList.add('disabled');
                        [cite: 5]
                        btn.disabled = true;
                        [cite: 5]
                        btn.style.opacity = '0.6';
                        [cite: 5]
                        // 如果該單位被選中但計數為 0，則取消選中
                        if (a17ModeState.selectedUnits.has(unitId)) {
                            [cite: 5]
                            a17ModeState.selectedUnits.delete(unitId);
                            [cite: 5]
                            btn.classList.remove('highlighted');
                            [cite: 5]
                            btn.style.boxShadow = `0 2px 4px rgba(0,0,0,0.1)`;
                            [cite: 5]
                            btn.style.transform = 'none';
                        }
                    } else {
                        btn.classList.remove('disabled');
                        [cite: 5]
                        btn.disabled = false;
                        [cite: 5]
                        btn.style.opacity = '1';
                        [cite: 5]
                    }
                }
            });
        }

        /**
         * 處理複製表格數據到剪貼簿。
         */
        function handleCopyTable() {
            const dataToCopy = [];
            const rows = uiState.tableBodyElement.querySelectorAll('tr');
            rows.forEach(tr => {
                const rowData = {};
                tr.querySelectorAll('td').forEach((td, colIndex) => {
                    // 在編輯模式下，最後一欄是操作欄，不複製
                    if (uiState.isEditMode && colIndex === uiState.currentHeaders.length) return;
                    const headerKey = uiState.currentHeaders[colIndex];
                    rowData[headerKey] = td.textContent || td.innerText;
                });
                if (Object.keys(rowData).length > 0) {
                    dataToCopy.push(rowData);
                }
            });

            if (dataToCopy.length === 0) {
                displaySystemNotification('沒有資料可複製', true);
                return;
            }

            if (uiState.isA17Mode) {
                const includeText = uiState.mainUIElement.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_cbA17IncludeText`).checked;
                // 檢查 A17 文本設定對話框是否開啟，如果開啟則從預覽區獲取最新內容
                const previewDialog = document.getElementById(TOOL_MAIN_CONTAINER_ID + '_A17TextSettings_overlay');
                let customContentFromPreview = null;
                if (previewDialog && previewDialog.style.display === 'flex') {
                    const previewEl = previewDialog.querySelector('#qt-a17-preview');
                    if (previewEl) customContentFromPreview = previewEl.innerHTML;
                }
                A17Generator.generateAndCopyA17NotificationHTML(dataToCopy, uiState.currentHeaders, includeText, customContentFromPreview);
            } else {
                let tsvContent = uiState.currentHeaders.join('\t') + '\n';
                dataToCopy.forEach(row => {
                    const rowValues = uiState.currentHeaders.map(header =>
                        String(row[header] || '').replace(/\t/g, ' ').replace(/\n/g, ' ') // 移除 tab 和 newline
                    );
                    tsvContent += rowValues.join('\t') + '\n';
                });

                navigator.clipboard.writeText(tsvContent).then(() => {
                    displaySystemNotification(`已複製 ${dataToCopy.length} 筆資料 (TSV格式)`, false);
                }).catch(err => {
                    console.error('TSV複製失敗:', err);
                    displaySystemNotification('複製TSV失敗', true);
                });
            }
        }

        return {
            renderResultsTableUI,
            populateTableRows,
            updateSummaryCount,
            renderNormalModeUI,
            renderA17ModeUI,
            updateA17UnitButtonCounts,
            applyTableFilter,
            toggleEditMode, // 暴露給外部協調
            toggleA17Mode, // 暴露給外部協調
            handleClearConditions, // 暴露給外部協調
            handleCopyTable // 暴露給外部協調
        };
    })(Constants, UIManager, DataStore, Utils, Dialogs); // 確保 Dialogs 被傳入


    // --- A17 Generator Module ---
    // 目的: 專門處理 A17 報表的生成和複製邏輯。
    // 職責: 根據設定和表格數據生成 A17 郵件格式的 HTML 和純文本，並複製到剪貼簿。
    const A17Generator = (function(Constants, UIManager, DataStore, Utils) {
        const {
            FIELD_DISPLAY_NAMES_MAP,
            COLOR_PALETTE
        } = Constants;
        const {
            displaySystemNotification
        } = UIManager;
        const {
            a17ModeState
        } = DataStore;

        /**
         * 生成並複製 A17 通知郵件的 HTML 和純文本內容到剪貼簿。
         * @param {Array<Object>} data - 要包含在報表中的表格數據。
         * @param {string[]} headers - 表格的標頭。
         * @param {boolean} includeText - 是否包含 A17 通知文本。
         * @param {string|null} customPreviewContent - 來自預覽區的自定義內容，如果存在。
         */
        function generateAndCopyA17NotificationHTML(data, headers, includeText, customPreviewContent = null) {
            const s = a17ModeState.textSettings;
            const today = new Date();
            const genDate = new Date(today);
            genDate.setDate(today.getDate() + s.genDateOffset);
            const compDate = new Date(today);
            compDate.setDate(today.getDate() + s.compDateOffset);

            const genDateStr = Utils.formatDate(genDate);
            const compDateStr = Utils.formatDate(compDate);

            let textContentHtml = '';
            if (includeText) {
                if (customPreviewContent) {
                    textContentHtml = customPreviewContent; // 使用預覽區的 HTML
                } else {
                    // 參考舊版 A17B 的預設通知文 HTML 結構
                    textContentHtml = `
                        <div style="font-family:'Microsoft JhengHei',Arial,sans-serif;font-size:${s.mainFontSize}pt;line-height:${s.mainLineHeight};color:${s.mainFontColor};">
                            ${Utils.escapeHtml(s.mainContent).replace(/\n/g, '<br>')}
                            <br><br>
                            <p style="font-size:${s.dateFontSize}pt;line-height:${s.dateLineHeight};color:${s.dateFontColor};margin-top:${s.dateLineHeight > 1.2 ? '10px':'5px'};margin-bottom:${s.dateLineHeight > 1.2 ? '10px':'5px'};">
                                產檔時間：${genDateStr}<br>比對時間：${compDateStr}
                            </p>
                        </div>`;
                }
            }

            // 生成表格的 HTML (參考舊版 A17B 的表格樣式)
            const tableRowsHtml = data.map((row, idx) => `
                <tr style="background-color:${idx % 2 ? '#f8f9fa':'#ffffff'};">
                    ${headers.map(header => `
                        <td style="border:1px solid #dddddd;padding:5px 7px;text-align:center;font-size:10pt;color:#333333;white-space:normal;word-break:break-all;">
                            ${Utils.escapeHtml(row[header] || '')}
                        </td>`).join('')}
                </tr>`).join('');

            const tableHtml = `
                <table style="border-collapse:collapse;width:100%;margin-top:10px;font-family:'Microsoft JhengHei',Arial,sans-serif;font-size:10pt;">
                    <thead>
                        <tr style="background-color:#343a40;color:white;font-weight:bold;">
                            ${headers.map(header => `
                                <th style="border:1px solid #23272b;padding:6px 8px;text-align:center;">
                                    ${Utils.escapeHtml(header)}
                                </th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>`;

            const finalHtml = textContentHtml + tableHtml;

            // 準備純文本內容，用於 ClipboardItem 的 fallback 或純文本複製 (參考舊版 A17B)
            const plainTextForClipboard = (includeText ? (customPreviewContent ? new DOMParser().parseFromString(customPreviewContent, "text/html").body.textContent : s.mainContent) +
                    `\n\n產檔時間：${genDateStr}\n比對時間：${compDateStr}\n\n` : '') +
                headers.join('\t') + '\n' +
                data.map(r => headers.map(h => String(r[h] || '')).join('\t')).join('\n');

            try {
                // 使用 ClipboardItem 複製 HTML 和純文本 (參考舊版 A17B)
                const blobHtml = new Blob([finalHtml], {
                    type: 'text/html'
                });
                const blobText = new Blob([plainTextForClipboard], {
                    type: 'text/plain'
                });

                navigator.clipboard.write([new ClipboardItem({
                        'text/html': blobHtml,
                        'text/plain': blobText
                    })])
                    .then(() => displaySystemNotification('A17通知已複製 (HTML格式)', false))
                    .catch(err => {
                        console.error('HTML Clipboard API 失敗:', err);
                        // 降級到純文本複製
                        navigator.clipboard.writeText(plainTextForClipboard)
                            .then(() => displaySystemNotification('A17通知已複製 (純文字)', false))
                            .catch(txtErr => displaySystemNotification('複製失敗', true));
                    });
            } catch (e) {
                console.error('ClipboardItem API 不可用:', e);
                // 降級到純文本複製
                navigator.clipboard.writeText(plainTextForClipboard)
                    .then(() => displaySystemNotification('A17通知已複製 (純文字)', false))
                    .catch(txtErr => displaySystemNotification('複製失敗', true));
            }
        }

        return {
            renderResultsTableUI,
            populateTableRows,
            updateSummaryCount,
            renderNormalModeUI,
            renderA17ModeUI,
            updateA17UnitButtonCounts,
            applyTableFilter,
            toggleEditMode, // 暴露給外部協調
            toggleA17Mode, // 暴露給外部協調
            handleClearConditions, // 暴露給外部協調
            handleCopyTable // 暴露給外部協調
        };
    })(Constants, UIManager, DataStore, Utils, Dialogs); // 確保 Dialogs 被傳入


    // --- Main Application Module (App) ---
    // 目的: 作為應用程式的入口點和協調器，負責啟動流程和模組間的協調。
    // 職責: 初始化、處理整體流程，並在適當的時機調用其他模組的功能。
    const App = (function(Constants, UIManager, DataStore, ApiService, Dialogs, TableRenderer, Utils) { // <--- 這裡要確保 Utils 被傳入
        const {
            API,
            TOOL_MAIN_CONTAINER_ID,
            FIELD_DISPLAY_NAMES_MAP,
            ALL_DISPLAY_FIELDS_API_KEYS_MAIN,
            UNIT_CODE_MAPPINGS,
            UNIT_MAP_FIELD_API_KEY,
            COLOR_PALETTE
        } = Constants; // <--- 確保 COLOR_PALETTE 在這裡被解構
        const {
            displaySystemNotification
        } = UIManager;
        const {
            setCurrentApiUrl,
            setApiAuthToken,
            getApiAuthToken,
            getOriginalQueryResults,
            setOriginalQueryResults,
            loadA17TextSettings,
            setSelectedQueryDefinition
        } = DataStore;
        const {
            escapeHtml,
            extractName,
            getFirstLetter
        } = Utils; // 這裡引用 Utils 函式

        /**
         * 初始化應用程式，檢查並清理舊的 UI 元素，載入設定，然後啟動查詢工具。
         */
        function init() {
            // 清理可能殘留的舊 UI 元素和 overlay
            document.getElementById(TOOL_MAIN_CONTAINER_ID)?.remove();
            ['EnvSelect', 'Token', 'QuerySetup', 'A17TextSettings', 'Loading', 'CSVPurpose', 'CSVColSelect', 'CSVCheckbox'].forEach(suffix => {
                const el = document.getElementById(TOOL_MAIN_CONTAINER_ID + '_' + suffix + '_overlay');
                if (el) el.remove();
            });
            document.getElementById(TOOL_MAIN_CONTAINER_ID + '_Notification')?.remove(); // 移除舊的通知框

            loadA17TextSettings(); // 載入 A17 文本設定
            executeCaseQueryTool(); // 啟動主流程
        }

        /**
         * 執行案件查詢工具的核心流程。
         */
        async function executeCaseQueryTool() {
            if (document.getElementById(TOOL_MAIN_CONTAINER_ID)) {
                displaySystemNotification('查詢工具已開啟', true);
                return;
            }

            // 1. 環境選擇
            const selectedEnv = await Dialogs.createEnvSelectionDialog();
            if (!selectedEnv) {
                displaySystemNotification('操作已取消', true);
                return;
            }
            setCurrentApiUrl(selectedEnv === 'prod' ? API.URL_PROD : API.URL_UAT);
            displaySystemNotification(`環境: ${selectedEnv === 'prod' ? '正式' : '測試'}`, false);

            // 2. Token 驗證 (如果沒有 Token 或 Token 無效)
            let tokenIsValid = false;
            if (getApiAuthToken()) {
                tokenIsValid = true; // 如果本地有 Token，先假設有效
            }

            let tokenAttempt = 0; // 嘗試次數
            while (!tokenIsValid && tokenAttempt < 3) { // 最多嘗試 3 次 Token
                const tokenResult = await Dialogs.createTokenDialog(tokenAttempt + 1);
                if (tokenResult === '_close_tool_') {
                    displaySystemNotification('工具已關閉', false);
                    return;
                }
                if (tokenResult === '_skip_token_') {
                    setApiAuthToken(null); // 略過 Token，將 Token 設為 null
                    displaySystemNotification('已略過Token輸入', false);
                    tokenIsValid = true; // 視為已處理，繼續流程
                    break;
                }
                if (tokenResult === '_token_dialog_cancel_') {
                    displaySystemNotification('Token輸入已取消', true);
                    return;
                }
                if (tokenResult && tokenResult.trim() !== '') {
                    setApiAuthToken(tokenResult.trim()); // 設定 Token
                    // 這裡可以再加一個實際驗證 Token 的 API 呼叫，但為簡化流程，暫時假設輸入即有效
                    tokenIsValid = true;
                    displaySystemNotification('Token已設定', false);
                    break;
                } else {
                    if (tokenAttempt < 2) { // 最後一次輸入失敗就不再提示輸入為空
                        displaySystemNotification('Token未輸入', true);
                    }
                }
                tokenAttempt++;
            }

            if (!tokenIsValid && tokenAttempt === 3) { // 超過嘗試次數仍無有效 Token
                displaySystemNotification('多次Token輸入失敗，工具已終止。', true, 5000);
                return;
            }


            // 3. 查詢條件設定
            const querySetupResult = await Dialogs.createQuerySetupDialog();
            if (!querySetupResult) {
                displaySystemNotification('操作已取消', true);
                return;
            }

            setSelectedQueryDefinition(Constants.QUERYABLE_FIELD_DEFINITIONS.find(qdf => qdf.queryApiKey === querySetupResult.selectedApiKey));
            const queryValues = querySetupResult.queryValues.split(/[\s,;\n]+/).map(x => x.trim().toUpperCase()).filter(Boolean);

            if (queryValues.length === 0 && !DataStore.csvImportState.isA17CsvPrepared) {
                displaySystemNotification('未輸入有效查詢值或未準備A17 CSV', true);
                return;
            }

            // 4. 顯示加載中對話框
            const loadingDialog = UIManager.createDialogBase('_Loading', `
                <h3 class="qt-dialog-title" id="${TOOL_MAIN_CONTAINER_ID}_LoadingTitle">查詢中...</h3>
                <p id="${TOOL_MAIN_CONTAINER_ID}_LoadingMsg" style="text-align:center;font-size:14px;color:${COLOR_PALETTE.TEXT_MUTED};">處理中...</p>
                <div style="width:50px;height:50px;border:5px solid #f3f3f3;border-top:5px solid ${COLOR_PALETTE.PRIMARY};border-radius:50%;margin:20px auto;animation:qtSpin 1s linear infinite;"></div>
                <style>@keyframes qtSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            `, '300px', 'auto', 'text-align:center;');
            const loadingTitleEl = loadingDialog.dialog.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_LoadingTitle`);
            const loadingMsgEl = loadingDialog.dialog.querySelector(`#${TOOL_MAIN_CONTAINER_ID}_LoadingMsg`);

            // 5. 執行 API 查詢並處理結果
            setOriginalQueryResults([]); // 清空上次查詢結果

            let currentQueryCount = 0;
            // 如果是 A17 CSV 模式，查詢值來自 CSV
            const valuesToQuery = DataStore.csvImportState.isA17CsvPrepared && DataStore.csvImportState.selectedColForQueryName ?
                Array.from(new Set(DataStore.csvImportState.rawData.map(row => {
                    const colIndex = DataStore.csvImportState.rawHeaders.indexOf(DataStore.csvImportState.selectedColForQueryName);
                    return colIndex !== -1 ? row[colIndex] : '';
                }).filter(Boolean))) : queryValues;


            for (const singleQueryValue of valuesToQuery) {
                currentQueryCount++;
                if (loadingTitleEl) loadingTitleEl.textContent = `查詢中 (${currentQueryCount}/${valuesToQuery.length})`;
                if (loadingMsgEl) loadingMsgEl.textContent = `正在處理: ${singleQueryValue}`;

                const resultRowBase = {
                    [FIELD_DISPLAY_NAMES_MAP.NO]: String(currentQueryCount),
                    [FIELD_DISPLAY_NAMES_MAP._queriedValue_]: singleQueryValue
                };

                const apiResult = await ApiService.performApiQuery(singleQueryValue, DataStore.getSelectedQueryDefinition().queryApiKey);

                let apiQueryStatusText = '❌ 查詢失敗';

                if (apiResult.error === 'token_invalid') {
                    apiQueryStatusText = '❌ TOKEN失效';
                    loadingDialog.remove(); // 關閉進度對話框
                    displaySystemNotification('Token已失效或無效，請重新設定Token後再次查詢。', true, 5000);
                    return; // 中斷後續查詢
                } else if (apiResult.success) {
                    apiQueryStatusText = '✔️ 成功';
                } else if (!apiResult.error) { // 數據為空但 API 請求成功的情況
                    apiQueryStatusText = '➖ 查無資料';
                }
                resultRowBase[FIELD_DISPLAY_NAMES_MAP._apiQueryStatus] = apiQueryStatusText;

                if (apiResult.success && apiResult.data.records) {
                    apiResult.data.records.forEach(rec => {
                        const populatedRow = {
                            ...resultRowBase
                        };
                        ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                            const displayName = FIELD_DISPLAY_NAMES_MAP[dKey] || dKey;
                            let cellValue = rec[dKey] === null || rec[dKey] === undefined ? '' : String(rec[dKey]);

                            if (dKey === 'statusCombined') {
                                const mainS = rec['mainStatus'] || '';
                                const subS = rec['subStatus'] || '';
                                populatedRow[displayName] = `
                                    <span style="font-weight:bold;">${escapeHtml(mainS)}</span>
                                    ${subS ? ` <span style="color:${COLOR_PALETTE.TEXT_MUTED};">(${escapeHtml(subS)})</span>` : ''}
                                `;
                            } else if (dKey === UNIT_MAP_FIELD_API_KEY) {
                                const unitCodePrefix = getFirstLetter(cellValue);
                                const mappedUnitName = UNIT_CODE_MAPPINGS[unitCodePrefix] || cellValue;
                                populatedRow[displayName] = unitCodePrefix && UNIT_CODE_MAPPINGS[unitCodePrefix] ?
                                    `${unitCodePrefix}-${mappedUnitName.replace(/^[A-Z]-/, '')}` : mappedUnitName;
                            } else if (dKey === 'uwApprover' || dKey === 'approvalUser') {
                                populatedRow[displayName] = extractName(cellValue);
                            } else {
                                populatedRow[displayName] = cellValue;
                            }
                        });
                        getOriginalQueryResults().push(populatedRow); // 將處理後的數據添加到原始結果中
                    });
                } else {
                    // 如果查詢失敗或無資料，填充預設空值
                    ALL_DISPLAY_FIELDS_API_KEYS_MAIN.forEach(dKey => {
                        resultRowBase[FIELD_DISPLAY_NAMES_MAP[dKey] || dKey] = '-';
                    });
                    getOriginalQueryResults().push(resultRowBase);
                }
            }

            loadingDialog.remove(); // 移除加載中對話框

            // 依序號排序最終結果
            if (getOriginalQueryResults().length > 0) {
                getOriginalQueryResults().sort((a, b) => (parseInt(a[FIELD_DISPLAY_NAMES_MAP.NO]) || 0) - (parseInt(b[FIELD_DISPLAY_NAMES_MAP.NO]) || 0));
            }

            // 重置 A17/編輯模式狀態
            DataStore.uiState.isA17Mode = false;
            DataStore.a17ModeState.isActive = false;
            DataStore.uiState.isEditMode = false;

            // 渲染結果表格
            TableRenderer.renderResultsTableUI(getOriginalQueryResults());
            displaySystemNotification(`查詢完成！共處理 ${valuesToQuery.length} 個查詢值，獲取 ${getOriginalQueryResults().length} 筆資料`, false, 3500);
        }

        return {
            init,
            executeCaseQueryTool
        };
    })(Constants, UIManager, DataStore, ApiService, Dialogs, TableRenderer, Utils); // <--- 這裡要確保 Utils 被傳遞

    // 立即執行 App 模組的初始化函式
    App.init();

})();