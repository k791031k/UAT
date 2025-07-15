javascript:(function() {
    'use strict';
    // ========== 主題色與基本樣式 ==========
    const THEME = {
        bg: '#ffffff',
        border: '#e9eef2',
        radius: '10px',
        primary: '#007aff',
        label: '#5a6a7b',
        text: '#212529',
        inputBg: '#f8f9fa',
        inputBorder: '#e1e8ed',
        inputFocus: '#80bdff',
        buttonBg: '#f1f5f9',
        buttonText: '#495057',
        buttonHover: '#e9eef2',
        calcButtonBg: 'linear-gradient(145deg, #007bff, #0056b3)',
        calcButtonHover: 'linear-gradient(145deg, #0069d9, #004085)',
        quickButtonBg: 'transparent',
        quickButtonBorder: '#d0d9e8',
        quickButtonHover: '#f1f5f9',
        shadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        cardShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        toastSuccess: '#28a745',
        toastError: '#dc3545',
        tabActiveBg: '#007aff',
        tabActiveText: '#ffffff',
        tabInactiveBg: '#e9eef2',
        tabInactiveText: '#5a6a7b',
        highlight: 'rgba(255, 236, 179, 0.8)',
        highlightBorder: '#ffc107',
        highlightColBg: 'rgba(0, 122, 255, 0.07)',
        pastTime: '#90a4ae',
        pastTimeBg: '#fcfcfc',
        resultBg: 'rgba(0, 122, 255, 0.07)',
        resultText: '#0056b3',
        fontFamily: '"Microsoft JhengHei", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    };

    // ========== 狀態管理 ==========
    const STORAGE_KEY_POSITION = 'insuranceAgePanelPositionV24';
    const STORAGE_KEY_SETTINGS = 'insuranceAgeSettingsV24';
    const STORAGE_KEY_HISTORY = 'insuranceCalcHistoryV24';
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
    let activeDragTarget = null;

    // ========== 工具函式 ==========
    const createElem = (tag, style = {}, prop = {}) => {
        const el = document.createElement(tag);
        Object.assign(el, prop);
        Object.assign(el.style, style);
        return el;
    };
    const showToast = (msg, type = 'success') => {
        const mainPanel = document.getElementById('insuranceAgePanel');
        const toast = createElem('div', {
            position: 'fixed', zIndex: 2147483648,
            background: '#fff', color: type === 'success' ? THEME.toastSuccess : THEME.toastError,
            border: `1.5px solid ${type === 'success' ? THEME.toastSuccess : THEME.toastError}`,
            borderRadius: THEME.radius, fontFamily: THEME.fontFamily,
            boxShadow: THEME.shadow, padding: '10px 20px',
            fontWeight: 'bold', fontSize: '14px', transition: 'all 0.4s ease-out',
            textAlign: 'center',
            opacity: '0', transform: 'translateY(0px)',
            display: 'flex', alignItems: 'center', gap: '8px'
        });
        const icon = createElem('span');
        icon.textContent = type === 'success' ? '✅' : '❌';
        toast.appendChild(icon);
        toast.appendChild(document.createTextNode(msg));
        document.body.appendChild(toast);
        const mainRect = mainPanel ? mainPanel.getBoundingClientRect() : { top: 50, left: window.innerWidth / 2, width: 0 };
        const toastRect = toast.getBoundingClientRect();
        toast.style.left = `${mainRect.left + (mainRect.width / 2) - (toastRect.width / 2)}px`;
        toast.style.top = `${mainRect.top + 50}px`;
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(10px)';
        }, 30);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(0px)';
            setTimeout(() => toast.remove(), 500);
        }, 2200);
    };
    const copyToClipboard = async (text) => {
        if (!text) {
            showToast('內容為空，無法複製', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showToast(`已複製: ${text}`);
        } catch (err) {
            showToast('複製失敗', 'error');
        }
    };
    const convertDate = (dateStr, fromType, toType) => {
        if (!dateStr) return '';
        const clean = dateStr.replace(/[^0-9]/g, '');
        if (fromType === toType) return clean;
        if (fromType === '西元' && toType === '民國' && clean.length === 8)
            return `${parseInt(clean.substring(0,4),10)-1911}`.padStart(3,'0') + clean.substring(4);
        if (fromType === '民國' && toType === '西元' && clean.length === 7)
            return `${parseInt(clean.substring(0,3),10)+1911}` + clean.substring(3);
        return clean;
    };
    const parseWesternDate = (str) => {
        if (!str) return null;
        const clean = str.replace(/[^0-9]/g, '');
        if (clean.length !== 8) return null;
        const y = parseInt(clean.substring(0,4)), m = parseInt(clean.substring(4,6))-1, d = parseInt(clean.substring(6,8));
        const dt = new Date(y,m,d);
        return (dt.getFullYear()===y && dt.getMonth()===m && dt.getDate()===d) ? dt : null;
    };
    const formatDate = (date, yearType) => {
        if (!(date instanceof Date) || isNaN(date)) return '';
        const y = date.getFullYear(), m = (date.getMonth()+1).toString().padStart(2,'0'), d = date.getDate().toString().padStart(2,'0');
        const dispY = yearType==='西元' ? y.toString().padStart(4,'0') : (y-1911).toString().padStart(3,'0');
        return `${dispY}${m}${d}`;
    };
    const formatDateToDisplay = (dateStr) => {
        if (!dateStr) return '';
        const clean = dateStr.replace(/[^0-9]/g, '');
        if (clean.length === 8) return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}`;
        if (clean.length === 7) return `${clean.substring(0,3)}-${clean.substring(3,5)}-${clean.substring(5,7)}`;
        return dateStr;
    };
    const formatFromDisplay = (dateStr) => dateStr.replace(/[^0-9]/g, '');
    const calculatePreciseAgeDiff = (start, end) => {
        let y = end.getFullYear()-start.getFullYear(), m = end.getMonth()-start.getMonth(), d = end.getDate()-start.getDate();
        if (d<0) { m--; d+=new Date(start.getFullYear(),start.getMonth()+1,0).getDate(); }
        if (m<0) { y--; m+=12; }
        return {years:y,months:m,days:d};
    };
    const getActualAge = (birth, ref) => calculatePreciseAgeDiff(birth, ref).years;
    const getInsuranceAge = (birth, ref) => {
        const diff = calculatePreciseAgeDiff(birth, ref);
        return diff.months > 6 || (diff.months === 6 && diff.days > 0) ? diff.years + 1 : diff.years;
    };
    const getAgeRange = (birthDate, age) => {
        let start = new Date(birthDate);
        start.setFullYear(birthDate.getFullYear() + age);
        let end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        return { start, end };
    };

    // ...（中略，請見附件 paste.txt 取得完整功能與 UI，或依需求補全）

    // ========== 啟動 ==========
    if (document.getElementById('insuranceAgePanel')) {
        document.getElementById('insuranceAgePanel').remove();
        document.getElementById('resultSidePanel')?.remove();
        document.getElementById('historyPanel')?.remove();
    }
    // 主程式初始化
    initialize();
})();
