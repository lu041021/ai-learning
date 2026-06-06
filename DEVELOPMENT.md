# 开发者指南

## 环境搭建

### 前置条件

| 工具 | 最低版本 | 用途 |
|------|----------|------|
| Rust | 1.75 | Tauri 后端编译 |
| Node.js | 20 | 前端构建 |
| npm | 9 | 包管理 |
| WebView2 | 任意 | Windows 运行时（通常已预装） |

```bash
# 安装 Rust（如果未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 just（任务运行器，可选）
cargo install just
```

### 首次设置

```bash
git clone https://github.com/lu041021/ai-learning.git
cd ai-learning
npm install
```

### 开发启动

```bash
# 启动 Tauri 开发模式（同时启动前端 HMR + Rust 后端）
npx tauri dev

# 仅前端（用于纯 UI 调试，Tauri API 会被 mock）
VITE_MOCK=true npm run dev
```

---

## 架构概览

```
src/                          # React 前端
├── api/tauri.ts              # 所有 Tauri invoke 的统一封装层
├── components/
│   ├── common/               # ForceGraph, SearchBar, LoadingSpinner...
│   ├── layout/               # AppLayout, CourseSidebar, AIPanel...
│   └── ui/                   # Toast, Badge...
├── contexts/ThemeContext.tsx  # 暗/亮主题，localStorage 持久化
├── hooks/                    # useMountedRef, useDebounce...
├── pages/                    # 15 个页面组件（懒加载）
├── stores/                   # Zustand stores（user/chat/import/progress/ui）
├── types/                    # TypeScript 类型定义
└── utils/storage.ts          # localStorage 工具（userId / localId）

src-tauri/src/
├── commands/                 # Tauri 命令处理器（每个业务域一个文件）
├── services/                 # 业务逻辑（AI tutor / importer / MCP server...）
├── models/                   # serde 数据模型
├── db/
│   ├── migrations.rs         # 版本化 DB 迁移（schema_version 表）
│   └── mod.rs                # DB 初始化入口
├── config.rs                 # 环境变量 + 配置文件读写
├── lib.rs                    # Tauri Builder + panic hook + 命令注册
└── main.rs                   # 进程入口
```

### 数据流

```
前端 action → api/tauri.ts invoke() → Tauri 命令
                                      → service 层（AI / DB / HTTP）
                                      → Zustand store 更新
                                      → React 重渲染
```

流式响应（AI 对话）走 Tauri Event：
```
sendChat 命令 → tokio::spawn → SSE 解析 → emit("chat-token" | "chat-done")
前端 listen() → useChatStore 累积 token
```

---

## 测试

```bash
# 前端单元测试（Vitest）
npx vitest run
npx vitest             # watch 模式
npx vitest run --coverage

# Rust 单元 + 集成测试
cd src-tauri && cargo test

# E2E（Playwright，需先 tauri dev 启动）
npx playwright test
npx playwright test --ui   # 可视化调试

# 全部检查（需安装 just）
just check   # fmt + clippy + tsc + eslint + prettier
just test-all
```

### Mock 策略

- **Vitest**：`vi.mock('../../api/tauri')` + `vi.mock('@tauri-apps/api/event')` 捕获 listen 回调
- **Rust 集成测试**：`rusqlite::Connection::open_in_memory()` 每个测试独立库，见 `tests/common/mod.rs`
- **E2E**：`VITE_MOCK=true` 模式下前端 API 层返回固定数据

---

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)，Husky + commitlint 强制执行：

```
<type>(<scope>): <subject>

[body — 每行 ≤ 100 字符]
```

常用 type：`feat` `fix` `test` `refactor` `docs` `ci` `chore`

---

## 关键配置文件

| 文件 | 说明 |
|------|------|
| `src-tauri/tauri.conf.json` | 应用名称、窗口尺寸、打包目标（NSIS） |
| `src-tauri/Cargo.toml` | Rust 依赖 |
| `vite.config.ts` | Vite 构建配置 |
| `vitest.config.ts` | 测试配置（jsdom 环境） |
| `playwright.config.ts` | E2E 配置（Chromium + Firefox） |
| `.github/workflows/ci.yml` | CI：rust + frontend + e2e + commitlint |
| `.github/workflows/release.yml` | Release：三平台 tauri build |

---

## 运行时数据目录

| 平台 | 路径 |
|------|------|
| Windows | `%LOCALAPPDATA%\ai-learning\` |
| macOS | `~/Library/Application Support/ai-learning/` |
| Linux | `~/.local/share/ai-learning/` |

- `learning_platform.db` — SQLite 数据库（WAL 模式）
- `config.json` — API Key 和模型配置
- `panic.log` — Rust panic 捕获日志（如有）

---

## 常见问题

**`cargo build` 失败，缺少系统库（Linux）**

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

**AI 导师无响应**

在设置页配置 Anthropic 或 DeepSeek API Key，或检查 `%LOCALAPPDATA%\ai-learning\config.json`。

**MCP Server 端口被占用**

默认端口 9529，通过 `src-tauri/src/lib.rs` 中的 `mcp_port` 变量修改。
