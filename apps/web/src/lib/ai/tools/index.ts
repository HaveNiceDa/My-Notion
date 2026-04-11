import { BaseTool, type ToolDefinition } from "./base";
import { WebSearchTool } from "./webSearch";

export * from "./base";
export * from "./webSearch";

export const TOOLS: Map<string, BaseTool> = new Map([
  ["web_search", new WebSearchTool()],
]);

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(TOOLS.values()).map((tool) => tool.definition);
}

export function getToolByName(name: string): BaseTool | undefined {
  return TOOLS.get(name);
}
