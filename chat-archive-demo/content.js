/**
 * ChatArchive v3.4 - Content Script
 * 新增：未配置API可点击跳转 / 单条存档删除 / 标签显示
 */

// ============================================================
// 1. 平台适配器
// ============================================================
const PLATFORM_ADAPTERS = {
  chatgpt: {
    name: 'ChatGPT',
    urlPattern: /chat\.openai\.com|chatgpt\.com/,
    selectors: { messageContainer: '[data-message-author-role]', conversationList: 'nav a[href*="/c/"]' },
    extractMessages() {
      const msgs = [];
      document.querySelectorAll(this.selectors.messageContainer).forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        const text = el.innerText?.trim();
        if (text && role) msgs.push({ role, text, timestamp: Date.now() });
      });
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"]');
      return el?.innerText?.trim() || document.title.replace('ChatGPT', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        items.push({ title: el.innerText?.trim() || '未命名对话', element: el, url: el.href || '' });
      });
      return items;
    },
  },
  claude: {
    name: 'Claude',
    urlPattern: /claude\.ai/,
    selectors: { messageContainer: '[class*="font-user-message"], [class*="font-claude-message"]', conversationList: '[class*="conversation"] a' },
    extractMessages() {
      const msgs = [];
      document.querySelectorAll(this.selectors.messageContainer).forEach(el => {
        const isUser = el.className?.includes('user');
        const text = el.innerText?.trim();
        if (text) msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
      });
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"]');
      return el?.innerText?.trim() || document.title.replace('Claude', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        items.push({ title: el.innerText?.trim() || '未命名对话', element: el, url: el.href || '' });
      });
      return items;
    },
  },
  gemini: {
    name: 'Gemini',
    urlPattern: /gemini\.google\.com/,
    selectors: { messageContainer: '.model-response, .user-query', conversationList: '[class*="conversation"]' },
    extractMessages() {
      const msgs = [];
      document.querySelectorAll(this.selectors.messageContainer).forEach(el => {
        const isUser = el.classList.contains('user-query');
        const text = el.innerText?.trim();
        if (text) msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
      });
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"]');
      return el?.innerText?.trim() || document.title.replace('Gemini', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        items.push({ title: el.innerText?.trim() || '未命名对话', element: el, url: el.href || '' });
      });
      return items;
    },
  },
  kimi: {
    name: 'Kimi',
    urlPattern: /kimi\.moonshot\.cn|www\.kimi\.com/,
    selectors: { messageContainer: '[class*="message-item"], [class*="chat-item"], [class*="message-wrapper"]', conversationList: '[class*="sidebar"] a, nav a, [class*="history"] a' },
    extractMessages() {
      const msgs = [];
      // 方法1：找消息容器
      const messageSelectors = [
        '[class*="message-item"]', '[class*="chat-item"]', '[class*="message-wrapper"]',
        '[class*="conversation-item"]', '[data-role="user"]', '[data-role="assistant"]',
        '[class*="message-list"] > div', '[class*="chat-list"] > div'
      ];
      for (const sel of messageSelectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (!text || text.length < 2) return;
            if (el.closest('nav') || el.closest('[class*="sidebar"]') || el.closest('[class*="header"]')) return;
            const isUser = el.getAttribute('data-role') === 'user' 
              || el.className?.includes('user') 
              || el.className?.includes('human')
              || el.querySelector('[class*="avatar-user"], [class*="user-avatar"]');
            msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
          });
          if (msgs.length > 0) return msgs;
        }
      }
      // 方法2：降级策略
      const chatContainer = document.querySelector('[class*="chat-container"], [class*="message-list"], [class*="conversation-content"]');
      if (chatContainer) {
        const children = chatContainer.children;
        for (const child of children) {
          const text = child.innerText?.trim();
          if (!text || text.length < 5 || text.length > 10000) continue;
          if (child.closest('nav') || child.closest('[class*="sidebar"]')) continue;
          const isUser = child.className?.includes('user') || child.querySelector('[class*="user"]');
          msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
        }
        if (msgs.length > 0) return msgs;
      }
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"], [class*="conversation-title"]');
      return el?.innerText?.trim() || document.title.replace('Kimi', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        const title = el.innerText?.trim();
        if (title && title.length > 0 && title.length < 100) {
          items.push({ title, element: el, url: el.href || '' });
        }
      });
      return items;
    },
  },
  deepseek: {
    name: 'DeepSeek',
    urlPattern: /chat\.deepseek\.com/,
    selectors: {
      chatContainer: '.dad65929',
      conversationList: 'nav a, [class*="sidebar"] a[href*="/"]',
    },
    extractMessages() {
      const msgs = [];
      const container = document.querySelector('.dad65929');
      if (container) {
        container.querySelectorAll(':scope > div > div').forEach(bubble => {
          const text = bubble.innerText?.trim();
          if (!text || text.length < 3) return;
          const isUser = bubble.querySelector('[class*="fbb737a4"]') !== null
            || bubble.querySelector('[data-testid*="user"]') !== null
            || bubble.querySelector('[class*="user-"]') !== null;
          msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
        });
        if (msgs.length > 0) return msgs;
      }
      document.querySelectorAll('div[class*="ds-markdown"]').forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length > 3) {
          const parent = el.closest('[class*="fbb737a4"]');
          msgs.push({ role: parent ? 'user' : 'assistant', text, timestamp: Date.now() });
        }
      });
      if (msgs.length > 0) return msgs;
      document.querySelectorAll('[class*="flex"][class*="gap"]').forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length > 10 && text.length < 50000) {
          if (el.closest('nav') || el.closest('[class*="sidebar"]') || el.closest('[class*="header"]')) return;
          msgs.push({ role: 'unknown', text, timestamp: Date.now() });
        }
      });
      return msgs;
    },
    getConversationTitle() {
      const selectors = [
        '[class*="header"] h3', 'h3[class*="title"]',
        '[class*="chat-header"] h3', '[class*="header"] [class*="title"]',
        'h3', '[class*="conversation-title"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText?.trim()) return el.innerText.trim();
      }
      return document.title?.replace('DeepSeek', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        const title = el.innerText?.trim();
        if (title && title.length > 0 && title.length < 100) {
          items.push({ title, element: el, url: el.href || '' });
        }
      });
      return items;
    },
  },
  qwen: {
    name: '千问',
    urlPattern: /qianwen\.com|www\.qianwen\.com|tongyi\.aliyun\.com|chat\.qwen\.ai/,
    selectors: { messageContainer: '[class*="message"][class*="item"], [class*="chat-item"], [class*="message-wrapper"]', conversationList: '[class*="sidebar"] a, nav a' },
    extractMessages() {
      const msgs = [];
      // 方法1：找消息容器（而不是内部的markdown元素）
      const messageSelectors = [
        '[class*="message-item"]', '[class*="chat-item"]', '[class*="message-wrapper"]',
        '[class*="conversation-item"]', '[data-role="user"]', '[data-role="assistant"]',
        '[class*="message-list"] > div', '[class*="chat-list"] > div'
      ];
      for (const sel of messageSelectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (!text || text.length < 2) return;
            // 排除侧边栏、导航等非消息元素
            if (el.closest('nav') || el.closest('[class*="sidebar"]') || el.closest('[class*="header"]')) return;
            // 判断角色
            const isUser = el.getAttribute('data-role') === 'user' 
              || el.className?.includes('user') 
              || el.className?.includes('human')
              || el.querySelector('[class*="avatar-user"], [class*="user-avatar"]');
            msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
          });
          if (msgs.length > 0) return msgs;
        }
      }
      // 方法2：降级策略 - 找对话区域的大块内容
      const chatContainer = document.querySelector('[class*="chat-container"], [class*="message-list"], [class*="conversation-content"]');
      if (chatContainer) {
        const children = chatContainer.children;
        for (const child of children) {
          const text = child.innerText?.trim();
          if (!text || text.length < 5 || text.length > 10000) continue;
          if (child.closest('nav') || child.closest('[class*="sidebar"]')) continue;
          const isUser = child.className?.includes('user') || child.querySelector('[class*="user"]');
          msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
        }
        if (msgs.length > 0) return msgs;
      }
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"], [class*="conversation-title"]');
      return el?.innerText?.trim() || document.title.replace('通义千问', '').replace('千问', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        const title = el.innerText?.trim();
        if (title && title.length > 0 && title.length < 100) {
          items.push({ title, element: el, url: el.href || '' });
        }
      });
      return items;
    },
  },
  doubao: {
    name: '豆包',
    urlPattern: /www\.doubao\.com|doubao\.com/,
    selectors: { messageContainer: '[class*="message-item"], [class*="chat-item"], [class*="message-wrapper"]', conversationList: '[class*="sidebar"] a, nav a, [class*="history"] a' },
    extractMessages() {
      const msgs = [];
      // 方法1：找消息容器
      const messageSelectors = [
        '[class*="message-item"]', '[class*="chat-item"]', '[class*="message-wrapper"]',
        '[class*="conversation-item"]', '[data-role="user"]', '[data-role="assistant"]',
        '[class*="message-list"] > div', '[class*="chat-list"] > div'
      ];
      for (const sel of messageSelectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (!text || text.length < 2) return;
            if (el.closest('nav') || el.closest('[class*="sidebar"]') || el.closest('[class*="header"]')) return;
            const isUser = el.getAttribute('data-role') === 'user'
              || el.className?.includes('user')
              || el.className?.includes('human')
              || el.querySelector('[class*="avatar-user"], [class*="user-avatar"]');
            msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
          });
          if (msgs.length > 0) return msgs;
        }
      }
      // 方法2：降级策略
      const chatContainer = document.querySelector('[class*="chat-container"], [class*="message-list"], [class*="conversation-content"]');
      if (chatContainer) {
        const children = chatContainer.children;
        for (const child of children) {
          const text = child.innerText?.trim();
          if (!text || text.length < 5 || text.length > 10000) continue;
          if (child.closest('nav') || child.closest('[class*="sidebar"]')) continue;
          const isUser = child.className?.includes('user') || child.querySelector('[class*="user"]');
          msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
        }
        if (msgs.length > 0) return msgs;
      }
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"], [class*="conversation-title"]');
      return el?.innerText?.trim() || document.title.replace('豆包', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        const title = el.innerText?.trim();
        if (title && title.length > 0 && title.length < 100) {
          items.push({ title, element: el, url: el.href || '' });
        }
      });
      return items;
    },
  },
  bohrium: {
    name: '玻尔',
    urlPattern: /www\.bohrium\.com/,
    selectors: { messageContainer: '[class*="message-item"], [class*="chat-item"], [class*="message-wrapper"]', conversationList: '[class*="sidebar"] a, nav a, [class*="history"] a, [class*="chat-list"] a' },
    extractMessages() {
      const msgs = [];
      // 方法1：找消息容器
      const messageSelectors = [
        '[class*="message-item"]', '[class*="chat-item"]', '[class*="message-wrapper"]',
        '[class*="conversation-item"]', '[data-role="user"]', '[data-role="assistant"]',
        '[class*="message-list"] > div', '[class*="chat-list"] > div'
      ];
      for (const sel of messageSelectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) {
          elements.forEach(el => {
            const text = el.innerText?.trim();
            if (!text || text.length < 2) return;
            if (el.closest('nav') || el.closest('[class*="sidebar"]') || el.closest('[class*="header"]')) return;
            const isUser = el.getAttribute('data-role') === 'user'
              || el.className?.includes('user')
              || el.className?.includes('human')
              || el.querySelector('[class*="avatar-user"], [class*="user-avatar"]');
            msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
          });
          if (msgs.length > 0) return msgs;
        }
      }
      // 方法2：降级策略
      const chatContainer = document.querySelector('[class*="chat-container"], [class*="message-list"], [class*="conversation-content"]');
      if (chatContainer) {
        const children = chatContainer.children;
        for (const child of children) {
          const text = child.innerText?.trim();
          if (!text || text.length < 5 || text.length > 10000) continue;
          if (child.closest('nav') || child.closest('[class*="sidebar"]')) continue;
          const isUser = child.className?.includes('user') || child.querySelector('[class*="user"]');
          msgs.push({ role: isUser ? 'user' : 'assistant', text, timestamp: Date.now() });
        }
        if (msgs.length > 0) return msgs;
      }
      return msgs;
    },
    getConversationTitle() {
      const el = document.querySelector('h1, [class*="title"], [class*="conversation-title"], [class*="chat-title"]');
      return el?.innerText?.trim() || document.title.replace('玻尔', '').replace('Bohrium', '').trim() || '未命名对话';
    },
    getConversationList() {
      const items = [];
      document.querySelectorAll(this.selectors.conversationList).forEach(el => {
        const title = el.innerText?.trim();
        if (title && title.length > 0 && title.length < 100) {
          items.push({ title, element: el, url: el.href || '' });
        }
      });
      return items;
    },
  },
};

// ============================================================
// 通用辅助函数：从对话列表获取当前激活的对话标题
// ============================================================
function getActiveConversationTitle(adapter) {
  if (!adapter || !adapter.getConversationList) return null;
  
  const currentUrl = window.location.href;
  const currentPath = window.location.pathname;
  const conversations = adapter.getConversationList();
  
  // 方法1：查找URL完全匹配或包含的对话（最可靠）
  for (const conv of conversations) {
    if (!conv.url) continue;
    if (conv.url === currentUrl || currentUrl.startsWith(conv.url) || conv.url.startsWith(currentUrl)) {
      return conv.title;
    }
  }
  
  // 方法2：查找URL路径匹配
  for (const conv of conversations) {
    if (!conv.url) continue;
    try {
      const convUrl = new URL(conv.url, window.location.origin);
      if (convUrl.pathname === currentPath) {
        return conv.title;
      }
      // 路径包含匹配（处理嵌套路由）
      if (currentPath.includes(convUrl.pathname) && convUrl.pathname.length > 1) {
        return conv.title;
      }
    } catch (e) {}
  }
  
  // 方法3：在对话列表中查找当前激活/选中的元素
  // 遍历所有对话列表元素，找到带有 active/selected 样式的那个
  const listItems = document.querySelectorAll(adapter.selectors?.conversationList || 'nav a, [class*="sidebar"] a');
  let bestMatch = null;
  let bestMatchScore = 0;
  
  for (const el of listItems) {
    const elUrl = el.href || '';
    const elText = el.innerText?.trim();
    if (!elText || elText.length > 100) continue;
    
    let score = 0;
    
    // 检查URL匹配
    if (elUrl && (elUrl === currentUrl || currentUrl.startsWith(elUrl))) {
      score += 10; // URL完全匹配，最高优先级
    } else if (elUrl) {
      try {
        const elPath = new URL(elUrl, window.location.origin).pathname;
        if (elPath === currentPath) score += 8;
        else if (currentPath.includes(elPath) && elPath.length > 1) score += 5;
      } catch (e) {}
    }
    
    // 检查active/selected状态
    const classList = el.className || '';
    const parentClass = el.parentElement?.className || '';
    if (classList.includes('active') || parentClass.includes('active')) score += 3;
    if (classList.includes('selected') || parentClass.includes('selected')) score += 3;
    if (classList.includes('current') || parentClass.includes('current')) score += 2;
    if (el.getAttribute('aria-selected') === 'true') score += 3;
    if (el.getAttribute('aria-current') === 'true') score += 2;
    
    // 检查背景色变化（激活项通常有不同的背景色）
    const computedBg = window.getComputedStyle(el).backgroundColor;
    const parentBg = window.getComputedStyle(el.parentElement).backgroundColor;
    if (computedBg !== parentBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
      score += 1;
    }
    
    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestMatch = elText.split('\n')[0].trim();
    }
  }
  
  if (bestMatch && bestMatchScore >= 2) return bestMatch;
  
  return null;
}

// ============================================================
// 2. 核心引擎
// ============================================================
class ChatArchiveEngine {
  constructor() {
    this.platform = null;
    this.adapter = null;
    this.messages = [];
    this.archives = [];
    this.observer = null;
    this.isSummarizing = false;
    this.selectedModelName = '';
    this._shadow = null;
  }

  init() {
    const url = window.location.href;
    for (const [key, adapter] of Object.entries(PLATFORM_ADAPTERS)) {
      if (adapter.urlPattern.test(url)) {
        this.platform = key;
        this.adapter = adapter;
        break;
      }
    }
    if (!this.adapter) {
      console.log('[ChatArchive] 当前页面不是支持的 AI 平台');
      return;
    }
    console.log(`[ChatArchive v3.4] 检测到平台: ${this.adapter.name}`);
    this.loadArchives();
    this.startObserving();
    this.injectFloatingPanel();
    setTimeout(() => this.injectSidebarTags(), 2000);
    setTimeout(() => {
      this.messages = this.adapter.extractMessages();
      this.updatePanelMessageCount();
      console.log(`[ChatArchive v3.4] 初始化提取到 ${this.messages.length} 条消息`);
    }, 3000);
    setTimeout(() => this.loadModelInfo(), 1000);
  }

  loadModelInfo() {
    chrome.storage.local.get(['selectedModel', 'apiKeys'], (result) => {
      const modelId = result.selectedModel || 'deepseek';
      const apiKeys = result.apiKeys || {};
      const hasKey = !!apiKeys[modelId];
      const names = { deepseek: 'DeepSeek', kimi: 'Kimi', chatgpt: 'ChatGPT', claude: 'Claude', qwen: '千问', doubao: '豆包', custom: '自定义' };
      this.selectedModelName = names[modelId] || modelId;
      const statusEl = this._getShadowElement('apiStatus');
      if (statusEl) {
        if (hasKey) {
          statusEl.textContent = this.selectedModelName + ' ✓';
          statusEl.className = 'api-status api-ok';
          statusEl.style.cursor = 'default';
          statusEl.title = 'API 已配置';
        } else {
          statusEl.textContent = '⚠️ 未配置API (点击配置)';
          statusEl.className = 'api-status api-no-key';
          statusEl.style.cursor = 'pointer';
          statusEl.title = '点击打开设置页面配置 API Key';
          // 点击跳转到设置（在新标签页打开 popup）
          statusEl.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
          });
        }
      }
    });
  }

  startObserving() {
    this.observer = new MutationObserver(() => {
      const newMessages = this.adapter.extractMessages();
      if (newMessages.length > this.messages.length) {
        this.messages = newMessages;
        this.updatePanelMessageCount();
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  async triggerSummary() {
    if (this.isSummarizing) {
      this.showPanelMessage('正在总结中，请稍候...');
      return;
    }
    this.messages = this.adapter.extractMessages();
    this.updatePanelMessageCount();
    if (this.messages.length === 0) {
      this.showPanelMessage('当前对话没有消息可以总结', true);
      return;
    }

    this.isSummarizing = true;
    const btn = this._getShadowElement('btnSummarize');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 总结中...'; }
    this.showPanelMessage('正在调用 AI 总结，请稍候...');

    const recentMsgs = this.messages.slice(-20);
    const conversationText = recentMsgs.map(m =>
      `${m.role === 'user' ? '用户' : 'AI'}: ${m.text}`
    ).join('\n\n');

    const prompt = `请用以下 JSON 格式总结这段 AI 对话的核心工作内容（只输出 JSON，不要输出其他任何内容）：

对话内容：
${conversationText}

JSON 格式要求：
{
  "summary": "一句话总结（50字以内）",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "category": "从以下选择一个：代码开发/文档写作/研究分析/学习笔记/方案讨论/问题排查/其他",
  "tags": ["标签1", "标签2"]
}`;

    chrome.runtime.sendMessage({ type: 'CALL_AI_SUMMARY', prompt }, (response) => {
      this.isSummarizing = false;
      if (btn) { btn.disabled = false; btn.textContent = '💾 保存存档点'; }

      if (chrome.runtime.lastError) {
        this.showPanelMessage('❌ 调用失败: ' + chrome.runtime.lastError.message, true);
        return;
      }
      if (response && response.success) {
        this.parseAndSaveSummary(response.content);
      } else {
        this.showPanelMessage('❌ 总结失败: ' + (response?.error || '未知错误'), true);
      }
    });
  }

  parseAndSaveSummary(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('未找到 JSON');
      const data = JSON.parse(jsonMatch[0]);
      // 优先从对话列表获取当前激活的对话标题，确保与左侧列表一致
      let convTitle = getActiveConversationTitle(this.adapter);
      if (!convTitle && this.adapter.getConversationTitle) {
        convTitle = this.adapter.getConversationTitle();
      }
      convTitle = convTitle || '未命名对话';
      const archive = {
        id: `${this.platform}_${Date.now()}`,
        platform: this.platform,
        platformName: this.adapter.name,
        conversationId: window.location.pathname,
        conversationTitle: convTitle,
        conversationUrl: window.location.href,
        summary: data.summary || '无摘要',
        keyPoints: data.keyPoints || [],
        category: data.category || '其他',
        tags: data.tags || [],
        messageCount: this.messages.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.archives.push(archive);
      this.saveArchives();
      this.updatePanelArchive(archive);
      this.showPanelMessage('✅ 存档点已保存！');
      chrome.runtime.sendMessage({ type: 'ARCHIVE_SAVED', archive });
    } catch (e) {
      this.showPanelMessage('⚠️ 格式解析失败，已保存原始文本');
      // 优先从对话列表获取当前激活的对话标题
      let convTitle = getActiveConversationTitle(this.adapter);
      if (!convTitle && this.adapter.getConversationTitle) {
        convTitle = this.adapter.getConversationTitle();
      }
      convTitle = convTitle || '未命名对话';
      const archive = {
        id: `${this.platform}_${Date.now()}`,
        platform: this.platform,
        platformName: this.adapter.name,
        conversationId: window.location.pathname,
        conversationTitle: convTitle,
        conversationUrl: window.location.href,
        summary: text.substring(0, 200),
        keyPoints: [],
        category: '其他',
        tags: [],
        messageCount: this.messages.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.archives.push(archive);
      this.saveArchives();
    }
  }

  async saveArchives() { chrome.storage.local.set({ chatArchives: this.archives }); }
  async loadArchives() {
    return new Promise((resolve) => {
      chrome.storage.local.get('chatArchives', (result) => {
        this.archives = result.chatArchives || [];
        resolve(this.archives);
      });
    });
  }

  // ============================================================
  // 3. 浮动面板 UI
  // ============================================================
  injectFloatingPanel() {
    const host = document.createElement('div');
    host.id = 'chat-archive-host';
    host.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .panel {
          width: 340px; background: #ffffff; border: 1px solid #e0e0e0;
          border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          overflow: hidden; transition: all 0.3s ease;
        }
        .panel.collapsed { width: 48px; height: 48px; border-radius: 50%; cursor: pointer; }
        .panel.collapsed .panel-body { display: none; }
        .panel.collapsed .panel-header { padding: 12px; justify-content: center; }
        .panel.collapsed .panel-header .title-text { display: none; }
        .panel.collapsed .panel-header .collapse-btn { display: none; }
        .panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; background: linear-gradient(135deg, #4A90D9, #357ABD);
          color: white; cursor: move;
        }
        .title-text { font-size: 14px; font-weight: 600; }
        .collapse-btn {
          background: none; border: none; color: white; cursor: pointer;
          font-size: 18px; padding: 2px 8px; border-radius: 4px; line-height: 1;
        }
        .collapse-btn:hover { background: rgba(255,255,255,0.2); }
        .panel-body { padding: 12px 16px; max-height: 450px; overflow-y: auto; }
        .status-bar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 12px; background: #f5f7fa; border-radius: 8px;
          margin-bottom: 12px; font-size: 12px; color: #666;
        }
        .msg-count { font-weight: 600; color: #4A90D9; }
        .api-status { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 500; }
        .api-ok { background: #d4edda; color: #155724; }
        .api-no-key { background: #fff3cd; color: #856404; cursor: pointer !important; }
        .api-no-key:hover { background: #ffeaa7; }
        .archive-list { display: flex; flex-direction: column; gap: 8px; }
        .archive-item {
          padding: 10px 12px; background: #f8f9fa; border-radius: 8px;
          border-left: 3px solid #4A90D9; cursor: default; transition: all 0.2s;
          position: relative;
        }
        .archive-title { font-size: 11px; color: #4A90D9; margin-bottom: 3px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
        .archive-title a { color: #4A90D9; text-decoration: none; }
        .archive-title a:hover { text-decoration: underline; }
        .archive-jump { font-size: 10px; color: #999; cursor: pointer; white-space: nowrap; }
        .archive-jump:hover { color: #4A90D9; }
        .archive-item:hover { background: #eef3fa; transform: translateX(2px); }
        .archive-item:hover .archive-delete { opacity: 1; }
        .archive-summary { font-size: 13px; color: #333; margin-bottom: 4px; line-height: 1.4; }
        .archive-meta { font-size: 11px; color: #999; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .category-tag { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; color: white; font-weight: 500; }
        .tag-item { display: inline-block; padding: 0px 5px; border-radius: 8px; font-size: 9px; background: #e8f4fd; color: #2980b9; margin-right: 3px; }
        .cat-code { background: #27ae60; } .cat-write { background: #e67e22; }
        .cat-research { background: #8e44ad; } .cat-learn { background: #2980b9; }
        .cat-discuss { background: #16a085; } .cat-debug { background: #c0392b; }
        .cat-other { background: #95a5a6; }
        .key-points { margin-top: 6px; }
        .key-point { font-size: 11px; color: #555; padding: 2px 0; display: flex; align-items: flex-start; gap: 4px; }
        .key-point::before { content: "\\2022"; color: #4A90D9; font-weight: bold; flex-shrink: 0; }
        .archive-delete {
          position: absolute; top: 8px; right: 8px; background: none; border: none;
          color: #ccc; cursor: pointer; font-size: 14px; padding: 2px 4px; border-radius: 4px;
          opacity: 0; transition: all 0.2s; line-height: 1;
        }
        .archive-delete:hover { color: #e74c3c; background: #fde8e8; }
        .action-bar { display: flex; gap: 8px; margin-top: 12px; }
        .btn {
          flex: 1; padding: 8px 12px; border: none; border-radius: 8px;
          font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .btn-primary { background: #4A90D9; color: white; }
        .btn-primary:hover { background: #357ABD; }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
        .btn-secondary { background: #e9ecef; color: #495057; }
        .btn-secondary:hover { background: #dee2e6; }
        .message { padding: 8px 12px; background: #fff3cd; border-radius: 8px;
          font-size: 12px; color: #856404; margin-bottom: 8px; display: none; line-height: 1.4; }
        .message.show { display: block; }
        .message.error { background: #f8d7da; color: #721c24; }
        .empty-state { text-align: center; padding: 20px; color: #999; font-size: 13px; }
        .empty-state .icon { font-size: 32px; margin-bottom: 8px; }
        .logo-mini { font-size: 20px; }
      </style>

      <div class="panel" id="panel">
        <div class="panel-header" id="panelHeader">
          <span class="logo-mini">📋</span>
          <span class="title-text">ChatArchive</span>
          <button class="collapse-btn" id="collapseBtn" title="折叠">−</button>
        </div>
        <div class="panel-body" id="panelBody">
          <div class="message" id="panelMessage"></div>
          <div class="status-bar">
            <span>平台: <strong>${this.adapter?.name || '未知'}</strong></span>
            <span>消息: <span class="msg-count" id="msgCount">0</span> 条</span>
            <span class="api-status" id="apiStatus">检查中...</span>
          </div>
          <div class="archive-list" id="archiveList">
            <div class="empty-state">
              <div class="icon">📭</div>
              <div>暂无存档，点击下方按钮创建</div>
            </div>
          </div>
          <div class="action-bar">
            <button class="btn btn-primary" id="btnSummarize">💾 保存存档点</button>
            <button class="btn btn-secondary" id="btnRefresh">🔄 刷新</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);
    this._shadow = shadow;

    const panel = shadow.getElementById('panel');
    const collapseBtn = shadow.getElementById('collapseBtn');
    const btnSummarize = shadow.getElementById('btnSummarize');
    const btnRefresh = shadow.getElementById('btnRefresh');

    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('collapsed');
      collapseBtn.textContent = panel.classList.contains('collapsed') ? '📋' : '−';
    });

    panel.addEventListener('click', () => {
      if (panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        collapseBtn.textContent = '−';
      }
    });

    btnSummarize.addEventListener('click', () => this.triggerSummary());
    btnRefresh.addEventListener('click', () => {
      this.messages = this.adapter.extractMessages();
      this.updatePanelMessageCount();
      this.loadModelInfo();
      this.showPanelMessage('已刷新');
    });

    this.makeDraggable(host, shadow.getElementById('panelHeader'));

    this.loadArchives().then(() => {
      if (this.archives.length > 0) {
        this.archives.slice(-3).reverse().forEach(a => this.updatePanelArchive(a));
      }
    });
  }

  makeDraggable(hostEl, handleEl) {
    let isDragging = false, startX, startY, origX, origY;
    handleEl.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = hostEl.getBoundingClientRect();
      origX = rect.left; origY = rect.top;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      hostEl.style.left = (origX + e.clientX - startX) + 'px';
      hostEl.style.top = (origY + e.clientY - startY) + 'px';
      hostEl.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  _getShadowElement(id) {
    if (!this._shadow) return null;
    return this._shadow.getElementById(id);
  }

  updatePanelMessageCount() {
    const el = this._getShadowElement('msgCount');
    if (el) el.textContent = this.messages.length;
  }

  showPanelMessage(text, isError = false) {
    const el = this._getShadowElement('panelMessage');
    if (el) {
      el.textContent = text;
      el.className = isError ? 'message error show' : 'message show';
      setTimeout(() => el.classList.remove('show'), 5000);
    }
  }

  updatePanelArchive(archive) {
    const listEl = this._getShadowElement('archiveList');
    if (!listEl) return;
    const catClass = this.getCategoryClass(archive.category);
    const time = new Date(archive.createdAt).toLocaleString('zh-CN');
    const pointsHtml = (archive.keyPoints || []).map(p => `<div class="key-point">${this.escapeHtml(p)}</div>`).join('');
    const tagsHtml = (archive.tags || []).map(t => `<span class="tag-item">#${this.escapeHtml(t)}</span>`).join('');
    const titleHtml = archive.conversationTitle
      ? `<div class="archive-title">💬 ${this.escapeHtml(archive.conversationTitle)} <span class="archive-jump" data-url="${this.escapeHtml(archive.conversationUrl || '')}">→ 跳转</span></div>`
      : '';
    const itemHtml = `
      <div class="archive-item" data-id="${archive.id}">
        <button class="archive-delete" data-id="${archive.id}" title="删除此存档">✕</button>
        ${titleHtml}
        <div class="archive-summary">${this.escapeHtml(archive.summary)}</div>
        <div class="archive-meta">
          <span class="category-tag ${catClass}">${this.escapeHtml(archive.category)}</span>
          <span>${archive.platformName}</span>
          <span>${time}</span>
          <span>${archive.messageCount} 条消息</span>
        </div>
        ${tagsHtml ? `<div style="margin-top:4px;">${tagsHtml}</div>` : ''}
        ${pointsHtml ? `<div class="key-points">${pointsHtml}</div>` : ''}
      </div>`;
    const emptyState = listEl.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    listEl.insertAdjacentHTML('afterbegin', itemHtml);

    // 绑定跳转链接事件
    const jumpBtn = listEl.querySelector('.archive-jump');
    if (jumpBtn && archive.conversationUrl) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(archive.conversationUrl, '_blank');
      });
    }

    // 绑定删除按钮事件
    const deleteBtn = listEl.querySelector(`.archive-delete[data-id="${archive.id}"]`);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const archiveId = e.target.dataset.id;
        if (confirm('确定删除此存档吗？')) {
          chrome.runtime.sendMessage({ type: 'DELETE_ARCHIVE', archiveId }, () => {
            const item = listEl.querySelector(`.archive-item[data-id="${archiveId}"]`);
            if (item) item.remove();
            this.archives = this.archives.filter(a => a.id !== archiveId);
            if (listEl.children.length === 0) {
              listEl.innerHTML = '<div class="empty-state"><div class="icon">📭</div><div>暂无存档，点击下方按钮创建</div></div>';
            }
            this.showPanelMessage('🗑️ 存档已删除');
          });
        }
      });
    }
  }

  getCategoryClass(category) {
    const map = { '代码开发': 'cat-code', '文档写作': 'cat-write', '研究分析': 'cat-research', '学习笔记': 'cat-learn', '方案讨论': 'cat-discuss', '问题排查': 'cat-debug' };
    return map[category] || 'cat-other';
  }

  escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  // ============================================================
  // 4. 侧边栏分类标签
  // ============================================================
  injectSidebarTags() {
    if (!this.adapter) return;
    const conversations = this.adapter.getConversationList();
    conversations.forEach(conv => {
      if (conv.element.querySelector('.ca-tag')) return;
      const tag = document.createElement('span');
      tag.className = 'ca-tag';
      tag.style.cssText = 'display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;font-size:10px;color:white;font-weight:500;background:#95a5a6;cursor:pointer;vertical-align:middle;';
      tag.textContent = '未分类';
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const cats = ['代码开发', '文档写作', '研究分析', '学习笔记', '方案讨论', '问题排查', '其他'];
        const next = cats[(cats.indexOf(tag.textContent) + 1) % cats.length];
        tag.textContent = next;
        const colors = { '代码开发': '#27ae60', '文档写作': '#e67e22', '研究分析': '#8e44ad', '学习笔记': '#2980b9', '方案讨论': '#16a085', '问题排查': '#c0392b', '其他': '#95a5a6' };
        tag.style.background = colors[next] || '#95a5a6';
      });
      conv.element.appendChild(tag);
    });
  }
}

// ============================================================
// 5. 启动
// ============================================================
const engine = new ChatArchiveEngine();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => engine.init());
} else {
  engine.init();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    sendResponse({ platform: engine.platform, platformName: engine.adapter?.name, messageCount: engine.messages.length, archiveCount: engine.archives.length });
  }
  if (msg.type === 'TRIGGER_SUMMARY') { engine.triggerSummary(); sendResponse({ success: true }); }
  if (msg.type === 'GET_ARCHIVES') { sendResponse({ archives: engine.archives }); }
});
