(function() {
	// -------------------------------------------------------------------
	// AppConfig - 配置模組
	// -------------------------------------------------------------------
	const AppConfig = (function() {
		const STYLE_ID = 'pct-styles';
		const API_ENDPOINTS = {
			UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
			PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
		};
		const API_PATHS = {
			PLAN_CODE_QUERY: '/planCodeController/query',
			PLAN_CODE_DETAIL: '/planCodeController/queryDetail',
			PLAN_CODE_SALE_DATE: '/planCodeSaleDateController/query',
			VERIFY_TOKEN: '/verifyToken'
		};
		const QUERY_MODES = {
			PLAN_CODE: 'planCode',
			PLAN_NAME: 'planCodeName',
			ALL_MASTER_PLANS: 'allMasterPlans',
			MASTER_IN_SALE: 'masterInSale',
			MASTER_STOPPED: 'masterStopped',
			CHANNEL_IN_SALE: 'channelInSale',
			CHANNEL_STOPPED: 'channelStopped'
		};
		const DEFAULT_QUERY_PARAMS = {
			PAGE_SIZE_TABLE: 50,
			PAGE_SIZE_ALL: 1000
		};
		const FIELD_MAPS = {
			CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC'],
			STATUS: {
				IN_SALE: '現售',
				STOPPED: '停售',
				NOT_STARTED: '未開賣'
			}
		};
		return {
			STYLE_ID,
			API_ENDPOINTS,
			API_PATHS,
			QUERY_MODES,
			DEFAULT_QUERY_PARAMS,
			FIELD_MAPS
		};
	})();

	// -------------------------------------------------------------------
	// Utils - 工具函數
	// -------------------------------------------------------------------
	const Utils = (function() {
		function getToday() {
			const now = new Date();
			return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
		}

		function formatDate(dt) {
			if (!dt) return '';
			const datePart = String(dt).split(' ')[0].replace(/[- :]/g, '');
			return datePart.match(/^\d{8}$/) ? datePart : '';
		}

		function checkSpecialStatus(masterData, channelData) {
			const masterEndDate = formatDate(masterData.saleEndDate);
			const today = getToday();
			const isMasterStopped = masterEndDate && masterEndDate < today;
			const channelStatuses = channelData.map(ch => {
				const chEndDate = formatDate(ch.saleEndDate);
				return chEndDate === '99991231' ? '現售' : (chEndDate < today ? '停售' : '未開賣');
			});

			if (isMasterStopped && channelStatuses.includes('現售')) {
				return '主檔停售但通路現售';
			}
			if (!isMasterStopped && channelStatuses.every(s => s !== '現售')) {
				return '主檔現售但通路全停售或未開賣';
			}
			return '';
		}

		function splitInput(input) {
			return input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
		}

		function copyToClipboard(text) {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}

		return {
			getToday,
			formatDate,
			checkSpecialStatus,
			splitInput,
			copyToClipboard
		};
	})();

	// -------------------------------------------------------------------
	// UIManager - UI 管理模組
	// -------------------------------------------------------------------
	const UIManager = (function() {
		let currentModal = null;
		let toastTimeoutId = null;

		const INTERNAL_STYLES = `
            :root {
                --primary-color: #007bff;
                --secondary-color: #6c757d;
                --success-color: #28a745;
                --danger-color: #dc3545;
                --warning-color: #ffc107;
                --info-color: #17a2b8;
                --bg-color: #ffffff;
                --bg-color-secondary: #f8f9fa;
                --text-color: #212529;
                --text-color-light: #6c757d;
                --border-color: #dee2e6;
                --shadow-color: rgba(0, 0, 0, 0.1);
                --transition-speed: 0.2s;
            }
            .pct-modal-mask {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                opacity: 0;
                transition: opacity var(--transition-speed);
            }
            .pct-modal-mask.show {
                opacity: 1;
            }
            .pct-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--bg-color);
                border-radius: 8px;
                box-shadow: 0 4px 12px var(--shadow-color);
                z-index: 1001;
                min-width: 300px;
                max-width: 90%;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                opacity: 0;
                transition: opacity var(--transition-speed), transform var(--transition-speed);
            }
            .pct-modal.show {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            .pct-modal-header {
                padding: 12px 16px;
                background: var(--primary-color);
                color: #fff;
                font-size: 18px;
                border-radius: 8px 8px 0 0;
                user-select: none;
            }
            .pct-modal-body {
                padding: 16px;
                overflow-y: auto;
                flex: 1;
            }
            .pct-modal-footer {
                padding: 12px 16px;
                border-top: 1px solid var(--border-color);
                text-align: right;
            }
            .pct-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 5px;
                font-size: 14px;
                cursor: pointer;
                transition: background-color var(--transition-speed);
                background-color: var(--primary-color);
                color: #fff;
            }
            .pct-btn:hover {
                background-color: #0056b3;
            }
            .pct-btn-secondary {
                background-color: var(--secondary-color);
            }
            .pct-btn-secondary:hover {
                background-color: #5a6268;
            }
            .pct-form-group {
                margin-bottom: 16px;
            }
            .pct-label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: var(--text-color);
            }
            .pct-input {
                width: 100%;
                font-size: 16px;
                padding: 9px 12px;
                border-radius: 5px;
                border: 1px solid var(--border-color);
                box-sizing: border-box;
                margin-top: 5px;
                transition: border-color var(--transition-speed), box-shadow var(--transition-speed);
                resize: vertical;
            }
            .pct-input:focus {
                border-color: var(--primary-color);
                box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
                outline: none;
            }
            .pct-error {
                color: var(--danger-color);
                font-size: 12px;
                margin-top: 4px;
            }
            .pct-mode-card-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
            }
            .pct-mode-card {
                padding: 12px;
                border: 1px solid var(--border-color);
                border-radius: 5px;
                text-align: center;
                cursor: pointer;
                font-size: 14px;
                transition: all var(--transition-speed);
            }
            .pct-mode-card:hover {
                background-color: var(--bg-color-secondary);
            }
            .pct-mode-card.selected {
                border-color: var(--primary-color);
                background-color: rgba(0, 123, 255, 0.1);
            }
            .pct-sub-option-grid, .pct-channel-option-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 8px;
            }
            .pct-sub-option, .pct-channel-option {
                padding: 8px;
                border: 1px solid var(--border-color);
                border-radius: 5px;
                text-align: center;
                cursor: pointer;
                font-size: 13px;
            }
            .pct-sub-option.selected, .pct-channel-option.selected {
                border-color: var(--primary-color);
                background-color: rgba(0, 123, 255, 0.1);
            }
            .pct-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            .pct-table th, .pct-table td {
                padding: 8px;
                border: 1px solid var(--border-color);
                text-align: left;
            }
            .pct-table th {
                background-color: var(--bg-color-secondary);
                cursor: pointer;
            }
            .pct-table th:hover {
                background-color: #e9ecef;
            }
            .pct-table tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .pct-toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 5px;
                color: #fff;
                font-size: 14px;
                z-index: 1002;
                opacity: 0;
                transform: translateY(20px);
                transition: opacity var(--transition-speed), transform var(--transition-speed);
            }
            .pct-toast.show {
                opacity: 1;
                transform: translateY(0);
            }
            .pct-toast.info { background-color: var(--info-color); }
            .pct-toast.success { background-color: var(--success-color); }
            .pct-toast.warning { background-color: var(--warning-color); }
            .pct-toast.error { background-color: var(--danger-color); }
            @media (max-width: 768px) {
                .pct-modal {
                    width: 90%;
                    max-height: 80vh;
                }
                .pct-mode-card-grid, .pct-sub-option-grid, .pct-channel-option-grid {
                    grid-template-columns: 1fr;
                }
                .pct-table {
                    font-size: 12px;
                }
                .pct-table th, .pct-table td {
                    padding: 6px;
                }
            }
        `;

		function injectStyles() {
			if (!document.getElementById(AppConfig.STYLE_ID)) {
				const style = document.createElement('style');
				style.id = AppConfig.STYLE_ID;
				style.textContent = INTERNAL_STYLES;
				document.head.appendChild(style);
			}
		}

		function showModal({
			title,
			body,
			footer = '',
			onOpen
		}) {
			closeModal();
			const mask = document.createElement('div');
			mask.className = 'pct-modal-mask';
			mask.addEventListener('click', (e) => {
				if (e.target === mask) closeModal();
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

			let isDragging = false;
			let currentX = 0,
				currentY = 0,
				initialX = 0,
				initialY = 0;
			const header = modal.querySelector('.pct-modal-header');
			header.style.cursor = 'move';

			header.addEventListener('mousedown', (e) => {
				initialX = e.clientX - currentX;
				initialY = e.clientY - currentY;
				isDragging = true;
			});

			document.addEventListener('mousemove', (e) => {
				if (isDragging) {
					e.preventDefault();
					currentX = e.clientX - initialX;
					currentY = e.clientY - initialY;
					const maxX = window.innerWidth - modal.offsetWidth;
					const maxY = window.innerHeight - modal.offsetHeight;
					currentX = Math.max(0, Math.min(currentX, maxX));
					currentY = Math.max(0, Math.min(currentY, maxY));
					modal.style.left = `${currentX}px`;
					modal.style.top = `${currentY}px`;
					modal.style.transform = 'none';
				}
			});

			document.addEventListener('mouseup', () => {
				isDragging = false;
			});

			const handleKeys = (e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					closeModal();
				} else if (e.key === 'Enter') {
					e.preventDefault();
					const confirmBtn = modal.querySelector('#pct-token-ok') || modal.querySelector('#pct-query-ok');
					if (confirmBtn) confirmBtn.click();
				}
			};
			document.addEventListener('keydown', handleKeys);
			currentModal.handleKeysListener = handleKeys;

			setTimeout(() => {
				mask.classList.add('show');
				modal.classList.add('show');
			}, 10);

			if (onOpen) setTimeout(() => onOpen(modal), 50);
		}

		function closeModal() {
			return new Promise(resolve => {
				if (currentModal) {
					const modalElement = currentModal.modal;
					const maskElement = currentModal.mask;
					const keysListener = currentModal.handleKeysListener;

					modalElement.classList.remove('show');
					maskElement.classList.remove('show');

					const onTransitionEnd = () => {
						if (modalElement.parentNode) modalElement.remove();
						if (maskElement.parentNode) maskElement.remove();
						if (keysListener) document.removeEventListener('keydown', keysListener);
						currentModal = null;
						resolve();
					};

					modalElement.addEventListener('transitionend', onTransitionEnd, {
						once: true
					});
					setTimeout(() => {
						if (currentModal === null) return;
						onTransitionEnd();
					}, 300);
				} else {
					resolve();
				}
			});
		}

		function showToast(msg, type = 'info', duration = 3000) {
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

		function showError(msg, elementId = 'pct-token-err') {
			const el = document.getElementById(elementId);
			if (el) {
				el.textContent = msg;
				el.style.display = 'block';
			} else {
				showToast(msg, 'error', 3000);
			}
		}

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

	// -------------------------------------------------------------------
	// APIService - API 請求模組
	// -------------------------------------------------------------------
	const APIService = (function() {
		let currentToken = '';

		function setToken(token) {
			currentToken = token;
		}

		async function verifyToken(token, apiBase) {
			try {
				await request({
					url: `${apiBase}${AppConfig.API_PATHS.VERIFY_TOKEN}`,
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${token}`
					}
				});
				return true;
			} catch {
				return false;
			}
		}

		async function request({
			url,
			method = 'GET',
			data = null,
			headers = {}
		}) {
			const config = {
				method,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${currentToken}`,
					...headers
				}
			};
			if (data) {
				config.body = JSON.stringify(data);
			}
			const response = await fetch(url, config);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			return response.json();
		}

		return {
			setToken,
			verifyToken,
			request
		};
	})();

	// -------------------------------------------------------------------
	// DataProcessor - 資料處理模組
	// -------------------------------------------------------------------
	const DataProcessor = (function(AppConfig, Utils) {
		let masterDataCache = [];
		let channelDataCache = [];

		function resetData() {
			masterDataCache = [];
			channelDataCache = [];
		}

		function processAllDataForTable(masterData, channelData) {
			masterDataCache = masterData;
			channelDataCache = channelData;

			const result = masterData.map((item, index) => {
				const relatedChannels = channelData.filter(ch => ch.planCode === item.planCode);
				const specialStatus = Utils.checkSpecialStatus(item, relatedChannels);

				return {
					no: index + 1,
					planCode: item.planCode || '',
					planName: item.planName || '',
					currency: item.currency || '',
					unit: item.unit || '',
					planType: item.planType || '',
					saleStartDate: Utils.formatDate(item.saleStartDate),
					saleEndDate: Utils.formatDate(item.saleEndDate),
					status: item.saleEndDate === '9999-12-31 00:00:00' ? AppConfig.FIELD_MAPS.STATUS.IN_SALE : AppConfig.FIELD_MAPS.STATUS.STOPPED,
					polPln: item.polPln || '',
					channelInfo: relatedChannels.map(ch => ({
						channel: ch.channel,
						saleStartDate: Utils.formatDate(ch.saleStartDate),
						saleEndDate: Utils.formatDate(ch.saleEndDate),
						status: ch.saleEndDate === '9999-12-31 00:00:00' ? AppConfig.FIELD_MAPS.STATUS.IN_SALE : AppConfig.FIELD_MAPS.STATUS.STOPPED
					})),
					special: specialStatus
				};
			});

			return result;
		}

		function getCachedData() {
			return {
				masterDataCache,
				channelDataCache
			};
		}

		return {
			resetData,
			processAllDataForTable,
			getCachedData
		};
	})(AppConfig, Utils);

	// -------------------------------------------------------------------
	// AppCore - 核心邏輯模組
	// -------------------------------------------------------------------
	const AppCore = (function(AppConfig, UIManager, APIService, DataProcessor, Utils) {
		let env = '';
		let apiBase = '';
		let token = '';
		let tokenCheckEnabled = true;
		let allProcessedData = [];
		let queryMode = '';
		let queryInput = '';
		let querySubOption = [];
		let queryChannels = [];
		let pageNo = 1;
		let pageSize = AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE;
		let totalRecords = 0;
		let filterSpecial = false;
		let sortKey = '';
		let sortAsc = true;

		async function start() {
			env = detectEnv();
			apiBase = env === 'PROD' ? AppConfig.API_ENDPOINTS.PROD : AppConfig.API_ENDPOINTS.UAT;

			resetAppState();
			DataProcessor.resetData();
			UIManager.injectStyles();

			token = localStorage.getItem('sso-token') || localStorage.getItem('euisToken') || '';
			APIService.setToken(token);

			if (token && tokenCheckEnabled) {
				UIManager.showToast('正在驗證 Token，請稍候...', 'info');
				const isValid = await APIService.verifyToken(token, apiBase);
				if (isValid) {
					UIManager.showToast('Token 驗證成功，已自動登入。', 'success');
					localStorage.setItem('euisToken', token);
					showQueryDialog();
					return;
				} else {
					UIManager.showToast('Token 無效，請重新設定。', 'warning');
					localStorage.removeItem('sso-token');
					localStorage.removeItem('euisToken');
					token = '';
					APIService.setToken('');
				}
			}
			showTokenDialog();
		}

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
		}

		function detectEnv() {
			const host = window.location.host.toLowerCase();
			return host.includes('uat') || host.includes('test') || host.includes('dev') || host.includes('stg') ? 'UAT' : 'PROD';
		}

		function envLabel() {
			return env === 'PROD' ? '正式環境' : '測試環境';
		}

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

					tokenInput.value = token;
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
						APIService.setToken(val);
						localStorage.setItem('euisToken', val);

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

		function modeLabel(mode) {
			const labels = {
				[AppConfig.QUERY_MODES.PLAN_CODE]: '商品代號',
				[AppConfig.QUERY_MODES.PLAN_NAME]: '商品名稱關鍵字',
				[AppConfig.QUERY_MODES.ALL_MASTER_PLANS]: '查詢全部主檔',
				masterDataCategory: '主檔資料查詢',
				channelDataCategory: '通路資料查詢'
			};
			return labels[mode] || mode;
		}

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
                            ${primaryQueryModes.map(mode => `<div class="pct-mode-card" data-mode="${mode}">${modeLabel(mode)}</div>`).join('')}
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
					let currentPrimaryMode = queryMode;
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
                                        <textarea class="pct-input" id="pct-query-input" rows="2" placeholder="請輸入商品代碼（如 5105, 5106 或每行一個）"></textarea>
                                        <small style="color: var(--text-color-light); font-size: 12px;">多筆代碼可用空格、逗號或換行分隔</small>
                                    </div>
                                `;
								break;
							case AppConfig.QUERY_MODES.PLAN_NAME:
								inputHtml = `
                                    <div class="pct-form-group">
                                        <label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label>
                                        <textarea class="pct-input" id="pct-query-input" rows="2" placeholder="請輸入商品名稱關鍵字（如 健康保險）"></textarea>
                                    </div>
                                `;
								break;
							case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
								inputHtml = '<div style="text-align: center; padding: 20px; color: var(--text-color-light);">將查詢所有主檔商品，無需輸入任何條件。</div>';
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
                                            ${AppConfig.FIELD_MAPS.CHANNELS.map(ch => `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`).join('')}
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
						updateDynamicContent();
						UIManager.showToast('已清除所有查詢條件', 'info');
					};

					queryOkBtn.onclick = () => {
						let finalMode = currentPrimaryMode;
						let finalInput = currentQueryInput;
						let finalSubOptions = currentSubOptions;
						let finalChannels = currentChannels;

						if (currentPrimaryMode === 'masterDataCategory') {
							if (currentSubOptions.length === 0 || currentSubOptions.length > 1) {
								UIManager.showError('請選擇主檔查詢範圍 (現售/停售)', 'pct-query-err');
								return;
							}
							finalMode = currentSubOptions[0];
						} else if (currentPrimaryMode === 'channelDataCategory') {
							if (currentSubOptions.length === 0 || currentSubOptions.length > 1) {
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

						UIManager.closeModal();
						doQuery();
					};

					queryCancelBtn.onclick = () => {
						UIManager.closeModal();
					};

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

		async function queryMultiplePlanCodes(input) {
			const codes = Utils.splitInput(input);
			if (codes.length === 0) {
				UIManager.showToast('請輸入有效的商品代碼', 'warning');
				return [];
			}
			return codes;
		}

		async function doQuery() {
			UIManager.showToast('查詢中，請稍候...', 'info');
			allProcessedData = [];
			totalRecords = 0;
			let queryParams = {
				pageNo: pageNo,
				pageSize: pageSize
			};
			let channelQueryParams = {
				pageNo: 1,
				pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_ALL
			};

			try {
				let apiPath = AppConfig.API_PATHS.PLAN_CODE_QUERY;
				if (queryMode === AppConfig.QUERY_MODES.PLAN_CODE) {
					const planCodes = await queryMultiplePlanCodes(queryInput);
					queryParams.planCode = planCodes;
				} else if (queryMode === AppConfig.QUERY_MODES.PLAN_NAME) {
					queryParams.planCodeName = queryInput;
				} else if (queryMode === AppConfig.QUERY_MODES.ALL_MASTER_PLANS) {
					queryParams.planCodeName = '';
				} else if (queryMode === AppConfig.QUERY_MODES.MASTER_IN_SALE) {
					queryParams.planCodeName = '';
					queryParams.saleEndDate = '9999-12-31 00:00:00';
				} else if (queryMode === AppConfig.QUERY_MODES.MASTER_STOPPED) {
					queryParams.planCodeName = '';
					queryParams.saleEndDate = `<${Utils.getToday()}`;
				} else if ([AppConfig.QUERY_MODES.CHANNEL_IN_SALE, AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
					apiPath = AppConfig.API_PATHS.PLAN_CODE_SALE_DATE;
					queryParams = channelQueryParams;
					if (queryChannels.length > 0) {
						queryParams.channel = queryChannels;
					}
					queryParams.saleEndDate = queryMode === AppConfig.QUERY_MODES.CHANNEL_IN_SALE ?
						'9999-12-31 00:00:00' :
						`<${Utils.getToday()}`;
				}

				const response = await APIService.request({
					url: `${apiBase}${apiPath}`,
					method: 'POST',
					data: queryParams
				});

				let masterData = [];
				let channelData = [];

				if ([AppConfig.QUERY_MODES.CHANNEL_IN_SALE, AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)) {
					channelData = response.data || [];
				} else {
					masterData = response.data || [];
					if (masterData.length > 0) {
						const planCodes = masterData.map(item => item.planCode);
						const channelResponse = await APIService.request({
							url: `${apiBase}${AppConfig.API_PATHS.PLAN_CODE_SALE_DATE}`,
							method: 'POST',
							data: {
								planCode: planCodes,
								pageNo: 1,
								pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_ALL
							}
						});
						channelData = channelResponse.data || [];
					}
				}

				allProcessedData = DataProcessor.processAllDataForTable(masterData, channelData);
				totalRecords = allProcessedData.length;

				if (allProcessedData.length === 0) {
					UIManager.showToast('查無資料', 'warning');
					return;
				}

				UIManager.showToast(`查詢成功，共 ${totalRecords} 筆資料`, 'success');
				renderTable();
			} catch (error) {
				UIManager.showToast(`查詢失敗：${error.message || '未知錯誤'}`, 'error');
				console.error('Query error:', error);
			}
		}

		function sortData(data, key, ascending) {
			return data.sort((a, b) => {
				let valA = a[key] || '';
				let valB = b[key] || '';
				if (key === 'no') {
					valA = Number(valA);
					valB = Number(valB);
				}
				if (valA < valB) return ascending ? -1 : 1;
				if (valA > valB) return ascending ? 1 : -1;
				return 0;
			});
		}

		function renderTableHTML(data) {
			const headers = [{
					key: 'no',
					label: 'No'
				},
				{
					key: 'planCode',
					label: '代號'
				},
				{
					key: 'planName',
					label: '商品名稱'
				},
				{
					key: 'currency',
					label: '幣別'
				},
				{
					key: 'unit',
					label: '單位'
				},
				{
					key: 'planType',
					label: '類型'
				},
				{
					key: 'saleStartDate',
					label: '銷售起日'
				},
				{
					key: 'saleEndDate',
					label: '銷售止日'
				},
				{
					key: 'status',
					label: '主約狀態'
				},
				{
					key: 'polPln',
					label: 'POLPLN'
				},
				{
					key: 'channelInfo',
					label: '通路資訊'
				},
				{
					key: 'special',
					label: '特殊狀態'
				}
			];

			let tableHtml = '<table class="pct-table"><thead><tr>';
			headers.forEach(h => {
				const sortIndicator = sortKey === h.key ? (sortAsc ? ' ↑' : ' ↓') : '';
				tableHtml += `<th data-key="${h.key}">${h.label}${sortIndicator}</th>`;
			});
			tableHtml += '</tr></thead><tbody>';

			data.forEach(item => {
				tableHtml += '<tr>';
				headers.forEach(h => {
					if (h.key === 'channelInfo') {
						const channelText = item[h.key].map(ch => `${ch.channel}: ${ch.saleStartDate} - ${ch.saleEndDate} (${ch.status})`).join('<br>');
						tableHtml += `<td>${channelText || '-'}</td>`;
					} else {
						tableHtml += `<td>${item[h.key] || '-'}</td>`;
					}
				});
				tableHtml += '</tr>';
			});

			tableHtml += '</tbody></table>';
			return tableHtml;
		}

		function renderTableText(data) {
			return data.map(item => {
				const channelText = item.channelInfo.map(ch => `${ch.channel}: ${ch.saleStartDate}-${ch.saleEndDate} (${ch.status})`).join('; ');
				return [
					item.no,
					item.planCode,
					item.planName,
					item.currency,
					item.unit,
					item.planType,
					item.saleStartDate,
					item.saleEndDate,
					item.status,
					item.polPln,
					channelText || '-',
					item.special || '-'
				].join('\t');
			}).join('\n');
		}

		function renderTable() {
			let displayData = filterSpecial ? allProcessedData.filter(item => item.special) : allProcessedData;
			if (sortKey) {
				displayData = sortData([...displayData], sortKey, sortAsc);
			}

			const startIndex = (pageNo - 1) * pageSize;
			const endIndex = startIndex + pageSize;
			const pageData = displayData.slice(startIndex, endIndex);
			const totalPages = Math.ceil(totalRecords / pageSize);

			const tableHtml = renderTableHTML(pageData);

			const footer = `
                <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <button class="pct-btn" id="pct-table-prev" ${pageNo === 1 ? 'disabled' : ''}>上一頁</button>
                        <span>第 ${pageNo} / ${totalPages} 頁，共 ${totalRecords} 筆</span>
                        <button class="pct-btn" id="pct-table-next" ${pageNo === totalPages ? 'disabled' : ''}>下一頁</button>
                    </div>
                    <div>
                        <button class="pct-btn" id="pct-table-detail">一鍵查詢全部詳細</button>
                        <button class="pct-btn" id="pct-table-copy">一鍵複製</button>
                        <button class="pct-btn" id="pct-table-filter">${filterSpecial ? '取消特殊篩選' : '特殊篩選'}</button>
                        <button class="pct-btn pct-btn-secondary" id="pct-table-requery">重新查詢</button>
                        <button class="pct-btn pct-btn-secondary" id="pct-table-close">關閉</button>
                    </div>
                </div>
            `;

			UIManager.showModal({
				title: `查詢結果（${envLabel()}）`,
				body: tableHtml,
				footer,
				onOpen: (modalElement) => {
					const prevBtn = modalElement.querySelector('#pct-table-prev');
					const nextBtn = modalElement.querySelector('#pct-table-next');
					const detailBtn = modalElement.querySelector('#pct-table-detail');
					const copyBtn = modalElement.querySelector('#pct-table-copy');
					const filterBtn = modalElement.querySelector('#pct-table-filter');
					const requeryBtn = modalElement.querySelector('#pct-table-requery');
					const closeBtn = modalElement.querySelector('#pct-table-close');

					const headers = modalElement.querySelectorAll('.pct-table th');
					headers.forEach(header => {
						header.onclick = () => {
							const key = header.dataset.key;
							if (sortKey === key) {
								sortAsc = !sortAsc;
							} else {
								sortKey = key;
								sortAsc = true;
							}
							renderTable();
						};
					});

					prevBtn.onclick = () => {
						if (pageNo > 1) {
							pageNo--;
							renderTable();
						}
					};

					nextBtn.onclick = () => {
						if (pageNo < totalPages) {
							pageNo++;
							renderTable();
						}
					};

					detailBtn.onclick = async () => {
						UIManager.showToast('查詢詳細資料中...', 'info');
						try {
							const {
								masterDataCache
							} = DataProcessor.getCachedData();
							const planCodes = masterDataCache.map(item => item.planCode);
							const detailResponse = await APIService.request({
								url: `${apiBase}${AppConfig.API_PATHS.PLAN_CODE_DETAIL}`,
								method: 'POST',
								data: {
									planCode: planCodes,
									pageNo: 1,
									pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_ALL
								}
							});
							const channelResponse = await APIService.request({
								url: `${apiBase}${AppConfig.API_PATHS.PLAN_CODE_SALE_DATE}`,
								method: 'POST',
								data: {
									planCode: planCodes,
									pageNo: 1,
									pageSize: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_ALL
								}
							});
							allProcessedData = DataProcessor.processAllDataForTable(detailResponse.data || [], channelResponse.data || []);
							totalRecords = allProcessedData.length;
							renderTable();
							UIManager.showToast('詳細資料查詢成功', 'success');
						} catch (error) {
							UIManager.showToast(`詳細查詢失敗：${error.message || '未知錯誤'}`, 'error');
							console.error('Detail query error:', error);
						}
					};

					copyBtn.onclick = () => {
						const text = renderTableText(allProcessedData);
						Utils.copyToClipboard(text);
						UIManager.showToast('已複製表格內容至剪貼簿', 'success');
					};

					filterBtn.onclick = () => {
						filterSpecial = !filterSpecial;
						renderTable();
					};

					requeryBtn.onclick = () => {
						UIManager.closeModal();
						showQueryDialog();
					};

					closeBtn.onclick = () => {
						UIManager.closeModal();
					};
				}
			});
		}

		return {
			start,
			showQueryDialog,
			doQuery,
			queryMultiplePlanCodes,
			renderTable
		};
	})(AppConfig, UIManager, APIService, DataProcessor, Utils);

	// 啟動應用
	AppCore.start();
})();
