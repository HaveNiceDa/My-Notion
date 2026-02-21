// 直接导入JSON配置文件
import promptConfig from "@/src/config/prompts/system-prompts.json";

// 定义prompt配置类型
interface PromptConfig {
  character: string;
  style: string;
  prompts: {
    "with-rag": {
      system: string;
      user: string;
    };
    "without-rag": {
      system: string;
      user: string;
    };
  };
}

// 定义检索结果类型
export interface SearchResult {
  document: {
    pageContent: string;
    metadata: any;
  };
  score: number;
}

class PromptLoader {
  private config: PromptConfig;

  constructor() {
    // 使用导入的配置
    this.config = promptConfig as PromptConfig;
  }

  /**
   * 生成带RAG检索结果的prompt
   */
  generateWithRagPrompt(
    searchResults: SearchResult[],
    query: string,
  ): {
    systemPrompt: string;
    userPrompt: string;
  } {
    // 确保检索结果按相关性排序
    const sortedResults = [...searchResults].sort((a, b) => b.score - a.score);
    
    // 过滤掉相关性低于0.7的文档
    const relevantResults = sortedResults.filter(result => result.score >= 0.7);
    console.log(`[PromptLoader] 过滤后相关文档数量: ${relevantResults.length}`);

    // 构建上下文
    const context = relevantResults
      .map((result, index) => {
        // 打印metadata信息用于调试
        console.log(`[PromptLoader] 文档${index + 1} metadata:`, result.document.metadata);
        // 获取真实文档名字
        const docTitle = result.document.metadata?.title || result.document.metadata?.documentId || `文档 ${index + 1}`;
        return `#### ${docTitle} (相关性: ${(result.score * 100).toFixed(1)}%)\n${result.document.pageContent}`;
      })
      .join('\n\n');

    console.log(`[PromptLoader] 构建的上下文长度: ${context.length} 字符`);

    // 生成system prompt
    const systemPrompt = this.config.prompts["with-rag"].system;

    // 生成user prompt
    const userPrompt = this.config.prompts["with-rag"].user
      .replace("{{context}}", context)
      .replace("{{query}}", query);

    return {
      systemPrompt,
      userPrompt
    };
  }

  /**
   * 生成无RAG检索结果的prompt
   */
  generateWithoutRagPrompt(query: string): {
    systemPrompt: string;
    userPrompt: string;
  } {
    // 生成system prompt
    const systemPrompt = this.config.prompts["without-rag"].system;

    // 生成user prompt
    const userPrompt = this.config.prompts["without-rag"].user.replace(
      "{{query}}",
      query,
    );

    return {
      systemPrompt,
      userPrompt
    };
  }

  /**
   * 生成prompt（根据是否有检索结果自动选择）
   */
  generatePrompt(
    searchResults: SearchResult[],
    query: string,
  ): {
    systemPrompt: string;
    userPrompt: string;
  } {
    if (searchResults.length > 0) {
      return this.generateWithRagPrompt(searchResults, query);
    } else {
      return this.generateWithoutRagPrompt(query);
    }
  }

  /**
   * 获取角色信息
   */
  getCharacterInfo(): {
    character: string;
    style: string;
  } {
    return {
      character: this.config.character,
      style: this.config.style
    };
  }
}

// 导出单例实例
export const promptLoader = new PromptLoader();
export default PromptLoader;