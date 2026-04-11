import promptConfig from "./system-prompts.json";

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
    this.config = promptConfig as PromptConfig;
  }

  generateWithRagPrompt(
    searchResults: SearchResult[],
    query: string,
  ): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const sortedResults = [...searchResults].sort((a, b) => b.score - a.score);
    
    const relevantResults = sortedResults.filter(result => result.score >= 0.6);
    console.log(`[PromptLoader] 过滤后相关文档数量: ${relevantResults.length}`);

    const context = relevantResults
      .map((result, index) => {
        console.log(`[PromptLoader] 文档${index + 1} metadata:`, result.document.metadata);
        const docTitle = result.document.metadata?.title || result.document.metadata?.documentId || `文档 ${index + 1}`;
        return `#### ${docTitle} (相关性: ${(result.score * 100).toFixed(1)}%)\n${result.document.pageContent}`;
      })
      .join('\n\n');

    console.log(`[PromptLoader] 构建的上下文长度: ${context.length} 字符`);

    const systemPrompt = this.config.prompts["with-rag"].system;

    const userPrompt = this.config.prompts["with-rag"].user
      .replace("{{context}}", context)
      .replace("{{query}}", query);

    return {
      systemPrompt,
      userPrompt
    };
  }

  generateWithoutRagPrompt(query: string): {
    systemPrompt: string;
    userPrompt: string;
  } {
    const systemPrompt = this.config.prompts["without-rag"].system;

    const userPrompt = this.config.prompts["without-rag"].user.replace(
      "{{query}}",
      query,
    );

    return {
      systemPrompt,
      userPrompt
    };
  }

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

export const promptLoader = new PromptLoader();
export default PromptLoader;
