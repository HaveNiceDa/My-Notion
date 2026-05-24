# BlockNote AI 编辑器重构方案

## 1. 现状

### 1.1 架构

编辑器 AI 和侧边栏 Agent 是**两条独立链路**，职责不同：

| 维度 | 编辑器 AI | 侧边栏 Agent |
|---|---|---|
| 入口 | `/api/editor-ai/streamText` | `/api/agent/stream` |
| 协议 | Vercel AI SDK `UIMessageStream` | 自定义 NDJSON |
| 模型调用 | 直接 OpenAI SDK 单轮 | ReAct 循环 + tool 执行 |
| Tool | BlockNote 内置 `applyDocumentOperations` | `knowledge_search` / `web_search` / `document_read` |
| 限流 | ❌ 无 | ✅ 纯内存滑动窗口 |
| 上下文 | 文档块状态（HTML） | 对话消息 + 文档元数据 |

### 1.2 文件结构

```
apps/web/src/
├── app/api/editor-ai/streamText/route.ts     # 314 行，全堆一个文件
├── components/
│   ├── Editor.tsx                             # 编辑器主组件，混合 transport/locale/AI 配置
│   └── editor/
│       ├── EditorAIMenuController.tsx          # AI 菜单控制器
│       ├── customAIMenuItems.tsx               # 自定义菜单项（emoji 图标）
│       ├── EditorFormattingToolbar.tsx          # 格式化工具栏
│       └── EditorSlashMenu.tsx                  # 斜杠菜单
packages/ai/utils/
├── custom-ai-menu-items.ts                     # 菜单项定义（emoji 图标 + i18n）
├── compress-blocks.ts                          # 文档块压缩
└── index.ts                                    # 聚合导出 + extractTextFromDocument
```

---

## 2. 问题清单

| # | 问题 | 严重度 | 说明 |
|---|---|---|---|
| P1 | **无限流保护** | 🔴 | 编辑器 AI 路由无 rate limiting，可被无限调用消耗 API 配额 |
| P2 | **`tool_choice: "auto"` 与 `enable_thinking` 冲突** | 🔴 | DashScope 下 `enable_thinking=true` + 显式 `tool_choice="auto"` 可能触发 400 错误 |
| P3 | **route.ts 314 行全堆一个文件** | 🟡 | `injectDocumentStateMessages`、`convertToOpenAIMessages`、`toolDefinitionsToOpenAITools`、`extractTextContent` + 流处理全挤在一起 |
| P4 | **自定义菜单项 emoji 图标与官方风格不一致** | 🟡 | BlockNote 默认用 Remix Icons (`react-icons/ri`, size=18)，自定义项用 emoji（🇬🇧✨📝），视觉割裂 |
| P5 | **`autoSubmit` 字段定义但未消费** | 🟡 | `CustomAIMenuItemDef.autoSubmit` 存在但 `toItem()` 中未使用 |
| P6 | **`Editor.tsx` 混合了过多职责** | 🟢 | transport 构建、locale 处理、AI 配置全在编辑器组件内 |
| P7 | **`extractTextFromDocument` 类型不安全** | 🟢 | 使用 `any` 类型，放在 `utils/index.ts` 与其他 export 混在一起 |

---

## 3. 重构方案

### Step 1：加限流（P1）

复用已有的 `checkRateLimit`，在 `route.ts` 的 auth 校验后插入限流检查。

```typescript
// route.ts
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const rateLimitResult = await checkRateLimit(`editor-ai:${userId}`);
  if (!rateLimitResult.success) return rateLimited(rateLimitResult);

  // ... 现有逻辑
}
```

> 注意：key 加 `editor-ai:` 前缀，与侧边栏 Agent 的限流计数隔离。

### Step 2：修复 DashScope 兼容性（P2）

- 删除显式 `tool_choice: "auto"`（DashScope 默认值就是 auto，显式传会与 `enable_thinking` 冲突）
- 处理 `reasoning_content`：在流解析中过滤掉 thinking delta，避免内容混入文档操作

```typescript
// 修改前
tools: tools.length > 0 ? tools : undefined,
tool_choice: tools.length > 0 ? "auto" : undefined,

// 修改后
tools: tools.length > 0 ? tools : undefined,
```

### Step 3：拆分 route.ts（P3）

将 4 个工具函数抽取到 `packages/ai/server/` 下：

```
packages/ai/server/
├── editor-ai/
│   ├── inject-document-state.ts    # injectDocumentStateMessages
│   ├── convert-openai-messages.ts  # convertToOpenAIMessages + extractTextContent
│   ├── tool-definitions.ts         # toolDefinitionsToOpenAITools + 类型
│   └── stream-handler.ts           # 流处理逻辑（text/tool_call 状态机）
```

`route.ts` 精简为 ~50 行：auth → 限流 → 解析 → 调用 → 返回。

### Step 4：统一图标风格（P4）

将 emoji 图标替换为 Remix Icons（与 BlockNote 默认菜单一致）：

```typescript
// 修改前（packages/ai/utils/custom-ai-menu-items.ts）
{ key: "translate-to-en", icon: "🇬🇧", ... }

// 修改后
import { RiEarthLine, RiMagicLine, RiFileTextLine, ... } from "react-icons/ri";

// icon 字段改为 React 组件
{ key: "translate-to-en", icon: RiEarthLine, ... }
```

`customAIMenuItems.tsx` 中 `toItem()` 相应调整：

```typescript
// 修改前
icon: <span>{itemDef.icon}</span>

// 修改后
icon: <itemDef.icon size={18} />
```

需要安装 `react-icons` 依赖（BlockNote 已依赖，但需确认是否可直接使用）。

### Step 5：修复 autoSubmit（P5）

`toItem()` 中消费 `autoSubmit`，自动提交的菜单项点击后直接发送：

```typescript
onItemClick: (setPrompt: (userPrompt: string) => void) => {
  setPrompt(itemDef.prompt);
  // autoSubmit 由 BlockNote AIMenu 内部处理，无需额外代码
  // 但需确认 BlockNote AIMenu 是否支持 autoSubmit 语义
},
```

> 需验证：BlockNote `AIMenuSuggestionItem` 是否有 `autoSubmit` 属性。如果没有，需要在 `onItemClick` 回调中模拟回车提交。

### Step 6：抽取 Editor.tsx 职责（P6）

```
components/editor/
├── useEditorAITransport.ts    # transport 构建 + authFetch
├── editor-locale.ts           # getBlockNoteLocale + getAILocaleDict
└── ...现有文件
```

`Editor.tsx` 只保留编辑器实例化和渲染逻辑。

### Step 7：类型安全（P7）

`extractTextFromDocument` 去掉 `any`，移到 `packages/ai/utils/extract-text.ts`：

```typescript
type BlockNode = {
  type?: string;
  text?: string;
  content?: BlockNode[];
  children?: BlockNode[];
};
```

---

## 4. 实施优先级

| 顺序 | Step | 改动量 | 收益 |
|---|---|---|---|
| 1 | Step 1：加限流 | 1 文件 | 安全刚需 |
| 2 | Step 2：DashScope 兼容性 | 1 文件 | 修复潜在 400 错误 |
| 3 | Step 4：统一图标 | 2 文件 + 1 依赖 | 视觉一致性 |
| 4 | Step 3：拆分 route.ts | 5 文件 | 可维护性 |
| 5 | Step 5：autoSubmit | 1 文件 | 功能完整性 |
| 6 | Step 6：抽取 Editor.tsx | 3 文件 | 可维护性 |
| 7 | Step 7：类型安全 | 2 文件 | 代码质量 |

---

## 5. 风险

| 风险 | 缓解 |
|---|---|
| `react-icons` 可能不在项目直接依赖中 | BlockNote 已依赖 `react-icons/ri`，但需确认 pnpm 是否允许直接 import |
| BlockNote `AIMenuSuggestionItem` 可能不支持 `autoSubmit` | 需查看类型定义，不支持则在 `onItemClick` 中模拟 |
| 拆分 route.ts 可能引入 import 路径变化 | 逐步拆分，每步验证 typecheck + build |
