import type { HomeWorkspaceSnapshot } from "../types";

/** 占位数据，后续替换为接口 / Convex */
export const mockHomeWorkspace: HomeWorkspaceSnapshot = {
  workspaceTitle: "我的工作空间",
  recent: [
    { id: "r1", title: "参考的", iconKind: "doc" },
    { id: "r2", title: "参考文献", iconKind: "database", subtitle: "表格" },
    { id: "r3", title: "毕业论文", iconKind: "doc" },
    { id: "r4", title: "项目看板", iconKind: "database" },
  ],
  knowledgeBase: [
    { id: "kb1", title: "产品需求收集", iconKind: "doc" },
    { id: "kb2", title: "技术方案索引", iconKind: "folder", children: [] },
  ],
  favorites: [
    { id: "f1", title: "go学习", iconKind: "doc" },
    { id: "f2", title: "Agent", iconKind: "doc" },
  ],
  privatePages: [
    {
      id: "p1",
      title: "go学习",
      iconKind: "doc",
      children: [{ id: "p1-1", title: "并发笔记", iconKind: "doc" }],
    },
    { id: "p2", title: "简历书写", iconKind: "doc" },
    { id: "p3", title: "project", iconKind: "folder", children: [] },
    { id: "p4", title: "毕业论文", iconKind: "doc" },
    { id: "p5", title: "科研笔记", iconKind: "doc" },
    { id: "p6", title: "参考经验", iconKind: "database" },
  ],
};
