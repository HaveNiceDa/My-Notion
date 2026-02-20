type EmbeddingTask = {
  documentId: string;
  userId: string;
  content: string;
  title: string;
  priority: number;
};

type TaskCallback = (
  status: "pending" | "processing" | "completed" | "failed",
  documentId: string,
  error?: Error,
) => void;

export class EmbeddingQueue {
  private queue: EmbeddingTask[] = [];
  private isProcessing = false;
  private callbacks: Map<string, TaskCallback[]> = new Map();
  private maxConcurrentTasks = 1;
  private activeTasks = 0;

  constructor(maxConcurrentTasks: number = 1) {
    this.maxConcurrentTasks = maxConcurrentTasks;
  }

  addTask(
    documentId: string,
    userId: string,
    content: string,
    title: string,
    priority: number = 1,
    callback?: TaskCallback,
  ): void {
    console.log(
      `[EmbeddingQueue] 添加任务: documentId=${documentId}, title=${title}, priority=${priority}`,
    );

    const existingIndex = this.queue.findIndex(
      (task) => task.documentId === documentId,
    );
    if (existingIndex !== -1) {
      this.queue.splice(existingIndex, 1);
    }

    const task: EmbeddingTask = {
      documentId,
      userId,
      content,
      title,
      priority,
    };

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);

    if (callback) {
      if (!this.callbacks.has(documentId)) {
        this.callbacks.set(documentId, []);
      }
      this.callbacks.get(documentId)!.push(callback);
    }

    this.notifyCallbacks(documentId, "pending");
    this.processQueue();
  }

  private notifyCallbacks(
    documentId: string,
    status: "pending" | "processing" | "completed" | "failed",
    error?: Error,
  ): void {
    const callbacks = this.callbacks.get(documentId);
    if (callbacks) {
      callbacks.forEach((callback) => callback(status, documentId, error));
    }
    if (status === "completed" || status === "failed") {
      this.callbacks.delete(documentId);
    }
  }

  private async processQueue(): Promise<void> {
    if (
      this.isProcessing ||
      this.queue.length === 0 ||
      this.activeTasks >= this.maxConcurrentTasks
    ) {
      return;
    }

    this.isProcessing = true;

    while (
      this.queue.length > 0 &&
      this.activeTasks < this.maxConcurrentTasks
    ) {
      const task = this.queue.shift();
      if (task) {
        this.activeTasks++;
        this.notifyCallbacks(task.documentId, "processing");
        this.processTask(task).finally(() => {
          this.activeTasks--;
          this.processQueue();
        });
      }
    }

    this.isProcessing = false;
  }

  private async processTask(task: EmbeddingTask): Promise<void> {
    try {
      console.log(
        `[EmbeddingQueue] 开始处理任务: documentId=${task.documentId}, title=${task.title}`,
      );

      const { initVectorStore, extractTextFromDocument } =
        await import("./rag");
      const { RecursiveCharacterTextSplitter } =
        await import("@langchain/textsplitters");
      const { CustomEmbeddings } = await import("./customEmbeddings");

      const vectorStore = await initVectorStore(task.userId);
      const text = extractTextFromDocument(task.content);

      if (!text) {
        console.log(`[EmbeddingQueue] 文档无内容，跳过: ${task.title}`);
        this.notifyCallbacks(task.documentId, "completed");
        return;
      }

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 200,
        chunkOverlap: 20,
        separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
      });

      const splits = await textSplitter.splitText(text);
      console.log(
        `[EmbeddingQueue] 文档 "${task.title}" 分割为 ${splits.length} 个chunks`,
      );

      const embeddings = await new CustomEmbeddings().embedDocuments(splits);
      const chunks = splits.map((split, index) => ({
        chunkIndex: index,
        pageContent: split,
        metadata: { documentId: task.documentId, title: task.title },
        embedding: embeddings[index],
      }));

      await vectorStore.addDocumentChunks(
        task.userId,
        task.documentId as any,
        chunks,
      );
      console.log(
        `[EmbeddingQueue] 任务完成: documentId=${task.documentId}, title=${task.title}`,
      );

      this.notifyCallbacks(task.documentId, "completed");
    } catch (error) {
      console.error(
        `[EmbeddingQueue] 任务失败: documentId=${task.documentId}, title=${task.title}`,
        error,
      );
      this.notifyCallbacks(task.documentId, "failed", error as Error);
    } finally {
      this.processQueue();
    }
  }

  cancelTask(documentId: string): void {
    const index = this.queue.findIndex(
      (task) => task.documentId === documentId,
    );
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`[EmbeddingQueue] 取消任务: documentId=${documentId}`);
    }
    this.callbacks.delete(documentId);
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
    this.callbacks.clear();
    console.log(`[EmbeddingQueue] 清空队列`);
  }
}

let embeddingQueueInstance: EmbeddingQueue | null = null;

export const getEmbeddingQueue = (): EmbeddingQueue => {
  if (!embeddingQueueInstance) {
    embeddingQueueInstance = new EmbeddingQueue(1);
  }
  return embeddingQueueInstance;
};
