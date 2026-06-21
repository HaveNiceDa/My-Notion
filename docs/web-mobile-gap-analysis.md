# My-Notion Web / Mobile 差距分析与客户端学习路线

> 更新时间：2026-06-21
> 本文是当前唯一现行 Web / Mobile 差距分析；旧的 `web-mobile-gap-analysis-kimi.md` 与执行 TODO 已并入本文。

## 总体结论

My-Notion 已从“Web 完整、Mobile 缺失较多”演进为“数据层和基础文档能力基本统一，Mobile 主要功能已跑通，但 AI Agent 能力、移动编辑器深水区和客户端韧性能力仍落后于 Web”。

当前关键判断：

- Mobile AI 已不是 mock，已支持真实流式对话、会话历史、模型选择和深度思考展示。
- Web Agent 已具备 ReAct Loop、RAG、Memory、文档读写 dry-run、联网搜索、网页抽取和 `task_plan`。
- Mobile 下一阶段主线调整为“偏客户端学习与建设”：用 Expo / React Native 真实能力补齐 AI Native 客户端架构，而不是只补 UI 页面。
- Mobile 已接入 Web Agent `/api/agent/stream` 的 NDJSON 事件、checkpoint/resume 基础链路和 tool result 展示；文档详情页已能向 Agent 透传当前文档上下文。
- Mobile 编辑器仍缺正文图片插入/上传、复杂 block 兼容、键盘/选择区/弱网保存等客户端深水区能力。
- 两端共享包已形成基础，但导航状态、AI 事件协议、本地缓存、离线恢复和部分工程约定仍需继续统一。

## 状态总览

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| Schema 共享 | 已完成 | Web / Mobile 复用 `@notion/convex/schemas` |
| 文档 CRUD / 收藏 / 回收站 | 已完成 | 两端基础文档能力可用 |
| Mobile 真实 AI 对话 | 已完成 | 已支持流式输出、会话管理、模型选择、深度思考 UI |
| Mobile 设置 / 搜索共享状态 | 已完成 | 已接入 `useSettings`、`useSearch` |
| Mobile 导航共享状态 | 部分完成 | `useNavigation` 仍需确认和补齐 |
| Mobile 封面图上传 | 已完成 | 基于移动端图片选择和服务端存储能力 |
| Mobile 编辑器内容互通 | 已完成 | 已通过共享兼容层处理内容格式 |
| Mobile 正文图片上传 | 基础已具备 | TenTap 正文图片插入/上传入口已存在，仍需真机验证、错误恢复和保存一致性补强 |
| Mobile Agent Stream | 已完成 | 已接入 Web Agent `/api/agent/stream`、NDJSON 事件、checkpoint/resume 基础链路和当前文档上下文 |
| Mobile RAG / Knowledge Search | 基础已具备 | 通过 Agent Stream 复用 Web Agent tool 链路，仍需真机和复杂场景验证 |
| Mobile Tool Call / Web Search | 基础已具备 | 已有 tool event/source 展示与跳转，仍需补齐确认型工具 UI |
| Mobile 离线/弱网体验 | 部分完成 | 已有网络中断拦截、停止生成和 resume cursor，仍缺最近文档/会话缓存与统一 retry 策略 |
| Web Agent Plan 模式 | 部分完成 | `task_plan` 已完成，确认/执行闭环未完成 |
| RAG 初始化增量优化 | 未完成 | 仍有性能债务 |

## 已完成能力

- 数据层：Schema、文档能力、Chat 数据结构和跨端共享包基础已经成型。
- Mobile 文档：文档树、最近文档、回收站、收藏、归档、搜索和基础编辑已具备。
- Mobile AI：真实流式对话、会话历史、模型选择、深度思考展示已具备。
- Web Agent：ReAct Loop、RAG、Memory、Web Search、Web Extract、文档搜索/读取/写入/更新、`task_plan` 已具备。
- Agent 生态：CLI / Skills / MCP STDIO 已发布 `latest` 并可供外部 Agent 使用。

## 主要差距

### P0：Mobile Agent Stream 最小接入（已完成）

目标是把 Mobile AI 从当前兼容型 `/api/chat`、`/api/rag` 链路，升级为复用 Web Agent `/api/agent/stream` 的 AI Native 客户端链路。

完成情况：

- Mobile `agent-stream` client 已携带 Clerk Bearer token 请求 Web `/api/agent/stream`。
- 已解析 `run-start`、`text-delta`、`reasoning-delta`、`checkpoint`、`finish`、`error` 等 NDJSON 事件。
- 已保存 `runId`、`lastAppliedSeq`、`assistantMessageId`，支持基础续跑。
- 已展示流式文本、错误状态、tool event 和 source。
- `/api/chat`、`/api/rag` 兼容层仍作为降级路径保留。

### P0：Mobile AI 客户端状态机（已完成基础闭环）

目标是补齐移动端真实客户端常见状态，而不是只把 Web 请求搬到 App。

完成情况：

- 已统一管理 `idle/preparing/streaming/failed/resumable/done`。
- 已支持停止生成、失败重试、继续生成、生成中禁用发送。
- 已处理 App 切后台、网络中断时的请求取消与 resume snapshot 落盘。
- 已接入 tool event 基础结构；确认型工具 UI 仍后置。
- 错误分类已覆盖网络类和通用失败，后续可继续细分鉴权、协议解析和模型错误。

### P0：Mobile 当前文档上下文（已完成）

完成情况：

- 文档详情页已新增 AI Chat 入口。
- Chat 打开时会传入当前文档 `id/title/content`。
- `content` 优先使用编辑器最新内容序列化结果，避免防抖保存未完成时 Agent 读到旧内容。
- Agent Stream 请求已透传 `currentDocument`，可复用 Web 的当前文档读取工具。

### P1：补强移动编辑体验

建议任务：

- 验证 TenTap 正文图片插入入口、`inline-image-upload` helper 和 `/api/upload-image` 上传链路在真机环境下可用。
- 补强图片节点持久化与重开文档后的渲染一致性。
- 对权限拒绝、用户取消、上传失败和网络失败提供可恢复提示。
- 梳理移动端编辑器与 Web BlockNote 的内容兼容边界，明确哪些 block 只读降级、哪些 block 可编辑。
- 优化键盘避让、选区、工具栏悬浮、滚动定位和长文编辑性能。
- 增加本地草稿保护，避免弱网或切后台时丢失未保存内容。

### P1：客户端离线与弱网恢复

建议任务：

- 引入本地缓存策略，优先覆盖最近会话、最近文档、输入草稿和 Agent resume cursor。
- 评估 `AsyncStorage`、`MMKV`、SQLite 的边界：小型 key-value 用 MMKV/AsyncStorage，结构化离线数据再考虑 SQLite。
- 为 Agent Stream 接入网络恢复后的 `resume` 请求，优先恢复文本输出，不自动执行未确认写入。
- 对上传、编辑保存、AI 请求建立统一 retry / cancel / timeout 约定。
- 避免将 Clerk token、PAT、LLM key 或完整敏感响应写入本地日志和缓存。

### P1：优化 Mobile 文档树

建议任务：

- 减少当前递归 `useQuery` 带来的多层 loading 和查询放大。
- 评估一次性拉取子树、批量拉 children 或节点级缓存。
- 优化展开/收起状态与数据获取策略。

### P2：治理双端一致性

建议任务：

- 补齐 `useNavigation` 在 Mobile 的接入。
- 统一 i18n key 命名和跨端文案组织方式，不强制统一调用框架。
- 拆分 Web AI Chat 页面中的剩余重逻辑。
- 优化 RAG 初始化和增量更新策略。

## 建议执行顺序

1. 真机验证 Mobile Agent Stream、当前文档读取、切后台续跑和断网恢复。
2. 验证并补强 Mobile 正文图片上传和移动端编辑器深水区，这是用户感知最明显的编辑缺口。
3. 引入客户端缓存和弱网恢复：草稿、最近会话、resume cursor、网络恢复后续跑。
4. 优化 Mobile 文档树查询模型，降低复杂文档树下的性能风险。
5. 补齐共享状态与 i18n 约定，降低双端维护成本。
6. 回到 Web Agent 的 Plan/MCP adapter 产品化闭环。

## 学习与建设路线

本阶段兼具产品建设和客户端学习目标，建议按“真实功能驱动学习”推进。

### Week 1：Expo / React Native 基线

- 梳理 `apps/mobile` 路由、布局、安全区、键盘、列表、弹窗和主题系统。
- 明确 Web 前端和移动客户端在导航、生命周期、权限、键盘交互上的差异。
- 输出一份移动端架构笔记，作为后续开发入口。

### Week 2：Agent Stream 网络层

- 实现 Mobile Agent Stream client。
- 处理 NDJSON 增量解析、AbortController、超时、重试和 Clerk token。
- 先只展示 `text-delta` / `reasoning-delta`，tool 事件记录日志。

### Week 3：AI Chat 状态机

- 重构 Mobile AI Chat 状态管理。
- 支持停止生成、错误恢复、继续生成、生成中禁用关键操作。
- 为 tool call、write preview、confirmation required 预留 UI 数据结构。

### Week 4：Resume 与本地缓存

- 保存 `runId`、`lastAppliedSeq`、`assistantMessageId`。
- 支持页面刷新、切后台或网络恢复后的继续生成。
- 增加输入草稿和最近会话缓存。

### Week 5：移动编辑器能力

- 增加正文图片插入/上传。
- 梳理复杂 block 的移动端可编辑/只读降级策略。
- 优化键盘避让、选区、工具栏和长文编辑体验。

### Week 6：客户端质量收口

- 补充真机验证、弱网验证、错误边界和关键日志。
- 更新 `progress/` 阶段记录和移动端 README。
- 根据改动范围运行 Mobile typecheck/build 或最小可行验证。

## 关联入口

- Web 说明：`apps/web/README.md`
- Mobile 说明：`apps/mobile/README.md`
- Agent 路线：`docs/ai-chat-refactor-plan.md`
- 阶段索引：`milestones/README.md`
