// ==========================================
// 快捷填写增强脚本 v3 — 粘贴 + 智能填充 + 删除按钮
// ==========================================
(function() {
  'use strict';

  // 注入自定义样式（含隐藏左滑删除）
  const style = document.createElement('style');
  style.textContent = `
    /* 快捷填写样式 */
    .quick-fill-section {
      background: var(--bg-card);
      box-shadow: var(--shadow-card);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .quick-fill-section .qf-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
    }
    .quick-fill-section .qf-header h3 {
      font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 0;
    }
    .quick-fill-section .qf-header .qf-badge {
      font-size: 11px; padding: 2px 8px; border-radius: 10px;
      background: rgba(0,122,255,0.12); color: #007AFF;
    }
    .qf-textarea {
      width: 100%; padding: 12px; border-radius: 10px; font-size: 14px;
      line-height: 1.6; resize: vertical; min-height: 80px;
      background: var(--bg-secondary); color: var(--text-body);
      border: none; outline: none; box-sizing: border-box;
      font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
    }
    .qf-textarea:focus { box-shadow: 0 0 0 2px rgba(0,122,255,0.3); }
    .qf-toolbar { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .qf-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
      border-radius: 20px; font-size: 13px; font-weight: 500; border: none;
      cursor: pointer; transition: all 0.2s;
      background: var(--bg-secondary); color: var(--text-body);
    }
    .qf-btn:active { transform: scale(0.95); }
    .qf-btn.primary { background: #007AFF; color: #fff; }
    .qf-btn.primary:disabled { opacity: 0.4; }
    .qf-tips { font-size: 11px; color: var(--text-tertiary); margin-top: 6px; line-height: 1.4; }

    /* 隐藏左滑删除（不可靠的手势操作） */
    div[style*="var(--danger)"] { visibility: hidden !important; pointer-events: none !important; }

    /* 我们的删除按钮样式 */
    .hermes-delete-btn-outer {
      width: 100%; padding: 0 20px; box-sizing: border-box; text-align: center;
    }
    .hermes-delete-btn-inner {
      display: inline-block; margin: 12px 0 20px; padding: 10px 24px;
      border-radius: 10px; border: 1px solid rgba(255,59,48,0.3);
      background: rgba(255,59,48,0.06); color: #FF3B30;
      font-size: 14px; font-weight: 500; cursor: pointer;
      font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
    }
  `;
  document.head.appendChild(style);

  // ===== 智能解析 =====
  function smartParse(text) {
    const result = { name: '', client: '', amount: '', stage: '' };
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const t = line.trim();
      const clientMatch = t.match(/(?:客户|公司|甲方|企业)(?:\s*[:：])?\s*(.+)/);
      if (clientMatch && !result.client) result.client = clientMatch[1].trim();
      const amtMatch = t.match(/(?:金额|预算|合同额|报价)(?:\s*[:：])?\s*(?:约|大概|预计)?\s*(\d+(?:[\.\,]\d+)?)\s*(?:万|万元|w|W)?/);
      if (amtMatch) result.amount = amtMatch[1].replace(',', '');
      const nameMatch = t.match(/(?:项目|商机|名称|方案)(?:\s*[:：])?\s*(.+)/);
      if (nameMatch && !result.name) result.name = nameMatch[1].trim();
      const stages = ['初步接触', '方案交流', '商务谈判', '赢单', '输单'];
      for (const s of stages) { if (t.includes(s)) { result.stage = s; break; } }
      if (!result.name && line === lines[0]) result.name = t;
    }
    return result;
  }

  // ===== 快捷填写注入 =====
  function tryInjectQuickFill() {
    const formContent = document.querySelector('.fixed.inset-0.z-\\\\[80\\\\] .flex-1.overflow-y-auto');
    if (!formContent) return;
    if (formContent.querySelector('.quick-fill-section')) return;

    const sections = formContent.querySelectorAll('.space-y-5 > div');
    if (sections.length === 0) return;

    const quickFill = document.createElement('div');
    quickFill.className = 'quick-fill-section';
    quickFill.innerHTML = `
      <div class="qf-header">
        <h3>📋 快捷填写</h3>
        <span class="qf-badge">粘贴 · 智能填充</span>
      </div>
      <textarea class="qf-textarea" placeholder="📌 把聊天记录/邮件原文粘贴在这里&#10;&#10;示例：&#10;客户：华润数字科技有限公司&#10;项目：能源管理数字化升级项目二期&#10;金额：320万&#10;阶段：商务谈判&#10;联系人：李总"></textarea>
      <div class="qf-extract-result"></div>
      <div class="qf-toolbar">
        <button class="qf-btn" data-action="paste">📋 粘贴</button>
        <button class="qf-btn primary" data-action="fill" disabled>✨ 智能填充</button>
        <button class="qf-btn" data-action="clear" style="margin-left:auto;">清空</button>
      </div>
      <div class="qf-tips">💡 支持粘贴微信聊天记录、邮件原文，自动提取客户名、项目名、金额、阶段</div>
    `;

    formContent.insertBefore(quickFill, formContent.firstChild);

    const textarea = quickFill.querySelector('.qf-textarea');
    const fillBtn = quickFill.querySelector('[data-action="fill"]');
    const extractResult = quickFill.querySelector('.qf-extract-result');

    textarea.addEventListener('input', () => { fillBtn.disabled = !textarea.value.trim(); });

    quickFill.querySelector('[data-action="paste"]').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) { textarea.value = text; textarea.dispatchEvent(new Event('input')); }
      } catch (err) {}
    });

    fillBtn.addEventListener('click', () => {
      const parsed = smartParse(textarea.value);
      const inputs = formContent.querySelectorAll('input, textarea');
      const formInputs = Array.from(inputs);

      const nameInput = formInputs.find(el => el.placeholder === '请输入商机名称');
      if (parsed.name && nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, parsed.name);
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const amountInput = formInputs.find(el => el.placeholder === '请输入金额');
      if (parsed.amount && amountInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(amountInput, parsed.amount);
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const clientInput = formInputs.find(el => el.placeholder && el.placeholder.includes('搜索或输入客户'));
      if (parsed.client && clientInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(clientInput, parsed.client);
        clientInput.dispatchEvent(new Event('input', { bubbles: true }));
        clientInput.dispatchEvent(new Event('focus', { bubbles: true }));
      }
      if (parsed.stage) {
        const stageBtns = formContent.querySelectorAll('.gap-2.overflow-x-auto button');
        stageBtns.forEach(btn => { if (btn.textContent.trim() === parsed.stage) btn.click(); });
      }
    });

    quickFill.querySelector('[data-action="clear"]').addEventListener('click', () => {
      textarea.value = ''; fillBtn.disabled = true;
    });
  }

  // ===== 删除按钮注入（找到卡片标题h2后面插入） =====
  function tryInjectDeleteButton() {
    // 找所有 h2 标题（卡片里的"编辑商机"或"新建商机"）
    var headings = document.querySelectorAll('h2');
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      var txt = h.textContent.trim();
      // 只在"编辑商机"卡片里加删除（不给"新建商机"加）
      if (txt !== '编辑商机') continue;
      
      var card = h.closest('.fixed');
      if (!card || card.querySelector('.hermes-delete-btn-outer')) continue;

      // 找商机名称（h2前面的元素可能是名称）
      var oppName = '';
      var allText = card.querySelectorAll('h2, h3, div, span');
      // 简单取卡片里第一个看起来像标题的文本
      var nameH = card.querySelector('[class*="text-17"], [class*="text-16"], [class*="font-semibold"]');
      if (nameH && nameH !== h) oppName = nameH.textContent.trim().split('\n')[0];

      var wrapper = document.createElement('div');
      wrapper.className = 'hermes-delete-btn-outer';
      var delBtn = document.createElement('button');
      delBtn.className = 'hermes-delete-btn-inner';
      delBtn.textContent = '删除商机';
      delBtn.onclick = function() {
        var name = oppName || '这条';
        if (!confirm('确定删除「' + name + '」？')) return;
        if (typeof window.deleteOpp === 'function') {
          window.deleteOpp(name);
        }
      };
      wrapper.appendChild(delBtn);
      
      // 插到 h2 的父容器后面（整个卡片内容区）
      var parent = h.parentElement;
      if (parent) parent.appendChild(wrapper);
    }
  }

  // ===== 持续观察 =====
  const observer = new MutationObserver(() => {
    tryInjectQuickFill();
    tryInjectDeleteButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(function() {
    tryInjectQuickFill();
    tryInjectDeleteButton();
  }, 2000);

  // 等 React 渲染完成后启动
  setTimeout(function() {
    tryInjectQuickFill();
    tryInjectDeleteButton();
  }, 1500);
})();
