import { myNotionToolManifest } from "./manifest.js";
import { toToolResult } from "../results/tool-result.js";

export function buildMyNotionReadmeMarkdown() {
  const tools = myNotionToolManifest
    .map((tool) => `- \`${tool.name}\`: ${tool.description} 安全策略：${tool.safety}`)
    .join("\n");

  return [
    "# My-Notion MCP Server",
    "",
    "这是 My-Notion 的独立 MCP STDIO server，面向支持 MCP 的 Agent / Client 暴露文档工具。",
    "",
    "## 启动方式",
    "",
    "```bash",
    "my-notion-mcp-server --transport stdio",
    "```",
    "",
    "兼容入口仍可用：",
    "",
    "```bash",
    "my-notion mcp serve --transport stdio",
    "```",
    "",
    "## 认证",
    "",
    "- 推荐先运行 `my-notion auth login` 完成浏览器授权。",
    "- MCP server 从 CLI config 或 `MY_NOTION_API_TOKEN` / `MY_NOTION_API_URL` 读取凭据。",
    "- 不要把完整 PAT 作为 tool 参数传入，也不要写入文档、日志或聊天。",
    "",
    "## 内容格式",
    "",
    "- Agent / CLI / MCP 默认只读写 Markdown。",
    "- My-Notion 内部存储 BlockNote JSON。",
    "- 使用 `contentMarkdown` / `structuredContent.markdown` 作为 Agent 可编辑视图。",
    "- 不要让普通 Agent 直接生成或解析 BlockNote JSON。",
    "",
    "## 工具",
    "",
    tools,
    "",
    "## 写入安全规则",
    "",
    "- `my_notion_docs_create` 和 `my_notion_docs_update` 默认 `dryRun: true`。",
    "- dry-run 只返回预览，不创建或修改真实文档。",
    "- 只有用户明确批准后，Agent 才能设置 `dryRun: false` 执行真实写入。",
    "- 覆盖写入前必须先调用 `my_notion_docs_fetch` 读取原文。",
    "",
    "## 推荐调用顺序",
    "",
    "1. 先调用 `my_notion_readme` 了解工具契约。",
    "2. 需要找文档时调用 `my_notion_docs_search`。",
    "3. 需要编辑前调用 `my_notion_docs_fetch`。",
    "4. 创建或更新先用 dry-run 预览。",
    "5. 用户确认后才用 `dryRun: false` 提交。",
  ].join("\n");
}

export function readmeTool() {
  const markdown = buildMyNotionReadmeMarkdown();
  return toToolResult({
    markdown,
    tools: myNotionToolManifest,
    transport: "stdio",
    auth: {
      preferred: "my-notion auth login",
      envFallbacks: ["MY_NOTION_API_URL", "MY_NOTION_API_TOKEN"],
    },
    contentContract: {
      editableFormat: "markdown",
      internalFormat: "blocknote-json",
    },
  }, markdown);
}
