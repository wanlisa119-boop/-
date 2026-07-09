// ==========================================
// inject.js v8 — 商机删除 + 客户池删除 + 批量删除
// ==========================================
(function() {
  'use strict';

  var style = document.createElement('style');
  style.textContent = '.quick-fill-section{background:var(--bg-card);box-shadow:var(--shadow-card);border-radius:12px;padding:16px;margin-bottom:20px}.quick-fill-section .qf-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}.quick-fill-section .qf-header h3{font-size:17px;font-weight:600;color:var(--text-primary);margin:0}.qf-textarea{width:100%;padding:12px;border-radius:10px;font-size:14px;line-height:1.6;resize:vertical;min-height:80px;background:var(--bg-secondary);color:var(--text-body);border:none;outline:none;box-sizing:border-box;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif}.qf-textarea:focus{box-shadow:0 0 0 2px rgba(0,122,255,0.3)}.qf-toolbar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.qf-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all 0.2s;background:var(--bg-secondary);color:var(--text-body)}.qf-btn:active{transform:scale(0.95)}.qf-btn.primary{background:#007AFF;color:#fff}.qf-btn.primary:disabled{opacity:0.4}.qf-tips{font-size:11px;color:var(--text-tertiary);margin-top:6px;line-height:1.4}button[style*="var(--danger)"]{display:none!important}.hermes-batch-mode .spring-in{border:1px dashed rgba(255,59,48,0.3);border-radius:12px}';
  document.head.appendChild(style);

  // ===== 快捷填写 =====
  function tryInjectQuickFill() {
    var fc = document.querySelector('.flex-1.overflow-y-auto');
    if (!fc || fc.querySelector('.quick-fill-section')) return;
    var sections = fc.querySelectorAll('.space-y-5 > div');
    if (!sections.length) return;
    var qf = document.createElement('div'); qf.className = 'quick-fill-section';
    qf.innerHTML = '<div class="qf-header"><h3>📋 快捷填写</h3><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,122,255,0.12);color:#007AFF">粘贴·智能填充</span></div><textarea class="qf-textarea" placeholder="把聊天记录/邮件原文粘贴在这里"></textarea><div class="qf-toolbar"><button class="qf-btn" data-action="paste">📋 粘贴</button><button class="qf-btn primary" data-action="fill" disabled>✨ 智能填充</button><button class="qf-btn" data-action="clear" style="margin-left:auto">清空</button></div><div class="qf-tips">💡 支持粘贴微信聊天记录、邮件原文</div>';
    fc.insertBefore(qf, fc.firstChild);
    var ta = qf.querySelector('.qf-textarea'), fb = qf.querySelector('[data-action="fill"]');
    ta.addEventListener('input', function(){fb.disabled=!ta.value.trim()});
    qf.querySelector('[data-action="paste"]').addEventListener('click', async function(){try{var t=await navigator.clipboard.readText();if(t){ta.value=t;ta.dispatchEvent(new Event('input'))}}catch(e){}});
    fb.addEventListener('click', function(){
      var r={name:'',client:'',amount:'',stage:''}, tx=ta.value; if(!tx)return;
      (tx.split('\n')||[]).filter(function(l){return l.trim()}).forEach(function(t){t=t.trim();
        var m=t.match(/(?:客户|公司|甲方|企业)(?:\s*[:：])?\s*(.+)/); if(m&&!r.client)r.client=m[1].trim();
        var a=t.match(/(?:金额|预算|合同额|报价)(?:\s*[:：])?\s*(?:约|大概|预计)?\s*(\d+(?:[\.\,]\d+)?)\s*(?:万|万元|w|W)?/); if(a)r.amount=a[1].replace(',','');
        var n=t.match(/(?:项目|商机|名称|方案)(?:\s*[:：])?\s*(.+)/); if(n&&!r.name)r.name=n[1].trim();
        ['初步接触','方案交流','商务谈判','赢单','输单'].forEach(function(s){if(t.indexOf(s)>=0)r.stage=s});
      });
      var inputs=Array.from(fc.querySelectorAll('input,textarea')), vs=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      var ni=inputs.find(function(el){return el.placeholder==='请输入商机名称'}); if(r.name&&ni){vs.call(ni,r.name);ni.dispatchEvent(new Event('input',{bubbles:true}))}
      var ai=inputs.find(function(el){return el.placeholder==='请输入金额'}); if(r.amount&&ai){vs.call(ai,r.amount);ai.dispatchEvent(new Event('input',{bubbles:true}))}
      var ci=inputs.find(function(el){return el.placeholder&&el.placeholder.indexOf('搜索或输入客户')>=0}); if(r.client&&ci){vs.call(ci,r.client);ci.dispatchEvent(new Event('input',{bubbles:true}))}
      if(r.stage){fc.querySelectorAll('.gap-2.overflow-x-auto button').forEach(function(b){if(b.textContent.trim()===r.stage)b.click()})}
    });
    qf.querySelector('[data-action="clear"]').addEventListener('click', function(){ta.value='';fb.disabled=true});
  }

  // ===== 商机看板：展开卡片中"编辑商机"下方加"删除商机" =====
  function tryInjectOppDeleteButton() {
    if (document.querySelector('input, textarea')) return;
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var txt = btns[i].textContent || '';
      if (txt.indexOf('编辑') < 0 || txt.indexOf('商机') < 0) continue;
      var container = btns[i].parentElement;
      if (!container || container.querySelector('.hermes-delbtn')) continue;
      var cardBody = container.parentElement;
      var name = '';
      if (cardBody) { var h3 = cardBody.querySelector('h3'); if (h3) name = h3.textContent.trim(); }
      var db = document.createElement('button');
      db.className = 'hermes-delbtn';
      db.textContent = '🗑 删除商机';
      db.style.cssText = 'display:block;width:100%;margin:12px 0 0;padding:10px;border-radius:12px;border:1px solid rgba(255,59,48,0.25);background:rgba(255,59,48,0.05);color:#FF3B30;font-size:14px;font-weight:500;cursor:pointer;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif';
      (function(n){ db.onclick = function(e){ e.stopPropagation(); if(!confirm('确定删除「'+n+'」？')) return; if(window.deleteOpp) window.deleteOpp(n); }; })(name);
      container.appendChild(db);
    }
  }

  // ===== 客户池：单卡删除按钮 =====
  var clientDelInjected = false;
  function tryInjectClientDeleteButtons() {
    var h1 = document.querySelector('h1');
    if (!h1 || h1.textContent.indexOf('客户资源池') < 0) return;
    if (clientDelInjected) return;

    var cards = document.querySelectorAll('.spring-in');
    if (!cards.length) return;

    var injected = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.querySelector('.hermes-client-del')) continue;
      var flexDiv = card.querySelector('.p-4.flex');
      if (!flexDiv) continue;
      var h3 = card.querySelector('h3');
      var name = h3 ? h3.textContent.trim() : '';
      if (!name) continue;

      var db = document.createElement('button');
      db.className = 'hermes-client-del';
      db.title = '删除客户';
      db.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      db.style.cssText = 'flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--text-tertiary);cursor:pointer;border-radius:8px;margin-left:4px;transition:color 0.2s';
      db.onmouseenter = function(){db.style.color='#FF3B30'};
      db.onmouseleave = function(){db.style.color='var(--text-tertiary)'};
      (function(n){ db.onclick = function(e){ e.stopPropagation(); if(!confirm('确定删除客户「'+n+'」？')) return; if(window.deleteClient) window.deleteClient(n); }; })(name);
      flexDiv.appendChild(db);
      injected++;
    }
    if (injected > 0) clientDelInjected = true;
  }

  // ===== 客户池：批量删除 =====
  var batchActive = false, selectedNames = [], confirmBtn = null;
  function tryInjectBatchDelete() {
    var h1 = document.querySelector('h1');
    if (!h1 || h1.textContent.indexOf('客户资源池') < 0) return;

    // Find "新建客户" button
    var btns = document.querySelectorAll('button');
    var newClientBtn = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf('新建客户') >= 0) { newClientBtn = btns[i]; break; }
    }
    if (!newClientBtn) return;
    var header = newClientBtn.parentElement;
    if (header.querySelector('.hermes-batch-del')) return;

    var bb = document.createElement('button');
    bb.className = 'hermes-batch-del';
    bb.textContent = '📋 批量删除';
    bb.style.cssText = 'margin-left:8px;padding:6px 14px;border-radius:20px;border:1px solid rgba(255,59,48,0.3);background:transparent;color:#FF3B30;font-size:13px;font-weight:500;cursor:pointer;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif';

    bb.onclick = function() {
      if (batchActive) { exitBatch(); } else { enterBatch(); }
    };

    header.appendChild(bb);
  }

  function enterBatch() {
    batchActive = true;
    selectedNames = [];
    document.body.classList.add('hermes-batch-mode');

    var bb = document.querySelector('.hermes-batch-del');
    if (bb) bb.textContent = '取消';

    // Add confirm button
    var header = bb.parentElement;
    confirmBtn = document.createElement('button');
    confirmBtn.className = 'hermes-batch-confirm';
    confirmBtn.textContent = '确认删除(0)';
    confirmBtn.style.cssText = 'margin-left:8px;padding:6px 14px;border-radius:20px;border:none;background:#FF3B30;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif;opacity:0.4';
    confirmBtn.disabled = true;
    confirmBtn.onclick = function() {
      if (selectedNames.length === 0) return;
      if (!confirm('确定删除 ' + selectedNames.length + ' 个客户？此操作不可撤销。')) return;
      // Batch: modify localStorage directly, delete all, reload once
      var d = JSON.parse(localStorage.getItem('opportunity-app-state-v1') || '{}');
      d.clients = (d.clients || []).filter(function(c) { return selectedNames.indexOf(c.name) < 0; });
      localStorage.setItem('opportunity-app-state-v1', JSON.stringify(d));
      location.reload();
    };
    header.appendChild(confirmBtn);

    // Add checkboxes to cards
    addBatchCheckboxes();
  }

  function exitBatch() {
    batchActive = false;
    selectedNames = [];
    document.body.classList.remove('hermes-batch-mode');
    var bb = document.querySelector('.hermes-batch-del');
    if (bb) bb.textContent = '📋 批量删除';
    if (confirmBtn) { confirmBtn.remove(); confirmBtn = null; }
    removeBatchCheckboxes();
  }

  function addBatchCheckboxes() {
    var cards = document.querySelectorAll('.spring-in');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.querySelector('.hermes-batch-cb')) continue;
      var flexDiv = card.querySelector('.p-4.flex');
      if (!flexDiv) continue;
      var h3 = card.querySelector('h3');
      if (!h3) continue;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'hermes-batch-cb';
      cb.style.cssText = 'flex-shrink:0;width:22px;height:22px;cursor:pointer;accent-color:#FF3B30;margin-right:8px';
      var name = h3.textContent.trim();
      cb.onchange = function() {
        if (cb.checked) { selectedNames.push(name); }
        else { selectedNames = selectedNames.filter(function(n){return n!==name}); }
        if (confirmBtn) {
          confirmBtn.textContent = '确认删除(' + selectedNames.length + ')';
          confirmBtn.disabled = selectedNames.length === 0;
          confirmBtn.style.opacity = selectedNames.length === 0 ? '0.4' : '1';
        }
      };
      flexDiv.insertBefore(cb, flexDiv.firstChild);
    }
  }

  function removeBatchCheckboxes() {
    var cbs = document.querySelectorAll('.hermes-batch-cb');
    for (var i = 0; i < cbs.length; i++) { cbs[i].remove(); }
    if (confirmBtn) { confirmBtn.remove(); confirmBtn = null; }
  }

  // ===== 调度 =====
  setInterval(function() {
    tryInjectOppDeleteButton();
    tryInjectClientDeleteButtons();
    tryInjectBatchDelete();
  }, 1500);
  setTimeout(function() {
    tryInjectOppDeleteButton();
    tryInjectClientDeleteButtons();
    tryInjectBatchDelete();
  }, 2000);

  var obs = new MutationObserver(function() {
    tryInjectQuickFill();
    tryInjectOppDeleteButton();
    tryInjectClientDeleteButtons();
    tryInjectBatchDelete();
  });
  obs.observe(document.body, {childList: true, subtree: true});
})();
