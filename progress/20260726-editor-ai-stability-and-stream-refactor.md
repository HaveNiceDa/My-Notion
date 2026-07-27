# 编辑器 AI 稳定性修复与流式模块拆分

## 目标

修复编辑器选区 AI 在长代码生成（如快速排序）场景下的报错，解决模型切换不生效问题，并将重复的流式 tool call 解析逻辑抽为共享模块，消除代码重复。

## 完成变更

### 编辑器 AI 稳定性修复（apps/web/src/app/api/editor-ai/streamText/route.ts）

- **DashScope thinking mode 兼容**：Kimi k2.7-code 和 Qwen 3.7 系列在 DashScope 上都默认开启 thinking mode，与 `tool_choice: "required"` 冲突报 400，统一显式传 `enable_thinking: false`。
- **长输出截断修复**：设置 `max_tokens: 8192` 防止长代码块 JSON 截断，增加 `finish_reason === "length"` 检测。
- **文本干扰消除**：`tool_choice: "required"` 下模型仍可能输出前置文本（如"好的"），直接丢弃所有 `delta.content` 文本事件，只转发 tool call 事件，避免 BlockNote 解析非操作内容报错 `Invalid operation. The type property is required.`。
- **流式鲁棒性**：处理 `function.name` 延迟到达、`id` 先于 name 到达等分片边界情况，JSON parse 失败时发送标准 `type: "error"` 事件而非非法数据。
- **模型切换生效**：将 `useEditorAITransport` 的 `body` 从静态对象改为函数形式 `() => ({ modelId: getInitialAIModelId() })`，每次请求动态读取 localStorage 中最新模型 ID。

### runReActLoop 返回最终状态（apps/web/src/lib/agent/react-loop.ts）

- `runReActLoop` 从 `Promise<void>` 改为返回 `Promise<ReActLoopResult>`，包含 `messages`（完整工具调用历史）、`completedToolResults`（已完成的工具结果）、`reachedMaxIterations`（是否达迭代上限）。
- 修复两个调用方的 `run_finished` checkpoint：此前用循环开始前的初始 `compressedMessages` 和空 `toolResults: []` 保存，现改为使用返回的最终 messages 和 completedToolResults，消除状态一致性风险。
- 最大迭代次数分支不再将内部 system prompt 推入原始 messages 数组，改为创建副本避免污染返回状态。

### 流式 ToolCallAccumulator 共享模块（packages/ai/utils/stream-tool-call.ts）

- 新增 `ToolCallAccumulator` 类，统一 Agent 流（NDJSON 协议）和编辑器 AI 流（AI SDK UIMessage 协议）的 tool call delta 累积逻辑。
- 支持占位 id → 真实 id 的延迟更新，通过 `isNew`/`idUpdated`/`nameUpdated`/`argsDelta`/`argsBeforeId` 精确描述每个 chunk 变化，调用方按需发送协议事件。
- 新增共享 `hashString`（djb2 哈希），消除 `react-loop.ts` 和 agent `route.ts` 中的重复定义。
- 修复原有 stream.ts 中的潜在 bug：原代码在 tool name 到达但 id 还是占位符时会发送带占位 id 的 `tool-call-start`，新代码只在真实 id 可用后才发送 start 事件。

### 新增测试

- `react-loop.test.ts`：新增返回值验证测试，确认 `ReActLoopResult` 包含正确的 messages 和 completedToolResults。

## 验证

```bash
pnpm --filter @notion/web typecheck
```

结果：通过。

```bash
pnpm test
pnpm --filter @notion/web test
```

结果：packages 27 文件 136 用例全部通过，web 11 文件 132 用例全部通过（含 stream.test.ts 13 个、react-loop.test.ts 5 个核心测试）。

## 已知风险

- 编辑器 AI 已在浏览器端通过 Kimi Code 和 Qwen Max 双模型手动验证"写快速排序"等长操作，正常返回 `applyDocumentOperations`。
- ToolCallAccumulator 的 `argsBeforeId` 处理覆盖了 DashScope 理论上可能出现的"参数先于 id 到达"边界情况，但该场景在实测中未复现，属于防御性编码。

## 下一步

- Web Agent Plan 模式确认/执行闭环：用户在 UI 确认 task_plan 生成的计划后，自动按步骤执行。
- 编辑器 AI route 已使用共享 ToolCallAccumulator，后续可进一步将 system prompt 组装、API 调用参数构建等也抽离为独立函数，使 route 更精简。
