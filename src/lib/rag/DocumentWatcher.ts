type DocumentChangeCallback = (
  documentId: string,
  content: string,
  title: string,
) => void;

export class DocumentWatcher {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private debounceDelay: number;
  private callback: DocumentChangeCallback;

  constructor(debounceDelay: number = 3000, callback: DocumentChangeCallback) {
    this.debounceDelay = debounceDelay;
    this.callback = callback;
  }

  onDocumentChange(
    documentId: string,
    content: string,
    title: string,
  ): void {
    console.log(
      `[DocumentWatcher] 检测到文档变化: documentId=${documentId}, title=${title}`,
    );

    if (this.debounceTimers.has(documentId)) {
      clearTimeout(this.debounceTimers.get(documentId)!);
    }

    const timer = setTimeout(() => {
      console.log(
        `[DocumentWatcher] 防抖延迟结束，触发更新: documentId=${documentId}`,
      );
      this.callback(documentId, content, title);
      this.debounceTimers.delete(documentId);
    }, this.debounceDelay);

    this.debounceTimers.set(documentId, timer);
  }

  cancelWatch(documentId: string): void {
    if (this.debounceTimers.has(documentId)) {
      clearTimeout(this.debounceTimers.get(documentId)!);
      this.debounceTimers.delete(documentId);
      console.log(
        `[DocumentWatcher] 取消文档监测: documentId=${documentId}`,
      );
    }
  }

  cancelAllWatches(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();
    console.log(`[DocumentWatcher] 取消所有文档监测`);
  }

  setDebounceDelay(delay: number): void {
    this.debounceDelay = delay;
    console.log(`[DocumentWatcher] 设置防抖延迟: ${delay}ms`);
  }
}

let documentWatcherInstance: DocumentWatcher | null = null;

export const getDocumentWatcher = (
  debounceDelay: number = 3000,
  callback: DocumentChangeCallback,
): DocumentWatcher => {
  if (!documentWatcherInstance) {
    documentWatcherInstance = new DocumentWatcher(debounceDelay, callback);
  }
  return documentWatcherInstance;
};
