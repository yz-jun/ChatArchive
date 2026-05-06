/**
 * ChatArchive v3.4 - Popup Script
 * 新增：TODO 管理 / 单条删除 / #tag 标签筛选 / 三 Tab 布局
 */

const $ = id => document.getElementById(id);
const modelTabs = $('modelTabs');
const apiKeyInput = $('apiKeyInput');
const btnTest = $('btnTest');
const btnSave = $('btnSave');
const keyStatus = $('keyStatus');
const keyInfo = $('keyInfo');
const searchInput = $('searchInput');
const filterTabs = $('filterTabs');
const archiveList = $('archiveList');
const tagCloud = $('tagCloud');

let allArchives = [];
let allTodos = [];
let currentFilter = 'all';
let currentSearch = '';
let currentTag = null;
let models = [];
let selectedModel = 'deepseek';
let apiKeys = {};
let selectedPriority = 'medium';

// ============================================================
// 初始化
// ============================================================
async function init() {
  await loadModels();
  await loadSettings();
  await loadArchives();
  await loadTodos();
  setupMainTabs();
  setupPriorityButtons();
}

// ============================================================
// 主 Tab 切换
// ============================================================
function setupMainTabs() {
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      if (tabId === 'archives') $('tabArchives').classList.add('active');
      else if (tabId === 'todos') $('tabTodos').classList.add('active');
      else if (tabId === 'settings') $('tabSettings').classList.add('active');
    });
  });
}

// ============================================================
// 模型管理
// ============================================================
async function loadModels() {
  chrome.runtime.sendMessage({ type: 'GET_MODEL_CONFIG' }, (response) => {
    if (response?.models) {
      models = response.models;
      renderModelTabs();
    }
  });
}

function renderModelTabs() {
  modelTabs.innerHTML = models.map(m =>
    `<div class="model-tab ${m.id === selectedModel ? 'active' : ''}" data-model="${m.id}">${m.name}</div>`
  ).join('');

  modelTabs.querySelectorAll('.model-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      selectedModel = tab.dataset.model;
      renderModelTabs();
      apiKeyInput.value = apiKeys[selectedModel] || '';
      updateKeyInfo();
      keyStatus.textContent = '';
    });
  });
}

function updateKeyInfo() {
  const model = models.find(m => m.id === selectedModel);
  if (model) {
    keyInfo.innerHTML = `
      <span>Key 格式: ${model.keyHint}</span>
      <span>|</span>
      <span>${model.keyDesc}</span>
      <span>|</span>
      <a href="${model.keyUrl}" target="_blank">获取 Key →</a>
    `;
    apiKeyInput.placeholder = `请输入 ${model.name} API Key（${model.keyHint}）`;
  }
}

// ============================================================
// 设置管理
// ============================================================
async function loadSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (response) {
      selectedModel = response.selectedModel || 'deepseek';
      apiKeys = response.apiKeys || {};
      apiKeyInput.value = apiKeys[selectedModel] || '';
      renderModelTabs();
      updateKeyInfo();
    }
  });
}

async function saveSettings() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = '⚠️ 请输入 API Key';
    keyStatus.style.color = '#e67e22';
    return;
  }
  apiKeys[selectedModel] = key;
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', selectedModel, apiKeys }, (response) => {
    if (response?.success) {
      keyStatus.textContent = '✅ 已保存！';
      keyStatus.style.color = '#27ae60';
    }
  });
}

async function testApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = '⚠️ 请先输入 API Key';
    keyStatus.style.color = '#e67e22';
    return;
  }
  keyStatus.textContent = '⏳ 测试中...';
  keyStatus.style.color = '#666';
  btnTest.disabled = true;

  chrome.runtime.sendMessage({ type: 'TEST_API_KEY', model: selectedModel, apiKey: key }, (response) => {
    btnTest.disabled = false;
    if (response) {
      keyStatus.textContent = response.message;
      keyStatus.style.color = response.success ? '#27ae60' : '#c0392b';
    }
  });
}

// ============================================================
// 存档管理
// ============================================================
async function loadArchives() {
  chrome.storage.local.get('chatArchives', (result) => {
    allArchives = result.chatArchives || [];
    updateStats();
    renderTagCloud();
    renderArchives();
  });
}

function updateStats() {
  $('totalArchives').textContent = allArchives.length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  $('todayArchives').textContent = allArchives.filter(a => a.createdAt >= today.getTime()).length;
  $('platformCount').textContent = new Set(allArchives.map(a => a.platform)).size;
}

// ============================================================
// 标签云
// ============================================================
function getAllTags() {
  const tagCount = {};
  allArchives.forEach(a => {
    (a.tags || []).forEach(t => {
      tagCount[t] = (tagCount[t] || 0) + 1;
    });
  });
  return Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
}

function renderTagCloud() {
  const tags = getAllTags();
  if (tags.length === 0) {
    tagCloud.innerHTML = '<span class="tag-cloud-label">🏷️ 标签:</span><span style="font-size:10px;color:#ccc;">暂无标签</span>';
    return;
  }
  tagCloud.innerHTML = '<span class="tag-cloud-label">🏷️ 标签:</span>' +
    tags.map(([tag, count]) =>
      `<span class="tag-chip ${currentTag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)} (${count})</span>`
    ).join('') +
    (currentTag ? '<span class="tag-chip" data-tag="__clear" style="background:#fde8e8;color:#c0392b;">✕ 清除筛选</span>' : '');

  tagCloud.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (tag === '__clear') {
        currentTag = null;
      } else {
        currentTag = currentTag === tag ? null : tag;
      }
      renderTagCloud();
      renderArchives();
    });
  });
}

// ============================================================
// 存档列表渲染
// ============================================================
function renderArchives() {
  let filtered = [...allArchives];

  // 分类筛选
  if (currentFilter !== 'all') {
    filtered = filtered.filter(a => a.category === currentFilter);
  }

  // 标签筛选
  if (currentTag) {
    filtered = filtered.filter(a => (a.tags || []).includes(currentTag));
  }

  // 搜索
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(a =>
      a.summary.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.keyPoints || []).some(p => p.toLowerCase().includes(q)) ||
      a.platformName.toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (a.conversationTitle || '').toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => b.createdAt - a.createdAt);

  if (filtered.length === 0) {
    archiveList.innerHTML = `<div class="empty-state"><div class="icon">📭</div><div class="text">${currentSearch || currentFilter !== 'all' || currentTag ? '没有匹配的存档' : '暂无存档记录<br>在 AI 对话页面点击「保存存档点」开始'}</div></div>`;
    return;
  }

  archiveList.innerHTML = filtered.map(a => {
    const catClass = getCatClass(a.category);
    const time = new Date(a.createdAt).toLocaleString('zh-CN');
    const points = (a.keyPoints || []).slice(0, 3).map(p => `<div style="font-size:11px;color:#666;padding:1px 0;">• ${escapeHtml(p)}</div>`).join('');
    const titleHtml = a.conversationTitle
      ? `<div style="font-size:11px;color:#4A90D9;margin-bottom:3px;font-weight:500;">${a.conversationUrl ? `<a href="${escapeHtml(a.conversationUrl)}" target="_blank" style="color:#4A90D9;text-decoration:none;">💬 ${escapeHtml(a.conversationTitle)}</a>` : '💬 ' + escapeHtml(a.conversationTitle)}</div>`
      : '';
    const tagsHtml = (a.tags || []).map(t => `<span class="archive-tag">#${escapeHtml(t)}<span class="tag-del" data-archive-id="${a.id}" data-tag="${escapeHtml(t)}" title="删除标签">✕</span></span>`).join('');
    const addTagHtml = `<span class="archive-tag-add" data-archive-id="${a.id}" title="添加标签">+ 标签</span>`;
    return `<div class="archive-item" data-id="${a.id}">
      <button class="archive-del-btn" data-id="${a.id}" title="删除此存档">✕</button>
      ${titleHtml}
      <div class="archive-summary">${escapeHtml(a.summary)}</div>
      <div class="archive-meta">
        <span class="category-badge ${catClass}" data-archive-id="${a.id}" title="点击更改分类">${escapeHtml(a.category)}</span>
        <span>${a.platformName}</span>
        <span>${time}</span>
      </div>
      <div class="archive-tags">${tagsHtml}${addTagHtml}</div>
      ${points}
    </div>`;
  }).join('');

  // 绑定删除按钮
  archiveList.querySelectorAll('.archive-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const archiveId = e.target.dataset.id;
      if (confirm('确定删除此存档吗？')) {
        chrome.runtime.sendMessage({ type: 'DELETE_ARCHIVE', archiveId }, () => {
          allArchives = allArchives.filter(a => a.id !== archiveId);
          updateStats();
          renderTagCloud();
          renderArchives();
        });
      }
    });
  });

  // 绑定标签删除按钮
  archiveList.querySelectorAll('.tag-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const archiveId = btn.dataset.archiveId;
      const tag = btn.dataset.tag;
      const archive = allArchives.find(a => a.id === archiveId);
      if (archive) {
        archive.tags = (archive.tags || []).filter(t => t !== tag);
        chrome.storage.local.set({ chatArchives: allArchives }, () => {
          renderTagCloud();
          renderArchives();
        });
      }
    });
  });

  // 绑定添加标签按钮
  archiveList.querySelectorAll('.archive-tag-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const archiveId = btn.dataset.archiveId;
      const newTag = prompt('请输入新标签名称：');
      if (!newTag || !newTag.trim()) return;
      const tag = newTag.trim().replace(/^#/, '');
      const archive = allArchives.find(a => a.id === archiveId);
      if (archive) {
        if (!archive.tags) archive.tags = [];
        if (archive.tags.includes(tag)) {
          alert('该标签已存在');
          return;
        }
        archive.tags.push(tag);
        chrome.storage.local.set({ chatArchives: allArchives }, () => {
          renderTagCloud();
          renderArchives();
        });
      }
    });
  });

  // 绑定分类切换
  archiveList.querySelectorAll('.category-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const archiveId = badge.dataset.archiveId;
      const archive = allArchives.find(a => a.id === archiveId);
      if (!archive) return;
      const categories = ['代码开发', '文档写作', '研究分析', '学习笔记', '方案讨论', '问题排查', '其他'];
      const currentIndex = categories.indexOf(archive.category);
      const newCategory = categories[(currentIndex + 1) % categories.length];
      archive.category = newCategory;
      chrome.storage.local.set({ chatArchives: allArchives }, () => {
        renderArchives();
      });
    });
  });
}

function getCatClass(c) {
  return { '代码开发': 'cat-code', '文档写作': 'cat-write', '研究分析': 'cat-research', '学习笔记': 'cat-learn', '方案讨论': 'cat-discuss', '问题排查': 'cat-debug' }[c] || 'cat-other';
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ============================================================
// TODO 管理
// ============================================================
async function loadTodos() {
  chrome.runtime.sendMessage({ type: 'GET_TODOS' }, (response) => {
    if (response) {
      allTodos = response.todos || [];
      renderTodos();
    }
  });
}

function renderTodos() {
  const pending = allTodos.filter(t => !t.completed);
  const completed = allTodos.filter(t => t.completed);
  $('todoStats').textContent = `${pending.length} 待办 / ${completed.length} 完成`;

  // 排序：未完成在前，按优先级排序，再按创建时间
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...allTodos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
    return b.createdAt - a.createdAt;
  });

  if (sorted.length === 0) {
    $('todoList').innerHTML = '<div class="empty-state"><div class="icon">📝</div><div class="text">暂无待办事项<br>添加待办来管理你的工作延续性</div></div>';
    return;
  }

  $('todoList').innerHTML = sorted.map(t => {
    const tagsHtml = (t.tags || []).map(tag => `<span class="todo-tag">#${escapeHtml(tag)}</span>`).join('');
    const time = new Date(t.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const archiveLink = t.archiveId ? (() => {
      const archive = allArchives.find(a => a.id === t.archiveId);
      return archive ? `<span class="todo-archive-link" data-archive-id="${t.archiveId}" title="查看关联存档">📎 ${escapeHtml(archive.summary.substring(0, 20))}...</span>` : '';
    })() : '';
    return `<div class="todo-item priority-${t.priority} ${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <div class="todo-checkbox ${t.completed ? 'checked' : ''}" data-id="${t.id}">${t.completed ? '✓' : ''}</div>
      <div class="todo-body">
        <div class="todo-text">${escapeHtml(t.text)}</div>
        <div class="todo-meta">
          ${tagsHtml}
          <span class="todo-time">${time}</span>
          ${archiveLink}
        </div>
      </div>
      <button class="todo-del-btn" data-id="${t.id}" title="删除">✕</button>
    </div>`;
  }).join('');

  // 绑定事件
  $('todoList').querySelectorAll('.todo-checkbox').forEach(cb => {
    cb.addEventListener('click', () => {
      const id = cb.dataset.id;
      const todo = allTodos.find(t => t.id === id);
      if (todo) {
        chrome.runtime.sendMessage({ type: 'UPDATE_TODO', todoId: id, updates: { completed: !todo.completed } }, () => {
          todo.completed = !todo.completed;
          renderTodos();
        });
      }
    });
  });

  $('todoList').querySelectorAll('.todo-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('确定删除此待办吗？')) {
        chrome.runtime.sendMessage({ type: 'DELETE_TODO', todoId: id }, () => {
          allTodos = allTodos.filter(t => t.id !== id);
          renderTodos();
        });
      }
    });
  });

  // 关联存档链接点击
  $('todoList').querySelectorAll('.todo-archive-link').forEach(link => {
    link.addEventListener('click', () => {
      const archiveId = link.dataset.archiveId;
      // 切换到存档 tab 并高亮
      document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('.main-tab[data-tab="archives"]').classList.add('active');
      $('tabArchives').classList.add('active');
      // 搜索该存档
      const archive = allArchives.find(a => a.id === archiveId);
      if (archive) {
        searchInput.value = archive.summary.substring(0, 15);
        currentSearch = archive.summary.substring(0, 15);
        renderArchives();
      }
    });
  });
}

function setupPriorityButtons() {
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority-btn').forEach(b => {
        b.className = 'priority-btn';
      });
      selectedPriority = btn.dataset.priority;
      btn.classList.add(`active-${selectedPriority}`);
    });
  });
}

async function addTodo() {
  const text = $('todoInput').value.trim();
  if (!text) return;

  const tagText = $('todoTagInput').value.trim();
  const tags = tagText
    ? tagText.split(/[\s,，]+/).filter(Boolean).map(t => t.replace(/^#/, ''))
    : [];

  const todo = {
    text,
    tags,
    priority: selectedPriority,
    archiveId: null,
  };

  chrome.runtime.sendMessage({ type: 'ADD_TODO', todo }, (response) => {
    if (response?.success) {
      allTodos.push(response.todo);
      renderTodos();
      $('todoInput').value = '';
      $('todoTagInput').value = '';
    }
  });
}

// ============================================================
// 事件绑定
// ============================================================
btnSave.addEventListener('click', saveSettings);
btnTest.addEventListener('click', testApiKey);
apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveSettings(); });

searchInput.addEventListener('input', e => { currentSearch = e.target.value; renderArchives(); });
filterTabs.addEventListener('click', e => {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;
  filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentFilter = tab.dataset.filter;
  renderArchives();
});

$('btnAddTodo').addEventListener('click', addTodo);
$('todoInput').addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

$('btnClearCompleted').addEventListener('click', () => {
  if (confirm('确定清除所有已完成的待办吗？')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_COMPLETED_TODOS' }, () => {
      allTodos = allTodos.filter(t => !t.completed);
      renderTodos();
    });
  }
});

$('btnExportMd').addEventListener('click', async () => {
  const r = await sendMsg({ type: 'EXPORT_ARCHIVES', format: 'markdown' });
  if (r?.success) downloadFile(r.data, r.filename, 'text/markdown');
});
$('btnExportJson').addEventListener('click', async () => {
  const r = await sendMsg({ type: 'EXPORT_ARCHIVES', format: 'json' });
  if (r?.success) downloadFile(r.data, r.filename, 'application/json');
});
$('btnClear').addEventListener('click', async () => {
  if (confirm('确定要清空所有存档吗？此操作不可撤销。')) {
    await sendMsg({ type: 'CLEAR_ALL_ARCHIVES' });
    allArchives = []; updateStats(); renderTagCloud(); renderArchives();
  }
});

function sendMsg(msg) { return new Promise(r => chrome.runtime.sendMessage(msg, resp => r(resp))); }
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

init();
