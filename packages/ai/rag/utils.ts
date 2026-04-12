import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 40,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

export const buildEnhancedQuery = (
  query: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): string => {
  if (conversationHistory.length === 0) {
    return query;
  }

  const recentHistory = conversationHistory.slice(-3);

  const historySummary = recentHistory
    .map(
      (msg) =>
        `${msg.role === "user" ? "用户" : "助手"}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
    )
    .join("\n");

  return `基于之前的对话:\n${historySummary}\n\n当前问题: ${query}`;
};
