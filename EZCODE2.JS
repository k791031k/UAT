/**
 * @description 智慧填表最終版 (動態文字模板)
 * - 自動掃描所有空白、可編輯的欄位。
 * - 使用包含 {{rowIndex}} 和 {{columnName}} 的模板來動態生成填寫的文字。
 * - 不覆蓋已有資料，完美適應任何長度的表格。
 */
function autoFill_with_DynamicText() {
  // --- ★★★ 動態文字模板設定區 ★★★ ---
  // 在此設定文字模板。程式會自動將 {{rowIndex}} 和 {{columnName}} 替換成實際的行數和欄位名。
  const textMapping = {
    // 您可以為特定欄位設定專屬模板
    '備註': '這是第 {{rowIndex}} 行的 [{{columnName}}] 欄位，需要處理。',
    '照會內容-2': '請處理第 {{rowIndex}} 行的 [{{columnName}}]。',

    // 對於某些欄位，您可能還是想填寫固定文字
    '處理碼': 'O',

    // 如果遇到上面沒有定義的欄位，就會使用這個通用的模板
    '__generic__': '自動填寫：第 {{rowIndex}} 行 - {{columnName}}'
  };
  // --- 設定結束 ---

  // 1. 動態選取所有在表格內可以編輯的欄位
  const allEditableFields = document.querySelectorAll(
    '.v-data-table__wrapper tbody textarea:not([disabled]):not([readonly]), ' +
    '.v-data-table__wrapper tbody input[type="text"]:not([disabled]):not([readonly])'
  );

  if (allEditableFields.length === 0) {
    alert('頁面上找不到任何可以填寫的欄位。');
    return;
  }

  let filledCount = 0;
  let filledLog = [];

  // 2. 遍歷所有找到的可編輯欄位
  allEditableFields.forEach(field => {
    // 3. 如果欄位不是空白的，就跳過
    if (field.value.trim() !== '') {
      return;
    }

    // 4. 獲取欄位的行數(rowIndex)和欄位名(columnName)
    const frame = field.closest('.app-input-frame');
    if (!frame || !frame.dataset.label) {
      return;
    }

    const columnName = frame.dataset.label;
    const rowIndex = frame.dataset.tr ? parseInt(frame.dataset.tr) + 1 : 'N/A'; // data-tr從0開始，+1使其符合視覺

    // 5. 從設定區取得對應的文字模板
    const template = textMapping[columnName] || textMapping['__generic__'];

    // 6. (核心) 將模板中的 {{rowIndex}} 和 {{columnName}} 替換成實際值
    const textToFill = template
      .replace(/{{rowIndex}}/g, rowIndex)
      .replace(/{{columnName}}/g, columnName);

    // 7. 填入最終生成的文字，並觸發事件
    field.value = textToFill;
    const event = new Event('input', { bubbles: true, cancelable: true });
    field.dispatchEvent(event);

    filledCount++;
    filledLog.push(`- 第 ${rowIndex} 行的 [${columnName}]`);
  });

  // 8. 完成後顯示報告
  if (filledCount > 0) {
    alert(`任務完成！\n共填寫了 ${filledCount} 個空白欄位：\n\n${filledLog.join('\n')}`);
  } else {
    alert('檢查完畢，目前沒有需要填寫的空白欄位。');
  }
}

// 立即執行函式
autoFill_with_DynamicText();
