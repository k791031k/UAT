// ============================================================================
// 商品查詢工具 - 重構版本 v2.0
// 功能：支援多種查詢模式、特殊狀態標示、卡片式UI設計
// 作者：AI Assistant
// 日期：2025-06-22
// ============================================================================

(function() {
    'use strict';

    // ============================================================================
    // 常數定義
    // ============================================================================

    const CONSTANTS = {
        MAIN_UI_ID: 'planCodeQueryTool',
        VERSION: '2.0.0',

        // 查詢模式
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            ALL_PLANS: 'allPlans',
            MASTER_DATA_CURRENT: 'masterDataCurrent',
            MASTER_DATA_STOPPED: 'masterDataStopped',
            CHANNEL_DATA_CURRENT: 'channelDataCurrent',
            CHANNEL_DATA_STOPPED: 'channelDataStopped'
        },

        // 通路代碼
        CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC'],

        // 欄位定義
        FIELD_DEFINITIONS: {
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
            }
        },

        // API端點
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
        }
    };

    // ============================================================================
    // 全域變數
    // ============================================================================

    let CURRENT_API_URL = CONSTANTS.API_ENDPOINTS.UAT;
    let showOnlySpecialStatus = false;

    // ============================================================================
    // 狀態管理模組
    // ============================================================================

    const StateManager = {
        originalQueryResults: [],
        currentDisplayData: [],
        currentEnvironment: 'UAT',

        reset() {
            this.originalQueryResults = [];
            this.currentDisplayData = [];
        },

        updateData(newData) {
            this.originalQueryResults = newData;
            this.currentDisplayData = [...newData];
        }
    };

    // ============================================================================
    // Token管理模組
    // ============================================================================

    const TokenManager = {
        STORAGE_KEY: 'planCodeTool_ssoToken',

        get() {
            return localStorage.getItem(this.STORAGE_KEY) || '';
        },

        set(token) {
            localStorage.setItem(this.STORAGE_KEY, token);
        },

        load() {
            return this.get();
        },

        async showDialog() {
            return new Promise((resolve) => {
                const dialog = UIManager.createDialog({
                    title: 'SSO-TOKEN 設定',
                    content: `
            <div class="token-form">
              <div class="form-group">
                <label>請輸入 SSO-TOKEN：</label>
                <textarea id="tokenInput" rows="4" placeholder="請貼上您的 SSO-TOKEN"></textarea>
              </div>
              <div class="form-actions">
                <button id="saveToken" class="primary-btn">儲存</button>
                <button id="skipToken" class="secondary-btn">略過</button>
              </div>
            </div>
          `,
                    className: 'token-dialog'
                });

                const tokenInput = dialog.querySelector('#tokenInput');
                const saveBtn = dialog.querySelector('#saveToken');
                const skipBtn = dialog.querySelector('#skipToken');

                saveBtn.addEventListener('click', () => {
                    const token = tokenInput.value.trim();
                    if (token) {
                        this.set(token);
                        UIManager.showToast('Token 已儲存', 'success');
                    }
                    UIManager.closeDialog(dialog);
                    resolve(token);
                });

                skipBtn.addEventListener('click', () => {
                    UIManager.closeDialog(dialog);
                    resolve(null);
                });

                tokenInput.focus();
            });
        }
    };

    // ============================================================================
    // 環境管理模組
    // ============================================================================

    const EnvManager = {
        async showDialog() {
            return new Promise((resolve) => {
                const dialog = UIManager.createDialog({
                    title: '選擇查詢環境',
                    content: `
            <div class="env-form">
              <div class="form-group">
                <label>請選擇環境：</label>
                <div class="radio-group">
                  <label><input type="radio" name="env" value="UAT" checked> UAT 測試環境</label>
                  <label><input type="radio" name="env" value="PROD"> PROD 正式環境</label>
                </div>
              </div>
              <div class="form-actions">
                <button id="confirmEnv" class="primary-btn">確認</button>
              </div>
            </div>
          `,
                    className: 'env-dialog'
                });

                const confirmBtn = dialog.querySelector('#confirmEnv');

                confirmBtn.addEventListener('click', () => {
                    const selectedEnv = dialog.querySelector('input[name="env"]:checked').value;
                    StateManager.currentEnvironment = selectedEnv;
                    CURRENT_API_URL = CONSTANTS.API_ENDPOINTS[selectedEnv];

                    UIManager.closeDialog(dialog);
                    resolve(selectedEnv);
                });
            });
        }
    };

    // ============================================================================
    // API管理模組
    // ============================================================================

    const ApiManager = {
        async makeRequest(endpoint, options = {}) {
            const defaultOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'SSO-TOKEN': TokenManager.get()
                }
            };

            const finalOptions = {
                ...defaultOptions,
                ...options
            };

            try {
                const response = await fetch(`${CURRENT_API_URL}${endpoint}`, finalOptions);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return response;
            } catch (error) {
                console.error('API請求失敗:', error);
                throw error;
            }
        },

        async queryProducts(queryParams) {
            try {
                let params;
                let endpoint = '/planCodeController/query';

                switch (queryParams.mode) {
                    case CONSTANTS.QUERY_MODES.PLAN_CODE:
                        const planCodes = splitPlanCodes(queryParams.input);
                        if (planCodes.length === 1) {
                            params = {
                                planCode: planCodes[0],
                                pageNo: queryParams.pageNo || 1,
                                pageSize: queryParams.pageSize || 50
                            };
                        } else {
                            return await this.queryMultiplePlanCodes(planCodes, queryParams);
                        }
                        break;

                    case CONSTANTS.QUERY_MODES.PLAN_NAME:
                        params = {
                            planCodeName: queryParams.input,
                            pageNo: queryParams.pageNo || 1,
                            pageSize: queryParams.pageSize || 50
                        };
                        break;

                    case CONSTANTS.QUERY_MODES.ALL_PLANS:
                        params = {
                            planCodeName: '',
                            pageNo: queryParams.pageNo || 1,
                            pageSize: queryParams.pageSize || 50
                        };
                        break;

                    case CONSTANTS.QUERY_MODES.MASTER_DATA_CURRENT:
                        params = {
                            saleEndDate: '9999-12-31 00:00:00',
                            pageNo: queryParams.pageNo || 1,
                            pageSize: queryParams.pageSize || 50
                        };
                        break;

                    case CONSTANTS.QUERY_MODES.MASTER_DATA_STOPPED:
                        return await this.queryStoppedMasterProducts();

                    case CONSTANTS.QUERY_MODES.CHANNEL_DATA_CURRENT:
                        return await this.queryChannelProducts(queryParams.channels, true);

                    case CONSTANTS.QUERY_MODES.CHANNEL_DATA_STOPPED:
                        return await this.queryChannelProducts(queryParams.channels, false);

                    default:
                        throw new Error('未知查詢模式');
                }

                const response = await this.makeRequest(endpoint, {
                    body: JSON.stringify(params)
                });

                const data = await response.json();

                return {
                    records: data.records || [],
                    totalRecords: data.totalRecords || 0,
                    currentPage: data.currentPage || 1,
                    pageSize: data.pageSize || 50
                };
            } catch (error) {
                UIManager.showToast(`查詢失敗: ${error.message}`, 'error');
                throw error;
            }
        },

        async queryMultiplePlanCodes(planCodes, queryParams) {
            const allRecords = [];
            let totalRecords = 0;

            UIManager.showToast(`查詢 ${planCodes.length} 個商品代號中...`, 'info');

            for (let i = 0; i < planCodes.length; i++) {
                const planCode = planCodes[i];

                try {
                    const params = {
                        planCode: planCode,
                        pageNo: 1,
                        pageSize: 50
                    };

                    const response = await this.makeRequest('/planCodeController/query', {
                        body: JSON.stringify(params)
                    });

                    const data = await response.json();

                    if (data.records && data.records.length > 0) {
                        data.records.forEach(record => {
                            record._querySource = planCode;
                            record._queryIndex = i + 1;
                        });

                        allRecords.push(...data.records);
                        totalRecords += data.totalRecords || data.records.length;
                    } else {
                        allRecords.push({
                            planCode: planCode,
                            _apiStatus: '查無資料',
                            _querySource: planCode,
                            _queryIndex: i + 1
                        });
                    }

                    UIManager.showToast(`已查詢 ${i + 1}/${planCodes.length} 個商品代號`, 'info');

                } catch (error) {
                    console.error(`查詢商品代號 ${planCode} 失敗:`, error);

                    allRecords.push({
                        planCode: planCode,
                        _apiStatus: '查詢失敗',
                        _querySource: planCode,
                        _queryIndex: i + 1
                    });
                }
            }

            return {
                records: allRecords,
                totalRecords: totalRecords,
                currentPage: 1,
                pageSize: allRecords.length,
                _isMultiQuery: true,
                _queriedCodes: planCodes
            };
        },

        async queryStoppedMasterProducts() {
            try {
                const allProductsResponse = await this.makeRequest('/planCodeController/query', {
                    body: JSON.stringify({
                        "planCodeName": "",
                        "pageNo": 1,
                        "pageSize": 1000
                    })
                });

                const allProducts = await allProductsResponse.json();

                const stoppedProducts = allProducts.records.filter(product =>
                    product.saleEndDate !== "9999-12-31 00:00:00"
                );

                return {
                    records: stoppedProducts,
                    totalRecords: stoppedProducts.length,
                    currentPage: 1,
                    pageSize: stoppedProducts.length,
                    _isFiltered: true,
                    _filterType: 'stopped'
                };

            } catch (error) {
                console.error('查詢主檔停售商品失敗:', error);
                throw error;
            }
        },

        async queryChannelProducts(channels, isCurrent) {
            const allRecords = [];
            const channelsToQuery = channels && channels.length > 0 ? channels : CONSTANTS.CHANNELS;

            for (const channel of channelsToQuery) {
                try {
                    const params = {
                        "channel": channel,
                        "saleStartDate": "",
                        "saleEndDate": isCurrent ? "9999-12-31 00:00:00" : "",
                        "assistantAcceptStartDate": "",
                        "assistantAcceptEndDate": "",
                        "modifiedUser": "",
                        "modifiedDateStart": "",
                        "modifiedDateEnd": "",
                        "createdUser": "",
                        "createdDateStart": "",
                        "createdDateEnd": "",
                        "versionNumber": "",
                        "lastNoteDeadline": "",
                        "pageIndex": 1,
                        "size": 1000,
                        "orderBys": ["planCode asc"]
                    };

                    const response = await this.makeRequest('/planCodeSaleDateController/query', {
                        body: JSON.stringify(params)
                    });

                    const data = await response.json();
                    let records = data.planCodeSaleDates?.records || [];

                    if (!isCurrent) {
                        records = records.filter(product =>
                            product.saleEndDate !== "9999-12-31 00:00:00"
                        );
                    }

                    records.forEach(record => {
                        record._channel = channel;
                    });

                    allRecords.push(...records);

                } catch (error) {
                    console.error(`查詢通路 ${channel} 失敗:`, error);
                }
            }

            return {
                records: allRecords,
                totalRecords: allRecords.length,
                currentPage: 1,
                pageSize: allRecords.length,
                _isChannelQuery: true,
                _filterType: isCurrent ? 'current' : 'stopped'
            };
        },

        async queryProductDetail(planCode) {
            try {
                const response = await this.makeRequest('/planCodeController/queryDetail', {
                    body: JSON.stringify({
                        planCode: planCode,
                        pageNo: 1,
                        pageSize: 20
                    })
                });
                const data = await response.json();

                const polplnList = (data.records || []).map(r => r.polpln).filter(p => p);
                return {
                    polpln: polplnList.join(', '),
                    records: data.records || []
                };
            } catch (error) {
                console.error(`查詢商品詳情失敗 (${planCode}):`, error);
                return {
                    error: error.message,
                    polpln: ''
                };
            }
        },

        async queryChannelData(planCode) {
            try {
                const response = await this.makeRequest('/planCodeSaleDateController/query', {
                    body: JSON.stringify({
                        planCode: planCode,
                        pageNo: 1,
                        pageSize: 50
                    })
                });
                const data = await response.json();

                const channelRecords = data.planCodeSaleDates?.records || [];

                return channelRecords.map(record => ({
                    channel: channelCodeConvert(record.channel),
                    saleStartDate: record.saleStartDate,
                    saleEndDate: record.saleEndDate,
                    status: getSaleStatus(formatToday(), record.saleStartDate, record.saleEndDate),
                    rawEnd: record.saleEndDate
                }));
            } catch (error) {
                console.error(`查詢通路資訊失敗 (${planCode}):`, error);
                return [];
            }
        },

        async verifyToken(token) {
            try {
                const response = await fetch(`${CURRENT_API_URL}/planCodeController/query`, {
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

                if (!response.ok) return false;

                const data = await response.json();
                return !!(data.records && data.records.length > 0);
            } catch (error) {
                console.error('Token驗證失敗:', error);
                return false;
            }
        }
    };

    // ============================================================================
    // 資料載入模組
    // ============================================================================

    const DataLoader = {
        async loadProductData(queryMode, queryInput, options = {}) {
            try {
                UIManager.showToast('查詢中...', 'info');

                const queryParams = {
                    mode: queryMode,
                    input: queryInput,
                    pageNo: 1,
                    pageSize: 1000,
                    ...options
                };

                const rawData = await ApiManager.queryProducts(queryParams);

                const processedData = await processData(rawData.records, queryMode);

                StateManager.updateData(processedData);

                UIManager.showToast(`查詢完成，共 ${processedData.length} 筆資料`, 'success');

                return processedData;
            } catch (error) {
                UIManager.showToast('查詢失敗', 'error');
                throw error;
            }
        }
    };

    // ============================================================================
    // UI管理模組
    // ============================================================================

    const UIManager = {
        createMainContainer() {
            return `
        <div id="${CONSTANTS.MAIN_UI_ID}" class="plan-code-tool">
          <style>
            #${CONSTANTS.MAIN_UI_ID} {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 95vw;
              max-width: 1400px;
              height: 90vh;
              background: white;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              z-index: 10000;
              display: flex;
              flex-direction: column;
              font-family: 'Microsoft JhengHei', sans-serif;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 12px 12px 0 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .header h2 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .close-btn {
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.2s;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .close-btn:hover {
              background: rgba(255,255,255,0.3);
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toolbar {
              background: #f8f9fa;
              padding: 15px 20px;
              border-bottom: 1px solid #dee2e6;
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
              align-items: center;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toolbar button {
              background: #007bff;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
              white-space: nowrap;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toolbar button:hover {
              background: #0056b3;
              transform: translateY(-1px);
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toolbar button.special {
              background: #ffc107;
              color: #000;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toolbar button.special:hover {
              background: #e0a800;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .content {
              flex: 1;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .table-container {
              flex: 1;
              overflow: auto;
              padding: 20px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            #${CONSTANTS.MAIN_UI_ID} th {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
              position: sticky;
              top: 0;
              z-index: 10;
            }
            
            #${CONSTANTS.MAIN_UI_ID} td {
              padding: 12px;
              border-bottom: 1px solid #dee2e6;
              vertical-align: top;
            }
            
            #${CONSTANTS.MAIN_UI_ID} tr:hover {
              background: #f8f9fa;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .special-row {
              background: #fff3cd !important;
              border-left: 4px solid #ffc107;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .error-row {
              background: #f8d7da !important;
              border-left: 4px solid #dc3545;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .pagination {
              background: #f8f9fa;
              padding: 15px 20px;
              border-top: 1px solid #dee2e6;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .pagination button {
              background: #007bff;
              color: white;
              border: none;
              padding: 8px 12px;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 2px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .pagination button:disabled {
              background: #6c757d;
              cursor: not-allowed;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .dialog-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0,0,0,0.5);
              z-index: 10001;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .dialog {
              background: white;
              border-radius: 12px;
              padding: 24px;
              max-width: 500px;
              width: 90%;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            
            #${CONSTANTS.MAIN_UI_ID} .dialog h3 {
              margin: 0 0 20px 0;
              color: #333;
              font-size: 20px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .form-group {
              margin-bottom: 20px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .form-group label {
              display: block;
              margin-bottom: 8px;
              font-weight: 600;
              color: #333;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .form-group input,
            #${CONSTANTS.MAIN_UI_ID} .form-group textarea,
            #${CONSTANTS.MAIN_UI_ID} .form-group select {
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 6px;
              font-size: 14px;
              box-sizing: border-box;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .form-actions {
              display: flex;
              gap: 10px;
              justify-content: flex-end;
              margin-top: 24px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .primary-btn {
              background: #007bff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .secondary-btn {
              background: #6c757d;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .card-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .query-card {
              background: white;
              border: 2px solid #dee2e6;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              cursor: pointer;
              transition: all 0.2s;
              min-height: 80px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 600;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .query-card:hover {
              border-color: #007bff;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0,123,255,0.2);
            }
            
            #${CONSTANTS.MAIN_UI_ID} .query-card.selected {
              background: #007bff;
              color: white;
              border-color: #007bff;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .sub-options {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin: 20px 0;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .sub-option {
              background: white;
              border: 2px solid #dee2e6;
              border-radius: 6px;
              padding: 10px 20px;
              cursor: pointer;
              transition: all 0.2s;
              font-weight: 500;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .sub-option:hover {
              border-color: #007bff;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .sub-option.selected {
              background: #007bff;
              color: white;
              border-color: #007bff;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .channel-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
              margin: 15px 0;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .channel-option {
              background: white;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 8px;
              text-align: center;
              cursor: pointer;
              transition: all 0.2s;
              font-size: 12px;
              font-weight: 600;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .channel-option:hover {
              border-color: #007bff;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .channel-option.selected {
              background: #007bff;
              color: white;
              border-color: #007bff;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #333;
              color: white;
              padding: 12px 20px;
              border-radius: 6px;
              z-index: 10002;
              opacity: 0;
              transform: translateX(100%);
              transition: all 0.3s;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast.show {
              opacity: 1;
              transform: translateX(0);
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast.success {
              background: #28a745;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast.error {
              background: #dc3545;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast.warning {
              background: #ffc107;
              color: #000;
            }
            
            #${CONSTANTS.MAIN_UI_ID} .toast.info {
              background: #17a2b8;
            }
          </style>
          
          <div class="header">
            <h2>商品查詢工具 v${CONSTANTS.VERSION}</h2>
            <button class="close-btn" onclick="document.getElementById('${CONSTANTS.MAIN_UI_ID}').remove()">×</button>
          </div>
          
          <div class="toolbar">
            <button id="queryBtn">重新查詢</button>
            <button id="currentSaleBtn">現售商品</button>
            <button id="copyAllBtn">一鍵複製</button>
            <button id="queryDetailsBtn">一鍵查詳情</button>
            <button id="togglePaginationBtn">切換分頁</button>
            <button id="clearDataBtn">清除所有資料</button>
            <span class="env-indicator">環境: <span id="currentEnv">${StateManager.currentEnvironment}</span></span>
          </div>
          
          <div class="content">
            <div class="table-container">
              <table id="dataTable">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>代號</th>
                    <th>商品名稱</th>
                    <th>幣別</th>
                    <th>單位</th>
                    <th>類型</th>
                    <th>銷售起日</th>
                    <th>銷售迄日</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody id="tableBody">
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                      請點擊「重新查詢」開始查詢商品資料
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="pagination" id="paginationContainer">
              <div class="pagination-info">
                <span id="pageInfo">第 0 頁，共 0 頁 (總計 0 筆)</span>
              </div>
              <div class="pagination-controls">
                <button id="firstPageBtn" disabled>首頁</button>
                <button id="prevPageBtn" disabled>上一頁</button>
                <button id="nextPageBtn" disabled>下一頁</button>
                <button id="lastPageBtn" disabled>末頁</button>
              </div>
            </div>
          </div>
        </div>
      `;
        },

        createDialog(options) {
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.innerHTML = `
        <div class="dialog ${options.className || ''}">
          <h3>${options.title}</h3>
          ${options.content}
        </div>
      `;

            document.body.appendChild(overlay);

            // ESC 鍵關閉
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    this.closeDialog(overlay);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

            return overlay;
        },

        closeDialog(dialog) {
            if (dialog && dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        },

        showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;

            document.body.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 100);

            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        },

        updateEnvironmentDisplay() {
            const envSpan = document.getElementById('currentEnv');
            if (envSpan) {
                envSpan.textContent = StateManager.currentEnvironment;
            }
        }
    };

    // ============================================================================
    // 表格渲染模組
    // ============================================================================

    const TableRenderer = {
        renderTable(data) {
            const tbody = document.getElementById('tableBody');

            if (!data || data.length === 0) {
                tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
              查無資料
            </td>
          </tr>
        `;
                return;
            }

            tbody.innerHTML = data.map(row => this.renderRow(row)).join('');
        },

        renderRow(row) {
            const isSpecial = checkSpecialStatus(row, row.channels || []);
            const isError = row._isErrorRow;

            let rowClass = '';
            if (isError) rowClass = 'error-row';
            else if (isSpecial) rowClass = 'special-row';

            const saleStatus = this.getSaleStatus(row.saleEndDate);
            const channelInfo = this.formatChannelInfo(row.channels || []);

            return `
        <tr class="${rowClass}" data-plan-code="${row.planCode}">
          <td>${row.no}</td>
          <td>
            <div>${row.planCode}</div>
            ${row.polpln ? `<small style="color: #666;">${row.polpln}</small>` : ''}
          </td>
          <td>${row.shortName}</td>
          <td>${row.currency}</td>
          <td>${row.unit}</td>
          <td>${row.coverageType}</td>
          <td>${row.saleStartDate}</td>
          <td>
            <div>${row.saleEndDate}</div>
            ${saleStatus ? `<small style="color: ${saleStatus === '現售中' ? 'green' : 'red'};">${saleStatus}</small>` : ''}
            ${channelInfo ? `<small style="color: #666;">${channelInfo}</small>` : ''}
          </td>
          <td>
            ${!row._detailQueried ? 
              `<button data-action="queryDetail" style="font-size: 12px; padding: 4px 8px;">查詳情</button>` : 
              '<span style="color: green; font-size: 12px;">已查詢</span>'
            }
          </td>
        </tr>
      `;
        },

        getSaleStatus(saleEndDate) {
            if (!saleEndDate || saleEndDate === '-') return '';

            if (saleEndDate === '99991231' || saleEndDate === '9999-12-31' ||
                saleEndDate === '9999-12-31 00:00:00') {
                return '現售中';
            }

            const today = formatToday();
            const endDateNum = Number(formatDate(saleEndDate));
            const todayNum = Number(formatDate(today));

            if (endDateNum < todayNum) return '停售';
            return '現售中';
        },

        formatChannelInfo(channels) {
            if (!channels || channels.length === 0) return '';

            return channels.map(c => `${c.channel}:${c.status}`).join(', ');
        }
    };

    // ============================================================================
    // 分頁管理模組
    // ============================================================================

    const PaginationManager = {
        currentPage: 1,
        pageSize: 20,
        usePagination: true,

        updateDisplay() {
            const filteredData = FilterManager.applyFiltersAndSort();

            // 更新特殊狀態按鈕
            updateSpecialStatusButton(filteredData);

            if (this.usePagination) {
                const startIndex = (this.currentPage - 1) * this.pageSize;
                const endIndex = startIndex + this.pageSize;
                const currentPageData = filteredData.slice(startIndex, endIndex);

                TableRenderer.renderTable(currentPageData);
                this.renderPaginationControls(filteredData.length);
            } else {
                TableRenderer.renderTable(filteredData);
                this.hidePaginationControls();
            }
        },

        renderPaginationControls(totalRecords) {
            const totalPages = Math.ceil(totalRecords / this.pageSize);
            const pageInfo = document.getElementById('pageInfo');
            const firstBtn = document.getElementById('firstPageBtn');
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            const lastBtn = document.getElementById('lastPageBtn');

            pageInfo.textContent = `第 ${this.currentPage} 頁，共 ${totalPages} 頁 (總計 ${totalRecords} 筆)`;

            firstBtn.disabled = this.currentPage === 1;
            prevBtn.disabled = this.currentPage === 1;
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
            lastBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        },

        hidePaginationControls() {
            const pageInfo = document.getElementById('pageInfo');
            pageInfo.textContent = `總計 ${StateManager.currentDisplayData.length} 筆`;

            const buttons = ['firstPageBtn', 'prevPageBtn', 'nextPageBtn', 'lastPageBtn'];
            buttons.forEach(id => {
                document.getElementById(id).disabled = true;
            });
        },

        goToPage(page) {
            const totalPages = Math.ceil(StateManager.currentDisplayData.length / this.pageSize);

            if (page < 1) page = 1;
            if (page > totalPages) page = totalPages;

            this.currentPage = page;
            this.updateDisplay();
        },

        togglePagination() {
            this.usePagination = !this.usePagination;
            this.currentPage = 1;
            this.updateDisplay();

            const btn = document.getElementById('togglePaginationBtn');
            btn.textContent = this.usePagination ? '切換分頁' : '顯示分頁';
        }
    };

    // ============================================================================
    // 篩選管理模組
    // ============================================================================

    const FilterManager = {
        applyFiltersAndSort() {
            let data = [...StateManager.currentDisplayData];

            // 特殊狀態篩選
            if (showOnlySpecialStatus) {
                data = data.filter(row => checkSpecialStatus(row, row.channels || []));
            }

            return data;
        }
    };

    // ============================================================================
    // 工具函數
    // ============================================================================

    function splitPlanCodes(input) {
        if (!input || typeof input !== 'string') {
            return [];
        }

        const parts = input.split(/[\s,;]+/);

        const uniqueCodes = [];
        const seen = new Set();

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed);
                uniqueCodes.push(trimmed);
            }
        }

        return uniqueCodes;
    }

    function currencyConvert(val) {
        const code = String(val);
        return CONSTANTS.FIELD_DEFINITIONS.CURRENCY[code] || val || '';
    }

    function unitConvert(val) {
        if (!val) return '';
        return CONSTANTS.FIELD_DEFINITIONS.UNIT[val] || val;
    }

    function coverageTypeConvert(val) {
        return CONSTANTS.FIELD_DEFINITIONS.COVERAGE_TYPE[val] || val || '';
    }

    function channelCodeConvert(code) {
        if (!code) return '';
        return code === 'OT' ? 'BK' : code;
    }

    function formatDate(dt) {
        if (!dt) return '';
        const dateStr = String(dt);
        return dateStr.replace(/[- :]/g, '').slice(0, 8);
    }

    function formatToday() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day} 00:00:00`;
    }

    function getSaleStatus(today, saleStart, saleEnd) {
        if (!saleStart || !saleEnd) return '';

        if (saleEnd === '99991231' || saleEnd === '9999-12-31' ||
            saleEnd === '9999-12-31 00:00:00') {
            return '現售中';
        }

        const t = Number(today);
        const s = Number(formatDate(saleStart));
        const e = Number(formatDate(saleEnd));

        if (t > e) return '停售';
        if (t >= s && t <= e) return '現售中';
        return '未開始';
    }

    function checkSpecialStatus(item, channels = []) {
        const mainStatus = TableRenderer.getSaleStatus(item.saleEndDate);

        // 1. 主檔停售但通路現售
        if (mainStatus === '停售' && channels.some(c => c.status === '現售中')) {
            return true;
        }

        // 2. 主檔現售但所有通路停售
        if (mainStatus === '現售中' && channels.length > 0 &&
            channels.every(c => c.status === '停售')) {
            return true;
        }

        // 3. 日期邏輯矛盾
        if (channels.some(c =>
                Number(formatDate(item.saleEndDate)) < Number(formatDate(c.rawEnd)))) {
            return true;
        }

        // 4. 銷售起日異常
        if (channels.some(c =>
                Number(formatDate(item.saleStartDate)) > Number(formatDate(c.saleStartDate)))) {
            return true;
        }

        return false;
    }

    function hasSpecialStatusData(tableData) {
        return tableData.some(row => checkSpecialStatus(row, row.channels || []));
    }

    function updateSpecialStatusButton(tableData) {
        const toolbar = document.querySelector(`#${CONSTANTS.MAIN_UI_ID} .toolbar`);
        let specialBtn = document.getElementById('specialStatusBtn');

        const hasSpecialData = hasSpecialStatusData(tableData);

        if (hasSpecialData) {
            if (!specialBtn) {
                specialBtn = document.createElement('button');
                specialBtn.id = 'specialStatusBtn';
                specialBtn.textContent = '顯示特殊狀態';
                specialBtn.addEventListener('click', toggleSpecialStatusFilter);
                toolbar.appendChild(specialBtn);
            }
            specialBtn.style.display = 'inline-block';
        } else {
            if (specialBtn) {
                specialBtn.style.display = 'none';
            }
        }
    }

    function toggleSpecialStatusFilter() {
        showOnlySpecialStatus = !showOnlySpecialStatus;

        const btn = document.getElementById('specialStatusBtn');
        if (showOnlySpecialStatus) {
            btn.textContent = '顯示全部';
            btn.className = 'special';
        } else {
            btn.textContent = '顯示特殊狀態';
            btn.className = '';
        }

        PaginationManager.currentPage = 1;
        PaginationManager.updateDisplay();
    }

    async function processData(rawData, mode) {
        if (!rawData || !Array.isArray(rawData)) {
            return [];
        }

        const processedData = [];
        let index = 1;

        for (const item of rawData) {
            try {
                if (item._apiStatus === '查無資料' || item._apiStatus === '查詢失敗') {
                    processedData.push({
                        no: index++,
                        planCode: item.planCode || '-',
                        shortName: '-',
                        currency: '-',
                        unit: '-',
                        coverageType: '-',
                        saleStartDate: '-',
                        saleEndDate: `查詢失敗: ${escapeHtml(item._apiStatus)}`,
                        _isErrorRow: true,
                        polpln: '-',
                        channels: [],
                        special: false,
                        _detailQueried: true
                    });
                    continue;
                }

                const processedItem = {
                    no: index++,
                    planCode: item.planCode || '-',
                    shortName: item.shortName || item.planName || '-',
                    currency: currencyConvert(item.currency || item.cur),
                    unit: unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit),
                    coverageType: coverageTypeConvert(item.coverageType || item.type),
                    saleStartDate: formatDate(item.saleStartDate) || '-',
                    saleEndDate: formatDate(item.saleEndDate) || '-',
                    _isErrorRow: false,
                    polpln: '',
                    channels: [],
                    special: false,
                    _detailQueried: false,
                    _originalData: item
                };

                processedData.push(processedItem);

            } catch (error) {
                console.error('處理資料時發生錯誤:', error, item);
                processedData.push({
                    no: index++,
                    planCode: item.planCode || '-',
                    shortName: '資料處理錯誤',
                    currency: '-',
                    unit: '-',
                    coverageType: '-',
                    saleStartDate: '-',
                    saleEndDate: '處理失敗',
                    _isErrorRow: true,
                    polpln: '-',
                    channels: [],
                    special: false,
                    _detailQueried: true
                });
            }
        }

        return processedData;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // 事件處理函數
    // ============================================================================

    function handleTableClick(e) {
        const target = e.target;
        const action = target.dataset.action;
        const row = target.closest('tr');

        if (!row || !action) return;

        const planCode = row.dataset.planCode;

        switch (action) {
            case 'queryDetail':
                queryRowDetail(planCode, row);
                break;
        }
    }

    async function queryRowDetail(planCode, row) {
        if (!planCode || planCode === '-') return;

        try {
            UIManager.showToast(`查詢 ${planCode} 詳細資訊中...`, 'info');

            const [detailData, channelData] = await Promise.all([
                ApiManager.queryProductDetail(planCode),
                ApiManager.queryChannelData(planCode)
            ]);

            const dataIndex = StateManager.currentDisplayData.findIndex(
                item => item.planCode === planCode
            );

            if (dataIndex !== -1) {
                const item = StateManager.currentDisplayData[dataIndex];

                if (detailData && !detailData.error) {
                    item.polpln = detailData.polpln || '';
                }

                if (channelData && Array.isArray(channelData)) {
                    item.channels = channelData;
                }

                const mainStatus = TableRenderer.getSaleStatus(item.saleEndDate);
                item.special = checkSpecialStatus(item, item.channels);

                item._detailQueried = true;

                const originalIndex = StateManager.originalQueryResults.findIndex(
                    orig => orig.planCode === planCode
                );
                if (originalIndex !== -1) {
                    Object.assign(StateManager.originalQueryResults[originalIndex], item);
                }
            }

            PaginationManager.updateDisplay();

            UIManager.showToast(`${planCode} 詳細資訊查詢完成`, 'success');

        } catch (error) {
            console.error('查詢詳細資訊失敗:', error);
            UIManager.showToast(`查詢 ${planCode} 失敗: ${error.message}`, 'error');
        }
    }

    async function startQuery() {
        try {
            await EnvManager.showDialog();
            UIManager.updateEnvironmentDisplay();

            let token = TokenManager.load();
            if (!token) {
                token = await TokenManager.showDialog();
                if (!token) {
                    UIManager.showToast('已略過Token驗證，查詢可能失敗', 'warning');
                }
            }

            const queryParams = await showQueryDialog();
            if (!queryParams) return;

            const data = await DataLoader.loadProductData(queryParams.mode, queryParams.input, queryParams.options);

            PaginationManager.currentPage = 1;
            PaginationManager.updateDisplay();

        } catch (error) {
            console.error('查詢流程失敗:', error);
            UIManager.showToast('查詢失敗', 'error');
        }
    }

    async function showQueryDialog() {
        return new Promise((resolve) => {
            const dialog = UIManager.createDialog({
                title: '查詢條件設定',
                content: `
          <div class="query-form">
            <div class="card-grid">
              <div class="query-card" data-mode="${CONSTANTS.QUERY_MODES.PLAN_CODE}">
                商品代碼
              </div>
              <div class="query-card" data-mode="${CONSTANTS.QUERY_MODES.PLAN_NAME}">
                商品關鍵字
              </div>
              <div class="query-card" data-mode="${CONSTANTS.QUERY_MODES.ALL_PLANS}">
                查詢全部
              </div>
              <div class="query-card" data-mode="masterData">
                主檔資料
              </div>
              <div class="query-card" data-mode="channelData">
                通路資料
              </div>
            </div>
            
            <div id="dynamicContent"></div>
            
            <div class="form-actions">
              <button id="executeQuery" class="primary-btn">開始查詢</button>
              <button id="cancelQuery" class="secondary-btn">取消</button>
              <button id="clearAll" class="secondary-btn">清除</button>
            </div>
          </div>
        `,
                className: 'query-dialog'
            });

            let selectedMode = null;
            let selectedSubOptions = [];
            let selectedChannels = [];
            let inputValue = '';

            const cards = dialog.querySelectorAll('.query-card');
            const dynamicContent = dialog.querySelector('#dynamicContent');
            const executeBtn = dialog.querySelector('#executeQuery');
            const cancelBtn = dialog.querySelector('#cancelQuery');
            const clearBtn = dialog.querySelector('#clearAll');

            // 卡片點擊事件
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    cards.forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedMode = card.dataset.mode;
                    updateDynamicContent();
                });
            });

            function updateDynamicContent() {
                switch (selectedMode) {
                    case CONSTANTS.QUERY_MODES.PLAN_CODE:
                        dynamicContent.innerHTML = `
              <div class="form-group">
                <label>輸入查詢內容：</label>
                <textarea id="queryInput" rows="3" placeholder="請輸入商品代碼(多筆請用空格、逗號或分號分隔)"></textarea>
              </div>
            `;
                        break;

                    case CONSTANTS.QUERY_MODES.PLAN_NAME:
                        dynamicContent.innerHTML = `
              <div class="form-group">
                <label>輸入查詢內容：</label>
                <textarea id="queryInput" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea>
              </div>
            `;
                        break;

                    case CONSTANTS.QUERY_MODES.ALL_PLANS:
                        dynamicContent.innerHTML = `
              <div style="text-align: center; padding: 20px; color: #666;">
                將查詢所有商品資料，無需輸入條件
              </div>
            `;
                        break;

                    case 'masterData':
                        dynamicContent.innerHTML = `
              <div class="form-group">
                <label>選擇查詢範圍：</label>
                <div class="sub-options">
                  <div class="sub-option" data-option="current">現售</div>
                  <div class="sub-option" data-option="stopped">停售</div>
                </div>
              </div>
            `;
                        bindSubOptions();
                        break;

                    case 'channelData':
                        dynamicContent.innerHTML = `
              <div class="form-group">
                <label>選擇通路：</label>
                <div class="channel-grid">
                  ${CONSTANTS.CHANNELS.map(ch => 
                    `<div class="channel-option" data-channel="${ch}">${ch}</div>`
                  ).join('')}
                </div>
              </div>
              <div class="form-group">
                <label>選擇查詢範圍：</label>
                <div class="sub-options">
                  <div class="sub-option" data-option="current">現售</div>
                  <div class="sub-option" data-option="stopped">停售</div>
                </div>
              </div>
            `;
                        bindChannelOptions();
                        bindSubOptions();
                        break;
                }

                const input = dynamicContent.querySelector('#queryInput');
                if (input) {
                    input.addEventListener('input', (e) => {
                        inputValue = e.target.value;
                    });
                }
            }

            function bindSubOptions() {
                const subOptions = dynamicContent.querySelectorAll('.sub-option');
                subOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        option.classList.toggle('selected');
                        selectedSubOptions = Array.from(dynamicContent.querySelectorAll('.sub-option.selected'))
                            .map(opt => opt.dataset.option);
                    });
                });
            }

            function bindChannelOptions() {
                const channelOptions = dynamicContent.querySelectorAll('.channel-option');
                channelOptions.forEach(option => {
                    option.addEventListener('click', () => {
                        option.classList.toggle('selected');
                        selectedChannels = Array.from(dynamicContent.querySelectorAll('.channel-option.selected'))
                            .map(opt => opt.dataset.channel);
                    });
                });
            }

            function clearAllSelections() {
                cards.forEach(c => c.classList.remove('selected'));
                selectedMode = null;
                selectedSubOptions = [];
                selectedChannels = [];
                inputValue = '';
                dynamicContent.innerHTML = '';
            }

            executeBtn.addEventListener('click', () => {
                if (!selectedMode) {
                    UIManager.showToast('請選擇查詢模式', 'error');
                    return;
                }

                let finalMode = selectedMode;
                let finalInput = inputValue;
                let options = {};

                // 處理主檔和通路的子選項
                if (selectedMode === 'masterData') {
                    if (selectedSubOptions.length === 0 || selectedSubOptions.length === 2) {
                        // 都不選或都選 = 查全部
                        finalMode = CONSTANTS.QUERY_MODES.ALL_PLANS;
                        finalInput = '';
                    } else if (selectedSubOptions.includes('current')) {
                        finalMode = CONSTANTS.QUERY_MODES.MASTER_DATA_CURRENT;
                    } else if (selectedSubOptions.includes('stopped')) {
                        finalMode = CONSTANTS.QUERY_MODES.MASTER_DATA_STOPPED;
                    }
                } else if (selectedMode === 'channelData') {
                    options.channels = selectedChannels;

                    if (selectedSubOptions.length === 0 || selectedSubOptions.length === 2) {
                        // 查全部（現售+停售）
                        finalMode = CONSTANTS.QUERY_MODES.CHANNEL_DATA_CURRENT;
                        // 需要額外查詢停售並合併
                    } else if (selectedSubOptions.includes('current')) {
                        finalMode = CONSTANTS.QUERY_MODES.CHANNEL_DATA_CURRENT;
                    } else if (selectedSubOptions.includes('stopped')) {
                        finalMode = CONSTANTS.QUERY_MODES.CHANNEL_DATA_STOPPED;
                    }
                }

                // 驗證必要輸入
                if ((finalMode === CONSTANTS.QUERY_MODES.PLAN_CODE ||
                        finalMode === CONSTANTS.QUERY_MODES.PLAN_NAME) && !finalInput) {
                    UIManager.showToast('請輸入查詢內容', 'error');
                    return;
                }

                UIManager.closeDialog(dialog);
                resolve({
                    mode: finalMode,
                    input: finalInput,
                    options
                });
            });

            cancelBtn.addEventListener('click', () => {
                UIManager.closeDialog(dialog);
                resolve(null);
            });

            clearBtn.addEventListener('click', () => {
                clearAllSelections();
            });
        });
    }

    async function queryCurrentSale() {
        try {
            const data = await DataLoader.loadProductData(CONSTANTS.QUERY_MODES.MASTER_DATA_CURRENT, '');

            PaginationManager.currentPage = 1;
            PaginationManager.updateDisplay();

        } catch (error) {
            console.error('查詢現售商品失敗:', error);
            UIManager.showToast('查詢現售商品失敗', 'error');
        }
    }

    async function copyAllData() {
        try {
            const data = StateManager.currentDisplayData;
            if (!data || data.length === 0) {
                UIManager.showToast('沒有資料可複製', 'warning');
                return;
            }

            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '類型', '銷售起日', '銷售迄日'];
            const csvContent = [
                headers.join('\t'),
                ...data.map(row => [
                    row.no,
                    row.planCode,
                    row.shortName,
                    row.currency,
                    row.unit,
                    row.coverageType,
                    row.saleStartDate,
                    row.saleEndDate
                ].join('\t'))
            ].join('\n');

            await navigator.clipboard.writeText(csvContent);
            UIManager.showToast(`已複製 ${data.length} 筆資料到剪貼簿`, 'success');

        } catch (error) {
            console.error('複製失敗:', error);
            UIManager.showToast('複製失敗', 'error');
        }
    }

    async function queryAllDetails() {
        try {
            const data = StateManager.currentDisplayData;
            const unqueriedData = data.filter(item => !item._detailQueried && item.planCode !== '-');

            if (unqueriedData.length === 0) {
                UIManager.showToast('所有資料已查詢完成', 'info');
                return;
            }

            UIManager.showToast(`開始查詢 ${unqueriedData.length} 筆商品詳情...`, 'info');

            for (let i = 0; i < unqueriedData.length; i++) {
                const item = unqueriedData[i];

                try {
                    const [detailData, channelData] = await Promise.all([
                        ApiManager.queryProductDetail(item.planCode),
                        ApiManager.queryChannelData(item.planCode)
                    ]);

                    if (detailData && !detailData.error) {
                        item.polpln = detailData.polpln || '';
                    }

                    if (channelData && Array.isArray(channelData)) {
                        item.channels = channelData;
                    }

                    item.special = checkSpecialStatus(item, item.channels);
                    item._detailQueried = true;

                    const originalIndex = StateManager.originalQueryResults.findIndex(
                        orig => orig.planCode === item.planCode
                    );
                    if (originalIndex !== -1) {
                        Object.assign(StateManager.originalQueryResults[originalIndex], item);
                    }

                    UIManager.showToast(`已查詢 ${i + 1}/${unqueriedData.length} 筆`, 'info');

                } catch (error) {
                    console.error(`查詢 ${item.planCode} 失敗:`, error);
                }
            }

            PaginationManager.updateDisplay();
            UIManager.showToast('一鍵查詳情完成', 'success');

        } catch (error) {
            console.error('一鍵查詳情失敗:', error);
            UIManager.showToast('一鍵查詳情失敗', 'error');
        }
    }

    function clearAllData() {
        StateManager.reset();
        showOnlySpecialStatus = false;
        PaginationManager.currentPage = 1;

        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
          請點擊「重新查詢」開始查詢商品資料
        </td>
      </tr>
    `;

        const specialBtn = document.getElementById('specialStatusBtn');
        if (specialBtn) {
            specialBtn.style.display = 'none';
        }

        PaginationManager.hidePaginationControls();

        UIManager.showToast('已清除所有資料', 'success');
    }

    // ============================================================================
    // 初始化和事件綁定
    // ============================================================================

    function initializeEventListeners() {
        const container = document.getElementById(CONSTANTS.MAIN_UI_ID);

        // 工具列按鈕事件
        container.querySelector('#queryBtn').addEventListener('click', startQuery);
        container.querySelector('#currentSaleBtn').addEventListener('click', queryCurrentSale);
        container.querySelector('#copyAllBtn').addEventListener('click', copyAllData);
        container.querySelector('#queryDetailsBtn').addEventListener('click', queryAllDetails);
        container.querySelector('#togglePaginationBtn').addEventListener('click', () => {
            PaginationManager.togglePagination();
        });
        container.querySelector('#clearDataBtn').addEventListener('click', clearAllData);

        // 分頁按鈕事件
        container.querySelector('#firstPageBtn').addEventListener('click', () => {
            PaginationManager.goToPage(1);
        });
        container.querySelector('#prevPageBtn').addEventListener('click', () => {
            PaginationManager.goToPage(PaginationManager.currentPage - 1);
        });
        container.querySelector('#nextPageBtn').addEventListener('click', () => {
            PaginationManager.goToPage(PaginationManager.currentPage + 1);
        });
        container.querySelector('#lastPageBtn').addEventListener('click', () => {
            const totalPages = Math.ceil(StateManager.currentDisplayData.length / PaginationManager.pageSize);
            PaginationManager.goToPage(totalPages);
        });

        // 表格點擊事件
        container.querySelector('#dataTable').addEventListener('click', handleTableClick);

        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const mainContainer = document.getElementById(CONSTANTS.MAIN_UI_ID);
                if (mainContainer) {
                    mainContainer.remove();
                }
            }
        });
    }

    // ============================================================================
    // 主要初始化函數
    // ============================================================================

    async function init() {
        try {
            // 檢查是否已存在
            if (document.getElementById(CONSTANTS.MAIN_UI_ID)) {
                document.getElementById(CONSTANTS.MAIN_UI_ID).remove();
            }

            // 創建主容器
            document.body.insertAdjacentHTML('beforeend', UIManager.createMainContainer());

            // 初始化事件監聽器
            initializeEventListeners();

            // 顯示歡迎訊息
            UIManager.showToast('商品查詢工具已載入', 'success');

            console.log('商品查詢工具 v' + CONSTANTS.VERSION + ' 初始化完成');

        } catch (error) {
            console.error('初始化失敗:', error);
            alert('商品查詢工具初始化失敗: ' + error.message);
        }
    }

    // ============================================================================
    // 公開API
    // ============================================================================

    window.PlanCodeQueryTool = {
        init,
        version: CONSTANTS.VERSION,

        // 公開的方法
        query: startQuery,
        clear: clearAllData,
        export: copyAllData,

        // 狀態訪問
        getState: () => StateManager,
        getData: () => StateManager.currentDisplayData,

        // 環境切換
        setEnvironment: (env) => {
            if (CONSTANTS.API_ENDPOINTS[env]) {
                StateManager.currentEnvironment = env;
                CURRENT_API_URL = CONSTANTS.API_ENDPOINTS[env];
                UIManager.updateEnvironmentDisplay();
                UIManager.showToast(`已切換到 ${env} 環境`, 'info');
            }
        },

        // Token管理
        setToken: (token) => {
            TokenManager.set(token);
            UIManager.showToast('Token已更新', 'success');
        },

        // 直接查詢方法
        queryByPlanCode: async (planCode) => {
            return await DataLoader.loadProductData(CONSTANTS.QUERY_MODES.PLAN_CODE, planCode);
        },

        queryByKeyword: async (keyword) => {
            return await DataLoader.loadProductData(CONSTANTS.QUERY_MODES.PLAN_NAME, keyword);
        },

        queryCurrentSale: async () => {
            return await DataLoader.loadProductData(CONSTANTS.QUERY_MODES.MASTER_DATA_CURRENT, '');
        }
    };

    // ============================================================================
    // 自動初始化
    // ============================================================================

    // 如果頁面已載入完成，直接初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// ============================================================================
// 使用說明和快速啟動
// ============================================================================

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           商品查詢工具 v2.0                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  🚀 快速啟動：                                                               ║
║     PlanCodeQueryTool.init()                                                 ║
║                                                                              ║
║  📋 主要功能：                                                               ║
║     • 支援7種查詢模式（商品代號、關鍵字、全部、主檔現售/停售、通路現售/停售）  ║
║     • 卡片式查詢UI設計                                                       ║
║     • 特殊狀態自動檢測和標示                                                 ║
║     • 一鍵查詳情和複製功能                                                   ║
║     • 分頁顯示和篩選功能                                                     ║
║     • 支援UAT/PROD環境切換                                                   ║
║                                                                              ║
║  🔧 API方法：                                                                ║
║     PlanCodeQueryTool.query()              - 開始查詢                        ║
║     PlanCodeQueryTool.queryByPlanCode()    - 直接查商品代號                  ║
║     PlanCodeQueryTool.queryByKeyword()     - 直接查關鍵字                    ║
║     PlanCodeQueryTool.setEnvironment()     - 切換環境                        ║
║     PlanCodeQueryTool.setToken()           - 設定Token                       ║
║     PlanCodeQueryTool.clear()              - 清除資料                        ║
║                                                                              ║
║  ⌨️  快捷鍵：                                                                ║
║     ESC - 關閉工具                                                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
