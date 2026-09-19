# AI 模型列表更新

## 目标

将 Web、Mobile 和共享 AI 后端允许使用的对话模型统一更新为 2026 年 9 月模型列表，并核对现有 Embedding 模型是否仍可使用。

## 完成内容

- 对话模型更新为：
  - `qwen3.8-max-0902`（Qwen Max 0902）
  - `qwen3.8-flash`（Qwen Flash）
  - `qwen3.8-27b`（Qwen 27B）
- 默认模型更新为 `qwen3.8-max-0902`。
- 移除 `kimi-k3`：当前百炼业务空间未激活 Kimi 产品，避免选择后返回上游 400。
- Web 模型选择器、共享后端白名单和相关组件测试保持一致。
- 旧模型 ID 不再通过共享后端白名单校验；浏览器中已保存的旧 ID 会自动回退到新默认模型。

## Embedding 核对

- 保留 `tongyi-embedding-vision-plus-2026-03-06` 和 1024 维配置。
- 阿里云百炼当前官方模型列表仍包含该模型，且明确支持 1024 维输出；现有原生多模态 Embedding API 请求结构与官方接口一致。
- 本地未配置 `LLM_API_KEY` 或 `DASHSCOPE_API_KEY`，因此未执行真实付费 API 请求。
- 未切换到 `qwen3.7-text-embedding-flash`，避免在模型仍可用时改变已有 Qdrant 向量空间和请求协议。

## 验证

- Node.js TypeScript strip-types 配置断言：通过。
- `git diff --check`：通过。
- pnpm 测试与类型检查：本地无已安装依赖，pnpm 自动触发整仓安装；因网络下载耗时过长而终止，未获得测试结果。
