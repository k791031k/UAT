(function() {
	'use strict';

	// ============================================================================
	// AppConfig 模組: 核心常數與配置
	// 提供單一真值來源，確保常數不可變。
	// ============================================================================
	const AppConfig = Object.freeze({
		TOOL_ID: 'planCodeQueryToolInstance',
		STYLE_ID: 'planCodeToolStyle',
		VERSION: '1.0.0',
		QUERY_MODES: {
			PLAN_CODE: 'planCode',
			PLAN_NAME: 'planCodeName',
			ALL_MASTER_PLANS: 'allMasterPlans',
			MASTER_IN_SALE: 'masterInSale',
			MASTER_STOPPED: 'masterStopped',
			CHANNEL_IN_SALE: 'channelInSale',
			CHANNEL_STOPPED: 'channelStopped'
		},
		API_ENDPOINTS: {
			UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
			PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
		},
		SALE_STATUS: {
			CURRENT: '現售中',
			STOPPED: '停售',
			PENDING: '未開始',
			ABNORMAL: '日期異常'
		},
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
			CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC']
		},
		DEFAULT_QUERY_PARAMS: {
			PAGE_SIZE_MASTER: 1000,
			PAGE_SIZE_CHANNEL: 1000,
			PAGE_SIZE_DETAIL: 20,
			PAGE_SIZE_TABLE: 50
		}
	});

	// ============================================================================
	// Utils 模組: 通用工具函式
	// 提供獨立、可重複使用的輔助函數，不直接依賴於其他業務邏輯模組。
	// ============================================================================
	const Utils = (function() {
		/**
		 * 將字串中的特殊 HTML 字元進行轉義，防止 XSS 攻擊。
		 * @param {string} text - 要轉義的字串。
		 * @returns {string} 轉義後的字串。
		 */
		function escapeHtml(text) {
			if (typeof text !== 'string') return text;
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

		/**
		 * 獲取當前日期，格式為 YYYYMMDD。
		 * @returns {string} 當前日期字串。
		 */
		function formatToday() {
			const d = new Date();
			return `${d.getFullYear()}${('0' + (d.getMonth() + 1)).slice(-2)}${('0' + d.getDate()).slice(-2)}`;
		}

		/**
		 * 格式化日期字串為 YYYYMMDD (用於 UI 顯示)。
		 * @param {string} dt - 日期字串 (如 "YYYYMMDD" 或 "YYYY-MM-DD HH:MM:SS")。
		 * @returns {string} 格式化後的日期字串。
		 */
		function formatDateForUI(dt) {
			if (!dt) return '';
			// 如果是 YYYY-MM-DD HH:MM:SS 格式，提取 YYYYMMDD
			const datePart = String(dt).split(' ')[0];
			if (datePart.includes('-')) {
				return datePart.replace(/-/g, '');
			}
			// 如果是 YYYYMMDD 格式，直接返回
			return datePart;
		}

		/**
		 * 格式化日期字串為 YYYY-MM-DD (用於內部比較或轉換)。
		 * @param {string} dt - 日期字串 (如 "YYYYMMDD" 或 "YYYY-MM-DD HH:MM:SS")。
		 * @returns {string} 格式化後的日期字串。
		 */
		function formatDateForComparison(dt) {
			if (!dt) return '';
			const datePart = String(dt).split(' ')[0];
			// 如果是 YYYYMMDD 格式，轉換為 YYYY-MM-DD
			if (datePart.match(/^\d{8}$/)) {
				return datePart.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
			}
			// 如果是 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS 格式，直接返回日期部分
			return datePart;
		}

		/**
		 * 判斷給定銷售日期與當前日期的銷售狀態。
		 * @param {string} todayStr - 當前日期 (YYYYMMDD)。
		 * @param {string} saleStartStr - 銷售起日 (YYYYMMDD 或 YYYY-MM-DD HH:MM:SS)。
		 * @param {string} saleEndStr - 銷售迄日 (YYYYMMDD 或 YYYY-MM-DD HH:MM:SS)。
		 * @returns {string} 銷售狀態 (現售中、停售、未開始、日期異常、日期格式錯誤)。
		 */
		function getSaleStatus(todayStr, saleStartStr, saleEndStr) {
			if (!saleStartStr || !saleEndStr) return '';
			const today = new Date(formatDateForComparison(todayStr));
			const saleStartDate = new Date(formatDateForComparison(saleStartStr));
			const saleEndDate = new Date(formatDateForComparison(saleEndStr));

			if (isNaN(today.getTime()) || isNaN(saleStartDate.getTime()) || isNaN(saleEndDate.getTime())) {
				return '日期格式錯誤';
			}

			if (saleStartDate.getTime() > saleEndDate.getTime()) {
				return AppConfig.SALE_STATUS.ABNORMAL;
			}

			if (saleEndStr.includes('99991231') || saleEndStr.includes('9999-12-31')) {
				return AppConfig.SALE_STATUS.CURRENT;
			}

			if (today.getTime() > saleEndDate.getTime()) {
				return AppConfig.SALE_STATUS.STOPPED;
			}

			if (today.getTime() < saleStartDate.getTime()) {
				return AppConfig.SALE_STATUS.PENDING;
			}

			if (today.getTime() >= saleStartDate.getTime() && today.getTime() <= saleEndDate.getTime()) {
				return AppConfig.SALE_STATUS.CURRENT;
			}

			return '';
		}

		/**
		 * 轉換通路代碼。
		 * @param {string} code - 通路代碼。
		 * @returns {string} 轉換後的通路代碼。
		 */
		function channelCodeConvert(code) {
			return code === 'OT' ? 'BK' : code;
		}

		/**
		 * 轉換幣別代碼為顯示名稱。
		 * @param {string} val - 幣別代碼。
		 * @returns {string} 幣別名稱。
		 */
		function currencyConvert(val) {
			return AppConfig.FIELD_MAPS.CURRENCY[String(val)] || val || '';
		}

		/**
		 * 轉換單位代碼為顯示名稱。
		 * @param {string} val - 單位代碼。
		 * @returns {string} 單位名稱。
		 */
		function unitConvert(val) {
			return AppConfig.FIELD_MAPS.UNIT[String(val)] || val || '';
		}

		/**
		 * 轉換險種類型代碼為顯示名稱。
		 * @param {string} val - 險種類型代碼。
		 * @returns {string} 險種類型名稱。
		 */
		function coverageTypeConvert(val) {
			return AppConfig.FIELD_MAPS.COVERAGE_TYPE[String(val)] || val || '';
		}

		/**
		 * 複製文本到剪貼簿。
		 * @param {string} text - 要複製的文本。
		 * @param {Function} showToast - UIManager 的 showToast 方法。
		 */
		function copyTextToClipboard(text, showToast) {
			if (!navigator.clipboard) {
				const ta = document.createElement('textarea');
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				showToast('已複製查詢結果 (舊版瀏覽器)', 'success');
			} else {
				navigator.clipboard.writeText(text).then(() => {
					showToast('已複製查詢結果', 'success');
				}).catch(err => {
					console.error('複製失敗:', err);
					showToast('複製失敗，請檢查瀏覽器權限', 'error');
				});
			}
		}

		/**
		 * 檢查數據項目是否為特殊狀態。
		 * @param {Object} item - 數據項目。
		 * @returns {boolean} 是否為特殊狀態。
		 */
		function checkSpecialStatus(item) {
			const todayStr = formatToday();
			const mainStatus = getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
			const channels = item.channels || [];

			// 1. 主檔停售但通路現售 (主檔銷售迄日非永久，且通路中有現售)
			if (mainStatus === AppConfig.SALE_STATUS.STOPPED &&
				channels.some(c => c.status === AppConfig.SALE_STATUS.CURRENT)) {
				return true;
			}

			// 2. 主檔現售但所有通路停售或未開始 (主檔銷售迄日永久，且所有通路都是停售或未開始)
			if (mainStatus === AppConfig.SALE_STATUS.CURRENT && channels.length > 0 &&
				channels.every(c => c.status === AppConfig.SALE_STATUS.STOPPED || c.status === AppConfig.SALE_STATUS.PENDING)) {
				return true;
			}

			// 3. 通路銷售迄日晚於主檔銷售訖日
			if (channels.some(c => {
					const mainEndDate = new Date(formatDateForComparison(item.saleEndDate));
					const channelEndDate = new Date(formatDateForComparison(c.rawEnd)); // rawEnd 保持 YYYY-MM-DD HH:MM:SS
					return !isNaN(mainEndDate.getTime()) && !isNaN(channelEndDate.getTime()) &&
						mainEndDate.getTime() < channelEndDate.getTime();
				})) {
				return true;
			}

			// 4. 通路銷售起日早於主檔銷售起日
			if (channels.some(c => {
					const mainStartDate = new Date(formatDateForComparison(item.saleStartDate));
					const channelStartDate = new Date(formatDateForComparison(c.rawStart)); // rawStart 保持 YYYY-MM-DD HH:MM:SS
					return !isNaN(mainStartDate.getTime()) && !isNaN(channelStartDate.getTime()) &&
						mainStartDate.getTime() > channelStartDate.getTime();
				})) {
				return true;
			}

			// 5. 日期本身異常也視為特殊狀態
			if (mainStatus === AppConfig.SALE_STATUS.ABNORMAL) {
				return true;
			}

			return false;
		}

		/**
		 * 分割輸入的字串為陣列，支援多種分隔符號。
		 * @param {string} input - 輸入字串。
		 * @returns {Array<string>} 分割後的字串陣列。
		 */
		function splitInput(input) {
			return input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
		}


		return {
			escapeHtml,
			formatToday,
			formatDateForUI,
			formatDateForComparison,
			getSaleStatus,
			channelCodeConvert,
			currencyConvert,
			unitConvert,
			coverageTypeConvert,
			copyTextToClipboard,
			checkSpecialStatus,
			splitInput
		};
	})();

	// ============================================================================
	// UIManager 模組: 統一管理所有 UI 相關操作和樣式注入
	// 負責 Modal、Toast、按鈕、輸入框等視覺元素的創建、顯示、隱藏和樣式應用。
	// 依賴：AppConfig
	// ============================================================================
	const UIManager = (function() {
		let currentModal = null;
		let toastTimeoutId = null;

		// 內部 CSS 樣式字符串
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

            #${AppConfig.TOOL_ID} *, #${AppConfig.TOOL_ID} *:before, #${AppConfig.TOOL_ID} *:after {
                box-sizing: border-box;
            }
            #${AppConfig.TOOL_ID} {
                font-size: 16px;
            }

            /* ============================================================================
             * Modal 彈窗樣式
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
                /* top, left will be set by JS for dragging, default for initial display */
                transform: translateX(-50%) translateY(-20px); /* Initial slightly up for animation */
                opacity: 0;
                z-index: 10000;
                transition: opacity var(--transition-speed) cubic-bezier(0.25, 0.8, 0.25, 1), transform var(--transition-speed) cubic-bezier(0.25, 0.8, 0.25, 1);
                display: flex;
                flex-direction: column;
            }
            .pct-modal.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
            /* Draggable specific styles */
            .pct-modal.dragging {
                transition: none; /* Disable transition during drag */
            }

            .pct-modal-header {
                padding: 16px 20px 8px 20px;
                font-size: 20px;
                font-weight: bold;
                border-bottom: 1px solid var(--border-color);
                color: var(--text-color-dark);
                cursor: grab; /* Indicate draggable */
            }
            .pct-modal-header.dragging {
                cursor: grabbing;
            }

            .pct-modal-body {
                padding: 16px 20px 8px 20px;
                flex-grow: 1; /* Allow body to expand */
                overflow-y: auto; /* Enable scrolling if content is too long */
                min-height: 50px; /* Prevent body from collapsing */
            }

            .pct-modal-footer {
                padding: 12px 20px 16px 20px;
                text-align: right;
                border-top: 1px solid var(--border-color);
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                flex-wrap: wrap;
            }

            /* ============================================================================
             * 按鈕樣式 (優化您的 pct-btn)
             * ============================================================================ */
            .pct-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin: 0;
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
                white-space: nowrap;
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
                background: #CED4DA;
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
                padding: 9px 12px;
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
                display: block;
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
                grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
                gap: 10px;
                margin-bottom: 20px;
            }

            .pct-mode-card {
                background: var(--background-light);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-base);
                padding: 18px 10px;
                text-align: center;
                cursor: pointer;
                transition: all var(--transition-speed) ease-out;
                font-weight: 500;
                font-size: 15px;
                color: var(--text-color-dark);
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 65px;
                box-shadow: 0 2px 6px var(--box-shadow-light);
            }
            .pct-mode-card:hover {
                border-color: var(--primary-color);
                transform: translateY(-3px) scale(1.02);
                box-shadow: 0 6px 15px rgba(74, 144, 226, 0.2);
            }
            .pct-mode-card.selected {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
                transform: translateY(-1px);
                box-shadow: 0 4px 10px var(--primary-dark-color);
                font-weight: bold;
            }
            .pct-mode-card.selected:hover {
                background: var(--primary-dark-color);
            }

            /* 子選項按鈕 (主檔/通路現售停售) */
            .pct-sub-option-grid, .pct-channel-option-grid {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 10px;
                margin-bottom: 15px;
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
                display: inline-flex;
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
             * 表格樣式
             * ============================================================================ */
            .pct-table-wrap {
                max-height: 55vh;
                overflow: auto;
                margin: 15px 0;
            }
            .pct-table {
                border-collapse: collapse;
                width: 100%;
                font-size: 14px;
                background: var(--surface-color);
                min-width: 800px;
            }
            .pct-table th, .pct-table td {
                border: 1px solid #ddd;
                padding: 8px 10px;
                text-align: left;
                vertical-align: top;
            }
            .pct-table th {
                background: #f8f8f8;
                color: var(--text-color-dark);
                font-weight: bold;
                cursor: pointer;
                position: sticky;
                top: 0;
                z-index: 1;
                white-space: nowrap;
            }
            .pct-table th:hover { background: #e9ecef; }

            .pct-table tr.special-row {
                background: #fffde7;
                border-left: 4px solid var(--warning-color);
            }
            .pct-table tr:hover { background: #e3f2fd; }

            .pct-table td small {
                display: block;
                font-size: 11px;
                color: var(--text-color-light);
                margin-top: 2px;
            }

            /* 銷售狀態顏色 */
            .pct-status-onsale { color: #1976d2; font-weight: bold; }
            .pct-status-offsale { color: #e53935; font-weight: bold; }
            .pct-status-pending { color: var(--info-color); font-weight: bold; }
            .pct-status-abnormal { color: #8A2BE2; font-weight: bold; }

            /* ============================================================================
             * Toast 提示訊息
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
                pointer-events: none;
                transition: opacity .3s, transform .3s;
                box-shadow: 0 4px 12px var(--box-shadow-medium);
                white-space: nowrap;
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
             * 摘要與分頁
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
                justify-content: flex-end;
                align-items: center;
                gap: 10px;
                margin-top: 15px;
                flex-wrap: wrap;
            }
            .pct-pagination-info {
                margin-right: auto;
                font-size: 14px;
                color: var(--text-color-light);
            }
            .pct-pagination .pct-btn {
                padding: 6px 12px;
                font-size: 13px;
            }


            /* ============================================================================
             * RWD Adjustments (響應式設計)
             * ============================================================================ */
            @media (max-width: 768px) {
                .pct-modal {
                    min-width: unset;
                    width: 98vw;
                    top: 20px;
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
                    flex-direction: column;
                    align-items: stretch;
                    padding: 10px 15px 12px 15px;
                }
                .pct-btn, .pct-btn-secondary, .pct-btn-info, .pct-btn-success {
                    width: 100%;
                    margin: 4px 0;
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
                    max-height: 40vh;
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
                    transform: translateX(0);
                    text-align: center;
                    white-space: normal;
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
            }
        `;
		// 注入樣式到 <head>
		function injectStyles() {
			if (!document.getElementById(AppConfig.STYLE_ID)) {
				const style = document.createElement('style');
				style.id = AppConfig.STYLE_ID;
				style.textContent = INTERNAL_STYLES;
				document.head.appendChild(style);
			}
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
			closeModal(); // 確保舊的 Modal 已清理

			const mask = document.createElement('div');
			mask.className = 'pct-modal-mask';
			mask.addEventListener('click', (e) => {
				if (e.target === mask) {
					closeModal();
				}
			});

			const modal = document.createElement('div');
			modal.className = 'pct-modal';
			modal.setAttribute('role', 'dialog');
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
			};

			// Apply initial position for modal before showing
			modal.style.top = '60px'; // Default top as requested
			modal.style.left = '50%'; // Default left as requested
			modal.style.transform = 'translateX(-50%) translateY(-20px)'; // Initial transform for animation

			setTimeout(() => {
				mask.classList.add('show');
				modal.classList.add('show');
				modal.style.transform = 'translateX(-50%) translateY(0)'; // Final transform for animation
			}, 10);

			// Add drag functionality
			let isDragging = false;
			let currentX;
			let currentY;
			let initialX;
			let initialY;

			const header = modal.querySelector('.pct-modal-header');
			header.addEventListener('mousedown', (e) => {
				isDragging = true;
				initialX = e.clientX - modal.getBoundingClientRect().left;
				initialY = e.clientY - modal.getBoundingClientRect().top;
				modal.classList.add('dragging');
				header.classList.add('dragging');
				e.preventDefault(); // Prevent text selection
			});

			document.addEventListener('mousemove', (e) => {
				if (isDragging) {
					currentX = e.clientX - initialX;
					currentY = e.clientY - initialY;

					// Boundary checks
					const maxX = window.innerWidth - modal.offsetWidth;
					const maxY = window.innerHeight - modal.offsetHeight;

					modal.style.left = `${Math.max(0, Math.min(currentX, maxX))}px`;
					modal.style.top = `${Math.max(0, Math.min(currentY, maxY))}px`;
					modal.style.transform = 'none'; // Disable transform for dragging
					e.preventDefault(); // Prevent accidental selection during drag
				}
			});

			document.addEventListener('mouseup', () => {
				isDragging = false;
				modal.classList.remove('dragging');
				header.classList.remove('dragging');
			});

			const handleEscInstance = (e) => {
				if (e.key === 'Escape') {
					closeModal();
				}
			};
			document.addEventListener('keydown', handleEscInstance);
			currentModal.handleEscListener = handleEscInstance; // Store listener to remove it later

			if (onOpen) setTimeout(() => onOpen(modal), 50);
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
					const escListener = currentModal.handleEscListener;

					modalElement.classList.remove('show');
					maskElement.classList.remove('show');

					const onTransitionEnd = () => {
						if (modalElement.parentNode) modalElement.remove();
						if (maskElement.parentNode) maskElement.remove();
						if (escListener) {
							document.removeEventListener('keydown', escListener);
						}
						currentModal = null;
						resolve();
					};

					modalElement.addEventListener('transitionend', onTransitionEnd, {
						once: true
					});

					// Fallback for transitionend not firing (e.g., if element is removed too fast)
					setTimeout(() => {
						if (currentModal === null) return; // Already closed by transitionend
						onTransitionEnd();
					}, 300);
				} else {
					resolve();
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
			if (toastTimeoutId) {
				clearTimeout(toastTimeoutId);
				const existingToast = document.getElementById('pct-toast');
				if (existingToast) {
					existingToast.classList.remove('pct-toast-show');
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
			el.className = `pct-toast ${type}`;
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
				el.style.display = 'block';
			} else {
				showToast(msg, 'error');
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
	// APIService 模組: API 服務層
	// 統一處理所有對後端 API 的網路請求，管理 Token 傳遞和基礎錯誤處理。
	// 依賴：AppConfig, UIManager
	// ============================================================================
	const APIService = (function(AppConfig, UIManager) {
		let currentToken = ''; // 內部維護 token 狀態，由 AppCore 設定

		function setToken(token) {
			currentToken = token;
		}

		async function callApi(endpoint, params) {
			const response = await fetch(`${endpoint}`, { // endpoint 會由 AppCore 傳入完整的 URL
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'SSO-TOKEN': currentToken // 使用內部維護的 token
				},
				body: JSON.stringify(params)
			});

			if (!response.ok) {
				const errorText = await response.text();
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
		}

		async function verifyToken(token, apiBaseUrl) {
			try {
				const res = await fetch(`${apiBaseUrl}/planCodeController/query`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'SSO-TOKEN': token
					},
					body: JSON.stringify({
						planCode: '5105',
						pageNo: 1,
						pageSize: 1
					})
				});
				const data = await res.json();
				return res.ok && !!data.records;
			} catch (e) {
				console.error('Token 驗證請求失敗:', e);
				return false;
			}
		}

		return {
			setToken,
			callApi,
			verifyToken
		};
	})(AppConfig, UIManager);

	// ============================================================================
	// DataProcessor 模組: 數據處理與轉換
	// 專注於原始 API 響應的處理、轉換和正規化，使其適合 UI 顯示和進一步篩選。
	// 依賴：AppConfig, APIService, Utils
	// ============================================================================
	const DataProcessor = (function(AppConfig, APIService, Utils) {
		let _allRawData = []; // 原始數據備份，用於「一鍵查詢全部詳細」功能
		let _cacheDetail = new Map(); // 詳情快取 (planCode -> polpln string)
		let _cacheChannel = new Map(); // 通路快取 (planCode -> array of channel objects)

		// 清空所有快取和數據
		function resetData() {
			_allRawData = [];
			_cacheDetail.clear();
			_cacheChannel.clear();
		}

		/**
		 * 處理並格式化所有原始數據為表格所需格式，包括詳情和通路查詢。
		 * @param {Array<Object>} rawData - 從 API 獲取的原始數據。
		 * @param {string} apiBaseUrl - API 基礎 URL。
		 * @param {boolean} forceFetch - 是否強制重新獲取詳情和通路資料，忽略快取。
		 * @returns {Promise<Array<Object>>} 處理後的數據陣列。
		 */
		async function processAllDataForTable(rawData, apiBaseUrl, forceFetch = false) {
			_allRawData = rawData; // 保存原始數據
			const todayStr = Utils.formatToday();
			const processedItems = [];

			const promises = _allRawData.map(async (item) => {
				// 如果是查詢失敗的特殊行，直接處理並返回
				if (item._isErrorRow) {
					return {
						no: 0, // Placeholder, will be updated later
						planCode: item.planCode || '-',
						shortName: '-',
						currency: '-',
						unit: '-',
						coverageType: '-',
						saleStartDate: '-',
						saleEndDate: `查詢狀態: ${Utils.escapeHtml(item._apiStatus)}`,
						mainStatus: '-',
						polpln: '-',
						channels: [],
						special: false,
						_isErrorRow: true
					};
				}

				let polpln = item.polpln || '';
				if (!polpln || forceFetch || !_cacheDetail.has(item.planCode)) { // 如果沒有 polpln 或強制查詢 或快取中沒有
					try {
						const detail = await APIService.callApi(`${apiBaseUrl}/planCodeController/queryDetail`, {
							planCode: item.planCode,
							pageNo: 1,
							pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
						});
						polpln = (detail.records || []).map(r => r.polpln).filter(Boolean).join(', ');
						_cacheDetail.set(item.planCode, polpln);
					} catch (e) {
						console.warn(`查詢 ${item.planCode} 詳情失敗：`, e.message);
						polpln = '';
					}
				} else {
					polpln = _cacheDetail.get(item.planCode); // 從快取中獲取
				}


				let channels = item.channels || [];
				if (channels.length === 0 || forceFetch || !_cacheChannel.has(item.planCode)) { // 如果沒有 channels 或強制查詢 或快取中沒有
					try {
						const sale = await APIService.callApi(`${apiBaseUrl}/planCodeSaleDateController/query`, {
							planCode: item.planCode,
							pageNo: 1,
							pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL
						});
						channels = (sale.planCodeSaleDates?.records || []).map(r => ({
							channel: Utils.channelCodeConvert(r.channel),
							saleStartDate: Utils.formatDateForUI(r.saleStartDate), // UI 顯示 YYYYMMDD
							saleEndDate: Utils.formatDateForUI(r.saleEndDate), // UI 顯示 YYYYMMDD
							status: Utils.getSaleStatus(todayStr, r.saleStartDate, r.saleEndDate), // 判斷狀態用原始 YYYY-MM-DD HH:MM:SS
							rawStart: r.saleStartDate, // 儲存原始格式用於特殊狀態判斷
							rawEnd: r.saleEndDate // 儲存原始格式用於特殊狀態判斷
						}));
						_cacheChannel.set(item.planCode, channels);
					} catch (e) {
						console.warn(`查詢 ${item.planCode} 通路失敗：`, e.message);
						channels = [];
					}
				} else {
					channels = _cacheChannel.get(item.planCode); // 從快取中獲取
				}

				const mainSaleStartDate = Utils.formatDateForUI(item.saleStartDate); // UI 顯示 YYYYMMDD
				const mainSaleEndDate = Utils.formatDateForUI(item.saleEndDate); // UI 顯示 YYYYMMDD

				const mainStatus = Utils.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate); // 判斷狀態用原始 YYYY-MM-DD HH:MM:SS

				const processedItem = {
					no: 0,
					planCode: item.planCode || '-',
					shortName: item.shortName || item.planName || '-',
					currency: Utils.currencyConvert(item.currency || item.cur),
					unit: Utils.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
					coverageType: Utils.coverageTypeConvert(item.coverageType || item.type),
					saleStartDate: mainSaleStartDate,
					saleEndDate: mainSaleEndDate,
					mainStatus,
					polpln,
					channels,
					special: false,
					_isErrorRow: false,
					_originalItem: item // 儲存原始數據以供未來使用
				};

				processedItem.special = Utils.checkSpecialStatus(processedItem); // 依賴 Utils 中的 checkSpecialStatus

				return processedItem;
			});

			const results = await Promise.allSettled(promises);
			const fulfilledData = results.filter(result => result.status === 'fulfilled').map(result => result.value);

			fulfilledData.forEach((item, idx) => item.no = idx + 1); // 重新編號

			return fulfilledData;
		}

		/**
		 * 對數據進行排序。
		 * @param {Array<Object>} data - 要排序的數據。
		 * @param {string} sortKey - 排序鍵。
		 * @param {boolean} sortAsc - 升序 (true) 或降序 (false)。
		 * @returns {Array<Object>} 排序後的數據。
		 */
		function sortData(data, sortKey, sortAsc) {
			if (!sortKey) return data;
			return [...data].sort((a, b) => { // 複製陣列避免修改原陣列
				const valA = a[sortKey];
				const valB = b[sortKey];

				// 對日期欄位進行特殊處理 (使用比較用的 YYYY-MM-DD 格式)
				if (sortKey.includes('Date')) {
					const dateA = new Date(Utils.formatDateForComparison(valA));
					const dateB = new Date(Utils.formatDateForComparison(valB));
					if (isNaN(dateA) && isNaN(dateB)) return 0;
					if (isNaN(dateA)) return sortAsc ? 1 : -1;
					if (isNaN(dateB)) return sortAsc ? -1 : 1;
					if (dateA > dateB) return sortAsc ? 1 : -1;
					if (dateA < dateB) return sortAsc ? -1 : 1;
					return 0;
				}

				if (valA === undefined || valA === null) return sortAsc ? 1 : -1;
				if (valB === undefined || valB === null) return sortAsc ? -1 : 1;
				if (typeof valA === 'string' && typeof valB === 'string') {
					return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
				}
				if (valA > valB) return sortAsc ? 1 : -1;
				if (valA < valB) return sortAsc ? -1 : 1;
				return 0;
			});
		}

		/**
		 * 清除詳情和通路快取。
		 */
		function clearCaches() {
			_cacheDetail.clear();
			_cacheChannel.clear();
		}

		/**
		 * 獲取所有原始數據的副本。
		 * @returns {Array<Object>} 原始數據陣列。
		 */
		function getRawData() {
			return [..._allRawData];
		}

		return {
			resetData,
			processAllDataForTable,
			sortData,
			clearCaches,
			getRawData
		};
	})(AppConfig, APIService, Utils);


	// ============================================================================
	// AppCore 模組: 核心業務邏輯
	// 作為應用程式的主要協調器，管理整體流程、狀態和模組間的互動。
	// 依賴：AppConfig, UIManager, APIService, DataProcessor, Utils
	// ============================================================================
	const AppCore = (function(AppConfig, UIManager, APIService, DataProcessor, Utils) {
		let env = '';
		let apiBase = '';
		let token = '';
		let tokenCheckEnabled = true;

		let allProcessedData = []; // 經過處理後、用於表格渲染的數據
		let queryMode = '';
		let queryInput = ''; // 儲存使用者原始輸入，用於重新查詢
		let querySubOption = [];
		let queryChannels = [];
		let pageNo = 1;
		let pageSize = AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE;
		let totalRecords = 0;
		let filterSpecial = false;
		let sortKey = '';
		let sortAsc = true;
		let detailQueryCount = 0; // 記錄「一鍵查詢全部詳細」點擊次數

		// ====== 啟動入口 ======
		async function start() {
			env = detectEnv();
			apiBase = env === 'PROD' ?
				AppConfig.API_ENDPOINTS.PROD :
				AppConfig.API_ENDPOINTS.UAT;

			// 重置所有數據和狀態
			resetAppState();
			DataProcessor.resetData(); // 清空 DataProcessor 的內部數據和快取

			UIManager.injectStyles();

			token = localStorage.getItem('SSO-TOKEN') || '';
			APIService.setToken(token); // 設定 Token 給 APIService

			if (token && tokenCheckEnabled) {
				UIManager.showToast('正在驗證 Token，請稍候...', 'info');
				const isValid = await APIService.verifyToken(token, apiBase); // 傳入 apiBase
				if (isValid) {
					UIManager.showToast('Token 驗證成功，已自動登入。', 'success');
					showQueryDialog();
					return;
				} else {
					UIManager.showToast('Token 無效，請重新設定。', 'warning');
					localStorage.removeItem('SSO-TOKEN');
					token = '';
					APIService.setToken('');
				}
			}
			showTokenDialog();
		}

		// 重置應用程式狀態
		function resetAppState() {
			allProcessedData = [];
			queryMode = '';
			queryInput = '';
			querySubOption = [];
			queryChannels = [];
			pageNo = 1;
			totalRecords = 0;
			filterSpecial = false;
			sortKey = '';
			sortAsc = true;
			detailQueryCount = 0; // 重置點擊次數
		}

		function detectEnv() {
			const host = window.location.host.toLowerCase();
			if (host.includes('uat') || host.includes('test') || host.includes('dev') || host.includes('stg')) {
				return 'UAT';
			}
			return 'PROD';
		}

		function envLabel() {
			return env === 'PROD' ? '正式環境' : '測試環境';
		}

		// ====== Token 輸入與驗證流程 ======
		function showTokenDialog() {
			UIManager.showModal({
				title: `商品查詢小工具（${envLabel()}）`,
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

					tokenInput.value = token || '';
					tokenInput.focus();
					UIManager.hideError('pct-token-err');

					confirmBtn.onclick = async () => {
						const val = tokenInput.value.trim();
						if (!val) {
							UIManager.showError('請輸入 Token', 'pct-token-err');
							return;
						}
						UIManager.showToast('檢查 Token 中...', 'info');
						token = val;
						APIService.setToken(val); // 更新 APIService 的 Token
						localStorage.setItem('SSO-TOKEN', val);
						const isValid = await APIService.verifyToken(val, apiBase);

						if (tokenCheckEnabled) {
							if (isValid) {
								await UIManager.closeModal();
								UIManager.showToast('Token 驗證成功', 'success');
								showQueryDialog();
							} else {
								UIManager.showError('Token 驗證失敗，請重新輸入', 'pct-token-err');
							}
						} else {
							await UIManager.closeModal();
							UIManager.showToast('Token 已儲存 (未驗證)', 'info');
							showQueryDialog();
						}
					};
					skipBtn.onclick = async () => {
						tokenCheckEnabled = false;
						await UIManager.closeModal();
						UIManager.showToast('已略過 Token 驗證', 'warning');
						showQueryDialog();
					};
				}
			});
		}

		// ====== 查詢條件輸入流程 ======
		function showQueryDialog() {
			const primaryQueryModes = [
				AppConfig.QUERY_MODES.PLAN_CODE,
				AppConfig.QUERY_MODES.PLAN_NAME,
				AppConfig.QUERY_MODES.ALL_MASTER_PLANS,
				'masterDataCategory',
				'channelDataCategory'
			];

			UIManager.showModal({
				title: '查詢條件設定',
				body: `
                    <div class="pct-form-group">
                        <div class="pct-label">查詢模式：</div>
                        <div id="pct-mode-wrap" class="pct-mode-card-grid">
                            ${primaryQueryModes.map(mode =>
                                `<div class="pct-mode-card" data-mode="${mode}">${modeLabel(mode)}</div>`
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
					let currentPrimaryMode = queryMode; // 恢復上次的選擇
					let currentQueryInput = queryInput;
					let currentSubOptions = [...querySubOption];
					let currentChannels = [...queryChannels];

					const dynamicContentArea = modalElement.querySelector('#pct-dynamic-query-content');
					const modeCards = modalElement.querySelectorAll('#pct-mode-wrap .pct-mode-card');
					const queryOkBtn = modalElement.querySelector('#pct-query-ok');
					const queryCancelBtn = modalElement.querySelector('#pct-query-cancel');
					const clearSelectionBtn = modalElement.querySelector('#pct-query-clear-selection');

					const updateDynamicContent = () => {
						dynamicContentArea.innerHTML = '';
						UIManager.hideError('pct-query-err');

						let inputHtml = '';
						let subOptionHtml = '';
						let channelSelectionHtml = '';
						switch (currentPrimaryMode) {
							case AppConfig.QUERY_MODES.PLAN_CODE:
								inputHtml = `
                                    <div class="pct-form-group">
                                        <label for="pct-query-input" class="pct-label">輸入商品代碼：</label>
                                        <textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品代碼 (多筆請用空格、逗號、分號或換行分隔)"></textarea>
                                    </div>
                                `;
								break;
							case AppConfig.QUERY_MODES.PLAN_NAME:
								inputHtml = `
                                    <div class="pct-form-group">
                                        <label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label>
                                        <textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea>
                                    </div>
                                `;
								break;
							case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
								inputHtml = `<div style="text-align: center; padding: 20px; color: var(--text-color-light);">將查詢所有主檔商品，無需輸入任何條件。</div>`;
								break;
							case 'masterDataCategory':
								subOptionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇主檔查詢範圍：</div>
                                        <div class="pct-sub-option-grid">
                                            <div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.MASTER_IN_SALE}">現售商品</div>
                                            <div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.MASTER_STOPPED}">停售商品</div>
                                        </div>
                                    </div>
                                `;
								break;
							case 'channelDataCategory':
								channelSelectionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇通路：(可多選，不選則查詢所有通路)</div>
                                        <div class="pct-channel-option-grid">
                                            ${AppConfig.FIELD_MAPS.CHANNELS.map(ch =>
                                                `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`
                                            ).join('')}
                                        </div>
                                    </div>
                                `;
								subOptionHtml = `
                                    <div class="pct-form-group">
                                        <div class="pct-label">選擇通路銷售範圍：</div>
                                        <div class="pct-sub-option-grid">
                                            <div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.CHANNEL_IN_SALE}">現售通路</div>
                                            <div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.CHANNEL_STOPPED}">停售通路</div>
                                        </div>
                                    </div>
                                `;
								break;
						}

						dynamicContentArea.innerHTML = inputHtml + channelSelectionHtml + subOptionHtml;

						const newQueryInput = dynamicContentArea.querySelector('#pct-query-input');
						if (newQueryInput) {
							newQueryInput.value = currentQueryInput;
							newQueryInput.addEventListener('input', (e) => {
								currentQueryInput = e.target.value;
								UIManager.hideError('pct-query-err');
							});
						}

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

					const updateModeCardUI = () => {
						modeCards.forEach(card => {
							card.classList.toggle('selected', card.dataset.mode === currentPrimaryMode);
						});
					};

					updateModeCardUI();
					updateDynamicContent();
					modeCards.forEach(card => {
						card.onclick = () => {
							currentPrimaryMode = card.dataset.mode;
							updateModeCardUI();
							currentQueryInput = '';
							currentSubOptions = [];
							currentChannels = [];
							updateDynamicContent();
						};
					});
					clearSelectionBtn.onclick = () => {
						currentPrimaryMode = '';
						currentQueryInput = '';
						currentSubOptions = [];
						currentChannels = [];
						updateModeCardUI();
						dynamicContentArea.innerHTML = ''; // 清空動態內容
						UIManager.showToast('已清除所有查詢條件', 'info');
					};

					queryOkBtn.onclick = () => {
						let finalMode = currentPrimaryMode;
						let finalInput = currentQueryInput;
						let finalSubOptions = currentSubOptions;
						let finalChannels = currentChannels;

						if (currentPrimaryMode === 'masterDataCategory') {
							if (currentSubOptions.length === 0 || currentSubOptions.length > 1) { // 確保單選
								UIManager.showError('請選擇主檔查詢範圍 (現售/停售)', 'pct-query-err');
								return;
							}
							finalMode = currentSubOptions[0];
						} else if (currentPrimaryMode === 'channelDataCategory') {
							if (currentSubOptions.length === 0 || currentSubOptions.length > 1) { // 確保單選
								UIManager.showError('請選擇通路銷售範圍 (現售/停售)', 'pct-query-err');
								return;
							}
							finalMode = currentSubOptions[0];
						} else if (!currentPrimaryMode) {
							UIManager.showError('請選擇查詢模式', 'pct-query-err');
							return;
						}

						if ([AppConfig.QUERY_MODES.PLAN_CODE, AppConfig.QUERY_MODES.PLAN_NAME].includes(finalMode) && !finalInput) {
							UIManager.showError('請輸入查詢內容', 'pct-query-err');
							return;
						}

						queryMode = finalMode;
						queryInput = finalInput;
						querySubOption = finalSubOptions;
						queryChannels = finalChannels;
						pageNo = 1;
						filterSpecial = false;
						detailQueryCount = 0; // 新的查詢，重置詳細查詢的點擊次數

						UIManager.closeModal();
						doQuery();
					};

					queryCancelBtn.onclick = () => {
						UIManager.closeModal();
					};

					// 初始恢復選中狀態
					if (queryMode) {
						const modeToSelect = primaryQueryModes.find(pm => {
							if (pm === queryMode) return true;
							if (pm === 'masterDataCategory' && [AppConfig.QUERY_MODES.MASTER_IN_SALE, AppConfig.QUERY_MODES.MASTER_STOPPED].includes(queryMode)) return true;
							if (pm === 'channelDataCategory' && [AppConfig.QUERY_MODES.CHANNEL_IN_SALE, AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) return true;
							return false;
						});
						if (modeToSelect) {
							currentPrimaryMode = modeToSelect;
							updateModeCardUI();
							updateDynamicContent();
							if (modeToSelect === 'masterDataCategory' || modeToSelect === 'channelDataCategory') {
								const subOptionElement = dynamicContentArea.querySelector(`[data-sub-option="${queryMode}"]`);
								if (subOptionElement) {
									subOptionElement.classList.add('selected');
								}
							}
							if (modeToSelect === 'channelDataCategory' && queryChannels.length > 0) {
								queryChannels.forEach(ch => {
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
		}

		function modeLabel(mode) {
			switch (mode) {
				case AppConfig.QUERY_MODES.PLAN_CODE:
					return '商品代號';
				case AppConfig.QUERY_MODES.PLAN_NAME:
					return '商品名稱關鍵字';
				case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
					return '查詢全部主檔';
				case 'masterDataCategory':
					return '主檔資料';
				case 'channelDataCategory':
					return '通路資料';
				case AppConfig.QUERY_MODES.MASTER_IN_SALE:
					return '主檔現售';
				case AppConfig.QUERY_MODES.MASTER_STOPPED:
					return '主檔停售';
				case AppConfig.QUERY_MODES.CHANNEL_IN_SALE:
					return '通路現售';
				case AppConfig.QUERY_MODES.CHANNEL_STOPPED:
					return '通路停售';
				default:
					return mode;
			}
		}

		// ====== 查詢執行與數據獲取 ======
		async function doQuery() {
			UIManager.showToast('查詢中...', 'info');
			DataProcessor.resetData(); // 清空 DataProcessor 的快取和原始數據
			allProcessedData = [];
			totalRecords = 0;
			let rawRecords = [];
			let currentTotalRecords = 0;
			const pageSize = AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER;
			try {
				if ([AppConfig.QUERY_MODES.PLAN_CODE, AppConfig.QUERY_MODES.PLAN_NAME, AppConfig.QUERY_MODES.ALL_MASTER_PLANS, AppConfig.QUERY_MODES.MASTER_IN_SALE].includes(queryMode)) {
					if (queryMode === AppConfig.QUERY_MODES.PLAN_CODE && queryInput.includes(',')) {
						const planCodes = Utils.splitInput(queryInput);
						UIManager.showToast(`查詢 ${planCodes.length} 個商品代號中...`, 'info', 3000);
						const multiQueryResult = await queryMultiplePlanCodes(planCodes);
						rawRecords = multiQueryResult.records;
						currentTotalRecords = multiQueryResult.totalRecords;
					} else {
						const params = buildMasterQueryParams(queryMode, queryInput, 1, pageSize);
						const result = await APIService.callApi(`${apiBase}/planCodeController/query`, params);
						rawRecords = result.records || [];
						currentTotalRecords = result.totalRecords || 0;
					}

				} else if (queryMode === AppConfig.QUERY_MODES.MASTER_STOPPED) {
					const params = buildMasterQueryParams(AppConfig.QUERY_MODES.ALL_MASTER_PLANS, '', 1, pageSize);
					const result = await APIService.callApi(`${apiBase}/planCodeController/query`, params);
					rawRecords = (result.records || []).filter(item =>
						Utils.getSaleStatus(Utils.formatToday(), item.saleStartDate, item.saleEndDate) === AppConfig.SALE_STATUS.STOPPED
					);
					currentTotalRecords = rawRecords.length;
				} else if ([AppConfig.QUERY_MODES.CHANNEL_IN_SALE, AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
					const channelsToQuery = queryChannels.length > 0 ? queryChannels : AppConfig.FIELD_MAPS.CHANNELS;
					let allChannelRecords = [];
					for (const channel of channelsToQuery) {
						const baseParams = {
							"channel": channel,
							"saleEndDate": (queryMode === AppConfig.QUERY_MODES.CHANNEL_IN_SALE) ? "9999-12-31 00:00:00" : "",
							"pageIndex": 1,
							"size": AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
							"orderBys": ["planCode asc"]
						};
						const result = await APIService.callApi(`${apiBase}/planCodeSaleDateController/query`, baseParams);
						let channelRecords = result.planCodeSaleDates?.records || [];
						if (queryMode === AppConfig.QUERY_MODES.CHANNEL_STOPPED) {
							channelRecords = channelRecords.filter(item =>
								Utils.getSaleStatus(Utils.formatToday(), item.saleStartDate, item.saleEndDate) === AppConfig.SALE_STATUS.STOPPED
							);
						}
						channelRecords.forEach(r => r._sourceChannel = channel);
						allChannelRecords.push(...channelRecords);
					}
					const uniqueChannelRecords = [];
					const seenChannelEntries = new Set();
					for (const record of allChannelRecords) {
						const identifier = record.planCode + (record._sourceChannel || '');
						if (!seenChannelEntries.has(identifier)) {
							seenChannelEntries.add(identifier);
							uniqueChannelRecords.push(record);
						}
					}
					rawRecords = uniqueChannelRecords;
					currentTotalRecords = uniqueChannelRecords.length;
				} else {
					throw new Error('未知的查詢模式或條件不完整');
				}

				totalRecords = currentTotalRecords;
				// 初始查詢不強制刷新快取
				allProcessedData = await DataProcessor.processAllDataForTable(rawRecords, apiBase, false);

				// 初始排序應用 (如果已經有排序，則應用)
				if (sortKey) {
					allProcessedData = DataProcessor.sortData(allProcessedData, sortKey, sortAsc);
				}

				renderTable();
				UIManager.showToast(`查詢完成，共 ${allProcessedData.length} 筆資料`, 'success');
			} catch (e) {
				UIManager.showToast(`查詢 API 失敗：${e.message}`, 'error');
				console.error('查詢 API 失敗:', e);
				allProcessedData = [];
				totalRecords = 0;
				renderTable();
			}
		}

		function buildMasterQueryParams(mode, input, pageNo, pageSize) {
			const params = {
				pageNo,
				pageSize
			};
			switch (mode) {
				case AppConfig.QUERY_MODES.PLAN_CODE:
					params.planCode = input;
					break;
				case AppConfig.QUERY_MODES.PLAN_NAME:
					params.planCodeName = input;
					break;
				case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
					params.planCodeName = '';
					break;
				case AppConfig.QUERY_MODES.MASTER_IN_SALE:
					params.saleEndDate = '9999-12-31 00:00:00';
					break;
				default:
					throw new Error('無效的主檔查詢模式');
			}
			return params;
		}

		async function queryMultiplePlanCodes(planCodes) {
			const allRecords = [];
			for (let i = 0; i < planCodes.length; i++) {
				const planCode = planCodes[i];
				try {
					UIManager.showToast(`查詢商品代號 ${planCode} (${i + 1}/${planCodes.length})...`, 'info', 1000);
					const params = {
						planCode,
						pageNo: 1,
						pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL
					};
					const result = await APIService.callApi(`${apiBase}/planCodeController/query`, params);
					if (result.records && result.records.length > 0) {
						result.records.forEach(record => record._querySourcePlanCode = planCode);
						allRecords.push(...result.records);
					} else {
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
		}


		// 處理「一鍵查詢全部詳細」邏輯
		async function handleDetailQuery() {
			detailQueryCount++;
			if (detailQueryCount === 1) {
				// 第一次點擊：不清空快取，只查詢尚未有完整詳情的項目
				UIManager.showToast('第一次查詢詳細資料，僅補齊尚未載入的數據...', 'info', 3000);
				await updateAllDetailsAndRefreshTable(false); // 不強制刷新快取
			} else {
				// 第二次及之後點擊：提示是否要清空快取重新查詢
				const confirmReset = confirm('您已點擊過「一鍵查詢全部詳細」。再次點擊將清空所有快取並重新查詢所有數據，這可能需要一些時間。您確定要繼續嗎？');
				if (confirmReset) {
					UIManager.showToast('清空快取並重新查詢所有詳細資料中...', 'info', 3000);
					await updateAllDetailsAndRefreshTable(true); // 強制刷新快取
				} else {
					UIManager.showToast('已取消操作。', 'info');
				}
			}
		}

		// 重新處理所有數據以更新表格（例如，一鍵查詢詳情後）
		async function updateAllDetailsAndRefreshTable(forceFetch = false) {
			const rawData = DataProcessor.getRawData(); // 獲取原始數據備份
			if (rawData.length === 0 && !forceFetch) { // 如果沒有原始數據且不是強制刷新 (通常不會發生，除非是通路查詢模式)
				UIManager.showToast('沒有原始數據可供查詢詳細資訊', 'warning');
				return;
			}
			allProcessedData = await DataProcessor.processAllDataForTable(rawData, apiBase, forceFetch); // 重新處理所有原始數據

			if (allProcessedData.length > 0) {
				// 重新排序已處理的數據
				if (sortKey) {
					allProcessedData = DataProcessor.sortData(allProcessedData, sortKey, sortAsc);
				}
				renderTable();
				UIManager.showToast('詳細資料查詢完成', 'success');
			} else {
				renderTable();
				UIManager.showToast('詳細查詢完成，但沒有可更新詳情的資料', 'warning');
			}
		}

		// ====== 表格渲染與互動 ======
		function renderTable() {
			let displayedData = filterSpecial ?
				allProcessedData.filter(r => r.special) : allProcessedData;
			const totalPages = Math.ceil(displayedData.length / pageSize);
			const startIndex = (pageNo - 1) * pageSize;
			const endIndex = startIndex + pageSize;
			const pageData = displayedData.slice(startIndex, endIndex);

			const hasPrev = pageNo > 1;
			const hasNext = pageNo < totalPages;
			const hasSpecialData = allProcessedData.some(r => r.special);

			UIManager.showModal({
				title: `查詢結果（${envLabel()}）`,
				body: renderSummary(displayedData, hasSpecialData) + renderTableHTML(pageData),
				footer: `
                    <button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${!hasPrev ? 'disabled' : ''}>上一頁</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-table-next" ${!hasNext ? 'disabled' : ''}>下一頁</button>
                    <div class="pct-pagination-info">第 ${pageNo} 頁 / 共 ${totalPages} 頁 (總計 ${displayedData.length} 筆)</div>
                    <div style="flex-grow:1;"></div>
                    <button class="pct-btn pct-btn-info" id="pct-table-detail">一鍵查詢全部詳細</button>
                    <button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>
                    ${hasSpecialData ? `<button class="pct-btn ${filterSpecial ? 'pct-filter-btn-active' : 'pct-filter-btn'}" id="pct-table-filter">${filterSpecial ? '顯示全部' : '篩選特殊狀態'}</button>` : ''}
                    <button class="pct-btn" id="pct-table-requery">重新查詢</button>
                    <button class="pct-btn pct-btn-secondary" id="pct-table-close">關閉</button>
                `,
				onOpen: (modalElement) => {
					modalElement.querySelector('#pct-table-detail').onclick = () => {
						handleDetailQuery(); // 使用新的詳細查詢處理函數
					};

					modalElement.querySelector('#pct-table-copy').onclick = () => {
						Utils.copyTextToClipboard(renderTableText(displayedData), UIManager.showToast);
					};

					modalElement.querySelector('#pct-table-prev').onclick = () => {
						if (pageNo > 1) {
							pageNo--;
							renderTable();
						}
					};
					modalElement.querySelector('#pct-table-next').onclick = () => {
						if (pageNo < totalPages) {
							pageNo++;
							renderTable();
						}
					};

					const filterBtn = modalElement.querySelector('#pct-table-filter');
					if (filterBtn) {
						filterBtn.onclick = () => {
							filterSpecial = !filterSpecial;
							pageNo = 1;
							renderTable();
						};
					}

					modalElement.querySelector('#pct-table-requery').onclick = () => {
						UIManager.closeModal();
						start();
					};

					modalElement.querySelector('#pct-table-close').onclick = () => {
						UIManager.closeModal();
					};

					modalElement.querySelectorAll('.pct-table th').forEach(th => {
						th.onclick = () => {
							const key = th.dataset.key;
							if (!key) return;

							if (sortKey === key) {
								sortAsc = !sortAsc;
							} else {
								sortKey = key;
								sortAsc = true;
							}

							allProcessedData = DataProcessor.sortData(allProcessedData, sortKey, sortAsc);

							pageNo = 1;
							renderTable();
						};
					});
				}
			});
		}

		function renderSummary(data, hasSpecialData) {
			const specialCount = data.filter(r => r.special).length;
			let html = `<div class="pct-summary">共 ${data.length} 筆`;
			if (hasSpecialData) {
				html += `，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆`;
			}
			html += `</div>`;
			return html;
		}

		function renderTableHTML(data) {
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
				const escapedPlanCode = Utils.escapeHtml(row.planCode);
				const escapedShortName = Utils.escapeHtml(row.shortName);
				const escapedCurrency = Utils.escapeHtml(row.currency);
				const escapedUnit = Utils.escapeHtml(row.unit);
				const escapedCoverageType = Utils.escapeHtml(row.coverageType);
				const escapedSaleStartDate = Utils.escapeHtml(row.saleStartDate); // UI 顯示 YYYYMMDD
				const escapedSaleEndDate = Utils.escapeHtml(row.saleEndDate);     // UI 顯示 YYYYMMDD
				const escapedMainStatus = Utils.escapeHtml(row.mainStatus);
				const escapedPolpln = Utils.escapeHtml(row.polpln || '');

				const channelHtml = (row.channels || []).map(c => {
					const statusClass = c.status === AppConfig.SALE_STATUS.CURRENT ? 'pct-status-onsale' : (c.status === AppConfig.SALE_STATUS.STOPPED ? 'pct-status-offsale' : (c.status === AppConfig.SALE_STATUS.ABNORMAL ? 'pct-status-abnormal' : 'pct-status-pending'));
					return `<span class="${statusClass}">${Utils.escapeHtml(c.channel)}:${Utils.escapeHtml(c.saleEndDate)}（${Utils.escapeHtml(c.status)}）</span>`;
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
                        <td class="${row.mainStatus === AppConfig.SALE_STATUS.CURRENT ? 'pct-status-onsale' : row.mainStatus === AppConfig.SALE_STATUS.STOPPED ? 'pct-status-offsale' : (row.mainStatus === AppConfig.SALE_STATUS.ABNORMAL ? 'pct-status-abnormal' : 'pct-status-pending')}">${escapedMainStatus}</td>
                        <td>${escapedPolpln}</td>
                        <td>${channelHtml}</td>
                    </tr>
                `;
			});
			html += `</tbody></table></div>`;
			return html;
		}

		function renderTableText(data) {
			let txt = `No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n`;
			data.forEach(row => {
				let channelStr = (row.channels || []).map(c =>
					`${c.channel}:${c.saleEndDate}（${c.status}）`
				).join(' / ');
				txt += `${row.no}\t${row.planCode}\t${row.shortName}\t${row.currency}\t${row.unit}\t${row.coverageType}\t${row.saleStartDate}\t${row.saleEndDate}\t${row.mainStatus}\t${row.polpln}\t${channelStr}\n`;
			});
			return txt;
		}

		return {
			start
		};
	})(AppConfig, UIManager, APIService, DataProcessor, Utils);

	// ====== 啟動應用程式 ======
	AppCore.start();

})();
