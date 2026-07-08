// ==========================================
// Supabase ↔ localStorage 数据同步桥接
// 在 app.js 之前加载，实现多人共享
// 全部使用 XMLHttpRequest（兼容企业微信内置浏览器）
// ==========================================
(function() {
  'use strict';

  const SUPABASE_URL = 'https://rlfhoacuzvrcdalttxre.supabase.co';
  const ANON_KEY = 'eyJhbG...PwIw';
  const STORAGE_KEY = 'opportunity-app-state-v1';

  // 通用 XHR 封装（同步）
  function syncRequest(method, path, body) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, SUPABASE_URL + path, false);
    xhr.setRequestHeader('apikey', ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
    if (body) {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Prefer', 'resolution=merge-duplicates');
    }
    xhr.send(body ? JSON.stringify(body) : null);
    return xhr;
  }

  // —— 工具函数 ——
  function normalizeOpp(o) {
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
      owner: o.owner || '',
      created_at: o.createdAt ? new Date(o.createdAt).toISOString() : (o.created_at || new Date().toISOString()),
      updated_at: o.updatedAt ? new Date(o.updatedAt).toISOString() : (o.updated_at || new Date().toISOString())
    };
  }

  function normalizeClient(c) {
    return {
      id: c.id,
      company: c.company || '',
      contact_person: c.contactPerson || c.contact_person || '',
      phone: c.phone || '',
      industry: c.industry || '',
      region: c.region || '',
      owner: c.owner || '',
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : (c.created_at || new Date().toISOString())
    };
  }

  function toAppOpp(o) {
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
      owner: o.owner || '',
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

  // —— 同步计数，用于避免循环触发 ——
  var syncInProgress = false;

  // —— 1. 初始加载：从 Supabase 拉数据，合并本地未同步数据 ——
  function loadFromSupabase() {
    try {
      // 取 Supabase 数据
      var oppXhr = syncRequest('GET', '/rest/v1/opportunities?select=*');
      if (oppXhr.status !== 200) return false;
      var apiOpps = JSON.parse(oppXhr.responseText);

      var cliXhr = syncRequest('GET', '/rest/v1/clients?select=*');
      if (cliXhr.status !== 200) return false;
      var apiClients = JSON.parse(cliXhr.responseText);

      // 取本地已有数据（防止手机端写入失败导致数据丢失）
      var existingStr = localStorage.getItem(STORAGE_KEY);
      var existing = existingStr ? JSON.parse(existingStr) : null;

      // 从 Supabase 构建状态
      var state = {
        opportunities: apiOpps.map(toAppOpp),
        clients: apiClients.map(toAppClient),
        currentUser: (existing && existing.currentUser) ? existing.currentUser : { name: '用户', department: '', region: '' },
        theme: (existing && existing.theme) ? existing.theme : 'auto'
      };

      // ★ 合并本地数据：本地有但 Supabase 里没有的 → 保留（防止写入失败丢数据）
      if (existing) {
        var serverOppIds = {};
        state.opportunities.forEach(function(o) { serverOppIds[o.id] = true; });
        existing.opportunities.forEach(function(localOpp) {
          if (!serverOppIds[localOpp.id]) {
            state.opportunities.push(localOpp);
          }
        });

        var serverCliIds = {};
        state.clients.forEach(function(c) { serverCliIds[c.id] = true; });
        existing.clients.forEach(function(localCli) {
          if (!serverCliIds[localCli.id]) {
            state.clients.push(localCli);
          }
        });
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 记录当前 ID 集合，用于后续检测删除
      window.__supabase_opp_ids = new Set(state.opportunities.map(function(o) { return o.id; }));
      window.__supabase_cli_ids = new Set(state.clients.map(function(c) { return c.id; }));

      return true;
    } catch(e) {
      console.warn('Supabase 初始加载失败:', e.message);
      return false;
    }
  }

  // 页面刚加载时执行初始同步
  loadFromSupabase();

  // —— 2. 拦截 localStorage.setItem：同步写入 Supabase ——
  var _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);

    if (key !== STORAGE_KEY || syncInProgress) return;

    try {
      var data = JSON.parse(value);
      if (!data || syncInProgress) return;
      syncInProgress = true;

      var currentOppIds = new Set();
      var currentCliIds = new Set();

      // UPSERT 商机（同步 XHR，确保写入成功）
      if (data.opportunities && data.opportunities.length) {
        data.opportunities.forEach(function(opp) {
          currentOppIds.add(opp.id);
          var body = normalizeOpp(opp);
          try {
            var res = syncRequest('POST', '/rest/v1/opportunities', body);
            if (res.status >= 400) {
              console.error('🟥 Supabase opp write fail:', res.status, body.id);
            }
          } catch(e) {
            console.error('🟥 Supabase opp write error:', e.message, body.id);
          }
        });
      }

      // UPSERT 客户（同步 XHR）
      if (data.clients && data.clients.length) {
        data.clients.forEach(function(cli) {
          currentCliIds.add(cli.id);
          var body = normalizeClient(cli);
          try {
            var res = syncRequest('POST', '/rest/v1/clients', body);
            if (res.status >= 400) {
              console.error('🟥 Supabase client write fail:', res.status, body.id);
            }
          } catch(e) {
            console.error('🟥 Supabase client write error:', e.message, body.id);
          }
        });
      }

      // 检测并处理删除
      if (window.__supabase_opp_ids) {
        window.__supabase_opp_ids.forEach(function(id) {
          if (!currentOppIds.has(id)) {
            try {
              var delRes = syncRequest('DELETE', '/rest/v1/opportunities?id=eq.' + id);
              if (delRes.status >= 400) {
                console.error('🟥 Supabase opp delete fail:', delRes.status, id);
              }
            } catch(e) {
              console.error('🟥 Supabase opp delete error:', e.message, id);
            }
          }
        });
      }
      if (window.__supabase_cli_ids) {
        window.__supabase_cli_ids.forEach(function(id) {
          if (!currentCliIds.has(id)) {
            try {
              var delRes = syncRequest('DELETE', '/rest/v1/clients?id=eq.' + id);
              if (delRes.status >= 400) {
                console.error('🟥 Supabase client delete fail:', delRes.status, id);
              }
            } catch(e) {
              console.error('🟥 Supabase client delete error:', e.message, id);
            }
          }
        });
      }

      // 更新缓存 ID 集合
      window.__supabase_opp_ids = currentOppIds;
      window.__supabase_cli_ids = currentCliIds;

    } catch(e) {
      console.warn('Supabase 写入同步失败:', e.message);
    } finally {
      syncInProgress = false;
    }
  };

})();
