(function() {
    // 防止重複加載 UI
    if (document.getElementById('myBookmarkletUI')) {
        document.getElementById('myBookmarkletUI').remove();
    }

    // --- 創建 UI 介面本身 ---
    const uiContainer = document.createElement('div');
    uiContainer.id = 'myBookmarkletUI';
    uiContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%); /* 始終居中對齊 */
        width: 450px; /* 版面預設寬度 */
        max-width: 85vw; /* 最大寬度 */
        max-height: 85vh; /* 最大高度 */
        background: rgba(255, 255, 255, 0.98);
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        z-index: 99999; /* 確保 UI 在最頂層 */
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        color: #333;
        display: flex;
        flex-direction: column;
        overflow: hidden; /* 隱藏溢出內容，保持圓角 */
        resize: both; /* 允許調整大小 */
        min-width: 300px;
        min-height: 100px; /* 最小高度 */
        transition: height 0.3s ease-out, max-height 0.3s ease-out; /* 高度變化增加過渡效果 */
    `;

    uiContainer.innerHTML = `
        <div class="header" style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 20px;
            background-color: #f8f8f8;
            border-bottom: 1px solid #eee;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
            cursor: grab;
        ">
            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #555;">我的自動化工具</h2>
            <div style="display: flex; align-items: center;">
                <button class="toggle-btn" style="
                    background: none;
                    border: none;
                    font-size: 20px; /* 箭頭大小 */
                    line-height: 1;
                    color: #888;
                    cursor: pointer;
                    margin-right: 10px;
                    transition: transform 0.2s ease-in-out, color 0.2s ease-in-out;
                    transform: rotate(0deg); /* 預設向上，表示展開狀態 */
                ">&#x2303;</button> <button class="close-btn" style="
                    background: none;
                    border: none;
                    font-size: 26px;
                    line-height: 1;
                    color: #888;
                    cursor: pointer;
                    transition: color 0.2s ease-in-out;
                ">&times;</button>
            </div>
        </div>
        <div class="content" style="
            padding: 15px 20px;
            overflow-y: auto;
            flex-grow: 1;
            transition: opacity 0.3s ease-out, max-height 0.3s ease-out;
            /* 內容預設為顯示，不需要初始 max-height: 0; */
        ">
            <table id="functionTable" style="
                width: 100%;
                border-collapse: collapse;
                margin-top: 5px;
                font-size: 14px;
            ">
                <thead>
                    <tr>
                        <th style="padding: 10px 12px; border: 1px solid #e9e9e9; text-align: left; background-color: #f2f2f2; font-weight: 600; color: #666;">#</th>
                        <th style="padding: 10px 12px; border: 1px solid #e9e9e9; text-align: left; background-color: #f2f2f2; font-weight: 600; color: #666;">功能名稱</th>
                        <th style="padding: 10px 12px; border: 1px solid #e9e9e9; text-align: left; background-color: #f2f2f2; font-weight: 600; color: #666;">說明</th>
                        <th style="padding: 10px 12px; border: 1px solid #e9e9e9; text-align: left; background-color: #f2f2f2; font-weight: 600; color: #666;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    </tbody>
            </table>
        </div>
    `;

    document.body.appendChild(uiContainer);

    // 關閉按鈕事件
    const closeBtn = document.querySelector('#myBookmarkletUI .close-btn');
    closeBtn.addEventListener('click', () => {
        uiContainer.remove();
    });
    closeBtn.addEventListener('mouseover', () => closeBtn.style.color = '#333');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.color = '#888');


    // --- 收折功能事件 ---
    const toggleBtn = document.querySelector('#myBookmarkletUI .toggle-btn');
    const contentDiv = document.querySelector('#myBookmarkletUI .content');
    let isContentVisible = true; // 追蹤內容是否可見，預設為 true (展開)
    
    // 注意: initialMaxHeight 必須在 contentDiv 首次渲染後才能準確獲取
    // 我們將使用 'unset' 或一個很大的值來模擬 '自動' 高度
    // 或者在展開時，根據內容實際高度計算 max-height
    // 但為了簡化和確保流暢性，使用 unset 搭配 overflow: hidden 其實效果最好

    toggleBtn.addEventListener('click', () => {
        if (isContentVisible) {
            // 收合
            contentDiv.style.opacity = '0';
            contentDiv.style.maxHeight = '0'; // 內容高度縮為0
            contentDiv.style.paddingTop = '0'; // 移除內容區的上下 padding
            contentDiv.style.paddingBottom = '0';
            uiContainer.style.maxHeight = `${uiContainer.querySelector('.header').offsetHeight}px`; // UI容器高度縮為header高度
            uiContainer.style.overflow = 'hidden';
            uiContainer.style.resize = 'none'; // 禁用調整大小
            toggleBtn.style.transform = 'rotate(180deg)'; // 箭頭向下
        } else {
            // 展開
            contentDiv.style.opacity = '1';
            contentDiv.style.maxHeight = 'unset'; // 恢復內容高度
            contentDiv.style.paddingTop = '15px'; // 恢復內容區的上下 padding
            contentDiv.style.paddingBottom = '15px';
            uiContainer.style.maxHeight = '85vh'; // 恢復 UI 容器最大高度 (使用原設定值)
            uiContainer.style.overflow = 'hidden'; // 保持隱藏溢出
            uiContainer.style.resize = 'both'; // 恢復調整大小
            toggleBtn.style.transform = 'rotate(0deg)'; // 箭頭向上
        }
        isContentVisible = !isContentVisible;
    });

    toggleBtn.addEventListener('mouseover', () => toggleBtn.style.color = '#333');
    toggleBtn.addEventListener('mouseout', () => toggleBtn.style.color = '#888');


    const functionTableBody = document.querySelector('#functionTable tbody');

    // 獲取功能數據
    fetch('https://cdn.jsdelivr.net/gh/k791031k/UAT_TOOL_R/functions.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.length === 0) {
                functionTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; font-size: 14px;">目前沒有可用的功能。</td></tr>`;
                // 即使沒有數據，也保持展開狀態，讓使用者看到「沒有可用的功能」訊息
                // 不需要執行收合邏輯
                return;
            }

            data.forEach((func, index) => {
                const row = functionTableBody.insertRow();
                row.style.cssText = `
                    background-color: ${index % 2 === 0 ? '#fdfdfd' : 'white'};
                    transition: background-color 0.1s ease-in-out;
                `;
                row.onmouseover = () => row.style.backgroundColor = '#f0f0f0';
                row.onmouseout = () => row.style.backgroundColor = `${index % 2 === 0 ? '#fdfdfd' : 'white'}`;

                row.innerHTML = `
                    <td style="padding: 10px 12px; border: 1px solid #e9e9e9;">${index + 1}</td>
                    <td style="padding: 10px 12px; border: 1px solid #e9e9e9;">${func.id}</td>
                    <td style="padding: 10px 12px; border: 1px solid #e9e9e9;">${func.description}</td>
                    <td style="padding: 10px 12px; border: 1px solid #e9e9e9;">
                        <button class="execute-btn" data-script="${func.action_script}" style="
                            padding: 6px 12px;
                            background-color: #28a745;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 500;
                            transition: background-color 0.2s ease-in-out, transform 0.1s ease;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        ">執行</button>
                    </td>
                `;
            });

            // 為所有執行按鈕添加事件監聽器
            functionTableBody.querySelectorAll('.execute-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const scriptToExecute = event.target.dataset.script;
                    if (scriptToExecute.startsWith('javascript:')) {
                        const jsCode = scriptToExecute.substring(11);
                        try {
                            (function() {
                                eval(jsCode);
                            })();
                        } catch (e) {
                            console.error("執行功能腳本時發生錯誤:", e);
                            alert("執行功能腳本時發生錯誤，請檢查開發者工具控制台。");
                        }
                    } else {
                        console.error("無效的 action_script 格式:", scriptToExecute);
                        alert("無效的功能腳本格式。");
                    }
                    uiContainer.remove(); // 執行後關閉 UI
                });

                // 添加按鈕的 hover 和 active 樣式 (JS 模擬 CSS)
                button.addEventListener('mouseover', () => {
                    button.style.backgroundColor = '#218838';
                    button.style.transform = 'translateY(-1px)';
                });
                button.addEventListener('mouseout', () => {
                    button.style.backgroundColor = '#28a745';
                    button.style.transform = 'translateY(0)';
                });
                button.addEventListener('mousedown', () => {
                    button.style.backgroundColor = '#1e7e34';
                    button.style.transform = 'translateY(0)';
                    button.style.boxShadow = 'inset 0 2px 5px rgba(0,0,0,0.2)';
                });
                button.addEventListener('mouseup', () => {
                    button.style.backgroundColor = '#218838';
                    button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                });
            });
        })
        .catch(error => {
            console.error('載入功能資料失敗:', error);
            uiContainer.querySelector('.content').innerHTML = `
                <p style="color: red; text-align: center; margin-top: 20px; font-size: 14px;">
                    載入功能資料失敗！<br>
                    請檢查 <code style="background-color:#ffebeb; padding: 2px 4px; border-radius: 3px;">functions.json</code> 路徑或網路連線。<br>
                    錯誤訊息: ${error.message}
                </p>
            `;
            // **錯誤時不再自動收合，而是保持展開狀態顯示錯誤訊息**
            // 確保 contentDiv 處於可見狀態
            contentDiv.style.opacity = '1';
            contentDiv.style.maxHeight = 'unset';
            contentDiv.style.paddingTop = '15px';
            contentDiv.style.paddingBottom = '15px';
            uiContainer.style.maxHeight = '85vh'; // 恢復最大高度
            uiContainer.style.overflow = 'hidden';
            uiContainer.style.resize = 'both';
            toggleBtn.style.transform = 'rotate(0deg)'; // 確保箭頭顯示向上
            isContentVisible = true; // 設置狀態為展開
        });

    // --- 拖曳功能實現 ---
    const header = uiContainer.querySelector('.header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
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
        uiContainer.style.transform = 'none'; // 拖曳時移除 transform 以精確定位
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'grab';
    });

})();
