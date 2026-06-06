# AI 学堂 — Interactive AI Learning Desktop App

基于 [Tauri v2](https://v2.tauri.app/) 的跨平台 AI 学习桌面应用。将课程学习、AI 导师、知识图谱、语义搜索和 MCP 协议演示整合为一个完整的学习体验闭环。

## 核心功能

### 学习闭环
- **入门评估** — LLM 驱动的技能评估，分析你的 AI 知识水平，输出个性化学习画像
- **学习路线** — 基于评估结果自动生成 5-10 步学习路径，可回溯历史版本
- **课程学习** — Markdown 课程内容，支持代码高亮和 GFM
- **AI 导师** — 流式对话，支持选中文本提问，上下文感知当前课时
- **测验评分** — AI 自动评分问答题，错题回顾和重新测验

### 知识工具
- **语义搜索** — SQLite FTS5 全文搜索，跨课程/课时/测验题目，带高亮摘要和排序
- **知识图谱** — 力导向图可视化 AI 概念关系，叠加用户掌握度着色，支持交互筛选
- **学习分析** — 完成率、正确率、学习连续天数、领域强弱分析、周活跃趋势图

### 内容导入
- **URL 导入** — 输入任意技术文章 URL，AI 自动提取内容并结构化生成课程
- **GitHub Awesome** — 搜索 Awesome 列表，批量导入优质学习资源
- **RSS 订阅** — 订阅技术博客 RSS，持续导入新内容

### MCP 集成
- **内置 MCP Server** — 端口 9529，实现完整 MCP 协议（initialize/tools/list/tools/call/resources）
- **12 个 MCP Tool** — list_courses, get_course, get_lesson, get_progress, get_dashboard, search_courses, import_url, get_learning_path, semantic_search, get_knowledge_graph, get_recommendations, get_analytics
- **MCP Playground** — 应用内三栏测试界面：工具目录 | 请求构造 | 响应查看，支持 Quick Demo 一键跑通全流程
- **Memory Bridge** — Claude Code memory 自动同步，跨会话保留学习上下文

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Vite 8 |
| 状态管理 | Zustand 5 |
| 路由 | React Router 7 |
| 数据库 | SQLite (rusqlite) + FTS5 全文搜索 |
| HTTP | reqwest + SSE 流式 |
| LLM 集成 | Anthropic API / DeepSeek API |
| MCP | 自建 tiny_http MCP Server（12 tools） |
| 内容解析 | scraper (HTML) + feed-rs (RSS) |

## 快速开始

### 前置条件
- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Node.js](https://nodejs.org/) 20+
- Windows: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (通常已预装)

### 开发运行

```bash
# 安装依赖
npm install

# 启动开发模式（HMR）
npx tauri dev
```

### 生产构建

```bash
npx tauri build
```

构建产物在 `src-tauri/target/release/bundle/`。

### 配置

应用首次启动会自动初始化数据库。在设置页配置 API Key：
- **Anthropic**: 在 [console.anthropic.com](https://console.anthropic.com/settings/keys) 获取
- **DeepSeek**: 在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 获取

## 项目结构

```
src/                        # React 前端
├── api/tauri.ts            # Tauri invoke 封装
├── components/
│   ├── common/             # 通用组件（ForceGraph, SearchBar...）
│   ├── layout/             # 布局组件（AppLayout, CourseSidebar...）
│   └── ui/                 # UI 基础（Toast, Badge...）
├── pages/                  # 页面（15 个页面）
├── stores/                 # Zustand stores
├── types/                  # TypeScript 类型
└── utils/                  # 工具函数

src-tauri/                  # Rust 后端
├── src/
│   ├── commands/           # Tauri 命令（13 modules）
│   ├── services/           # 业务服务（14 modules）
│   ├── models/             # 数据模型
│   ├── db/                 # 数据库初始化和迁移
│   ├── lib.rs              # 命令注册 + 应用启动
│   └── main.rs             # 入口
└── Cargo.toml
```

## 页面速览

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 课程网格 + 继续学习 + 为你推荐 |
| 课程详情 | `/courses/:slug` | 章节/课时列表 |
| 课时学习 | `/courses/:slug/lessons/:id` | Markdown 内容 + AI 导师 |
| 测验 | `/courses/:slug/lessons/:id/quiz` | AI 评分的问答题 |
| 入门评估 | `/onboarding` | LLM 技能评估引导 |
| 学习路线 | `/learning-path` | 个性化路径 + 版本历史 |
| 学习进度 | `/progress` | 技能雷达 + 日历热力图 |
| 搜索 | `/search` | FTS5 全文搜索结果 |
| 知识图谱 | `/knowledge-graph` | 力导向概念关系图 |
| 学习分析 | `/analytics` | 数据看板 + SVG 图表 |
| MCP Playground | `/mcp-playground` | MCP 工具测试面板 |
| URL 导入 | `/import` | 文章 URL 导入 |
| GitHub 导入 | `/import/github` | Awesome 列表导入 |
| RSS 导入 | `/import/rss` | RSS 订阅管理 |
| 设置 | `/settings` | API Key/模型/主题配置 |

## 快捷键

| 按键 | 功能 |
|------|------|
| `Ctrl+K` | 全局搜索 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+J` | 切换 AI 导师面板 |
| `Escape` | 关闭 AI 面板 |

## 测试

```bash
# 全部检查
just check

# 全部测试
just test-all

# 前端单元测试 (9 文件, 55 测试)
npx vitest run

# Rust 测试 (33 单元 + 31 集成 = 64)
cargo test

# E2E 测试
npx playwright test
```

## CI/CD

- **CI** — `cargo fmt/clippy/test` + `tsc/eslint/prettier/vitest` + `playwright` + `commitlint`
- **Release** — `release-please` 自动版本 bump + changelog
- **构建** — 三平台矩阵 (Windows/macOS/Linux)
- **安全** — 每周 `cargo audit` + `npm audit`

当前版本 **0.1.0** — 核心功能闭环已完成，工程基础设施就绪。
