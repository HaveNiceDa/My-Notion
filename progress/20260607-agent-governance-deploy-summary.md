# 2026-06-07 Agent Governance Deploy Summary

## 目标

- 记录 Convex 线上函数推送结果，便于后续接手时快速理解当前线上状态。

## 已完成

- Agent Stream 韧性加固：Clerk/Convex token 获取失败时降级运行，Memory 自动提取改为后台执行，`finish` 事件优先返回，前端 loading 更早收口。
- AI 工具交互加固：`document_write` 支持空白文档预览，Memory 保存不再静默失败，Plan/tool 重复 key 问题收敛。
- AI 对话 UI 优化：生成中禁用确认型工具操作，避免多次点击；发送后自动滚动到底部；用户离开底部时提供手动回到底部按钮。
- AI 空白页快捷操作收口：保留当前真实支持能力，移除会触发过多工具调用的“总结下我的文档信息”入口。
- MCP adapter 防护：`my_notion_docs_fetch` 捕获非 documents ID 的 Convex 校验错误，返回可恢复工具错误，避免 Server Error 暴露到工具卡片。
- 进展记录清理：删除 2026-06-04 Memory 精简/迁移碎片记录和 2026-06-07 AI/Agent 小修过程记录，统一以本总结作为当前阶段入口。

## 线上部署

- 执行目录：`apps/web`。
- 首次命令：`npx convex deploy`，因非交互终端无法确认 prod deployment 推送而失败。
- 成功命令：`npx convex deploy --yes`。
- 目标部署：`https://moonlit-ptarmigan-478.convex.cloud`。
- 部署结果：成功推送 Convex functions，并完成 schema validation。
- 新增线上索引：
  - `agentRunCheckpoints.by_run_seq`
  - `agentRunCheckpoints.by_user`
  - `agentRunEvents.by_run_seq`
  - `agentRunEvents.by_user`
  - `agentRuns.by_conversation`
  - `agentRuns.by_run`
  - `agentRuns.by_user`

## 验证记录

- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @notion/web test -- ai-chat-components.test.ts tools.test.ts`：通过，实际运行 11 个相关/邻近测试文件，共 130 个测试。
- `pnpm --filter @notion/web lint`：通过，剩余 7 个既有 warning。
- `GetDiagnostics`：通过。
- `git diff --check`：通过。

## 当前风险

- 本地到 Clerk/Convex 仍可能偶发 `fetch failed` / `ETIMEDOUT`，目前策略是优先保证 AI 主回答链路可用，牺牲部分 run recording、Memory 注入或 checkpoint 持久化。
- MCP prompt 约束只能降低模型误用概率，真正的防线应继续放在 adapter / tool executor 层。
- `progress/` 已清理短期碎片，若需要追溯更细过程，应优先看 git 历史而不是恢复旧流水账。

## 下一步建议

- 观察线上 Agent Stream 的 `agentRuns` / `agentRunEvents` / `agentRunCheckpoints` 写入是否稳定。
- 若继续出现 Convex 超时日志，考虑增加本地开关禁用 run recording / memory injection，或收敛 warn stack 输出。
