# My-Notion Web / Mobile 差距分析

> 更新时间：2026-05-31
> 本文是当前唯一现行 Web / Mobile 差距分析；旧的 `web-mobile-gap-analysis-kimi.md` 与执行 TODO 已并入本文。

## 总体结论

My-Notion 已从“Web 完整、Mobile 缺失较多”演进为“数据层和基础文档能力基本统一，Mobile 主要功能已跑通，但 AI 增强能力和编辑器深水区仍落后于 Web”。

当前关键判断：

- Mobile AI 已不是 mock，已支持真实流式对话、会话历史、模型选择和深度思考展示。
- Web Agent 已具备 ReAct Loop、RAG、Memory、文档读写 dry-run、联网搜索、网页抽取和 `task_plan`。
- Mobile 尚未接入 Web 同级 RAG / Tool / Web Search 能力。
- Mobile 编辑器仍缺正文图片插入和上传能力。
- 两端共享包已形成基础，但导航状态、AI 事件协议和部分工程约定仍需继续统一。

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
| Mobile 正文图片上传 | 未完成 | TenTap 正文图片插入/上传链路仍缺失 |
| Mobile RAG / Knowledge Search | 未完成 | 尚未复用 Web RAG / Agent tool 链路 |
| Mobile Tool Call / Web Search | 未完成 | 缺少 Web 同级工具调用与展示协议 |
| Web Agent Plan 模式 | 部分完成 | `task_plan` 已完成，确认/执行闭环未完成 |
| RAG 初始化增量优化 | 未完成 | 仍有性能债务 |

## 已完成能力

- 数据层：Schema、文档能力、Chat 数据结构和跨端共享包基础已经成型。
- Mobile 文档：文档树、最近文档、回收站、收藏、归档、搜索和基础编辑已具备。
- Mobile AI：真实流式对话、会话历史、模型选择、深度思考展示已具备。
- Web Agent：ReAct Loop、RAG、Memory、Web Search、Web Extract、文档搜索/读取/写入/更新、`task_plan` 已具备。
- Agent 生态：CLI / Skills / MCP STDIO 已发布 beta 并可供外部 Agent 使用。

## 主要差距

### P0：统一 Mobile AI 能力边界

目标是明确 Mobile AI 后续是复用 Web Agent/RAG 服务，还是保留独立轻量聊天链路。

建议任务：

- 统一 Mobile AI Client 层，隐藏底层是直连模型还是 Web API。
- 统一流式事件结构，至少覆盖 content、reasoning、tool、error、finish。
- 给 Mobile 接入知识库 RAG 或明确暂不接入时的产品边界。
- 决定 Mobile 是否展示 Tool Call / Web Search 过程，或只展示最终答案。

### P1：补齐移动编辑体验

建议任务：

- 为 TenTap 编辑器增加正文图片插入入口。
- 复用现有上传能力，抽出正文图片上传 helper。
- 将图片节点持久化到正文内容，并保证重开文档后可渲染。
- 对上传失败、权限失败和网络失败提供可恢复提示。

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

1. 先定 Mobile AI 架构方向：轻量聊天还是复用 Web Agent/RAG。
2. 再补 Mobile 正文图片上传，这是用户感知最明显的编辑缺口。
3. 优化 Mobile 文档树查询模型，降低复杂文档树下的性能风险。
4. 补齐共享状态与 i18n 约定，降低双端维护成本。
5. 回到 Web Agent 的 Plan/Spec/MCP adapter 产品化闭环。

## 关联入口

- Web 说明：`apps/web/README.md`
- Mobile 说明：`apps/mobile/README.md`
- Agent 路线：`docs/ai-chat-refactor-plan.md`
- 阶段索引：`milestones/README.md`
