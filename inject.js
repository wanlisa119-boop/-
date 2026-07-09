// ==========================================
// inject.js v4 — 快捷填写 + 删除按钮
// ==========================================
(function() {
  'use strict';

  var style = document.createElement('style');
  style.textContent = `
    .quick-fill-section{background:var(--bg-card);box-shadow:var(--shadow-card);border-radius:12px;padding:16px;margin-bottom:20px}
    .quick-fill-section .qf-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
    .quick-fill-section .qf-header h3{font-size:17px;font-weight:600;color:var(--text-primary);margin:0}
    .qf-textarea{width:100%;padding:12px;border-radius:10px;font-size:14px;line-height:1.6;resize:vertical;min-height:80px;background:var(--bg-secondary);color:var(--text-body);border:none;outline:none;box-sizing:border-box;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif}
    .qf-textarea:focus{box-shadow:0 0 0 2px rgba(0,122,255,0.3)}
    .qf-toolbar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
    .qf-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all 0.2s;background:var(--bg-secondary);color:var(--text-body)}
    .qf-btn:active{transform:scale(0.95)}.qf-btn.primary{background:#007AFF;color:#fff}.qf-btn.primary:disabled{opacity:0.4}
    .qf-tips{font-size:11px;color:var(--text-tertiary);margin-top:6px;line-height:1.4}
    div[style*="var(--danger)"]{display:none!important}
  `;
  document.head.appendChild(style);

  function smartParse(text) {
    var r = {name:'',client:'',amount:'',stage:''};
    (text.split('\n')||[]).filter(function(l){return l.trim()}).forEach(function(t){
      t=t.trim();
      var cm=t.match(/(?:客户|公司|甲方|企业)(?:\s*[:：])?\s*(.+)/); if(cm&&!r.client)r.client=cm[1].trim();
      var am=t.match(/(?:金额|预算|合同额|报价)(?:\s*[:：])?\s*(?:约|大概|预计)?\s*(\d+(?:[\.\,]\d+)?)\s*(?:万|万元|w|W)?/); if(am)r.amount=am[1].replace(',','');
      var nm=t.match(/(?:项目|商机|名称|方案)(?:\s*[:：])?\s*(.+)/); if(nm&&!r.name)r.name=nm[1].trim();
      ['初步接触','方案交流','商务谈判','赢单','输单'].forEach(function(s){if(t.indexOf(s)>=0)r.stage=s});
    });
    return r;
  }

  function tryInjectQuickFill() {
    var fc = document.querySelector('.flex-1.overflow-y-auto');
    if (!fc) return;
    if (fc.querySelector('.quick-fill-section')) return;
    var sections = fc.querySelectorAll('.space-y-5 > div');
    if (!sections.length) return;

    var qf = document.createElement('div');
    qf.className = 'quick-fill-section';
    qf.innerHTML = '<div class="qf-header"><h3>📋 快捷填写</h3><span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,122,255,0.12);color:#007AFF">粘贴 · 智能填充</span></div>'+
      '<textarea class="qf-textarea" placeholder="把聊天记录/邮件原文粘贴在这里"></textarea>'+
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'+
      '<button class="qf-btn" data-action="paste">📋 粘贴</button>'+
      '<button class="qf-btn primary" data-action="fill" disabled>✨ 智能填充</button>'+
      '<button class="qf-btn" data-action="clear" style="margin-left:auto">清空</button></div>'+
      '<div class="qf-tips">💡 支持粘贴微信聊天记录、邮件原文，自动提取客户名、项目名、金额、阶段</div>';
    fc.insertBefore(qf, fc.firstChild);

    var ta = qf.querySelector('.qf-textarea');
    var fb = qf.querySelector('[data-action="fill"]');
    ta.addEventListener('input', function(){fb.disabled = !ta.value.trim()});

    qf.querySelector('[data-action="paste"]').addEventListener('click', async function(){
      try {var t=await navigator.clipboard.readText(); if(t){ta.value=t;ta.dispatchEvent(new Event('input'))}}catch(e){}
    });

    fb.addEventListener('click', function(){
      var p = smartParse(ta.value);
      var inputs = fc.querySelectorAll('input, textarea');
      var fi = Array.from(inputs);
      var ni = fi.find(function(el){return el.placeholder==='请输入商机名称'});
      if (p.name && ni){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(ni,p.name);ni.dispatchEvent(new Event('input',{bubbles:true}))}
      var ai = fi.find(function(el){return el.placeholder==='请输入金额'});
      if (p.amount && ai){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(ai,p.amount);ai.dispatchEvent(new Event('input',{bubbles:true}))}
      var ci = fi.find(function(el){return el.placeholder&&el.placeholder.indexOf('搜索或输入客户')>=0});
      if (p.client && ci){var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(ci,p.client);ci.dispatchEvent(new Event('input',{bubbles:true}))}
      if (p.stage){fc.querySelectorAll('.gap-2.overflow-x-auto button').forEach(function(b){if(b.textContent.trim()===p.stage)b.click()})}
    });
    qf.querySelector('[data-action="clear"]').addEventListener('click', function(){ta.value='';fb.disabled=true});
  }

  // ===== 删除按钮：扫描整个页面找"编辑商机"文本 =====
  function tryInjectDeleteButton() {
    var btns = document.querySelectorAll('button');
    var edited = false;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf('编辑商机') >= 0) {
        edited = true;
        break;
      }
    }
    console.log('🔍 [DEL] page has "编辑商机" btn:', edited);

    if (!edited) return;

    // 找那个按钮的父容器（整个卡片弹窗）
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf('编辑商机') < 0) continue;
      var container = btns[i].parentElement;
      if (!container || container.querySelector('.hermes-delbtn')) continue;

      // 往上找合适的插入位置
      var insert = btns[i].parentElement;
      
      var db = document.createElement('button');
      db.className = 'hermes-delbtn';
      db.textContent = '删除商机';
      db.style.cssText = 'display:block;margin:8px auto 16px;padding:10px 24px;border-radius:10px;border:1px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.06);color:#FF3B30;font-size:14px;font-weight:500;cursor:pointer;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif';
      db.onclick = function() {
        if (!confirm('确定删除这条商机？')) return;
        var name = '';
        var h = container.querySelector('h2, h3, [class*="font-semibold"]');
        if (h) name = h.textContent.trim().split('\n')[0];
        if (window.deleteOpp) { window.deleteOpp(name); }
      };
      insert.appendChild(db);
      console.log('🔍 [DEL] injected delete button');
    }
  }

  setInterval(function(){tryInjectQuickFill();tryInjectDeleteButton()}, 2000);
  setTimeout(function(){tryInjectQuickFill();tryInjectDeleteButton()}, 1500);

  var obs = new MutationObserver(function() {
    tryInjectQuickFill();
    tryInjectDeleteButton();
  });
  obs.observe(document.body, {childList: true, subtree: true});
})();
