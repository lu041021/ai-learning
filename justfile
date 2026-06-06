# AI 学堂 开发命令入口
# 安装 just: cargo install just  或  winget install just

default:
    @just --list

# === 开发 ===

# 启动完整 Tauri 开发 (Rust + React)
dev:
    cargo tauri dev

# 仅启动前端开发 (Mock 数据, 不需编译 Rust)
dev-web:
    VITE_MOCK=true npm run dev

# 仅启动前端开发 + 生产模式预览
preview:
    npm run build && npm run preview

# === 检查 ===

# 全面检查 (Rust + TypeScript + Lint)
check:
    cargo check
    npx tsc --noEmit
    npm run lint

# 仅 Rust 类型检查
check-rust:
    cargo check

# 仅 TypeScript 类型检查
check-ts:
    npx tsc --noEmit

# 代码格式化
fmt:
    npm run lint -- --fix
    cargo fmt

# === 清理 ===

# 清理构建产物
clean:
    cargo clean
    rm -rf dist

# 深度清理 (含依赖)
clean-all: clean
    rm -rf node_modules src-tauri/target

# === 构建 ===

# 生产构建 (安装包)
build:
    cargo tauri build

# === 测试 ===

# === 测试 ===

# 前端单元测试
test:
    npx vitest run

# 前端单元测试 (watch 模式)
test-watch:
    npx vitest

# 前端测试 + 覆盖率
test-coverage:
    npx vitest run --coverage

# Rust 单元 + 集成测试
test-rust:
    cd src-tauri && cargo test

# E2E 测试
test-e2e:
    npm run test:e2e

# 所有测试
test-all: test test-rust test-e2e

# === 依赖 ===

# 安装/更新所有依赖
install:
    npm install
