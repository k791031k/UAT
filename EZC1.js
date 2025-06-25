/**
 * @description 智慧填表小工具 (UI介面版)
 * - 提供圖形化介面來設定與執行
 * - 設定會自動儲存於瀏覽器，可重複使用
 * - 面板可拖曳
 */
(function() {
  // --- 防止重複執行 ---
  if (document.getElementById('my-auto-filler-ui')) {
    alert('小工具介面已經開啟了。');
    return;
  }

  // --- 程式核心設定 ---
  const CONFIG_STORAGE_KEY = 'myAutoFillerConfig_v2';

  // --- UI 介面 HTML 結構 ---
  const uiHTML = `
    <div id="my-filler-header">
      <div style="font-weight: bold;">智慧填寫小工具</div>
      <div id="my-filler-close-btn" title="關閉">×</div>
    </div>
    <div id="my-filler-body">
      <div class="my-filler-section">
        <label>通用預設文字 (當沒有對應規則時使用):</label>
        <input type="text" id="my-filler-generic-text" class="my-filler-input">
      </div>
      <div class="my-filler-section">
        <label>欄位指定文字規則:</label>
        <div id="my-filler-rules-container"></div>
        <button id="my-filler-add-rule-btn" class="my-filler-btn-small">+ 新增規則</button>
      </div>
    </div>
    <div id="my-filler-footer">
      <button id="my-filler-execute-btn" class="my-filler-btn">執行填寫</button>
    </div>
  `;

  // --- UI 介面 CSS 樣式 ---
  const uiCSS = `
    :root { --main-bg: #f0f8ff; --header-bg: #4682b4; --btn-bg: #5a9bd5; --border-color: #dcdcdc; }
    #my-auto-filler-ui {
      position: fixed; top: 20px; right: 20px; width: 380px; background: var(--main-bg);
      border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 99999; font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14px; color: #333;
    }
    #my-filler-header {
      display: flex; justify-content: space-between; align-items: center; padding: 10px 15px;
      background: var(--header-bg); color: white; border-radius: 8px 8px 0 0; cursor: move;
    }
    #my-filler-close-btn { font-size: 24px; cursor: pointer; line-height: 1; user-select: none; }
    #my-filler-body { padding: 15px; max-height: 400px; overflow-y: auto; }
    .my-filler-section { margin-bottom: 15px; }
    .my-filler-section label { display: block; margin-bottom: 5px; font-weight: 600; }
    .my-filler-input, .my-filler-btn {
      width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color);
      box-sizing: border-box; font-family: inherit;
    }
    .my-filler-rule-row { display: flex; align-items: center; margin-bottom: 8px; }
    .my-filler-rule-row input:first-child { flex: 1; margin-right: 5px; }
    .my-filler-rule-row input:nth-child(2) { flex: 2; margin-right: 5px; }
    .my-filler-btn { background: var(--btn-bg); color: white; font-size: 16px; border: none; cursor: pointer; }
    .my-filler-btn:hover { opacity: 0.9; }
    .my-filler-btn-small { width: auto; padding: 5px 10px; font-size: 12px; }
    .my-filler-remove-btn {
      width: 28px; height: 28px; background: #ff4d4d; color: white; border: none; border-radius: 4px;
      cursor: pointer; font-size: 16px; line-height: 1;
    }
  `;

  // --- 建立並插入 UI 到頁面 ---
  const styleEl = document.createElement('style');
  styleEl.innerHTML = uiCSS;
  document.head.appendChild(styleEl);

  const panel = document.createElement('div');
  panel.id = 'my-auto-filler-ui';
  panel.innerHTML = uiHTML;
  document.body.appendChild(panel);

  // --- 獲取 UI 元素 ---
  const genericTextInput = document.getElementById('my-filler-generic-text');
  const rulesContainer = document.getElementById('my-filler-rules-container');
  const addRuleBtn = document.getElementById('my-filler-add-rule-btn');
  const executeBtn = document.getElementById('my-filler-execute-btn');
  const closeBtn = document.getElementById('my-filler-close-btn');

  // --- 功能函式 ---
  function saveConfig() {
    const rules = [];
    document.querySelectorAll('.my-filler-rule-row').forEach(row => {
      const colInput = row.querySelector('input[placeholder="欄位名稱"]');
      const textInput = row.querySelector('input[placeholder="要填寫的文字"]');
      if (colInput.value) {
        rules.push({ column: colInput.value, text: textInput.value });
      }
    });
    const config = {
      genericText: genericTextInput.value,
      rules: rules
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }

  function addRuleRow(column = '', text = '') {
    const row = document.createElement('div');
    row.className = 'my-filler-rule-row';
    row.innerHTML = `
      <input type="text" placeholder="欄位名稱" class="my-filler-input" value="${column}">
      <input type="text" placeholder="要填寫的文字" class="my-filler-input" value="${text}">
      <button class="my-filler-remove-btn" title="刪除此規則">×</button>
    `;
    rulesContainer.appendChild(row);
    row.querySelector('.my-filler-remove-btn').addEventListener('click', () => {
      row.remove();
      saveConfig();
    });
    // 輸入時自動儲存
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', saveConfig));
  }

  function loadConfig() {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      genericTextInput.value = config.genericText || '資料由小工具自動填寫。';
      config.rules.forEach(rule => addRuleRow(rule.column, rule.text));
    } else {
      // 載入預設的幾個規則
      genericTextInput.value = '資料由小工具自動填寫。';
      addRuleRow('備註', '由小工具自動填寫備註。');
      addRuleRow('處理碼', 'O');
    }
  }

  function runFillLogic() {
    const configStr = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!configStr) {
      alert('找不到設定，請先設定規則。');
      return;
    }
    const config = JSON.parse(configStr);
    const textMapping = { '__generic__': config.genericText };
    config.rules.forEach(rule => {
      textMapping[rule.column] = rule.text;
    });

    const allEditableFields = document.querySelectorAll(
      '.v-data-table__wrapper tbody textarea:not([disabled]):not([readonly]), ' +
      '.v-data-table__wrapper tbody input[type="text"]:not([disabled]):not([readonly])'
    );

    let filledCount = 0;
    let filledLog = [];

    allEditableFields.forEach(field => {
      if (field.value.trim() !== '') return;
      const frame = field.closest('.app-input-frame');
      if (!frame || !frame.dataset.label) return;

      const columnName = frame.dataset.label;
      const textToFill = textMapping[columnName] || textMapping['__generic__'];

      field.value = textToFill;
      const event = new Event('input', { bubbles: true, cancelable: true });
      field.dispatchEvent(event);

      filledCount++;
      const rowIndex = frame.dataset.tr ? parseInt(frame.dataset.tr) + 1 : 'N/A';
      filledLog.push(`- 第 ${rowIndex} 行的 [${columnName}]`);
    });
    
    if (filledCount > 0) {
      alert(`智慧填寫完成！\n共填寫了 ${filledCount} 個空白欄位：\n\n${filledLog.join('\n')}`);
    } else {
      alert('檢查完畢，目前沒有需要填寫的空白欄位。');
    }
  }

  // --- 事件綁定 ---
  genericTextInput.addEventListener('input', saveConfig);
  addRuleBtn.addEventListener('click', () => addRuleRow());
  executeBtn.addEventListener('click', runFillLogic);
  closeBtn.addEventListener('click', () => {
    panel.remove();
    styleEl.remove();
  });

  // --- 拖曳功能 ---
  let isDragging = false;
  let offsetX, offsetY;
  const header = document.getElementById('my-filler-header');
  header.addEventListener('mousedown', e => {
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    panel.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (isDragging) {
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    panel.style.userSelect = 'auto';
  });

  // --- 初始化 ---
  loadConfig();

})();
