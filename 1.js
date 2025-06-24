/**
 * @description 最終加強穩定版：模擬使用者點擊，並透過多重事件和延遲來確保資料能被前端框架正確接收。
 */
(async function() {

  // --- 防止重複執行 ---
  if (window.isAutoFilling) {
    alert('自動化處理正在進行中，請勿重複執行。');
    return;
  }
  window.isAutoFilling = true;

  // --- 設定區 ---
  const textToFill = 'O';
  // (升級) 增加延遲時間，讓系統有足夠時間反應
  const delayBetweenActions = 250; // 從 100 毫秒增加到 250 毫秒
  // ---

  const targetCells = document.querySelectorAll('td.processCode-emphasis');

  if (targetCells.length === 0) {
    alert('頁面上找不到任何「處理碼」欄位。');
    window.isAutoFilling = false;
    return;
  }

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

  for (let i = 0; i < totalCount; i++) {
    const cell = targetCells[i];
    progressUI.textContent = `處理中... (${i + 1} / ${totalCount})`;
    
    const existingInput = cell.querySelector('input[type="text"]');
    if ((existingInput && existingInput.value.trim() !== '') || (!existingInput && cell.textContent.trim() !== '')) {
      continue;
    }

    const clickableElement = cell.querySelector('div[tabindex="0"]');
    if (clickableElement) {
      clickableElement.click();
      await new Promise(resolve => setTimeout(resolve, delayBetweenActions));

      const newInput = cell.querySelector('input[type="text"]:not([disabled])');
      if (newInput && newInput.value.trim() === '') {
        newInput.value = textToFill;

        // (升級) 連續觸發 input 和 change 兩個事件，確保能被監聽到
        newInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        newInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        
        filledCount++;
      }
    }
  }

  progressUI.remove();
  window.isAutoFilling = false;
  alert(`全部處理完畢！\n\n共 ${totalCount} 個「處理碼」欄位，其中 ${filledCount} 個空白欄位已嘗試填入 "${textToFill}"。\n\n請檢查畫面上的資料是否已正確顯示，然後再按存檔。`);

})();
