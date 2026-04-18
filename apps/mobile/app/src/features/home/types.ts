/** 与 web 端侧栏文档类型大致对应，便于后续接 Convex / API */

export type PageIconKind = "doc" | "database" | "folder";

export type HomePageItem = {
  id: string;
  title: string;
  iconKind: PageIconKind;
  /** 子页面（侧栏树） */
  children?: HomePageItem[];
};

export type HomeRecentItem = {
  id: string;
  title: string;
  subtitle?: string;
  iconKind: PageIconKind;
};

export type HomeWorkspaceSnapshot = {
  workspaceTitle: string;
  recent: HomeRecentItem[];
  knowledgeBase: HomePageItem[];
  favorites: HomePageItem[];
  privatePages: HomePageItem[];
};
