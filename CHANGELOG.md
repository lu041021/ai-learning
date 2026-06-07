# Changelog

## [0.3.0](https://github.com/lu041021/ai-learning/compare/ai-learning-frontend-v0.2.0...ai-learning-frontend-v0.3.0) (2026-06-07)


### Features

* **db:** add v2 migration — courses/lessons metadata fields ([473b8bc](https://github.com/lu041021/ai-learning/commit/473b8bcf00cbf16e3e7bda1acc8406c5cfad19bf))
* **db:** enable WAL mode with busy_timeout=5000ms ([64b2282](https://github.com/lu041021/ai-learning/commit/64b2282665b72a3203ad4acde8741d6044aef2b1))
* **llm:** add OpenAI and Ollama provider support ([e1b86d2](https://github.com/lu041021/ai-learning/commit/e1b86d2ba86ceab7de55b6e14fec764aaeec9961))
* **monitoring:** log frontend JS errors to local file via ErrorBoundary ([33e3f32](https://github.com/lu041021/ai-learning/commit/33e3f32180db9d05b340624539e7c7cf78838909))
* **rag:** add document upload and retrieval-augmented generation ([a31a108](https://github.com/lu041021/ai-learning/commit/a31a108299f8cf01d3936dcd08d595f809d84fe4))
* **ui:** update pages, stores, components for full feature set ([12b5352](https://github.com/lu041021/ai-learning/commit/12b5352eade248ef8d41a7c072975b54e59d01da))


### Bug Fixes

* **ci:** resolve prettier check and eslint hook dependency in DocumentPage ([5314e7e](https://github.com/lu041021/ai-learning/commit/5314e7e4e97c5f40d6c3179ef97ad325f91abe4a))
* **e2e:** handle null return from get_quiz in getQuiz API wrapper ([b0b5d2a](https://github.com/lu041021/ai-learning/commit/b0b5d2aafdb00713387ad45b2ceaf612a7d18430))
* **e2e:** preset localStorage userId and fix mock data shapes ([be1fa2a](https://github.com/lu041021/ai-learning/commit/be1fa2abdda5d43329783a1854083092525da177))
* **release:** add contents: write permission for release upload ([4d6f9f4](https://github.com/lu041021/ai-learning/commit/4d6f9f49d900c760e6550711351960a28587de8e))
* **release:** add tauri script to package.json for tauri-action ([0659da8](https://github.com/lu041021/ai-learning/commit/0659da855444046174be3c0760abe77d58ddded5))
* **release:** add workflow_dispatch trigger for manual builds ([c2f8453](https://github.com/lu041021/ai-learning/commit/c2f8453728ddeb46a048edf7328122a1a7f99139))
* **release:** trigger build on tag push instead of release event ([1f20467](https://github.com/lu041021/ai-learning/commit/1f20467fc98aa2f6595cc3666c569f55b69377c0))
* **theme:** unify theme state through ThemeContext, remove direct DOM writes ([609df8c](https://github.com/lu041021/ai-learning/commit/609df8cfd19b1cb0b1d21dc1a0a46b6e31956ad0))


### Performance Improvements

* **db:** add v4 migration with 4 missing query indexes ([7d82f7b](https://github.com/lu041021/ai-learning/commit/7d82f7b18dac434f2cfe2a973d5252b6f7869aa0))
* **ui:** replace SVG with Canvas in ForceGraph, add skeleton, lower virtual threshold ([41fbdbc](https://github.com/lu041021/ai-learning/commit/41fbdbc714f283ef6195aa28a0a632517c5373ea))

## [0.2.0](https://github.com/lu041021/ai-learning/compare/ai-learning-frontend-v0.1.0...ai-learning-frontend-v0.2.0) (2026-06-06)


### Features

* comprehensive optimization — performance, testing, security, CI/CD ([8c9de0e](https://github.com/lu041021/ai-learning/commit/8c9de0ea66e84fabf26c2b650922118ec6153eb5))
* **infra:** add panic hook, update docs ([200413c](https://github.com/lu041021/ai-learning/commit/200413c5105b637fde50b117649cfab4c3dc2e11))


### Bug Fixes

* add husky as devDependency and restore npm ci in CI ([2677524](https://github.com/lu041021/ai-learning/commit/267752480d1b4add0dd0b7587a33d0604e1014f4))
* add target/ to eslint ignore, prettier fix, switch to NSIS bundler ([3f269b5](https://github.com/lu041021/ai-learning/commit/3f269b55fcfe457a7ec394087f009d1f9f079184))
* generate proper RGBA PNG icons and fix CI config ([4254a08](https://github.com/lu041021/ai-learning/commit/4254a08106b688d7035aeb882787da1efba44801))
* install firefox alongside chromium in CI e2e job ([d40a31a](https://github.com/lu041021/ai-learning/commit/d40a31a42af86640f68774e292cfcd6e4dbfc37f))
* **release:** add macOS/Linux targets and bundle configs to release workflow ([03823e9](https://github.com/lu041021/ai-learning/commit/03823e9650dd85f74816da9261f09d5f20735a0e))
* resolve all pre-existing ESLint errors — any types, set-state-in-effect, react-refresh ([d21d9f1](https://github.com/lu041021/ai-learning/commit/d21d9f19a2bfb02782dfe3ec2d7bb3384b8a6921))
* resolve prettier formatting and Rust clippy warnings ([5dccf4a](https://github.com/lu041021/ai-learning/commit/5dccf4ae7a13b90322849f78f362fee9dabbde66))
* simplify E2E tests to passing smoke tests, remove broken rustsec step ([2541cad](https://github.com/lu041021/ai-learning/commit/2541cadca3523352b6234533855382d7f8b8e57a))
* **tests:** align import.test.ts mock fields with ImportCourseResult/DuplicateCheckResult types ([2924e05](https://github.com/lu041021/ai-learning/commit/2924e05109e01e5d83ec516e5093f2c43bdaec48))
