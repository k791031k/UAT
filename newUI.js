(function() {
    'use strict';
    const PANEL_ID = 'pro-bookmarklet-ui-2025';
    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel) {
        const existingStyle = document.getElementById(`${PANEL_ID}-style`);
        if (existingStyle) existingStyle.remove();
        existingPanel.remove();
    }
    const panelCSS = `
        :root {
            --bm-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            --bm-font-mono: 'SF Mono', Menlo, Monaco, 'Courier New', monospace;
            --bm-bg-panel: #ffffff;
            --bm-bg-header: #f7f7f7;
            --bm-text-primary: #111111;
            --bm-text-secondary: #666666;
            --bm-border-color: #eaeaea;
            --bm-primary-color: #007aff;
            --bm-primary-hover: #0056b3;
            --bm-danger-color: #ff3b30;
            --bm-success-color: #34c759;
            --bm-radius: 8px;
            --bm-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        #${PANEL_ID} {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 850px;
            max-width: 90vw;
            height: 70vh;
            background: var(--bm-bg-panel);
            border-radius: var(--bm-radius);
            box-shadow: var(--bm-shadow);
            z-index: 999999;
            font-family: var(--bm-font-sans);
            color: var(--bm-text-primary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            resize: both;
            min-width: 600px;
            min-height: 300px;
            border: 1px solid var(--bm-border-color);
        }
        .bm-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            background: var(--bm-bg-header);
            border-bottom: 1px solid var(--bm-border-color);
            cursor: grab;
            user-select: none;
            flex-shrink: 0;
        }
        .bm-header:active { cursor: grabbing; }
        .bm-header-title {
            font-size: 1rem;
            font-weight: 600;
        }
        .bm-btn-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .bm-btn {
            box-sizing: border-box;
            height: 32px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 500;
            border-radius: 6px;
            border: 1px solid #dcdcdc;
            background-color: white;
            color: #333;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .bm-btn.close-btn {
            width: 32px;
            padding: 0;
            font-size: 16px;
        }
        .bm-btn:hover {
            border-color: #b0b0b0;
            background-color: #f9f9f9;
        }
        .bm-btn:active {
            background-color: #f0f0f0;
            transform: scale(0.98);
        }
        .bm-btn-execute {
            background-color: var(--bm-primary-color);
            color: white;
            border-color: transparent;
        }
        .bm-btn-execute:hover {
            background-color: var(--bm-primary-hover);
            border-color: transparent;
        }
        .bm-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background-color: #eee;
        }
        .bm-content {
            flex-grow: 1;
            overflow: auto;
            padding: 16px;
        }
        #functionTable {
            width: 100%;
            border-collapse: collapse;
            font-family: var(--bm-font-mono);
            font-size: 13px;
            border: 1px solid var(--bm-border-color);
            border-radius: var(--bm-radius);
            overflow: hidden;
        }
        #functionTable th, #functionTable td {
            padding: 10px 16px;
            text-align: left;
            border-bottom: 1px solid var(--bm-border-color);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 250px;
        }
        #functionTable tr:last-child td {
            border-bottom: none;
        }
        #functionTable th:first-child, #functionTable td:first-child { max-width: 60px; }
        #functionTable th:last-child, #functionTable td:last-child { max-width: 120px; text-align: center; }
        #functionTable th {
            background-color: var(--bm-bg-header);
            font-weight: 500;
            color: var(--bm-text-secondary);
            cursor: pointer;
        }
        #functionTable tbody tr:hover { background-color: #f5faff; }
        .bm-tag {
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }
        .bm-tag-success { background-color: #eaf7ec; color: #2e8540; }
        .bm-tag-danger { background-color: #fdeeee; color: #c93434; }
        #loadingStatus { padding: 3rem; text-align: center; color: var(--bm-text-secondary); }
    `;
    const panelHTML = `
        <header class="bm-header">
            <h2 class="bm-header-title">🛠️ 自動化工具箱</h2>
            <div class="bm-btn-group">
                <button class="bm-btn clear-btn" title="清除頁面 Cookie 和快取">清除</button>
                <button class="bm-btn import-btn" title="匯入 JSON 檔案">匯入</button>
                <button class="bm-btn refresh-btn" title="重新載入資料">重載</button>
                <button class="bm-btn close-btn" title="關閉工具">×</button>
            </div>
        </header>
        <main class="bm-content">
            <div id="loadingStatus">載入中...</div>
            <table id="functionTable" style="display: none;">
                <thead>
                    <tr>
                        <th data-column="index">#</th>
                        <th data-column="id">功能名稱</th>
                        <th data-column="description">說明</th>
                        <th data-column="category">分類</th>
                        <th>狀態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </main>
        <input type="file" id="fileInput" accept=".json" style="display: none;">
    `;
    const styleElement = document.createElement('style');
    styleElement.id = `${PANEL_ID}-style`;
    styleElement.innerHTML = panelCSS;
    document.head.appendChild(styleElement);
    const uiContainer = document.createElement('div');
    uiContainer.id = PANEL_ID;
    uiContainer.innerHTML = panelHTML;
    document.body.appendChild(uiContainer);

    // JS 核心
    const functionTable = uiContainer.querySelector('#functionTable');
    const functionTableBody = functionTable.querySelector('tbody');
    const loadingStatus = uiContainer.querySelector('#loadingStatus');
    const fileInput = uiContainer.querySelector('#fileInput');
    let originalData = [], currentSortColumn = 'index', currentSortDirection = 'asc';

    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderTable(data) {
        functionTableBody.innerHTML = data.map(func => {
            const isError = func.hasErrors;
            const statusTag = isError
                ? `<span class="bm-tag bm-tag-danger" title="${escapeHtml(func.errors.join(', '))}">錯誤</span>`
                : `<span class="bm-tag bm-tag-success">正常</span>`;
            return `
                <tr title="ID: ${escapeHtml(func.id)}\n說明: ${escapeHtml(func.description)}">
                    <td title="${func.originalIndex}">${func.originalIndex}</td>
                    <td title="${escapeHtml(func.id)}">${escapeHtml(func.id)}</td>
                    <td title="${escapeHtml(func.description)}">${escapeHtml(func.description)}</td>
                    <td title="${escapeHtml(func.category)}">${escapeHtml(func.category)}</td>
                    <td>${statusTag}</td>
                    <td>
                        <button class="bm-btn bm-btn-execute execute-btn"
                            data-script="${escapeHtml(func.action_script)}"
                            ${isError ? 'disabled' : ''}>執行</button>
                    </td>
                </tr>`;
        }).join('');
        bindButtonEvents();
    }

    function validateFunctionItem(item, index) {
        const errors = [];
        if (!item || typeof item !== 'object') errors.push('項目格式錯誤');
        if (!item || !item.id) errors.push('缺少id');
        if (!item || !item.action_script) errors.push('缺少action_script');
        const validatedItem = {
            id: item.id || `未命名_${index + 1}`,
            description: item.description || '-',
            category: item.category || '未分類',
            type: item.type || 'action',
            action_script: item.action_script || '',
            originalIndex: index + 1,
            hasErrors: errors.length > 0,
            errors: errors
        };
        return { isValid: errors.length === 0, errors, item: validatedItem };
    }

    function processData(rawData) {
        originalData = [];
        if (!Array.isArray(rawData)) return;
        rawData.forEach((item, index) => {
            const validation = validateFunctionItem(item, index);
            originalData.push(validation.item);
        });
        loadingStatus.style.display = 'none';
        functionTable.style.display = 'table';
        sortTable(currentSortColumn, currentSortDirection);
    }

    const STORAGE_KEY = 'autoToolFunctions';
    function saveToLocalStorage(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('LocalStorage 儲存失敗:', e);
            return false;
        }
    }
    function loadFromLocalStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('LocalStorage 讀取失敗:', e);
            return null;
        }
    }

    function loadFunctionData() {
        const timestamp = Date.now();
        const urls = [
            `https://cdn.jsdelivr.net/gh/k791031k/UAT/1functions.json?v=${timestamp}`,
            `https://raw.githubusercontent.com/k791031k/UAT/main/1functions.json?v=${timestamp}`
        ];
        async function fetchData() {
            const local = loadFromLocalStorage();
            if(local) { processData(local); }
            for (const url of urls) {
                try {
                    const res = await fetch(url, {cache: 'no-cache'});
                    if (!res.ok) throw new Error(res.statusText);
                    const data = await res.json();
                    processData(data);
                    saveToLocalStorage(data);
                    return;
                } catch(e) {
                    console.error('載入失敗:', url, e);
                }
            }
        }
        fetchData();
    }

    function sortTable(column, direction) {
        currentSortColumn = column;
        currentSortDirection = direction;
        const sortedData = [...originalData].sort((a,b) => {
            let valA = a[column], valB = b[column];
            // index 欄位用數值排序
            if(column === 'index') {
                valA = parseInt(a.originalIndex, 10);
                valB = parseInt(b.originalIndex, 10);
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            // 其他欄位用字串排序
            if (String(valA).toLowerCase() < String(valB).toLowerCase()) return direction === 'asc' ? -1 : 1;
            if (String(valA).toLowerCase() > String(valB).toLowerCase()) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        renderTable(sortedData);
    }

    function bindButtonEvents() {
        uiContainer.querySelectorAll('.execute-btn:not([disabled])').forEach(button => {
            button.addEventListener('click', (e) => {
                const script = e.target.dataset.script;
                try {
                    if (script.startsWith('javascript:')) {
                        eval(script.substring(11));
                    } else if (script.startsWith('external:')) {
                        const s = document.createElement('script');
                        s.src = script.substring(9);
                        document.body.appendChild(s);
                    }
                } catch (err) {
                    alert('執行失敗: ' + err.message);
                }
            });
        });
    }

    uiContainer.querySelector('.close-btn').addEventListener('click', () => uiContainer.remove());
    uiContainer.querySelector('.refresh-btn').addEventListener('click', loadFunctionData);
    uiContainer.querySelector('.import-btn').addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                processData(data);
                saveToLocalStorage(data);
                alert('匯入成功！');
            } catch (err) {
                alert('匯入失敗，請確認檔案格式正確。');
            }
        };
        reader.readAsText(file);
    });
    uiContainer.querySelector('.clear-btn').addEventListener('click', () => {
        if (confirm('確定要清除頁面Cookie和快取嗎？此操作無法復原。')) {
            localStorage.clear();
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            alert('已清除Cookie與快取。請重新載入頁面。');
        }
    });
    functionTable.querySelectorAll('th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-column');
            let direction = 'asc';
            if (currentSortColumn === column && currentSortDirection === 'asc') direction = 'desc';
            sortTable(column, direction);
        });
    });
    // 拖曳移動
    let isDragging = false, offsetX, offsetY;
    const header = uiContainer.querySelector('.bm-header');
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        offsetX = e.clientX - uiContainer.offsetLeft;
        offsetY = e.clientY - uiContainer.offsetTop;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        uiContainer.style.left = `${e.clientX - offsetX}px`;
        uiContainer.style.top = `${e.clientY - offsetY}px`;
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
    loadFunctionData();
})();

