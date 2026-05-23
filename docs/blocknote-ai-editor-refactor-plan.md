# BlockNote AI 编辑器重构方案

## 1. 现状分析

### 1.1 文件分布

| 文件 | 行数 | 职责 |
|---|---|---|
| `apps/web/src/components/editor/EditorAIMenuController.tsx` | 41 | 菜单控制器，桥接 BlockNote 和自定义菜单 |
| `apps/web/src/components/editor/customAIMenuItems.tsx` | 50 | 菜单项生成，调用 `getCustomItemsForContext` |
| `packages/ai/utils/custom-ai-menu-items.ts` | 107 | 菜单项定义 + locale 解析 + 上下文过滤 |
| `apps/web/src/app/api/editor-ai/streamText/route.ts` | 314 | 编辑器 AI API：消息注入 + 格式转换 + 流式输出 + tool 状态管理 |
| `packages/ai/utils/compress-blocks.ts` | — | 文档块压缩（长文档 token 优化） |
| `packages/ai/config/index.ts` | — | 模型配置（Base URL / Model ID / 默认模型） |

### 1.2 当前架构

```
用户在编辑器中输入 AI 指令
         │
         ▼
EditorAIMenuController ──► customAIMenuItems ──► getCustomItemsForContext
         │                                              │
         │                                    CUSTOM_AI_MENU_ITEMS[]
         │                                    (硬编码菜单项 + Record<string> i18n)
         │
         ▼
@blocknote/xl-ai AIMenuController
         │
         ▼ (Vercel AI SDK useChat)
POST /api/editor-ai/streamText
         │
         ├── injectDocumentStateMessages()  — 注入文档状态到消息
         ├── convertToOpenAIMessages()       — 转换为 OpenAI 格式
         ├── toolDefinitionsToOpenAITools()  — 转换 tool 定义
         │
         ▼
DashScope OpenAI Compatible API (stream)
         │
         ▼
createUIMessageStream → 流式返回给前端
```

### 1.3 现有问题

| # | 问题 | 严重度 | 描述 |
|---|---|---|---|
| 1 | **route.ts 314 行，职责混杂** | 🟡 | 消息注入、OpenAI 格式转换、流式写入、tool 状态管理全在一个文件，难以维护和测试 |
| 2 | **i18n 不走 next-intl** | 🟡 | `custom-ai-menu-items.ts` 用 `Record<string, string>` 手动管理多语言，与项目 next-intl 体系不一致 |
| 3 | **菜单项扩展不灵活** | 🟡 | 新增菜单项需直接修改 `CUSTOM_AI_MENU_ITEMS` 数组，没有注册机制，不便于后续扩展 |
| 4 | **编辑器 AI 和 Chat AI 模型配置不统一** | 🟠 | 编辑器 AI 用 `packages/ai/config` 的 `DEFAULT_MODEL`，Chat AI 用 `components/ai-chat/models.ts`，两套配置 |
| 5 | **缺少编辑器 AI 的 ErrorBoundary** | 🟡 | 编辑器 AI 失败时无优雅降级，用户看到原始错误 |
| 6 | **emoji 作为 icon 不够专业** | 🔵 | 菜单项用 emoji（🇬🇧✨📝）而非 SVG 图标，与 AI Chat 面板风格不一致 |
| 7 | **缺少单元测试** | 🟡 | 消息注入、格式转换等核心逻辑无测试覆盖 |

---

## 2. 重构目标

1. **职责分离**：route.ts 拆分为独立模块，每个文件单一职责
2. **统一模型配置**：编辑器 AI 和 Chat AI 共用一套模型配置
3. **菜单项注册机制**：支持动态注册，便于后续扩展
4. **i18n 对齐**：菜单项走 next-intl 翻译体系
5. **可测试性**：核心逻辑抽取为纯函数，便于单元测试

---

## 3. 重构方案

### 3.1 route.ts 拆分

**当前**：314 行，4 个职责混在一起

**重构后**：

```
apps/web/src/app/api/editor-ai/streamText/
├── route.ts                    # 精简入口：auth + 参数校验 + 编排（~50 行）
├── message-transformer.ts      # 消息注入 + OpenAI 格式转换（~120 行）
├── stream-writer.ts            # 流式写入 + tool 状态管理（~100 行）
└── system-prompt.ts            # 系统提示词管理（~30 行）
```

#### route.ts（精简后）

```typescript
// 只做 auth + 参数校验 + 编排
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return unauthorized();

  const { messages, toolDefinitions, modelId } = await parseRequest(req);
  const openai = createOpenAIClient();

  const injectedMessages = injectDocumentStateMessages(messages);
  const openaiMessages = convertToOpenAIMessages(injectedMessages);
  const tools = toolDefinitionsToOpenAITools(toolDefinitions);

  return streamEditorAI({ openai, model: resolveModel(modelId), messages: openaiMessages, tools });
}
```

#### message-transformer.ts

```typescript
// 纯函数，便于单元测试
export function injectDocumentStateMessages(messages): Message[]
export function convertToOpenAIMessages(messages): OpenAI.ChatCompletionMessageParam[]
export function toolDefinitionsToOpenAITools(toolDefs): OpenAI.ChatCompletionTool[]
export function extractTextContent(msg): string
```

#### stream-writer.ts

```typescript
// 流式写入 + tool 状态追踪
export async function streamEditorAI(params: StreamEditorAIParams): Promise<Response>
```

#### system-prompt.ts

```typescript
// 系统提示词集中管理，便于后续 A/B 测试
export const EDITOR_AI_SYSTEM_PROMPT = `...`;
```

### 3.2 统一模型配置

**当前**：编辑器 AI 用 `packages/ai/config` 的 `DEFAULT_MODEL`（单一默认值），Chat AI 用 `components/ai-chat/models.ts`（多模型选择）

**重构后**：统一到 `packages/ai/config`

```typescript
// packages/ai/config/models.ts
export const AI_MODELS = ["deepseek-v4-pro", "qwen3.6-27b", "kimi-k2.6", "glm-5.1"] as const;
export type AIModelId = (typeof AI_MODELS)[number];
export const DEFAULT_MODEL: AIModelId = "deepseek-v4-pro";

export const MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "qwen3.6-27b": "Qwen3.6 27B",
  "kimi-k2.6": "Kimi K2.6",
  "glm-5.1": "GLM 5.1",
};

export const MODEL_ID_MAPPING: Record<AIModelId, string> = {
  "deepseek-v4-pro": "deepseek-v4-pro",
  "qwen3.6-27b": "qwen3.6-27b",
  "kimi-k2.6": "kimi-k2.6",
  "glm-5.1": "glm-5.1",
};
```

- `components/ai-chat/models.ts` 改为从 `@notion/ai/config` 重新导出
- 编辑器 AI route 也从 `@notion/ai/config` 导入，支持 `modelId` 参数

### 3.3 菜单项注册机制

**当前**：直接修改 `CUSTOM_AI_MENU_ITEMS` 数组

**重构后**：注册模式

```typescript
// packages/ai/utils/ai-menu-registry.ts

export interface AIMenuItemDef {
  key: string;
  icon: React.ComponentType<{ className?: string }>;  // Lucide 图标
  requiresSelection: boolean;
  autoSubmit: boolean;
  titleKey: string;      // next-intl 翻译 key，如 "AI.editorMenu.improveWriting"
  subtextKey: string;    // next-intl 翻译 key
  prompt: string;
}

const registry = new Map<string, AIMenuItemDef>();

export function registerAIMenuItem(def: AIMenuItemDef): void {
  registry.set(def.key, def);
}

export function getAIMenuItems(
  hasSelection: boolean,
  t: (key: string) => string,
): AIMenuItemDef[] {
  return Array.from(registry.values())
    .filter(item => item.requiresSelection === hasSelection)
    .map(item => ({
      ...item,
      title: t(item.titleKey),
      subtext: t(item.subtextKey),
    }));
}

// 内置菜单项注册
registerAIMenuItem({ key: "translate-to-en", icon: Languages, requiresSelection: true, ... });
registerAIMenuItem({ key: "improve-writing", icon: Sparkles, requiresSelection: true, ... });
// ...
```

**扩展方式**：

```typescript
// 后续新增菜单项，只需调用注册函数
registerAIMenuItem({
  key: "explain-code",
  icon: Code,
  requiresSelection: true,
  autoSubmit: true,
  titleKey: "AI.editorMenu.explainCode",
  subtextKey: "AI.editorMenu.explainCodeDesc",
  prompt: "Explain the selected code in simple terms",
});
```

### 3.4 i18n 对齐

**当前**：`Record<string, string>` 手动管理

**重构后**：走 next-intl 翻译体系

在 `packages/business/i18n/zh-CN.json` 和 `en.json` 的 `AI` 命名空间下新增：

```json
{
  "AI": {
    "editorMenu": {
      "translateToEn": "翻译为英文",
      "translateToEnDesc": "将选中文本翻译为英文",
      "translateToZh": "翻译为中文",
      "translateToZhDesc": "将选中文本翻译为中文",
      "improveWriting": "改善写作",
      "improveWritingDesc": "改善写作风格和表达",
      "makeShorter": "精简文本",
      "makeShorterDesc": "精简选中文本",
      "makeLonger": "扩写文本",
      "makeLongerDesc": "扩写选中文本",
      "generateOutline": "生成大纲",
      "generateOutlineDesc": "根据主题生成大纲",
      "continueWriting": "继续写作",
      "continueWritingDesc": "继续往下写",
      "summarizeAbove": "总结上方",
      "summarizeAboveDesc": "总结上方内容"
    }
  }
}
```

### 3.5 icon 规范化

**当前**：emoji（🇬🇧✨📝✍️📌）

**重构后**：Lucide 图标

| 菜单项 | 当前 emoji | 替换为 Lucide 图标 |
|---|---|---|
| 翻译为英文 | 🇬🇧 | `Languages` |
| 翻译为中文 | 🇨🇳 | `Languages` |
| 改善写作 | ✨ | `Sparkles` |
| 精简文本 | 📝 | `Minimize2` |
| 扩写文本 | 📄 | `Maximize2` |
| 生成大纲 | 📋 | `List` |
| 继续写作 | ✍️ | `PenLine` |
| 总结上方 | 📌 | `AlignLeft` |

---

## 4. 实施步骤

| Step | 内容 | 优先级 |
|---|---|---|
| 1 | route.ts 拆分：抽取 `message-transformer.ts` | P1 |
| 2 | route.ts 拆分：抽取 `stream-writer.ts` | P1 |
| 3 | route.ts 拆分：抽取 `system-prompt.ts` | P1 |
| 4 | 统一模型配置到 `packages/ai/config/models.ts` | P1 |
| 5 | 创建 `ai-menu-registry.ts`，迁移内置菜单项 | P2 |
| 6 | i18n 对齐：菜单项走 next-intl | P2 |
| 7 | icon 规范化：emoji → Lucide | P3 |
| 8 | 编辑器 AI ErrorBoundary | P2 |
| 9 | 单元测试：message-transformer + stream-writer | P2 |
| 10 | 验证：typecheck + build + 功能测试 | 全部 |

---

## 5. 风险与注意事项

| 风险 | 缓解措施 |
|---|---|
| `@blocknote/xl-ai` 的 `AIMenuSuggestionItem` 接口限制 | icon 字段类型需确认是否支持 React 组件，若只支持 string 则保留 emoji |
| Vercel AI SDK `useChat` 协议兼容 | route.ts 拆分后必须保持 `createUIMessageStream` 的输出格式不变 |
| 菜单注册时机 | 注册函数需在模块加载时执行（顶层 `registerAIMenuItem` 调用），确保首次渲染时可用 |
| 编辑器 AI 与 Chat AI 模型选择差异 | 编辑器 AI 可暂不支持用户切换模型，但后端应接受 `modelId` 参数预留扩展 |

---

## 6. 后续演进

| 方向 | 描述 | 优先级 |
|---|---|---|
| 编辑器 AI 模型选择 | 在编辑器工具栏或 AI 菜单中支持模型切换 | P2 |
| 自定义 AI 指令 | 用户可保存常用 prompt 为自定义菜单项 | P3 |
| AI 操作历史 | 记录编辑器 AI 操作，支持撤销/重做 | P3 |
| 多轮对话 | 编辑器 AI 支持追问，而非每次独立请求 | P2 |
