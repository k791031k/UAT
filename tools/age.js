javascript:(function(){
    // 主題色與基本樣式
    const THEME = {
        bg: '#fff',
        border: '#c5d3e0',
        radius: '12px',
        primary: '#4682b4',
        label: '#24405a',
        text: '#223344',
        inputBg: '#f8fafc',
        inputBorder: '#c5d3e0',
        inputFocus: '#4682b4',
        buttonBg: '#eaf3fa',
        buttonText: '#223344',
        buttonActive: '#4682b4',
        buttonTextActive: '#fff',
        calcButtonBg: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        calcButtonHover: 'linear-gradient(135deg, #218838 0%, #1ea080 100%)',
        cardButtonBg: 'linear-gradient(135deg, #f8fafc 0%, #e3f2fd 100%)',
        cardButtonHover: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
        cardButtonBorder: '#b3d9ff',
        quickButtonBg: '#f1f8ff',
        quickButtonBorder: '#b3d9ff',
        quickButtonHover: '#e3f2fd',
        shadow: '0 4px 24px rgba(70,130,180,0.13)',
        cardShadow: '0 2px 8px rgba(70,130,180,0.15)',
        toastSuccess: '#28a745',
        toastError: '#dc3545',
        tabActive: '#4682b4',
        tabInactive: '#eaf3fa',
        highlight: '#fff3cd',
        highlightBorder: '#ffeaa7',
        pastTime: '#95a5a6',
        pastTimeBg: '#f8f9fa'
    };

    // 狀態管理
    const STORAGE_KEY_POSITION = 'insuranceAgePanelPositionV10';
    const STORAGE_KEY_SETTINGS = 'insuranceAgeSettingsV10';
    const STORAGE_KEY_HISTORY = 'insuranceCalcHistoryV10';
    const savedPosition = JSON.parse(localStorage.getItem(STORAGE_KEY_POSITION) || '{"x":40,"y":40}');
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{"yearType":"西元","ageType":"保險年齡"}');
    let panelPosition = { x: savedPosition.x, y: savedPosition.y };
    let appSettings = { yearType: savedSettings.yearType, ageType: savedSettings.ageType };
    let isDragging = false, dragOffset = { x: 0, y: 0 };
    let currentFocusedInput = null;
    let currentActiveTab = 0;
    let targetAge = null;
    const elements = {};

    // 工具函式
    function createElem(tag, style = {}, prop = {}) {
        const el = document.createElement(tag);
        Object.assign(el, prop);
        Object.assign(el.style, style);
        return el;
    }
    function showToast(msg, type = 'success') {
        const toast = createElem('div', {
            position: 'fixed', top: '24px', right: '-400px', zIndex: 2147483648,
            background: '#fff', color: type === 'success' ? THEME.primary : THEME.toastError,
            border: `1.5px solid ${THEME.border}`, borderRadius: '10px',
            boxShadow: THEME.shadow, padding: '13px 22px',
            fontWeight: 'bold', fontSize: '15px', transition: 'right 0.5s'
        });
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '24px'; }, 30);
        setTimeout(() => { toast.style.right = '-400px'; setTimeout(() => toast.remove(), 500); }, 2200);
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
        if (!str || str.length !== 8) return null;
        const y = parseInt(str.substring(0,4)), m = parseInt(str.substring(4,6))-1, d = parseInt(str.substring(6,8));
        const dt = new Date(y,m,d);
        return (dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d) ? dt : null;
    }
    function formatDate(date, yearType) {
        const y = date.getFullYear(), m = (date.getMonth()+1).toString().padStart(2,'0'), d = date.getDate().toString().padStart(2,'0');
        const dispY = yearType==='西元' ? y.toString().padStart(4,'0') : (y-1911).toString().padStart(3,'0');
        return `${dispY}${m}${d}`;
    }
    function calculatePreciseAgeDiff(start, end) {
        let y = end.getFullYear()-start.getFullYear(), m = end.getMonth()-start.getMonth(), d = end.getDate()-start.getDate();
        if (d<0) { m--; d+=new Date(start.getFullYear(),start.getMonth()+1,0).getDate(); }
        if (m<0) { y--; m+=12; }
        return {years:y,months:m,days:d};
    }
    function getActualAge(birth, ref) {
        const diff = calculatePreciseAgeDiff(birth, ref);
        return diff.years;
    }
    function getInsuranceAge(birth, ref) {
        const diff = calculatePreciseAgeDiff(birth, ref);
        let age = diff.years;
        if (diff.months > 6 || (diff.months === 6 && diff.days > 0)) age++;
        return age;
    }
    function getAgeRange(birthDate, age) {
        let start = new Date(birthDate);
        start.setFullYear(birthDate.getFullYear() + age);
        let end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        return { start, end };
    }

    // 年齡區間表格公式
    function pad(n) { return n < 10 ? '0' + n : n; }
    function formatDateDash(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
    function getAgeComparisonTable(birthdayStr, startYear, yearsCount) {
        const [birthYear, birthMonth, birthDay] = birthdayStr.split('-').map(Number);
        let rows = [];
        for (let i = 0; i < yearsCount; i++) {
            const thisBirthday = new Date(startYear + i, birthMonth - 1, birthDay);
            const plus6M = new Date(thisBirthday);
            plus6M.setMonth(plus6M.getMonth() + 6);

            rows.push({
                年齡: (startYear + i) - birthYear,
                區間起始日: formatDateDash(thisBirthday),
                區間結束日: formatDateDash(new Date(plus6M.getTime() - 1 * 24 * 60 * 60 * 1000)),
                實際年齡: (startYear + i) - birthYear,
                保險年齡: (startYear + i) - birthYear
            });

            const nextBirthday = new Date(thisBirthday);
            nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
            rows.push({
                年齡: (startYear + i) - birthYear,
                區間起始日: formatDateDash(plus6M),
                區間結束日: formatDateDash(new Date(nextBirthday.getTime() - 1 * 24 * 60 * 60 * 1000)),
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
        const targetRows = allRows.filter(row => row.保險年齡 === insuranceAge);
        
        if (targetRows.length > 0) {
            const effDateStr = formatDateDash(effectiveDate);
            for (let row of targetRows) {
                if (effDateStr >= row.區間起始日 && effDateStr <= row.區間結束日) {
                    const startParts = row.區間起始日.split('-');
                    const endParts = row.區間結束日.split('-');
                    const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1])-1, parseInt(startParts[2]));
                    const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1])-1, parseInt(endParts[2]));
                    return { start: startDate, end: endDate };
                }
            }
            const firstRow = targetRows[0];
            const startParts = firstRow.區間起始日.split('-');
            const endParts = firstRow.區間結束日.split('-');
            const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1])-1, parseInt(startParts[2]));
            const endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1])-1, parseInt(endParts[2]));
            return { start: startDate, end: endDate };
        }
        return getAgeRange(birthDate, insuranceAge);
    }

    // UI 元件 - 新增牌卡風格按鈕
    function createCardButton(text, onClick) {
        return createElem('button', {
            padding: '0', height: '50px', fontSize: '14px', 
            border: `1.5px solid ${THEME.cardButtonBorder}`, borderRadius: THEME.radius,
            background: THEME.cardButtonBg, color: THEME.primary,
            fontWeight: 'bold', cursor: 'pointer', boxShadow: THEME.cardShadow, 
            transition: 'all 0.3s ease', margin: '0', minWidth: '60px'
        }, {
            onmouseover: function(){
                this.style.background = THEME.cardButtonHover;
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 16px rgba(70,130,180,0.25)';
            },
            onmouseout: function(){
                this.style.background = THEME.cardButtonBg;
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = THEME.cardShadow;
            },
            onclick: onClick,
            textContent: text
        });
    }

    // 圓形計算按鈕
    function createCircleCalcButton(text, onClick) {
        return createElem('button', {
            padding: '0', width: '60px', height: '60px', fontSize: '16px', border: 'none', 
            borderRadius: '50%', background: THEME.calcButtonBg, color: '#fff',
            fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 16px rgba(40,167,69,0.25)', 
            transition: 'all 0.3s ease', margin: '0', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }, {
            onmouseover: function(){
                this.style.background = THEME.calcButtonHover;
                this.style.transform = 'scale(1.05) translateY(-2px)';
                this.style.boxShadow = '0 6px 20px rgba(40,167,69,0.35)';
            },
            onmouseout: function(){
                this.style.background = THEME.calcButtonBg;
                this.style.transform = 'scale(1) translateY(0)';
                this.style.boxShadow = '0 4px 16px rgba(40,167,69,0.25)';
            },
            onclick: onClick,
            textContent: text
        });
    }

    function createQuickAgeButton(age, onClick) {
        return createElem('button', {
            padding: '0', height: '20px', fontSize: '12px', border: `1.5px solid ${THEME.quickButtonBorder}`, 
            borderRadius: '8px', background: THEME.quickButtonBg, color: THEME.primary,
            fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', 
            transition: 'all 0.2s', margin: '0', minWidth: '32px'
        }, {
            onmouseover: function(){
                this.style.background = THEME.quickButtonHover;
                this.style.transform = 'translateY(-1px)';
                this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            },
            onmouseout: function(){
                this.style.background = THEME.quickButtonBg;
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
            },
            onclick: onClick,
            textContent: age
        });
    }

    function createInputRow(labelText, inputType, placeholder, maxLength) {
        const row = createElem('div', {display:'flex',alignItems:'center',marginBottom:'12px',gap:'6px'});
        const label = createElem('label', {minWidth:'80px',color:THEME.label,fontWeight:'bold',fontSize:'15px',cursor:'pointer'}, {textContent:labelText});
        const input = createElem('input', {
            flex:'1',padding:'10px 12px',border:`1.5px solid ${THEME.inputBorder}`,borderRadius:'8px',fontSize:'15px',background:THEME.inputBg,color:THEME.text,
            transition:'all 0.2s'
        },{type:inputType,placeholder:placeholder||'',maxLength:maxLength||undefined});
        input.addEventListener('focus',e=>{currentFocusedInput=input;input.style.border=`1.7px solid ${THEME.inputFocus}`;input.style.boxShadow='0 0 8px #4682b455';});
        input.addEventListener('blur',e=>{input.style.border=`1.5px solid ${THEME.inputBorder}`;input.style.boxShadow='none';});
        input.addEventListener('keydown',e=>{
            if(e.key==='Tab'){e.preventDefault();const inputs=[elements.ageInput,elements.effectiveDateInput,elements.birthDateInput],idx=inputs.indexOf(document.activeElement);inputs[(idx+1)%inputs.length].focus();}
        });
        label.addEventListener('click',()=>copyToClipboard(input.value));
        row.append(label,input);
        return {row,label,input};
    }
    function createDisplayRow(labelText) {
        const row = createElem('div', {display:'flex',alignItems:'center',marginBottom:'10px',gap:'6px',minHeight:'30px'});
        const label = createElem('label', {minWidth:'80px',color:THEME.label,fontWeight:'bold',fontSize:'15px'}, {textContent:labelText});
        const valueSpan = createElem('span', {flex:'1',padding:'8px 0',fontSize:'15px',fontWeight:'500',color:THEME.primary});
        row.append(label,valueSpan);
        return {row,label,valueSpan};
    }
    function createToggleSwitch(options, initialValue, onToggle, widths) {
        const container = createElem('div', {display:'inline-flex',border:`1.5px solid ${THEME.inputBorder}`,borderRadius:'8px',overflow:'hidden'});
        const optionElements = {};
        const updateStyles = (selectedValue) => {
            options.forEach(opt=>{
                const el=optionElements[opt],active=opt===selectedValue;
                el.style.background=active?THEME.primary:'#eaf3fa';
                el.style.color=active?'#fff':THEME.primary;
                el.style.fontWeight=active?'bold':'normal';
            });
        };
        options.forEach((option,idx)=>{
            const el = createElem('div',{
                padding:'8px 0',width:`${widths[idx]}px`,fontSize:'15px',textAlign:'center',cursor:'pointer',transition:'all 0.2s'
            },{textContent:option});
            if(idx>0) el.style.borderLeft=`1.5px solid ${THEME.inputBorder}`;
            el.onclick=()=>{const cur=appSettings[onToggle.name==='handleYearTypeChange'?'yearType':'ageType'];if(cur!==option){updateStyles(option);onToggle(option);}};
            optionElements[option]=el;
            container.appendChild(el);
        });
        updateStyles(initialValue);
        return container;
    }

    // 分頁功能
    function createTabButton(text, index, isActive) {
        return createElem('button', {
            padding: '6px 10px', fontSize: '12px', border: 'none', borderRadius: '6px 6px 0 0',
            background: isActive ? THEME.tabActive : THEME.tabInactive, 
            color: isActive ? '#fff' : THEME.primary,
            fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
            marginRight: '1px', whiteSpace: 'nowrap', flexShrink: '0'
        }, {
            textContent: text,
            onclick: () => switchTab(index)
        });
    }

    function switchTab(index) {
        currentActiveTab = index;
        const tabButtons = document.querySelectorAll('.age-tab-button');
        const tabPanes = document.querySelectorAll('.age-tab-pane');
        
        tabButtons.forEach((btn, idx) => {
            const isActive = idx === index;
            btn.style.background = isActive ? THEME.tabActive : THEME.tabInactive;
            btn.style.color = isActive ? '#fff' : THEME.primary;
        });
        
        tabPanes.forEach((pane, idx) => {
            pane.style.display = idx === index ? 'block' : 'none';
        });
    }

    function jumpToTargetAge(age) {
        if (age === null || age === undefined) return;
        let targetTabIndex = Math.floor(age / 10);
        if (age >= 71) targetTabIndex = 7;
        if (targetTabIndex >= 0 && targetTabIndex < 8) {
            switchTab(targetTabIndex);
        }
    }

    function renderAgeComparisonTableWithTabs(birthDate, panelContent, referenceDate) {
        panelContent.innerHTML = '';
        
        const y = birthDate.getFullYear(), m = birthDate.getMonth()+1, d = birthDate.getDate();
        const birthdayStr = `${y}-${pad(m)}-${pad(d)}`;
        const allRows = getAgeComparisonTable(birthdayStr, y, 81);

        const tabButtonsContainer = createElem('div', {
            display: 'flex', flexWrap: 'nowrap', gap: '1px', marginBottom: '12px',
            borderBottom: `2px solid ${THEME.border}`, paddingBottom: '8px',
            overflowX: 'auto', overflowY: 'hidden'
        });

        const tabContentContainer = createElem('div', {
            height: 'calc(100vh - 200px)', overflowY: 'auto'
        });

        const ageRanges = [
            {start: 0, end: 10, label: '0-10'},
            {start: 11, end: 20, label: '11-20'},
            {start: 21, end: 30, label: '21-30'},
            {start: 31, end: 40, label: '31-40'},
            {start: 41, end: 50, label: '41-50'},
            {start: 51, end: 60, label: '51-60'},
            {start: 61, end: 70, label: '61-70'},
            {start: 71, end: 80, label: '71-80'}
        ];

        ageRanges.forEach((range, i) => {
            const button = createTabButton(range.label, i, i === currentActiveTab);
            button.classList.add('age-tab-button');
            tabButtonsContainer.appendChild(button);

            const contentDiv = createElem('div', {
                display: i === currentActiveTab ? 'block' : 'none'
            });
            contentDiv.classList.add('age-tab-pane');

            const pageRows = allRows.filter(row => row.年齡 >= range.start && row.年齡 <= range.end);

            const tableContainer = createElem('div', {
                position: 'relative', height: '100%', overflowY: 'auto'
            });

            const table = createElem('table', {width:'100%',borderCollapse:'collapse',fontSize:'13px'});
            
            const thead = createElem('thead', {
                position: 'sticky', top: '0', zIndex: '100', backgroundColor: '#f7fafd'
            });
            const trHead = createElem('tr');
            ['年齡','區間起始日','區間結束日','實際年齡','保險年齡'].forEach(h=>{
                const th = createElem('th',{
                    padding:'8px 4px', borderBottom:`2px solid ${THEME.primary}`,
                    color:THEME.primary, background:'#f7fafd', fontWeight:'bold', fontSize:'12px',
                    position: 'sticky', top: '0', zIndex: '100'
                });
                th.textContent = h;
                trHead.appendChild(th);
            });
            thead.appendChild(trHead);
            table.appendChild(thead);

            const tbody = createElem('tbody');
            pageRows.forEach((row, rowIndex)=>{
                const endDate = new Date(row.區間結束日);
                const isPast = referenceDate && referenceDate > endDate;
                
                const isTarget = targetAge !== null && 
                    ((appSettings.ageType === '實際年齡' && row.實際年齡 === targetAge) ||
                     (appSettings.ageType === '保險年齡' && row.保險年齡 === targetAge));

                const tr = createElem('tr', {
                    backgroundColor: isTarget ? THEME.highlight : 
                                   isPast ? THEME.pastTimeBg : 
                                   rowIndex % 2 === 0 ? 'transparent' : '#f9fbfd',
                    border: isTarget ? `2px solid ${THEME.highlightBorder}` : 'none'
                });
                
                ['年齡','區間起始日','區間結束日','實際年齡','保險年齡'].forEach(key=>{
                    const td = createElem('td',{
                        padding:'4px 4px', borderBottom:`1px solid #eaf3fa`, textAlign:'center',
                        color: isPast ? THEME.pastTime : THEME.text, fontSize:'12px',
                        fontWeight: isTarget ? 'bold' : 'normal'
                    });
                    td.textContent = row[key];
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            
            tableContainer.appendChild(table);
            contentDiv.appendChild(tableContainer);
            tabContentContainer.appendChild(contentDiv);
        });

        panelContent.append(tabButtonsContainer, tabContentContainer);
        jumpToTargetAge(targetAge);
    }

    function updateAgeRangePanel() {
        const sidePanel = document.getElementById('resultSidePanel');
        if (!sidePanel) return;
        
        const birthStr = elements.birthDateInput.value;
        const expectedLength = appSettings.yearType === '西元' ? 8 : 7;
        if (birthStr.length !== expectedLength) return;
        
        const birthWestern = convertDate(birthStr, appSettings.yearType, '西元');
        const birthDate = parseWesternDate(birthWestern);
        if (!birthDate) return;
        
        let referenceDate = parseWesternDate(convertDate(elements.effectiveDateInput.value, appSettings.yearType, '西元'));
        if (!referenceDate) referenceDate = new Date();
        referenceDate.setHours(0, 0, 0, 0);
        
        const content = sidePanel.querySelector('.age-panel-content');
        if (content) {
            renderAgeComparisonTableWithTabs(birthDate, content, referenceDate);
        }
    }

    // 主面板
    function initialize(isRedraw=false) {
        if(!isRedraw){
            elements.panel = createElem('div',{
                position:'fixed',left:`${panelPosition.x}px`,top:`${panelPosition.y}px`,zIndex:2147483646,background:THEME.bg,
                border:`2px solid ${THEME.border}`,borderRadius:THEME.radius,padding:'24px 28px',fontSize:'15px',fontFamily:'Arial,Microsoft JhengHei,sans-serif',
                cursor:'move',boxShadow:THEME.shadow,userSelect:'none',width:'370px',backdropFilter:'blur(10px)',boxSizing:'border-box'
            });
            elements.panel.id = 'insuranceAgePanel';
            document.body.appendChild(elements.panel);
        }
        elements.panel.innerHTML='';
        
        const settingsContainer=createElem('div',{display:'flex',gap:'18px',marginBottom:'18px',justifyContent:'space-between'});
        const yearTypeSwitch=createToggleSwitch(['西元','民國'],appSettings.yearType,handleYearTypeChange,[68,68]);
        const ageTypeSwitch=createToggleSwitch(['保險年齡','實際年齡'],appSettings.ageType,handleAgeTypeChange,[110,110]);
        settingsContainer.append(yearTypeSwitch,ageTypeSwitch);
        
        const inputContainer=createElem('div',{marginBottom:'18px'});
        const ageRow=createInputRow(appSettings.ageType,'number','自動計算',3);

        // 快捷年齡按鈕 - 與輸入框左側對齊
        const quickAgeContainer=createElem('div',{display:'flex',gap:'6px',alignItems:'center',marginTop:'6px',marginBottom:'12px',marginLeft:'86px'});
        [7,15,45,65,80].forEach(age=>{
            const btn=createQuickAgeButton(age,()=>handleQuickAgeClick(age));
            quickAgeContainer.appendChild(btn);
        });

        const effectiveRow=createInputRow('計算迄日','text','',8);
        const birthRow=createInputRow('出生日期','text','',8);
        const preciseAgeRow=createDisplayRow('實際足歲');
        const ageRangeRow=createDisplayRow(`${appSettings.ageType}區間`);
        elements.ageLabel=ageRow.label;elements.ageInput=ageRow.input;
        elements.preciseAgeDisplay=preciseAgeRow.valueSpan;
        elements.ageRangeLabel=ageRangeRow.label;elements.ageRangeDisplay=ageRangeRow.valueSpan;
        elements.effectiveDateInput=effectiveRow.input;elements.birthDateInput=birthRow.input;

        const ageBlock = createElem('div', {marginBottom:'0'});
        ageBlock.append(ageRow.row, quickAgeContainer);

        inputContainer.append(ageBlock, effectiveRow.row, birthRow.row, preciseAgeRow.row, ageRangeRow.row);

        // 按鈕區 - 牌卡風格按鈕 + 圓形計算按鈕
        const buttonContainer=createElem('div',{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:'8px',marginTop:'8px',alignItems:'center'});
        const recordBtn=createCardButton('紀錄',showHistoryPanel);
        const rangeBtn=createCardButton('期間',showAgeRange);
        const clearBtn=createCardButton('清除',handleClearAll);
        const todayBtn=createCardButton('今天',handleSetToday);
        const calcButton=createCircleCalcButton('計算',handleSmartCalculate);

        buttonContainer.append(recordBtn,rangeBtn,clearBtn,todayBtn,calcButton);

        elements.panel.append(settingsContainer,inputContainer,buttonContainer);

        if(!isRedraw){
            elements.effectiveDateInput.value=formatDate(new Date(),appSettings.yearType);
            elements.panel.addEventListener('mousedown',handleDragStart);
            document.addEventListener('mousemove',handleDragMove);
            document.addEventListener('mouseup',handleDragEnd);
            document.addEventListener('keydown',handleGlobalKeyPress);
        }
    }

    // 事件處理
    function handleDragStart(e){if(e.target!==elements.panel)return;isDragging=true;dragOffset={x:e.clientX-panelPosition.x,y:e.clientY-panelPosition.y};elements.panel.style.cursor='grabbing';}
    function handleDragMove(e){
        if(!isDragging)return;
        panelPosition.x=e.clientX-dragOffset.x;panelPosition.y=e.clientY-dragOffset.y;
        elements.panel.style.left=`${panelPosition.x}px`;elements.panel.style.top=`${panelPosition.y}px`;
        const sidePanel=document.getElementById('resultSidePanel');
        if(sidePanel){
            const offset=8;
            sidePanel.style.left=`${panelPosition.x+elements.panel.offsetWidth+offset}px`;
            sidePanel.style.top=`${panelPosition.y}px`;
            sidePanel.style.right='auto';
        }
    }
    function handleDragEnd(){if(isDragging){isDragging=false;elements.panel.style.cursor='move';localStorage.setItem(STORAGE_KEY_POSITION,JSON.stringify(panelPosition));}}
    function handleGlobalKeyPress(e){
        if(e.key==='Escape'){
            const sidePanel=document.getElementById('resultSidePanel');
            const mainPanel=document.getElementById('insuranceAgePanel');
            if(sidePanel){sidePanel.remove();}
            else if(mainPanel){mainPanel.remove();document.removeEventListener('keydown',handleGlobalKeyPress);}
        }
    }
    function handleYearTypeChange(newValue){
        const oldYearType=appSettings.yearType;appSettings.yearType=newValue;
        [elements.effectiveDateInput,elements.birthDateInput].forEach(input=>{
            const curVal=input.value;const expectedLen=oldYearType==='西元'?8:7;
            if(curVal&&curVal.length===expectedLen){input.value=convertDate(curVal,oldYearType,newValue);}
        });
        localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(appSettings));
        showToast(`已切換至 ${appSettings.yearType} 年制`);
        updateAgeRangePanel();
    }
    function handleAgeTypeChange(newValue){
        appSettings.ageType=newValue;
        localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(appSettings));
        elements.ageLabel.textContent=newValue;
        elements.ageRangeLabel.textContent=`${newValue}區間`;
        showToast(`已切換至 ${appSettings.ageType} 模式`);
        if(elements.effectiveDateInput.value&&elements.birthDateInput.value){calculateAge();}
        updateAgeRangePanel();
    }
    function handleSetToday(){
        if(currentFocusedInput!==elements.effectiveDateInput&&currentFocusedInput!==elements.birthDateInput){showToast('請先點擊一個日期欄位','error');return;}
        currentFocusedInput.value=formatDate(new Date(),appSettings.yearType);
        showToast(`已設定為今日日期 (${appSettings.yearType})`);
        updateAgeRangePanel();
    }
    function handleClearAll(){
        elements.ageInput.value='';elements.preciseAgeDisplay.textContent='';elements.ageRangeDisplay.textContent='';
        elements.effectiveDateInput.value=formatDate(new Date(),appSettings.yearType);elements.birthDateInput.value='';
        currentFocusedInput=null;targetAge=null;showToast('已清除所有資料');
        updateAgeRangePanel();
    }
    function handleQuickAgeClick(age){
        elements.ageInput.value=age;handleSmartCalculate();
    }

    function handleSmartCalculate(){
        const effDate=elements.effectiveDateInput.value,birthDate=elements.birthDateInput.value,age=elements.ageInput.value;
        const expectedLen=appSettings.yearType==='西元'?8:7;
        
        if(effDate.length===expectedLen && birthDate.length===expectedLen){
            if(calculateAge()){
                showToast(`${appSettings.ageType} 計算完成`);
            }
        }
        else if(effDate.length===expectedLen && age){
            if(calculateBirthDate()){
                showToast('出生日期計算完成');
            }
        }
        else if(birthDate.length===expectedLen && age){
            if(calculateEffectiveDate()){
                showToast('計算迄日計算完成');
            }
        }
        else{
            showToast('請提供任意兩項有效資訊','error');
        }
        updateAgeRangePanel();
    }

    function calculateAge(){
        const effStr=elements.effectiveDateInput.value,birthStr=elements.birthDateInput.value;
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(effStr.length!==expectedLen||birthStr.length!==expectedLen)return false;
        const effWestern=convertDate(effStr,appSettings.yearType,'西元'),birthWestern=convertDate(birthStr,appSettings.yearType,'西元');
        const effDate=parseWesternDate(effWestern),birthDate=parseWesternDate(birthWestern);
        if(!effDate||!birthDate)return false;
        if(effDate<birthDate){showToast('計算迄日不能早於出生日','error');return false;}
        updateAllResults(birthDate,effDate);
        return true;
    }
    function calculateBirthDate(){
        const effStr=elements.effectiveDateInput.value,targetAge=parseFloat(elements.ageInput.value);
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(effStr.length!==expectedLen||isNaN(targetAge)||targetAge<0)return false;
        const effWestern=convertDate(effStr,appSettings.yearType,'西元'),effDate=parseWesternDate(effWestern);
        if(!effDate)return false;
        const birthDate=new Date(effDate);birthDate.setFullYear(birthDate.getFullYear()-targetAge);
        elements.birthDateInput.value=formatDate(birthDate,appSettings.yearType);
        updateAllResults(birthDate,effDate);
        return true;
    }
    function calculateEffectiveDate(){
        const birthStr=elements.birthDateInput.value,targetAge=parseFloat(elements.ageInput.value);
        const expectedLen=appSettings.yearType==='西元'?8:7;
        if(birthStr.length!==expectedLen||isNaN(targetAge)||targetAge<0)return false;
        const birthWestern=convertDate(birthStr,appSettings.yearType,'西元'),birthDate=parseWesternDate(birthWestern);
        if(!birthDate)return false;
        const effDate=new Date(birthDate);effDate.setFullYear(effDate.getFullYear()+targetAge);
        elements.effectiveDateInput.value=formatDate(effDate,appSettings.yearType);
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
            rangeText=`${formatDate(ageInfo.actual.start,appSettings.yearType)} ~ ${formatDate(ageInfo.actual.end,appSettings.yearType)}`;
        }else{
            finalAge=insuranceAge;
            rangeText=`${formatDate(ageInfo.insurance.start,appSettings.yearType)} ~ ${formatDate(ageInfo.insurance.end,appSettings.yearType)}`;
        }
        elements.ageInput.value=finalAge;
        elements.ageRangeDisplay.textContent=rangeText;
        const history=JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)||'[]');
        const newRecord={timestamp:new Date().toISOString(),effectiveDate:formatDate(effDate,appSettings.yearType),birthDate:formatDate(birthDate,appSettings.yearType),yearType:appSettings.yearType,ageType:appSettings.ageType,finalAge:finalAge,preciseAge:`${diff.years} 歲 ${diff.months} 月 ${diff.days} 日`,ageRange:rangeText};
        history.unshift(newRecord);if(history.length>50)history.pop();
        localStorage.setItem(STORAGE_KEY_HISTORY,JSON.stringify(history));
        updateAgeRangePanel();
    }

    // 側邊面板
    function createSidePanel(id, position) {
        document.getElementById('resultSidePanel')?.remove();
        const panel = createElem('div', {
            position:'fixed',top:`${position.top}px`,width:'520px',maxHeight:'calc(100vh - 60px)',background:THEME.bg,backdropFilter:'blur(10px)',border:`1.5px solid ${THEME.border}`,
            borderRadius:THEME.radius,boxShadow:THEME.shadow,zIndex:2147483647,display:'flex',flexDirection:'column',transition:'all 0.4s cubic-bezier(0.25,0.8,0.25,1)',fontFamily:'Arial,Microsoft JhengHei,sans-serif'
        });
        panel.id = 'resultSidePanel';
        if(position.side==='left'){panel.style.left='-600px';}else{panel.style.left=`${position.x}px`;}
        const header = createElem('div', {padding:'16px 20px',borderBottom:`1.5px solid #eaf3fa`,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'move',flexShrink:'0'});
        const content = createElem('div', {padding:'16px 22px',overflowY:'auto',flexGrow:'1',lineHeight:'1.7',fontSize:'15px',color:THEME.text});
        content.classList.add('age-panel-content');
        panel.append(header,content);
        document.body.appendChild(panel);
        setTimeout(()=>{panel.style.left=`${position.x}px`;},50);

        let dragging=false,offset={x:0,y:0};
        header.addEventListener('mousedown',e=>{
            dragging=true;
            const rect=panel.getBoundingClientRect();
            offset={x:e.clientX-rect.left,y:e.clientY-rect.top};
            panel.style.transition='none';
        });
        document.addEventListener('mousemove',e=>{
            if(!dragging)return;
            panel.style.left=`${e.clientX-offset.x}px`;
            panel.style.top=`${e.clientY-offset.y}px`;
        });
        document.addEventListener('mouseup',()=>{dragging=false;panel.style.transition='all 0.4s cubic-bezier(0.25,0.8,0.25,1)';});
        return {panel,header,content};
    }
    function showAgeRange(){
        const birthStr=elements.birthDateInput.value,expectedLen=appSettings.yearType==='西元'?8:7;
        if(birthStr.length!==expectedLen){showToast('請先輸入有效的出生日期','error');return;}
        const birthWestern=convertDate(birthStr,appSettings.yearType,'西元'),birthDate=parseWesternDate(birthWestern);
        if(!birthDate){showToast('出生日期格式錯誤','error');return;}
        
        let referenceDate = parseWesternDate(convertDate(elements.effectiveDateInput.value,appSettings.yearType,'西元'));
        if(!referenceDate)referenceDate=new Date();
        referenceDate.setHours(0,0,0,0);
        
        const mainPanelRect=elements.panel.getBoundingClientRect();
        const position={top:mainPanelRect.top,x:mainPanelRect.right+8,side:'right'};
        const {panel,header,content} = createSidePanel('resultSidePanel',position);
        header.innerHTML = '';
        const headerTitle = createElem('h3',{margin:'0',fontSize:'17px',color:THEME.primary,fontWeight:'bold'},{textContent:'年齡區間比較表 (0-80歲分頁顯示)'});
        const closeButton = createElem('button',{background:'transparent',border:'none',fontSize:'26px',cursor:'pointer',color:'#888',padding:'0 8px'}, {innerHTML:'&times;'});
        closeButton.onclick=()=>{panel.remove();};
        header.append(headerTitle,closeButton);
        renderAgeComparisonTableWithTabs(birthDate, content, referenceDate);
    }
    function showHistoryPanel(){
        const mainPanelRect=elements.panel.getBoundingClientRect();
        const position={top:mainPanelRect.top,x:mainPanelRect.left-340-8,side:'left'};
        const {panel,header,content}=createSidePanel('historyPanel',position);
        header.style.justifyContent='space-between';
        const title=createElem('h3',{margin:0,fontSize:'17px',color:THEME.primary,fontWeight:'bold'},{textContent:'計算歷史紀錄'});
        const closeButton=createElem('button',{background:'transparent',border:'none',fontSize:'26px',cursor:'pointer',color:'#888',padding:'0 8px'},{innerHTML:'&times;'});
        closeButton.onclick=()=>{panel.remove();};
        header.append(title,closeButton);
        const history=JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)||'[]');
        if(history.length===0){content.textContent='尚無任何紀錄。';content.style.textAlign='center';content.style.padding='24px';return;}
        history.forEach(rec=>{
            const recDiv=createElem('div',{padding:'12px',borderBottom:'1.5px solid #eaf3fa',cursor:'pointer',borderRadius:'7px',marginBottom:'0'});
            recDiv.onmouseover=()=>recDiv.style.backgroundColor='#eaf3fa';
            recDiv.onmouseout=()=>recDiv.style.backgroundColor='transparent';
            recDiv.onclick=()=>{
                const newSettings={yearType:rec.yearType,ageType:rec.ageType};
                appSettings=newSettings;localStorage.setItem(STORAGE_KEY_SETTINGS,JSON.stringify(newSettings));
                panel.remove();initialize(true);
                elements.effectiveDateInput.value=rec.effectiveDate;elements.birthDateInput.value=rec.birthDate;calculateAge();
            };
            const time=new Date(rec.timestamp).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
            recDiv.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13px;color:#6a7b8c;"><span>${rec.ageType} (${rec.yearType})</span><span>${time}</span></div><div style="font-weight:bold;margin-top:6px;"><span style="color:${THEME.primary}">${rec.finalAge}歲</span> - ${rec.preciseAge}</div><div style="font-size:14px;color:#8B0000;">${rec.ageRange}</div>`;
            content.appendChild(recDiv);
        });
    }

    initialize();
})();
