javascript:(function(){
'use strict';
// ========== AppConfig ==========
const AppConfig = Object.freeze({
  TOOL_ID: 'planCodeQueryToolInstance',
  STYLE_ID: 'planCodeToolStyle',
  VERSION: '2.1.0',
  QUERY_MODES: {
    PLAN_CODE: 'planCode',
    PLAN_NAME: 'planCodeName',
    ALL_MASTER_PLANS: 'allMasterPlans',
    MASTER_IN_SALE: 'masterInSale',
    MASTER_STOPPED: 'masterStopped',
    CHANNEL_IN_SALE: 'channelInSale',
    CHANNEL_STOPPED: 'channelStopped'
  },
  API_ENDPOINTS: {
    UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
    PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
  },
  SALE_STATUS: {
    CURRENT: '現售中',
    STOPPED: '停售',
    PENDING: '未開始',
    ABNORMAL: '日期異常'
  },
  FIELD_MAPS: {
    CURRENCY: {'1':'TWD','2':'USD','3':'AUD','4':'CNT','5':'USD_OIU','6':'EUR','7':'JPY'},
    UNIT: {'A1':'元','A3':'仟元','A4':'萬元','B1':'計畫','C1':'單位'},
    COVERAGE_TYPE: {'M':'主約','R':'附約'},
    CHANNELS: ['AG','BR','BK','WS','EC']
  },
  DEFAULT_QUERY_PARAMS: {
    PAGE_SIZE_MASTER: 1000,
    PAGE_SIZE_CHANNEL: 1000,
    PAGE_SIZE_DETAIL: 20,
    PAGE_SIZE_TABLE: 50
  }
});

// ========== Utils ==========
const Utils = {
  escapeHtml: t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t,
  formatToday: () => { const d = new Date(); return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`; },
  formatDateForUI: dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g,''),
  formatDateForComparison: dt => { if(!dt)return'';const p=String(dt).split(' ')[0];return/^\d{8}$/.test(p)?p.replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'):p; },
  getSaleStatus: (todayStr, saleStartStr, saleEndStr) => {
    if(!saleStartStr||!saleEndStr)return'';
    const today=new Date(Utils.formatDateForComparison(todayStr)),sS=new Date(Utils.formatDateForComparison(saleStartStr)),sE=new Date(Utils.formatDateForComparison(saleEndStr));
    if(isNaN(today)||isNaN(sS)||isNaN(sE))return'日期格式錯誤';
    if(sS.getTime()>sE.getTime())return AppConfig.SALE_STATUS.ABNORMAL;
    if(saleEndStr.includes('99991231')||saleEndStr.includes('9999-12-31'))return AppConfig.SALE_STATUS.CURRENT;
    if(today>sE)return AppConfig.SALE_STATUS.STOPPED;
    if(today<sS)return AppConfig.SALE_STATUS.PENDING;
    if(today>=sS&&today<=sE)return AppConfig.SALE_STATUS.CURRENT;
    return '';
  },
  channelCodeConvert: code => code==='OT'?'BK':code,
  currencyConvert: val => AppConfig.FIELD_MAPS.CURRENCY[String(val)]||val||'',
  unitConvert: val => AppConfig.FIELD_MAPS.UNIT[String(val)]||val||'',
  coverageTypeConvert: val => AppConfig.FIELD_MAPS.COVERAGE_TYPE[String(val)]||val||'',
  copyTextToClipboard: (text, showToast) => {
    if(!navigator.clipboard){
      const ta=document.createElement('textarea');
      ta.value=text;document.body.appendChild(ta);ta.select();
      document.execCommand('copy');document.body.removeChild(ta);
      showToast('已複製查詢結果 (舊版瀏覽器)','success');
    }else{
      navigator.clipboard.writeText(text).then(()=>showToast('已複製查詢結果','success')).catch(()=>showToast('複製失敗','error'));
    }
  },
  checkSpecialStatus: item => {
    const todayStr=Utils.formatToday(),mainStatus=Utils.getSaleStatus(todayStr,item.saleStartDate,item.saleEndDate),channels=item.channels||[];
    if(mainStatus===AppConfig.SALE_STATUS.STOPPED&&channels.some(c=>c.status===AppConfig.SALE_STATUS.CURRENT))return true;
    if(mainStatus===AppConfig.SALE_STATUS.CURRENT&&channels.length>0&&channels.every(c=>[AppConfig.SALE_STATUS.STOPPED,AppConfig.SALE_STATUS.PENDING].includes(c.status)))return true;
    if(channels.some(c=>{const mE=new Date(Utils.formatDateForComparison(item.saleEndDate)),cE=new Date(Utils.formatDateForComparison(c.rawEnd));return!isNaN(mE)&&!isNaN(cE)&&mE<cE;}))return true;
    if(channels.some(c=>{const mS=new Date(Utils.formatDateForComparison(item.saleStartDate)),cS=new Date(Utils.formatDateForComparison(c.rawStart));return!isNaN(mS)&&!isNaN(cS)&&mS>cS;}))return true;
    if(mainStatus===AppConfig.SALE_STATUS.ABNORMAL)return true;
    return false;
  },
  splitInput: input => input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean)
};

// ========== UIManager ==========
const UIManager = (() => {
  let currentModal=null,toastTimeoutId=null;
  const INTERNAL_STYLES = `（請見上一則回答，CSS 內容過長，請參考上一則完整內容，或如需純文字檔案可提供下載連結）`;
  function injectStyles(){
    if(!document.getElementById(AppConfig.STYLE_ID)){
      const style=document.createElement('style');
      style.id=AppConfig.STYLE_ID;
      style.textContent=INTERNAL_STYLES;
      document.head.appendChild(style);
    }
  }
  function showModal({title,body,footer='',onOpen}){
    closeModal().then(()=>{
      const mask=document.createElement('div');
      mask.className='pct-modal-mask';
      mask.addEventListener('click',e=>{if(e.target===mask)closeModal();});
      const modal=document.createElement('div');
      modal.className='pct-modal';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-labelledby','pct-modal-title');
      modal.innerHTML=`
        <div class="pct-modal-header"><span id="pct-modal-title">${title}</span></div>
        <div class="pct-modal-body">${body}</div>
        <div class="pct-modal-footer">${footer}</div>
      `;
      document.body.appendChild(mask);document.body.appendChild(modal);
      currentModal={mask,modal};
      modal.style.top='60px';modal.style.left='50%';modal.style.transform='translateX(-50%) translateY(-20px)';
      setTimeout(()=>{mask.classList.add('show');modal.classList.add('show');modal.style.transform='translateX(-50%) translateY(0)';},10);
      // 拖曳
      let isDragging=false,currentX,currentY,initialX,initialY;
      const header=modal.querySelector('.pct-modal-header');
      header.addEventListener('mousedown',e=>{isDragging=true;initialX=e.clientX-modal.getBoundingClientRect().left;initialY=e.clientY-modal.getBoundingClientRect().top;modal.classList.add('dragging');header.classList.add('dragging');e.preventDefault();});
      document.addEventListener('mousemove',e=>{if(isDragging){currentX=e.clientX-initialX;currentY=e.clientY-initialY;const maxX=window.innerWidth-modal.offsetWidth,maxY=window.innerHeight-modal.offsetHeight;modal.style.left=`${Math.max(0,Math.min(currentX,maxX))}px`;modal.style.top=`${Math.max(0,Math.min(currentY,maxY))}px`;modal.style.transform='none';e.preventDefault();}});
      document.addEventListener('mouseup',()=>{isDragging=false;modal.classList.remove('dragging');header.classList.remove('dragging');});
      const handleEscInstance=e=>{if(e.key==='Escape')closeModal();};
      document.addEventListener('keydown',handleEscInstance);currentModal.handleEscListener=handleEscInstance;
      if(onOpen)setTimeout(()=>onOpen(modal),50);
    });
  }
  function closeModal(){
    return new Promise(resolve=>{
      if(currentModal){
        const modalElement=currentModal.modal,maskElement=currentModal.mask,escListener=currentModal.handleEscListener;
        modalElement.classList.remove('show');maskElement.classList.remove('show');
        const onTransitionEnd=()=>{if(modalElement.parentNode)modalElement.remove();if(maskElement.parentNode)maskElement.remove();if(escListener)document.removeEventListener('keydown',escListener);currentModal=null;resolve();};
        modalElement.addEventListener('transitionend',onTransitionEnd,{once:true});
        setTimeout(()=>{if(currentModal===null)return;onTransitionEnd();},300);
      }else{resolve();}
    });
  }
  function showToast(msg,type='info',duration=1800){
    if(toastTimeoutId){clearTimeout(toastTimeoutId);const existingToast=document.getElementById('pct-toast');if(existingToast){existingToast.classList.remove('pct-toast-show');existingToast.addEventListener('transitionend',()=>existingToast.remove(),{once:true});}}
    let el=document.getElementById('pct-toast');
    if(!el){el=document.createElement('div');el.id='pct-toast';document.body.appendChild(el);}
    el.className=`pct-toast ${type}`;el.textContent=msg;el.classList.add('pct-toast-show');
    toastTimeoutId=setTimeout(()=>{el.classList.remove('pct-toast-show');el.addEventListener('transitionend',()=>el.remove(),{once:true});},duration);
  }
  function showError(msg,elementId='pct-token-err'){const el=document.getElementById(elementId);if(el){el.textContent=msg;el.style.display='block';}else{showToast(msg,'error');}}
  function hideError(elementId='pct-token-err'){const el=document.getElementById(elementId);if(el){el.style.display='none';el.textContent='';}}
  return {injectStyles,showModal,closeModal,showToast,showError,hideError};
})();

// ========== APIService ==========
const APIService = (() => {
  let currentToken='';
  function setToken(token){currentToken=token;}
  async function callApi(endpoint,params){
    const response=await fetch(`${endpoint}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','SSO-TOKEN':currentToken},
      body:JSON.stringify(params)
    });
    if(!response.ok){
      const errorText=await response.text();
      let errorMessage=errorText;
      try{const errorJson=JSON.parse(errorText);if(errorJson.message){errorMessage=errorJson.message;}else if(errorJson.error){errorMessage=errorJson.error;}}catch(e){}
      throw new Error(`API 請求失敗: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
    return response.json();
  }
  async function verifyToken(token,apiBaseUrl){
    try{
      const res=await fetch(`${apiBaseUrl}/planCodeController/query`,{
        method:'POST',
        headers:{'Content-Type':'application/json','SSO-TOKEN':token},
        body:JSON.stringify({planCode:'5105',currentPage:1,pageSize:1})
      });
      const data=await res.json();
      return res.ok&&!!data.records;
    }catch(e){return false;}
  }
  return {setToken,callApi,verifyToken};
})();

// ========== DataProcessor ==========
const DataProcessor = (() => {
  let _allRawData=[],_cacheDetail=new Map(),_cacheChannel=new Map();
  function resetData(){_allRawData=[];_cacheDetail.clear();_cacheChannel.clear();}
  async function processAllDataForTable(rawData,apiBaseUrl,forceFetch=false){
    _allRawData=rawData;
    const todayStr=Utils.formatToday();
    const promises=_allRawData.map(async item=>{
      if(item._isErrorRow){
        return {no:0,planCode:item.planCode||'-',shortName:'-',currency:'-',unit:'-',coverageType:'-',saleStartDate:'-',saleEndDate:`查詢狀態: ${Utils.escapeHtml(item._apiStatus)}`,mainStatus:'-',polpln:'-',channels:[],special:false,_isErrorRow:true};
      }
      let polpln=item.polpln||'';
      if(!polpln||forceFetch||!_cacheDetail.has(item.planCode)){
        try{
          const detail=await APIService.callApi(`${apiBaseUrl}/planCodeController/queryDetail`,{planCode:item.planCode,currentPage:1,pageSize:AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL});
          polpln=(detail.records||[]).map(r=>r.polpln).filter(Boolean).join(', ');
          _cacheDetail.set(item.planCode,polpln);
        }catch(e){polpln='';}
      }else{polpln=_cacheDetail.get(item.planCode);}
      let channels=item.channels||[];
      if(channels.length===0||forceFetch||!_cacheChannel.has(item.planCode)){
        try{
          const sale=await APIService.callApi(`${apiBaseUrl}/planCodeSaleDateController/query`,{planCode:item.planCode,currentPage:1,pageSize:AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL});
          channels=(sale.planCodeSaleDates?.records||[]).map(r=>({
            channel:Utils.channelCodeConvert(r.channel),
            saleStartDate:Utils.formatDateForUI(r.saleStartDate),
            saleEndDate:Utils.formatDateForUI(r.saleEndDate),
            status:Utils.getSaleStatus(todayStr,r.saleStartDate,r.saleEndDate),
            rawStart:r.saleStartDate,rawEnd:r.saleEndDate
          }));
          _cacheChannel.set(item.planCode,channels);
        }catch(e){channels=[];}
      }else{channels=_cacheChannel.get(item.planCode);}
      const mainSaleStartDate=Utils.formatDateForUI(item.saleStartDate),mainSaleEndDate=Utils.formatDateForUI(item.saleEndDate),mainStatus=Utils.getSaleStatus(todayStr,item.saleStartDate,item.saleEndDate);
      const processedItem={no:0,planCode:item.planCode||'-',shortName:item.shortName||item.planName||'-',currency:Utils.currencyConvert(item.currency||item.cur),unit:Utils.unitConvert(item.reportInsuranceAmountUnit||item.insuranceAmountUnit),coverageType:Utils.coverageTypeConvert(item.coverageType||item.type),saleStartDate:mainSaleStartDate,saleEndDate:mainSaleEndDate,mainStatus,polpln,channels,special:false,_isErrorRow:false,_originalItem:item};
      processedItem.special=Utils.checkSpecialStatus(processedItem);
      return processedItem;
    });
    const results=await Promise.allSettled(promises),fulfilledData=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    fulfilledData.forEach((item,idx)=>item.no=idx+1);
    return fulfilledData;
  }
  function sortData(data,sortKey,sortAsc){
    if(!sortKey)return data;
    return [...data].sort((a,b)=>{
      const valA=a[sortKey],valB=b[sortKey];
      if(sortKey.includes('Date')){
        const dateA=new Date(Utils.formatDateForComparison(valA)),dateB=new Date(Utils.formatDateForComparison(valB));
        if(isNaN(dateA)&&isNaN(dateB))return 0;
        if(isNaN(dateA))return sortAsc?1:-1;
        if(isNaN(dateB))return sortAsc?-1:1;
        if(dateA>dateB)return sortAsc?1:-1;
        if(dateA<dateB)return sortAsc?-1:1;
        return 0;
      }
      if(valA===undefined||valA===null)return sortAsc?1:-1;
      if(valB===undefined||valB===null)return sortAsc?-1:1;
      if(typeof valA==='string'&&typeof valB==='string'){return sortAsc?valA.localeCompare(valB):valB.localeCompare(valA);}
      if(valA>valB)return sortAsc?1:-1;
      if(valA<valB)return sortAsc?-1:1;
      return 0;
    });
  }
  function clearCaches(){_cacheDetail.clear();_cacheChannel.clear();}
  function getRawData(){return[..._allRawData];}
  return {resetData,processAllDataForTable,sortData,clearCaches,getRawData};
})();

// ========== AppCore ==========
const AppCore = (() => {
  let env='',apiBase='',token='',tokenCheckEnabled=true,allProcessedData=[],queryMode='',queryInput='',querySubOption=[],queryChannels=[],pageNo=1,pageSize=AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,totalRecords=0,filterSpecial=false,sortKey='',sortAsc=true,detailQueryCount=0;
  async function start(){
    env=detectEnv();apiBase=env==='PROD'?AppConfig.API_ENDPOINTS.PROD:AppConfig.API_ENDPOINTS.UAT;
    resetAppState();DataProcessor.resetData();
    UIManager.injectStyles();
    token=localStorage.getItem('SSO-TOKEN')||'';APIService.setToken(token);
    if(token&&tokenCheckEnabled){
      UIManager.showToast('正在驗證 Token，請稍候...','info');
      const isValid=await APIService.verifyToken(token,apiBase);
      if(isValid){UIManager.showToast('Token 驗證成功，已自動登入。','success');showQueryDialog();return;}
      else{UIManager.showToast('Token 無效，請重新設定。','warning');localStorage.removeItem('SSO-TOKEN');token='';APIService.setToken('');}
    }
    showTokenDialog();
  }
  function resetAppState(){allProcessedData=[];queryMode='';queryInput='';querySubOption=[];queryChannels=[];pageNo=1;totalRecords=0;filterSpecial=false;sortKey='';sortAsc=true;detailQueryCount=0;}
  function detectEnv(){const host=window.location.host.toLowerCase();if(host.includes('uat')||host.includes('test')||host.includes('dev')||host.includes('stg'))return'UAT';return'PROD';}
  function envLabel(){return env==='PROD'?'正式環境':'測試環境';}
  function showTokenDialog(){
    UIManager.showModal({
      title:`商品查詢小工具（${envLabel()}）`,
      body:`<div class="pct-form-group"><label for="pct-token-input" class="pct-label">請輸入 SSO-TOKEN：</label><textarea class="pct-input" id="pct-token-input" rows="4" placeholder="請貼上您的 SSO-TOKEN" autocomplete="off"></textarea><div class="pct-error" id="pct-token-err" style="display:none"></div></div>`,
      footer:`<button class="pct-btn" id="pct-token-ok">確認</button><button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過驗證</button>`,
      onOpen:(modalElement)=>{
        const tokenInput=modalElement.querySelector('#pct-token-input'),confirmBtn=modalElement.querySelector('#pct-token-ok'),skipBtn=modalElement.querySelector('#pct-token-skip');
        tokenInput.value=token||'';tokenInput.focus();UIManager.hideError('pct-token-err');
        confirmBtn.onclick=async()=>{
          const val=tokenInput.value.trim();
          if(!val){UIManager.showError('請輸入 Token','pct-token-err');return;}
          UIManager.showToast('檢查 Token 中...','info');
          token=val;APIService.setToken(val);localStorage.setItem('SSO-TOKEN',val);
          const isValid=await APIService.verifyToken(val,apiBase);
          if(tokenCheckEnabled){
            if(isValid){await UIManager.closeModal();UIManager.showToast('Token 驗證成功','success');showQueryDialog();}
            else{UIManager.showError('Token 驗證失敗，請重新輸入','pct-token-err');}
          }else{await UIManager.closeModal();UIManager.showToast('Token 已儲存 (未驗證)','info');showQueryDialog();}
        };
        skipBtn.onclick=async()=>{tokenCheckEnabled=false;await UIManager.closeModal();UIManager.showToast('已略過 Token 驗證','warning');showQueryDialog();};
      }
    });
  }
  function showQueryDialog(){
    const primaryQueryModes=[AppConfig.QUERY_MODES.PLAN_CODE,AppConfig.QUERY_MODES.PLAN_NAME,AppConfig.QUERY_MODES.ALL_MASTER_PLANS,'masterDataCategory','channelDataCategory'];
    UIManager.showModal({
      title:'查詢條件設定',
      body:`<div class="pct-form-group"><div class="pct-label">查詢模式：</div><div id="pct-mode-wrap" class="pct-mode-card-grid">${primaryQueryModes.map(mode=>`<div class="pct-mode-card" data-mode="${mode}">${modeLabel(mode)}</div>`).join('')}</div></div><div id="pct-dynamic-query-content"></div><div class="pct-form-group"><div class="pct-error" id="pct-query-err" style="display:none"></div></div>`,
      footer:`<button class="pct-btn" id="pct-query-ok">開始查詢</button><button class="pct-btn pct-btn-secondary" id="pct-query-cancel">取消</button><button class="pct-btn pct-btn-secondary" id="pct-query-clear-selection">清除選擇</button>`,
      onOpen:(modalElement)=>{
        let currentPrimaryMode=queryMode,currentQueryInput=queryInput,currentSubOptions=[...querySubOption],currentChannels=[...queryChannels];
        const dynamicContentArea=modalElement.querySelector('#pct-dynamic-query-content'),modeCards=modalElement.querySelectorAll('#pct-mode-wrap .pct-mode-card'),queryOkBtn=modalElement.querySelector('#pct-query-ok'),queryCancelBtn=modalElement.querySelector('#pct-query-cancel'),clearSelectionBtn=modalElement.querySelector('#pct-query-clear-selection');
        let debounceTimer=null;
        const updateDynamicContent=()=>{
          dynamicContentArea.innerHTML='';UIManager.hideError('pct-query-err');
          let inputHtml='',subOptionHtml='',channelSelectionHtml='';
          switch(currentPrimaryMode){
            case AppConfig.QUERY_MODES.PLAN_CODE:
              inputHtml=`<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品代碼 (多筆請用空格、逗號、分號或換行分隔)"></textarea></div>`;break;
            case AppConfig.QUERY_MODES.PLAN_NAME:
              inputHtml=`<div class="pct-form-group"><label for="pct-query-input" class="pct-label">輸入商品名稱關鍵字：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="請輸入商品名稱關鍵字"></textarea></div>`;break;
            case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
              inputHtml=`<div style="text-align: center; padding: 20px; color: var(--text-color-light);">將查詢所有主檔商品，無需輸入任何條件。</div>`;break;
            case 'masterDataCategory':
              subOptionHtml=`<div class="pct-form-group"><div class="pct-label">選擇主檔查詢範圍：</div><div class="pct-sub-option-grid"><div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.MASTER_IN_SALE}">現售商品</div><div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.MASTER_STOPPED}">停售商品</div></div></div>`;break;
            case 'channelDataCategory':
              channelSelectionHtml=`<div class="pct-form-group"><div class="pct-label">選擇通路：(可多選，不選則查詢所有通路)</div><div class="pct-channel-option-grid">${AppConfig.FIELD_MAPS.CHANNELS.map(ch=>`<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`).join('')}</div></div>`;
              subOptionHtml=`<div class="pct-form-group"><div class="pct-label">選擇通路銷售範圍：</div><div class="pct-sub-option-grid"><div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.CHANNEL_IN_SALE}">現售通路</div><div class="pct-sub-option" data-sub-option="${AppConfig.QUERY_MODES.CHANNEL_STOPPED}">停售通路</div></div></div>`;break;
          }
          dynamicContentArea.innerHTML=inputHtml+channelSelectionHtml+subOptionHtml;
          const newQueryInput=dynamicContentArea.querySelector('#pct-query-input');
          if(newQueryInput){
            newQueryInput.value=currentQueryInput;
            newQueryInput.addEventListener('input',e=>{
              currentQueryInput=e.target.value;UIManager.hideError('pct-query-err');
              clearTimeout(debounceTimer);
              debounceTimer=setTimeout(()=>{if(currentPrimaryMode===AppConfig.QUERY_MODES.PLAN_CODE&&currentQueryInput.trim()){queryMode=currentPrimaryMode;queryInput=currentQueryInput;UIManager.closeModal();doQuery();}},500);
            });
          }
          dynamicContentArea.querySelectorAll('.pct-sub-option').forEach(option=>{
            if(currentSubOptions.includes(option.dataset.subOption))option.classList.add('selected');
            option.onclick=()=>{option.classList.toggle('selected');const optionValue=option.dataset.subOption,index=currentSubOptions.indexOf(optionValue);if(option.classList.contains('selected')){if(index===-1)currentSubOptions.push(optionValue);}else{if(index>-1)currentSubOptions.splice(index,1);}UIManager.hideError('pct-query-err');};
          });
          dynamicContentArea.querySelectorAll('.pct-channel-option').forEach(option=>{
            if(currentChannels.includes(option.dataset.channel))option.classList.add('selected');
            option.onclick=()=>{option.classList.toggle('selected');const channelValue=option.dataset.channel,index=currentChannels.indexOf(channelValue);if(option.classList.contains('selected')){if(index===-1)currentChannels.push(channelValue);}else{if(index>-1)currentChannels.splice(index,1);}UIManager.hideError('pct-query-err');};
          });
        };
        const updateModeCardUI=()=>{modeCards.forEach(card=>{card.classList.toggle('selected',card.dataset.mode===currentPrimaryMode);});};
        updateModeCardUI();updateDynamicContent();
        modeCards.forEach(card=>{card.onclick=()=>{currentPrimaryMode=card.dataset.mode;updateModeCardUI();currentQueryInput='';currentSubOptions=[];currentChannels=[];updateDynamicContent();};});
        clearSelectionBtn.onclick=()=>{currentPrimaryMode='';currentQueryInput='';currentSubOptions=[];currentChannels=[];updateModeCardUI();dynamicContentArea.innerHTML='';UIManager.showToast('已清除所有查詢條件','info');};
        queryOkBtn.onclick=()=>{
          let finalMode=currentPrimaryMode,finalInput=currentQueryInput,finalSubOptions=currentSubOptions,finalChannels=currentChannels;
          if(currentPrimaryMode==='masterDataCategory'){if(currentSubOptions.length===0||currentSubOptions.length>1){UIManager.showError('請選擇主檔查詢範圍 (現售/停售)','pct-query-err');return;}finalMode=currentSubOptions[0];}
          else if(currentPrimaryMode==='channelDataCategory'){if(currentSubOptions.length===0||currentSubOptions.length>1){UIManager.showError('請選擇通路銷售範圍 (現售/停售)','pct-query-err');return;}finalMode=currentSubOptions[0];}
          else if(!currentPrimaryMode){UIManager.showError('請選擇查詢模式','pct-query-err');return;}
          if([AppConfig.QUERY_MODES.PLAN_CODE,AppConfig.QUERY_MODES.PLAN_NAME].includes(finalMode)&&!finalInput){UIManager.showError('請輸入查詢內容','pct-query-err');return;}
          queryMode=finalMode;queryInput=finalInput;querySubOption=finalSubOptions;queryChannels=finalChannels;pageNo=1;filterSpecial=false;detailQueryCount=0;
          UIManager.closeModal();doQuery();
        };
        queryCancelBtn.onclick=async()=>{await UIManager.closeModal();};
        if(queryMode){
          const modeToSelect=primaryQueryModes.find(pm=>{if(pm===queryMode)return true;if(pm==='masterDataCategory'&&[AppConfig.QUERY_MODES.MASTER_IN_SALE,AppConfig.QUERY_MODES.MASTER_STOPPED].includes(queryMode))return true;if(pm==='channelDataCategory'&&[AppConfig.QUERY_MODES.CHANNEL_IN_SALE,AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode))return true;return false;});
          if(modeToSelect){currentPrimaryMode=modeToSelect;updateModeCardUI();updateDynamicContent();if(modeToSelect==='masterDataCategory'||modeToSelect==='channelDataCategory'){const subOptionElement=dynamicContentArea.querySelector(`[data-sub-option="${queryMode}"]`);if(subOptionElement)subOptionElement.classList.add('selected');}if(modeToSelect==='channelDataCategory'&&queryChannels.length>0){queryChannels.forEach(ch=>{const channelElement=dynamicContentArea.querySelector(`[data-channel="${ch}"]`);if(channelElement)channelElement.classList.add('selected');});}}
        }
      }
    });
  }
  function modeLabel(mode){
    switch(mode){
      case AppConfig.QUERY_MODES.PLAN_CODE: return'商品代號';
      case AppConfig.QUERY_MODES.PLAN_NAME: return'商品名稱關鍵字';
      case AppConfig.QUERY_MODES.ALL_MASTER_PLANS: return'查詢全部主檔';
      case 'masterDataCategory': return'主檔資料';
      case 'channelDataCategory': return'通路資料';
      case AppConfig.QUERY_MODES.MASTER_IN_SALE: return'主檔現售';
      case AppConfig.QUERY_MODES.MASTER_STOPPED: return'主檔停售';
      case AppConfig.QUERY_MODES.CHANNEL_IN_SALE: return'通路現售';
      case AppConfig.QUERY_MODES.CHANNEL_STOPPED: return'通路停售';
      default: return mode;
    }
  }
  async function doQuery(){
    UIManager.showToast('查詢中...','info');DataProcessor.resetData();allProcessedData=[];totalRecords=0;
    let rawRecords=[],currentTotalRecords=0;
    const pageSize=AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER;
    try{
      if([AppConfig.QUERY_MODES.PLAN_CODE,AppConfig.QUERY_MODES.PLAN_NAME,AppConfig.QUERY_MODES.ALL_MASTER_PLANS,AppConfig.QUERY_MODES.MASTER_IN_SALE].includes(queryMode)){
        if(queryMode===AppConfig.QUERY_MODES.PLAN_CODE&&queryInput.includes(',')){
          const planCodes=Utils.splitInput(queryInput);
          UIManager.showToast(`查詢 ${planCodes.length} 個商品代號中...`,'info',3000);
          const multiQueryResult=await queryMultiplePlanCodes(planCodes);
          rawRecords=multiQueryResult.records;currentTotalRecords=multiQueryResult.totalRecords;
        }else{
          const params=buildMasterQueryParams(queryMode,queryInput,1,pageSize);
          const result=await APIService.callApi(`${apiBase}/planCodeController/query`,params);
          rawRecords=result.records||[];currentTotalRecords=result.totalRecords||0;
        }
      }else if(queryMode===AppConfig.QUERY_MODES.MASTER_STOPPED){
        const params=buildMasterQueryParams(AppConfig.QUERY_MODES.ALL_MASTER_PLANS,'',1,pageSize);
        const result=await APIService.callApi(`${apiBase}/planCodeController/query`,params);
        rawRecords=(result.records||[]).filter(item=>Utils.getSaleStatus(Utils.formatToday(),item.saleStartDate,item.saleEndDate)===AppConfig.SALE_STATUS.STOPPED);
        currentTotalRecords=rawRecords.length;
      }else if([AppConfig.QUERY_MODES.CHANNEL_IN_SALE,AppConfig.QUERY_MODES.CHANNEL_STOPPED].includes(queryMode)){
        const channelsToQuery=queryChannels.length>0?queryChannels:AppConfig.FIELD_MAPS.CHANNELS;
        let allChannelRecords=[];
        for(const channel of channelsToQuery){
          const baseParams={"channel":channel,"saleEndDate":(queryMode===AppConfig.QUERY_MODES.CHANNEL_IN_SALE)?"9999-12-31 00:00:00":"","pageIndex":1,"size":AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,"orderBys":["planCode asc"]};
          const result=await APIService.callApi(`${apiBase}/planCodeSaleDateController/query`,baseParams);
          let channelRecords=result.planCodeSaleDates?.records||[];
          if(queryMode===AppConfig.QUERY_MODES.CHANNEL_STOPPED){channelRecords=channelRecords.filter(item=>Utils.getSaleStatus(Utils.formatToday(),item.saleStartDate,item.saleEndDate)===AppConfig.SALE_STATUS.STOPPED);}
          channelRecords.forEach(r=>r._sourceChannel=channel);allChannelRecords.push(...channelRecords);
        }
        const uniqueChannelRecords=[],seenChannelEntries=new Set();
        for(const record of allChannelRecords){
          const identifier=record.planCode+(record._sourceChannel||'');
          if(!seenChannelEntries.has(identifier)){seenChannelEntries.add(identifier);uniqueChannelRecords.push(record);}
        }
        rawRecords=uniqueChannelRecords;currentTotalRecords=uniqueChannelRecords.length;
      }else{throw new Error('未知的查詢模式或條件不完整');}
      totalRecords=currentTotalRecords;
      allProcessedData=await DataProcessor.processAllDataForTable(rawRecords,apiBase,false);
      if(sortKey){allProcessedData=DataProcessor.sortData(allProcessedData,sortKey,sortAsc);}
      renderTable();
      UIManager.showToast(`查詢完成，共 ${allProcessedData.length} 筆資料`,'success');
    }catch(e){UIManager.showToast(`查詢 API 失敗：${e.message}`,'error');allProcessedData=[];totalRecords=0;renderTable();}
  }
  function buildMasterQueryParams(mode,input,pageNo,pageSize){
    const params={currentPage:pageNo,pageSize};
    switch(mode){
      case AppConfig.QUERY_MODES.PLAN_CODE:params.planCode=input;break;
      case AppConfig.QUERY_MODES.PLAN_NAME:params.planCodeName=input;break;
      case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:params.planCodeName='';break;
      case AppConfig.QUERY_MODES.MASTER_IN_SALE:params.saleEndDate='9999-12-31 00:00:00';break;
      default:throw new Error('無效的主檔查詢模式');
    }
    return params;
  }
  async function queryMultiplePlanCodes(planCodes){
    const allRecords=[];
    for(let i=0;i<planCodes.length;i++){
      const planCode=planCodes[i];
      try{
        UIManager.showToast(`查詢商品代號 ${planCode} (${i+1}/${planCodes.length})...`,'info',1000);
        const params={planCode,currentPage:1,pageSize:AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL};
        const result=await APIService.callApi(`${apiBase}/planCodeController/query`,params);
        if(result.records&&result.records.length>0){result.records.forEach(record=>record._querySourcePlanCode=planCode);allRecords.push(...result.records);}
        else{allRecords.push({planCode:planCode,_apiStatus:'查無資料',_isErrorRow:true});}
      }catch(error){UIManager.showToast(`查詢 ${planCode} 失敗: ${error.message}`,'error',3000);allRecords.push({planCode:planCode,_apiStatus:'查詢失敗',_isErrorRow:true});}
    }
    return {records:allRecords,totalRecords:allRecords.length};
  }
  async function querySinglePlanCode(planCode){
    try{
      UIManager.showToast(`重新查詢 ${planCode}...`,'info');
      const params={planCode,currentPage:1,pageSize:AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DETAIL};
      const result=await APIService.callApi(`${apiBase}/planCodeController/query`,params);
      if(result.records&&result.records.length>0){
        const processed=await DataProcessor.processAllDataForTable(result.records,apiBase,false);
        // 取代原本 error row
        const idx=allProcessedData.findIndex(r=>r.planCode===planCode&&r._isErrorRow);
        if(idx>-1){allProcessedData.splice(idx,1,...processed);}
        else{allProcessedData.push(...processed);}
        renderTable();
        UIManager.showToast(`${planCode} 查詢成功`,'success');
      }else{
        UIManager.showToast(`${planCode} 查無資料`,'warning');
      }
    }catch(error){
      UIManager.showToast(`${planCode} 查詢失敗: ${error.message}`,'error');
    }
  }
  async function handleDetailQuery(){
    detailQueryCount++;
    if(detailQueryCount===1){UIManager.showToast('第一次查詢詳細資料，僅補齊尚未載入的數據...','info',3000);await updateAllDetailsAndRefreshTable(false);}
    else{
      const confirmReset=confirm('您已點擊過「一鍵查詢全部詳細」。再次點擊將清空所有快取並重新查詢所有數據，這可能需要一些時間。您確定要繼續嗎？');
      if(confirmReset){UIManager.showToast('清空快取並重新查詢所有詳細資料中...','info',3000);await updateAllDetailsAndRefreshTable(true);}
      else{UIManager.showToast('已取消操作。','info');}
    }
  }
  async function updateAllDetailsAndRefreshTable(forceFetch=false){
    const rawData=DataProcessor.getRawData();
    if(rawData.length===0&&!forceFetch){UIManager.showToast('沒有原始數據可供查詢詳細資訊','warning');return;}
    allProcessedData=await DataProcessor.processAllDataForTable(rawData,apiBase,forceFetch);
    if(allProcessedData.length>0){
      if(sortKey){allProcessedData=DataProcessor.sortData(allProcessedData,sortKey,sortAsc);}
      renderTable();UIManager.showToast('詳細資料查詢完成','success');
    }else{renderTable();UIManager.showToast('詳細查詢完成，但沒有可更新詳情的資料','warning');}
  }
  function renderTable(){
    let displayedData=filterSpecial?allProcessedData.filter(r=>r.special):allProcessedData;
    const totalPages=Math.ceil(displayedData.length/pageSize),startIndex=(pageNo-1)*pageSize,endIndex=startIndex+pageSize,pageData=displayedData.slice(startIndex,endIndex),hasPrev=pageNo>1,hasNext=pageNo<totalPages,hasSpecialData=allProcessedData.some(r=>r.special);
    UIManager.showModal({
      title:`查詢結果（${envLabel()}）`,
      body:renderSummary(displayedData,hasSpecialData)+renderTableHTML(pageData),
      footer:`<button class="pct-btn pct-btn-secondary" id="pct-table-prev" ${!hasPrev?'disabled':''}>上一頁</button><button class="pct-btn pct-btn-secondary" id="pct-table-next" ${!hasNext?'disabled':''}>下一頁</button><div class="pct-pagination-info">第 ${pageNo} 頁 / 共 ${totalPages} 頁 (總計 ${displayedData.length} 筆)</div><div style="flex-grow:1;"></div><button class="pct-btn pct-btn-info" id="pct-table-detail">一鍵查詢全部詳細</button><button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button>${hasSpecialData?`<button class="pct-btn ${filterSpecial?'pct-filter-btn-active':'pct-filter-btn'}" id="pct-table-filter">${filterSpecial?'顯示全部':'篩選特殊狀態'}</button>`:''}<button class="pct-btn" id="pct-table-requery">重新查詢</button><button class="pct-btn pct-btn-secondary" id="pct-table-close">關閉</button>`,
      onOpen:(modalElement)=>{
        modalElement.querySelector('#pct-table-detail').onclick=()=>{handleDetailQuery();};
        modalElement.querySelector('#pct-table-copy').onclick=()=>{Utils.copyTextToClipboard(renderTableText(displayedData),UIManager.showToast);};
        modalElement.querySelector('#pct-table-prev').onclick=()=>{if(pageNo>1){pageNo--;renderTable();}};
        modalElement.querySelector('#pct-table-next').onclick=()=>{if(pageNo<totalPages){pageNo++;renderTable();}};
        const filterBtn=modalElement.querySelector('#pct-table-filter');
        if(filterBtn){filterBtn.onclick=()=>{filterSpecial=!filterSpecial;pageNo=1;renderTable();};}
        modalElement.querySelector('#pct-table-requery').onclick=async()=>{await UIManager.closeModal();showQueryDialog();};
        modalElement.querySelector('#pct-table-close').onclick=()=>{UIManager.closeModal();};
        modalElement.querySelectorAll('.pct-table th').forEach(th=>{th.onclick=()=>{const key=th.dataset.key;if(!key)return;if(sortKey===key){sortAsc=!sortAsc;}else{sortKey=key;sortAsc=true;}allProcessedData=DataProcessor.sortData(allProcessedData,sortKey,sortAsc);pageNo=1;renderTable();};});
        modalElement.querySelectorAll('.pct-btn-retry').forEach(btn=>{
          btn.onclick=async()=>{const planCode=btn.getAttribute('data-plan');await querySinglePlanCode(planCode);}
        });
        modalElement.querySelectorAll('.pct-td-copy').forEach(td=>{
          td.onclick=()=>{Utils.copyTextToClipboard(td.getAttribute('data-raw'),UIManager.showToast);}
        });
      }
    });
  }
  function renderSummary(data,hasSpecialData){
    const specialCount=data.filter(r=>r.special).length;
    let html=`<div class="pct-summary">共 ${data.length} 筆`;
    if(hasSpecialData){html+=`，其中特殊狀態: <b style="color:var(--warning-color);">${specialCount}</b> 筆`;}
    html+=`</div>`;return html;
  }
  function renderTableHTML(data){
    if(!data||data.length===0){return`<div class="pct-table-wrap" style="height:150px; display:flex; align-items:center; justify-content:center; color:var(--text-color-light);">查無資料</div>`;}
    let html=`<div class="pct-table-wrap"><table class="pct-table"><thead><tr><th data-key="no">No</th><th data-key="planCode">代號</th><th data-key="shortName">商品名稱</th><th data-key="currency">幣別</th><th data-key="unit">單位</th><th data-key="coverageType">類型</th><th data-key="saleStartDate">銷售起日</th><th data-key="saleEndDate">銷售迄日</th><th data-key="mainStatus">主約狀態</th><th data-key="polpln">POLPLN</th><th>通路資訊</th></tr></thead><tbody>`;
    data.forEach(row=>{
      if(row._isErrorRow){
        html+=`<tr class="error-row"><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.planCode)}">${row.no}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.planCode)}">${Utils.escapeHtml(row.planCode)}</td><td colspan="8" style="color:#d9534f;">${row.saleEndDate}<button class="pct-btn pct-btn-info pct-btn-retry" data-plan="${Utils.escapeHtml(row.planCode)}">重新查詢</button></td><td></td></tr>`;
        return;
      }
      const esc=row;
      const channelHtml=(row.channels||[]).map(c=>{
        const statusClass=c.status===AppConfig.SALE_STATUS.CURRENT?'pct-status-onsale':(c.status===AppConfig.SALE_STATUS.STOPPED?'pct-status-offsale':(c.status===AppConfig.SALE_STATUS.ABNORMAL?'pct-status-abnormal':'pct-status-pending'));
        return`<span class="${statusClass}">${Utils.escapeHtml(c.channel)}:${Utils.escapeHtml(c.saleEndDate)}（${Utils.escapeHtml(c.status)}）</span>`;
      }).join('<br>');
      html+=`<tr${row.special?' class="special-row"':''}><td class="pct-td-copy" data-raw="${row.no}">${row.no}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.planCode)}">${Utils.escapeHtml(row.planCode)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.shortName)}">${Utils.escapeHtml(row.shortName)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.currency)}">${Utils.escapeHtml(row.currency)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.unit)}">${Utils.escapeHtml(row.unit)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.coverageType)}">${Utils.escapeHtml(row.coverageType)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.saleStartDate)}">${Utils.escapeHtml(row.saleStartDate)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.saleEndDate)}">${Utils.escapeHtml(row.saleEndDate)}</td><td class="pct-td-copy ${row.mainStatus===AppConfig.SALE_STATUS.CURRENT?'pct-status-onsale':row.mainStatus===AppConfig.SALE_STATUS.STOPPED?'pct-status-offsale':(row.mainStatus===AppConfig.SALE_STATUS.ABNORMAL?'pct-status-abnormal':'pct-status-pending')}" data-raw="${Utils.escapeHtml(row.mainStatus)}">${Utils.escapeHtml(row.mainStatus)}</td><td class="pct-td-copy" data-raw="${Utils.escapeHtml(row.polpln||'')}">${Utils.escapeHtml(row.polpln||'')}</td><td>${channelHtml}</td></tr>`;
    });
    html+=`</tbody></table></div>`;return html;
  }
  function renderTableText(data){
    let txt=`No\t代號\t商品名稱\t幣別\t單位\t類型\t銷售起日\t銷售迄日\t主約狀態\tPOLPLN\t通路資訊\n`;
    data.forEach(row=>{
      let channelStr=(row.channels||[]).map(c=>`${c.channel}:${c.saleEndDate}（${c.status}）`).join(' / ');
      txt+=`${row.no}\t${row.planCode}\t${row.shortName}\t${row.currency}\t${row.unit}\t${row.coverageType}\t${row.saleStartDate}\t${row.saleEndDate}\t${row.mainStatus}\t${row.polpln}\t${channelStr}\n`;
    });
    return txt;
  }
  return {start,querySinglePlanCode};
})();

// ========== 啟動 ==========
AppCore.start();
})();
