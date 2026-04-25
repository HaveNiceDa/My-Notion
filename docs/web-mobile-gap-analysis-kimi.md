# My-Notion Web vs Mobile 最新状态对照表

> 更新时间：2026-04-25
> 说明：本表基于当前代码状态整理，修正了历史分析中已过时的结论。

---

## 一、总体结论

当前项目已经从“Web 完整、Mobile 缺失较多”演进到“数据层基本统一、Mobile 主要功能已补齐、但 AI 能力和编辑器能力仍未完全对齐 Web”。

最关键的变化有两点：

1. **Mobile AI 已不是 Mock**，已经接入真实模型流式对话
2. **`@notion/business/hooks` 已在 Mobile 部分落地**，至少设置和搜索已接入共享状态

但仍有几个核心差距存在：

1. **Mobile AI 还没有接入 Web 同级的 RAG / Tool / 知识库检索能力**
2. **Mobile 编辑器正文图片上传仍未实现**
3. **部分架构债务仍未处理**，如 Web Chat 页面过重、Mobile 文档树递归查询、RAG 初始化效率问题

---

## 二、状态总览

| 模块 | 当前状态 | 说明 |
|---|---|---|
| 数据 Schema 共享 | 已完成 | Web / Mobile 都复用 `@notion/convex/schemas` |
| Convex 文档能力 | 已完成 | 文档 CRUD、收藏、回收站、知识库等两端都可用 |
| Convex Chat 数据表 | 已完成 | `aiConversations`、`aiMessages`、`aiThinkingSteps` 已具备 |
| Mobile 真实 AI 对话 | 已完成 | 已替代 mock，支持流式输出 |
| Mobile 对话历史管理 | 已完成 | 已支持列表、切换、删除、新建 |
| Mobile 模型选择 | 已完成 | ChatModal 中已支持模型切换 |
| Mobile 深度思考 UI | 已完成 | 已支持 reasoning 展示和折叠 |
| Mobile 设置共享 store | 已完成 | 已接入 `useSettings` |
| Mobile 搜索共享 store | 已完成 | 已接入 `useSearch` |
| Mobile 导航共享 store | 部分完成 | `useNavigation` 仍未看到实际接入 |
| Mobile 文档图标能力 | 已完成 | 已支持 Emoji Icon Picker，不再是固定图标 |
| Mobile 封面图上传 | 已完成 | 基于 `expo-image-picker` + Convex Storage |
| Mobile 编辑器内容格式互通 | 已完成 | 已使用 `@notion/business/content-compat` |
| Mobile 编辑器正文图片上传 | 未完成 | 仍无正文图片插入/上传链路 |
| Mobile 知识库 RAG 检索 | 未完成 | 当前 Mobile AI 未接入 Web 的 RAG 流程 |
| Mobile Tool Call / Web Search | 未完成 | 当前未看到与 Web 同级的工具链能力 |
| Web Chat 页面拆分 | 部分完成 | 抽了部分组件，但主页面仍很重 |
| RAG 初始化增量优化 | 未完成 | 仍会遍历知识库文档逐个检查 |
| Mobile Sidebar 树查询优化 | 未完成 | 仍为递归 `useQuery` |
| i18n 使用方式统一 | 未完成 | Web 仍是 `next-intl`，Mobile 仍是 `react-i18next` |

---

## 三、已完成

### 1. 数据层与基础能力

- **Schema 共享已完成**
  - Web 和 Mobile 都直接 re-export `@notion/convex/schemas`
- **文档能力共享已完成**
  - 文档创建、编辑、归档、恢复、收藏、知识库等基础能力已具备
- **Chat 数据结构已具备**
  - 已有 `aiConversations`、`aiMessages`、`aiThinkingSteps` 相关能力

### 2. Mobile 端已补齐的重要功能

- **真实 AI 对话已完成**
  - Mobile 已接入真实流式模型，不再是 mock 回复
- **对话历史管理已完成**
  - 支持会话列表、切换、新建、删除
- **模型选择已完成**
  - 用户可在 Mobile AI 对话中选择模型
- **深度思考展示已完成**
  - reasoning 内容已支持展示与折叠
- **设置 / 搜索共享状态已完成**
  - `useSettings`、`useSearch` 已在 Mobile 实际接入
- **图标选择已完成**
  - Mobile 文档已支持 Emoji 图标选择器
- **封面图上传已完成**
  - 通过 Convex Storage 实现上传和持久化
- **编辑器内容格式互通已完成**
  - 已通过共享兼容层做 BlockNote JSON / HTML 适配

---

## 四、部分完成

### 1. Mobile 共享状态管理

| 项目 | 状态 | 说明 |
|---|---|---|
| `useSettings` | 已接入 | 设置弹窗已使用共享 store |
| `useSearch` | 已接入 | 搜索弹窗已使用共享 store |
| `useNavigation` | 未确认落地 | 目前未看到 Mobile 端明确使用 |

结论：

- 共享 hooks **不是未做**，而是**部分完成**
- 历史文档里“Mobile 未接入共享 hooks”的结论已过时

### 2. Web AI Chat 页面拆分

当前 Web Chat 已经拆出了一些组件，例如：

- `ConversationSidebar`
- `TopNavigation`
- `MessageInput`
- `MessageList`

但主页面仍保留大量状态、流程和副作用逻辑，因此只能算：

- **组件拆分已做**
- **核心逻辑抽离仍未完成**

结论：

- 这项是 **部分完成**，不是完全未做

### 3. Mobile AI 能力

当前 Mobile AI 已经具备：

- 真实流式回复
- 对话持久化
- 对话历史管理
- 模型选择
- 深度思考显示

但还不具备：

- Web 同级 RAG 检索
- 知识库增强回答
- Tool Call / Web Search
- 与 Web 完全一致的 AI 体验

结论：

- **AI 对话能力已完成**
- **AI 增强能力仍未完成**
- 因此整体上应视为 **部分完成**

---

## 五、未完成

### 1. Mobile 编辑器正文图片上传

当前 Mobile 已支持：

- 封面图上传
- 图标选择
- 富文本编辑
- 内容自动保存

但仍未支持：

- 在正文编辑器中插入图片
- 上传正文图片
- 将图片作为文档内容的一部分保存和渲染

这是当前最明显的编辑器能力缺口之一。

### 2. Mobile 知识库 RAG 能力

当前 Mobile AI 还没有接入 Web 那套：

- `/api/rag-stream`
- Qdrant 向量检索
- Embeddings
- 知识库上下文增强
- 语义检索后的回答增强

因此 Mobile 目前更像：

- **真实聊天**
- 但不是 **知识库增强 AI 助手**

### 3. Tool Call / Web Search 能力

Web 端 AI 架构中已经有：

- Tool 定义
- Web Search
- 更复杂的 AI 链路

但 Mobile 目前未见同级能力接入，因此这部分仍未完成。

### 4. RAG 初始化与增量优化

当前 `ragUtils.ts` 仍然会：

- 获取知识库文档
- 逐个检查是否需要重新嵌入
- 在查询链路上执行较重初始化逻辑

说明这部分性能债务仍在。

### 5. Mobile 侧边栏递归查询优化

`SidebarDocumentTree` 当前模式仍然是：

- 每层展开发一次 `useQuery`
- 深层嵌套时查询数持续增长

这会影响复杂文档树下的性能和响应体验。

### 6. i18n 调用范式统一

当前仍然是：

- Web：`next-intl`
- Mobile：`react-i18next`

翻译文件虽然共享，但调用方式、使用心智和维护方式并未统一。

---

## 六、建议优先级

### P0

| 事项 | 优先级理由 | 建议 |
|---|---|---|
| Mobile 接入 Web 同级 RAG / 知识库 AI 能力 | 这是当前 Web / Mobile 最大能力差距 | 优先统一 AI 能力边界，明确 Mobile 是直连模型还是复用 Web AI 服务 |
| 明确 AI 架构统一方案 | 当前 Mobile 走直连模型，Web 走 API + RAG，两端策略不一致 | 先定方向，再推进实现，避免后续返工 |

### P1

| 事项 | 优先级理由 | 建议 |
|---|---|---|
| Mobile 编辑器正文图片上传 | 用户感知明显，是编辑体验的重要缺口 | 为 TenTap 增加图片插入、上传、持久化链路 |
| Mobile 文档树查询优化 | 深层树结构下性能风险较高 | 改为一次性拉取子树或按批次加载 |
| `useNavigation` 接入 Mobile | 补齐共享状态管理闭环 | 统一设置 / 搜索 / 导航三类状态管理 |

### P2

| 事项 | 优先级理由 | 建议 |
|---|---|---|
| Web AI Chat 页面进一步拆分 | 可维护性问题明显，但不阻塞功能 | 提取 `useAIChat` 或等价 hook，降低页面复杂度 |
| RAG 初始化增量缓存优化 | 性能优化价值高，但短期不如功能补齐紧急 | 做向量存储初始化缓存、增量检查、文档级别脏数据更新 |
| i18n 使用范式统一 | 架构一致性收益高，但不是当前功能阻塞点 | 统一翻译 key 规范和调用约定 |

---

## 七、建议的执行顺序

建议按下面顺序推进：

1. **先统一 Mobile AI 架构方向**
   - 决定 Mobile 是继续直连模型，还是统一走 Web AI 服务 / RAG 服务
2. **再补 Mobile 编辑器正文图片上传**
   - 这是最直接的功能缺口，用户感知最明显
3. **优化 Mobile 文档树查询**
   - 提升复杂层级下的性能
4. **补齐 `useNavigation`**
   - 完成共享 hooks 的最后一块
5. **治理 Web Chat / RAG 架构债务**
   - 做页面拆分和向量初始化优化

---

## 八、最终判断

### 已完成

- Schema 共享
- 文档基础能力共享
- Mobile 真实 AI 对话
- Mobile 对话历史管理
- Mobile 模型选择
- Mobile 深度思考展示
- Mobile 设置 / 搜索共享 hooks 接入
- Mobile 图标选择器
- Mobile 封面图上传
- 编辑器内容格式互通

### 部分完成

- Mobile AI 能力整体对齐 Web
- Mobile hooks 全量接入
- Web Chat 页面拆分

### 未完成

- Mobile 正文图片上传
- Mobile RAG / 知识库增强 AI
- Mobile Tool Call / Web Search
- RAG 增量优化
- Mobile 递归查询优化
- i18n 使用范式统一

### 当前最值得做的两件事

1. **补齐 Mobile 的 RAG / 知识库 AI 能力**
2. **补齐 Mobile 编辑器正文图片上传**

---
