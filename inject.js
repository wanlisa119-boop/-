// ==========================================
// inject.js v5 — 快捷填写 + 删除按钮 (debug版)
// ==========================================
(function() {
  'use strict';

  var style = document.createElement('style');
  style.textContent = '.quick-fill-section{background:var(--bg-card);box-shadow:var(--shadow-card);border-radius:12px;padding:16px;margin-bottom:20px}.quick-fill-section .qf-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}.quick-fill-section .qf-header h3{font-size:17px;font-weight:600;color:var(--text-primary);margin:0}.qf-textarea{width:100%;padding:12px;border-radius:10px;font-size:14px;line-height:1.6;resize:vertical;min-height:80px;background:var(--bg-secondary);color:var(--text-body);border:none;outline:none;box-sizing:border-box;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif}.qf-textarea:focus{box-shadow:0 0 0 2px rgba(0,122,255,0.3)}.qf-toolbar{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.qf-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all 0.2s;background:var(--bg-secondary);color:var(--text-body)}.qf-btn:active{transform:scale(0.95)}.qf-btn.primary{background:#007AFF;color:#fff}.qf-btn.primary:disabled{opacity:0.4}.qf-tips{font-size:11px;color:var(--text-tertiary);margin-top:6px;line-height:1.4}div[style*="var(--danger)"]{display:none!important}';
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

  // ===== 调试：列出所有按钮文字 =====
  function dumpButtons() {
    var btns = document.querySelectorAll('button');
    var texts = [];
    for (var i = 0; i < btns.length; i++) {
      var t = btns[i].textContent.replace(/\s+/g,' ').trim();
      if (t && t.length > 1 && t !== '保存' && t !== '取消' && texts.indexOf(t) < 0) {
        texts.push(t);
      }
    }
    console.log('🔍 [BTNS] unique button texts:', texts.join(' | '));
  }

  // 每3秒打印一次
  setInterval(dumpButtons, 3000);
  setTimeout(dumpButtons, 2000);

  var obs = new MutationObserver(function() { tryInjectQuickFill(); });
  obs.observe(document.body, {childList: true, subtree: true});
})();
