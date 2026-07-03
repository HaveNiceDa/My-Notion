# M30 Mobile Editor Deepening

## 状态

- 状态：规划中
- 前置依赖：Mobile 基础文档编辑、正文图片插入入口、Web `/api/upload-image`
- 参考文档：`docs/web-mobile-gap-analysis.md`、`docs/mobile-debug-guide.md`

## 目标

补齐移动编辑器深水区能力，让 Mobile 不只“能打开和编辑”，而是在图片、复杂 block、键盘、选区、长文和弱网保存上具备可用体验。

## 范围

### In Scope

- 真机验证正文图片插入、上传、保存、重开文档渲染一致性。
- 权限拒绝、用户取消、上传失败、网络失败的可恢复提示。
- 梳理 TenTap / TipTap 与 Web BlockNote 的内容兼容边界。
- 定义复杂 block 的移动端策略：可编辑、只读降级、隐藏或提示不支持。
- 优化键盘避让、工具栏悬浮、选区操作、滚动定位和长文性能。
- 增加本地草稿保护，避免切后台或弱网时丢失未保存编辑。

### Out of Scope

- 不追求 Web BlockNote 能力 100% 对齐。
- 不引入完整 CRDT 或多人协同编辑。
- 不在本阶段实现所有复杂 block 的原生编辑器。
- 不改变 Convex 文档 schema，除非图片节点持久化确实需要补字段。

## 验收标准

- 真机选择图片后，正文中能插入并上传成功。
- 上传失败时文档不丢失，用户能重试或取消。
- 图片节点保存后重新打开文档能稳定渲染。
- 常见 block 在 Mobile 中有明确策略，不出现无提示的内容损坏。
- 长文编辑时键盘不遮挡核心输入区域，工具栏不会阻塞主要操作。
- 离开页面前会 flush 待保存正文，降低防抖保存丢失风险。

## 实施建议

1. 先记录 TenTap 当前输出格式和 Web BlockNote 当前存储格式的映射。
2. 为正文图片路径建立端到端 checklist：权限、选择、上传、插入、保存、重开。
3. 对 heading、list、quote、code、image 等高频 block 逐项定义兼容策略。
4. 给移动编辑器保存流程增加可观测日志，但不得记录文档敏感正文。
5. 对键盘/选区问题优先做真机验证，不只依赖模拟器。
6. 最后更新 `docs/web-mobile-gap-analysis.md` 的状态表。

## 验证命令

```bash
pnpm --filter @notion/mobile typecheck
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
```

真机验证需覆盖 iOS/Android 至少一个真实设备；如只验证单平台，需要在进度记录中说明。
