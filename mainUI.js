(function() {
    console.log('MainUI 開始載入...');
    
    // 防止重複加載 UI
    if (document.getElementById('myBookmarkletUI')) {
        document.getElementById('myBookmarkletUI').remove();
    }

    // --- 創建 UI 介面 ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'myBookmarkletUI';
    uiContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 700px;
        max-width: 90vw;
        max-height: 85vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 99999;
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        color: #333;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        resize: both;
        min-width: 600px;
        min-height: 80px;
        transition: all 0.3s ease-out;
    `;

    uiContainer.innerHTML = `
        <div class="header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 25px;
            background: rgba(255, 255, 255, 0.95);
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            border-top-left-radius: 14px;
            border-top-right-radius: 14px;
            cursor: grab;
            backdrop-filter: blur(10px);
        ">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #2c3e50; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                🛠️ 我的自動化工具
            </h2>
            <div style="display: flex; align-items: center; gap: 8px;">
                <!-- 功能按鈕組 -->
                <div style="display: flex; gap: 6px; margin-right: 15px; padding-right: 15px; border-right: 2px solid #e0e0e0;">
                    <button class="clear-btn" style="
                        background: linear-gradient(45deg, #ff6b6b, #ee5a52);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
                    " title="清除頁面 Cookie 和快取">🧹 清除</button>
                    
                    <button class="import-btn" style="
                        background: linear-gradient(45deg, #4ecdc4, #44a08d);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
                    " title="手動匯入 JSON 資料">📥 載入</button>
                    
                    <button class="refresh-btn" style="
                        background: linear-gradient(45deg, #45b7d1, #96c93d);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(69, 183, 209, 0.3);
                    " title="重新載入資料">🔄 重載</button>
                </div>
                
                <!-- 控制按鈕組 -->
                <div style="display: flex; gap: 6px;">
                    <button class="toggle-btn" style="
                        background: none;
                        border: none;
                        font-size: 18px;
                        line-height: 1;
                        color: #666;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                        transform: rotate(0deg);
                    " title="收折/展開">&#x2303;</button>
                    
                    <button class="close-btn" style="
                        background: none;
                        border: none;
                        font-size: 22px;
                        line-height: 1;
                        color: #666;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                        transition: all 0.2s ease;
                    " title="關閉工具">&times;</button>
                </div>
            </div>
        </div>
        
        <div class="content" style="
            padding: 20px 25px;
            overflow-y: auto;
            flex-grow: 1;
            background: rgba(255, 255, 255, 0.98);
            transition: all 0.3s ease-out;
            border-bottom-left-radius: 14px;
            border-bottom-right-radius: 14px;
        ">
            <div id="loadingStatus" style="
                text-align: center; 
                padding: 30px; 
                color: #666;
                background: linear-gradient(45deg, #f093fb 0%, #f5576c 100%);
                background-clip: text;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-weight: 600;
                font-size: 16px;
            ">
                🔄 載入功能列表中...
            </div>
            
            <table id="functionTable" style="
                width: 100%;
                border-collapse: collapse;
                margin-top: 5px;
                font-size: 14px;
                display: none;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            ">
                <thead>
                    <tr style="background: linear-gradient(45deg, #667eea, #764ba2);">
                        <th class="sortable" data-column="index" style="
                            padding: 15px 12px; 
                            text-align: left; 
                            color: white; 
                            font-weight: 600; 
                            cursor: pointer; 
                            user-select: none;
                            transition: background-color 0.2s ease;
                            border-right: 1px solid rgba(255,255,255,0.2);
                        " title="點擊排序">
                            # <span class="sort-indicator" style="margin-left: 5px;">↕</span>
                        </th>
                        <th class="sortable" data-column="id" style="
                            padding: 15px 12px; 
                            text-align: left; 
                            color: white; 
                            font-weight: 600; 
                            cursor: pointer; 
                            user-select: none;
                            transition: background-color 0.2s ease;
                            border-right: 1px solid rgba(255,255,255,0.2);
                        " title="點擊排序">
                            功能名稱 <span class="sort-indicator" style="margin-left: 5px;">↕</span>
                        </th>
                        <th class="sortable" data-column="description" style="
                            padding: 15px 12px; 
                            text-align: left; 
                            color: white; 
                            font-weight: 600; 
                            cursor: pointer; 
                            user-select: none;
                            transition: background-color 0.2s ease;
                            border-right: 1px solid rgba(255,255,255,0.2);
                        " title="點擊排序">
                            說明 <span class="sort-indicator" style="margin-left: 5px;">↕</span>
                        </th>
                        <th class="sortable" data-column="category" style="
                            padding: 15px 12px; 
                            text-align: left; 
                            color: white; 
                            font-weight: 600; 
                            cursor: pointer; 
                            user-select: none;
                            transition: background-color 0.2s ease;
                            border-right: 1px solid rgba(255,255,255,0.2);
                        " title="點擊排序">
                            分類 <span class="sort-indicator" style="margin-left: 5px;">↕</span>
                        </th>
                        <th style="
                            padding: 15px 12px; 
                            text-align: left; 
                            color: white; 
                            font-weight: 600;
                        ">操作</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
        
        <!-- JSON 匯入對話框 -->
        <div id="importDialog" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 999999;
            display: none;
            justify-content: center;
            align-items: center;
        ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                width: 600px;
                max-width: 90vw;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            ">
                <h3 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 18px;">📥 匯入 JSON 資料</h3>
                <textarea id="jsonInput" placeholder="請貼上 JSON 格式的功能資料..." style="
                    width: 100%;
                    height: 300px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 15px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    resize: vertical;
                    outline: none;
                    transition: border-color 0.2s ease;
                "></textarea>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelImport" style="
                        padding: 10px 20px;
                        background: #95a5a6;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: background-color 0.2s ease;
                    ">取消</button>
                    <button id="confirmImport" style="
                        padding: 10px 20px;
                        background: linear-gradient(45deg, #4ecdc4, #44a08d);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
                    ">確認匯入</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(uiContainer);

    // 定義工具函數
    function escapeHtml(unsafe) {
        if (unsafe === undefined || unsafe === null) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 9999999;
            max-width: 300px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            transform: translateX(100%);
        `;
        
        if (type === 'success') {
            notification.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
        } else if (type === 'error') {
            notification.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a52)';
        } else {
            notification.style.background = 'linear-gradient(45deg, #45b7d1, #96c93d)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 動畫效果
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // 全域變數
    const functionTableBody = document.querySelector('#functionTable tbody');
    const functionTable = document.getElementById('functionTable');
    const loadingStatus = document.getElementById('loadingStatus');
    const importDialog = document.getElementById('importDialog');
    const jsonInput = document.getElementById('jsonInput');
    
    let originalData = [];
    let currentSortColumn = null;
    let currentSortDirection = 'asc';

    // 本地儲存管理
    const STORAGE_KEY = 'autoToolFunctions';
    
    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('儲存到 localStorage 失敗:', e);
            return false;
        }
    }
    
    function loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('從 localStorage 載入失敗:', e);
            return null;
        }
    }

    // 載入資料函數
    function loadFunctionData() {
        const timestamp = Date.now();
        const jsonUrls = [
            `https://cdn.jsdelivr.net/gh/k791031k/UAT/functions.js?v=${timestamp}`,
            `https://raw.githubusercontent.com/k791031k/UAT/main/functions.js?v=${timestamp}`
        ];

        loadingStatus.innerHTML = '🔄 載入功能列表中...';
        loadingStatus.style.display = 'block';
        functionTable.style.display = 'none';
        
        console.log('開始載入功能資料...');

        async function tryLoadData() {
            // 先嘗試從本地儲存載入
            const localData = loadFromLocalStorage();
            if (localData && Array.isArray(localData) && localData.length > 0) {
                console.log('從本地儲存載入資料:', localData);
                processData(localData);
                showNotification('已載入本地儲存的資料', 'info');
                
                // 背景更新遠端資料
                tryRemoteLoad();
                return;
            }
            
            // 嘗試遠端載入
            await tryRemoteLoad();
        }
        
        async function tryRemoteLoad() {
            for (let i = 0; i < jsonUrls.length; i++) {
                const url = jsonUrls[i];
                console.log(`嘗試載入 URL ${i + 1}:`, url);
                
                try {
                    loadingStatus.innerHTML = `🔄 載入中... (嘗試 ${i + 1}/${jsonUrls.length})`;
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('成功載入遠端資料:', data);

                    if (!Array.isArray(data)) {
                        throw new Error('資料格式錯誤：不是陣列格式');
                    }

                    if (data.length === 0) {
                        throw new Error('資料為空');
                    }

                    // 儲存到本地
                    if (saveToLocalStorage(data)) {
                        showNotification('資料已更新並儲存', 'success');
                    }
                    
                    processData(data);
                    return;

                } catch (error) {
                    console.error(`URL ${i + 1} 載入失敗:`, error);
                    
                    if (i === jsonUrls.length - 1) {
                        // 所有遠端 URL 都失敗，檢查是否有本地資料
                        const localData = loadFromLocalStorage();
                        if (localData && Array.isArray(localData) && localData.length > 0) {
                            processData(localData);
                            showNotification('使用本地儲存的資料', 'info');
                        } else {
                            showLoadError(error.message);
                        }
                    }
                }
            }
        }

        tryLoadData();
    }
    
    function processData(data) {
        originalData = data.map((item, index) => ({
            ...item,
            originalIndex: index + 1
        }));

        loadingStatus.style.display = 'none';
        functionTable.style.display = 'table';
        renderTable(originalData);
        bindSortEvents();
        
        console.log('資料載入完成，共', originalData.length, '筆');
    }
    
    function showLoadError(errorMessage) {
        loadingStatus.innerHTML = `
            <div style="color: #e74c3c; text-align: center;">
                <div style="font-weight: bold; margin-bottom: 15px; font-size: 18px;">⚠️ 載入失敗</div>
                <div style="margin-bottom: 15px; color: #7f8c8d;">無法載入功能資料</div>
                <div style="font-size: 12px; color: #95a5a6; margin-bottom: 20px;">
                    錯誤：${errorMessage}
                </div>
                <button onclick="document.querySelector('.import-btn').click()" style="
                    padding: 10px 20px; 
                    background: linear-gradient(45deg, #4ecdc4, #44a08d); 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-weight: 600;
                    margin-right: 10px;
                ">手動匯入資料</button>
                <button onclick="document.querySelector('.refresh-btn').click()" style="
                    padding: 10px 20px; 
                    background: linear-gradient(45deg, #45b7d1, #96c93d); 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-weight: 600;
                ">重新嘗試</button>
            </div>
        `;
    }

    // 渲染表格
    function renderTable(data) {
        functionTableBody.innerHTML = '';
        
        data.forEach((func, index) => {
            const row = functionTableBody.insertRow();
            row.style.cssText = `
                background-color: ${index % 2 === 0 ? '#f8f9fa' : 'white'};
                transition: all 0.2s ease;
                border-bottom: 1px solid #e9ecef;
            `;
            
            row.onmouseover = () => {
                row.style.backgroundColor = '#e3f2fd';
                row.style.transform = 'scale(1.01)';
            };
            row.onmouseout = () => {
                row.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
                row.style.transform = 'scale(1)';
            };

            const buttonType = func.type && ['action', 'utility', 'dangerous'].includes(func.type) ? func.type : 'action';

            row.innerHTML = `
                <td style="padding: 12px; border-right: 1px solid #e9ecef; font-weight: 600; color: #6c757d;">${func.originalIndex}</td>
                <td style="padding: 12px; border-right: 1px solid #e9ecef; font-weight: 500; color: #2c3e50;">${escapeHtml(func.id || '')}</td>
                <td style="padding: 12px; border-right: 1px solid #e9ecef; color: #495057;">${escapeHtml(func.description || '')}</td>
                <td style="padding: 12px; border-right: 1px solid #e9ecef;">
                    <span style="
                        background: linear-gradient(45deg, #667eea, #764ba2);
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    ">${escapeHtml(func.category || '')}</span>
                </td>
                <td style="padding: 12px;">
                    <button class="execute-btn type-${buttonType}" data-script="${escapeHtml(func.action_script || '')}" style="
                        padding: 8px 16px;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">▶ 執行</button>
                </td>
            `;
        });

        bindButtonEvents();
    }

    // 綁定按鈕事件
    function bindButtonEvents() {
        functionTableBody.querySelectorAll('.execute-btn').forEach(button => {
            const buttonType = button.classList.contains('type-utility') ? 'utility' :
                                 (button.classList.contains('type-dangerous') ? 'dangerous' : 'action');

            // 設定按鈕顏色
            let bgGradient;
            if (buttonType === 'utility') {
                bgGradient = 'linear-gradient(45deg, #007bff, #0056b3)';
            } else if (buttonType === 'dangerous') {
                bgGradient = 'linear-gradient(45deg, #dc3545, #bd2130)';
            } else {
                bgGradient = 'linear-gradient(45deg, #28a745, #1e7e34)';
            }
            
            button.style.background = bgGradient;

            button.addEventListener('mouseover', () => {
                button.style.transform = 'translateY(-2px) scale(1.05)';
                button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
            });
            
            button.addEventListener('mouseout', () => {
                button.style.transform = 'translateY(0) scale(1)';
                button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            });

            button.addEventListener('click', async (event) => {
                const scriptToExecute = event.target.dataset.script;
                
                try {
                    if (scriptToExecute.startsWith('javascript:')) {
                        const jsCode = scriptToExecute.substring(11);
                        (function() {
                            eval(jsCode);
                        })();
                        showNotification('功能執行成功', 'success');
                    } else if (scriptToExecute.startsWith('external:')) {
                        const scriptUrl = scriptToExecute.substring(9);
                        const externalScript = document.createElement('script');
                        externalScript.src = scriptUrl + '?v=' + Date.now();
                        externalScript.onload = () => {
                            console.log('外部腳本載入成功:', scriptUrl);
                            showNotification('外部腳本載入成功', 'success');
                        };
                        externalScript.onerror = () => {
                            console.error('外部腳本載入失敗:', scriptUrl);
                            showNotification('外部腳本載入失敗', 'error');
                        };
                        document.body.appendChild(externalScript);
                    } else {
                        throw new Error('不支援的腳本格式');
                    }
                } catch (e) {
                    console.error("執行功能腳本時發生錯誤:", e);
                    showNotification('執行失敗：' + e.message, 'error');
                }
                
                uiContainer.remove();
            });
        });
    }

    // 排序功能
    function sortTable(column) {
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = column;
            currentSortDirection = 'asc';
        }

        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.textContent = '↕';
        });
        
        const currentIndicator = document.querySelector(`[data-column="${column}"] .sort-indicator`);
        if (currentIndicator) {
            currentIndicator.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
        }

        const sortedData = [...originalData].sort((a, b) => {
            let aVal = column === 'index' ? a.originalIndex : a[column] || '';
            let bVal = column === 'index' ? b.originalIndex : b[column] || '';
            
            if (column === 'index') {
                aVal = parseInt(aVal);
                bVal = parseInt(bVal);
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }

            if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable(sortedData);
    }

    // 綁定排序事件
    function bindSortEvents() {
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                sortTable(header.dataset.column);
            });
            header.addEventListener('mouseover', () => {
                header.style.backgroundColor = 'rgba(255,255,255,0.2)';
            });
            header.addEventListener('mouseout', () => {
                header.style.backgroundColor = 'transparent';
            });
        });
    }

    // 按鈕事件綁定
    
    // 關閉按鈕
    const closeBtn = document.querySelector('#myBookmarkletUI .close-btn');
    closeBtn.addEventListener('click', () => uiContainer.remove());
    closeBtn.addEventListener('mouseover', () => closeBtn.style.backgroundColor = 'rgba(220, 53, 69, 0.1)');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.backgroundColor = 'transparent');

    // 重新載入按鈕
    const refreshBtn = document.querySelector('#myBookmarkletUI .refresh-btn');
    refreshBtn.addEventListener('click', () => {
        loadingStatus.style.display = 'block';
        functionTable.style.display = 'none';
        loadFunctionData();
    });
    refreshBtn.addEventListener('mouseover', () => refreshBtn.style.transform = 'scale(1.05)');
    refreshBtn.addEventListener('mouseout', () => refreshBtn.style.transform = 'scale(1)');

    // 清除按鈕
    const clearBtn = document.querySelector('#myBookmarkletUI .clear-btn');
    clearBtn.addEventListener('click', () => {
        let clearedItems = [];
        let failedItems = [];
        
        // 清除 Cookies
        try {
            document.cookie.split(';').forEach(c => {
                let i = c.indexOf('='), n = i > -1 ? c.substr(0, i) : c;
                document.cookie = n.trim() + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
            });
            clearedItems.push('Cookies');
        } catch(e) { 
            failedItems.push('Cookies'); 
        }
        
        // 清除 localStorage
        try { 
            localStorage.clear(); 
            clearedItems.push('localStorage'); 
        } catch(e) { 
            failedItems.push('localStorage'); 
        }
        
        // 清除 sessionStorage
        try { 
            sessionStorage.clear(); 
            clearedItems.push('sessionStorage'); 
        } catch(e) { 
            failedItems.push('sessionStorage'); 
        }
        
        // 清除快取
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
                clearedItems.push('快取');
            });
        }
        
        const message = clearedItems.length > 0 
            ? `已清除：${clearedItems.join(', ')}` 
            : '清除失敗';
        const type = failedItems.length > 0 ? 'error' : 'success';
        
        showNotification(message, type);
    });
    clearBtn.addEventListener('mouseover', () => clearBtn.style.transform = 'scale(1.05)');
    clearBtn.addEventListener('mouseout', () => clearBtn.style.transform = 'scale(1)');

    // 匯入按鈕
    const importBtn = document.querySelector('#myBookmarkletUI .import-btn');
    importBtn.addEventListener('click', () => {
        importDialog.style.display = 'flex';
        jsonInput.focus();
    });
    importBtn.addEventListener('mouseover', () => importBtn.style.transform = 'scale(1.05)');
    importBtn.addEventListener('mouseout', () => importBtn.style.transform = 'scale(1)');

    // 匯入對話框事件
    document.getElementById('cancelImport').addEventListener('click', () => {
        importDialog.style.display = 'none';
        jsonInput.value = '';
    });

    document.getElementById('confirmImport').addEventListener('click', () => {
        const jsonText = jsonInput.value.trim();
        if (!jsonText) {
            showNotification('請輸入 JSON 資料', 'error');
            return;
        }

        try {
            const data = JSON.parse(jsonText);
            if (!Array.isArray(data)) {
                throw new Error('資料必須是陣列格式');
            }

            // 儲存到本地
            if (saveToLocalStorage(data)) {
                processData(data);
                importDialog.style.display = 'none';
                jsonInput.value = '';
                showNotification('資料匯入成功並已儲存', 'success');
            } else {
                throw new Error('儲存失敗');
            }
        } catch (e) {
            showNotification('JSON 格式錯誤：' + e.message, 'error');
        }
    });

    // 點擊對話框外部關閉
    importDialog.addEventListener('click', (e) => {
        if (e.target === importDialog) {
            importDialog.style.display = 'none';
            jsonInput.value = '';
        }
    });

    // 收折功能
    const toggleBtn = document.querySelector('#myBookmarkletUI .toggle-btn');
    const contentDiv = document.querySelector('#myBookmarkletUI .content');
    let isContentVisible = true;

    toggleBtn.addEventListener('click', () => {
        if (isContentVisible) {
            contentDiv.style.display = 'none';
            toggleBtn.style.transform = 'rotate(180deg)';
            uiContainer.style.height = 'auto';
        } else {
            contentDiv.style.display = 'block';
            toggleBtn.style.transform = 'rotate(0deg)';
        }
        isContentVisible = !isContentVisible;
    });
    toggleBtn.addEventListener('mouseover', () => toggleBtn.style.backgroundColor = 'rgba(108, 117, 125, 0.1)');
    toggleBtn.addEventListener('mouseout', () => toggleBtn.style.backgroundColor = 'transparent');

    // 拖曳功能
    const header = uiContainer.querySelector('.header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        offsetX = e.clientX - uiContainer.getBoundingClientRect().left;
        offsetY = e.clientY - uiContainer.getBoundingClientRect().top;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        newX = Math.max(0, Math.min(newX, window.innerWidth - uiContainer.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - uiContainer.offsetHeight));
        uiContainer.style.left = `${newX}px`;
        uiContainer.style.top = `${newY}px`;
        uiContainer.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'grab';
    });

    // 開始載入資料
    loadFunctionData();

    console.log('MainUI 載入完成');
})();
