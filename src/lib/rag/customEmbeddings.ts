import { Embeddings } from "@langchain/core/embeddings";
import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";

// 自定义Embeddings实现
export class CustomEmbeddings extends Embeddings {
  private embeddings: AlibabaTongyiEmbeddings;

  constructor() {
    super({}); // 调用父类构造函数
    // 初始化通义千问embeddings
    this.embeddings = new AlibabaTongyiEmbeddings({
      modelName: "text-embedding-v4",
      apiKey: process.env.LLM_API_KEY,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    console.log(`[CustomEmbeddings] 生成 ${texts.length} 个文档的嵌入...`);
    
    const batchSize = 10;
    const embeddingsList: number[][] = [];
    
    // 分批处理，每批不超过10个
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[CustomEmbeddings] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}，大小: ${batch.length}`);
      
      const batchEmbeddings = await this.embeddings.embedDocuments(batch);
      embeddingsList.push(...batchEmbeddings);
    }
    
    return embeddingsList;
  }

  async embedQuery(text: string): Promise<number[]> {
    console.log(`[CustomEmbeddings] 生成查询的嵌入...`);

    const embedding = await this.embeddings.embedQuery(text);
    return embedding;
  }
}
