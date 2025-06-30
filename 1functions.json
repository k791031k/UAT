[
  {
    "id": "清除快取工具",
    "description": "清除瀏覽器快取、Cookie、localStorage 等",
    "category": "系統工具",
    "type": "utility",
    "action_script": "javascript:(function(){let s={cookies:0,localStorage:0,sessionStorage:0,serviceWorkers:0},f=()=>{let e=document.createElement('div');e.style='position:fixed;top:20px;right:20px;padding:15px;background:#'+(s.fail?'ffebee':'e8f5e9')+';border:1px solid #'+(s.fail?'ef9a9a':'a5d6a7')+';border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);z-index:9999;max-width:300px;font-family:Arial;';e.innerHTML='<div style=\"margin-bottom:10px;font-weight:bold\">'+(s.fail?'清理完成！ (部分失敗)':'清理完成！')+'</div><div style=\"margin-bottom:8px\">✅ 成功：'+['Cookies','localStorage','sessionStorage','Service Workers'].filter(k=>s[k]).join(', ')+'</div>'+(s.fail?'<div style=\"color:#d32f2f;margin-bottom:8px\">❌ 失敗：'+s.fail+'</div>':'')+'<button style=\"padding:5px 10px;background:#2196f3;color:white;border:none;border-radius:3px;cursor:pointer;\"onclick=\"this.parentNode.remove()\">關閉</button>';document.body.appendChild(e);setTimeout(()=>e.remove(),3000);};try{document.cookie.split(';').forEach(c=>{let i=c.indexOf('='),n=i>-1?c.substr(0,i):c;document.cookie=n.trim()+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';});s.cookies=1;}catch(e){s.fail=(s.fail||'')+'Cookies ';}try{localStorage.clear();s.localStorage=1;}catch(e){s.fail=(s.fail||'')+'localStorage ';}try{sessionStorage.clear();s.sessionStorage=1;}catch(e){s.fail=(s.fail||'')+'sessionStorage ';}if('serviceWorker'in navigator&&navigator.serviceWorker.getRegistrations){navigator.serviceWorker.getRegistrations().then(r=>{r.forEach(w=>w.unregister());s.serviceWorkers=r.length>0?1:0;f();}).catch(e=>{s.fail=(s.fail||'')+'ServiceWorkers ';f();});}else{f();}})();"
  },
  {
    "id": "A17.06",
    "description": "A17.06 查詢工具",
    "category": "A17查詢",
    "type": "action",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/A17_06.js"
  },
  {
    "id": "New A17序號",
    "description": "批量查詢送金單號碼",
    "category": "A17查詢",
    "type": "utility",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/A17_NEW.js"
  },
  {
    "id": "A171.js",
    "description": "A17 報表工具 1",
    "category": "a17",
    "type": "action",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/A171.js"
  },
  {
    "id": "A172.js",
    "description": "A17 報表工具 2",
    "category": "a17",
    "type": "action",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/A172.js"
  },
  {
    "id": "EZC1.js",
    "description": "EZC 工具 1",
    "category": "ezc",
    "type": "utility",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/EZC1.js"
  },
  {
    "id": "EZC2.js",
    "description": "EZC 工具 2",
    "category": "ezc",
    "type": "utility",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/EZC2.js"
  },
  {
    "id": "EZC3.js",
    "description": "EZC 工具 3",
    "category": "ezc",
    "type": "utility",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/EZC3.js"
  },
  {
    "id": "P0.js",
    "description": "計畫工具 0",
    "category": "plan",
    "type": "action",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/P0.js"
  },
  {
    "id": "P1.js",
    "description": "計畫工具 1",	
    "category": "plan",
    "type": "action",
    "action_script": "external:https://cdn.jsdelivr.net/gh/k791031k/UAT/P1.js"
  }
]
