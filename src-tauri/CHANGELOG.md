# Changelog

## [0.3.0](https://github.com/lu041021/ai-learning/compare/ai-learning-platform-v0.2.0...ai-learning-platform-v0.3.0) (2026-06-07)


### Features

* **db:** add v2 migration — courses/lessons metadata fields ([473b8bc](https://github.com/lu041021/ai-learning/commit/473b8bcf00cbf16e3e7bda1acc8406c5cfad19bf))
* **db:** enable WAL mode with busy_timeout=5000ms ([64b2282](https://github.com/lu041021/ai-learning/commit/64b2282665b72a3203ad4acde8741d6044aef2b1))
* **llm:** add OpenAI and Ollama provider support ([e1b86d2](https://github.com/lu041021/ai-learning/commit/e1b86d2ba86ceab7de55b6e14fec764aaeec9961))
* **monitoring:** log frontend JS errors to local file via ErrorBoundary ([33e3f32](https://github.com/lu041021/ai-learning/commit/33e3f32180db9d05b340624539e7c7cf78838909))
* **rag:** add document upload and retrieval-augmented generation ([a31a108](https://github.com/lu041021/ai-learning/commit/a31a108299f8cf01d3936dcd08d595f809d84fe4))


### Performance Improvements

* **db:** add v4 migration with 4 missing query indexes ([7d82f7b](https://github.com/lu041021/ai-learning/commit/7d82f7b18dac434f2cfe2a973d5252b6f7869aa0))

## [0.2.0](https://github.com/lu041021/ai-learning/compare/ai-learning-platform-v0.1.0...ai-learning-platform-v0.2.0) (2026-06-06)


### Features

* comprehensive optimization — performance, testing, security, CI/CD ([8c9de0e](https://github.com/lu041021/ai-learning/commit/8c9de0ea66e84fabf26c2b650922118ec6153eb5))
* **infra:** add panic hook, update docs ([200413c](https://github.com/lu041021/ai-learning/commit/200413c5105b637fde50b117649cfab4c3dc2e11))


### Bug Fixes

* add target/ to eslint ignore, prettier fix, switch to NSIS bundler ([3f269b5](https://github.com/lu041021/ai-learning/commit/3f269b55fcfe457a7ec394087f009d1f9f079184))
* generate proper RGBA PNG icons and fix CI config ([4254a08](https://github.com/lu041021/ai-learning/commit/4254a08106b688d7035aeb882787da1efba44801))
* **release:** add macOS/Linux targets and bundle configs to release workflow ([03823e9](https://github.com/lu041021/ai-learning/commit/03823e9650dd85f74816da9261f09d5f20735a0e))
* resolve all pre-existing ESLint errors — any types, set-state-in-effect, react-refresh ([d21d9f1](https://github.com/lu041021/ai-learning/commit/d21d9f19a2bfb02782dfe3ec2d7bb3384b8a6921))
* resolve prettier formatting and Rust clippy warnings ([5dccf4a](https://github.com/lu041021/ai-learning/commit/5dccf4ae7a13b90322849f78f362fee9dabbde66))
