(function() {
    'use strict';

    // ============================================================================
    // 核心常數與配置
    // 使用 Object.freeze 確保常數不可變，提供單一真值來源
    // ============================================================================
    const AppConstants = Object.freeze({
        // 工具主體 DOM ID (僅在需要創建根元素時使用，這裡主要用於 CSS 隔離)
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '3.8.0', // 最新版本號，已修正日期格式

        // 查詢模式枚舉，增加可讀性與維護性
        QUERY_MODES: {
            PLAN_CODE: 'planCode', // 商品代碼
            PLAN_NAME: 'planCodeName', // 商品關鍵字
            ALL_MASTER_PLANS: 'allMasterPlans', // 查詢全部主檔
            MASTER_IN_SALE: 'masterInSale', // 主檔現售
            MASTER_STOPPED: 'masterStopped', // 主檔停售
            CHANNEL_IN_SALE: 'channelInSale', // 通路現售
            CHANNEL_STOPPED: 'channelStopped' // 通路停售
        },

        // API 端點
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
        },

        // 銷售狀態定義，用於 UI 顯示和邏輯判斷
        SALE_STATUS: {
            CURRENT: '現售中',
            STOPPED: '停售',
            PENDING: '未開始',
            ABNORMAL: '日期異常' // 新增的狀態
        },

        // 欄位轉換定義
        FIELD_MAPS: {
            CURRENCY: {
                '1': 'TWD',
                '2': 'USD',
                '3': 'AUD',
                '4': 'CNT',
                '5': 'USD_OIU',
                '6': 'EUR',
                '7': 'JPY'
            },
            UNIT: {
                'A1': '元',
                'A3': '仟元',
                'A4': '萬元',
                'B1': '計畫',
                'C1': '單位'
            },
            COVERAGE_TYPE: {
                'M': '主約',
                'R': '附約'
            },
            CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC'] // 固定通路代碼
        },

        // 通用 API 請求參數
        DEFAULT_QUERY_PARAMS: {
            PAGE_SIZE_MASTER: 1000, // 主檔查詢較大 pageSize
            PAGE_SIZE_CHANNEL: 1000, // 通路查詢較大 pageSize
            PAGE_SIZE_DETAIL: 20, // 詳情查詢 pageSize
            PAGE_SIZE_TABLE: 50 // 表格每頁顯示數量
        }
    });

    // ============================================================================
    // UIManager 模組 (統一管理所有 UI 相關操作和樣式注入)
    // 負責 Modal、Toast、按鈕、輸入框等視覺元素的創建、顯示、隱藏和樣式應用
    // ============================================================================
    const UIManager = (function() {
        let currentModal = null;
        let toastTimeoutId = null;

        // 內部 CSS 樣式字符串 - 整合您的原始碼、我的優化及 RWD
        const INTERNAL_STYLES = `
            /* ============================================================================
             * 全域樣式設定 (Flat Design & WCAG AA)
             * ============================================================================ */
            :root {
                --primary-color: #4A90E2; /* 較亮的藍色 */
                --primary-dark-color: #357ABD; /* primary-color 的深色版本 */
                --secondary-color: #6C757D; /* 次要按鈕、一般文字灰 */
                --secondary-dark-color: #5A6268;
                --success-color: #5CB85C; /* 成功提示 */
                --success-dark-color: #4CAE4C;
                --error-color: #D9534F; /* 錯誤提示 */
                --error-dark-color: #C9302C;
                --warning-color: #F0AD4E; /* 警告提示 (特殊狀態) */
                --warning-dark-color: #EC971F;
                --info-color: #5BC0DE; /* 資訊提示 */
                --info-dark-color: #46B8DA;

                --background-light: #F8F8F8; /* 輕量背景色 */
                --surface-color: #FFFFFF; /* 卡片、彈窗表面色 */
                --border-color: #E0E0E0; /* 邊框色 */
                --text-color-dark: #333333; /* 主要文字顏色 */
                --text-color-light: #666666; /* 次要文字顏色 */

                --box-shadow-light: rgba(0, 0, 0, 0.08); /* 輕微陰影 */
                --box-shadow-medium: rgba(0, 0, 0, 0.15); /* 中等陰影 */
                --box-shadow-strong: rgba(0, 0, 0, 0.3); /* 強烈陰影 */
                --border-radius-base: 6px;
                --border-radius-lg: 10px;
                --transition-speed: 0.25s;
            }

            /* Reset for the tool elements to prevent interference with host page styles */
            #${AppConstants.TOOL_ID} *, #${AppConstants.TOOL_ID} *:before, #${AppConstants.TOOL_ID} *:after {
                box-sizing: border-box;
            }
            #${AppConstants.TOOL_ID} {
                /* Add a root font-size for better scaling in RWD */
                font-size: 16px;
            }

            /* ============================================================================
             * Modal 彈窗樣式 (基於您的原始碼並優化)
             * ============================================================================ */
            .pct-modal-mask {
                position: fixed;
                z-index: 9999;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.18);
                opacity: 0;
                transition: opacity var(--transition-speed) ease-out;
            }
            .pct-modal-mask.show { opacity: 1; }

            .pct-modal {
                font-family: 'Microsoft JhengHei', 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
                background: var(--surface-color);
                border-radius: var(--border-radius-lg);
                box-shadow: 0 4px 24px var(--box-shadow-strong);
                padding: 0;
                min-width: 410px;
                max-width: 95vw;
                position: fixed;
                top: 60px; /* 依照您的要求，固定在頂部偏下 */
                left: 50%;
                transform: translateX(-50%) translateY(-20px); /* 初始 slightly up for animation */
                opacity: 0;
                z-index: 10000;
                transition: all var(--transition-speed) cubic-bezier(0.25, 0.8, 0.25, 1); /* Springy transition */
                display: flex;
                flex-direction: column;
            }
            .pct-modal.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            .pct-modal-header {
                padding: 16px 20px 8px 20px;
                font-size: 20px;
                font-weight: bold;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-color-dark);
            }

            .pct-modal-body {
                padding: 16px 20px 8px 20px;
                flex-grow: 1; /* Allow body to expand */
                overflow-y: auto; /* Enable scrolling if content is too long */
                min-height: 50px; /* Prevent body from collapsing */
            }

            .pct-modal-footer {
                padding: 12px 20px 16px 20px;
                text-align: right; /* Maintain right alignment for buttons */
                border-top: 1px solid var(--border-color);
                display: flex; /* Flexbox for button layout */
                justify-content: flex-end; /* Align buttons to the right */
                gap: 10px; /* Spacing between buttons */
                flex-wrap: wrap; /* Allow wrapping on small screens */
            }

            /* ============================================================================
             * 按鈕樣式 (優化您的 pct-btn)
             * ============================================================================ */
            .pct-btn {
                display: inline-flex; /* Use flex for centering text */
                align-items: center;
                justify-content: center;
                margin: 0; /* Remove default margin */
                padding: 8px 18px;
                font-size: 15px;
                border-radius: var(--border-radius-base);
                border: none;
                background: var(--primary-color);
                color: #fff;
                cursor: pointer;
                transition: background var(--transition-speed), transform var(--transition-speed), box-shadow var(--transition-speed);
                font-weight: 600;
                box-shadow: 0 2px 5px var(--box-shadow-light);
                white-space: nowrap; /* Prevent button text wrapping */
            }
            .pct-btn:hover {
                background: var(--primary-dark-color);
                transform: translateY(-1px) scale(1.01);
                box-shadow: 0 4px 8px var(--box-shadow-medium);
            }
            .pct-btn:active {
                transform: translateY(0);
                box-shadow: 0 1px 3px var(--box-shadow-light);
            }
            .pct-btn:disabled {
                background: #CED4DA; /* 禁用狀態的顏色 */
                color: #A0A0A0;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .pct-btn-secondary {
                background: var(--secondary-color);
                color: #fff;
            }
            .pct-btn-secondary:hover { background: var(--secondary-dark-color); }

            /* 特殊按鈕顏色 (一鍵查詳情, 一鍵複製) */
            .pct-btn-info { background: var(--info-color); }
            .pct-btn-info:hover { background: var(--info-dark-color); }
            .pct-btn-success { background: var(--success-color); }
            .pct-btn-success:hover { background: var(--success-dark-color); }

            /* 篩選特殊狀態按鈕 */
            .pct-filter-btn {
                font-size: 14px;
                padding: 5px 12px;
                background: var(--warning-color);
                color: var(--text-color-dark);
                border: 1px solid var(--warning-dark-color);
                border-radius: 5px;
                cursor: pointer;
                transition: background .2s, transform .2s;
                font-weight: 600;
                box-shadow: 0 1px 3px var(--box-shadow-light);
                white-space: nowrap;
            }
            .pct-filter-btn:hover { background: var(--warning-dark-color); transform: translateY(-1px); }
            .pct-filter-btn-active { /* 篩選中狀態 */
                background: var(--warning-dark-color);
                color: white;
                box-shadow: 0 2px 6px rgba(240, 173, 78, 0.4);
            }
            .pct-filter-btn-active:hover { background: var(--warning-color); }


            /* ============================================================================
             * 輸入框與錯誤訊息
             * ============================================================================ */
            .pct-input {
                width: 100%;
                font-size: 16px;
                padding: 9px 12px; /* 增加內邊距 */
                border-radius: 5px;
                border: 1px solid var(--border-color);
                box-sizing: border-box;
                margin-top: 5px;
                transition: border-color var(--transition-speed), box-shadow var(--transition-speed);
            }
            .pct-input:focus {
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
                outline: none;
            }
            .pct-input:disabled {
                background: var(--background-light);
                color: var(--text-color-light);
                opacity: 0.7;
                cursor: not-allowed;
            }

            .pct-error {
                color: var(--error-color);
                font-size: 13px;
                margin: 8px 0 0 0;
                display: block;
            }
            .pct-label {
                font-weight: bold;
                color: var(--text-color-dark);
                display: block; /* 確保佔一行 */
                margin-bottom: 5px;
            }
            .pct-form-group {
                margin-bottom: 20px;
            }

            /* ============================================================================
             * 查詢模式卡片 (五大卡片樣式)
             * ============================================================================ */
            .pct-mode-card-grid {
                display: grid;
                /* 使用 auto-fit 和 minmax 確保靈活的列數和均勻分佈 */
                grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
                gap: 10px;
                margin-bottom: 20px;
            }

            .pct-mode-card {
                background: var(--background-light);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-base);
                padding: 18px 10px; /* 增加垂直內邊距 */
                text-align: center;
                cursor: pointer;
                transition: all var(--transition-speed) ease-out;
                font-weight: 500;
                font-size: 15px; /* 調整字體大小 */
                color: var(--text-color-dark);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 65px; /* 最小高度確保一致性 */
                box-shadow: 0 2px 6px var(--box-shadow-light); /* 輕微陰影 */
            }
            .pct-mode-card:hover {
                border-color: var(--primary-color);
                transform: translateY(-3px) scale(1.02); /* 更明顯的 hover 效果 */
                box-shadow: 0 6px 15px rgba(74, 144, 226, 0.2); /* 藍色系陰影 */
            }
            .pct-mode-card.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
                transform: translateY(-1px);
                box-shadow: 0 4px 10px var(--primary-dark-color); /* 選中時較深的陰影 */
                font-weight: bold;
            }
            .pct-mode-card.selected:hover {
                background: var(--primary-dark-color); /* 確保 hover 效果依然有 */
            }

            /* 子選項按鈕 (主檔/通路現售停售) */
            .pct-sub-option-grid, .pct-channel-option-grid {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 10px;
                margin-bottom: 15px; /* 與下一個元素間距 */
            }
            .pct-sub-option, .pct-channel-option {
                background: var(--background-light);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-base);
                padding: 8px 15px;
                cursor: pointer;
                transition: all var(--transition-speed) ease-out;
                font-weight: 500;
                font-size: 14px;
                color: var(--text-color-dark);
                white-space: nowrap;
                display: inline-flex; /* 確保文字居中 */
                align-items: center;
                justify-content: center;
            }
            .pct-sub-option:hover, .pct-channel-option:hover {
                border-color: var(--primary-color);
                transform: translateY(-1px);
                box-shadow: 0 2px 6px var(--box-shadow-light);
            }
            .pct-sub-option.selected, .pct-channel-option.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
                transform: translateY(0);
                box-shadow: 0 1px 3px var(--primary-dark-color);
            }
            .pct-sub-option.selected:hover, .pct-channel-option.selected:hover {
                background: var(--primary-dark-color);
            }

            /* ============================================================================
             * 表格樣式 (基於您 planE.txt 的風格並優化)
             * ============================================================================ */
            .pct-table-wrap {
                max-height: 55vh; /* 調整表格最大高度以適應 Modal */
                overflow: auto; /* 僅表格內容滾動 */
                margin: 15px 0;
                /* 為了讓表格邊框清晰可見，為整個表格區域添加邊框 */
                border: 1px solid #ddd; /* 嚴格遵循 planE.txt 的 #ddd 邊框 */
                box-shadow: 0 2px 5px rgba(0,0,0,0.05); /* 微弱的整體陰影 */
                border-radius: var(--border-radius-base); /* 外部容器圓角 */
            }
            .pct-table {
                border-collapse: collapse; /* Collapse borders for continuous lines */
                width: 100%;
                font-size: 14px;
                background: var(--surface-color);
                min-width: 800px; /* 確保表格在窄屏下有滾動條 */
            }
            .pct-table th, .pct-table td {
                border: 1px solid #ddd; /* 嚴格遵循 planE.txt 的 #ddd 邊框 */
                padding: 8px 10px;
                text-align: left;
                vertical-align: top;
            }
            .pct-table th {
                background: #f8f8f8; /* 嚴格遵循 planE.txt 的 #f8f8f8 背景 */
                color: var(--text-color-dark);
                font-weight: bold;
                cursor: pointer;
                position: sticky;
                top: 0; /* Sticky header */
                z-index: 1;
                white-space: nowrap;
            }
            .pct-table th:hover { background: #e9ecef; } /* Lighter hover for headers */

            .pct-table tr.special-row {
                background: #fffde7; /* 嚴格遵循 planE.txt 的 #fffde7 背景 */
                border-left: 4px solid var(--warning-color); /* 添加左側標識條，優化視覺 */
            }
            .pct-table tr:hover { background: #e3f2fd; } /* 嚴格遵循 planE.txt 的 #e3f2fd hover */

            .pct-table td small {
                display: block;
                font-size: 11px;
                color: var(--text-color-light);
                margin-top: 2px;
            }

            /* 銷售狀態顏色 */
            .pct-status-onsale { color: #1976d2; font-weight: bold; } /* 嚴格遵循 planE.txt 的顏色 */
            .pct-status-offsale { color: #e53935; font-weight: bold; } /* 嚴格遵循 planE.txt 的顏色 */
            .pct-status-pending { color: var(--info-color); font-weight: bold; } /* 優化添加 */
            .pct-status-abnormal { color: #8A2BE2; font-weight: bold; } /* 日期異常狀態顏色：紫色 */

            /* ============================================================================
             * Toast 提示訊息 (優化您的 pct-toast)
             * ============================================================================ */
            .pct-toast {
                position: fixed;
                left: 50%;
                top: 30px;
                transform: translateX(-50%);
                background: var(--text-color-dark);
                color: #fff;
                padding: 10px 22px;
                border-radius: var(--border-radius-base);
                font-size: 16px;
                z-index: 10001;
                opacity: 0;
                pointer-events: none; /* 讓 Toast 不會阻擋點擊 */
                transition: opacity .3s, transform .3s;
                box-shadow: 0 4px 12px var(--box-shadow-medium);
                white-space: nowrap; /* Prevent Toast text wrapping */
            }
            .pct-toast.pct-toast-show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
                pointer-events: auto;
            }
            .pct-toast.success { background: var(--success-color); }
            .pct-toast.error { background: var(--error-color); }
            .pct-toast.warning { background: var(--warning-color); color: var(--text-color-dark); }
            .pct-toast.info { background: var(--info-color); }


            /* ============================================================================
             * 摘要與分頁 (優化您的 pct-summary)
             * ============================================================================ */
            .pct-summary {
                font-size: 15px;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                color: var(--text-color-dark);
            }
            .pct-summary b { color: var(--warning-color); }

            .pct-pagination {
                display: flex;
                /* 修正：justify-content: space-between 確保資訊在左，按鈕在右 */
                justify-content: space-between;
                align-items: center;
                gap: 10px; /* 按鈕間距 */
                margin-top: 15px;
                flex-wrap: wrap;
            }
            .pct-pagination-info {
                /* 移除 margin-right: auto; 因為 space-between 已經處理了 */
                font-size: 14px;
                color: var(--text-color-light);
                /* 確保在小螢幕上分頁資訊不會被按鈕擠壓 */
                flex-shrink: 0;
            }
            /* 調整分頁按鈕大小 */
            .pct-pagination .pct-btn {
                padding: 6px 12px;
                font-size: 13px;
            }
            /* 修正：為分頁按鈕組添加一個容器，以更好控制對齊 */
            .pct-pagination-controls-group {
                display: flex;
                gap: 8px; /* 分頁按鈕之間的間距 */
                flex-wrap: wrap;
                justify-content: flex-end; /* 確保分頁按鈕靠右對齊 */
            }


            /* ============================================================================
             * RWD Adjustments (響應式設計)
             * ============================================================================ */
            @media (max-width: 768px) {
                .pct-modal {
                    min-width: unset;
                    width: 98vw;
                    top: 20px; /* Adjust top for smaller screens */
                    max-height: 95vh;
                }
                .pct-modal-header {
                    font-size: 18px;
                    padding: 12px 15px 6px 15px;
                }
                .pct-modal-body {
                    padding: 12px 15px 6px 15px;
                }
                .pct-modal-footer {
                    flex-direction: column; /* Stack buttons vertically */
                    align-items: stretch; /* Stretch buttons to full width */
                    padding: 10px 15px 12px 15px;
                }
                .pct-btn, .pct-btn-secondary, .pct-btn-info, .pct-btn-success {
                    width: 100%; /* Full width buttons */
                    margin: 4px 0; /* Add vertical margin */
                    padding: 10px 15px;
                }
                .pct-mode-card-grid {
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 8px;
                }
                .pct-mode-card {
                    font-size: 13px;
                    padding: 10px 8px;
                    min-height: 45px;
                }
                .pct-input {
                    font-size: 14px;
                    padding: 8px 10px;
                }
                .pct-table-wrap {
                    max-height: 40vh; /* Adjust table height */
                    margin: 10px 0;
                }
                .pct-table th, .pct-table td {
                    padding: 6px 8px;
                    font-size: 12px;
                }
                .pct-toast {
                    top: 10px;
                    width: 90%;
                    left: 5%;
                    transform: translateX(0); /* Remove translateX for full width */
                    text-align: center;
                    white-space: normal; /* Allow toast text to wrap */
                }
                .pct-pagination {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                .pct-pagination-info {
                    width: 100%;
                    text-align: center;
                }
                .pct-pagination .pct-btn {
                    width: 100%;
                }
                /* 修正：在小螢幕下，功能按鈕組也應該堆疊 */
                .pct-pagination-controls-group {
                     flex-direction: column;
                     align-items: stretch;
                     width: 100%;
                }
            }
        `;

        // 注入樣式到 <head>
        function injectStyles() {
            const style = document.createElement('style');
            style.id = AppConstants.STYLE_ID;
            style.textContent = INTERNAL_STYLES; // Use textContent for security and clarity
            document.head.appendChild(style);
        }

        /**
         * 顯示一個通用彈窗 (Modal)
         * @param {Object} config - 配置物件
         * @param {string} config.title - 彈窗標題
         * @param {string} config.body - 彈窗內容 HTML 字串
         * @param {string} [config.footer=''] - 彈窗底部按鈕區塊 HTML 字串
         * @param {Function} [config.onOpen] - 彈窗打開後執行的回呼函式，用於事件綁定
         */
        function showModal({
            title,
            body,
            footer = '',
            onOpen
        }) {
            closeModal(); // 確保每次只顯示一個 Modal

            // 創建遮罩和 Modal 容器
            const mask = document.createElement('div');
            mask.className = 'pct-modal-mask';
            // 點擊遮罩關閉，但要避免點擊 Modal 內部也關閉
            mask.addEventListener('click', (e) => {
                if (e.target === mask) { // 確保只點擊遮罩本身時才關閉
                    closeModal();
                }
            });

            const modal = document.createElement('div');
            modal.className = 'pct-modal';
            modal.setAttribute('role', 'dialog'); // 增加無障礙屬性
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'pct-modal-title');


            modal.innerHTML = `
                <div class="pct-modal-header"><span id="pct-modal-title">${title}</span></div>
                <div class="pct-modal-body">${body}</div>
                <div class="pct-modal-footer">${footer}</div>
            `;

            document.body.appendChild(mask);
            document.body.appendChild(modal);

            currentModal = {
                mask,
                modal
            }; // 更新 currentModal 引用

            // 觸發顯示動畫
            setTimeout(() => {
                mask.classList.add('show');
                modal.classList.add('show');
            }, 10);

            // 綁定 ESC 鍵關閉 Modal
            // 關鍵：將 handleEsc 函數實例綁定到 currentModal，以便正確移除
            const handleEscInstance = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    // 不需要在這裡移除，因為 closeModal 內部會處理
                }
            };
            document.addEventListener('keydown', handleEscInstance);
            currentModal.handleEscListener = handleEscInstance; // 儲存引用

            // 執行 onOpen 回呼，用於綁定 Modal 內部元素的事件
            if (onOpen) setTimeout(() => onOpen(modal), 50); // 確保 DOM 已渲染
        }

        /**
         * 關閉當前顯示的 Modal，並返回一個 Promise，表示 Modal 已完全從 DOM 中移除。
         * @returns {Promise<void>}
         */
        function closeModal() {
            return new Promise(resolve => {
                if (currentModal) {
                    const modalElement = currentModal.modal;
                    const maskElement = currentModal.mask;
                    const escListener = currentModal.handleEscListener; // 獲取儲存的引用

                    modalElement.classList.remove('show');
                    maskElement.classList.remove('show');

                    // 監聽 transitionend 事件，確保動畫完成後才移除 DOM
                    const onTransitionEnd = () => {
                        if (modalElement.parentNode) modalElement.remove();
                        if (maskElement.parentNode) maskElement.remove();

                        // 移除鍵盤監聽器
                        if (escListener) {
                            document.removeEventListener('keydown', escListener);
                        }

                        currentModal = null; // 清理 currentModal 狀態
                        resolve(); // Modal 完全關閉後解決 Promise
                    };

                    // 添加事件監聽器，確保只觸發一次
                    modalElement.addEventListener('transitionend', onTransitionEnd, {
                        once: true
                    });

                    // Fallback: 如果 transitionend 沒有觸發 (例如動畫時間為 0 或元素被 display: none)
                    // 在一定時間後強制移除，防止 Modal 殘留
                    setTimeout(() => {
                        if (currentModal === null) return; // 如果已經被 transitionend 處理了，就跳過
                        onTransitionEnd(); // 强制執行清理
                    }, 300); // 這裡的 300ms 應略大於 CSS transition-speed
                } else {
                    resolve(); // 沒有 Modal 可關閉，直接解決 Promise
                }
            });
        }

        /**
         * 顯示一個浮動提示 (Toast)
         * @param {string} msg - 提示訊息
         * @param {'info'|'success'|'warning'|'error'} [type='info'] - 提示類型
         * @param {number} [duration=1800] - 顯示時間 (毫秒)
         */
        function showToast(msg, type = 'info', duration = 1800) {
            // 清除之前的 Toast 計時器，避免重複顯示
            if (toastTimeoutId) {
                clearTimeout(toastTimeoutId);
                const existingToast = document.getElementById('pct-toast');
                if (existingToast) {
                    existingToast.classList.remove('pct-toast-show');
                    // Ensure the old toast is removed before showing new one
                    existingToast.addEventListener('transitionend', () => existingToast.remove(), {
                        once: true
                    });
                }
            }

            let el = document.getElementById('pct-toast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'pct-toast';
                document.body.appendChild(el);
            }
            el.className = `pct-toast ${type}`; // 設置類型樣式
            el.textContent = msg;
            el.classList.add('pct-toast-show');

            toastTimeoutId = setTimeout(() => {
                el.classList.remove('pct-toast-show');
                el.addEventListener('transitionend', () => el.remove(), {
                    once: true
                });
            }, duration);
        }

        /**
         * 顯示表單驗證錯誤訊息
         * @param {string} msg - 錯誤訊息
         * @param {string} [elementId='pct-token-err'] - 顯示錯誤訊息的 DOM 元素 ID
         */
        function showError(msg, elementId = 'pct-token-err') {
            const el = document.getElementById(elementId);
            if (el) {
                el.textContent = msg;
                el.style.display = 'block'; // 確保顯示
            } else {
                showToast(msg, 'error'); // 如果找不到特定元素，則用 Toast 顯示
            }
        }

        /**
         * 隱藏表單驗證錯誤訊息
         * @param {string} [elementId='pct-token-err'] - 顯示錯誤訊息的 DOM 元素 ID
         */
        function hideError(elementId = 'pct-token-err') {
            const el = document.getElementById(elementId);
            if (el) {
                el.style.display = 'none';
                el.textContent = '';
            }
        }

        return {
            injectStyles,
            showModal,
            closeModal,
            showToast,
            showError,
            hideError
        };
    })();

    // ============================================================================
    // PlanCodeTool 模組 (主應用邏輯封裝)
    // ============================================================================
    const PlanCodeTool = {
        env: '',
        apiBase: '',
        token: '',
        tokenCheckEnabled: true, // 預設啟用 Token 檢查
        allData: [], // 經過處理後、用於表格渲染的數據
        allRaw: [], // 從 API 獲取的原始數據 (用於重新處理或備份)
        queryMode: '', // 當前查詢模式
        queryInput: '', // 當前查詢輸入 (如商品代碼、關鍵字)
        querySubOption: [], // 通路或主檔的子查詢選項 (e.g., 'current', 'stopped')
        queryChannels: [], // 通路查詢時選中的通路 (e.g., 'AG', 'BK')
        pageNo: 1,
        pageSize: AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE, // 表格每頁顯示數量
        totalRecords: 0,
        filterSpecial: false, // 是否篩選特殊狀態
        sortKey: '', // 當前排序的欄位
        sortAsc: true, // 排序方向 (true: 升序, false: 降序)
        cacheDetail: new Map(), // 詳情快取 (planCode -> polpln string)
        cacheChannel: new Map(), // 通路快取 (planCode -> array of channel objects)

        // ====== 啟動入口 ======
        async start() {
            this.env = this.detectEnv();
            this.apiBase = this.env === 'PROD' ?
                AppConstants.API_ENDPOINTS.PROD :
                AppConstants.API_ENDPOINTS.UAT;

            // 重置所有數據和狀態
            this.allData = [];
            this.allRaw = [];
            this.queryMode = '';
            this.queryInput = '';
            this.querySubOption = [];
            this.queryChannels = [];
            this.pageNo = 1;
            this.totalRecords = 0;
            this.filterSpecial = false;
            this.sortKey = '';
            this.sortAsc = true;
            this.cacheDetail.clear();
            this.cacheChannel.clear();

            UIManager.injectStyles(); // 確保樣式已注入

            // 優化後的 Token 檢核流程：
            this.token = localStorage.getItem('SSO-TOKEN') || ''; // 從本地儲存獲取 Token
            if (this.token && this.tokenCheckEnabled) { // 如果 Token 存在且啟用檢核
                UIManager.showToast('正在驗證 Token，請稍候...', 'info');
                const isValid = await this.verifyToken(this.token);
                if (isValid) {
                    UIManager.showToast('Token 驗證成功，已自動登入。', 'success');
                    // 直接進入查詢條件畫面即可，無需在此處關閉 Modal (因為還未顯示)。
                    this.showQueryDialog();
                    return; // 結束 start() 執行
                } else {
                    UIManager.showToast('Token 無效，請重新設定。', 'warning');
                    localStorage.removeItem('SSO-TOKEN'); // 無效 Token 移除
                    this.token = ''; // 清空記憶體中的 Token
                }
            }
            // Token 不存在，或 Token 無效，或不啟用檢核，才顯示 Token 彈窗
            this.showTokenDialog();
        },

        // ====== 環境自動判斷 ======
        detectEnv() {
            const host = window.location.host.toLowerCase();
            if (host.includes('uat') || host.includes('test') || host.includes('dev') || host.includes('stg')) {
                return 'UAT';
            }
            return 'PROD';
        },

        envLabel() {
            return this.env === 'PROD' ? '正式環境' : '測試環境';
        },

        // ====== Token 輸入與驗證流程 ======
        showTokenDialog() {
            UIManager.showModal({
                title: `商品查詢小工具（${this.envLabel()}）`,
                body: `
                    <div class="pct-form-group">
                        <label for="pct-token-input" class="pct-label">請輸入 SSO-TOKEN：</label>
                        <textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 SSO-TOKEN" autocomplete="off"></textarea>
                        <div class="pct-error" id="pct-token-err" style="display:none"></div>
                    </div>
                `,
                footer: `
                    <button class="pct-btn" id="pct-token-ok">確認</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過驗證</button>
                `,
                onOpen: (modalElement) => {
                    const tokenInput = modalElement.querySelector('#pct-token-input');
                    const confirmBtn = modalElement.querySelector('#pct-token-ok');
                    const skipBtn = modalElement.querySelector('#pct-token-skip');

                    tokenInput.value = this.token || ''; // 預填已儲存的 Token
                    tokenInput.focus();
                    UIManager.hideError('pct-token-err'); // 確保打開時清除錯誤信息

                    confirmBtn.onclick = async () => {
                        const val = tokenInput.value.trim();
                        if (!val) {
                            UIManager.showError('請輸入 Token', 'pct-token-err');
                            return;
                        }
                        UIManager.showToast('檢查 Token 中...', 'info');
                        PlanCodeTool.token = val;
                        localStorage.setItem('SSO-TOKEN', val);

                        const isValid = await this.verifyToken(val);

                        if (PlanCodeTool.tokenCheckEnabled) {
                            if (isValid) {
                                await UIManager.closeModal(); // <--- 等待 Modal 完全關閉
                                UIManager.showToast('Token 驗證成功', 'success');
                                this.showQueryDialog();
                            } else {
                                UIManager.showError('Token 驗證失敗，請重新輸入', 'pct-token-err');
                            }
                        } else { // 如果 TokenCheckEnabled 為 false (上次略過或手動關閉)
                            await UIManager.closeModal(); // <--- 等待 Modal 完全關閉
                            UIManager.showToast('Token 已儲存 (未驗證)', 'info');
                            this.showQueryDialog();
                        }
                    };

                    skipBtn.onclick = async () => { // <--- 設置為 async
                        PlanCodeTool.tokenCheckEnabled = false; // 略過後，本次會話禁用自動檢核
                        await UIManager.closeModal(); // <--- 等待 Modal 完全關閉
                        UIManager.showToast('已略過 Token 驗證', 'warning');
                        this.showQueryDialog();
                    };
                }
            });
        },

        async verifyToken(token) {
            try {
                const res = await fetch(`${this.apiBase}/planCodeController/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'SSO-TOKEN': token
                    },
                    body: JSON.stringify({
                        planCode: '5105',
                        pageNo: 1,
                        pageSize: 1
                    }) // 使用一個已知存在的小型查詢
                });
                const data = await res.json();
                return res.ok && !!data.records;
            } catch (e) {
                console.error('Token 驗證請求失敗:', e);
                return false;
            }
        },

        // ====== 查詢條件輸入流程 ======
        showQueryDialog() {
            // 定義主要的查詢模式，這將是五大卡片
            const primaryQueryModes = [
                AppConstants.QUERY_MODES.PLAN_CODE,
                AppConstants.QUERY_MODES.PLAN_NAME,
                AppConstants.QUERY_MODES.ALL_MASTER_PLANS,
                'masterDataCategory', // 特殊模式，用於觸發主檔子選項
                'channelDataCategory' // 特殊模式，用於觸發通路子選項
            ];

            UIManager.showModal({
                title: '查詢條件設定',
                body: `
                    <div class="pct-form-group">
                        <div class="pct-label">查詢模式：</div>
                        <div id="pct-mode-wrap" class="pct-mode-card-grid">
                            ${primaryQueryModes.map(mode =>
                                `<div class="pct-mode-card" data-mode="${mode}">${this.modeLabel(mode)}</div>`
                            ).join('')}
                        </div>
                    </div>

                    <div id="pct-dynamic-query-content"></div>

                    <div class="pct-form-group">
                        <div class="pct-error" id="pct-query-err" style="display:none"></div>
                    </div>
                `,
                footer: `
                    <button class="pct-btn" id="pct-query-ok">開始查詢</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-query-cancel">取消</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-query-clear-selection">清除選擇</button>
                `,
                onOpen: (modalElement) => {
                    let currentPrimaryMode = PlanCodeTool.queryMode; // 恢復上次的選擇
                    let currentQueryInput = PlanCodeTool.queryInput;
                    let currentSubOptions = [...PlanCodeTool.querySubOption];
                    let currentChannels = [...PlanCodeTool.queryChannels];

                    const dynamicContentArea = modalElement.querySelector('#pct-dynamic-query-content');
                    const queryInputTextArea = modalElement.querySelector('#pct-query-input'); // 可能還不存在
                    const modeCards = modalElement.querySelectorAll('#pct-mode-wrap .pct-mode-card');
                    const queryOkBtn = modalElement.querySelector('#pct-query-ok');
                    const queryCancelBtn = modalElement.querySelector('#pct-query-cancel');
                    const clearSelectionBtn = modalElement.querySelector('#pct-query-clear-selection');

                    // 輔助函數：更新動態內容區塊
                    const updateDynamicContent = () => {
                        dynamicContentArea.innerHTML = ''; // 清空內容
                        UIManager.hideError('pct-query-err'); // 隱藏錯誤訊息

                        let inputHtml = '';
                        let subOptionHtml = '';
                        let channelSelectionHtml = '';

                        switch (currentPrimaryMode) {
                            case AppConstants.QUERY_MODES.PLAN_CODE:
                                inputHtml = `
                                    <div class="pct-form-group">
                                        <label for="pct-query-input" class="pct-label">輸入商品代碼：</label>
                                        <textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品代碼 (多筆請用空格、逗號、分號或換行分隔)"></textarea>
                                    </div>
                                `;
                                break;
                            case AppConstants.QUERY_MODES.PLAN_NAME:
                                inputHtml = `
                                    <div class="pct-form-group">
                                        <label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label>
                                        <textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea>
                                    </div>
                                `;
                                break;
                            case AppConstants.QUERY_MODES.ALL_MASTER_PLANS:
                                inputHtml = `<div style="text-align: center; padding: 20px; color: var(--text-color-light);">將查詢所有主檔商品，無需輸入任何條件。</div>`;
                                break;
                            case 'masterDataCategory': // 主檔資料分類
                                subOptionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇主檔查詢範圍：</div>
                                        <div class="pct-sub-option-grid">
                                            <div class="pct-sub-option" data-sub-option="${AppConstants.QUERY_MODES.MASTER_IN_SALE}">現售商品</div>
                                            <div class="pct-sub-option" data-sub-option="${AppConstants.QUERY_MODES.MASTER_STOPPED}">停售商品</div>
                                        </div>
                                    </div>
                                `;
                                break;
                            case 'channelDataCategory': // 通路資料分類
                                channelSelectionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇通路：(可多選，不選則查詢所有通路)</div>
                                        <div class="pct-channel-option-grid">
                                            ${AppConstants.FIELD_MAPS.CHANNELS.map(ch =>
                                                `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`
                                            ).join('')}
                                        </div>
                                    </div>
                                `;
                                subOptionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇通路銷售範圍：</div>
                                        <div class="pct-sub-option-grid">
                                            <div class="pct-sub-option" data-sub-option="${AppConstants.QUERY_MODES.CHANNEL_IN_SALE}">現售通路</div>
                                            <div class="pct-sub-option" data-sub-option="${AppConstants.QUERY_MODES.CHANNEL_STOPPED}">停售通路</div>
                                        </div>
                                    </div>
                                `;
                                break;
                        }

                        dynamicContentArea.innerHTML = inputHtml + channelSelectionHtml + subOptionHtml;

                        // 重新綁定事件和恢復狀態
                        const newQueryInput = dynamicContentArea.querySelector('#pct-query-input');
                        if (newQueryInput) {
                            newQueryInput.value = currentQueryInput;
                            newQueryInput.addEventListener('input', (e) => {
                                currentQueryInput = e.target.value;
                                UIManager.hideError('pct-query-err');
                            });
                        }

                        // 綁定子選項點擊事件
                        dynamicContentArea.querySelectorAll('.pct-sub-option').forEach(option => {
                            if (currentSubOptions.includes(option.dataset.subOption)) {
                                option.classList.add('selected');
                            }
                            option.onclick = () => {
                                option.classList.toggle('selected');
                                const optionValue = option.dataset.subOption;
                                const index = currentSubOptions.indexOf(optionValue);
                                if (option.classList.contains('selected')) {
                                    if (index === -1) currentSubOptions.push(optionValue);
                                } else {
                                    if (index > -1) currentSubOptions.splice(index, 1);
                                }
                                UIManager.hideError('pct-query-err');
                            };
                        });

                        // 綁定通路選擇按鈕事件
                        dynamicContentArea.querySelectorAll('.pct-channel-option').forEach(option => {
                            if (currentChannels.includes(option.dataset.channel)) {
                                option.classList.add('selected');
                            }
                            option.onclick = () => {
                                option.classList.toggle('selected');
                                const channelValue = option.dataset.channel;
                                const index = currentChannels.indexOf(channelValue);
                                if (option.classList.contains('selected')) {
                                    if (index === -1) currentChannels.push(channelValue);
                                } else {
                                    if (index > -1) currentChannels.splice(index, 1);
                                }
                                UIManager.hideError('pct-query-err');
                            };
                        });
                    };

                    // 輔助函數：更新模式卡片 UI
                    const updateModeCardUI = () => {
                        modeCards.forEach(card => {
                            card.classList.toggle('selected', card.dataset.mode === currentPrimaryMode);
                        });
                    };

                    // 初始 UI 狀態
                    updateModeCardUI();
                    updateDynamicContent();

                    // 模式卡片點擊事件
                    modeCards.forEach(card => {
                        card.onclick = () => {
                            currentPrimaryMode = card.dataset.mode;
                            updateModeCardUI();
                            // 重置所有相關動態輸入，確保每次模式切換都是乾淨的
                            currentQueryInput = '';
                            currentSubOptions = [];
                            currentChannels = [];
                            updateDynamicContent();
                        };
                    });

                    // 清除選擇按鈕
                    clearSelectionBtn.onclick = () => {
                        currentPrimaryMode = '';
                        currentQueryInput = '';
                        currentSubOptions = [];
                        currentChannels = [];
                        updateModeCardUI();
                        updateDynamicContent();
                        UIManager.showToast('已清除所有查詢條件', 'info');
                    };

                    // 開始查詢按鈕
                    queryOkBtn.onclick = () => {
                        let finalMode = currentPrimaryMode;
                        let finalInput = currentQueryInput;
                        let finalSubOptions = currentSubOptions;
                        let finalChannels = currentChannels;

                        // 根據選擇的主要模式，確定最終的查詢模式
                        if (currentPrimaryMode === 'masterDataCategory') {
                            if (currentSubOptions.length === 0 || currentSubOptions.length === 2) {
                                UIManager.showError('請選擇主檔查詢範圍 (現售/停售)', 'pct-query-err');
                                return;
                            }
                            finalMode = currentSubOptions[0]; // 選擇第一個子選項作為最終模式 (只允許單選)
                        } else if (currentPrimaryMode === 'channelDataCategory') {
                            if (currentSubOptions.length === 0 || currentSubOptions.length === 2) {
                                UIManager.showError('請選擇通路銷售範圍 (現售/停售)', 'pct-query-err');
                                return;
                            }
                            finalMode = currentSubOptions[0]; // 選擇第一個子選項作為最終模式 (只允許單選)
                        } else if (!currentPrimaryMode) { // 如果沒有選擇任何模式
                            UIManager.showError('請選擇查詢模式', 'pct-query-err');
                            return;
                        }

                        // 驗證輸入內容
                        if ([AppConstants.QUERY_MODES.PLAN_CODE, AppConstants.QUERY_MODES.PLAN_NAME].includes(finalMode) && !finalInput) {
                            UIManager.showError('請輸入查詢內容', 'pct-query-err');
                            return;
                        }

                        // 保存當前查詢狀態以便下次打開彈窗時恢復
                        PlanCodeTool.queryMode = finalMode;
                        PlanCodeTool.queryInput = finalInput;
                        PlanCodeTool.querySubOption = finalSubOptions;
                        PlanCodeTool.queryChannels = finalChannels;
                        PlanCodeTool.pageNo = 1; // 新查詢重置分頁
                        PlanCodeTool.filterSpecial = false; // 新查詢重置特殊篩選

                        UIManager.closeModal();
                        PlanCodeTool.doQuery();
                    };

                    // 取消按鈕
                    queryCancelBtn.onclick = () => {
                        UIManager.closeModal();
                    };

                    // 初始恢復選中狀態
                    if (PlanCodeTool.queryMode) {
                        // 找到對應的主要模式
                        const modeToSelect = primaryQueryModes.find(pm => {
                            if (pm === PlanCodeTool.queryMode) return true;
                            if (pm === 'masterDataCategory' && [AppConstants.QUERY_MODES.MASTER_IN_SALE, AppConstants.QUERY_MODES.MASTER_STOPPED].includes(PlanCodeTool.queryMode)) return true;
                            if (pm === 'channelDataCategory' && [AppConstants.QUERY_MODES.CHANNEL_IN_SALE, AppConstants.QUERY_MODES.CHANNEL_STOPPED].includes(PlanCodeTool.queryMode)) return true;
                            return false;
                        });
                        if (modeToSelect) {
                            currentPrimaryMode = modeToSelect;
                            updateModeCardUI();
                            updateDynamicContent(); // 必須再次呼叫以綁定子選項
                            // 手動設置子選項的 selected 狀態
                            if (modeToSelect === 'masterDataCategory' || modeToSelect === 'channelDataCategory') {
                                const subOptionElement = dynamicContentArea.querySelector(`[data-sub-option="${PlanCodeTool.queryMode}"]`);
                                if (subOptionElement) {
                                    subOptionElement.classList.add('selected');
                                }
                            }
                            // 手動設置通路選擇的 selected 狀態
                            if (modeToSelect === 'channelDataCategory' && PlanCodeTool.queryChannels.length > 0) {
                                PlanCodeTool.queryChannels.forEach(ch => {
                                    const channelElement = dynamicContentArea.querySelector(`[data-channel="${ch}"]`);
                                    if (channelElement) {
                                        channelElement.classList.add('selected');
                                    }
                                });
                            }
                        }
                    }
                }
            });
        },

        modeLabel(mode) {
            switch (mode) {
                case AppConstants.QUERY_MODES.PLAN_CODE:
                    return '商品代號';
                case AppConstants.QUERY_MODES.PLAN_NAME:
                    return '商品名稱關鍵字';
                case AppConstants.QUERY_MODES.ALL_MASTER_PLANS:
                    return '查詢全部主檔';
                case 'masterDataCategory':
                    return '主檔資料'; // UI 顯示用
                case 'channelDataCategory':
                    return '通路資料'; // UI 顯示用
                    // 以下是實際的查詢模式，但在主彈窗中是子選項
                case AppConstants.QUERY_MODES.MASTER_IN_SALE:
                    return '主檔現售';
                case AppConstants.QUERY_MODES.MASTER_STOPPED:
                    return '主檔停售';
                case AppConstants.QUERY_MODES.CHANNEL_IN_SALE:
                    return '通路現售';
                case AppConstants.QUERY_MODES.CHANNEL_STOPPED:
                    return '通路停售';
                default:
                    return mode;
            }
        },

        // ====== 查詢執行與數據獲取 ======
        async doQuery() {
            UIManager.showToast('查詢中...', 'info');
            this.allRaw = []; // 清空原始數據
            this.allData = []; // 清空處理後數據
            this.totalRecords = 0;
            this.cacheDetail.clear(); // 清空快取
            this.cacheChannel.clear();

            let records = [];
            let totalRecords = 0;
            const pageSize = AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER; // 查詢 API 時使用大 pageSize

            try {
                if ([AppConstants.QUERY_MODES.PLAN_CODE, AppConstants.QUERY_MODES.PLAN_NAME, AppConstants.QUERY_MODES.ALL_MASTER_PLANS, AppConstants.QUERY_MODES.MASTER_IN_SALE].includes(this.queryMode)) {
                    // 針對 PlanCode 可能有多筆輸入的情況進行處理
                    if (this.queryMode === AppConstants.QUERY_MODES.PLAN_CODE && this.queryInput.includes(',')) {
                        const planCodes = this.queryInput.split(/[\s,;，；、|\n\r]+/).map(p => p.trim()).filter(Boolean);
                        UIManager.showToast(`查詢 ${planCodes.length} 個商品代號中...`, 'info', 3000);
                        const multiQueryResult = await this.queryMultiplePlanCodes(planCodes);
                        records = multiQueryResult.records;
                        totalRecords = multiQueryResult.totalRecords;
                    } else {
                        // 單筆商品代碼、商品名稱關鍵字、查詢全部主檔、主檔現售
                        const params = this.buildMasterQueryParams(this.queryMode, this.queryInput, 1, pageSize);
                        const result = await this.callApi('/planCodeController/query', params);
                        records = result.records || [];
                        totalRecords = result.totalRecords || 0;
                    }

                } else if (this.queryMode === AppConstants.QUERY_MODES.MASTER_STOPPED) {
                    // 主檔停售：查全部主檔，然後前端過濾
                    const params = this.buildMasterQueryParams(AppConstants.QUERY_MODES.ALL_MASTER_PLANS, '', 1, pageSize); // 查全部
                    const result = await this.callApi('/planCodeController/query', params);
                    records = (result.records || []).filter(item =>
                        this.getSaleStatus(this.formatToday(), item.saleStartDate, item.saleEndDate) === AppConstants.SALE_STATUS.STOPPED
                    );
                    totalRecords = records.length;
                } else if ([AppConstants.QUERY_MODES.CHANNEL_IN_SALE, AppConstants.QUERY_MODES.CHANNEL_STOPPED].includes(this.queryMode)) {
                    // 通路現售/停售
                    const channelsToQuery = this.queryChannels.length > 0 ? this.queryChannels : AppConstants.FIELD_MAPS.CHANNELS;
                    let allChannelRecords = [];

                    for (const channel of channelsToQuery) {
                        const baseParams = {
                            "channel": channel,
                            "saleEndDate": (this.queryMode === AppConstants.QUERY_MODES.CHANNEL_IN_SALE) ? "9999-12-31 00:00:00" : "", // 停售模式先查全部
                            "pageIndex": 1,
                            "size": AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
                            "orderBys": ["planCode asc"]
                        };
                        const result = await this.callApi('/planCodeSaleDateController/query', baseParams);
                        let channelRecords = result.planCodeSaleDates?.records || [];

                        if (this.queryMode === AppConstants.QUERY_MODES.CHANNEL_STOPPED) {
                            // 通路停售：前端過濾
                            channelRecords = channelRecords.filter(item =>
                                this.getSaleStatus(this.formatToday(), item.saleStartDate, item.saleEndDate) === AppConstants.SALE_STATUS.STOPPED
                            );
                        }
                        // 為通路數據標記來源通路
                        channelRecords.forEach(r => r._sourceChannel = channel);
                        allChannelRecords.push(...channelRecords);
                    }
                    // 對所有通路合併後的結果再次去重，因為不同通路可能有相同的商品代碼
                    const uniqueChannelRecords = [];
                    const seenChannelEntries = new Set(); // 使用 planCode + sourceChannel 確保唯一
                    for (const record of allChannelRecords) {
                        const identifier = record.planCode + (record._sourceChannel || '');
                        if (!seenChannelEntries.has(identifier)) {
                            seenChannelEntries.add(identifier);
                            uniqueChannelRecords.push(record);
                        }
                    }
                    records = uniqueChannelRecords;
                    totalRecords = uniqueChannelRecords.length;
                } else {
                    throw new Error('未知的查詢模式或條件不完整');
                }

                this.allRaw = records; // 保存原始數據
                this.totalRecords = totalRecords;

                // 處理並格式化數據，包括詳情和通路查詢
                await this.processAllDataForTable();
                this.renderTable();
                UIManager.showToast(`查詢完成，共 ${this.allData.length} 筆資料`, 'success');

            } catch (e) {
                UIManager.showToast(`查詢 API 失敗：${e.message}`, 'error');
                console.error('查詢 API 失敗:', e);
                this.allRaw = [];
                this.allData = [];
                this.totalRecords = 0;
                this.renderTable(); // 渲染空表格
            }
        },

        buildMasterQueryParams(mode, input, pageNo, pageSize) {
            const params = {
                pageNo,
                pageSize
            };
            switch (mode) {
                case AppConstants.QUERY_MODES.PLAN_CODE:
                    params.planCode = input;
                    break;
                case AppConstants.QUERY_MODES.PLAN_NAME:
                    params.planCodeName = input;
                    break;
                case AppConstants.QUERY_MODES.ALL_MASTER_PLANS:
                    params.planCodeName = ''; // 查詢全部
                    break;
                case AppConstants.QUERY_MODES.MASTER_IN_SALE:
                    params.saleEndDate = '9999-12-31 00:00:00';
                    break;
                default:
                    throw new Error('無效的主檔查詢模式');
            }
            return params;
        },

        // 批量查詢商品代碼 (處理多筆輸入)
        async queryMultiplePlanCodes(planCodes) {
            const allRecords = [];
            for (let i = 0; i < planCodes.length; i++) {
                const planCode = planCodes[i];
                try {
                    UIManager.showToast(`查詢商品代號 ${planCode} (${i + 1}/${planCodes.length})...`, 'info', 1000);
                    const params = {
                        planCode,
                        pageNo: 1,
                        pageSize: AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
                    };
                    const result = await this.callApi('/planCodeController/query', params);

                    if (result.records && result.records.length > 0) {
                        // 標記查詢來源，便於識別
                        result.records.forEach(record => record._querySourcePlanCode = planCode);
                        allRecords.push(...result.records);
                    } else {
                        // 處理查無資料的情況，加入一個特殊標記的項目
                        allRecords.push({
                            planCode: planCode,
                            _apiStatus: '查無資料',
                            _isErrorRow: true
                        });
                    }
                } catch (error) {
                    console.error(`查詢商品代號 ${planCode} 失敗:`, error);
                    UIManager.showToast(`查詢 ${planCode} 失敗: ${error.message}`, 'error', 3000);
                    allRecords.push({
                        planCode: planCode,
                        _apiStatus: '查詢失敗',
                        _isErrorRow: true
                    });
                }
            }
            return {
                records: allRecords,
                totalRecords: allRecords.length
            };
        },

        // ====== 資料處理與轉換 (重構以在查詢後一次性處理所有數據) ======
        async processAllDataForTable() {
            const todayStr = this.formatToday();
            const processedItems = [];
            let index = 1; // 為表格 No. 編號

            // 使用 Promise.allSettled 處理異步詳情/通路查詢，即使部分失敗也不會中斷主流程
            const promises = this.allRaw.map(async (item) => {
                // 如果是查詢失敗的特殊行，直接處理並返回
                if (item._isErrorRow) {
                    return {
                        no: index++,
                        planCode: item.planCode || '-',
                        shortName: '-',
                        currency: '-',
                        unit: '-',
                        coverageType: '-',
                        saleStartDate: '-',
                        saleEndDate: `查詢狀態: ${this.escapeHtml(item._apiStatus)}`,
                        mainStatus: '-',
                        polpln: '-',
                        channels: [],
                        special: false,
                        _isErrorRow: true
                    };
                }

                let polpln = item.polpln || ''; // 嘗試從原始數據中獲取
                if (!polpln && this.cacheDetail.has(item.planCode)) {
                    polpln = this.cacheDetail.get(item.planCode);
                } else if (!polpln) { // 如果緩存中沒有，則查詢
                    try {
                        const detail = await this.callApi('/planCodeController/queryDetail', {
                            planCode: item.planCode,
                            pageNo: 1,
                            pageSize: AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
                        });
                        polpln = (detail.records || []).map(r => r.polpln).filter(Boolean).join(', ');
                        this.cacheDetail.set(item.planCode, polpln);
                    } catch (e) {
                        console.warn(`查詢 ${item.planCode} 詳情失敗：`, e.message);
                        polpln = '';
                    }
                }

                let channels = item.channels || []; // 嘗試從原始數據中獲取
                if (channels.length === 0 && this.cacheChannel.has(item.planCode)) {
                    channels = this.cacheChannel.get(item.planCode);
                } else if (channels.length === 0) { // 如果緩存中沒有，則查詢
                    try {
                        const sale = await this.callApi('/planCodeSaleDateController/query', {
                            planCode: item.planCode,
                            pageNo: 1,
                            pageSize: AppConstants.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL
                        });
                        channels = (sale.planCodeSaleDates?.records || []).map(r => ({
                            channel: this.channelCodeConvert(r.channel),
                            saleStartDate: this.formatDate(r.saleStartDate),
                            saleEndDate: this.formatDate(r.saleEndDate),
                            status: this.getSaleStatus(todayStr, r.saleStartDate, r.saleEndDate),
                            rawEnd: r.saleEndDate // 保留原始日期用於特殊狀態判斷
                        }));
                        this.cacheChannel.set(item.planCode, channels);
                    } catch (e) {
                        console.warn(`查詢 ${item.planCode} 通路失敗：`, e.message);
                        channels = [];
                    }
                }

                // 主約狀態判斷
                const mainSaleStartDate = this.formatDate(item.saleStartDate);
                const mainSaleEndDate = this.formatDate(item.saleEndDate);
                const mainStatus = this.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);

                const processedItem = {
                    no: 0, // Placeholder, will be updated after filter/sort
                    planCode: item.planCode || '-',
                    shortName: item.shortName || item.planName || '-',
                    currency: this.currencyConvert(item.currency || item.cur),
                    unit: this.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
                    coverageType: this.coverageTypeConvert(item.coverageType || item.type),
                    saleStartDate: mainSaleStartDate,
                    saleEndDate: mainSaleEndDate,
                    mainStatus,
                    polpln,
                    channels,
                    special: false, // Initial value, will be set below
                    _isErrorRow: false // 標記是否為錯誤行
                };

                // 特殊狀態判斷
                processedItem.special = this.checkSpecialStatus(processedItem);

                return processedItem;
            });

            // 等待所有詳情/通路查詢完成
            const results = await Promise.allSettled(promises);
            this.allData = results.filter(result => result.status === 'fulfilled').map(result => result.value);

            // 重新編號
            this.allData.forEach((item, idx) => item.no = idx + 1);

            // 初始排序 (如果已經有排序，則應用)
            if (this.sortKey) {
                this.allData.sort((a, b) => {
                    const valA = a[this.sortKey];
                    const valB = b[this.sortKey];

                    if (this.sortKey.includes('Date')) { // 針對日期字串的排序
                        const dateA = new Date(valA);
                        const dateB = new Date(valB);
                        if (isNaN(dateA) && isNaN(dateB)) return 0;
                        if (isNaN(dateA)) return this.sortAsc ? 1 : -1;
                        if (isNaN(dateB)) return this.sortAsc ? -1 : 1;
                        if (dateA > dateB) return this.sortAsc ? 1 : -1;
                        if (dateA < dateB) return this.sortAsc ? -1 : 1;
                        return 0;
                    }

                    // 一般字符串或數字排序
                    if (valA === undefined || valA === null) return this.sortAsc ? 1 : -1; // 將 undefined/null 放在後面
                    if (valB === undefined || valB === null) return this.sortAsc ? -1 : 1;
                    if (typeof valA === 'string' && typeof valB === 'string') {
                        return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    }
                    if (valA > valB) return this.sortAsc ? 1 : -1;
                    if (valA < valB) return this.sortAsc ? -1 : 1;
                    return 0;
                });
            }
        },

        // 重新處理所有數據以更新表格（例如，一鍵查詢詳情後）
        async updateAllDetailsAndRefreshTable() {
            UIManager.showToast('批次查詢詳細資料中...', 'info');

            // 檢查是否有資料可供查詢詳情
            if (this.allData.length === 0) {
                UIManager.showToast('沒有資料可供查詢詳情。', 'warning');
                return; // 沒有資料，直接結束
            }

            // 清空詳情和通路快取，強制重新查詢所有數據
            this.cacheDetail.clear();
            this.cacheChannel.clear();

            // 重新處理所有原始數據，會再次觸發詳情和通路查詢
            await this.processAllDataForTable();

            // 判斷是否仍然有數據來顯示「完成」提示
            if (this.allData.length > 0) {
                this.renderTable(); // 重新渲染表格
                UIManager.showToast('批次查詢詳細資料完成', 'success');
            } else {
                // 如果在處理過程中數據變為空（不太可能，除非 API 全部失效）
                this.renderTable(); // 重新渲染，顯示「查無資料」
                UIManager.showToast('批次查詢完成，但沒有可用的詳細資料。', 'warning');
            }
        },

        // ====== 表格渲染與互動 ======
        renderTable: function() {
            let displayedData = this.filterSpecial ? this.allData.filter(r => r.special) : this.allData;
            const totalPages = Math.ceil(displayedData.length / this.pageSize);
            const startIndex = (this.pageNo - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            const pageData = displayedData.slice(startIndex, endIndex);

            // 判斷按鈕禁用狀態
            const hasPrev = this.pageNo > 1;
            const hasNext = this.pageNo < totalPages;
            const hasSpecialData = this.allData.some(r => r.special); // 判斷原始數據中是否存在特殊數據

            UIManager.showModal({
                title: `查詢結果（${this.envLabel()}）`,
                body: this.renderSummary(displayedData, hasSpecialData) + this.renderTableHTML(pageData),
                footer: `
                    <div class="pct-pagination-controls-group">
                        <button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${!hasPrev ? 'disabled' : ''}>上一頁</button>
                        <button class="pct-btn pct-btn-secondary" id="pct-table-next" ${!hasNext ? 'disabled' : ''}>下一頁</button>
                    </div>
                    <div class="pct-pagination-info">第 ${this.pageNo} 頁 / 共 ${totalPages} 頁 (總計 ${displayedData.length} 筆)</div>
                    <div style="flex-grow:1;"></div> <!-- Spacer for alignment -->
                    <button class="pct-btn pct-btn-info" id="pct-table-detail">一鍵查詢全部詳細</button>
                    <button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>
                    ${hasSpecialData ? `<button class="pct-btn ${this.filterSpecial ? 'pct-filter-btn-active' : 'pct-filter-btn'}" id="pct-table-filter">${this.filterSpecial ? '顯示全部' : '篩選特殊狀態'}</button>` : ''}
                    <button class="pct-btn" id="pct-table-requery">重新查詢</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-table-close">關閉</button>
                `,
                onOpen: (modalElement) => {
                    modalElement.querySelector('#pct-table-detail').onclick = () => {
                        this.updateAllDetailsAndRefreshTable(); // 呼叫批次處理方法
                    };

                    modalElement.querySelector('#pct-table-copy').onclick = () => {
                        this.copyTextToClipboard(this.renderTableText(displayedData));
                    };

                    modalElement.querySelector('#pct-table-prev').onclick = () => {
                        if (this.pageNo > 1) {
                            this.pageNo--;
                            this.renderTable();
                        }
                    };

                    modalElement.querySelector('#pct-table-next').onclick = () => {
                        if (this.pageNo < totalPages) {
                            this.pageNo++;
                            this.renderTable();
                        }
                    };

                    const filterBtn = modalElement.querySelector('#pct-table-filter');
                    if (filterBtn) { // 確保按鈕存在
                        filterBtn.onclick = () => {
                            this.filterSpecial = !this.filterSpecial;
                            this.pageNo = 1; // 篩選狀態改變後回到第一頁
                            this.renderTable();
                        };
                    }


                    modalElement.querySelector('#pct-table-requery').onclick = () => {
                        UIManager.closeModal();
                        this.start(); // 返回啟動流程
                    };

                    modalElement.querySelector('#pct-table-close').onclick = () => {
                        UIManager.closeModal();
                    };

                    // 表頭排序
                    modalElement.querySelectorAll('.pct-table th').forEach(th => {
                        th.onclick = () => {
                            const key = th.dataset.key;
                            if (!key) return;

                            if (this.sortKey === key) {
                                this.sortAsc = !this.sortAsc;
                            } else {
                                this.sortKey = key;
                                this.sortAsc = true;
                            }

                            // 對原始的 allData 進行排序
                            this.allData.sort((a, b) => {
                                const valA = a[key];
                                const valB = b[key];

                                if (this.sortKey.includes('Date')) { // 針對日期字串的排序
                                    const dateA = new Date(valA);
                                    const dateB = new Date(valB);
                                    if (isNaN(dateA) && isNaN(dateB)) return 0;
                                    if (isNaN(dateA)) return this.sortAsc ? 1 : -1;
                                    if (isNaN(dateB)) return this.sortAsc ? -1 : 1;
                                    if (dateA > dateB) return this.sortAsc ? 1 : -1;
                                    if (dateA < dateB) return this.sortAsc ? -1 : 1;
                                    return 0;
                                }

                                // 一般字符串或數字排序
                                if (valA === undefined || valA === null) return this.sortAsc ? 1 : -1; // 將 undefined/null 放在後面
                                if (valB === undefined || valB === null) return this.sortAsc ? -1 : 1;
                                if (typeof valA === 'string' && typeof valB === 'string') {
                                    return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
                                }
                                if (valA > valB) return this.sortAsc ? 1 : -1;
                                if (valA < valB) return this.sortAsc ? -1 : 1;
                                return 0;
                            });

                            this.pageNo = 1; // 排序後回到第一頁
                            this.renderTable(); // 重新渲染表格
                        };
                    });
                }
            });
        },

        renderSummary: function(data, hasSpecialData) {
            const specialCount = data.filter(r => r.special).length;
            let html = `<div class="pct-summary">共 ${data.length} 筆`;
            if (hasSpecialData) { // 只有當所有數據中確實存在特殊數據時才顯示這個計數
                html += `，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆`;
            }
            html += `</div>`;
            return html;
        },

        renderTableHTML: function(data) {
            if (!data || data.length === 0) {
                return `<div class="pct-table-wrap" style="height:150px; display:flex; align-items:center; justify-content:center; color:var(--text-color-light);">查無資料</div>`;
            }

            let html = `
                <div class="pct-table-wrap">
                    <table class="pct-table">
                        <thead>
                            <tr>
                                <th data-key="no">No</th>
                                <th data-key="planCode">代號</th>
                                <th data-key="shortName">商品名稱</th>
                                <th data-key="currency">幣別</th>
                                <th data-key="unit">單位</th>
                                <th data-key="coverageType">類型</th>
                                <th data-key="saleStartDate">銷售起日</th>
                                <th data-key="saleEndDate">銷售迄日</th>
                                <th data-key="mainStatus">主約狀態</th>
                                <th data-key="polpln">POLPLN</th>
                                <th>通路資訊</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data.forEach(row => {
                // 為了避免 XSS，對所有顯示的文本內容進行轉義
                const escapedPlanCode = this.escapeHtml(row.planCode);
                const escapedShortName = this.escapeHtml(row.shortName);
                const escapedCurrency = this.escapeHtml(row.currency);
                const escapedUnit = this.escapeHtml(row.unit);
                const escapedCoverageType = this.escapeHtml(row.coverageType);
                const escapedSaleStartDate = this.escapeHtml(row.saleStartDate);
                const escapedSaleEndDate = this.escapeHtml(row.saleEndDate);
                const escapedMainStatus = this.escapeHtml(row.mainStatus);
                const escapedPolpln = this.escapeHtml(row.polpln || '');

                const channelHtml = (row.channels || []).map(c => {
                    const statusClass = c.status === AppConstants.SALE_STATUS.CURRENT ? 'pct-status-onsale' : (c.status === AppConstants.SALE_STATUS.STOPPED ? 'pct-status-offsale' : (c.status === AppConstants.SALE_STATUS.ABNORMAL ? 'pct-status-abnormal' : 'pct-status-pending'));
                    return `<span class="${statusClass}">${this.escapeHtml(c.channel)}:${this.escapeHtml(c.saleEndDate)}（${this.escapeHtml(c.status)}）</span>`;
                }).join('<br>');

                html += `
                    <tr${row.special ? ' class="special-row"' : ''}>
                        <td>${row.no}</td>
                        <td>${escapedPlanCode}</td>
                        <td>${escapedShortName}</td>
                        <td>${escapedCurrency}</td>
                        <td>${escapedUnit}</td>
                        <td>${escapedCoverageType}</td>
                        <td>${escapedSaleStartDate}</td>
                        <td>${escapedSaleEndDate}</td>
                        <td class="${row.mainStatus === AppConstants.SALE_STATUS.CURRENT ? 'pct-status-onsale' : row.mainStatus === AppConstants.SALE_STATUS.STOPPED ? 'pct-status-offsale' : (row.mainStatus === AppConstants.SALE_STATUS.ABNORMAL ? 'pct-status-abnormal' : 'pct-status-pending')}">${escapedMainStatus}</td>
                        <td>${escapedPolpln}</td>
                        <td>${channelHtml}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
            return html;
        },

        renderTableText: function(data) {
            let txt = `No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n`;
            data.forEach(row => {
                let channelStr = (row.channels || []).map(c =>
                    `${c.channel}:${c.saleEndDate}（${c.status}）`
                ).join(' / ');
                txt += `${row.no}\t${row.planCode}\t${row.shortName}\t${row.currency}\t${row.unit}\t${row.coverageType}\t${row.saleStartDate}\t${row.saleEndDate}\t${row.mainStatus}\t${row.polpln}\t${channelStr}\n`;
            });
            return txt;
        },

        // ====== API 調用輔助函數 ======
        async callApi(endpoint, params) {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'SSO-TOKEN': this.token
                },
                body: JSON.stringify(params)
            });
            if (!response.ok) {
                const errorText = await response.text();
                // 嘗試解析 JSON 錯誤訊息，否則返回原始文本
                let errorMessage = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.message) {
                        errorMessage = errorJson.message;
                    } else if (errorJson.error) {
                        errorMessage = errorJson.error;
                    }
                } catch (e) {
                    // Not a JSON error, use original text
                }
                throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorMessage}`);
            }
            return response.json();
        },

        // ====== 資料格式化與判斷輔助函數 ======
        formatToday() {
            const d = new Date();
            return `${d.getFullYear()}${('0' + (d.getMonth() + 1)).slice(-2)}${('0' + d.getDate()).slice(-2)}`;
        },

        /**
         * 內部輔助函數：將日期字串格式化為 YYYY-MM-DD，用於 Date 對象的穩定解析。
         * @param {string} dt - 日期時間字串 (e.g., "YYYY-MM-DD HH:MM:SS" 或 "YYYYMMDD")
         * @returns {string} 格式化後的日期 (YYYY-MM-DD)
         */
        _formatToIsoDateForDateObject(dt) {
            if (!dt) return '';
            const cleanDate = String(dt).split(' ')[0].replace(/\D/g, ''); // 獲取 YYYYMMDD
            if (cleanDate.length >= 8) {
                return cleanDate.substring(0, 4) + '-' + cleanDate.substring(4, 6) + '-' + cleanDate.substring(6, 8);
            }
            return String(dt); // Fallback for unexpected formats, Date() might still parse
        },

        /**
         * 格式化日期字串為 YYYYMMDD (半形 8 碼)，用於顯示。
         * @param {string} dt - 日期時間字串 (e.g., "YYYY-MM-DD HH:MM:SS" 或 "YYYYMMDD")
         * @returns {string} 格式化後的日期 (YYYYMMDD)
         */
        formatDate(dt) {
            if (!dt) return '';
            const datePart = String(dt).split(' ')[0]; // "YYYY-MM-DD" or "YYYYMMDD"
            return datePart.replace(/\D/g, '').substring(0, 8); // 移除所有非數字並取前 8 碼
        },

        getSaleStatus(todayStr, saleStartStr, saleEndStr) {
            if (!saleStartStr || !saleEndStr) return '';
            // 使用 _formatToIsoDateForDateObject 確保 Date 對象能穩定解析
            const today = new Date(this._formatToIsoDateForDateObject(todayStr));
            const saleStartDate = new Date(this._formatToIsoDateForDateObject(saleStartStr));
            const saleEndDate = new Date(this._formatToIsoDateForDateObject(saleEndStr));

            if (isNaN(today.getTime()) || isNaN(saleStartDate.getTime()) || isNaN(saleEndDate.getTime())) {
                return '日期格式錯誤'; // 處理無效日期格式
            }

            // 1. 最高優先級：判斷日期本身是否邏輯矛盾 (起日晚於訖日)
            if (saleStartDate.getTime() > saleEndDate.getTime()) {
                return AppConstants.SALE_STATUS.ABNORMAL; // 返回新增的「日期異常」狀態
            }

            // 2. 其次判斷是否為永久有效 (現售中)
            if (saleEndStr.includes('99991231') || saleEndStr.includes('9999-12-31')) {
                return AppConstants.SALE_STATUS.CURRENT;
            }

            // 3. 判斷今日日期與銷售訖日的關係 (停售)
            if (today.getTime() > saleEndDate.getTime()) {
                return AppConstants.SALE_STATUS.STOPPED;
            }

            // 4. 判斷今日日期與銷售起日的關係 (未開始)
            if (today.getTime() < saleStartDate.getTime()) {
                return AppConstants.SALE_STATUS.PENDING;
            }

            // 5. 最後判斷今日日期是否在銷售區間內 (現售中)
            if (today.getTime() >= saleStartDate.getTime() && today.getTime() <= saleEndDate.getTime()) {
                return AppConstants.SALE_STATUS.CURRENT;
            }

            return ''; // 未知狀態
        },

        channelCodeConvert(code) {
            return code === 'OT' ? 'BK' : code;
        },

        currencyConvert(val) {
            return AppConstants.FIELD_MAPS.CURRENCY[String(val)] || val || '';
        },

        unitConvert(val) {
            return AppConstants.FIELD_MAPS.UNIT[String(val)] || val || '';
        },

        coverageTypeConvert(val) {
            return AppConstants.FIELD_MAPS.COVERAGE_TYPE[String(val)] || val || '';
        },

        // 複製文本到剪貼簿
        copyTextToClipboard(text) {
            if (!navigator.clipboard) {
                // Fallback for older browsers
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                UIManager.showToast('已複製查詢結果 (舊版瀏覽器)', 'success');
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    UIManager.showToast('已複製查詢結果', 'success');
                }).catch(err => {
                    console.error('複製失敗:', err);
                    UIManager.showToast('複製失敗，請檢查瀏覽器權限', 'error');
                });
            }
        },

        // 特殊狀態判斷 (從 DataProcessor 挪到 PlanCodeTool 內部，因為它依賴 PlanCodeTool 的輔助函數)
        checkSpecialStatus(item) {
            const todayStr = this.formatToday();
            const mainStatus = this.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
            const channels = item.channels || [];

            // 1. 主檔停售但通路現售 (主檔銷售迄日非永久，且通路中有現售)
            if (mainStatus === AppConstants.SALE_STATUS.STOPPED &&
                channels.some(c => c.status === AppConstants.SALE_STATUS.CURRENT)) {
                return true;
            }

            // 2. 主檔現售但所有通路停售或未開始 (主檔銷售迄日永久，且所有通路都是停售或未開始)
            if (mainStatus === AppConstants.SALE_STATUS.CURRENT && channels.length > 0 &&
                channels.every(c => c.status === AppConstants.SALE_STATUS.STOPPED || c.status === AppConstants.SALE_STATUS.PENDING)) {
                return true;
            }

            // 3. 通路銷售迄日晚於主檔銷售訖日
            if (channels.some(c => {
                    // 使用 _formatToIsoDateForDateObject 進行可靠的日期比較
                    const mainEndDate = new Date(this._formatToIsoDateForDateObject(item.saleEndDate));
                    const channelEndDate = new Date(this._formatToIsoDateForDateObject(c.rawEnd));
                    return !isNaN(mainEndDate.getTime()) && !isNaN(channelEndDate.getTime()) &&
                        mainEndDate.getTime() < channelEndDate.getTime();
                })) {
                return true;
            }

            // 4. 通路銷售起日早於主檔銷售起日
            if (channels.some(c => {
                    // 使用 _formatToIsoDateForDateObject 進行可靠的日期比較
                    const mainStartDate = new Date(this._formatToIsoDateForDateObject(item.saleStartDate));
                    const channelStartDate = new Date(this._formatToIsoDateForDateObject(c.saleStartDate));
                    return !isNaN(mainStartDate.getTime()) && !isNaN(channelStartDate.getTime()) &&
                        mainStartDate.getTime() > channelStartDate.getTime();
                })) {
                return true;
            }

            // 5. 日期本身異常也視為特殊狀態
            if (mainStatus === AppConstants.SALE_STATUS.ABNORMAL) {
                return true;
            }

            return false;
        },

        // HTML 轉義工具，防止 XSS 攻擊
        escapeHtml(text) {
            if (typeof text !== 'string') return text; // 非字符串直接返回
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, function(m) {
                return map[m];
            });
        }
    };

    // ====== 啟動應用程式 ======
    PlanCodeTool.start();

})();
