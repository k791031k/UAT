javascript:(function() {
    // 檢查是否已經存在書籤小工具視窗，避免重複建立
    if (document.getElementById('bookmarklet-business-date-tool')) {
        console.log('書籤小工具已存在，不再重複建立。');
        return;
    }

    // =========================================================================
    // 模組一：設定與常數 (Configuration and Constants)
    // 負責定義 API 端點和基本的 UI 設定
    // =========================================================================
    const CONFIG = {
        API_BASE_URL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/businessDate/',
        // 注意：SSO-TOKEN 是動態的，通常需要從當前頁面的 Cookie 或 localStorage 獲取。
        // 這裡僅為範例，實際使用時您需要實作獲取當前有效 SSO-TOKEN 的邏輯。
        // 如果您在已登入的相同網域下執行，瀏覽器會自動帶上 Cookie，SSO-TOKEN 可能就不需要手動設定在 headers 中。
        // 或者從 sessionStorage/localStorage 中讀取，例如：localStorage.getItem('your-sso-token-key')
        // 為了通用性，我們假設某些標頭可能需要。
        DEFAULT_HEADERS: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'Content-Type': 'application/json' // 預設為 JSON 類型，如果 POST 請求有 payload
        }
    };

    // =========================================================================
    // 模組二：API 服務 (API Service Module)
    // 負責處理所有對業務日期 API 的呼叫邏輯
    // =========================================================================
    const apiService = {
        /**
         * 發送 HTTP 請求的通用函式
         * @param {string} endpoint - API 的端點，例如 'getBusinessDate'
         * @param {string} method - HTTP 方法，例如 'GET', 'POST', 'DELETE'
         * @param {object} [body=null] - 請求本文，POST/PUT 等方法使用
         * @returns {Promise<any>} - 請求結果的 Promise
         */
        async request(endpoint, method, body = null) {
            const url = `${CONFIG.API_BASE_URL}${endpoint}`;
            const options = {
                method: method,
                headers: { ...CONFIG.DEFAULT_HEADERS } // 複製預設標頭
            };

            // 如果有請求本文，則加入 body 和 Content-Length
            if (body) {
                options.body = JSON.stringify(body);
                // Content-Length 通常會由瀏覽器自動設置，不需要手動計算
            } else if (method === 'POST' || method === 'PUT') {
                // 如果是 POST 但沒有 body，可能需要明確設置 Content-Length 為 0
                options.headers['Content-Length'] = '0';
                // 如果沒有 body，通常不需要 Content-Type，避免某些伺服器解析問題
                delete options.headers['Content-Type'];
            }

            try {
                console.log(`發送請求: ${method} ${url}`, options);
                const response = await fetch(url, options);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API 請求失敗 (${response.status}): ${errorText}`);
                }

                // 嘗試解析 JSON，如果不是 JSON 則返回文本
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                } else {
                    return await response.text();
                }
            } catch (error) {
                console.error('API 呼叫錯誤:', error);
                throw error; // 重新拋出錯誤以便調用者處理
            }
        },

        // 取得業務日期 (根據 HAR 檔案，這是一個 POST 請求)
        getBusinessDate: () => apiService.request('getBusinessDate', 'POST', {}),

        // 取得我的業務日期 (根據 HAR 檔案，這也是一個 POST 請求)
        getMyBusinessDate: () => apiService.request('getMyBusinessDate', 'POST', {}),

        // 設定我的業務日期 (根據 HAR 檔案，這是一個 POST 請求，帶有 businessDate 參數)
        setMyBusinessDate: (date) => apiService.request('setMyBusinessDate', 'POST', { businessDate: date }),

        // 刪除業務日期功能範例 (Business Date 設定.txt 中未明確提供 delete API，此為通用範例)
        // 假設有一個 deleteBusinessDate 的 API，可能需要一個 ID 或日期作為參數
        deleteBusinessDate: (dateId) => apiService.request(`deleteBusinessDate/${dateId}`, 'DELETE')
    };

    // =========================================================================
    // 模組三：UI 呈現與事件處理 (UI Presentation and Event Handling)
    // 負責建立 DOM 元素、樣式和處理使用者互動
    // =========================================================================
    const uiManager = {
        // 建立並插入基本樣式
        createStyles() {
            const styleId = 'bookmarklet-business-date-tool-styles';
            if (document.getElementById(styleId)) return; // 避免重複插入
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                #bookmarklet-business-date-tool {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 350px;
                    background-color: #f0f0f0;
                    border: 1px solid #ccc;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    z-index: 99999;
                    font-family: Arial, sans-serif;
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    resize: both; /* 允許用戶調整大小 */
                    min-width: 250px;
                    min-height: 200px;
                }
                #bookmarklet-business-date-tool-header {
                    background-color: #4CAF50;
                    color: white;
                    padding: 10px 15px;
                    font-size: 16px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: grab; /* 可拖曳 */
                }
                #bookmarklet-business-date-tool-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0 5px;
                }
                #bookmarklet-business-date-tool-close:hover {
                    color: #ddd;
                }
                #bookmarklet-business-date-tool-content {
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    flex-grow: 1; /* 讓內容區域可伸縮 */
                    overflow-y: auto; /* 內容過多時可滾動 */
                }
                #bookmarklet-business-date-tool button {
                    background-color: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s;
                }
                #bookmarklet-business-date-tool button:hover {
                    background-color: #0056b3;
                }
                #bookmarklet-business-date-tool button:active {
                    background-color: #004085;
                }
                #bookmarklet-business-date-tool input[type="text"] {
                    width: calc(100% - 22px);
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                    font-size: 14px;
                }
                #bookmarklet-business-date-tool-output {
                    margin-top: 10px;
                    padding: 10px;
                    background-color: #e9e9e9;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    font-size: 12px;
                    max-height: 150px; /* 限制高度，可滾動 */
                    overflow-y: auto;
                    white-space: pre-wrap; /* 保留換行符 */
                    word-break: break-all; /* 長單詞自動換行 */
                }
            `;
            document.head.appendChild(style);
        },

        // 建立主視窗結構
        createWindow() {
            const container = document.createElement('div');
            container.id = 'bookmarklet-business-date-tool';
            container.style.display = 'block'; // 預設顯示

            // 視窗標頭
            const header = document.createElement('div');
            header.id = 'bookmarklet-business-date-tool-header';
            header.textContent = '業務日期工具';
            const closeBtn = document.createElement('button');
            closeBtn.id = 'bookmarklet-business-date-tool-close';
            closeBtn.innerHTML = '&times;'; // 'x' 符號
            header.appendChild(closeBtn);
            container.appendChild(header);

            // 視窗內容
            const content = document.createElement('div');
            content.id = 'bookmarklet-business-date-tool-content';

            // 業務日期輸入框 (for setMyBusinessDate)
            const dateInput = document.createElement('input');
            dateInput.type = 'text';
            dateInput.id = 'business-date-input';
            dateInput.placeholder = '輸入業務日期 (YYYY-MM-DD)';
            content.appendChild(dateInput);

            // API 按鈕群組
            const getButton = document.createElement('button');
            getButton.textContent = '取得業務日期 (getBusinessDate)';
            getButton.onclick = () => this.handleApiCall(apiService.getBusinessDate, '取得業務日期');

            const getMyButton = document.createElement('button');
            getMyButton.textContent = '取得我的業務日期 (getMyBusinessDate)';
            getMyButton.onclick = () => this.handleApiCall(apiService.getMyBusinessDate, '取得我的業務日期');

            const setMyButton = document.createElement('button');
            setMyButton.textContent = '設定我的業務日期 (setMyBusinessDate)';
            setMyButton.onclick = () => {
                const date = dateInput.value.trim();
                // 簡單的日期格式檢查，確保是 YYYY-MM-DD 格式
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (date && dateRegex.test(date)) {
                    this.handleApiCall(() => apiService.setMyBusinessDate(date), `設定我的業務日期為 ${date}`);
                } else {
                    this.displayOutput('請輸入有效的業務日期 (YYYY-MM-DD)！', true);
                }
            };
            
            // 刪除按鈕 (範例)
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '刪除業務日期 (範例)';
            deleteButton.onclick = () => {
                // 這裡使用 prompt 只是為了示範，實際應用中應使用更友好的 UI 輸入
                const dateId = prompt('請輸入要刪除的業務日期 ID (範例):');
                if (dateId) {
                    this.handleApiCall(() => apiService.deleteBusinessDate(dateId), `刪除業務日期 ID: ${dateId}`);
                } else {
                    this.displayOutput('已取消刪除操作', false);
                }
            };

            content.appendChild(getButton);
            content.appendChild(getMyButton);
            content.appendChild(setMyButton);
            content.appendChild(deleteButton); // 範例刪除按鈕

            // 輸出區域
            const outputDiv = document.createElement('div');
            outputDiv.id = 'bookmarklet-business-date-tool-output';
            outputDiv.textContent = 'API 回應將顯示在此處...';
            content.appendChild(outputDiv);

            container.appendChild(content);
            document.body.appendChild(container);

            this.setupEventListeners(container, header, closeBtn);
        },

        // 處理 API 呼叫並顯示結果
        async handleApiCall(apiFunction, description) {
            const outputDiv = document.getElementById('bookmarklet-business-date-tool-output');
            outputDiv.textContent = `${description} ... 請求中...`;
            outputDiv.style.color = '#333';

            try {
                const result = await apiFunction();
                outputDiv.textContent = `成功：\n${JSON.stringify(result, null, 2)}`;
                outputDiv.style.color = 'green';
            } catch (error) {
                outputDiv.textContent = `失敗：\n${error.message}`;
                outputDiv.style.color = 'red';
                console.error(`API ${description} 呼叫失敗:`, error);
            }
        },

        // 顯示訊息到輸出區域
        displayOutput(message, isError = false) {
            const outputDiv = document.getElementById('bookmarklet-business-date-tool-output');
            outputDiv.textContent = message;
            outputDiv.style.color = isError ? 'red' : '#333';
        },

        // 設定事件監聽器 (拖曳、關閉、ESC 鍵)
        setupEventListeners(container, header, closeBtn) {
            // 關閉按鈕事件
            closeBtn.addEventListener('click', () => this.closeWindow(container));

            // ESC 鍵關閉事件
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeWindow(container);
                }
            });

            // 拖曳功能
            let isDragging = false;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            header.addEventListener('mousedown', (e) => {
                initialX = e.clientX;
                initialY = e.clientY;
                isDragging = true;
                // 獲取當前 transform 值，以便在拖曳時疊加
                const transformMatrix = window.getComputedStyle(container).getPropertyValue('transform');
                if (transformMatrix && transformMatrix !== 'none') {
                    const matrix = transformMatrix.match(/matrix.*\((.+)\)/)[1].split(', ');
                    xOffset = parseFloat(matrix[4]);
                    yOffset = parseFloat(matrix[5]);
                } else {
                    xOffset = 0;
                    yOffset = 0;
                }
                e.preventDefault(); // 防止拖曳時選中文本
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    const currentX = e.clientX - initialX;
                    const currentY = e.clientY - initialY;

                    // 更新元素位置，同時保留 translate(-50%, -50%) 的居中效果
                    container.style.transform = `translate(-50%, -50%) translate(${xOffset + currentX}px, ${yOffset + currentY}px)`;
                }
            });
        },

        // 關閉視窗
        closeWindow(container) {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
                const style = document.getElementById('bookmarklet-business-date-tool-styles');
                if (style) style.parentNode.removeChild(style); // 移除樣式
            }
        }
    };

    // =========================================================================
    // 入口點 (Entry Point)
    // 初始化書籤小工具
    // =========================================================================
    function initializeBookmarklet() {
        uiManager.createStyles();
        uiManager.createWindow();
    }

    initializeBookmarklet(); // 執行初始化

})(); // 自執行匿名函式，避免污染全域變數
