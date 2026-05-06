/**
 * ChatArchive v3.4 - Background Service Worker
 * 支持：DeepSeek / Kimi(Moonshot) / ChatGPT(OpenAI) / Claude(Anthropic) / 千问(Qwen) / 豆包(Doubao)
 * 新增：TODO 管理 / 单条存档删除 / 标签筛选
 */

// ============================================================
// 模型配置
// ============================================================
const MODEL_CONFIG = {
  deepseek: {
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    authHeader: (key) => `Bearer ${key}`,
    buildBody: (model, messages) => JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    keyPrefix: 'sk-',
    keyHint: 'sk-xxxxxxxx',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyDesc: '新用户送 500 万 token',
  },
  kimi: {
    name: 'Kimi (Moonshot)',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k',
    authHeader: (key) => `Bearer ${key}`,
    buildBody: (model, messages) => JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    keyPrefix: '',
    keyHint: 'xxxxxxxxxxxxxxxx',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    keyDesc: '新用户送 15 元额度',
  },
  chatgpt: {
    name: 'ChatGPT (OpenAI)',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    authHeader: (key) => `Bearer ${key}`,
    buildBody: (model, messages) => JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    keyPrefix: 'sk-',
    keyHint: 'sk-xxxxxxxxxxxxxxxx',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyDesc: '按量付费',
  },
  claude: {
    name: 'Claude (Anthropic)',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-haiku-20240307',
    authHeader: (key) => key,
    buildBody: (model, messages) => {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
      return JSON.stringify({
        model,
        max_tokens: 500,
        system: systemMsg?.content || '',
        messages: userMessages,
      });
    },
    parseResponse: (data) => data.content?.[0]?.text || '',
    keyPrefix: 'sk-ant-',
    keyHint: 'sk-ant-xxxxxxxx',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyDesc: '按量付费',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  },
  qwen: {
    name: '千问 (Qwen)',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    authHeader: (key) => `Bearer ${key}`,
    buildBody: (model, messages) => JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    keyPrefix: 'sk-',
    keyHint: 'sk-xxxxxxxxxxxxxxxx',
    keyUrl: 'https://bailian.console.aliyun.com/#/api-key',
    keyDesc: '新用户送 100 万 token',
  },
  doubao: {
    name: '豆包 (Doubao)',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-pro-32k-240615',
    authHeader: (key) => `Bearer ${key}`,
    buildBody: (model, messages) => JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    keyPrefix: '',
    keyHint: 'xxxxxxxxxxxxxxxx',
    keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    keyDesc: '新用户送额度',
  },
};

// ============================================================
// 安装时初始化
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChatArchive v3.4] 扩展已安装');
  chrome.storage.local.set({
    chatArchives: [],
    todos: [],
    settings: {
      autoCleanupDays: 90,
      categories: ['代码开发', '文档写作', '研究分析', '学习笔记', '方案讨论', '问题排查', '其他'],
    },
    selectedModel: 'deepseek',
    apiKeys: {
      deepseek: '',
      kimi: '',
      chatgpt: '',
      claude: '',
      qwen: '',
      doubao: '',
    },
  });
});

// ============================================================
// 消息处理
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CALL_AI_SUMMARY':
      handleAICall(message.prompt, sendResponse);
      return true;

    case 'GET_MODEL_CONFIG':
      sendResponse({ models: getModelList() });
      break;

    case 'GET_SETTINGS':
      chrome.storage.local.get(['selectedModel', 'apiKeys'], (result) => {
        sendResponse({
          selectedModel: result.selectedModel || 'deepseek',
          apiKeys: result.apiKeys || {},
        });
      });
      return true;

    case 'SAVE_SETTINGS':
      chrome.storage.local.set({
        selectedModel: message.selectedModel,
        apiKeys: message.apiKeys,
      }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'TEST_API_KEY':
      testApiKey(message.model, message.apiKey, sendResponse);
      return true;

    case 'ARCHIVE_SAVED':
      handleArchiveSaved(message.archive);
      sendResponse({ success: true });
      break;

    case 'GET_ALL_ARCHIVES':
      chrome.storage.local.get('chatArchives', (result) => {
        sendResponse({ archives: result.chatArchives || [] });
      });
      return true;

    case 'DELETE_ARCHIVE':
      deleteArchive(message.archiveId).then(() => sendResponse({ success: true }));
      return true;

    case 'SEARCH_ARCHIVES':
      searchArchives(message.query).then((results) => sendResponse({ results }));
      return true;

    case 'EXPORT_ARCHIVES':
      exportArchives(message.format).then((data) => sendResponse(data));
      return true;

    case 'CLEAR_ALL_ARCHIVES':
      chrome.storage.local.set({ chatArchives: [] }, () => sendResponse({ success: true }));
      return true;

    // ============================================================
    // TODO 相关消息
    // ============================================================
    case 'GET_TODOS':
      chrome.storage.local.get('todos', (result) => {
        sendResponse({ todos: result.todos || [] });
      });
      return true;

    case 'ADD_TODO':
      addTodo(message.todo).then((todo) => sendResponse({ success: true, todo }));
      return true;

    case 'UPDATE_TODO':
      updateTodo(message.todoId, message.updates).then(() => sendResponse({ success: true }));
      return true;

    case 'DELETE_TODO':
      deleteTodo(message.todoId).then(() => sendResponse({ success: true }));
      return true;

    case 'CLEAR_COMPLETED_TODOS':
      clearCompletedTodos().then(() => sendResponse({ success: true }));
      return true;

    // 打开扩展设置页面（在新标签页中打开 popup）
    case 'OPEN_SETTINGS':
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
      sendResponse({ success: true });
      break;
  }
});

// ============================================================
// 核心：调用 AI API
// ============================================================
async function handleAICall(prompt, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['selectedModel', 'apiKeys']);
    const modelId = result.selectedModel || 'deepseek';
    const apiKeys = result.apiKeys || {};
    const apiKey = apiKeys[modelId];

    if (!apiKey) {
      const config = MODEL_CONFIG[modelId];
      sendResponse({
        success: false,
        error: `请先配置 ${config?.name || modelId} 的 API Key（点击插件图标 → 设置）`,
      });
      return;
    }

    const config = MODEL_CONFIG[modelId];
    if (!config) {
      sendResponse({ success: false, error: `不支持的模型: ${modelId}` });
      return;
    }

    console.log(`[ChatArchive v3.4] 调用 ${config.name} API...`);

    const messages = [
      { role: 'system', content: '你是一个对话总结助手。请严格按照用户要求的 JSON 格式输出，不要输出任何其他内容。' },
      { role: 'user', content: prompt },
    ];

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': config.authHeader(apiKey),
    };

    if (config.extraHeaders) {
      Object.assign(headers, config.extraHeaders);
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: config.buildBody(config.model, messages),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      console.error(`[ChatArchive v3.4] ${config.name} API 错误:`, errorMsg);
      sendResponse({ success: false, error: `API 错误: ${errorMsg}` });
      return;
    }

    const data = await response.json();
    const content = config.parseResponse(data);

    if (!content) {
      sendResponse({ success: false, error: 'API 返回内容为空' });
      return;
    }

    console.log(`[ChatArchive v3.4] ${config.name} 调用成功，内容长度:`, content.length);
    sendResponse({ success: true, content });

  } catch (error) {
    console.error('[ChatArchive v3.4] API 调用异常:', error);
    sendResponse({ success: false, error: `网络错误: ${error.message}` });
  }
}

// ============================================================
// 测试 API Key
// ============================================================
async function testApiKey(modelId, apiKey, sendResponse) {
  try {
    const config = MODEL_CONFIG[modelId];
    if (!config) {
      sendResponse({ success: false, error: '不支持的模型' });
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': config.authHeader(apiKey),
    };
    if (config.extraHeaders) Object.assign(headers, config.extraHeaders);

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: config.buildBody(config.model, [
        { role: 'user', content: '请回复"OK"' },
      ]),
    });

    if (response.ok) {
      sendResponse({ success: true, message: '✅ 连接成功！' });
    } else {
      const errorData = await response.json().catch(() => ({}));
      sendResponse({ success: false, message: `❌ ${errorData.error?.message || 'HTTP ' + response.status}` });
    }
  } catch (e) {
    sendResponse({ success: false, message: `❌ 网络错误: ${e.message}` });
  }
}

// ============================================================
// 辅助函数
// ============================================================
function getModelList() {
  return Object.entries(MODEL_CONFIG).map(([id, config]) => ({
    id,
    name: config.name,
    keyHint: config.keyHint,
    keyUrl: config.keyUrl,
    keyDesc: config.keyDesc,
  }));
}

function handleArchiveSaved(archive) {
  console.log('[ChatArchive v3.4] 新存档已保存:', archive.summary);
  updateBadge();
}

async function updateBadge() {
  const result = await chrome.storage.local.get('chatArchives');
  const count = (result.chatArchives || []).length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#4A90D9' });
}

async function deleteArchive(archiveId) {
  const result = await chrome.storage.local.get('chatArchives');
  const archives = (result.chatArchives || []).filter(a => a.id !== archiveId);
  await chrome.storage.local.set({ chatArchives: archives });
  updateBadge();
}

async function searchArchives(query) {
  const result = await chrome.storage.local.get('chatArchives');
  const archives = result.chatArchives || [];
  const q = query.toLowerCase();
  return archives.filter(a =>
    a.summary.toLowerCase().includes(q) ||
    a.category.toLowerCase().includes(q) ||
    (a.keyPoints || []).some(p => p.toLowerCase().includes(q)) ||
    (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
    a.platformName.toLowerCase().includes(q) ||
    (a.conversationTitle || '').toLowerCase().includes(q)
  );
}

async function exportArchives(format) {
  const result = await chrome.storage.local.get('chatArchives');
  const archives = result.chatArchives || [];

  if (format === 'json') {
    return { success: true, format: 'json', data: JSON.stringify(archives, null, 2), filename: 'chat-archives.json' };
  }

  if (format === 'markdown') {
    let md = '# ChatArchive 存档导出\n\n';
    md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `> 共 ${archives.length} 条存档\n\n---\n\n`;
    archives.forEach((a, i) => {
      md += `## ${i + 1}. ${a.summary}\n\n`;
      md += `- **平台**: ${a.platformName}\n`;
      if (a.conversationTitle) md += `- **对话**: ${a.conversationTitle}\n`;
      md += `- **分类**: ${a.category}\n`;
      md += `- **时间**: ${new Date(a.createdAt).toLocaleString('zh-CN')}\n`;
      md += `- **消息数**: ${a.messageCount}\n`;
      if (a.tags?.length) md += `- **标签**: ${a.tags.map(t => '#' + t).join(' ')}\n`;
      if (a.keyPoints?.length) {
        md += '\n### 要点\n';
        a.keyPoints.forEach(p => { md += `- ${p}\n`; });
      }
      md += '\n---\n\n';
    });
    return { success: true, format: 'markdown', data: md, filename: 'chat-archives.md' };
  }

  return { success: false, error: '不支持的格式' };
}

// ============================================================
// TODO 管理
// ============================================================
async function addTodo(todo) {
  const result = await chrome.storage.local.get('todos');
  const todos = result.todos || [];
  const newTodo = {
    id: `todo_${Date.now()}`,
    text: todo.text || '',
    tags: todo.tags || [],
    archiveId: todo.archiveId || null,
    priority: todo.priority || 'medium', // low, medium, high
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  todos.push(newTodo);
  await chrome.storage.local.set({ todos });
  return newTodo;
}

async function updateTodo(todoId, updates) {
  const result = await chrome.storage.local.get('todos');
  const todos = (result.todos || []).map(t => {
    if (t.id === todoId) {
      return {
        ...t,
        ...updates,
        completedAt: updates.completed === true ? Date.now() : (updates.completed === false ? null : t.completedAt),
      };
    }
    return t;
  });
  await chrome.storage.local.set({ todos });
}

async function deleteTodo(todoId) {
  const result = await chrome.storage.local.get('todos');
  const todos = (result.todos || []).filter(t => t.id !== todoId);
  await chrome.storage.local.set({ todos });
}

async function clearCompletedTodos() {
  const result = await chrome.storage.local.get('todos');
  const todos = (result.todos || []).filter(t => !t.completed);
  await chrome.storage.local.set({ todos });
}

// 定期清理
chrome.alarms.create('cleanup', { periodInMinutes: 1440 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    const result = await chrome.storage.local.get(['chatArchives', 'settings']);
    const archives = result.chatArchives || [];
    const days = result.settings?.autoCleanupDays || 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = archives.filter(a => a.createdAt > cutoff);
    if (filtered.length < archives.length) {
      await chrome.storage.local.set({ chatArchives: filtered });
      updateBadge();
    }
  }
});
