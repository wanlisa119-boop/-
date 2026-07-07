// ==========================================
// Supabase ↔ localStorage 数据同步桥接
// 在 app.js 之前加载，实现多人共享
// ==========================================
(function() {
  'use strict';

  const SUPABASE_URL = 'https://rlfhoacuzvrcdalttxre.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZmhvYWN1enZyY2RhbHR0eHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDczODksImV4cCI6MjA5ODk4MzM4OX0.rM93L4Xy84TWWdYGdj3oDy7nO4WHcVCw3AJSKiQPwIw';
  const STORAGE_KEY = 'opportunity-app-state-v1';
  const API_HEADERS = {
    'apikey': ANON_KEY,
    'Authorization': 'Bearer ' + ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  // —— 工具函数 ——
  function normalizeOpp(o) {
    return {
      id: o.id,
      name: o.name || '',
      client_id: o.clientId || o.client_id || '',
      amount: o.amount || 0,
      stage: o.stage || '初步接触',
      contact_person: o.contact || o.contact_person || '',
      scores: typeof o.scores === 'string' ? o.scores : JSON.stringify(o.scores || {}),
      risks: typeof o.risks === 'string' ? o.risks : JSON.stringify(o.risks || {}),
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
  let syncInProgress = false;

  // —— 1. 初始加载：从 Supabase 拉数据写入 localStorage（同步 XHR）——
  function loadFromSupabase() {
    try {
      // 取商机
      var oppXhr = new XMLHttpRequest();
      oppXhr.open('GET', SUPABASE_URL + '/rest/v1/opportunities?select=*', false);
      oppXhr.setRequestHeader('apikey', ANON_KEY);
      oppXhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
      oppXhr.send();

      if (oppXhr.status !== 200) return false;
      var apiOpps = JSON.parse(oppXhr.responseText);

      // 取客户
      var cliXhr = new XMLHttpRequest();
      cliXhr.open('GET', SUPABASE_URL + '/rest/v1/clients?select=*', false);
      cliXhr.setRequestHeader('apikey', ANON_KEY);
      cliXhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
      cliXhr.send();

      if (cliXhr.status !== 200) return false;
      var apiClients = JSON.parse(cliXhr.responseText);

      // 拼成 App 状态格式
      var state = {
        opportunities: apiOpps.map(toAppOpp),
        clients: apiClients.map(toAppClient),
        currentUser: { name: '用户', department: '', region: '' },
        theme: 'auto'
      };

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

  // —— 2. 拦截 localStorage.setItem：写回 Supabase ——
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

      // UPSERT 商机
      if (data.opportunities && data.opportunities.length) {
        data.opportunities.forEach(function(opp) {
          currentOppIds.add(opp.id);
          var body = normalizeOpp(opp);
          fetch(SUPABASE_URL + '/rest/v1/opportunities', {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(body)
          }).catch(function() {});
        });
      }

      // UPSERT 客户
      if (data.clients && data.clients.length) {
        data.clients.forEach(function(cli) {
          currentCliIds.add(cli.id);
          var body = normalizeClient(cli);
          fetch(SUPABASE_URL + '/rest/v1/clients', {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(body)
          }).catch(function() {});
        });
      }

      // 检测并处理删除：被从 localStorage 中移除的记录 → 从 Supabase 删除
      if (window.__supabase_opp_ids) {
        window.__supabase_opp_ids.forEach(function(id) {
          if (!currentOppIds.has(id)) {
            fetch(SUPABASE_URL + '/rest/v1/opportunities?id=eq.' + id, {
              method: 'DELETE',
              headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY }
            }).catch(function() {});
          }
        });
      }
      if (window.__supabase_cli_ids) {
        window.__supabase_cli_ids.forEach(function(id) {
          if (!currentCliIds.has(id)) {
            fetch(SUPABASE_URL + '/rest/v1/clients?id=eq.' + id, {
              method: 'DELETE',
              headers: { 'apikey': ANON_KEY, 'Authorization': 'Bearer ' + ANON_KEY }
            }).catch(function() {});
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
