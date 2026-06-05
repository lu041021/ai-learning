# 架构文档

## 概述

AI 学堂是一个基于 Tauri v2 的桌面应用，Rust 后端 + React 前端，通过 Tauri IPC bridge 通信。

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri Desktop Shell                    │
│                                                          │
│  ┌─────────────────────┐   ┌───────────────────────────┐ │
│  │   React 19 Frontend  │   │      Rust Backend          │ │
│  │                      │   │                           │ │
│  │  Pages (15)          │◄──┤  Commands (13 modules)    │ │
│  │  Stores (Zustand)    │IPC│  Services (14 modules)    │ │
│  │  Router              │   │  Models                   │ │
│  │                      │   │  DB (SQLite + FTS5)       │ │
│  └─────────────────────┘   │  MCP Server (port 9529)   │ │
│                             └───────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## 层次架构

### 后端（Rust）

采用 Command → Service → Model 三层架构：

```
Tauri Commands (commands/)     ← IPC 入口，参数验证、用户上下文
    │
    ▼
Business Services (services/)  ← 核心逻辑，无状态，可测试
    │
    ▼
Models (models/)               ← serde 序列化，数据结构
    │
    ▼
Database (db/)                  ← SQLite + FTS5 + 迁移
```

**Command 层** (`src-tauri/src/commands/`)
每个 command 是一个 `#[tauri::command]` 函数，负责：
- 从 Tauri State 获取 DB 连接和配置
- 验证输入参数（如 API key 非空）
- 调用 Service 层完成业务逻辑
- 返回 `Result<T, String>` 给前端

**Service 层** (`src-tauri/src/services/`)
纯业务逻辑，不含 Tauri 相关依赖：
- `llm_client.rs` — LLM API 封装（Anthropic + DeepSeek），支持同步和流式
- `skill_assessor.rs` — 技能评估 + 学习路径生成（Prompt 工程）
- `ai_tutor.rs` — AI 导师对话管理
- `quiz_grader.rs` — 问答题 AI 自动评分
- `search.rs` — FTS5 全文搜索
- `knowledge_graph.rs` — 知识图谱构建（概念提取 + Jaccard 相似度）
- `recommendation.rs` — 加权评分推荐算法
- `analytics.rs` — 学习指标计算（连续天数、正确率趋势、领域分析）
- `course_importer.rs` — URL 内容抓取 + AI 结构化
- `github_importer.rs` — GitHub Awesome 列表搜索
- `feed_importer.rs` — RSS 订阅解析
- `mcp_server.rs` — MCP 协议服务器（JSON-RPC 2.0）
- `memory_bridge.rs` — Claude Code memory 同步

### 前端（React）

采用 Page → Store → API 三层架构：

```
Pages (pages/)                 ← 页面组件，组合 UI
    │
    ▼
Stores (stores/)               ← Zustand 状态管理
    │
    ▼
API Layer (api/tauri.ts)       ← invoke() 封装，统一类型
```

**Pages** (15 个页面)
- HomePage, CoursePage, LessonPage, QuizPage — 核心学习流程
- OnboardingPage — 技能评估引导
- LearningPathPage — 学习路径展示
- ProgressPage — 进度看板
- SearchPage — 搜索结果
- KnowledgeGraphPage — 知识图谱
- AnalyticsPage — 数据分析
- McpPlaygroundPage — MCP 工具测试
- ImportPage / GitHubImportPage / RssImportPage — 内容导入
- SettingsPage — 配置管理

**Stores** (Zustand)
- `userStore` — 用户身份
- `progressStore` — 学习进度
- `chatStore` — AI 对话
- `uiStore` — UI 状态（侧边栏、AI 面板）
- `userProfileStore` — 评估结果缓存
- `courseStore` — 课程列表缓存

## 数据库设计

SQLite 数据库，13 张核心表 + 2 张 FTS5 虚拟表：

```
courses ──┐
chapters ──┤ 1:N
lessons ───┤
quizzes ───┤
quiz_questions ── N:1 quizzes

users ──┬── user_progress (completed lessons)
        ├── quiz_attempts (scores + feedback)
        ├── conversations → messages
        ├── user_profiles (assessment results)
        ├── learning_path_history (path versions)
        ├── wrong_answer_log (retry tracking)
        └── feed_subscriptions

concepts ── lesson_concepts (N:M)

search_index (FTS5)     ← 跨 courses/lessons/quiz_questions
concept_index (FTS5)    ← 概念内容搜索
```

**FTS5 同步**：9 个触发器在 courses/lessons/quiz_questions 的 INSERT/UPDATE/DELETE 时自动更新 search_index。

## MCP 协议实现

自建 MCP Server 基于 `tiny_http`，实现 JSON-RPC 2.0 协议：

**协议方法：**
- `initialize` — 握手，返回 serverInfo 和 capabilities
- `notifications/initialized` — 客户端确认
- `tools/list` — 返回 12 个 tool schema
- `tools/call` — 执行工具调用，返回结果
- `resources/list` — 返回可读资源（课程 URI）
- `resources/read` — 读取资源内容
- `ping` — 健康检查

**12 个 MCP Tool：**
1. `list_courses` — 课程列表
2. `get_course` — 课程详情（含章节/课时）
3. `get_lesson` — 课时内容（Markdown）
4. `get_progress` — 学习进度
5. `get_dashboard` — 仪表盘数据
6. `search_courses` — 关键词搜索
7. `import_url` — URL 导入课程
8. `get_learning_path` — 学习路径
9. `semantic_search` — FTS5 全文搜索
10. `get_knowledge_graph` — 知识图谱
11. `get_recommendations` — 个性化推荐
12. `get_analytics` — 学习分析

## 数据流示例

### 技能评估流程
```
OnboardingPage.tsx
  → api.assessUserSkill(userId, responses)
    → invoke('assess_user_skill', { input, apiKey, model, apiProvider })
      → commands/skill_assessment.rs
        → LlmClient::chat() — DeepSeek/Anthropic API
        → skill_assessor::assess_skill() — 解析 JSON 评估结果
        → INSERT/UPDATE user_profiles
      ← UserProfileOut
    ← UserProfileOut
  → setProfile(profile)
  → navigate('/')
```

### AI 导师流式对话
```
LessonPage.tsx
  → api.sendChat(userId, message, lessonId, selectedText, convId)
    → invoke('send_chat', { ... })
      → LlmClient::stream_chat() — SSE 流式
      → INSERT conversation/messages
      ← convId (立即返回)
  → 前端通过 listen('chat-token:{convId}') 接收 token 流
  → 实时渲染 Markdown
```

## 关键设计决策

### 为什么用 SQLite FTS5 而非 Elasticsearch/Meilisearch
- 零外部依赖，应用自包含
- FTS5 内置中文分词（unicode61）
- `bm25()` 排序 + `snippet()` 高亮
- 9 个数据库触发器自动同步，无需额外索引逻辑

### 为什么用自建 MCP Server 而非官方 SDK
- MCP 协议核心是 JSON-RPC 2.0，标准库 `tiny_http` 即可实现
- 零额外依赖
- 完全控制工具注册和调度逻辑
- 共用应用 DB 连接，数据一致

### 为什么推荐算法是规则评分而非 ML 模型
- 无需引入 ML 依赖（PyTorch 等），保持应用轻量
- 加权评分（兴趣 40% + 进度 25% + 经验 20% + 亲和 15%）可解释
- 每个推荐带 `reason` 字符串，用户知道为什么被推荐

### Memory Bridge 动态发现
- 扫描 `~/.claude/projects/*/memory/` 下所有目录
- 同时写入所有活跃 Claude Code 项目 memory
- 不依赖硬编码路径，适应多项目管理
