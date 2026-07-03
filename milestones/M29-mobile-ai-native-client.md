# M29 Mobile AI Native Client

## 状态

- 状态：规划中
- 前置依赖：M21 流式续跑、Mobile Agent Stream 基础接入、Mobile 当前文档上下文
- 参考文档：`docs/web-mobile-gap-analysis.md`、`docs/mobile-debug-guide.md`、`docs/agent-stream-resume-protocol.md`

## 目标

把 Mobile AI 从“能请求 Web Agent”推进到“移动端可靠 AI 客户端”。本阶段不扩展 Web Agent 新能力，重点补齐真机、弱网、切后台、本地缓存和错误恢复。

## 范围

### In Scope

- 真机验证 `/api/agent/stream` 全链路：发送、流式文本、reasoning、tool event、finish/error。
- 验证并补强 `currentDocument` 透传，确保 Agent 能读取编辑器最新内容。
- 完成网络中断、切后台、手动停止生成后的 resume 行为验证。
- 落盘最近会话、输入草稿、resume cursor，避免 App 重启或弱网时丢失上下文。
- 细分错误类型：网络、鉴权、协议解析、上游模型、服务端验证。
- 建立 Mobile Agent Stream 真机验证脚本或 checklist。

### Out of Scope

- 不新增 Web Agent tool。
- 不做确认型写入工具的完整 Mobile UI；仅保留 tool event 数据结构和只读展示。
- 不做完整离线编辑同步系统；本阶段只覆盖 AI Chat 相关缓存和恢复。
- 不处理应用商店发布、推送通知和深层系统集成。

## 验收标准

- 真机上发送 AI 消息能完成 `run-start -> text-delta/reasoning-delta/tool-event -> checkpoint -> finish`。
- 断网后进入可恢复状态，网络恢复后可基于 cursor 继续生成，且不重复展示已应用事件。
- 切后台或手动停止生成后，用户能明确看到继续生成入口。
- 当前文档内容在未等待防抖保存时也能传给 Agent。
- 失败态能区分“可重试”和“需要重新登录/配置”的错误。
- 不把 Clerk token、PAT、LLM key、完整敏感响应写入本地日志或缓存。

## 实施建议

1. 梳理 `apps/mobile/src/lib/ai/agent-stream.ts` 与 `use-agent-chat-session.ts` 当前状态机。
2. 给 resume snapshot 增加版本字段，方便后续协议演进。
3. 增加最近会话和输入草稿本地缓存，优先使用轻量 key-value 存储。
4. 扩展错误分类函数，统一 UI 提示和 retry 策略。
5. 用真机和局域网 IP 验证 Web API、Clerk token、Agent Stream 和切后台恢复。
6. 更新 `docs/mobile-debug-guide.md` 的 M29 验证清单。

## 验证命令

```bash
pnpm --filter @notion/mobile typecheck
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
```

真机验证需额外记录设备、网络、Web URL、失败场景和恢复结果。
