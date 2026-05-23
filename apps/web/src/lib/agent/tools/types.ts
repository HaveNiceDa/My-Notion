// 当前文档上下文，由前端传入，表示用户正在查看的文档
export interface CurrentDocumentContext {
  id: string;
  title: string;
  content?: string | null;
}

// Tool 执行上下文，传递用户身份、当前文档和模型信息
export interface ToolContext {
  userId: string;
  model: string;
  currentDocument?: CurrentDocumentContext | null;
}
