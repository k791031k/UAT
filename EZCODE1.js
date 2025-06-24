/**
 * @description 智慧填表小工具 (條件規則版)
 * - 支援 "IF [欄位A] 等於 [值B], THEN 填寫 [欄位C]..." 的複雜邏輯
 * - 設定會自動儲存於瀏覽器
 * - 面板可拖曳
 */
(function() {
  // --- 防止重複執行 ---
  if (document.getElementById('my-conditional-filler-ui')) {
    alert('條件規則小工具已經開啟了。');
    return;
  }

  // --- 程式核心設定 ---
  const CONFIG_STORAGE_KEY = 'myConditionalFillerConfig_v1';

  // --- UI 介面 HTML 結構 ---
  const uiHTML = `
    <div id="my-filler-header">
      <div style="font-weight: bold;">智慧填寫小工具 (條件規則版)</div>
      <div id="my-filler-close-btn" title="關閉">×</div>
    </div>
    <div id="my-filler-body">
      <div id="my-filler-rules-container"></div>
      <button id="my-filler-add-rule-btn" class="my-filler-btn-small">+ 新增一條規則</button>
    </div>
    <div id="my-filler-footer">
      <button id="my-filler-execute-btn" class="my-filler-btn">掃描並執行所有規則</button>
    </div>
  `;

  // --- UI 介面 CSS 樣式 ---
  const uiCSS = `
    :root { --main-bg: #f5f5f5; --header-bg: #6a5acd; --btn-bg: #007bff; --rule-bg: #fff; --border-color: #ddd; }
    #my-conditional-filler-ui {
      position: fixed; top: 40px; right: 20px; width: 480px; background: var(--main-bg);
      border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      z-index: 99999; font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14px;
    }
    #my-filler-header {
      display: flex; justify-content: space-between; align-items: center; padding: 10px 15px;
      background: var(--header-bg); color: white; border-radius: 8px 8px 0 0; cursor: move;
    }
    #my-filler-close-btn { font-size: 24px; cursor: pointer; user-select: none; }
    #my-filler-body { padding: 15px; max-height: 60vh; overflow-y: auto; }
    .my-filler-rule-block { background: var(--rule-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; margin-bottom: 15px; }
    .my-filler-rule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .my-filler-rule-header span { font-weight: bold; color: var(--header-bg); }
    .my-filler-if, .my-filler-then { margin-bottom: 10px; }
    .my-filler-label { font-weight: bold; margin-right: 5px; }
    .my-filler-input { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-family: inherit; }
    .my-filler-action-row { display: flex; align-items: center; margin-top: 5px; }
    .my-filler-btn { background: var(--btn-bg); color: white; font-size: 16px; border: none; cursor: pointer; padding: 10px; border-radius: 5px; width: 100%; }
    .my-filler-btn-small { width: auto; padding: 5px 10px; font-size: 12px; background: #6c757d; }
    .my-filler-remove-btn, .my-filler-remove-action-btn { background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; width:26px; height:26px; }
  `;

  // --- 建立並插入 UI 到頁面 ---
  const styleEl = document.createElement('style');
  styleEl.innerHTML = uiCSS;
  document.head.appendChild(styleEl);

  const panel = document.createElement('div');
  panel.id = 'my-conditional-filler-ui';
  panel.innerHTML = uiHTML;
  document.body.appendChild(panel);

  // --- 獲取 UI 元素 ---
  const rulesContainer = document.getElementById('my-filler-rules-container');
  const addRuleBtn = document.getElementById('my-filler-add-rule-btn');
  const executeBtn = document.getElementById('my-filler-execute-btn');
  const closeBtn = document.getElementById('my-filler-close-btn');

  // --- 功能函式 ---
  function saveConfig() {
    const rules = [];
    document.querySelectorAll('.my-filler-rule-block').forEach(block => {
      const ifCol = block.querySelector('.if-col').value;
      const ifVal = block.querySelector('.if-val').value;
      if (!ifCol || !ifVal) return;

      const actions = [];
      block.querySelectorAll('.my-filler-action-row').forEach(row => {
        const thenCol = row.querySelector('.then-col').value;
        const thenVal = row.querySelector('.then-val').value;
        if (thenCol) {
          actions.push({ targetColumn: thenCol, textToFill: thenVal });
        }
      });

      rules.push({
        condition: { column: ifCol, value: ifVal },
        actions: actions
      });
    });
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(rules));
  }

  function addActionRow(container, col = '', val = '') {
      const row = document.createElement('div');
      row.className = 'my-filler-action-row';
      row.innerHTML = `
          <span class="my-filler-label">填寫</span>
          <input type="text" placeholder="目標欄位名" class="my-filler-input then-col" value="${col}">
          <span class="my-filler-label">為</span>
          <input type="text" placeholder="要填寫的內容" class="my-filler-input then-val" value="${val}" style="flex:1;">
          <button class="my-filler-remove-action-btn" title="刪除此動作">×</button>
      `;
      container.appendChild(row);
      row.querySelector('.my-filler-remove-action-btn').addEventListener('click', () => { row.remove(); saveConfig(); });
      row.querySelectorAll('input').forEach(input => input.addEventListener('input', saveConfig));
  }

  function addRuleBlock(rule = {}) {
    const block = document.createElement('div');
    block.className = 'my-filler-rule-block';
    
    const condition = rule.condition || {};
    const actions = rule.actions || [];

    block.innerHTML = `
      <div class="my-filler-rule-header">
        <span>一條規則</span>
        <button class="my-filler-remove-btn" title="刪除整條規則">×</button>
      </div>
      <div class="my-filler-if">
        <span class="my-filler-label">如果</span>
        <input type="text" placeholder="條件欄位名" class="my-filler-input if-col" value="${condition.column || ''}">
        <span class="my-filler-label">等於</span>
        <input type="text" placeholder="條件值" class="my-filler-input if-val" value="${condition.value || ''}">
      </div>
      <div class="my-filler-then">
        <span class="my-filler-label">那麼</span>
        <div class="then-actions-container"></div>
        <button class="my-filler-btn-small add-action-btn" style="margin-top:5px;">+ 新增動作</button>
      </div>
    `;
    rulesContainer.appendChild(block);

    const thenActionsContainer = block.querySelector('.then-actions-container');
    if (actions.length > 0) {
      actions.forEach(action => addActionRow(thenActionsContainer, action.targetColumn, action.textToFill));
    } else {
      addActionRow(thenActionsContainer); // 預設新增一個空的
    }

    block.querySelector('.add-action-btn').addEventListener('click', () => addActionRow(thenActionsContainer));
    block.querySelector('.my-filler-remove-btn').addEventListener('click', () => { block.remove(); saveConfig(); });
    block.querySelectorAll('.my-filler-if input').forEach(input => input.addEventListener('input', saveConfig));
  }
  
  function loadConfig() {
    const savedRules = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedRules) {
      const rules = JSON.parse(savedRules);
      if (rules.length > 0) {
        rules.forEach(rule => addRuleBlock(rule));
        return;
      }
    }
    // 如果沒有儲存的規則，則新增一條預設的範例
    addRuleBlock({
      condition: { column: '照會碼', value: 'NDA03' },
      actions: [
        { targetColumn: '處理碼', textToFill: 'O' },
        { targetColumn: '備註', textToFill: '已通知業務員確認生效日' }
      ]
    });
  }

  function runFillLogic() {
    const rulesStr = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!rulesStr) { alert('請先設定規則'); return; }
    const rules = JSON.parse(rulesStr);
    let totalFilledCount = 0;

    const rows = document.querySelectorAll('.v-data-table__wrapper tbody tr');
    rows.forEach((row, rowIndex) => {
      rules.forEach(rule => {
        const condCell = Array.from(row.cells).find(cell => cell.textContent.trim() === rule.condition.value);
        // 這邊簡化判斷邏輯，直接比對cell內的文字，更精準的方式需要分析欄位class或data-label
        // 為求通用，先以文字比對為主
        const condColHeader = document.querySelector(`thead th:nth-child(${condCell?.cellIndex + 1})`);
        
        if (condCell && condColHeader?.textContent.trim().includes(rule.condition.column)) {
          // 條件符合！執行動作
          rule.actions.forEach(action => {
            const actionColHeader = Array.from(document.querySelectorAll('thead th')).find(th => th.textContent.trim().includes(action.targetColumn));
            if (!actionColHeader) return;
            const actionCell = row.cells[actionColHeader.cellIndex];
            const inputField = actionCell?.querySelector('textarea:not([disabled]), input:not([disabled])');
            
            if (inputField && inputField.value.trim() === '') {
              inputField.value = action.textToFill;
              inputField.dispatchEvent(new Event('input', { bubbles: true }));
              totalFilledCount++;
            }
          });
        }
      });
    });
    alert(`掃描執行完畢！\n總共自動填寫了 ${totalFilledCount} 個欄位。`);
  }

  // --- 事件綁定與初始化 ---
  addRuleBtn.addEventListener('click', () => addRuleBlock());
  executeBtn.addEventListener('click', runFillLogic);
  closeBtn.addEventListener('click', () => { panel.remove(); styleEl.remove(); });
  
  let isDragging = false, offsetX, offsetY;
  const header = document.getElementById('my-filler-header');
  header.addEventListener('mousedown', e => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; });
  document.addEventListener('mousemove', e => { if (isDragging) { panel.style.left = `${e.clientX - offsetX}px`; panel.style.top = `${e.clientY - offsetY}px`; }});
  document.addEventListener('mouseup', () => { isDragging = false; });

  loadConfig();
})();
