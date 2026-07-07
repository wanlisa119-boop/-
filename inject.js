// ==========================================
// 快捷填写增强脚本 — 粘贴 + 语音 + 智能填充
// ==========================================
(function() {
  'use strict';

  // 注入自定义样式
  const style = document.createElement('style');
  style.textContent = `
    .quick-fill-section {
      background: var(--bg-card);
      box-shadow: var(--shadow-card);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .quick-fill-section .qf-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .quick-fill-section .qf-header h3 {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .quick-fill-section .qf-header .qf-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(0,122,255,0.12);
      color: #007AFF;
    }
    .qf-textarea {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.6;
      resize: vertical;
      min-height: 80px;
      background: var(--bg-secondary);
      color: var(--text-body);
      border: none;
      outline: none;
      box-sizing: border-box;
      font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif;
    }
    .qf-textarea:focus {
      box-shadow: 0 0 0 2px rgba(0,122,255,0.3);
    }
    .qf-toolbar {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .qf-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--bg-secondary);
      color: var(--text-body);
    }
    .qf-btn:active {
      transform: scale(0.95);
    }
    .qf-btn.primary {
      background: #007AFF;
      color: #fff;
    }
    .qf-btn.primary:disabled {
      opacity: 0.4;
    }
    .qf-btn.danger {
      background: rgba(255,59,48,0.12);
      color: #FF3B30;
    }
    .qf-btn.recording {
      background: rgba(255,59,48,0.2);
      color: #FF3B30;
      animation: qf-pulse 1s infinite;
    }
    @keyframes qf-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.4); }
      50% { box-shadow: 0 0 0 8px rgba(255,59,48,0); }
    }
    .qf-extract-result {
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(52,199,89,0.1);
      border-radius: 8px;
      font-size: 12px;
      color: var(--text-secondary);
      display: none;
    }
    .qf-extract-result.show {
      display: block;
    }
    .qf-tips {
      font-size: 11px;
      color: var(--text-tertiary);
      margin-top: 6px;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);

  // ===== 智能解析函数 =====
  function smartParse(text) {
    const result = { name: '', client: '', amount: '', stage: '' };
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const t = line.trim();

      // 客户/公司
      const clientMatch = t.match(/(?:客户|公司|甲方|企业)(?:\s*[:：])?\s*(.+)/);
      if (clientMatch && !result.client) result.client = clientMatch[1].trim();

      // 金额
      const amtMatch = t.match(/(?:金额|预算|合同额|报价)(?:\s*[:：])?\s*(?:约|大概|预计)?\s*(\d+(?:[\.\,]\d+)?)\s*(?:万|万元|w|W)?/);
      if (amtMatch) result.amount = amtMatch[1].replace(',', '');

      // 项目/商机名称
      const nameMatch = t.match(/(?:项目|商机|名称|方案)(?:\s*[:：])?\s*(.+)/);
      if (nameMatch && !result.name) result.name = nameMatch[1].trim();

      // 阶段
      const stages = ['初步接触', '方案交流', '商务谈判', '赢单', '输单'];
      for (const s of stages) {
        if (t.includes(s)) { result.stage = s; break; }
      }

      // 如果没有明确标记，第一行可能是名称
      if (!result.name && line === lines[0]) {
        result.name = t;
      }
    }

    return result;
  }

  // ===== 检查并注入到表单 =====
  let injectionTimer = null;

  function tryInjectQuickFill() {
    // 找到表单的滚动内容区 (flex-1 overflow-y-auto)
    const formContent = document.querySelector('.fixed.inset-0.z-\\[80\\] .flex-1.overflow-y-auto');
    if (!formContent) return false;

    // 检查是否已经注入过
    if (formContent.querySelector('.quick-fill-section')) return true;

    // 找到"基本信息"section
    const sections = formContent.querySelectorAll('.space-y-5 > div');
    if (sections.length === 0) return false;

    const basicSection = sections[0]; // 基本信息是第一个section

    // 创建快捷填写区域
    const quickFill = document.createElement('div');
    quickFill.className = 'quick-fill-section';
    quickFill.innerHTML = `
      <div class="qf-header">
        <h3>📋 快捷填写</h3>
        <span class="qf-badge">粘贴 · 语音</span>
      </div>
      <textarea class="qf-textarea" placeholder="📌 参考格式：把聊天记录/邮件原文粘贴在这里&#10;&#10;示例：&#10;客户：华润数字科技有限公司&#10;项目：能源管理数字化升级项目二期&#10;金额：320万&#10;阶段：商务谈判&#10;联系人：李总"></textarea>
      <div class="qf-extract-result"></div>
      <div class="qf-toolbar">
        <button class="qf-btn" data-action="paste">📋 粘贴</button>
        <button class="qf-btn" data-action="voice">🎤 语音输入</button>
        <button class="qf-btn primary" data-action="fill" disabled>✨ 智能填充</button>
        <button class="qf-btn" data-action="clear" style="margin-left:auto;">清空</button>
      </div>
      <div class="qf-tips">💡 支持粘贴微信聊天记录、邮件原文，自动提取客户名、项目名、金额、阶段</div>
    `;

    // 注入到基本信息之前
    formContent.insertBefore(quickFill, formContent.firstChild);

    // ===== 绑定事件 =====
    const textarea = quickFill.querySelector('.qf-textarea');
    const fillBtn = quickFill.querySelector('[data-action="fill"]');
    const extractResult = quickFill.querySelector('.qf-extract-result');
    let recognition = null;
    let isRecording = false;
    const voiceBtn = quickFill.querySelector('[data-action="voice"]');

    // 输入检测 - 有内容时启用填充按钮
    textarea.addEventListener('input', () => {
      fillBtn.disabled = !textarea.value.trim();
    });

    // 粘贴按钮
    quickFill.querySelector('[data-action="paste"]').addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          textarea.value = text;
          textarea.dispatchEvent(new Event('input'));
          extractResult.textContent = '✅ 已粘贴 ' + text.length + ' 个字符';
          extractResult.className = 'qf-extract-result show';
          setTimeout(() => { extractResult.className = 'qf-extract-result'; }, 2000);
        }
      } catch (err) {
        extractResult.textContent = '⚠️ 无法读取剪贴板，请手动 Ctrl+V';
        extractResult.className = 'qf-extract-result show';
      }
    });

    // 语音输入按钮 - 兼容多种浏览器
    voiceBtn.addEventListener('click', () => {
      // 检测可用的语音识别API
      const SpeechRecognitionAPI = window.SpeechRecognition || 
                                    window.webkitSpeechRecognition ||
                                    window.mozSpeechRecognition ||
                                    window.msSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        extractResult.textContent = '⚠️ 当前浏览器不支持语音输入。如需使用，请用手机Chrome/Edge浏览器打开';
        extractResult.className = 'qf-extract-result show';
        return;
      }

      if (isRecording) {
        recognition.stop();
        return;
      }

      try {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;  // 连续识别
        recognition.interimResults = true;

        recognition.onstart = () => {
          isRecording = true;
          voiceBtn.className = 'qf-btn recording';
          voiceBtn.textContent = '⏹ 点击停止';
          extractResult.textContent = '🎤 正在录音，请说话… 说完点击"停止"';
          extractResult.className = 'qf-extract-result show';
        };

        recognition.onresult = (event) => {
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalText += event.results[i][0].transcript;
            }
          }
          if (finalText) {
            textarea.value += finalText;
            textarea.dispatchEvent(new Event('input'));
            textarea.scrollTop = textarea.scrollHeight;
          }
        };

        recognition.onend = () => {
          isRecording = false;
          voiceBtn.className = 'qf-btn';
          voiceBtn.textContent = '🎤 语音输入';
          if (textarea.value) {
            extractResult.textContent = '✅ 语音识别完成';
            extractResult.className = 'qf-extract-result show';
            setTimeout(() => { extractResult.className = 'qf-extract-result'; }, 2000);
          }
        };

        recognition.onerror = (event) => {
          isRecording = false;
          voiceBtn.className = 'qf-btn';
          voiceBtn.textContent = '🎤 语音输入';
          
          let errMsg = '⚠️ 语音识别失败';
          if (event.error === 'not-allowed') {
            errMsg = '⚠️ 录音权限被拒绝，请在浏览器设置中允许麦克风权限';
          } else if (event.error === 'no-speech') {
            errMsg = '⚠️ 未检测到语音，请检查麦克风是否正常';
          } else if (event.error === 'network') {
            errMsg = '⚠️ 语音识别网络连接失败，请检查网络';
          } else if (event.error === 'aborted') {
            return; // 用户主动停止，不显示错误
          }
          extractResult.textContent = errMsg;
          extractResult.className = 'qf-extract-result show';
        };

        recognition.start();
      } catch (err) {
        extractResult.textContent = '⚠️ 语音功能启动失败: ' + err.message;
        extractResult.className = 'qf-extract-result show';
      }
    });

    // 智能填充按钮
    fillBtn.addEventListener('click', () => {
      const parsed = smartParse(textarea.value);

      // 找出表单中的各个输入框
      const inputs = formContent.querySelectorAll('input, textarea');
      const formInputs = Array.from(inputs);

      // 商机名称
      const nameInput = formInputs.find(el => el.placeholder === '请输入商机名称');
      if (parsed.name && nameInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(nameInput, parsed.name);
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 金额
      const amountInput = formInputs.find(el => el.placeholder === '请输入金额');
      if (parsed.amount && amountInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(amountInput, parsed.amount);
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 客户搜索框
      const clientInput = formInputs.find(el => el.placeholder && el.placeholder.includes('搜索或输入客户'));
      if (parsed.client && clientInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(clientInput, parsed.client);
        clientInput.dispatchEvent(new Event('input', { bubbles: true }));
        clientInput.dispatchEvent(new Event('focus', { bubbles: true }));
      }

      // 跟进阶段 - 点选对应的阶段按钮
      if (parsed.stage) {
        const stageBtns = formContent.querySelectorAll('.gap-2.overflow-x-auto button');
        stageBtns.forEach(btn => {
          if (btn.textContent.trim() === parsed.stage) {
            btn.click();
          }
        });
      }

      // 显示结果
      const filled = [];
      if (parsed.name) filled.push('✅ 商机名称');
      if (parsed.amount) filled.push('💰 金额');
      if (parsed.client) filled.push('🏢 客户');
      if (parsed.stage) filled.push('📌 阶段');
      extractResult.textContent = filled.length > 0
        ? '✨ 已自动填充: ' + filled.join(' · ')
        : '⚠️ 未能识别到关键信息，请检查输入格式';
      extractResult.className = 'qf-extract-result show';
      setTimeout(() => { extractResult.className = 'qf-extract-result'; }, 3000);
    });

    // 清空按钮
    quickFill.querySelector('[data-action="clear"]').addEventListener('click', () => {
      textarea.value = '';
      fillBtn.disabled = true;
    });

    return true;
  }

  // ===== 持续观察表单出现 =====
  function startObserver() {
    const observer = new MutationObserver(() => {
      if (tryInjectQuickFill()) {
        // 注入成功后停止观察
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // 等 React 渲染完成后启动
  if (document.readyState === 'complete') {
    setTimeout(startObserver, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(startObserver, 1000));
  }
})();
