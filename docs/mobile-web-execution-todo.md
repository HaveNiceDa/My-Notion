# My-Notion Mobile / Web 执行 TODO 清单

> 更新时间：2026-04-25
> 来源：基于 `docs/web-mobile-gap-analysis-kimi.md` 当前状态分析拆解
> 目标：将 Web / Mobile 差距整理为可执行开发任务，按 `P0 / P1 / P2` 落到具体模块

---

## 一、执行原则

1. **优先缩小核心能力差距**
   - 先处理 Mobile AI 与 Web AI 的核心能力断层，再处理体验和架构债务
2. **优先补齐用户可感知缺口**
   - 正文图片上传、知识库问答优先级高于纯重构类工作
3. **优先统一能力边界，再做抽象**
   - 先明确 Mobile AI 最终走哪条链路，再决定是否进一步公共化 store / client / hook

---

## 二、P0

### P0-1 统一 Mobile AI 调用架构

- **目标**
  - 明确 Mobile AI 的最终接入方案：继续直连模型，还是统一走 Web API / RAG 服务
- **涉及模块**
  - `apps/mobile/app/src/lib/ai/chat.ts`
  - `apps/mobile/app/src/features/ai-chat/components/ChatModal.tsx`
  - `apps/web/src/app/api/chat/route.ts`
  - `apps/web/src/app/api/rag-stream/route.ts`
- **主要改动**
  - 抽一个统一的 Mobile AI Client 层
  - 统一流式响应协议、错误处理协议、超时与取消策略
  - 让 `ChatModal` 只依赖统一 AI 接口，不感知底层是直连模型还是 Web API
- **验收标准**
  - Mobile 侧只有一个 AI 请求入口
  - UI 层不直接耦合底层 AI 接入方式
  - 切换到底层实现时，`ChatModal` 主流程不需要大改
- **风险点**
  - 直连模型与 Web SSE 事件格式不同，协议统一要先做清楚

### P0-2 给 Mobile 接入知识库 RAG

- **目标**
  - 让 Mobile AI 具备与 Web 接近的知识库增强问答能力
- **涉及模块**
  - `apps/mobile/app/src/features/ai-chat/components/ChatModal.tsx`
  - `apps/mobile/app/src/lib/ai/chat.ts`
  - `apps/web/src/app/api/rag-stream/route.ts`
  - `apps/web/src/lib/rag/ragUtils.ts`
- **主要改动**
  - 在 Mobile 端增加“普通对话 / 知识库问答”模式
  - 优先复用 Web 已有的 `/api/rag-stream` 能力
  - 接入知识库检索结果流式输出
  - 明确无知识库数据时的降级策略
- **验收标准**
  - Mobile 能基于知识库文档回答问题
  - 检索失败时有明确错误提示或自动降级到普通对话
  - 与 Web 相比，能力边界清晰且可说明
- **依赖关系**
  - 建议依赖 `P0-1` 的统一 AI 接口方案

### P0-3 补齐 Mobile AI 的 Tool / Search 能力边界

- **目标**
  - 明确 Mobile 是否支持 Tool Call / Web Search，以及如何展示
- **涉及模块**
  - `apps/mobile/app/src/features/ai-chat/components/ChatModal.tsx`
  - `apps/mobile/app/src/lib/ai/chat.ts`
  - `apps/web/src/app/api/rag-stream/route.ts`
  - `packages/ai/tools`
- **主要改动**
  - 统一 AI 事件结构，至少定义：内容、reasoning、tool、error、end
  - 决定 Mobile 是否显示工具调用过程，还是只显示最终答案
  - 若不支持完整 Tool UI，也要在产品层明确边界
- **验收标准**
  - Web / Mobile 在 AI 能力说明上没有歧义
  - 产品和技术文档中能明确说明 Mobile 的 AI 支持范围
- **风险点**
  - 如果不先定义产品边界，后续 UI 和底层协议会反复返工

---

## 三、P1

### P1-1 补齐 Mobile 编辑器正文图片上传

- **目标**
  - 为 Mobile 文档编辑器增加正文图片插入、上传、保存、渲染能力
- **涉及模块**
  - `apps/mobile/app/(home)/document/[documentId].tsx`
  - `apps/mobile/app/src/lib/cover-image-upload.ts`
  - `packages/business/validation`
- **主要改动**
  - 为 TenTap 富文本编辑器增加图片插入入口
  - 复用 Convex Storage 上传机制，抽出正文图片上传 helper
  - 将上传后的图片 URL / 存储信息持久化到正文内容中
  - 确保重新打开文档后图片仍能正确渲染
- **验收标准**
  - 可以从相册选图并插入正文
  - 图片刷新后仍显示
  - 上传失败时有明确错误提示
  - 与封面图上传逻辑解耦
- **风险点**
  - TenTap 的图片节点能力要先确认；必要时需要扩展 editor bridge

### P1-2 优化 Mobile 文档树查询模型

- **目标**
  - 减少文档树深层展开时的递归查询开销
- **涉及模块**
  - `apps/mobile/app/src/features/home/components/sidebar-document-tree.tsx`
  - `apps/mobile/app/src/features/home/components/home-screen.tsx`
  - `apps/mobile/convex/documents.ts`
- **主要改动**
  - 减少当前递归组件每层单独 `useQuery` 的模式
  - 评估改为一次性拉取子树、批量拉 children，或增加节点级缓存
  - 优化展开 / 收起状态与数据获取策略
- **验收标准**
  - 深层文档树展开时不再频繁出现多次 loading
  - 查询次数明显下降
  - 大量嵌套文档下交互更流畅
- **风险点**
  - 子树一次性拉取可能增加单次 payload，需要平衡查询数和返回量

### P1-3 补齐 `useNavigation` 在 Mobile 的接入

- **目标**
  - 补齐 Mobile 在共享 hooks 上的最后一块，统一设置 / 搜索 / 导航状态管理
- **涉及模块**
  - `packages/business/hooks`
  - `apps/mobile/app/src/features/home/components/home-screen.tsx`
  - `apps/mobile/app/src/features/home/components/home-header.tsx`
- **主要改动**
  - 梳理 Mobile 当前导航相关局部状态
  - 将可共享的导航显隐 / 展开收起逻辑迁移到 `useNavigation`
  - 与 Web 端用法保持一致
- **验收标准**
  - Mobile 中设置、搜索、导航三类状态都走共享 hooks
  - 不再混用大量局部 `useState` 和共享 store

### P1-4 完善 Mobile AI 的会话体验细节

- **目标**
  - 提升会话管理可用性，使其接近 Web 端体验
- **涉及模块**
  - `apps/mobile/app/src/features/ai-chat/components/ChatModal.tsx`
  - `apps/mobile/convex/aiChat.ts`
- **主要改动**
  - 增加会话标题更新策略
  - 补删除确认、错误重试、网络失败恢复
  - 优化空状态、加载状态、切换状态细节
- **验收标准**
  - 切换、删除、新建会话过程稳定
  - 失败态可恢复，不丢失本轮上下文
  - 用户能明显感知会话管理体验提升

---

## 四、P2

### P2-1 拆分 Web AI Chat 页面

- **目标**
  - 降低 Web Chat 页面复杂度，提升可维护性
- **涉及模块**
  - `apps/web/src/app/[locale]/(main)/(AI)/Chat/page.tsx`
  - `apps/web/src/app/[locale]/(main)/(AI)/Chat/components/ConversationSidebar.tsx`
  - `apps/web/src/app/[locale]/(main)/(AI)/Chat/components/MessageInput.tsx`
  - `apps/web/src/app/[locale]/(main)/(AI)/Chat/components/MessageList.tsx`
- **主要改动**
  - 提取 `useAIChat` 或等价 hook
  - 把会话切换、流式请求、SSE 解析、状态同步从页面层抽走
  - 页面只负责布局编排与模块组合
- **验收标准**
  - `page.tsx` 明显瘦身
  - AI 核心流程逻辑具备单独维护能力
  - 后续复用或测试成本下降

### P2-2 做 RAG 初始化增量优化

- **目标**
  - 降低每次 RAG 查询时的初始化成本
- **涉及模块**
  - `apps/web/src/lib/rag/ragUtils.ts`
  - `apps/web/src/app/api/rag-stream/route.ts`
  - `apps/web/src/app/api/rag-documents/route.ts`
  - `packages/ai/rag/qdrantVectorStore.ts`
- **主要改动**
  - 增加向量存储初始化缓存
  - 基于文档级别判断是否需要增量更新
  - 避免每次都遍历整库并逐个检查
- **验收标准**
  - 重复查询明显更快
  - 新增 / 修改知识库文档时只处理增量
  - RAG 结果正确性不退化

### P2-3 统一 i18n 使用约定

- **目标**
  - 降低双端翻译维护成本，统一新增文案时的组织方式
- **涉及模块**
  - `packages/business/i18n`
  - `apps/web`
  - `apps/mobile`
- **主要改动**
  - 统一 key 命名规范
  - 统一跨端文案组织方式
  - 明确 Web 与 Mobile 调用层的约定，不要求立刻统一框架，但要统一维护心智
- **验收标准**
  - 新增文案时不需要双端各想一套 key 风格
  - 词条维护和查找路径更加清晰

### P2-4 去掉 Convex Chat 逻辑的镜像重复

- **目标**
  - 把 chat 相关逻辑进一步收敛到共享层，减少双端重复维护
- **涉及模块**
  - `apps/mobile/convex/aiChat.ts`
  - `apps/web/convex/aiChat.ts`
  - `packages/convex/chat`
- **主要改动**
  - 梳理现有 app 侧 Convex chat 逻辑与 package 侧逻辑的重叠
  - 尽量改为 package 侧单一实现，app 侧仅 re-export
- **验收标准**
  - Chat 逻辑有单一来源
  - 后续字段变更、索引调整、能力扩展不需要双改

### P2-5 评估 AI store 是否公共化

- **目标**
  - 为未来双端 AI 能力继续收敛做准备
- **涉及模块**
  - `apps/web/src/lib/store`
  - `packages/business/hooks`
  - `apps/mobile/app/src/features/ai-chat`
- **主要改动**
  - 评估 Web 侧多个 AI store 是否值得抽象为共享接口或共享 store
  - 不要求一次性公共化，但先统一能力模型与接口边界
- **验收标准**
  - 后续 Mobile 继续增强 AI 时，不需要再复制一套完全独立的状态模型

---

## 五、建议执行顺序

### 第一批

1. `P0-1` 统一 Mobile AI 调用架构
2. `P0-2` 给 Mobile 接入知识库 RAG

### 第二批

1. `P1-1` 补齐 Mobile 编辑器正文图片上传
2. `P1-2` 优化 Mobile 文档树查询模型

### 第三批

1. `P1-3` 补齐 `useNavigation` 在 Mobile 的接入
2. `P1-4` 完善 Mobile AI 的会话体验细节

### 第四批

1. `P2-1` 拆分 Web AI Chat 页面
2. `P2-2` 做 RAG 初始化增量优化

### 第五批

1. `P2-3` 统一 i18n 使用约定
2. `P2-4` 去掉 Convex Chat 逻辑的镜像重复
3. `P2-5` 评估 AI store 是否公共化

---

## 六、最小可交付版本

如果目标是最短路径缩小 Web / Mobile 核心体验差距，建议先只做这三件：

1. `P0-1` 统一 Mobile AI 调用架构
2. `P0-2` 给 Mobile 接入知识库 RAG
3. `P1-1` 补齐 Mobile 编辑器正文图片上传

这三项完成后，Mobile 将从“有 AI、能编辑”提升到“具备更接近 Web 的核心能力”。

---

## 七、任务分派建议

### 适合先独立成单的任务

- `P0-1`
- `P0-2`
- `P1-1`
- `P1-2`

### 适合在同一迭代内顺手完成的任务

- `P1-3`
- `P1-4`
- `P2-1`

### 适合专项优化 / 重构阶段处理的任务

- `P2-2`
- `P2-3`
- `P2-4`
- `P2-5`

---

## 八、完成定义

任务整体完成后，应满足以下结果：

- Mobile AI 与 Web AI 的核心能力边界明确
- Mobile 支持知识库增强问答
- Mobile 编辑器支持正文图片上传
- Mobile 的共享状态管理进一步统一
- Web / Mobile 的主要架构债务被显式收敛，不再继续扩大

---
