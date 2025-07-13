javascript:(function(){
    // ========== 主題色與基本樣式 (視覺輕盈版) ==========
    const THEME = {
        bg: '#ffffff', // 純白背景
        border: '#e9eef2', // 極淺邊框/分隔線
        radius: '10px', // 圓潤邊角
        primary: '#007aff', // 主題藍色
        label: '#5a6a7b', // 標籤文字顏色 (稍淺)
        text: '#212529', // 主要文字顏色
        inputBg: '#f8f9fa', // 輸入框背景
        inputBorder: '#e1e8ed', // 輸入框邊框
        inputFocus: '#80bdff', // 輸入框聚焦光暈
        buttonBg: '#f1f5f9', // 卡片按鈕背景
        buttonText: '#495057', // 卡片按鈕文字
        buttonHover: '#e9eef2', // 按鈕懸停背景
        calcButtonBg: 'linear-gradient(145deg, #007bff, #0056b3)', // 計算按鈕漸層
        calcButtonHover: 'linear-gradient(145deg, #0069d9, #004085)', // 計算按鈕懸停
        quickButtonBg: 'transparent',
        quickButtonBorder: '#d0d9e8',
        quickButtonHover: '#f1f5f9',
        shadow: '0 8px 32px rgba(0, 0, 0, 0.08)', // 更柔和的陰影
        cardShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        toastSuccess: '#28a745',
        toastError: '#dc3545',
        tabActiveBg: '#007aff', // 啟用頁籤背景
        tabActiveText: '#ffffff', // 啟用頁籤文字
        tabInactiveBg: '#e9eef2', // 未啟用頁籤背景
        tabInactiveText: '#5a6a7b', // 未啟用頁籤文字
        highlight: 'rgba(255, 236, 179, 0.8)', // 高亮背景
        highlightBorder: '#ffc107', // 高亮邊框
        highlightColBg: 'rgba(0, 122, 255, 0.07)', // 特別高亮欄位的背景
        pastTime: '#90a4ae', // 過往時間文字
        pastTimeBg: '#fcfcfc', // 過往時間背景
        resultBg: 'rgba(0, 122, 255, 0.07)', // 結果欄位背景
        resultText: '#0056b3', // 結果欄位文字
        fontFamily: '"Microsoft JhengHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    };

    // ========== 狀態管理 ==========
    const STORAGE_KEY_POSITION = 'insuranceAgePanelPositionV20';
    const STORAGE_KEY_SETTINGS = 'insuranceAgeSettingsV20';
    const STORAGE_KEY_HISTORY = 'insuranceCalcHistoryV20';
    const savedPosition = JSON.parse(localStorage.getItem(STORAGE_KEY_POSITION) || '{"x":40,"y":40}');
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{"yearType":"西元","ageType":"保險年齡"}');
    let panelPosition = { x: savedPosition.x, y: savedPosition.y };
    let appSettings = { yearType: savedSettings.yearType, ageType: savedSettings.ageType };
    let isDragging = false, dragOffset = { x: 0, y: 0 };
    let currentFocusedInput = null;
    let currentActiveTab = 0;
    let targetAge = null;
    const elements = {};
    let lastEditedField = null;
    let ageInputTimeout = null;
    let activeDragTarget = null; // 當前拖曳的面板

    // ========== 工具函式 ==========
    function createElem(tag, style = {}, prop = {}) {
        const el = document.createElement(tag);
        Object.assign(el, prop);
        Object.assign(el.style, style);
        return el;
    }
    function showToast(msg, type = 'success') {
        const toast = createElem('div', {
            position: 'fixed', top: '24px', right: '-400px', zIndex: 2147483648,
            background: '#fff', color: type === 'success' ? THEME.toastSuccess : THEME.toastError,
            border: `1.5px solid ${type === 'success' ? THEME.toastSuccess : THEME.toastError}`,
            borderRadius: THEME.radius, fontFamily: THEME.fontFamily,
            boxShadow: THEME.shadow, padding: '12px 20px',
            fontWeight: 'bold', fontSize: '14px', transition: 'right 0.5s ease-out'
        });
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '24px'; }, 30);
        setTimeout(() => { toast.style.right = '-400px'; setTimeout(() => toast.remove(), 500); }, 2500);
    }
    function copyToClipboard(text) {
        if (!text) { showToast('內容為空，無法複製', 'error'); return; }
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showToast(`已複製: ${text}`)).catch(() => showToast('複製失敗', 'error'));
        else showToast('瀏覽器不支援複製', 'error');
    }
    function convertDate(dateStr, fromType, toType) {
        if (!dateStr) return '';
        const clean = dateStr.replace(/[^0-9]/g, '');
        if (fromType === toType) return clean;
        if (fromType === '西元' && toType === '民國' && clean.length === 8) return `${parseInt(clean.substring(0,4),10)-1911}`.padStart(3,'0')+clean.substring(4);
        if (fromType === '民國' && toType === '西元' && clean.length === 7) return `${parseInt(clean.substring(0,3),10)+1911}`+clean.substring(3);
        return clean;
    }
    function parseWesternDate(str) {
        if (!str) return null;
        const clean = str.replace(/[^0-9]/g, '');
        if (clean.length !== 8) return null;
        const y = parseInt(clean.substring(0,4)), m = parseInt(clean.substring(4,6))-1, d = parseInt(clean.substring(6,8));
        const dt = new Date(y,m,d);
        return (dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d) ? dt : null;
    }
    function formatDate(date, yearType) {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const y = date.getFullYear(), m = (date.getMonth()+1).toString().padStart(2,'0'), d = date.getDate().toString().padStart(2,'0');
        const dispY = yearType==='西元' ? y.toString().padStart(4,'0') : (y-1911).toString().padStart(3,'0');
        return `${dispY}${m}${d}`;
    }
    function formatDateToDisplay(dateStr) {
        if (!dateStr) return '';
        const clean = dateStr.replace(/[^0-9]/g, '');
        if (clean.length === 8) { return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}`; }
        if (clean.length === 7) { return `${clean.substring(0,3)}-${clean.substring(3,5)}-${clean.substring(5,7)}`; }
        return dateStr;
    }
    function formatFromDisplay(dateStr) { return dateStr.replace(/[^0-9]/g, ''); }
    function calculatePreciseAgeDiff(start, end) {
        let y = end.getFullYear()-start.getFullYear(), m = end.getMonth()-start.getMonth(), d = end.getDate()-start.getDate();
        if (d<0) { m--; d+=new Date(start.getFullYear(),start.getMonth()+1,0).getDate(); }
        if (m<0) { y--; m+=12; }
        return {years:y,months:m,days:d};
    }
    function getActualAge(birth, ref) { return calculatePreciseAgeDiff(birth, ref).years; }
    function getInsuranceAge(birth, ref) {
        const diff = calculatePreciseAgeDiff(birth, ref);
        return diff.months > 6 || (diff.months === 6 && diff.days > 0) ? diff.years + 1 : diff.years;
    }
    function getAgeRange(birthDate, age) {
        let start = new Date(birthDate);
        start.setFullYear(birthDate.getFullYear() + age);
        let end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        return { start, end };
    }

    // ========== 年齡區間表格公式 ==========
    function pad(n) { return n < 10 ? '0' + n : n; }
    function formatDateDashForCalc(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
    function getAgeComparisonTable(birthdayStr, startYear, yearsCount) {
        const [birthYear, birthMonth, birthDay] = birthdayStr.split('-').map(Number);
        let rows = [];
        for (let i = 0; i < yearsCount; i++) {
            const thisBirthday = new Date(startYear + i, birthMonth - 1, birthDay);
            const plus6M = new Date(thisBirthday);
            plus6M.setMonth(plus6M.getMonth() + 6);
            const nextBirthday = new Date(thisBirthday);
            nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
            rows.push({
                區間起始日: formatDateDashForCalc(thisBirthday),
                區間結束日: formatDateDashForCalc(new Date(plus6M.getTime() - 86400000)),
                實際年齡: (startYear + i) - birthYear,
                保險年齡: (startYear + i) - birthYear
            });
            rows.push({
                區間起始日: formatDateDashForCalc(plus6M),
                區間結束日: formatDateDashForCalc(new Date(nextBirthday.getTime() - 86400000)),
                實際年齡: (startYear + i) - birthYear,
                保險年齡: (startYear + i) - birthYear + 1
            });
        }
        return rows;
    }
    function getInsuranceAgeRangeFromTable(birthDate, effectiveDate, insuranceAge) {
        const y = birthDate.getFullYear(), m = birthDate.getMonth()+1, d = birthDate.getDate();
        const birthdayStr = `${y}-${pad(m)}-${pad(d)}`;
        const allRows = getAgeComparisonTable(birthdayStr, y, 81);
        const effDateStr = formatDateDashForCalc(effectiveDate);
        for (let row of allRows) {
            if (row.保險年齡 === insuranceAge && effDateStr >= row.區間起始日 && effDateStr <= row.區間結束日) {
                const startParts = row.區間起始日.split('-');
                const endParts = row.區間結束日.split('-');
                return { start: new Date(parseInt(startParts[0]), parseInt(startParts[1])-1, parseInt(startParts[2])), end: new Date(parseInt(endParts[0]), parseInt(endParts[1])-1, parseInt(endParts[2])) };
            }
        }
        const targetRows = allRows.filter(row => row.保險年齡 === insuranceAge);
        if (targetRows.length > 0) {
            const firstRow = targetRows[0];
            const startParts = firstRow.區間起始日.split('-');
            const endParts = firstRow.區間結束日.split('-');
            return { start: new Date(parseInt(startParts[0]), parseInt(startParts[1])-1, parseInt(startParts[2])), end: new Date(parseInt(endParts[0]), parseInt(endParts[1])-1, parseInt(endParts[2])) };
        }
        return getAgeRange(birthDate, insuranceAge);
    }

    // ========== UI 元件與功能函式 ==========
    function createCardButton(text, onClick) {
        return createElem('button', {
            padding: '0 8px', height: '30px', fontSize: '14px',
            border: `1px solid ${THEME.border}`, borderRadius: '8px',
            background: THEME.buttonBg, color: THEME.buttonText,
            fontWeight: '600', cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }, {
            onmouseover: function(){ this.style.background = THEME.buttonHover; },
            onmouseout: function(){ this.style.background = THEME.buttonBg; },
            onclick: onClick, textContent: text
        });
    }
    function createQuickAgeButton(age, onClick) {
        return createElem('button', {
            padding: '0px 8px', height: '22px', fontSize: '12px',
            border: `1px solid ${THEME.quickButtonBorder}`, borderRadius: '6px',
            background: THEME.quickButtonBg, color: THEME.primary,
            fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
        }, {
            onmouseover: function(){ this.style.background = THEME.quickButtonHover; },
            onmouseout: function(){ this.style.background = THEME.quickButtonBg; },
            onclick: onClick, textContent: age
        });
    }
    function createInputRow(labelText, inputType, placeholder, maxLength) {
        const row = createElem('div', {display:'flex',alignItems:'center',marginBottom:'8px',gap:'8px'});
        const label = createElem('label', {minWidth:'70px',color:THEME.label,fontWeight:'600',fontSize:'14px',cursor:'pointer'}, {textContent:labelText});
        const input = createElem('input', {
            flex:'1',padding:'8px 10px', height: '36px', boxSizing: 'border-box',
            border:`1px solid ${THEME.inputBorder}`,borderRadius:'8px',fontSize:'14px',background:THEME.inputBg,color:THEME.text,
            transition:'all 0.2s', outline: 'none'
        },{type:inputType,placeholder:placeholder||'',maxLength:maxLength||undefined});
        input.addEventListener('focus',e=>{currentFocusedInput=input;input.style.borderColor=THEME.inputFocus;input.style.boxShadow=`0 0 0 3px rgba(0,123,255,0.15)`;});
        input.addEventListener('blur',e=>{
            input.style.borderColor=THEME.inputBorder;input.style.boxShadow='none';
            const cleanValue = formatFromDisplay(e.target.value);
            const expectedLen = appSettings.yearType === '西元' ? 8 : 7;
            if (cleanValue.length === expectedLen) {
                e.target.value = formatDateToDisplay(cleanValue);
            }
        });
        label.addEventListener('click',()=>copyToClipboard(input.value));
        row.append(label,input);
        return {row,label,input};
    }
    function createDisplayRow(labelText) {
        const row = createElem('div', { display:'flex',alignItems:'center',marginBottom:'6px',gap:'8px', minHeight:'34px' });
        const label = createElem('label', {minWidth: '70px', color: THEME.label, fontWeight: '600', fontSize: '14px'}, {textContent:labelText});
        const valueSpan = createElem('span', {
            flex: '1', padding: '0 10px', fontSize: '14px', fontWeight: 'bold',
            color: THEME.resultText, background: THEME.resultBg,
            borderRadius: '8px', textAlign: 'center',
            height: '34px', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        });
        row.append(label,valueSpan);
        return {row,label,valueSpan};
    }
    function createDisplayRowWithSubLabel(labelText) {
        const row = createElem('div', { display:'flex',alignItems:'flex-start',marginBottom:'6px',gap:'8px', minHeight:'34px' });
        const labelWrapper = createElem('div', { minWidth: '70px', textAlign: 'left' });
        const label = createElem('div', { color: THEME.label, fontWeight: '600', fontSize: '14px', lineHeight: '1.2' }, { textContent: labelText });
        const subLabel = createElem('div', { fontSize: '12px', color: THEME.primary, fontWeight: 'normal' });
        labelWrapper.append(label, subLabel);
        const valueSpan = createElem('span', {
            flex: '1', padding: '0 10px', fontSize: '14px', fontWeight: 'bold',
            color: THEME.resultText, background: THEME.resultBg,
            borderRadius: '8px', textAlign: 'center',
            height: '34px', boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        });
        row.append(labelWrapper, valueSpan);
        return {row, label: labelWrapper, valueSpan, subLabel};
    }
    function createToggleSwitch(options, initialValue, onToggle, widths) {
        const container = createElem('div', {display:'inline-flex',border:`1px solid ${THEME.inputBorder}`,borderRadius:'8px',overflow:'hidden', background: THEME.buttonBg, padding: '2px', height: '30px', boxSizing: 'border-box'});
        const optionElements = {};
        const updateStyles = (selectedValue) => {
            options.forEach(opt=>{
                const el=optionElements[opt],active=opt===selectedValue;
                el.style.background=active?THEME.primary:'transparent';
                el.style.color=active?'#fff':THEME.primary;
                el.style.fontWeight=active?'bold':'600';
            });
        };
        options.forEach((option,idx)=>{
            const el = createElem('div',{
                padding:'0',width:`${widths[idx]}px`,fontSize:'13px',textAlign:'center',cursor:'pointer',transition:'all 0.25s ease', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'
            },{textContent:option});
            el.onclick=()=>{
                const propName = onToggle.name === 'handleYearTypeChange' ? 'yearType' : 'ageType';
                if(appSettings[propName] !== option) {
                    updateStyles(option);
                    onToggle(option);
                }
            };
            optionElements[option]=el;
            container.appendChild(el);
        });
        updateStyles(initialValue);
        return container;
    }
    function createTabButton(text, index, isActive) {
        return createElem('button', {
            padding: '6px 0', fontSize: '12px', border: 'none',
            borderRadius: '6px',
            background: isActive ? THEME.tabActiveBg : 'transparent',
            color: isActive ? THEME.tabActiveText : THEME.tabInactiveText,
            fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
        }, {
            textContent: text,
            onclick: () => window.switchTab(index)
        });
    }
    function renderAgeComparisonTableWithTabs(birthDate, panelContent, referenceDate) {
        panelContent.innerHTML = '';
        const y = birthDate.getFullYear(), m = birthDate.getMonth()+1, d = birthDate.getDate();
        const birthdayStr = `${y}-${pad(m)}-${pad(d)}`;
        const allRows = getAgeComparisonTable(birthdayStr, y, 81);
        const stickyContainer = createElem('div', { display: 'flex', flexDirection: 'column', height: '100%' });
        
        const controlContainer = createElem('div', {padding: '8px 8px 0 8px', flexShrink: 0, borderBottom: `1px solid ${THEME.border}`});
        const ageTypeSwitch = createToggleSwitch(['實際年齡', '保險年齡'], appSettings.ageType, (newValue) => {
            handleAgeTypeChange(newValue, false);
            renderAgeComparisonTableWithTabs(birthDate, panelContent, referenceDate);
        }, [80, 80]);
        controlContainer.appendChild(ageTypeSwitch);

        const tabButtonsContainer = createElem('div', {
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px',
            background: THEME.tabInactiveBg, padding: '8px', flexShrink: '0'
        });

        const tableWrapper = createElem('div', { flexGrow: '1', overflowY: 'auto', padding: '0 8px' });
        const ageRanges = [
            {start: 0, end: 10, label: '0-10'}, {start: 11, end: 20, label: '11-20'},
            {start: 21, end: 30, label: '21-30'}, {start: 31, end: 40, label: '31-40'},
            {start: 41, end: 50, label: '41-50'}, {start: 51, end: 60, label: '51-60'},
            {start: 61, end: 70, label: '61-70'}, {start: 71, end: 80, label: '71-80'}
        ];
        const table = createElem('table', {width:'100%',borderCollapse:'collapse',fontSize:'13px', tableLayout: 'fixed'});
        const thead = createElem('thead', { position: 'sticky', top: '0', zIndex: '10', backgroundColor: THEME.bg });
        const trHead = createElem('tr');
        const headers = ['實際年齡','保險年齡','區間起始日','區間結束日'];
        const colWidths = ['18%', '18%', '32%', '32%'];
        headers.forEach((h, i)=>{
            const th = createElem('th',{
                padding:'8px 2px', borderBottom:`2px solid ${THEME.primary}`,
                color:THEME.primary, fontWeight:'bold', fontSize:'12px', width: colWidths[i]
            });
            th.textContent = h;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        const tbody = createElem('tbody');
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        const tabPanes = {};
        ageRanges.forEach((range, i) => {
            const button = createTabButton(range.label, i, i === currentActiveTab);
            button.classList.add('age-tab-button');
            tabButtonsContainer.appendChild(button);
            const pageRows = allRows.filter(row => row.實際年齡 >= range.start && row.實際年齡 <= range.end);
            tabPanes[i] = pageRows;
        });
        function updateTableContent(index) {
            tbody.innerHTML = '';
            const rows = tabPanes[index] || [];
            rows.forEach((row)=>{
                const endDate = new Date(row.區間結束日);
                const isPast = referenceDate && referenceDate > endDate;
                const isTargetRow = targetAge !== null &&
                    ((appSettings.ageType === '實際年齡' && row.實際年齡 === targetAge) ||
                     (appSettings.ageType === '保險年齡' && row.保險年齡 === targetAge));
                const tr = createElem('tr', {});
                if (isTargetRow) {
                    tr.classList.add('is-target-row');
                }
                const rowData = { ...row, '區間起始日': formatDateToDisplay(formatDate(new Date(row.區間起始日), appSettings.yearType)), '區間結束日': formatDateToDisplay(formatDate(new Date(row.區間結束日), appSettings.yearType)) };
                headers.forEach(key=>{
                    const td = createElem('td',{
                        padding:'6px 2px', borderBottom:`1px solid ${THEME.border}`, textAlign:'center',
                        color: isPast ? THEME.pastTime : THEME.text,
                        fontSize:'12px', fontWeight: isTargetRow ? 'bold' : 'normal',
                        wordBreak: 'break-all', position: 'relative',
                        transition: 'background-color 0.3s'
                    });
                    const isTargetCol = (appSettings.ageType === '實際年齡' && key === '實際年齡') ||
                                        (appSettings.ageType === '保險年齡' && key === '保險年齡');
                    
                    if (isTargetRow) {
                        td.style.backgroundColor = THEME.highlight;
                    } else if (isTargetCol) {
                        td.style.backgroundColor = THEME.highlightColBg;
                    } else if (isPast) {
                        td.style.backgroundColor = THEME.pastTimeBg;
                    }
                    td.textContent = rowData[key];
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            const highlightedRow = tbody.querySelector('.is-target-row');
            if (highlightedRow) {
                setTimeout(() => {
                    highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }, 100);
            }
        }
        window.switchTab = (index) => {
            currentActiveTab = index;
            const tabButtons = tabButtonsContainer.querySelectorAll('.age-tab-button');
            tabButtons.forEach((btn, idx) => {
                const isActive = idx === index;
                btn.style.background = isActive ? THEME.tabActiveBg : 'transparent';
                btn.style.color = isActive ? THEME.tabActiveText : THEME.tabInactiveText;
            });
            updateTableContent(index);
        };
        stickyContainer.append(controlContainer, tabButtonsContainer, tableWrapper);
        panelContent.appendChild(stickyContainer);
        window.switchTab(currentActiveTab);
        jumpToTargetAge(targetAge);
    }
    function updateAgeRangePanel() {
        const sidePanel = document.getElementById('resultSidePanel');
        if (!sidePanel) return;
        const birthStr = formatFromDisplay(elements.birthDateInput.value);
        const expectedLength = appSettings.yearType === '西元' ? 8 : 7;
        if (birthStr.length !== expectedLength) return;
        const birthWestern = convertDate(birthStr, appSettings.yearType, '西元');
        const birthDate = parseWesternDate(birthWestern);
        if (!birthDate) return;
        let referenceDate = parseWesternDate(convertDate(formatFromDisplay(elements.effectiveDateInput.value), appSettings.yearType, '西元')) || new Date();
        referenceDate.setHours(0, 0, 0, 0);
        const content = sidePanel.querySelector('.age-panel-content');
        if (content) {
            renderAgeComparisonTableWithTabs(birthDate, content, referenceDate);
        }
    }
    function jumpToTargetAge(age) {
        if (age === null || age === undefined) return;
        let targetTabIndex = age <= 10 ? 0 : Math.floor((age - 1) / 10);
        if (targetTabIndex > 7) targetTabIndex = 7;

        if (targetTabIndex >= 0 && targetTabIndex < 8) {
            window.switchTab(targetTabIndex);
        }
    }
    function repositionSidePanels() {
        const mainPanel = elements.panel;
        if (!mainPanel) return;
        const mainRect = mainPanel.getBoundingClientRect();
        const historyPanel = document.getElementById('historyPanel');
        const rangePanel = document.getElementById('resultSidePanel');
        const gap = 8;
        let lastRight = mainRect.right;
        if (rangePanel) {
            rangePanel.style.top = `${mainRect.top}px`;
            rangePanel.style.left = `${lastRight + gap}px`;
            lastRight += gap + rangePanel.offsetWidth;
        }
        if (historyPanel) {
            historyPanel.style.top = `${mainRect.top}px`;
            historyPanel.style.left = `${lastRight + gap}px`;
        }
    }
    function createSidePanel(id, width, height) {
        const existingPanel = document.getElementById(id);
        if (existingPanel) {
            existingPanel.remove();
            repositionSidePanels();
            return null;
        }
        const panel = createElem('div', {
            position:'fixed', top: '0px', left: '-9999px', width: `${width}px`, height: `${height}px`,
            background:THEME.bg, border:`1px solid ${THEME.border}`, borderRadius:THEME.radius, boxShadow:THEME.shadow,
            zIndex:2147483647, display:'flex', flexDirection:'column',
            transition:'left 0.3s ease-out, top 0.1s linear', fontFamily:THEME.fontFamily
        });
        panel.id = id;
        const header = createElem('div', {height: '45px', padding:'0 10px 0 20px', borderBottom:`1px solid ${THEME.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'move',flexShrink:'0', boxSizing: 'border-box'});
        const content = createElem('div', {overflowY:'hidden',flexGrow:'1',color:THEME.text, display: 'flex', flexDirection: 'column'});
        content.classList.add('age-panel-content');
        panel.append(header,content);
        document.body.appendChild(panel);
        header.addEventListener('mousedown', (e) => handleDragStart(e, panel));
        return {panel,header,content};
    }
    function showAgeRange(){
        const result = createSidePanel('resultSidePanel', 380, 420);
        if (!result) return;
        const {panel,header,content} = result;
        const birthStr=formatFromDisplay(elements.birthDateInput.value),expectedLen=appSettings.yearType==='西元'?8:7;
        if(birthStr.length!==expectedLen){showToast('請先輸入有效的出生日期','error'); panel.remove(); return;}
        const birthWestern=convertDate(birthStr,appSettings.yearType,'西元'),birthDate=parseWesternDate(birthWestern);
        if(!birthDate){showToast('出生日期格式錯誤','error'); panel.remove(); return;}
        let referenceDate = parseWesternDate(convertDate(formatFromDisplay(elements.effectiveDateInput.value),appSettings.yearType,'西元')) || new Date();
        referenceDate.setHours(0,0,0,0);
        header.innerHTML = '';
        const headerTitle = createElem('h3',{margin:'0',fontSize:'16px',color:THEME.primary,fontWeight:'bold'},{textContent:'年齡區間比較表'});
        const closeButton = createElem('button',{background:'transparent',border:'none',fontSize:'24px',cursor:'pointer',color:'#888',padding:'0'}, {innerHTML:'&times;'});
        closeButton.onclick=()=>{ panel.remove(); repositionSidePanels(); };
        header.append(headerTitle,closeButton);
        renderAgeComparisonTableWithTabs(birthDate, content, referenceDate);
        repositionSidePanels();
    }
    function showHistoryPanel(){
        const result = createSidePanel('historyPanel', 250, 420);
        if (!result) return;
        const {panel,header,content} = result;
        content.style.padding = '8px';
        content.style.overflowY = 'auto';
        const title=createElem('h3',{margin:0,fontSize:'16px',color:THEME.primary,fontWeight:'bold'},{textContent:'計算歷史紀錄'});
        const clearHistoryBtn = createElem('button', {
            background: '#ffeded', color: '#c0392b', border: '1px solid #f5b7b1',
            padding: '2px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px'
        }, { textContent: '全部清除' });
        clearHistoryBtn.onclick = () => {
            localStorage.removeItem(STORAGE_KEY_HISTORY);
            content.innerHTML = '<div style="text-align:center; padding: 24px; color: #888;">紀錄已清除</div>';
            showToast('所有歷史紀錄已清除');
        };
        const buttonGroup = createElem('div', {display: 'flex', alignItems: 'center', gap: '10px'});
        const closeButton=createElem('button',{background:'transparent',border:'none',fontSize:'24px',cursor:'pointer',color:'#888',padding:'0'},{innerHTML:'&times;'});
        closeButton.onclick=()=>{ panel.remove(); repositionSidePanels(); };
        buttonGroup.append(clearHistoryBtn, closeButton);
        header.append(title, buttonGroup);
        const history=JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)||'[]');
        if(history.length===0){content.innerHTML='<div style="text-align:center; padding: 24px; color: #888;">尚無任何紀錄。</div>';}
        else {
            history.forEach(rec=>{
                const recDiv=createElem('div',{padding:'10px',borderBottom:`1px solid ${THEME.border}`,cursor:'pointer',borderRadius:'7px',marginBottom:'4px'});
                recDiv.onmouseover=()=>recDiv.style.backgroundColor=THEME.buttonHover;
                recDiv.onmouseout=()=>recDiv.style.backgroundColor='transparent';
                recDiv.onclick=()=>{
                    appSettings={yearType:rec.yearType,ageType:rec.ageType};localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(appSettings));
                    panel.remove(); repositionSidePanels(); initialize(true);
                    elements.effectiveDateInput.value=rec.effectiveDate;elements.birthDateInput.value=rec.birthDate;calculateAge();
                };
                const time=new Date(rec.timestamp).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
                recDiv.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:12px;color:${THEME.label};margin-bottom:6px;"><span>${rec.ageType} (${rec.yearType})</span><span>${time}</span></div><div style="font-weight:bold;font-size:13px;"><span style="color:${THEME.primary}">${rec.finalAge}歲</span> - ${rec.preciseAge}</div><div style="font-size:12px;color:${THEME.resultText};margin-top:4px;">${rec.ageRange}</div>`;
                content.appendChild(recDiv);
            });
        }
        repositionSidePanels();
    }

    // ========== 主面板 ==========
    function initialize(isRedraw=false) {
        let prevValues = {};
        if (isRedraw && elements.panel) {
            prevValues = {
                age: elements.ageInput.value,
                effective: elements.effectiveDateInput.value,
                birth: elements.birthDateInput.value,
                precise: elements.preciseAgeDisplay.textContent,
                range: elements.ageRangeDisplay.textContent,
                rangeSub: elements.ageRangeSubLabel.textContent
            };
        }

        if(!isRedraw){
            elements.panel = createElem('div',{
                position:'fixed',left:`${panelPosition.x}px`,top:`${panelPosition.y}px`,zIndex:2147483646,background:THEME.bg,
                border:`1px solid ${THEME.border}`,borderRadius:THEME.radius,padding:'0',fontSize:'14px',fontFamily:THEME.fontFamily,
                cursor:'default',boxShadow:THEME.shadow,userSelect:'none',width:'300px',height:'400px',
                display:'flex',flexDirection:'column',boxSizing:'border-box', overflow: 'hidden'
            });
            elements.panel.id = 'insuranceAgePanel';
            document.body.appendChild(elements.panel);
        }
        elements.panel.innerHTML='';

        const panelHeader = createElem('div', { padding: '0 20px', height: '45px', borderBottom: `1px solid ${THEME.border}`, flexShrink: 0, cursor: 'move', display: 'flex', alignItems: 'center'});
        const title = createElem('h3', { margin: 0, fontSize: '16px', color: THEME.primary, fontWeight: 'bold' }, { textContent: '保險年齡小工具' });
        panelHeader.appendChild(title);
        
        const mainContent = createElem('div', { padding: '12px 16px 16px 16px', flexGrow: 1, display: 'flex', flexDirection: 'column' });

        const settingsContainer=createElem('div',{display:'flex',gap:'8px',marginBottom:'12px',justifyContent:'space-between',flexShrink:0});
        const yearTypeSwitch=createToggleSwitch(['西元','民國'],appSettings.yearType,handleYearTypeChange,[55,55]);
        const ageTypeSwitch=createToggleSwitch(['實際年齡', '保險年齡'],appSettings.ageType,handleAgeTypeChange,[80,80]);
        settingsContainer.append(yearTypeSwitch,ageTypeSwitch);
        
        const inputContainer=createElem('div',{marginBottom:'auto'});
        const ageRow=createInputRow(appSettings.ageType,'number','請輸入年齡或自動計算',3);
        
        const quickAgeWrapper = createElem('div', { padding: '0 0 8px 78px', marginTop: '0px' });
        const quickAgeContainer=createElem('div',{display:'flex',alignItems:'center', justifyContent: 'space-between'});
        ['07','15','45','65','80'].forEach(age=>{
            const btn=createQuickAgeButton(age,()=>handleQuickAgeClick(age));
            quickAgeContainer.appendChild(btn);
        });
        quickAgeWrapper.appendChild(quickAgeContainer);

        const effectiveRow=createInputRow('計算迄日','text','YYYYMMDD',10);
        const birthRow=createInputRow('出生日期','text','YYYYMMDD',10);
        const separatorLine = createElem('div', { height: '1.5px', background: THEME.inputBorder, margin: '10px 0', opacity: '0.8' });
        const preciseAgeRow=createDisplayRow('實際足歲');
        const ageRangeRow=createDisplayRowWithSubLabel('年齡區間');
        elements.ageLabel=ageRow.label;elements.ageInput=ageRow.input;
        elements.preciseAgeDisplay=preciseAgeRow.valueSpan;
        elements.ageRangeDisplay=ageRangeRow.valueSpan;
        elements.ageRangeSubLabel=ageRangeRow.subLabel;
        elements.effectiveDateInput=effectiveRow.input;elements.birthDateInput=birthRow.input;
        elements.ageInput.addEventListener('input', () => {
            lastEditedField = 'age';
            clearTimeout(ageInputTimeout);
            ageInputTimeout = setTimeout(() => {
                if (document.activeElement === elements.ageInput) handleSmartCalculate();
            }, 500);
        });
        elements.effectiveDateInput.addEventListener('input', () => { lastEditedField = 'effectiveDate'; });
        elements.birthDateInput.addEventListener('input', () => { lastEditedField = 'birthDate'; });
        const ageBlock = createElem('div');
        ageBlock.append(ageRow.row, quickAgeWrapper);
        inputContainer.append(ageBlock, effectiveRow.row, birthRow.row, separatorLine, preciseAgeRow.row, ageRangeRow.row);
        
        const buttonContainer=createElem('div',{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:'4px',marginTop:'2px',flexShrink:0});
        const recordBtn=createCardButton('紀錄',showHistoryPanel);
        const rangeBtn=createCardButton('期間',showAgeRange);
        const clearBtn=createCardButton('清除',handleClearAll);
        const todayBtn=createCardButton('今天',handleSetToday);
        const calcButton=createCardButton('計算',handleSmartCalculate);
        Object.assign(calcButton.style, {
            background: THEME.calcButtonBg, color: '#fff', border: 'none', fontWeight: 'bold'
        });
        calcButton.onmouseover = function() { this.style.background = THEME.calcButtonHover; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)'; };
        calcButton.onmouseout = function() { this.style.background = THEME.calcButtonBg; this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; };
        buttonContainer.append(recordBtn,rangeBtn,clearBtn,todayBtn,calcButton);

        mainContent.append(settingsContainer, inputContainer, buttonContainer);
        elements.panel.append(panelHeader, mainContent);

        if (isRedraw) {
            elements.ageInput.value = prevValues.age || '';
            elements.effectiveDateInput.value = prevValues.effective || '';
            elements.birthDateInput.value = prevValues.birth || '';
            elements.preciseAgeDisplay.textContent = prevValues.precise || '';
            elements.ageRangeDisplay.textContent = prevValues.range || '';
            elements.ageRangeSubLabel.textContent = prevValues.rangeSub || '';
        } else {
            elements.effectiveDateInput.value=formatDateToDisplay(formatDate(new Date(),appSettings.yearType));
            document.addEventListener('mousemove',handleDragMove);
            document.addEventListener('mouseup',handleDragEnd);
            document.addEventListener('keydown',handleGlobalKeyPress);
        }
        panelHeader.addEventListener('mousedown', (e) => handleDragStart(e, elements.panel));
    }

    // ========== 事件處理 ==========
    function handleDragStart(e, targetPanel){
        activeDragTarget = targetPanel;
        const rect = activeDragTarget.getBoundingClientRect();
        const parentScroll = {
            top: window.scrollY,
            left: window.scrollX
        };
        dragOffset={x:e.clientX - (rect.left - parentScroll.left),y:e.clientY - (rect.top - parentScroll.top)};
        isDragging=true;
        activeDragTarget.style.cursor='grabbing';
        document.body.style.cursor='grabbing';
        activeDragTarget.style.transition = 'none';
    }
    function handleDragMove(e){
        if(!isDragging || !activeDragTarget)return;
        panelPosition.x=e.clientX-dragOffset.x;
        panelPosition.y=e.clientY-dragOffset.y;
        activeDragTarget.style.left=`${panelPosition.x}px`;
        activeDragTarget.style.top=`${panelPosition.y}px`;
        if (activeDragTarget === elements.panel) {
            repositionSidePanels();
        }
    }
    function handleDragEnd(){
        if(isDragging && activeDragTarget){
            if (activeDragTarget === elements.panel) {
                localStorage.setItem(STORAGE_KEY_POSITION,JSON.stringify({x: panelPosition.x, y: panelPosition.y}));
            }
            activeDragTarget.style.cursor='default';
            if (activeDragTarget === elements.panel) activeDragTarget.querySelector('div').style.cursor = 'move';
            activeDragTarget.style.transition = 'left 0.3s ease-out, top 0.1s linear';
        }
        isDragging=false;
        activeDragTarget = null;
        document.body.style.cursor='default';
    }
    function handleGlobalKeyPress(e){
        if(e.key==='Escape'){
            const rangePanel = document.getElementById('resultSidePanel');
            const historyPanel = document.getElementById('historyPanel');
            const mainPanel = document.getElementById('insuranceAgePanel');
            if (rangePanel || historyPanel) {
                rangePanel?.remove();
                historyPanel?.remove();
            } else if (mainPanel) {
                mainPanel.remove();
                document.removeEventListener('keydown',handleGlobalKeyPress);
                document.removeEventListener('mousemove',handleDragMove);
                document.removeEventListener('mouseup',handleDragEnd);
            }
        }
    }
    function handleYearTypeChange(newValue){
        const oldYearType=appSettings.yearType;appSettings.yearType=newValue;
        [elements.effectiveDateInput,elements.birthDateInput].forEach(input=>{
            const curVal=formatFromDisplay(input.value);
            if(curVal){
                const converted = convertDate(curVal, oldYearType, newValue);
                input.value = formatDateToDisplay(converted);
            }
        });
        localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(appSettings));
        showToast(`已切換至 ${appSettings.yearType} 年制`);
        if (formatFromDisplay(elements.effectiveDateInput.value) && formatFromDisplay(elements.birthDateInput.value)) {
            lastEditedField = 'effectiveDate';
            handleSmartCalculate();
        }
    }
    function handleAgeTypeChange(newValue, shouldReinitializeMain = true){
        appSettings.ageType=newValue;
        localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(appSettings));
        if (shouldReinitializeMain) { // Only show toast when changed from main panel
            showToast(`已切換至 ${appSettings.ageType} 模式`);
        }
        if (formatFromDisplay(elements.effectiveDateInput.value) && formatFromDisplay(elements.birthDateInput.value)) {
            lastEditedField = 'effectiveDate';
            handleSmartCalculate();
        }
        if (shouldReinitializeMain && document.getElementById('insuranceAgePanel')) {
            initialize(true);
        }
    }
    function handleSetToday(){
        if(!currentFocusedInput || (currentFocusedInput!==elements.effectiveDateInput && currentFocusedInput!==elements.birthDateInput)){showToast('請先點擊一個日期欄位','error');return;}
        currentFocusedInput.value=formatDateToDisplay(formatDate(new Date(),appSettings.yearType));
        lastEditedField = currentFocusedInput === elements.effectiveDateInput ? 'effectiveDate' : 'birthDate';
        showToast(`已設定為今日日期 (${appSettings.yearType})`);
        if (formatFromDisplay(elements.effectiveDateInput.value) && formatFromDisplay(elements.birthDateInput.value)) {
            handleSmartCalculate();
        }
    }
    function handleClearAll(){
        elements.ageInput.value='';
        elements.preciseAgeDisplay.textContent='';
        elements.ageRangeDisplay.textContent='';
        elements.ageRangeSubLabel.textContent='';
        elements.effectiveDateInput.value='';
        elements.birthDateInput.value='';
        currentFocusedInput=null;
        targetAge=null;
        lastEditedField = null;
        showToast('已清除所有資料');
        updateAgeRangePanel();
    }
    function handleQuickAgeClick(age){
        elements.ageInput.value=age;
        lastEditedField = 'age';
        handleSmartCalculate();
    }

    // ========== 核心計算邏輯 ==========
    function handleSmartCalculate(){
        const effDateStr = formatFromDisplay(elements.effectiveDateInput.value);
        const birthDateStr = formatFromDisplay(elements.birthDateInput.value);
        const ageStr = elements.ageInput.value;
        const expectedLen = appSettings.yearType === '西元' ? 8 : 7;
        let calculationPerformed = false;
        if (lastEditedField === 'age') {
            if (effDateStr.length === expectedLen && ageStr) {
                if(calculateBirthDate()) { showToast('已依【年齡】反推【出生日期】'); calculationPerformed = true; }
            } else { if(document.activeElement === elements.ageInput) showToast('請確認【計算迄日】與【年齡】皆已輸入', 'error'); return; }
        } else if (lastEditedField === 'birthDate' || lastEditedField === 'effectiveDate') {
            if (effDateStr.length === expectedLen && birthDateStr.length === expectedLen) {
                if (calculateAge()) { showToast('已依【日期】計算【年齡】'); calculationPerformed = true; }
            }
        }
        if (!calculationPerformed) {
            if (effDateStr.length === expectedLen && birthDateStr.length === expectedLen) {
                if (calculateAge()) { showToast(`${appSettings.ageType} 計算完成`); }
            } else if (effDateStr.length === expectedLen && ageStr) {
                if (calculateBirthDate()) { showToast('出生日期計算完成'); }
            } else if (birthDateStr.length === expectedLen && ageStr) {
                if (calculateEffectiveDate()) { showToast('計算迄日計算完成'); }
            } else { showToast('請提供任意兩項有效資訊', 'error'); }
        }
        updateAgeRangePanel();
    }
    function calculateAge(){
        const effStr=formatFromDisplay(elements.effectiveDateInput.value),birthStr=formatFromDisplay(elements.birthDateInput.value);
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(effStr.length!==expectedLen||birthStr.length!==expectedLen)return false;
        const effWestern=convertDate(effStr,appSettings.yearType,'西元'),birthWestern=convertDate(birthStr,appSettings.yearType,'西元');
        const effDate=parseWesternDate(effWestern),birthDate=parseWesternDate(birthWestern);
        if(!effDate||!birthDate){showToast('日期格式錯誤', 'error');return false;}
        if(effDate<birthDate){showToast('計算迄日不能早於出生日','error');return false;}
        updateAllResults(birthDate,effDate);
        return true;
    }
    function calculateBirthDate(){
        const effStr=formatFromDisplay(elements.effectiveDateInput.value),targetAgeVal=parseFloat(elements.ageInput.value);
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(effStr.length!==expectedLen||isNaN(targetAgeVal)||targetAgeVal<0)return false;
        const effWestern=convertDate(effStr,appSettings.yearType,'西元'),effDate=parseWesternDate(effWestern);
        if(!effDate)return false;
        let birthDate;
        if (appSettings.ageType === '保險年齡') {
            birthDate = new Date(effDate);
            birthDate.setFullYear(effDate.getFullYear() - targetAgeVal);
            birthDate.setMonth(birthDate.getMonth() - 6);
        } else {
            birthDate = new Date(effDate);
            birthDate.setFullYear(effDate.getFullYear() - targetAgeVal);
        }
        elements.birthDateInput.value=formatDateToDisplay(formatDate(birthDate,appSettings.yearType));
        updateAllResults(birthDate,effDate);
        return true;
    }
    function calculateEffectiveDate(){
        const birthStr=formatFromDisplay(elements.birthDateInput.value),targetAgeVal=parseFloat(elements.ageInput.value);
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(birthStr.length!==expectedLen||isNaN(targetAgeVal)||targetAgeVal<0)return false;
        const birthWestern=convertDate(birthStr,appSettings.yearType,'西元'),birthDate=parseWesternDate(birthWestern);
        if(!birthDate)return false;
        let effDate;
        if (appSettings.ageType === '保險年齡') {
            effDate = new Date(birthDate);
            effDate.setFullYear(birthDate.getFullYear() + targetAgeVal);
            effDate.setMonth(effDate.getMonth() + 6);
        } else {
            effDate = new Date(birthDate);
            effDate.setFullYear(effDate.getFullYear() + targetAgeVal);
        }
        elements.effectiveDateInput.value=formatDateToDisplay(formatDate(effDate,appSettings.yearType));
        updateAllResults(birthDate,effDate);
        return true;
    }
    function updateAllResults(birthDate,effDate){
        let actualAge = getActualAge(birthDate, effDate);
        let insuranceAge = getInsuranceAge(birthDate, effDate);
        targetAge = appSettings.ageType === '實際年齡' ? actualAge : insuranceAge;
        let ageInfo = {
            actual: getAgeRange(birthDate, actualAge),
            insurance: getInsuranceAgeRangeFromTable(birthDate, effDate, insuranceAge)
        };
        const diff = calculatePreciseAgeDiff(birthDate, effDate);
        elements.preciseAgeDisplay.textContent = `${diff.years} 歲 ${diff.months} 月 ${diff.days} 日`;
        let finalAge, rangeText;
        if(appSettings.ageType==='實際年齡'){
            finalAge=actualAge;
            rangeText=`${formatDateToDisplay(formatDate(ageInfo.actual.start,appSettings.yearType))} ~ ${formatDateToDisplay(formatDate(ageInfo.actual.end,appSettings.yearType))}`;
        }else{
            finalAge=insuranceAge;
            rangeText=`${formatDateToDisplay(formatDate(ageInfo.insurance.start,appSettings.yearType))} ~ ${formatDateToDisplay(formatDate(ageInfo.insurance.end,appSettings.yearType))}`;
        }
        elements.ageInput.value=finalAge;
        elements.ageRangeDisplay.textContent = rangeText;
        elements.ageRangeSubLabel.textContent = `(${appSettings.ageType})`;
        const history=JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)||'[]');
        const newRecord={timestamp:new Date().toISOString(),effectiveDate:formatDateToDisplay(formatDate(effDate,appSettings.yearType)),birthDate:formatDateToDisplay(formatDate(birthDate,appSettings.yearType)),yearType:appSettings.yearType,ageType:appSettings.ageType,finalAge:finalAge,preciseAge:`${diff.years} 歲 ${diff.months} 月 ${diff.days} 日`,ageRange:rangeText};
        history.unshift(newRecord);if(history.length>50)history.pop();
        localStorage.setItem(STORAGE_KEY_HISTORY,JSON.stringify(history));
        updateAgeRangePanel();
        if (document.getElementById('historyPanel')) {
            showHistoryPanel(); showHistoryPanel();
        }
    }

    // ========== 啟動 ==========
    if (document.getElementById('insuranceAgePanel')) {
        document.getElementById('insuranceAgePanel').remove();
        document.getElementById('resultSidePanel')?.remove();
        document.getElementById('historyPanel')?.remove();
    }
    initialize();
})();
