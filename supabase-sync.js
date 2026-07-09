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
    var url = SUPABASE_URL + path;
    var headers = {
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) {
      // POST 409 → 自动降级为 PATCH 更新
      if (method === 'POST' && r.status === 409 && body && body.id) {
        console.log('🔁 409 retry PATCH:', body.id.slice(0,12));
        return fetch(SUPABASE_URL + path + '?id=eq.' + encodeURIComponent(body.id), {
          method: 'PATCH',
          headers: headers,
          body: JSON.stringify(body)
        }).then(function(r2) {
          if (!r2.ok) throw new Error(r2.status + ' ' + (r2.statusText || ''));
          return r2;
        });
      }
      if (!r.ok) throw new Error(r.status + ' ' + (r.statusText || ''));
      return r;
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

  // ★ 合并规则：
  //   1. 从 Supabase 拉所有数据
  //   2. 属于"我"的记录 → 以本地为准（增删改都听本地的）
  //   3. 属于"别人"的记录 → 以 Supabase 为准
  function mergeState(apiOpps, apiClients, localState) {
    var uid = getUserId();
    var state = {
      opportunities: apiOpps.map(fromApiOpp),
      clients: apiClients.map(fromApiClient),
      currentUser: (localState && localState.currentUser) ? localState.currentUser : { name: '用户', department: '', region: '' },
      theme: (localState && localState.theme) ? localState.theme : 'auto'
    };

    if (localState && localState.opportunities) {
      var apiOppIdx = {};
      state.opportunities.forEach(function(o) { apiOppIdx[o.id] = o; });
      var localOppIdx = {};
      localState.opportunities.forEach(function(o) { localOppIdx[o.id] = o; });

      // ★ 步骤1：从 state 里剔除"我"本地已删的记录
      state.opportunities = state.opportunities.filter(function(o) {
        if (o.owner === 'current') {
          var keep = localOppIdx.hasOwnProperty(o.id);
          console.log('🔍 [MERGE-FILTER]', o.id.slice(0,12), 'owner=current, in local?', keep);
          return keep;
        }
        return true;
      });

      // ★ 步骤2：用本地版本的"我"覆盖
      state.opportunities = state.opportunities.map(function(o) {
        if (o.owner === 'current' && localOppIdx[o.id]) {
          return localOppIdx[o.id];
        }
        return o;
      });

      // ★ 步骤3：本地新增的"我"（Supabase 还没有的）
      localState.opportunities.forEach(function(localOpp) {
        if (localOpp.owner === 'current' && !apiOppIdx[localOpp.id]) {
          state.opportunities.push(localOpp);
        }
      });
    }

    // 同样处理客户
    if (localState && localState.clients) {
      var apiCliIdx = {};
      state.clients.forEach(function(c) { apiCliIdx[c.id] = c; });
      var localCliIdx = {};
      localState.clients.forEach(function(c) { localCliIdx[c.id] = c; });

      state.clients = state.clients.filter(function(c) {
        if (c.owner === 'current') {
          return localCliIdx.hasOwnProperty(c.id);
        }
        return true;
      });
      state.clients = state.clients.map(function(c) {
        if (c.owner === 'current' && localCliIdx[c.id]) {
          return localCliIdx[c.id];
        }
        return c;
      });
      localState.clients.forEach(function(localCli) {
        if (localCli.owner === 'current' && !apiCliIdx[localCli.id]) {
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
      console.log('🔍 [LOAD] userId:', uid.slice(0,12));

      // 从 Supabase 拉数据
      var oppRes = syncGet('/rest/v1/opportunities?select=*');
      if (oppRes.status !== 200) return false;
      var apiOpps = JSON.parse(oppRes.responseText);
      console.log('🔍 [LOAD] Supabase has', apiOpps.length, 'opps');
      apiOpps.forEach(function(o) {
        console.log('   Supabase opp:', o.id.slice(0,12), 'owner:', o.owner||'(empty)', 'name:', (o.name||'').slice(0,20));
      });

      var cliRes = syncGet('/rest/v1/clients?select=*');
      if (cliRes.status !== 200) return false;
      var apiClients = JSON.parse(cliRes.responseText);

      // 读取本地状态
      var localStr = localStorage.getItem(STORAGE_KEY);
      var localState = localStr ? JSON.parse(localStr) : null;
      if (localState && localState.opportunities) {
        console.log('🔍 [LOAD] localStorage has', localState.opportunities.length, 'opps');
        localState.opportunities.forEach(function(o) {
          console.log('   Local opp:', o.id.slice(0,12), 'owner:', o.owner, 'name:', (o.name||'').slice(0,20));
        });
      } else {
        console.log('🔍 [LOAD] localStorage: empty or no opps');
      }

      // 合并
      var state = mergeState(apiOpps, apiClients, localState);
      console.log('🔍 [LOAD] After merge:', state.opportunities.length, 'opps');
      state.opportunities.forEach(function(o) {
        console.log('   Merged opp:', o.id.slice(0,12), 'owner:', o.owner, 'name:', (o.name||'').slice(0,20));
      });

      // 写回 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

      // 立即清理 + 推送（不等 setTimeout）
      deleteRemoteOrphans(apiOpps, apiClients, localState);
      // 推本地独有数据到 Supabase
      var orphansToPush = [];
      if (localState && localState.opportunities) {
        var apiOppIds = {};
        apiOpps.forEach(function(o) { apiOppIds[o.id] = true; });
        localState.opportunities.forEach(function(o) {
          if (!apiOppIds[o.id]) orphansToPush.push(o);
        });
      }
      if (orphansToPush.length > 0) {
        console.log('🔍 [LOAD] pushing', orphansToPush.length, 'local-only opps to Supabase');
        writeToSupabase({ opportunities: orphansToPush });
      }

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

      console.log('🔍 [OVERRIDE] setItem called | opps in data:', (data.opportunities||[]).length, '| tracked ids:', window.__supabase_opp_ids ? window.__supabase_opp_ids.size : 'N/A');

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
            console.log('🔍 [DELETE-DETECT] opp', id.slice(0,12), 'removed from state, sending DELETE');
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

  // ===== 3. 暴露删除 API（控制台可用：deleteOpp('关键词')） =====
  window.deleteOpp = function(name) {
    var d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    var toDelete = [];
    d.opportunities = d.opportunities.filter(function(o) {
      if (o.name.indexOf(name) >= 0) { toDelete.push(o); return false; }
      return true;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    // 同步删 Supabase
    var uid = getUserId();
    toDelete.forEach(function(o) {
      api('DELETE', '/rest/v1/opportunities?id=eq.' + o.id)
        .catch(function(e) { console.warn('deleteOpp Supabase fail:', o.id.slice(0,12), e.message); });
    });
    console.log('✅ 已删除', toDelete.length, '条商机:', toDelete.map(function(o) { return o.name; }).join(', '));
    // 自动刷新页面
    setTimeout(function() { location.reload(); }, 500);
  };

  // ===== 4. 暴露客户删除 API =====
  window.deleteClient = function(name) {
    var d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    var toDelete = [];
    d.clients = d.clients.filter(function(c) {
      if (c.name.indexOf(name) >= 0) { toDelete.push(c); return false; }
      return true;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    toDelete.forEach(function(c) {
      api('DELETE', '/rest/v1/clients?id=eq.' + c.id)
        .catch(function(e) { console.warn('deleteClient Supabase fail:', c.id.slice(0,12), e.message); });
    });
    console.log('✅ 已删除', toDelete.length, '个客户:', toDelete.map(function(c) { return c.name; }).join(', '));
    setTimeout(function() { location.reload(); }, 500);
  };

})();
