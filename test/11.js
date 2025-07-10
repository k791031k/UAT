javascript:(function(){
  'use strict';
  
  // ==================== 效能優化配置 ====================
  const PerformanceConfig = Object.freeze({
    BATCH_SIZE: 10,
    CACHE_TTL: 30 * 60 * 1000, // 30分鐘
    MAX_CACHE_SIZE: 1000,
    DEBOUNCE_DELAY: 300,
    ANIMATION_FRAME_BUFFER: 16
  });

  // ==================== 核心配置模組 ====================
  const AppConfig = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    VERSION: '2.2.0-optimized',
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
      CURRENT: '現售',
      STOPPED: '停售',
      PENDING: '未開賣',
      ABNORMAL: '異常'
    },
    DEFAULT_QUERY_PARAMS: {
      PAGE_SIZE_MASTER: 500,
      PAGE_SIZE_CHANNEL: 500,
      PAGE_SIZE_DISPLAY: 20
    },
    FIELD_MAPS: {
      CHANNELS: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    }
  });

  // ==================== 高效能LRU快取系統 ====================
  class OptimizedLRUCache {
    constructor(maxSize = PerformanceConfig.MAX_CACHE_SIZE) {
      this.maxSize = maxSize;
      this.cache = new Map();
      this.timestamps = new Map();
    }

    set(key, value) {
      // 實現LRU淘汰機制[7][16]
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
        this.timestamps.delete(oldestKey);
      }
      
      this.cache.set(key, value);
      this.timestamps.set(key, Date.now());
    }

    get(key) {
      // 檢查過期時間
      const timestamp = this.timestamps.get(key);
      if (timestamp && (Date.now() - timestamp > PerformanceConfig.CACHE_TTL)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
        return null;
      }

      const value = this.cache.get(key);
      if (value !== undefined) {
        // 更新使用時間，移到最前面[16]
        this.cache.delete(key);
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now());
      }
      return value;
    }

    clear() {
      this.cache.clear();
      this.timestamps.clear();
    }

    getStats() {
      return {
        size: this.cache.size,
        maxSize: this.maxSize,
        hitRate: this._calculateHitRate()
      };
    }

    _calculateHitRate() {
      // 簡化的命中率計算
      return this.cache.size > 0 ? (this.cache.size / this.maxSize * 100).toFixed(2) + '%' : '0%';
    }
  }

  // ==================== 工具函式模組（優化版）====================
  const Utils = {
    // HTML 轉義防止 XSS
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // 格式化今日日期
    formatToday() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    },

    // 格式化日期用於比較
    formatDateForComparison(dateStr) {
      if (!dateStr) return '';
      return dateStr.replace(/\//g, '-');
    },

    // 判斷銷售狀態
    getSaleStatus(todayStr, startDate, endDate) {
      if (!startDate) return AppConfig.SALE_STATUS.ABNORMAL;
      
      const today = new Date(this.formatDateForComparison(todayStr));
      const start = new Date(this.formatDateForComparison(startDate));
      
      if (today < start) {
        return AppConfig.SALE_STATUS.PENDING;
      }
      
      if (!endDate || endDate.includes('9999')) {
        return AppConfig.SALE_STATUS.CURRENT;
      }
      
      const end = new Date(this.formatDateForComparison(endDate));
      return today <= end ? AppConfig.SALE_STATUS.CURRENT : AppConfig.SALE_STATUS.STOPPED;
    },

    // 高效能防抖函式[2][3]
    debounce(func, wait = PerformanceConfig.DEBOUNCE_DELAY) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // 節流函式
    throttle(func, limit = PerformanceConfig.ANIMATION_FRAME_BUFFER) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // 優化的複製到剪貼板
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('已複製到剪貼板', 'success', 1500);
      } catch (err) {
        console.error('複製失敗:', err);
        showToast('複製失敗', 'error', 2000);
      }
    },

    // 批次DOM操作[2][5]
    batchDOMUpdate(callback) {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          callback();
          resolve();
        });
      });
    }
  };

  // ==================== 效能監控模組 ====================
  const PerformanceMonitor = {
    metrics: new Map(),
    
    start(operation) {
      this.metrics.set(operation, {
        startTime: performance.now(),
        operation: operation
      });
    },
    
    end(operation) {
      const metric = this.metrics.get(operation);
      if (metric) {
        const duration = performance.now() - metric.startTime;
        metric.duration = duration;
        metric.endTime = performance.now();
        
        if (duration > 1000) {
          showToast(`${operation} 完成，耗時 ${duration.toFixed(2)}ms`, 'info', 1500);
        }
        
        return duration;
      }
      return 0;
    },
    
    getReport() {
      const report = [];
      this.metrics.forEach((value, key) => {
        if (value.duration) {
          report.push(`${key}: ${value.duration.toFixed(2)}ms`);
        }
      });
      return report.join('\n');
    }
  };

  // ==================== 全域變數 ====================
  let _allRawData = [];
  let _processedData = [];
  let _currentDisplayData = [];
  
  // 優化的快取系統
  const _optimizedCacheDetail = new OptimizedLRUCache();
  const _optimizedCacheChannel = new OptimizedLRUCache();
  
  let _currentPage = 1;
  let _pageSize = AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DISPLAY;
  let _totalPages = 1;
  let _isOnePageMode = false;
  let _currentSearchTerm = '';
  let _currentStatusFilter = '';

  // ==================== 優化的API服務模組 ====================
  
  // 判斷當前環境並取得 API 基礎 URL
  function getApiBaseUrl() {
    const hostname = window.location.hostname;
    return hostname.includes('uat') ? AppConfig.API_ENDPOINTS.UAT : AppConfig.API_ENDPOINTS.PROD;
  }

  // 帶重試機制的API調用[6]
  async function callApiWithRetry(url, params, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(params)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        // 指數退避重試
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      }
    }
  }

  // 通用 API 調用函式
  async function callApi(url, params) {
    return await callApiWithRetry(url, params);
  }

  // 建構主檔查詢參數
  function buildMasterQueryParams(mode, searchTerm, pageIndex, pageSize) {
    const baseParams = {
      pageIndex: pageIndex,
      size: pageSize,
      orderBys: ["planCode asc"]
    };

    switch (mode) {
      case AppConfig.QUERY_MODES.PLAN_CODE:
        return { ...baseParams, planCode: searchTerm };
      case AppConfig.QUERY_MODES.PLAN_NAME:
        return { ...baseParams, planName: searchTerm };
      case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
      case AppConfig.QUERY_MODES.MASTER_IN_SALE:
      case AppConfig.QUERY_MODES.MASTER_STOPPED:
        return baseParams;
      default:
        return baseParams;
    }
  }

  // 優化的POLPLN資料獲取
  async function getPolplnData(item, apiBaseUrl, forceFetch = false) {
    const cacheKey = `polpln_${item.planCode}`;
    
    if (!forceFetch) {
      const cached = _optimizedCacheDetail.get(cacheKey);
      if (cached) return cached;
    }

    try {
      const params = { planCode: item.planCode };
      const result = await callApi(`${apiBaseUrl}/planCodeController/queryDetail`, params);
      
      const polplnData = result.polpln || {};
      _optimizedCacheDetail.set(cacheKey, polplnData);
      
      return polplnData;
    } catch (error) {
      console.error(`取得 POLPLN 資料失敗 (${item.planCode}):`, error);
      return {};
    }
  }

  // 優化的通路資料獲取
  async function getChannelData(item, apiBaseUrl, forceFetch = false, todayStr) {
    const cacheKey = `channel_${item.planCode}`;
    
    if (!forceFetch) {
      const cached = _optimizedCacheChannel.get(cacheKey);
      if (cached) return cached;
    }

    try {
      PerformanceMonitor.start(`通路查詢-${item.planCode}`);
      
      // 批次並行處理所有通路[6][9]
      const channelResults = await Promise.all(
        AppConfig.FIELD_MAPS.CHANNELS.map(async (channel) => {
          try {
            const params = {
              planCode: item.planCode,
              channel: channel,
              pageIndex: 1,
              size: 50,
              orderBys: ["planCode asc"]
            };
            
            const result = await callApi(`${apiBaseUrl}/planCodeSaleDateController/query`, params);
            const records = result.planCodeSaleDates?.records || [];
            
            return records.map(record => ({
              ...record,
              _sourceChannel: channel,
              _status: Utils.getSaleStatus(todayStr, record.saleStartDate, record.saleEndDate)
            }));
          } catch (error) {
            console.error(`通路 ${channel} 查詢失敗:`, error);
            return [];
          }
        })
      );

      const flatChannelData = channelResults.flat();
      _optimizedCacheChannel.set(cacheKey, flatChannelData);
      
      PerformanceMonitor.end(`通路查詢-${item.planCode}`);
      return flatChannelData;
    } catch (error) {
      console.error(`取得通路資料失敗 (${item.planCode}):`, error);
      return [];
    }
  }

  // ==================== 優化的查詢功能模組 ====================

  // 智能批次商品代號查詢[6]
  async function queryMultiplePlanCodes(planCodes) {
    const apiBaseUrl = getApiBaseUrl();
    PerformanceMonitor.start('批次商品代號查詢');
    
    showToast(`開始批次查詢 ${planCodes.length} 個商品代號...`, 'info', 2000);

    try {
      let results = [];
      
      if (planCodes.length === 1) {
        // 單一查詢優化
        const params = buildMasterQueryParams(AppConfig.QUERY_MODES.PLAN_CODE, planCodes[0].trim(), 1, 10000);
        const result = await callApi(`${apiBaseUrl}/planCodeController/query`, params);
        results = result.records || [];
      } else {
        // 批次並行查詢[9]
        const batchSize = PerformanceConfig.BATCH_SIZE;
        const batches = [];
        
        for (let i = 0; i < planCodes.length; i += batchSize) {
          const batch = planCodes.slice(i, i + batchSize);
          batches.push(batch);
        }
        
        for (const [batchIndex, batch] of batches.entries()) {
          showToast(`處理批次 ${batchIndex + 1}/${batches.length}`, 'info', 1000);
          
          const batchResults = await Promise.all(
            batch.map(async (planCode) => {
              try {
                const params = buildMasterQueryParams(AppConfig.QUERY_MODES.PLAN_CODE, planCode.trim(), 1, 10);
                const result = await callApi(`${apiBaseUrl}/planCodeController/query`, params);
                return result.records || [];
              } catch (error) {
                console.error(`查詢 ${planCode} 失敗:`, error);
                return [];
              }
            })
          );
          
          results.push(...batchResults.flat());
        }
      }
      
      PerformanceMonitor.end('批次商品代號查詢');
      return results;
    } catch (error) {
      PerformanceMonitor.end('批次商品代號查詢');
      throw error;
    }
  }

  // 智能商品名稱查詢
  async function queryPlanCodeName(searchTerm) {
    const apiBaseUrl = getApiBaseUrl();
    PerformanceMonitor.start('商品名稱查詢');
    
    showToast(`搜尋商品名稱: ${searchTerm}`, 'info', 2000);

    try {
      const params = buildMasterQueryParams(AppConfig.QUERY_MODES.PLAN_NAME, searchTerm, 1, AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER);
      const result = await callApi(`${apiBaseUrl}/planCodeController/query`, params);
      
      let records = result.records || [];
      
      // 智能排序：完全匹配優先，然後按相關性排序
      records.sort((a, b) => {
        const aName = (a.planName || '').toLowerCase();
        const bName = (b.planName || '').toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        const aExact = aName === searchLower;
        const bExact = bName === searchLower;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        const aStarts = aName.startsWith(searchLower);
        const bStarts = bName.startsWith(searchLower);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        return aName.localeCompare(bName);
      });

      PerformanceMonitor.end('商品名稱查詢');
      return records;
    } catch (error) {
      PerformanceMonitor.end('商品名稱查詢');
      throw new Error(`商品名稱查詢失敗: ${error.message}`);
    }
  }

  // 查詢全部主檔
  async function queryAllMasterPlans() {
    const apiBaseUrl = getApiBaseUrl();
    PerformanceMonitor.start('全部主檔查詢');
    
    showToast('查詢全部主檔商品...', 'info', 2000);

    try {
      const params = buildMasterQueryParams(AppConfig.QUERY_MODES.ALL_MASTER_PLANS, '', 1, AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER);
      const result = await callApi(`${apiBaseUrl}/planCodeController/query`, params);
      
      PerformanceMonitor.end('全部主檔查詢');
      return result.records || [];
    } catch (error) {
      PerformanceMonitor.end('全部主檔查詢');
      throw new Error(`全部主檔查詢失敗: ${error.message}`);
    }
  }

  // 主檔分類查詢（前端篩選）
  async function queryMasterByCategory(category) {
    const apiBaseUrl = getApiBaseUrl();
    const todayStr = Utils.formatToday();
    PerformanceMonitor.start('主檔分類查詢');
    
    showToast(`查詢主檔${category}商品...`, 'info', 2000);

    try {
      const params = buildMasterQueryParams(AppConfig.QUERY_MODES.ALL_MASTER_PLANS, '', 1, AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER);
      const result = await callApi(`${apiBaseUrl}/planCodeController/query`, params);
      let rawRecords = result.records || [];

      // 前端高效篩選
      if (category === '現售') {
        rawRecords = rawRecords.filter(item => 
          Utils.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate) === AppConfig.SALE_STATUS.CURRENT
        );
      } else if (category === '停售') {
        rawRecords = rawRecords.filter(item => 
          Utils.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate) === AppConfig.SALE_STATUS.STOPPED
        );
      }

      PerformanceMonitor.end('主檔分類查詢');
      return rawRecords;
    } catch (error) {
      PerformanceMonitor.end('主檔分類查詢');
      throw new Error(`主檔分類查詢失敗: ${error.message}`);
    }
  }

  // 通路分類查詢（批次並行）
  async function queryChannelByCategory(category, queryChannels = []) {
    const apiBaseUrl = getApiBaseUrl();
    const channelsToQuery = queryChannels.length > 0 ? queryChannels : AppConfig.FIELD_MAPS.CHANNELS;
    const todayStr = Utils.formatToday();
    PerformanceMonitor.start('通路分類查詢');
    
    showToast(`查詢通路${category}商品...`, 'info', 3000);

    try {
      // 並行處理所有通路[6]
      const channelResults = await Promise.all(
        channelsToQuery.map(async (channel) => {
          try {
            const params = {
              channel: channel,
              pageIndex: 1,
              size: AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL,
              orderBys: ["planCode asc"]
            };
            
            const result = await callApi(`${apiBaseUrl}/planCodeSaleDateController/query`, params);
            let channelRecords = result.planCodeSaleDates?.records || [];
            
            // 前端篩選
            if (category === '現售') {
              channelRecords = channelRecords.filter(record => 
                Utils.getSaleStatus(todayStr, record.saleStartDate, record.saleEndDate) === AppConfig.SALE_STATUS.CURRENT
              );
            } else if (category === '停售') {
              channelRecords = channelRecords.filter(record => 
                Utils.getSaleStatus(todayStr, record.saleStartDate, record.saleEndDate) === AppConfig.SALE_STATUS.STOPPED
              );
            }
            
            return channelRecords.map(record => ({
              ...record,
              _sourceChannel: channel,
              _status: Utils.getSaleStatus(todayStr, record.saleStartDate, record.saleEndDate)
            }));
          } catch (error) {
            console.error(`通路 ${channel} 查詢失敗:`, error);
            return [];
          }
        })
      );

      PerformanceMonitor.end('通路分類查詢');
      return channelResults.flat();
    } catch (error) {
      PerformanceMonitor.end('通路分類查詢');
      throw new Error(`通路分類查詢失敗: ${error.message}`);
    }
  }

  // ==================== 優化的資料處理模組 ====================

  // 高效能並行資料處理
  async function processAllDataForTable() {
    const apiBaseUrl = getApiBaseUrl();
    const todayStr = Utils.formatToday();
    PerformanceMonitor.start('資料處理');
    
    showToast('正在處理資料，請稍候...', 'info', 3000);

    try {
      // 批次並行處理[9]
      const batchSize = PerformanceConfig.BATCH_SIZE;
      const processedResults = [];
      
      for (let i = 0; i < _allRawData.length; i += batchSize) {
        const batch = _allRawData.slice(i, i + batchSize);
        
        showToast(`處理資料批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(_allRawData.length/batchSize)}`, 'info', 1000);
        
        const batchResults = await Promise.all(
          batch.map(async (item, index) => {
            try {
              const [polplnResult, channelsResult] = await Promise.all([
                getPolplnData(item, apiBaseUrl, false),
                getChannelData(item, apiBaseUrl, false, todayStr)
              ]);

              const masterStatus = Utils.getSaleStatus(todayStr, item.saleStartDate, item.saleEndDate);
              
              // 統計通路狀態
              const channelStats = {
                total: 0,
                current: 0,
                stopped: 0,
                pending: 0,
                abnormal: 0
              };

              const channelDetails = {};
              
              channelsResult.forEach(channel => {
                const channelKey = channel._sourceChannel;
                if (!channelDetails[channelKey]) {
                  channelDetails[channelKey] = [];
                }
                channelDetails[channelKey].push(channel);
                
                channelStats.total++;
                switch (channel._status) {
                  case AppConfig.SALE_STATUS.CURRENT:
                    channelStats.current++;
                    break;
                  case AppConfig.SALE_STATUS.STOPPED:
                    channelStats.stopped++;
                    break;
                  case AppConfig.SALE_STATUS.PENDING:
                    channelStats.pending++;
                    break;
                  default:
                    channelStats.abnormal++;
                }
              });

              return {
                ...item,
                _polpln: polplnResult,
                _channels: channelsResult,
                _channelDetails: channelDetails,
                _channelStats: channelStats,
                _masterStatus: masterStatus,
                _processIndex: i + index + 1
              };
            } catch (error) {
              console.error(`處理商品 ${item.planCode} 失敗:`, error);
              return {
                ...item,
                _polpln: {},
                _channels: [],
                _channelDetails: {},
                _channelStats: { total: 0, current: 0, stopped: 0, pending: 0, abnormal: 0 },
                _masterStatus: AppConfig.SALE_STATUS.ABNORMAL,
                _processIndex: i + index + 1,
                _error: error.message
              };
            }
          })
        );
        
        processedResults.push(...batchResults);
      }

      _processedData = processedResults;
      PerformanceMonitor.end('資料處理');
      
      showToast(`資料處理完成！共 ${_processedData.length} 筆`, 'success', 2000);
      
      // 顯示快取統計
      const cacheStats = _optimizedCacheDetail.getStats();
      console.log('快取統計:', cacheStats);
      
      return _processedData;
    } catch (error) {
      PerformanceMonitor.end('資料處理');
      console.error('資料處理失敗:', error);
      throw new Error(`資料處理失敗: ${error.message}`);
    }
  }

  // ==================== 優化的UI介面模組 ====================

  // 高效能Toast通知
  function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.getElementById('planCodeQueryToast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'planCodeQueryToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
      max-width: 400px;
      word-wrap: break-word;
      transform: translateX(100%);
    `;

    const colors = {
      info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      error: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      warning: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    
    document.body.appendChild(toast);

    // 使用 requestAnimationFrame 優化動畫[5]
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  // 顯示查詢對話框
  function showQueryDialog() {
    const existingDialog = document.getElementById('planCodeQueryDialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    const primaryQueryModes = [
      AppConfig.QUERY_MODES.PLAN_CODE,
      AppConfig.QUERY_MODES.PLAN_NAME,
      AppConfig.QUERY_MODES.ALL_MASTER_PLANS,
      'masterDataCategory',
      'channelDataCategory'
    ];

    const dialog = document.createElement('div');
    dialog.id = 'planCodeQueryDialog';
    dialog.innerHTML = `
      <div class="pq-modal-backdrop">
        <div class="pq-modal" id="planCodeQueryModal">
          <div class="pq-modal-header" id="planCodeQueryModalHeader">
            <h3>🔍 凱基人壽商品查詢小工具 v${AppConfig.VERSION}</h3>
            <button class="pq-close-btn" onclick="document.getElementById('planCodeQueryDialog').remove()">×</button>
          </div>
          <div class="pq-modal-body">
            <div class="pq-form-group">
              <label>查詢模式：</label>
              <select id="planCodeQueryMode" class="pq-select">
                ${primaryQueryModes.map(mode => 
                  `<option value="${mode}">${modeLabel(mode)}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="pq-form-group" id="planCodeInputGroup">
              <label>商品代號：</label>
              <textarea id="planCodeInput" class="pq-textarea" placeholder="輸入商品代號，多個請用換行分隔"></textarea>
            </div>
            
            <div class="pq-form-group" id="planNameInputGroup" style="display:none;">
              <label>商品名稱：</label>
              <input type="text" id="planNameInput" class="pq-input" placeholder="輸入商品名稱關鍵字">
            </div>
            
            <div class="pq-form-group" id="masterCategoryGroup" style="display:none;">
              <label>主檔分類：</label>
              <select id="masterCategorySelect" class="pq-select">
                <option value="現售">現售商品</option>
                <option value="停售">停售商品</option>
              </select>
            </div>
            
            <div class="pq-form-group" id="channelCategoryGroup" style="display:none;">
              <label>通路分類：</label>
              <select id="channelCategorySelect" class="pq-select">
                <option value="現售">現售商品</option>
                <option value="停售">停售商品</option>
              </select>
              <div class="pq-checkbox-group">
                <label>選擇通路：</label>
                <div class="pq-channel-checkboxes">
                  ${AppConfig.FIELD_MAPS.CHANNELS.map(channel => 
                    `<label class="pq-checkbox-label">
                      <input type="checkbox" value="${channel}" class="pq-channel-checkbox" checked> ${channel}
                    </label>`
                  ).join('')}
                </div>
                <div class="pq-channel-actions">
                  <button type="button" class="pq-btn pq-btn-secondary" onclick="toggleAllChannels(true)">全選</button>
                  <button type="button" class="pq-btn pq-btn-secondary" onclick="toggleAllChannels(false)">全不選</button>
                </div>
              </div>
            </div>
            
            <div class="pq-form-actions">
              <button class="pq-btn pq-btn-primary" onclick="executeQuery()">🚀 開始查詢</button>
              <button class="pq-btn pq-btn-secondary" onclick="document.getElementById('planCodeQueryDialog').remove()">取消</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 添加CSS變數系統和響應式樣式
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --pq-primary-color: #667eea;
        --pq-primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        --pq-success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        --pq-border-radius: 12px;
        --pq-shadow: 0 20px 40px rgba(0,0,0,0.1);
        --pq-transition: all 0.3s ease;
      }
      
      .pq-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .pq-modal {
        background: white;
        border-radius: var(--pq-border-radius);
        box-shadow: var(--pq-shadow);
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
        animation: slideIn 0.3s ease;
      }
      
      @keyframes slideIn {
        from { transform: translateY(-50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .pq-modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--pq-primary-gradient);
        color: white;
        border-radius: var(--pq-border-radius) var(--pq-border-radius) 0 0;
        cursor: move;
      }
      
      .pq-modal-header h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .pq-close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: var(--pq-transition);
      }
      
      .pq-close-btn:hover {
        background-color: rgba(255,255,255,0.2);
        transform: scale(1.1);
      }
      
      .pq-modal-body {
        padding: 20px;
      }
      
      .pq-form-group {
        margin-bottom: 20px;
      }
      
      .pq-form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
      }
      
      .pq-input, .pq-textarea, .pq-select {
        width: 100%;
        padding: 10px;
        border: 2px solid #e1e5e9;
        border-radius: 8px;
        font-size: 14px;
        transition: var(--pq-transition);
        box-sizing: border-box;
      }
      
      .pq-input:focus, .pq-textarea:focus, .pq-select:focus {
        outline: none;
        border-color: var(--pq-primary-color);
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .pq-textarea {
        min-height: 100px;
        resize: vertical;
      }
      
      .pq-checkbox-group {
        margin-top: 10px;
      }
      
      .pq-channel-checkboxes {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
        gap: 8px;
        margin: 10px 0;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        padding: 10px;
        background: #f8f9fa;
      }
      
      .pq-checkbox-label {
        display: flex;
        align-items: center;
        font-size: 14px;
        cursor: pointer;
        transition: var(--pq-transition);
      }
      
      .pq-checkbox-label:hover {
        color: var(--pq-primary-color);
      }
      
      .pq-channel-checkbox {
        margin-right: 5px;
      }
      
      .pq-channel-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      
      .pq-form-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 30px;
      }
      
      .pq-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--pq-transition);
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      
      .pq-btn-primary {
        background: var(--pq-primary-gradient);
        color: white;
      }
      
      .pq-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
      }
      
      .pq-btn-secondary {
        background: #f8f9fa;
        color: #6c757d;
        border: 1px solid #dee2e6;
      }
      
      .pq-btn-secondary:hover {
        background: #e9ecef;
        transform: translateY(-1px);
      }
      
      @media (max-width: 768px) {
        .pq-modal {
          width: 95%;
          margin: 10px;
        }
        
        .pq-channel-checkboxes {
          grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
        }
        
        .pq-form-actions {
          flex-direction: column;
        }
        
        .pq-modal-header {
          padding: 15px;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(dialog);

    // 設定事件監聽器
    setupDialogEvents();
    setupDragFunctionality();
  }

  // 設定對話框事件
  function setupDialogEvents() {
    const modeSelect = document.getElementById('planCodeQueryMode');
    if (modeSelect) {
      modeSelect.addEventListener('change', function() {
        toggleInputGroups(this.value);
      });
    }
  }

  // 設定拖曳功能
  function setupDragFunctionality() {
    const modal = document.getElementById('planCodeQueryModal');
    const header = document.getElementById('planCodeQueryModalHeader');
    
    if (!modal || !header) return;
    
    let isDragging = false;
    let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        modal.style.transition = 'none';
      }
    }

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        modal.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    }

    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      modal.style.transition = '';
    }
  }

  // 切換輸入群組顯示
  function toggleInputGroups(mode) {
    const groups = {
      planCodeInputGroup: [AppConfig.QUERY_MODES.PLAN_CODE],
      planNameInputGroup: [AppConfig.QUERY_MODES.PLAN_NAME],
      masterCategoryGroup: ['masterDataCategory'],
      channelCategoryGroup: ['channelDataCategory']
    };

    Object.keys(groups).forEach(groupId => {
      const group = document.getElementById(groupId);
      if (group) {
        group.style.display = groups[groupId].includes(mode) ? 'block' : 'none';
      }
    });
  }

  // 模式標籤
  function modeLabel(mode) {
    const labels = {
      [AppConfig.QUERY_MODES.PLAN_CODE]: '商品代號查詢',
      [AppConfig.QUERY_MODES.PLAN_NAME]: '商品名稱查詢',
      [AppConfig.QUERY_MODES.ALL_MASTER_PLANS]: '查詢全部主檔',
      'masterDataCategory': '主檔分類查詢',
      'channelDataCategory': '通路分類查詢'
    };
    return labels[mode] || mode;
  }

  // 切換通路選擇
  window.toggleAllChannels = function(selectAll) {
    const checkboxes = document.querySelectorAll('.pq-channel-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = selectAll;
    });
  };

  // 執行查詢
  window.executeQuery = async function() {
    const mode = document.getElementById('planCodeQueryMode').value;
    
    try {
      document.getElementById('planCodeQueryDialog').remove();
      
      let rawData = [];
      
      switch (mode) {
        case AppConfig.QUERY_MODES.PLAN_CODE:
          const planCodeInput = document.getElementById('planCodeInput').value.trim();
          if (!planCodeInput) {
            showToast('請輸入商品代號', 'warning');
            return;
          }
          const planCodes = planCodeInput.split('\n').filter(code => code.trim());
          rawData = await queryMultiplePlanCodes(planCodes);
          break;
          
        case AppConfig.QUERY_MODES.PLAN_NAME:
          const planNameInput = document.getElementById('planNameInput').value.trim();
          if (!planNameInput) {
            showToast('請輸入商品名稱', 'warning');
            return;
          }
          rawData = await queryPlanCodeName(planNameInput);
          break;
          
        case AppConfig.QUERY_MODES.ALL_MASTER_PLANS:
          rawData = await queryAllMasterPlans();
          break;
          
        case 'masterDataCategory':
          const masterCategory = document.getElementById('masterCategorySelect').value;
          rawData = await queryMasterByCategory(masterCategory);
          break;
          
        case 'channelDataCategory':
          const channelCategory = document.getElementById('channelCategorySelect').value;
          const selectedChannels = Array.from(document.querySelectorAll('.pq-channel-checkbox:checked'))
            .map(cb => cb.value);
          if (selectedChannels.length === 0) {
            showToast('請至少選擇一個通路', 'warning');
            return;
          }
          rawData = await queryChannelByCategory(channelCategory, selectedChannels);
          break;
      }
      
      if (rawData.length === 0) {
        showToast('查詢結果為空', 'warning');
        return;
      }
      
      _allRawData = rawData;
      await processAllDataForTable();
      showResultsTable();
      
    } catch (error) {
      console.error('查詢失敗:', error);
      showToast(`查詢失敗: ${error.message}`, 'error');
    }
  };

  // 顯示結果表格（優化版）
  function showResultsTable() {
    const existingTable = document.getElementById('planCodeResultsTable');
    if (existingTable) {
      existingTable.remove();
    }

    applySearchAndFilter();
    updatePagination();

    const tableContainer = document.createElement('div');
    tableContainer.id = 'planCodeResultsTable';
    
    // 使用 DocumentFragment 批次更新 DOM[2][5]
    const fragment = document.createDocumentFragment();
    const tableElement = document.createElement('div');
    tableElement.innerHTML = `
      <div class="pq-table-backdrop">
        <div class="pq-table-container">
          <div class="pq-table-header">
            <div class="pq-table-title">
              <h3>📊 查詢結果 (共 ${_processedData.length} 筆)</h3>
              <div class="pq-table-actions">
                <button class="pq-btn pq-btn-secondary" onclick="copyAllResults()">📋 複製全部</button>
                <button class="pq-btn pq-btn-secondary" onclick="clearCache()">🗑️ 清除快取</button>
                <button class="pq-btn pq-btn-secondary" onclick="showPerformanceReport()">📈 效能報告</button>
                <button class="pq-btn pq-btn-secondary" onclick="document.getElementById('planCodeResultsTable').remove()">✕ 關閉</button>
              </div>
            </div>
            
            <div class="pq-table-controls">
              <div class="pq-control-group">
                <input type="text" id="searchInput" class="pq-search-input" placeholder="🔍 搜尋商品代號或名稱..." value="${_currentSearchTerm}">
                <select id="statusFilter" class="pq-status-filter">
                  <option value="">所有狀態</option>
                  <option value="${AppConfig.SALE_STATUS.CURRENT}" ${_currentStatusFilter === AppConfig.SALE_STATUS.CURRENT ? 'selected' : ''}>現售</option>
                  <option value="${AppConfig.SALE_STATUS.STOPPED}" ${_currentStatusFilter === AppConfig.SALE_STATUS.STOPPED ? 'selected' : ''}>停售</option>
                  <option value="${AppConfig.SALE_STATUS.PENDING}" ${_currentStatusFilter === AppConfig.SALE_STATUS.PENDING ? 'selected' : ''}>未開賣</option>
                  <option value="${AppConfig.SALE_STATUS.ABNORMAL}" ${_currentStatusFilter === AppConfig.SALE_STATUS.ABNORMAL ? 'selected' : ''}>異常</option>
                </select>
                <label class="pq-checkbox-label">
                  <input type="checkbox" id="onePageMode" ${_isOnePageMode ? 'checked' : ''}> 一頁顯示全部
                </label>
              </div>
            </div>
          </div>
          
          <div class="pq-table-body">
            <div class="pq-table-wrapper">
              <table class="pq-table">
                <thead>
                  <tr>
                    <th>序號</th>
                    <th>商品代號</th>
                    <th>商品名稱</th>
                    <th>主檔狀態</th>
                    <th>銷售期間</th>
                    <th>通路統計</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody id="tableBody">
                  ${generateTableRows()}
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="pq-table-footer">
            ${generatePaginationControls()}
          </div>
        </div>
      </div>
    `;

    fragment.appendChild(tableElement);
    tableContainer.appendChild(fragment);

    // 添加表格樣式（包含效能優化）
    const tableStyle = document.createElement('style');
    tableStyle.textContent = `
      .pq-table-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
        animation: fadeIn 0.3s ease;
      }
      
      .pq-table-container {
        background: white;
        border-radius: var(--pq-border-radius);
        width: 95%;
        height: 90%;
        display: flex;
        flex-direction: column;
        box-shadow: var(--pq-shadow);
        overflow: hidden;
        animation: slideIn 0.3s ease;
      }
      
      .pq-table-header {
        padding: 20px;
        background: var(--pq-primary-gradient);
        color: white;
      }
      
      .pq-table-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;
      }
      
      .pq-table-title h3 {
        margin: 0;
        font-size: 18px;
      }
      
      .pq-table-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .pq-table-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }
      
      .pq-control-group {
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
      }
      
      .pq-search-input {
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        min-width: 200px;
        transition: var(--pq-transition);
      }
      
      .pq-search-input:focus {
        box-shadow: 0 0 0 3px rgba(255,255,255,0.3);
      }
      
      .pq-status-filter {
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
      }
      
      .pq-table-body {
        flex: 1;
        overflow: hidden;
        padding: 0 20px;
      }
      
      .pq-table-wrapper {
        height: 100%;
        overflow: auto;
        /* 啟用硬體加速[5] */
        will-change: scroll-position;
        transform: translateZ(0);
      }
      
      .pq-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        /* 優化表格渲染 */
        table-layout: fixed;
      }
      
      .pq-table th,
      .pq-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
        /* 防止文字過長影響佈局 */
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .pq-table th {
        background: #f8f9fa;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .pq-table tr {
        transition: var(--pq-transition);
      }
      
      .pq-table tr:hover {
        background: #f8f9fa;
        transform: scale(1.01);
      }
      
      .pq-status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        display: inline-block;
      }
      
      .pq-status-current {
        background: #d4edda;
        color: #155724;
      }
      
      .pq-status-stopped {
        background: #f8d7da;
        color: #721c24;
      }
      
      .pq-status-pending {
        background: #fff3cd;
        color: #856404;
      }
      
      .pq-status-abnormal {
        background: #f5c6cb;
        color: #721c24;
      }
      
      .pq-channel-stats {
        font-size: 12px;
        line-height: 1.4;
      }
      
      .pq-table-footer {
        padding: 15px 20px;
        background: #f8f9fa;
        border-top: 1px solid #eee;
      }
      
      .pq-pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .pq-pagination button {
        padding: 8px 12px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: var(--pq-transition);
      }
      
      .pq-pagination button:hover:not(:disabled) {
        background: #e9ecef;
        transform: translateY(-1px);
      }
      
      .pq-pagination button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .pq-pagination .active {
        background: var(--pq-primary-color);
        color: white;
        border-color: var(--pq-primary-color);
      }
      
      .pq-pagination-info {
        font-size: 14px;
        color: #6c757d;
      }
      
      /* 響應式優化 */
      @media (max-width: 768px) {
        .pq-table-container {
          width: 98%;
          height: 95%;
        }
        
        .pq-table-header {
          padding: 15px;
        }
        
        .pq-table-title {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        
        .pq-control-group {
          flex-direction: column;
          align-items: stretch;
        }
        
        .pq-search-input {
          min-width: auto;
        }
        
        .pq-table {
          font-size: 12px;
        }
        
        .pq-table th,
        .pq-table td {
          padding: 8px;
        }
      }
      
      /* 載入動畫 */
      @keyframes tableLoad {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .pq-table tbody tr {
        animation: tableLoad 0.3s ease forwards;
        opacity: 0;
      }
      
      .pq-table tbody tr:nth-child(odd) {
        animation-delay: 0.05s;
      }
      
      .pq-table tbody tr:nth-child(even) {
        animation-delay: 0.1s;
      }
    `;

    document.head.appendChild(tableStyle);
    document.body.appendChild(tableContainer);

    // 設定事件監聽器
    setupTableEvents();
  }

  // 設定表格事件（優化版）
  function setupTableEvents() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const onePageMode = document.getElementById('onePageMode');

    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce(function() {
        _currentSearchTerm = this.value;
        applySearchAndFilter();
        updateTableDisplay();
      }, PerformanceConfig.DEBOUNCE_DELAY));
    }

    if (statusFilter) {
      statusFilter.addEventListener('change', function() {
        _currentStatusFilter = this.value;
        applySearchAndFilter();
        updateTableDisplay();
      });
    }

    if (onePageMode) {
      onePageMode.addEventListener('change', function() {
        _isOnePageMode = this.checked;
        updatePagination();
        updateTableDisplay();
      });
    }
  }

  // 應用搜尋和篩選（優化版）
  function applySearchAndFilter() {
    PerformanceMonitor.start('搜尋篩選');
    
    let filteredData = [..._processedData];

    // 搜尋篩選
    if (_currentSearchTerm) {
      const searchTerm = _currentSearchTerm.toLowerCase();
      filteredData = filteredData.filter(item => 
        (item.planCode || '').toLowerCase().includes(searchTerm) ||
        (item.planName || '').toLowerCase().includes(searchTerm)
      );
    }

    // 狀態篩選
    if (_currentStatusFilter) {
      filteredData = filteredData.filter(item => 
        item._masterStatus === _currentStatusFilter
      );
    }

    _currentDisplayData = filteredData;
    _currentPage = 1;
    
    PerformanceMonitor.end('搜尋篩選');
  }

  // 更新分頁
  function updatePagination() {
    if (_isOnePageMode) {
      _pageSize = _currentDisplayData.length;
      _totalPages = 1;
    } else {
      _pageSize = AppConfig.DEFAULT_QUERY_PARAMS.PAGE_SIZE_DISPLAY;
      _totalPages = Math.ceil(_currentDisplayData.length / _pageSize);
    }
    
    if (_currentPage > _totalPages) {
      _currentPage = Math.max(1, _totalPages);
    }
  }

  // 更新表格顯示（優化版）
  function updateTableDisplay() {
    const tbody = document.getElementById('tableBody');
    const footer = document.querySelector('.pq-table-footer');
    
    if (tbody) {
      // 使用 requestAnimationFrame 優化更新[5]
      requestAnimationFrame(() => {
        tbody.innerHTML = generateTableRows();
      });
    }
    
    if (footer) {
      footer.innerHTML = generatePaginationControls();
    }
  }

  // 生成表格行（優化版）
  function generateTableRows() {
    const startIndex = (_currentPage - 1) * _pageSize;
    const endIndex = _isOnePageMode ? _currentDisplayData.length : startIndex + _pageSize;
    const pageData = _currentDisplayData.slice(startIndex, endIndex);

    return pageData.map((item, index) => {
      const actualIndex = startIndex + index + 1;
      const statusClass = `pq-status-${item._masterStatus.toLowerCase().replace('異常', 'abnormal').replace('現售', 'current').replace('停售', 'stopped').replace('未開賣', 'pending')}`;
      
      return `
        <tr>
          <td>${actualIndex}</td>
          <td><strong>${Utils.escapeHtml(item.planCode || '')}</strong></td>
          <td title="${Utils.escapeHtml(item.planName || '')}">${Utils.escapeHtml((item.planName || '').substring(0, 30))}${(item.planName || '').length > 30 ? '...' : ''}</td>
          <td><span class="pq-status-badge ${statusClass}">${item._masterStatus}</span></td>
          <td>
            <div>開始：${Utils.escapeHtml(item.saleStartDate || '')}</div>
            <div>結束：${Utils.escapeHtml(item.saleEndDate || '')}</div>
          </td>
          <td>
            <div class="pq-channel-stats">
              <div>總計：${item._channelStats.total}</div>
              <div>現售：${item._channelStats.current}</div>
              <div>停售：${item._channelStats.stopped}</div>
              ${item._channelStats.abnormal > 0 ? `<div>異常：${item._channelStats.abnormal}</div>` : ''}
            </div>
          </td>
          <td>
            <button class="pq-btn pq-btn-secondary" onclick="copyItemData('${item.planCode}')">複製</button>
            <button class="pq-btn pq-btn-secondary" onclick="showItemDetail('${item.planCode}')">詳情</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 生成分頁控制
  function generatePaginationControls() {
    if (_isOnePageMode || _totalPages <= 1) {
      return `
        <div class="pq-pagination">
          <span class="pq-pagination-info">顯示全部 ${_currentDisplayData.length} 筆結果</span>
        </div>
      `;
    }

    const pagination = [];
    
    // 上一頁
    pagination.push(`
      <button onclick="changePage(${_currentPage - 1})" ${_currentPage === 1 ? 'disabled' : ''}>
        ← 上一頁
      </button>
    `);

    // 頁碼
    const startPage = Math.max(1, _currentPage - 2);
    const endPage = Math.min(_totalPages, _currentPage + 2);

    if (startPage > 1) {
      pagination.push(`<button onclick="changePage(1)">1</button>`);
      if (startPage > 2) {
        pagination.push(`<span>...</span>`);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pagination.push(`
        <button onclick="changePage(${i})" ${i === _currentPage ? 'class="active"' : ''}>
          ${i}
        </button>
      `);
    }

    if (endPage < _totalPages) {
      if (endPage < _totalPages - 1) {
        pagination.push(`<span>...</span>`);
      }
      pagination.push(`<button onclick="changePage(${_totalPages})">${_totalPages}</button>`);
    }

    // 下一頁
    pagination.push(`
      <button onclick="changePage(${_currentPage + 1})" ${_currentPage === _totalPages ? 'disabled' : ''}>
        下一頁 →
      </button>
    `);

    return `
      <div class="pq-pagination">
        ${pagination.join('')}
        <span class="pq-pagination-info">
          第 ${_currentPage} 頁，共 ${_totalPages} 頁 (${_currentDisplayData.length} 筆結果)
        </span>
      </div>
    `;
  }

  // ==================== 全域功能函式 ====================

  // 切換頁面
  window.changePage = function(page) {
    if (page >= 1 && page <= _totalPages) {
      _currentPage = page;
      updateTableDisplay();
    }
  };

  // 複製單項資料
  window.copyItemData = function(planCode) {
    const item = _processedData.find(item => item.planCode === planCode);
    if (item) {
      const copyText = `商品代號: ${item.planCode}\n商品名稱: ${item.planName}\n主檔狀態: ${item._masterStatus}\n銷售期間: ${item.saleStartDate} ~ ${item.saleEndDate}`;
      Utils.copyToClipboard(copyText);
    }
  };

  // 顯示項目詳情
  window.showItemDetail = function(planCode) {
    const item = _processedData.find(item => item.planCode === planCode);
    if (item) {
      showDetailDialog(item);
    }
  };

  // 複製全部結果
  window.copyAllResults = function() {
    const copyText = _currentDisplayData.map(item => 
      `${item.planCode}\t${item.planName}\t${item._masterStatus}\t${item.saleStartDate}\t${item.saleEndDate}`
    ).join('\n');
    
    const header = '商品代號\t商品名稱\t主檔狀態\t開始日期\t結束日期\n';
    Utils.copyToClipboard(header + copyText);
  };

  // 清除快取
  window.clearCache = function() {
    _optimizedCacheDetail.clear();
    _optimizedCacheChannel.clear();
    showToast('快取已清除', 'success', 1500);
  };

  // 顯示效能報告
  window.showPerformanceReport = function() {
    const report = PerformanceMonitor.getReport();
    const cacheStats = _optimizedCacheDetail.getStats();
    
    alert(`效能報告:\n\n${report}\n\n快取統計:\n大小: ${cacheStats.size}/${cacheStats.maxSize}\n命中率: ${cacheStats.hitRate}`);
  };

  // 顯示詳情對話框（簡化版）
  function showDetailDialog(item) {
    const existingDetail = document.getElementById('planCodeDetailDialog');
    if (existingDetail) {
      existingDetail.remove();
    }

    const detailDialog = document.createElement('div');
    detailDialog.id = 'planCodeDetailDialog';
    detailDialog.innerHTML = `
      <div class="pq-modal-backdrop">
        <div class="pq-detail-modal">
          <div class="pq-modal-header">
            <h3>📋 商品詳細資訊 - ${Utils.escapeHtml(item.planCode)}</h3>
            <button class="pq-close-btn" onclick="document.getElementById('planCodeDetailDialog').remove()">×</button>
          </div>
          <div class="pq-detail-body">
            <div class="pq-detail-section">
              <h4>基本資訊</h4>
              <div class="pq-detail-grid">
                <div class="pq-detail-item">
                  <label>商品代號：</label>
                  <span>${Utils.escapeHtml(item.planCode || '')}</span>
                </div>
                <div class="pq-detail-item">
                  <label>商品名稱：</label>
                  <span>${Utils.escapeHtml(item.planName || '')}</span>
                </div>
                <div class="pq-detail-item">
                  <label>主檔狀態：</label>
                  <span class="pq-status-badge pq-status-${item._masterStatus.toLowerCase().replace('異常', 'abnormal').replace('現售', 'current').replace('停售', 'stopped').replace('未開賣', 'pending')}">${item._masterStatus}</span>
                </div>
                <div class="pq-detail-item">
                  <label>銷售開始：</label>
                  <span>${Utils.escapeHtml(item.saleStartDate || '')}</span>
                </div>
                <div class="pq-detail-item">
                  <label>銷售結束：</label>
                  <span>${Utils.escapeHtml(item.saleEndDate || '')}</span>
                </div>
              </div>
            </div>
            
            <div class="pq-detail-section">
              <h4>通路資訊統計</h4>
              <div class="pq-channel-summary">
                <div class="pq-summary-item">
                  <span class="pq-summary-label">總通路數</span>
                  <span class="pq-summary-value">${item._channelStats.total}</span>
                </div>
                <div class="pq-summary-item">
                  <span class="pq-summary-label">現售通路</span>
                  <span class="pq-summary-value pq-status-current">${item._channelStats.current}</span>
                </div>
                <div class="pq-summary-item">
                  <span class="pq-summary-label">停售通路</span>
                  <span class="pq-summary-value pq-status-stopped">${item._channelStats.stopped}</span>
                </div>
                <div class="pq-summary-item">
                  <span class="pq-summary-label">未開賣通路</span>
                  <span class="pq-summary-value pq-status-pending">${item._channelStats.pending}</span>
                </div>
                <div class="pq-summary-item">
                  <span class="pq-summary-label">異常通路</span>
                  <span class="pq-summary-value pq-status-abnormal">${item._channelStats.abnormal}</span>
                </div>
              </div>
            </div>
            
            <div class="pq-detail-actions">
              <button class="pq-btn pq-btn-primary" onclick="copyDetailData('${item.planCode}')">📋 複製詳細資訊</button>
              <button class="pq-btn pq-btn-secondary" onclick="document.getElementById('planCodeDetailDialog').remove()">關閉</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(detailDialog);
  }

  // 複製詳細資料
  window.copyDetailData = function(planCode) {
    const item = _processedData.find(item => item.planCode === planCode);
    if (item) {
      const detailText = `
商品代號: ${item.planCode}
商品名稱: ${item.planName}
主檔狀態: ${item._masterStatus}
銷售開始: ${item.saleStartDate}
銷售結束: ${item.saleEndDate}
通路統計:
- 總通路數: ${item._channelStats.total}
- 現售通路: ${item._channelStats.current}
- 停售通路: ${item._channelStats.stopped}
- 未開賣通路: ${item._channelStats.pending}
- 異常通路: ${item._channelStats.abnormal}
      `.trim();
      
      Utils.copyToClipboard(detailText);
    }
  };

  // ==================== 初始化啟動 ====================
  
  // 檢查是否已經存在實例
  if (window[AppConfig.TOOL_ID]) {
    showToast('小工具已在運行中', 'warning', 2000);
    return;
  }

  // 標記實例存在
  window[AppConfig.TOOL_ID] = true;

  // 顯示啟動訊息
  showToast(`🚀 凱基人壽商品查詢小工具 v${AppConfig.VERSION} 已載入`, 'success', 3000);
  
  // 顯示查詢對話框
  setTimeout(() => {
    showQueryDialog();
  }, 500);

  // 清理函式（當頁面卸載時）
  window.addEventListener('beforeunload', () => {
    _optimizedCacheDetail.clear();
    _optimizedCacheChannel.clear();
    delete window[AppConfig.TOOL_ID];
  });

})();
