# M10: AI Chat 侧边栏 + 去除硬编码思考过程

## 目标

将 AI Chat 从独立页面重构为右侧可拖拽侧边栏面板，去除硬编码思考过程，整合碎片化状态管理。

## 关键改动

1. **布局重构**：AI Chat 从 `/Chat` 全屏页面 → 右侧可拖拽侧边栏（320-520px）
2. **状态整合**：7 个碎片 Zustand store → 统一 `useAIChat` hook
3. **去除硬编码思考过程**：删除 StepItem、thinking_step 事件处理、左侧思考面板
4. **模型配置更新**：默认模型 qwen3.6-plus → deepseek-v4-pro
5. **导航交互**：侧边栏 "Notion AI" 按钮从路由跳转 → toggle 面板

## 验证

- `pnpm build`: ✅ 通过
- 旧 `/Chat` 路由已移除
- 侧边栏面板 toggle 正常

## 关联 progress 文件

- progress/20260521-233000.md — 方案设计阶段
- progress/20260522-001500.md — Phase 1 实施

## 待办

- [ ] 编辑器 AI 模型与侧边栏模型同步
- [ ] 移动端 AI Chat 适配
- [ ] 图片上传功能迁移
