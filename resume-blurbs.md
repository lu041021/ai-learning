# 简历文案 — AI 学堂

## 中文

### 项目简介（用于项目经历栏）
> **AI 学堂** — 基于 Tauri v2 的跨平台 AI 学习桌面应用，集成 LLM 技能评估、语义搜索、知识图谱和自建 MCP Server。

### 推荐 bullet points（按岗位选 3-5 条）

**全栈 / 前端方向：**
- 使用 Tauri v2 + React 19 + TypeScript 构建跨平台桌面应用，实现 Rust 后端 14 个服务模块、React 前端 15 个页面的完整架构
- 设计 Command → Service → Model 三层后端架构，封装 25+ Tauri IPC 命令，统一错误处理和参数验证
- 基于 Zustand 实现多 Store 状态管理，设计 api/tauri.ts 统一调用层，前端代码零 platform-specific 分支
- 自建 MCP 协议服务器（tiny_http），实现 JSON-RPC 2.0 完整生命周期（initialize → tools/list → tools/call），注册 12 个 MCP Tool

**AI/LLM 方向：**
- 集成 Anthropic 和 DeepSeek 双 LLM 提供商，封装统一的 LlmClient 抽象层（同步对话 + SSE 流式），一套接口切换两家 API
- 设计 LLM 技能评估 Prompt 工程：结构化问卷 → JSON 评估输出（经验水平/兴趣领域/学习目标），解析容错处理
- 实现 AI 导师流式对话功能，支持上下文感知（当前课时 + 选中文本），前端 React Markdown 实时渲染
- AI 自动评分问答测验，LLM 对比标准答案生成评分 + 反馈，错题自动记录和重测

**系统设计方向：**
- SQLite FTS5 全文搜索引擎，9 个数据库触发器自动同步索引，支持跨表搜索 + bm25 排序 + 片段高亮
- 知识图谱力导向布局算法（SVG 手写），Jaccard 相似度计算概念关联，叠加用户掌握度可视化
- 内容推荐引擎：加权多因子评分（兴趣匹配 40% + 进度状态 25% + 经验适配 20% + 课程亲和 15%），每条推荐携带可解释原因
- Memory Bridge 模块：学习进度自动同步到 Claude Code memory 系统，动态发现多项目管理目录

**一句话版（用于技能列表）：**
> 独立开发 Tauri v2 桌面应用，Rust 后端 1.4 万行 + React 前端，集成 LLM、FTS5 语义搜索、知识图谱、MCP Server 12 工具

---

## English

### One-liner
> Independently built a Tauri v2 cross-platform AI learning desktop app featuring LLM-powered skill assessment, FTS5 semantic search, knowledge graph visualization, and a custom MCP server with 12 tools.

### Bullet Points (pick 3-5 based on role)

**Full-Stack / Frontend:**
- Built a cross-platform desktop app with Tauri v2, React 19, and TypeScript, implementing 14 Rust service modules and 15 React pages with a clean separation of concerns
- Designed a three-tier backend architecture (Command → Service → Model) with 25+ typed IPC commands, eliminating frontend platform-specific code
- Implemented a custom MCP protocol server on tiny_http, handling JSON-RPC 2.0 lifecycle (initialize → tools/list → tools/call → resources/read) with 12 registered tools

**AI / LLM:**
- Built a unified LLM abstraction layer supporting both Anthropic and DeepSeek APIs, with sync chat and SSE streaming, switchable via a single provider enum
- Engineered LLM prompts for skill assessment: structured questionnaire → JSON output parsing (experience level, interests, learning goals) with graceful error recovery
- Implemented context-aware AI tutoring with streaming responses — lesson-aware + text selection context, real-time Markdown rendering on the frontend

**Systems:**
- Built a full-text search engine on SQLite FTS5 with 9 database triggers for automatic index synchronization, cross-table search with bm25 ranking and snippet highlighting
- Implemented a force-directed knowledge graph with hand-coded SVG rendering, Jaccard similarity for concept relationships, and user mastery overlay coloring
- Designed a weighted multi-factor recommendation engine (interest match 40%, progress 25%, experience 20%, course affinity 15%) with human-readable reason strings
- Built a Memory Bridge service that syncs learning progress to Claude Code's memory system via dynamic multi-project directory discovery
