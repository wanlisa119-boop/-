// ==========================================
// Supabase ↔ localStorage 数据同步桥接
// V2 - 异步写入 + 加载时重试 + 用户身份
// ==========================================
(function() {
  'use strict';

  const SUPABASE_URL = 'https://rlfhoacuzvrcdalttxre.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZmhvYWN1enZyY2RhbHR0eHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDczODksImV4cCI6MjA5ODk4MzM4OX0.rM93L4Xy84TWWdYGdj3oDy7nO4WHcVCw3AJSKiQPwIw';
  const STORAGE_KEY = 'opportunity-app-state-v1';
  const USER_ID_KEY = '__app_user_id';

  // —— 用户身份（设备唯一 ID，存在 localStorage 里） ——
  function getUserId() {
    var uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
  }

  // —— 通用异步 XHR 封装 ——
  function asyncRequest(method, path, body) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, SUPABASE_URL + path, true);
      xhr.setRequestHeader('apikey', ANON_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
      if (body) {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Prefer', 'resolution=merge-duplicates');
      }
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr);
          } else {
            reject(new Error('HTTP ' + xhr.status + ': ' + (xhr.responseText || '').slice(0, 100)));
          }
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.ontimeout = function() { reject(new Error('Timeout')); };
      xhr.timeout = 10000;
      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  // —— 同步 GET（仅用于初始加载，兼容性好） ——
  function syncGet(path) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', SUPABASE_URL + path, false);
    xhr.setRequestHeader('apikey', ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
    xhr.send();
    return xhr;
  }

  // —— 工具函数 ——

  // ★ 写入 Supabase 时：把 owner="current" 转为设备 ID
  function resolveOwner(owner, userId) {
    if (!owner || owner === 'current') return userId;
    return owner;
  }

  // ★ 读取时：把我自己的数据标记为 "current"（App 的"我的"按这个筛选）
  function displayOwner(owner, userId) {
    return owner === userId ? 'current' : (owner || '');
  }

  function normalizeOpp(o, userId) {
    return {
      id: o.id,
      name: o.name || '',
      client_id: o.clientId || o.client_id || '',
      amount: o.amount || 0,
      stage: o.stage || '初步接触',
      contact_person: o.contact || o.contact_person || '',
      scores: o.scores || {},
      risks: o.risks || {},
      notes: o.notes || '',
      owner: resolveOwner(o.owner, userId),
      created_at: o.createdAt ? new Date(o.createdAt).toISOString() : (o.created_at || new Date().toISOString()),
      updated_at: o.updatedAt ? new Date(o.updatedAt).toISOString() : (o.updated_at || new Date().toISOString())
    };
  }

  function normalizeClient(c, userId) {
    return {
      id: c.id,
      company: c.company || '',
      contact_person: c.contactPerson || c.contact_person || '',
      phone: c.phone || '',
      industry: c.industry || '',
      region: c.region || '',
      owner: resolveOwner(c.owner, userId),
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : (c.created_at || new Date().toISOString())
    };
  }

  function toAppOpp(o) {
    var uid = getUserId();
    return {
      id: o.id,
      name: o.name,
      clientId: o.client_id || '',
      amount: o.amount || 0,
      stage: o.stage || '初步接触',
      contact: o.contact_person || '',
      scores: typeof o.scores === 'string' ? JSON.parse(o.scores) : (o.scores || {budget:3,authority:3,need:3,timeline:3,competition:3}),
      risks: typeof o.risks === 'string' ? JSON.parse(o.risks) : (o.risks || {}),
      notes: o.notes || '',
      owner: displayOwner(o.owner, uid),
      createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
      updatedAt: o.updated_at ? new Date(o.updated_at).getTime() : Date.now()
    };
  }

  function toAppClient(c) {
    return {
      id: c.id,
      company: c.company,
      contactPerson: c.contact_person || '',
      phone: c.phone || '',
      industry: c.industry || '',
      region: c.region || '',
      owner: c.owner || '',
      createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now()
    };
  }

  // —— 同步锁 ——
  var syncInProgress = false;

  // —— 1. 初始加载：从 Supabase 拉数据，合并本地未同步数据 ——
  function loadFromSupabase() {
    try {
      var userId = getUserId();

      var oppXhr = syncGet('/rest/v1/opportunities?select=*');
      if (oppXhr.status !== 200) return false;
      var apiOpps = JSON.parse(oppXhr.responseText);

      var cliXhr = syncGet('/rest/v1/clients?select=*');
      if (cliXhr.status !== 200) return false;
      var apiClients = JSON.parse(cliXhr.responseText);

      var existingStr = localStorage.getItem(STORAGE_KEY);
      var existing = existingStr ? JSON.parse(existingStr) : null;

      var state = {
        opportunities: apiOpps.map(toAppOpp),
        clients: apiClients.map(toAppClient),
        currentUser: (existing && existing.currentUser) ? existing.currentUser : { name: '用户', department: '', region: '' },
        theme: (existing && existing.theme) ? existing.theme : 'auto'
      };

      var serverOppIds = {};
      state.opportunities.forEach(function(o) { serverOppIds[o.id] = true; });
      var serverCliIds = {};
      state.clients.forEach(function(c) { serverCliIds[c.id] = true; });

      // ★ 合并本地未同步数据
      var localOnlyOpps = [];
      if (existing) {
        existing.opportunities.forEach(function(localOpp) {
          if (!serverOppIds[localOpp.id]) {
            localOnlyOpps.push(localOpp);
            state.opportunities.push(localOpp);
          }
        });
        existing.clients.forEach(function(localCli) {
          if (!serverCliIds[localCli.id]) {
            state.clients.push(localCli);
          }
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // ★ 后台推送本地特有数据到 Supabase（异步重试）
      setTimeout(function() {
        localOnlyOpps.forEach(function(opp) {
          asyncRequest('POST', '/rest/v1/opportunities', normalizeOpp(opp, userId))
            .catch(function(e) { console.warn('Supabase push retry fail (opp):', opp.id, e.message); });
        });
        if (existing) {
          existing.clients.forEach(function(cli) {
            if (!serverCliIds[cli.id]) {
              asyncRequest('POST', '/rest/v1/clients', normalizeClient(cli, userId))
                .catch(function(e) { console.warn('Supabase push retry fail (cli):', cli.id, e.message); });
            }
          });
        }
      }, 500);

      window.__supabase_opp_ids = new Set(state.opportunities.map(function(o) { return o.id; }));
      window.__supabase_cli_ids = new Set(state.clients.map(function(c) { return c.id; }));

      return true;
    } catch(e) {
      console.warn('Supabase 初始加载失败:', e.message);
      return false;
    }
  }

  loadFromSupabase();

  // —— 2. 拦截 localStorage.setItem：异步写入 Supabase ——
  var _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key !== STORAGE_KEY || syncInProgress) return;

    try {
      var data = JSON.parse(value);
      if (!data) return;
      syncInProgress = true;

      var userId = getUserId();
      var currentOppIds = new Set();
      var currentCliIds = new Set();

      // 异步写入商机
      if (data.opportunities && data.opportunities.length) {
        data.opportunities.forEach(function(opp) {
          currentOppIds.add(opp.id);
          var body = normalizeOpp(opp, userId);
          asyncRequest('POST', '/rest/v1/opportunities', body)
            .catch(function(e) { console.error('🟥 Supabase write opp fail:', opp.id, e.message); });
        });
      }

      // 异步写入客户
      if (data.clients && data.clients.length) {
        data.clients.forEach(function(cli) {
          currentCliIds.add(cli.id);
          var body = normalizeClient(cli, userId);
          asyncRequest('POST', '/rest/v1/clients', body)
            .catch(function(e) { console.error('🟥 Supabase write cli fail:', cli.id, e.message); });
        });
      }

      // 检测删除
      if (window.__supabase_opp_ids) {
        window.__supabase_opp_ids.forEach(function(id) {
          if (!currentOppIds.has(id)) {
            asyncRequest('DELETE', '/rest/v1/opportunities?id=eq.' + id)
              .catch(function(e) { console.warn('Supabase delete opp fail:', id, e.message); });
          }
        });
      }
      if (window.__supabase_cli_ids) {
        window.__supabase_cli_ids.forEach(function(id) {
          if (!currentCliIds.has(id)) {
            asyncRequest('DELETE', '/rest/v1/clients?id=eq.' + id)
              .catch(function(e) { console.warn('Supabase delete cli fail:', id, e.message); });
          }
        });
      }

      window.__supabase_opp_ids = currentOppIds;
      window.__supabase_cli_ids = currentCliIds;

    } catch(e) {
      console.warn('Supabase sync error:', e.message);
    } finally {
      syncInProgress = false;
    }
  };

})();
