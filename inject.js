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
    .quick-fill-section .qf-header .qf-badge{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,122,255,0.12);color:#007AFF}
    .qf-textarea{width:100%;padding:12px;border-radius:10px;font-size:14px;line-height:1.6;resize:vertical;min-height:80px;background:var(--bg-secondary);color:var(--text-body);border:none;outline:none;box-sizing:border-box;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif}
    .qf-textarea:focus{box-shadow:0 0 0 2px rgba(0,122,255,0.3)}
    .qf-toolbar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
    .qf-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all 0.2s;background:var(--bg-secondary);color:var(--text-body)}
    .qf-btn:active{transform:scale(0.95)}
    .qf-btn.primary{background:#007AFF;color:#fff}
    .qf-btn.primary:disabled{opacity:0.4}
    .qf-tips{font-size:11px;color:var(--text-tertiary);margin-top:6px;line-height:1.4}
    div[style*="var(--danger)"]{display:none!important}
  `;
  document.head.appendChild(style);

  function smartParse(text) {
    var r = {name:'',client:'',amount:'',stage:''};
    var lines = text.split('\n').filter(function(l){return l.trim()});
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      var cm = t.match(/(?:客户|公司|甲方|企业)(?:\s*[:：])?\s*(.+)/);
      if (cm && !r.client) r.client = cm[1].trim();
      var am = t.match(/(?:金额|预算|合同额|报价)(?:\s*[:：])?\s*(?:约|大概|预计)?\s*(\d+(?:[\.\,]\d+)?)\s*(?:万|万元|w|W)?/);
      if (am) r.amount = am[1].replace(',','');
      var nm = t.match(/(?:项目|商机|名称|方案)(?:\s*[:：])?\s*(.+)/);
      if (nm && !r.name) r.name = nm[1].trim();
      var st = ['初步接触','方案交流','商务谈判','赢单','输单'];
      for (var j=0;j<st.length;j++){if(t.indexOf(st[j])>=0){r.stage=st[j];break}}
      if (!r.name && i===0) r.name = t;
    }
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
    qf.innerHTML = '<div class="qf-header"><h3>📋 快捷填写</h3><span class="qf-badge">粘贴 · 智能填充</span></div>'+
      '<textarea class="qf-textarea" placeholder="📌 把聊天记录/邮件原文粘贴在这里&#10;&#10;示例：客户：华润数字科技有限公司&#10;项目：能源管理数字化升级项目二期&#10;金额：320万&#10;阶段：商务谈判&#10;联系人：李总"></textarea>'+
      '<div class="qf-extract-result"></div>'+
      '<div class="qf-toolbar"><button class="qf-btn" data-action="paste">📋 粘贴</button>'+
      '<button class="qf-btn primary" data-action="fill" disabled>✨ 智能填充</button>'+
      '<button class="qf-btn" data-action="clear" style="margin-left:auto;">清空</button></div>'+
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
      if (p.amount && ai){var s2=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s2.call(ai,p.amount);ai.dispatchEvent(new Event('input',{bubbles:true}))}
      var ci = fi.find(function(el){return el.placeholder&&el.placeholder.indexOf('搜索或输入客户')>=0});
      if (p.client && ci){var s3=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s3.call(ci,p.client);ci.dispatchEvent(new Event('input',{bubbles:true}));ci.dispatchEvent(new Event('focus',{bubbles:true}))}
      if (p.stage){var sb=fc.querySelectorAll('.gap-2.overflow-x-auto button');sb.forEach(function(b){if(b.textContent.trim()===p.stage)b.click()})}
    });

    qf.querySelector('[data-action="clear"]').addEventListener('click', function(){ta.value='';fb.disabled=true});
  }

  // ===== 删除按钮：找所有 class*="fixed" 面板，往里注入 =====
  function tryInjectDeleteButton() {
    var panels = document.querySelectorAll('[class*="fixed"]');
    console.log('🔍 [DEL] fixed panels on page:', panels.length);
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      if (p.querySelector('.hermes-delbtn')) continue;
      
      // 面板里有没有 SVG 铅笔图标（编辑按钮的 icon）？
      var svgs = p.querySelectorAll('svg');
      var hasEdit = false;
      for (var j = 0; j < svgs.length; j++) {
        if ((svgs[j].textContent||'').indexOf('编辑') >= 0) hasEdit = true;
      }
      
      // 也检查按钮文字
      var btns = p.querySelectorAll('button');
      for (var k = 0; k < btns.length; k++) {
        if (btns[k].textContent.indexOf('编辑商机') >= 0) hasEdit = true;
      }
      
      if (!hasEdit) continue;
      console.log('🔍 [DEL] found edit panel, injecting delete btn');
      
      // 取商机名
      var name = '';
      var h = p.querySelector('h2, h3, [class*="font-semibold"]');
      if (h) name = h.textContent.trim().split('\n')[0];
      
      var db = document.createElement('button');
      db.className = 'hermes-delbtn';
      db.textContent = '删除商机';
      db.style.cssText = 'display:block;margin:8px auto 16px;padding:10px 24px;border-radius:10px;border:1px solid rgba(255,59,48,0.3);background:rgba(255,59,48,0.06);color:#FF3B30;font-size:14px;font-weight:500;cursor:pointer;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif';
      db.onclick = function() {
        if (!confirm('确定删除「'+(name||'这条')+'」？')) return;
        if (window.deleteOpp) { window.deleteOpp(name); }
      };
      p.appendChild(db);
    }
  }

  setInterval(tryInjectDeleteButton, 2000);
  setTimeout(tryInjectDeleteButton, 1500);

  var obs = new MutationObserver(function() {
    tryInjectQuickFill();
    tryInjectDeleteButton();
  });
  obs.observe(document.body, {childList: true, subtree: true});
})();
