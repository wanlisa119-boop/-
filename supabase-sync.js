// ==========================================
// Supabase ↔ localStorage 数据同步桥接 v3
// 写入+读取+删除+合并 全部走通
// ==========================================
(function() {
  'use strict';

  const SUPABASE_URL = 'https://rlfhoacuzvrcdalttxre.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZmhvYWN1enZyY2RhbHR0eHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDczODksImV4cCI6MjA5ODk4MzM4OX0.rM93L4Xy84TWWdYGdj3oDy7nO4WHcVCw3AJSKiQPwIw';
  const STORAGE_KEY = 'opportunity-app-state-v1';
  const USER_ID_KEY = '__app_user_id';

  // ===== 用户身份 =====
  function getUserId() {
    var uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(USER_ID_KEY, uid);
    }
    return uid;
  }

  // ===== HTTP 请求 =====
  function api(method, path, body) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, SUPABASE_URL + path, true);
      xhr.setRequestHeader('apikey', ANON_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
      if (body) {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Prefer', 'resolution=merge-duplicates');
      }
      xhr.timeout = 15000;
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr);
        else reject(new Error(xhr.status + ' ' + (xhr.responseText || '').slice(0, 120)));
      };
      xhr.onerror = function() { reject(new Error('NET_FAIL')); };
      xhr.ontimeout = function() { reject(new Error('TIMEOUT')); };
      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  // 同步 GET（初始加载用）
  function syncGet(path) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', SUPABASE_URL + path, false);
    xhr.setRequestHeader('apikey', ANON_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
    xhr.send();
    return xhr;
  }

  // ===== 数据变换 =====
  function resolveOwner(owner, uid) {
    return (!owner || owner === 'current') ? uid : owner;
  }
  function displayOwner(owner, uid) {
    return owner === uid ? 'current' : (owner || '');
  }

  function toApiOpp(o, uid) {
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
      owner: resolveOwner(o.owner, uid),
      created_at: o.createdAt ? new Date(o.createdAt).toISOString() : (o.created_at || new Date().toISOString()),
      updated_at: o.updatedAt ? new Date(o.updatedAt).toISOString() : (o.updated_at || new Date().toISOString())
    };
  }

  function toApiClient(c, uid) {
    return {
      id: c.id,
      company: c.company || '',
      contact_person: c.contactPerson || c.contact_person || '',
      phone: c.phone || '',
      industry: c.industry || '',
      region: c.region || '',
      owner: resolveOwner(c.owner, uid),
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : (c.created_at || new Date().toISOString())
    };
  }

  function fromApiOpp(o) {
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

  function fromApiClient(c) {
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

  // ===== 核心逻辑 =====

  // ★ 更新后的合并规则：
  // - 属于"我"的记录 → 以本地状态为准（增/删/改都听本地的）
  // - 属于"别人"的记录 → 以 Supabase 为准
  function mergeState(apiOpps, apiClients, localState) {
    var uid = getUserId();
    var state = {
      opportunities: apiOpps.map(fromApiOpp),
      clients: apiClients.map(fromApiClient),
      currentUser: (localState && localState.currentUser) ? localState.currentUser : { name: '用户', department: '', region: '' },
      theme: (localState && localState.theme) ? localState.theme : 'auto'
    };

    // 用本地"我的"记录覆盖 Supabase 的
    if (localState && localState.opportunities) {
      var apiIdx = {};
      state.opportunities.forEach(function(o) { apiIdx[o.id] = true; });

      localState.opportunities.forEach(function(localOpp) {
        if (localOpp.owner === 'current') {
          // "我的"记录：用本地的（本地删了就是删了，本地改了就是改了）
          if (apiIdx[localOpp.id]) {
            // 替换 Supabase 的版本为本地版本
            for (var i = 0; i < state.opportunities.length; i++) {
              if (state.opportunities[i].id === localOpp.id) {
                state.opportunities[i] = localOpp;
                break;
              }
            }
          } else {
            // 本地有但 Supabase 没有 → 新增未同步的
            state.opportunities.push(localOpp);
          }
        } else if (!apiIdx[localOpp.id]) {
          // 别人的记录但本地有 → 保留（可能是刚从 Supabase 拉的）
          state.opportunities.push(localOpp);
        }
      });
    }

    // 同样的逻辑处理客户
    if (localState && localState.clients) {
      var apiCliIdx = {};
      state.clients.forEach(function(c) { apiCliIdx[c.id] = true; });

      localState.clients.forEach(function(localCli) {
        if (localCli.owner === 'current' || !localCli.owner) {
          if (apiCliIdx[localCli.id]) {
            for (var i = 0; i < state.clients.length; i++) {
              if (state.clients[i].id === localCli.id) {
                state.clients[i] = localCli;
                break;
              }
            }
          } else {
            state.clients.push(localCli);
          }
        } else if (!apiCliIdx[localCli.id]) {
          state.clients.push(localCli);
        }
      });
    }

    return state;
  }

  // 写入 Supabase 的公共函数
  function writeToSupabase(data) {
    var uid = getUserId();

    if (data.opportunities) {
      data.opportunities.forEach(function(opp) {
        api('POST', '/rest/v1/opportunities', toApiOpp(opp, uid))
          .catch(function(e) { console.warn('⬇ opp write fail:', opp.id.slice(0,12), e.message); });
      });
    }
    if (data.clients) {
      data.clients.forEach(function(cli) {
        api('POST', '/rest/v1/clients', toApiClient(cli, uid))
          .catch(function(e) { console.warn('⬇ cli write fail:', cli.id.slice(0,12), e.message); });
      });
    }
  }

  // 删除 Supabase 上"我的"但本地没有的记录
  function deleteRemoteOrphans(apiOpps, apiClients, localState) {
    var uid = getUserId();
    var localOppIds = {};
    var localCliIds = {};
    if (localState) {
      if (localState.opportunities) localState.opportunities.forEach(function(o) { localOppIds[o.id] = true; });
      if (localState.clients) localState.clients.forEach(function(c) { localCliIds[c.id] = true; });
    }

    // 属于"我"但是本地没有 → 远程也要删
    apiOpps.forEach(function(apiOpp) {
      var myId = displayOwner(apiOpp.owner, uid);
      if ((myId === 'current' || !apiOpp.owner) && !localOppIds[apiOpp.id]) {
        api('DELETE', '/rest/v1/opportunities?id=eq.' + apiOpp.id)
          .catch(function(e) { console.warn('⬇ opp delete retry fail:', apiOpp.id.slice(0,12), e.message); });
      }
    });
    apiClients.forEach(function(apiCli) {
      var myId = displayOwner(apiCli.owner, uid);
      if ((myId === 'current' || !apiCli.owner) && !localCliIds[apiCli.id]) {
        api('DELETE', '/rest/v1/clients?id=eq.' + apiCli.id)
          .catch(function(e) { console.warn('⬇ cli delete retry fail:', apiCli.id.slice(0,12), e.message); });
      }
    });
  }

  // ===== 1. 页面加载：同步 + 合并 + 清理孤儿 =====
  function loadFromSupabase() {
    try {
      var uid = getUserId();

      // 从 Supabase 拉数据
      var oppRes = syncGet('/rest/v1/opportunities?select=*');
      if (oppRes.status !== 200) return false;
      var apiOpps = JSON.parse(oppRes.responseText);

      var cliRes = syncGet('/rest/v1/clients?select=*');
      if (cliRes.status !== 200) return false;
      var apiClients = JSON.parse(cliRes.responseText);

      // 读取本地状态
      var localStr = localStorage.getItem(STORAGE_KEY);
      var localState = localStr ? JSON.parse(localStr) : null;

      // 合并
      var state = mergeState(apiOpps, apiClients, localState);

      // 写回 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 后台清理：本地删了但 Supabase 还留着的"我的"记录
      window.setTimeout(function() {
        deleteRemoteOrphans(apiOpps, apiClients, localState);
        // 也把本地新数据推上去
        if (localState) writeToSupabase(localState);
      }, 300);

      // 记录 ID 集合
      window.__supabase_opp_ids = new Set(state.opportunities.map(function(o) { return o.id; }));
      window.__supabase_cli_ids = new Set(state.clients.map(function(c) { return c.id; }));

      return true;
    } catch(e) {
      console.warn('Supabase load fail:', e.message);
      return false;
    }
  }

  // 执行初始化
  loadFromSupabase();

  // ===== 2. 监听 localStorage.setItem：实时同步 =====
  var _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (key !== STORAGE_KEY) return;

    try {
      var data = JSON.parse(value);
      if (!data) return;

      var uid = getUserId();
      var newOppIds = new Set();
      var newCliIds = new Set();

      // 写入新增/更新的记录
      if (data.opportunities) data.opportunities.forEach(function(o) {
        newOppIds.add(o.id);
        api('POST', '/rest/v1/opportunities', toApiOpp(o, uid))
          .catch(function(e) { console.warn('⬇ write opp:', o.id.slice(0,12), e.message); });
      });
      if (data.clients) data.clients.forEach(function(c) {
        newCliIds.add(c.id);
        api('POST', '/rest/v1/clients', toApiClient(c, uid))
          .catch(function(e) { console.warn('⬇ write cli:', c.id.slice(0,12), e.message); });
      });

      // 检测删除：之前追踪过但这次没有的（且是我的）
      if (window.__supabase_opp_ids) {
        window.__supabase_opp_ids.forEach(function(id) {
          if (!newOppIds.has(id)) {
            api('DELETE', '/rest/v1/opportunities?id=eq.' + id)
              .catch(function(e) { console.warn('⬇ del opp:', id.slice(0,12), e.message); });
          }
        });
      }
      if (window.__supabase_cli_ids) {
        window.__supabase_cli_ids.forEach(function(id) {
          if (!newCliIds.has(id)) {
            api('DELETE', '/rest/v1/clients?id=eq.' + id)
              .catch(function(e) { console.warn('⬇ del cli:', id.slice(0,12), e.message); });
          }
        });
      }

      window.__supabase_opp_ids = newOppIds;
      window.__supabase_cli_ids = newCliIds;

    } catch(e) {
      console.warn('⬇ sync error:', e.message);
    }
  };

})();
