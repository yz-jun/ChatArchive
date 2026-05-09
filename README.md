# ChatArchive v3.4

AI 对话工作存档插件 - 多模型总结 · TODO 管理 · 标签筛选

[English](#english) | [中文](#中文)

---

## 中文

### 📋 简介

ChatArchive 是一个 Chrome 浏览器扩展，帮助你将与 AI 的对话内容自动总结并保存为"工作存档点"。支持几大常用AI平台，让你下次打开对话时能快速恢复上下文。

### ✨ 核心功能

- **🤖 多模型智能总结**：支持 DeepSeek、Kimi、ChatGPT、Claude、千问、豆包 6 种 AI 模型生成摘要
- **📦 工作存档点**：自动保存对话标题、摘要、要点、分类、标签、跳转链接
- **🏷️ #tag 标签筛选**：自动提取标签，支持标签云筛选
- **✅ TODO 待办管理**：添加待办事项，设置优先级，关联存档
- **🎯 对话分类**：7 种预设分类，支持手动调整
- **🔍 全局搜索**：全文搜索所有存档内容
- **📤 导出功能**：支持 Markdown / JSON 格式导出
- **🔒 隐私安全**：所有数据本地存储，关闭浏览器不丢失

### 🌐 支持的 AI 平台

| 平台 | 网址 |
|------|------|
| ChatGPT | chatgpt.com, chat.openai.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| DeepSeek | chat.deepseek.com |
| Kimi | kimi.moonshot.cn, www.kimi.com |
| 千问 (Qwen) | qianwen.com, tongyi.aliyun.com, chat.qwen.ai |
| 豆包 | doubao.com |
| 玻尔 (Bohrium) | www.bohrium.com |

### 📦 安装方法

1. 下载本项目代码
2. 打开 Chrome 扩展管理页面：`chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `chat-archive-demo` 文件夹

### ⚙️ 首次配置

1. 点击扩展图标，切换到「⚙️ 设置」Tab
2. 选择你喜欢的 AI 总结模型（推荐 DeepSeek）
3. 点击「获取 Key →」链接，到对应平台申请 API Key
4. 粘贴 Key 到输入框，点击「测试」验证，然后「保存」

### 🚀 使用方法

1. 打开任意支持的 AI 平台，开始对话
2. 点击右上角浮动面板的「💾 保存存档点」按钮
3. 插件会自动调用 AI API 生成摘要并保存
4. 点击扩展图标查看所有存档、搜索、筛选、导出

### 📁 项目结构

```
chat-archive-demo/
├── manifest.json      # Chrome 扩展配置
├── content.js         # 内容脚本（平台适配 + UI）
├── background.js      # 后台服务（AI API + 存储）
├── popup/
│   ├── popup.html     # Popup 界面
│   └── popup.js       # Popup 逻辑
└── icons/             # 扩展图标
```

### 📄 文档

- [使用指南](./ChatArchive_Usage_Guide_v3.4.docx)
- [设计文档](./ChatArchive_Design_Document_v3.4.docx)

---

## English

### 📋 Introduction

ChatArchive is a Chrome browser extension that helps you automatically summarize and save AI conversations as "work archive points". Supports 9 major AI platforms, allowing you to quickly restore context when reopening conversations.

### ✨ Core Features

- **🤖 Multi-Model Summarization**: Support 6 AI models (DeepSeek, Kimi, ChatGPT, Claude, Qwen, Doubao)
- **📦 Work Archive Points**: Auto-save title, summary, key points, category, tags, jump link
- **🏷️ #tag Filtering**: Auto-extract tags with tag cloud filtering
- **✅ TODO Management**: Add todos with priority and archive linking
- **🎯 Conversation Classification**: 7 preset categories with manual adjustment
- **🔍 Global Search**: Full-text search across all archives
- **📤 Export**: Markdown / JSON export support
- **🔒 Privacy First**: All data stored locally, persists after browser close

### 🌐 Supported AI Platforms

| Platform | URL |
|----------|-----|
| ChatGPT | chatgpt.com, chat.openai.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| DeepSeek | chat.deepseek.com |
| Kimi | kimi.moonshot.cn, www.kimi.com |
| Qwen | qianwen.com, tongyi.aliyun.com, chat.qwen.ai |
| Doubao | doubao.com |
| Bohrium | www.bohrium.com |

### 📦 Installation

1. Download this project
2. Open Chrome extensions page: `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `chat-archive-demo` folder

### ⚙️ First Time Setup

1. Click the extension icon, switch to "⚙️ Settings" tab
2. Choose your preferred AI summarization model (DeepSeek recommended)
3. Click "Get Key →" link to apply for API Key
4. Paste the Key, click "Test" to verify, then "Save"

### 🚀 Usage

1. Open any supported AI platform and start chatting
2. Click the "💾 Save Archive" button in the floating panel
3. The extension will call AI API to generate summary and save
4. Click the extension icon to view, search, filter, and export archives

---

## 📜 License

MIT License

## 👤 Author

Created by [yz-jun](https://github.com/yz-jun)

---

*Last updated: May 2025*
