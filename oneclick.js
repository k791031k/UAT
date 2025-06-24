/**
 * @description 最終全自動版：模擬使用者點擊行為，自動化處理所有需要點擊才能輸入的「處理碼」欄位。
 */
(async function() {

  // --- 防止重複執行 ---
  if (window.isAutoFilling) {
    alert('自動化處理正在進行中，請勿重複執行。');
    return;
  }
  window.isAutoFilling = true;

  // --- 設定區 ---
  const textToFill = 'O'; // 要填入的內容
  const delayBetweenActions = 100; // 每個動作之間的延遲（毫秒），給系統反應時間
  // ---

  // 1. 鎖定所有「處理碼」的儲存格 (<td>)
  const targetCells = document.querySelectorAll('td.processCode-emphasis');

  if (targetCells.length === 0) {
    alert('頁面上找不到任何「處理碼」欄位。');
    window.isAutoFilling = false;
    return;
  }

  // 建立一個進度提示UI
  const progressUI = document.createElement('div');
  progressUI.style.cssText = `
    position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8); color: white; padding: 20px 30px;
    border-radius: 10px; z-index: 10000; font-size: 18px;
    font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif;
  `;
  document.body.appendChild(progressUI);

  let filledCount = 0;
  const totalCount = targetCells.length;

  // 2. 使用 for...of 迴圈來逐一處理，確保動作按順序完成
  for (let i = 0; i < totalCount; i++) {
    const cell = targetCells[i];
    
    // 更新進度提示
    progressUI.textContent = `處理中... (${i + 1} / ${totalCount})`;
    
    // 3. 檢查儲存格內是否已經有輸入框且有值，或者其顯示文字不為空
    const existingInput = cell.querySelector('input[type="text"]');
    if ((existingInput && existingInput.value.trim() !== '') || (!existingInput && cell.textContent.trim() !== '')) {
      continue; // 如果已有內容，則跳過此儲存格
    }

    // 4. 找到可以點擊的元素並模擬點擊
    const clickableElement = cell.querySelector('div[tabindex="0"]');
    if (clickableElement) {
      clickableElement.click();

      // 5. 等待一小段時間，讓輸入框生成
      await new Promise(resolve => setTimeout(resolve, delayBetweenActions));

      // 6. 再次尋找新出現的輸入框
      const newInput = cell.querySelector('input[type="text"]:not([disabled])');
      if (newInput && newInput.value.trim() === '') {
        newInput.value = textToFill;
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        newInput.dispatchEvent(inputEvent);
        filledCount++;
      }
    }
  }

  // 移除進度提示並顯示最終報告
  progressUI.remove();
  window.isAutoFilling = false;
  alert(`全部處理完畢！\n\n共 ${totalCount} 個「處理碼」欄位，其中 ${filledCount} 個空白欄位被成功填入 "${textToFill}"。`);

})();
