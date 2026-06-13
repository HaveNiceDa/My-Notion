# 从 PDD、DDD、SDD 到 TDD：我是如何用一套 Agent 工程方法论推进 My-Notion 的

如果你最近也在做 AI Agent、RAG、MCP、CLI、长期记忆，可能会有一个很强烈的感受：

> 现在真正难的不是“让模型回一句话”，而是让一个 AI Native 产品持续演进，并且每次改动都能解释清楚、边界清楚、验证清楚。

`My-Notion` 是我做的一个定制化个人版 Notion。它不是单纯的 Notion Clone，而是把文档编辑、AI Chat、ReAct Agent、RAG、Memory、移动端、CLI、MCP、Agent Skills 放在同一个 monorepo 里。

项目做大之后，我越来越明显地感觉到：靠“想到哪写到哪”很难维护 AI 产品。因为 AI 系统天然有几个复杂点：

- 前端交互复杂：流式输出、工具调用、确认式写入、失败重试、继续生成。
- 后端边界复杂：Convex、Clerk、Qdrant、DashScope、Next.js API Routes、Machine API。
- Agent 行为复杂：它不是普通 CRUD，而是会计划、检索、调用工具、生成草稿、等待确认。
- 交付面复杂：Web、Mobile、CLI、MCP、Skills 都要保持契约一致。

所以我在 My-Notion 里逐步形成了一套比较实用的工程闭环：

```text
DDD -> SDD -> PDD -> TDD
```

也就是：

- `DDD`：先把领域边界和核心概念讲清楚。
- `SDD`：再把协议、契约和规格写清楚。
- `PDD`：然后把 Agent 的执行方式、提示词和工作流约束清楚。
- `TDD`：最后用测试、类型检查、构建和发布校验兜底。

这篇文章不是讲概念教科书，而是结合 My-Notion 的真实工程实践，聊聊这四种方法在 AI Native 项目里到底怎么用。

---

## 一、为什么 AI Native 项目更需要方法论？

传统 Web 项目里，很多需求可以拆成比较明确的页面、接口和数据库表。

但 AI Native 项目会多一层不确定性：Agent 的输出不是固定的，工具调用路径也不是固定的。比如用户让 Agent “帮我总结并更新当前文档”，背后可能发生这些步骤：

- 读取当前文档上下文。
- 检索相关历史文档。
- 搜索 Memory。
- 调用 LLM 生成总结。
- 生成文档更新草稿。
- 展示 dry-run 预览。
- 等待用户确认。
- 再提交真实写入。
- 把 run 事件和 checkpoint 持久化，支持失败后恢复。

这不是一个简单按钮，也不是一个普通 API。

如果没有方法论，很容易出现这些问题：

- 领域边界不清：Web Agent、MCP、CLI、Memory、RAG 混在一起。
- 协议不稳定：前端展示一种 tool result，后端返回另一种结构。
- Agent 行为不可控：有时 dry-run，有时直接写入。
- 测试只覆盖 happy path：一到超时、断流、权限不足就崩。
- 文档过期：代码改了，Skills、README、release checklist 没跟上。

所以我现在更倾向于把 AI 产品当成“协议驱动的复杂系统”来做，而不是当成“多接几个 LLM API”的页面功能。

---

## 二、DDD：先把领域边界讲清楚

`DDD` 通常指 Domain-Driven Design，也就是领域驱动设计。

在 My-Notion 里，我对 DDD 的理解不是一上来就画复杂 UML，而是先回答三个问题：

- 这个系统里到底有哪些核心对象？
- 哪些对象属于同一个业务边界？
- 哪些词必须在前端、后端、Agent、CLI 文档里保持一致？

### 1. My-Notion 里的核心领域

My-Notion 的核心不是“页面”，而是几个稳定领域：

- `Document`：文档、标题、正文、归档、导入、导出、Markdown 表达。
- `Agent Run`：一次 AI 生成过程，包括 runId、conversationId、assistantMessageId、seq、checkpoint。
- `Tool Result`：工具调用结果，统一到 `tool-result-v1` 契约。
- `Memory`：长期记忆、提议、确认、检索、作用域。
- `RAG Source`：知识检索来源，包括 document、web、memory 等强类型来源。
- `CLI Token`：Device Flow、PAT、scope、token prefix、撤销与过期。
- `MCP Tool`：外部 Agent 通过 STDIO 调用的文档读写工具。

这些概念一旦稳定下来，后续 Web、Mobile、CLI、MCP、Skills 才能围绕同一套语言协作。

### 2. DDD 在项目结构里的体现

My-Notion 是一个 pnpm monorepo：

```text
apps/web             # Next.js + Convex + Clerk + BlockNote
apps/mobile          # Expo + React Native
packages/ai          # RAG、Embedding、Agent、AI 配置
packages/business    # Zustand、i18n、共享类型和业务逻辑
packages/convex      # Convex schema、文档、Chat、CLI Token 逻辑
packages/my-notion-cli
packages/my-notion-skills
```

这个结构本身就是 DDD 的结果：不是所有代码都塞进 Web，而是把领域能力拆开。

例如 CLI/MCP 不是 Web UI 的附属品，而是 Agent 生态的一等公民；Memory 也不是 Chat 组件里的一个状态，而是独立的领域能力。

### 3. DDD 的优缺点

做了什么：

- 把 My-Notion 拆成文档、Agent、RAG、Memory、CLI/MCP、Skills 等边界。
- 让 `runId`、`tool-result-v1`、`sources`、`dryRun`、`confirmationRequired` 等概念成为稳定语言。
- 让 Web、Mobile、CLI、MCP 都围绕同一套业务词汇演进。

为什么这样做：

- AI 系统的复杂度来自跨边界协作。
- 如果概念不稳定，后续协议、测试、文档都会漂移。
- Agent 工具调用尤其依赖清晰的领域对象，否则很难做权限控制和恢复。

实现优缺点：

- 优点是边界清楚，长期维护成本更低。
- 缺点是前期需要花时间命名、拆包、写文档，短期看起来比直接写功能慢。
- 对小 Demo 来说可能显得重，但对持续演进的 AI 产品非常必要。

我的理解是：DDD 不是为了“显得架构很高级”，而是为了让项目里每个人、每个 Agent、每份文档都说同一种语言。

---

## 三、SDD：把契约写在代码前面

`SDD` 可以理解为 Spec-Driven Development，也就是规格驱动开发。

在 AI Agent 项目里，SDD 尤其重要。因为 Agent 系统最怕的不是“没有功能”，而是“功能看起来能用，但契约不稳定”。

### 1. My-Notion 里的 SDD 实践

My-Notion 里有几类规格文档和契约非常关键：

- `Agent Stream Resume Protocol`：定义 `runId`、`seq`、checkpoint、resume state。
- `tool-result-v1`：统一 Web Agent 工具结果结构。
- MCP dry-run 契约：写工具默认 `dryRun: true`，必须返回确认提示。
- CLI release checklist：发布前必须跑 test、typecheck、build、e2e、skills sync。
- Device Flow 规则：授权 URL 只能包含 `user_code`，不能泄漏 `device_code`。
- Machine API 规则：连接 Convex Machine API 使用 `.site` URL，runtime client 使用 `.cloud` URL。

这些东西如果只存在代码里，很容易在迭代中被打破。写成规格后，就能成为 Agent、开发者和测试共同遵守的边界。

### 2. 一个具体例子：流式续跑协议

Web Agent 做流式输出时，如果中间网络断了，不能简单重新请求。

因为一旦前端已经展示了部分文本或工具状态，直接重试可能导致：

- 重复展示 token。
- 重复执行 tool call。
- 重复生成写入预览。
- 更严重时，重复提交副作用。

所以 My-Notion 定义了流式续跑协议：

```ts
interface AgentStreamEnvelope<T> {
  runId: string;
  seq: number;
  event: T;
  createdAt: number;
}
```

客户端只应用 `seq > lastAppliedSeq` 的事件。服务端通过 `AgentRunRecorder` 记录事件和 checkpoint。这样系统不是靠“猜测状态”，而是靠显式协议恢复。

### 3. 另一个例子：写入必须确认

My-Notion 里的 Agent 写文档、写记忆，不允许直接落库，而是遵循：

```text
Dry-run -> Preview -> User Confirmation -> Commit
```

这个规则不是 UI 层的小细节，而是系统级规格。

它影响了：

- Web Agent 的工具确认按钮。
- MCP 写工具默认 `dryRun: true`。
- CLI/Skills 的安全说明。
- 测试和 release checklist。

### 4. SDD 的优缺点

做了什么：

- 把 Agent Stream、MCP dry-run、CLI 发布、安全写入等行为写成明确规格。
- 用协议约束代码实现，而不是让每次需求都重新讨论。
- 让外部 Agent 也能遵守 My-Notion 的安全边界。

为什么这样做：

- AI Agent 的行为不完全可预测，系统边界必须可预测。
- 协议比口头约定更容易被测试、复查和迁移。
- 当 Web、Mobile、CLI、MCP 同时存在时，规格是唯一稳定的协作层。

实现优缺点：

- 优点是可维护、可复盘、可测试。
- 缺点是规格文档需要持续更新，否则会变成“历史遗留文档”。
- 对团队来说，SDD 要求开发前多做一点设计，但能减少后期返工。

我的理解是：SDD 的价值不是写文档本身，而是让系统从“靠实现碰巧工作”变成“按契约稳定工作”。

---

## 四、PDD：让 Agent 也能按工程规范工作

`PDD` 在这里我更愿意理解为 Prompt-Driven Development。

不是说让 Prompt 代替代码，而是把 Prompt、Agent Rules、Skills、Checklist 当成工程资产管理。

在 AI Native 项目里，Agent 不只是一个聊天窗口，它也可能参与：

- 读代码。
- 改代码。
- 生成测试。
- 同步文档。
- 发布 npm 包。
- 调用 MCP 工具。
- 写入项目进度。

如果没有 PDD，Agent 很容易做出“看起来合理但不符合项目规则”的事情。

### 1. My-Notion 里的 PDD 载体

My-Notion 里有几类 Prompt/规则资产：

- `AGENTS.md`：项目入口规则，告诉 Agent 当前架构、目录、验证命令和安全约束。
- `.trae/rules/project-workflow.md`：工作流、项目结构、技术约束。
- `packages/my-notion-skills`：面向外部 Agent 的可复用 Skills。
- `progress/`：阶段性过程记录，避免 Agent 重复探索。
- `milestones/`：里程碑索引，帮助 Agent 快速理解项目状态。
- release checklist：发布前的固定动作。

这些文件本质上不是“给人看的 README”那么简单，而是给 Agent 的工程上下文。

### 2. 一个真实案例：CLI 从 beta 推到 latest

最近 My-Notion 把 `@mynotion/cli` 从 beta 推到了 npm `latest`。

这个流程如果靠临场发挥，很容易遗漏：

- 忘记更新 package version。
- 忘记同步 Skills。
- 忘记检查 tarball 里是否还有 beta 文案。
- 忘记验证 npm dist-tag。
- 把 npm token 打到日志里。
- 忘记清理 `.npmrc.publish`。

但通过 PDD，可以把 Agent 的执行路径固定下来：

```text
读 release checklist
确认 package version
同步 Skills
运行 typecheck/test/build
生成 tarball
检查 tarball 内容
使用本地忽略 token 文件发布
验证 npm latest
清理本地 token 和 tarball
更新 progress
```

这个过程里，Prompt/规则不是一句“帮我发布一下”，而是一组可执行的工程约束。

### 3. 另一个真实案例：下线废弃能力

My-Notion 曾经有绘图能力，后来因为产品路线和后端热路径风险，选择下线。

这类任务不是简单删一个按钮，而是要问：

- Web 前端入口是否移除？
- 历史文档是否还能安全渲染？
- CLI/MCP 是否还暴露旧工具？
- Machine API 是否返回明确错误？
- scope 是否移除？
- 文档里是否还有旧能力字段？
- 生产 Convex 是否已部署？

这些问题非常适合写进 Agent 的执行 Prompt。因为它不是单点代码修改，而是跨 Web、CLI、MCP、后端、文档的收口任务。

### 4. PDD 的优缺点

做了什么：

- 把项目规则、执行顺序、安全边界、验证命令写成 Agent 可读上下文。
- 让 Agent 不只是“写代码”，而是按项目工作流推进任务。
- 通过 progress 和 milestones 降低重复探索成本。

为什么这样做：

- AI Agent 的能力很强，但默认不知道项目的长期约束。
- Prompt 如果只存在聊天记录里，很难复用，也很难审计。
- 复杂项目需要让 Agent 按“项目方法论”工作，而不是按“通用建议”工作。

实现优缺点：

- 优点是 Agent 行为更稳定，跨会话接续能力更好。
- 缺点是需要维护规则文件，且规则过多时可能增加上下文负担。
- 最好的方式不是堆规则，而是把关键安全边界和验证路径写清楚。

我的理解是：PDD 不是“提示词玄学”，而是把 Agent 的工作方式产品化、流程化、可审计化。

---

## 五、TDD：让不确定的 AI 系统有确定的验收线

`TDD` 通常指 Test-Driven Development，也就是测试驱动开发。

在 My-Notion 里，我不会机械地要求所有功能都先写测试，但对关键链路会坚持一个原则：

> 只要改动影响协议、安全、发布、Agent 写入或跨端兼容，就必须有明确验证。

### 1. My-Notion 的验证分层

项目里常见的验证命令包括：

```bash
# Web
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke

# CLI / MCP
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm e2e:mcp:client

# Skills
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

这不是为了“跑命令好看”，而是因为 My-Notion 的交付面太多：

- Web 改动要保证 Next.js 和 Convex 类型正确。
- CLI 改动要保证命令、输出格式、错误契约稳定。
- MCP 改动要保证外部 Agent 能正确调用工具。
- Skills 改动要保证源码、`.trae/skills`、随包 skills 三份一致。

### 2. 最近一次发布的 TDD 实践

`@mynotion/cli@0.1.0` 发布到 npm `latest` 前后，实际跑了这些验证：

- `pnpm --filter @mynotion/cli typecheck`
- `pnpm --filter @mynotion/cli test`
- `pnpm --filter @mynotion/cli build`
- `pnpm sync:skills`
- `pnpm sync:skills:package`
- `pnpm sync:skills:check`
- `npm publish --tag latest --access public`
- `npm view @mynotion/cli dist-tags --json`
- `npx @mynotion/cli@latest --help`
- `npx @mynotion/cli@latest install --check --format json`

最后确认：

```json
{
  "latest": "0.1.0",
  "beta": "0.1.0-beta.1"
}
```

以及安装检查返回：

```json
{
  "ok": true,
  "version": "0.1.0",
  "skillsBundled": true
}
```

这就是 TDD 在发布链路里的价值：不是相信“我改完了”，而是让命令证明“它能工作”。

### 3. TDD 的优缺点

做了什么：

- 用单测、类型检查、构建、E2E、发布后 npm view 和 npx smoke test 做验收。
- 对 CLI/MCP/Skills 这类 Agent 入口保持更严格的回归检查。
- 把验证结果写入 progress，方便后续复盘。

为什么这样做：

- Agent 产品的失败模式很多，不能只靠人工点点看。
- 发布包一旦推到 npm，回滚成本比本地修 bug 更高。
- 外部 Agent 依赖 CLI/MCP 契约，破坏契约会影响下游自动化。

实现优缺点：

- 优点是确定性强，能及时发现协议漂移和发布问题。
- 缺点是验证链路会变长，尤其是 E2E 和真实服务依赖。
- 实践中需要按改动范围选择最小必要验证，避免每次都跑全量。

我的理解是：TDD 对 AI 项目不是“保守”，而是让 AI 的不确定性被工程确定性包住。

---

## 六、把四种方法串起来：一个完整任务怎么跑？

如果用 My-Notion 的方式做一个新能力，我通常会这样拆：

### 1. DDD：先问领域问题

```text
这个能力属于哪个领域？
是否会引入新的核心对象？
它和 Document、Agent Run、Memory、Tool Result 的关系是什么？
是否需要新的权限或 scope？
```

例如做“Agent 写入文档”时，领域对象不是“一个按钮”，而是：

- 文档草稿。
- 写入预览。
- 用户确认。
- 提交动作。
- 审计与恢复。

### 2. SDD：再写协议和契约

```text
API 输入输出是什么？
tool result 结构是什么？
错误码是什么？
是否支持 dry-run？
是否需要 checkpoint？
```

如果涉及外部 Agent，还要明确：

- MCP structuredContent。
- text fallback。
- isError。
- requestId。
- confirmationRequired。

### 3. PDD：把 Agent 执行路径写清楚

```text
Agent 允许做什么？
禁止做什么？
需要先 dry-run 还是可以 commit？
修改后要同步哪些文档？
需要跑哪些验证命令？
```

这部分会进入 `AGENTS.md`、Skills、progress 或 release checklist。

### 4. TDD：最后用验证收口

```text
类型是否通过？
单测是否覆盖关键契约？
E2E 是否覆盖真实链路？
发布后是否做 smoke test？
文档和代码是否一致？
```

这样一来，AI 项目就不再是“Prompt + API 调用”的组合，而是一套可持续演进的工程系统。

---

## 七、这套方法在 My-Notion 里解决了什么问题？

### 1. 解决跨端割裂

Mobile 早期通过 `/api/chat` 和 `/api/rag` 接入 Web 能力。为了避免未鉴权入口，后续补了 Clerk Bearer token，并在 Web 端增加兼容路由。

这里的闭环是：

- DDD：Mobile AI 属于同一个 Agent/AI 领域，不是独立随便接一个接口。
- SDD：`/api/chat`、`/api/rag` 的请求和 SSE 输出要稳定。
- PDD：规则里明确 Mobile 必须复用 Web API 鉴权和 Agent Stream 方向。
- TDD：至少跑 Web typecheck 和影响范围验证。

### 2. 解决 Agent 写入安全

Agent 能写文档是很有价值的，但如果没有确认链路，就很危险。

My-Notion 选择了：

```text
Dry-run -> Preview -> User Confirmation -> Commit
```

这让 Agent 从“直接执行者”变成“生成方案并等待确认的协作者”。

### 3. 解决发布不可控

CLI/MCP/Skills 是给外部 Agent 用的，一旦发布到 npm，任何契约变化都会影响使用方。

所以发布不是一句 `npm publish`，而是：

- version bump。
- changelog。
- Skills sync。
- typecheck/test/build。
- tarball 内容检查。
- npm dist-tag 验证。
- npx smoke test。
- token 清理。
- progress 记录。

### 4. 解决历史功能下线

下线一个废弃能力比新增功能更考验工程边界。

My-Notion 的做法是：前端入口移除，历史 block 保留只读降级，CLI/MCP 不再暴露工具，Machine API 返回明确错误，scope 移除，文档清理，生产部署。

这类任务如果没有 DDD/SDD/PDD/TDD，很容易只删前端按钮，却忘了后端入口或外部 Agent 工具。

---

## 八、给 AI Agent 项目的几个建议

如果你也在做 AI Native 产品，我建议不要一开始就追求复杂框架，而是先建立这几个习惯。

### 1. 不要先写 Prompt，先定义领域词汇

如果团队里对“run”、“tool result”、“memory”、“source”、“confirmation”的理解都不一样，Prompt 写得再漂亮也会变形。

### 2. 不要只写接口，写协议

接口是“某次请求返回什么”，协议是“系统长期如何协作”。

Agent Stream、MCP、CLI、Memory 这类能力，都应该按协议思维设计。

### 3. 不要让 Agent 直接拥有副作用权限

写文档、写记忆、删除、归档、发布，都应该有明确确认链路或权限边界。

尤其是 MCP 和 CLI 场景，默认 dry-run 是一个很实用的安全策略。

### 4. 不要把 Prompt 当临时聊天记录

真正有价值的 Prompt 应该沉淀成：

- `AGENTS.md`
- Skills
- Checklist
- progress
- milestone
- release docs

这样 Agent 才能跨会话、跨任务保持一致。

### 5. 不要跳过发布后验证

发布成功不等于可用。

至少要做：

```bash
npm view <package> dist-tags --json
npx <package>@latest --help
```

如果是带 Skills 的包，还要验证随包资源是否存在。

---

## 九、总结

My-Notion 不是一个一次性 Demo，而是一个持续演进的 AI Native 知识工作台。

在这个过程中，我对 PDD、DDD、SDD、TDD 的理解越来越具体：

- `DDD` 解决“我们到底在做什么领域”的问题。
- `SDD` 解决“系统之间如何稳定协作”的问题。
- `PDD` 解决“Agent 如何按项目规则工作”的问题。
- `TDD` 解决“我们如何证明它没有坏”的问题。

它们不是互相替代的关系，而是一条链路：

```text
先用 DDD 统一语言
再用 SDD 固化契约
再用 PDD 约束 Agent 执行
最后用 TDD 验证交付结果
```

如果只做 PDD，Agent 可能很会写代码，但方向不稳定。

如果只做 DDD，架构概念很漂亮，但无法落地。

如果只做 SDD，协议很清楚，但执行过程可能失控。

如果只做 TDD，测试很多，但可能测的是错误的抽象。

而把四者串起来，才更接近我想要的 Agent 工程方式：

> 让 AI 参与复杂系统开发，但不把复杂系统交给随机性。

这也是 My-Notion 继续演进时，我会长期坚持的一套方法论。
