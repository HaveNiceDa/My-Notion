import OpenAI from "openai";
import type { AgentTool } from "./tools/definitions";
import type { ToolContext } from "./tools/types";
import { enqueueEvent, streamModelResponse, applyThinkingParams } from "./stream";
import type { AgentTracer } from "./trace";
import { getErrorMessage, summarizeForTrace } from "./trace";
import {
  getCachedToolResult,
  getToolSignature,
  setCachedToolResult,
} from "./tool-result-cache";

const MAX_ITERATIONS = 5;

interface ReActLoopParams {
  openai: OpenAI;
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  tools: OpenAI.ChatCompletionTool[];
  toolMap: Map<string, AgentTool>;
  toolContext: ToolContext;
  enableThinking: boolean;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  responseId: string;
  trace?: AgentTracer;
}

// ReAct 循环引擎：LLM 自主决策是否调用工具，支持多轮工具调用
// 每轮迭代：LLM 生成回复 → 如有 tool_calls 则执行 → 将结果加入 messages → 继续下一轮
// 最多 MAX_ITERATIONS 轮，防止无限循环
export async function runReActLoop(params: ReActLoopParams): Promise<void> {
  const {
    openai,
    model,
    tools,
    toolMap,
    toolContext,
    enableThinking,
    controller,
    encoder,
    responseId,
    trace,
  } = params;
  const messages = [...params.messages];
  const toolResultCache = new Map<string, string>();
  let reachedMaxIterationsWithTools = false;

  debugLog(
    `[ReAct] 开始循环 model=${model} tools=[${tools.map((t) => "function" in t ? t.function.name : t.type).join(",")}] messages=${messages.length} thinking=${enableThinking}`,
  );

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    debugLog(`[ReAct] 迭代 ${iteration + 1}/${MAX_ITERATIONS}`);
    const iterationStartedAt = nowMs();
    trace?.mark("react_iteration_start", {
      iteration: iteration + 1,
      maxIterations: MAX_ITERATIONS,
      messageCount: messages.length,
    });

    // 用 Record 类型构建参数，以便合并 DashScope 扩展参数
    const createParams: Record<string, unknown> = {
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      // tool_choice 始终 "auto"：规避 DashScope thinking mode 与 object/required 的 400 冲突
      tool_choice: tools.length > 0 ? "auto" : undefined,
      // 限制最大输出 token，防止无限生成
      max_tokens: 4096,
      stream: true,
    };

    // 将 enable_thinking 和 thinking_budget 作为顶层参数合并（Node.js SDK 做法）
    applyThinkingParams(createParams, enableThinking);

    const pendingToolCalls = await streamModelResponse({
      openai,
      params: createParams as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
      controller,
      encoder,
      responseId,
      enableThinking,
      trace,
      iteration: iteration + 1,
    });

    // LLM 没有调用任何 tool → 直接输出文本，循环结束
    if (pendingToolCalls.length === 0) {
      debugLog(`[ReAct] 迭代 ${iteration + 1} 无 tool_calls，循环结束`);
      trace?.event("react_iteration_end", nowMs() - iterationStartedAt, {
        iteration: iteration + 1,
        toolCallCount: 0,
        stopReason: "no_tool_calls",
        messageCount: messages.length,
      });
      break;
    }

    debugLog(
      `[ReAct] 迭代 ${iteration + 1} 收到 ${pendingToolCalls.length} 个 tool_calls: [${pendingToolCalls.map((tc) => tc.function.name).join(",")}]`,
    );

    // 将 assistant 的 tool_calls 消息加入对话历史
    messages.push({
      role: "assistant",
      content: null,
      tool_calls: pendingToolCalls,
    });

    // 执行所有 tool calls 并将结果加入对话历史
    for (const toolCall of pendingToolCalls) {
      const tool = toolMap.get(toolCall.function.name);
      if (!tool) {
        console.warn(`[ReAct] 未知 tool: ${toolCall.function.name}`);
        trace?.mark("tool_unknown", {
          iteration: iteration + 1,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
        });
        enqueueEvent(controller, encoder, {
          type: "tool-call-result",
          toolCallId: toolCall.id,
          result: { error: `Unknown tool: ${toolCall.function.name}` },
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
        });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }
      const toolSignature = getToolSignature(toolCall.function.name, args);

      debugLog(`[ReAct] 执行 tool: ${toolCall.function.name} args=${JSON.stringify(args)}`);
      const toolStartedAt = nowMs();
      trace?.mark("tool_start", {
        iteration: iteration + 1,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        argsSummary: summarizeForTrace(args),
      });

      const cachedResult = toolResultCache.get(toolSignature);
      if (cachedResult) {
        trace?.event("tool_end", nowMs() - toolStartedAt, {
          iteration: iteration + 1,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          resultLength: cachedResult.length,
          cached: true,
          cacheScope: "run",
        });
        debugLog(`[ReAct] tool ${toolCall.function.name} 命中本轮缓存`);
        enqueueEvent(controller, encoder, {
          type: "tool-call-result",
          toolCallId: toolCall.id,
          result: JSON.parse(cachedResult),
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: cachedResult,
        });
        continue;
      }

      const sharedCachedResult = getCachedToolResult(toolCall.function.name, args, toolContext);
      if (sharedCachedResult.hit && sharedCachedResult.value) {
        toolResultCache.set(toolSignature, sharedCachedResult.value);
        trace?.event("tool_end", nowMs() - toolStartedAt, {
          iteration: iteration + 1,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          resultLength: sharedCachedResult.value.length,
          cached: true,
          cacheScope: "shared",
        });
        debugLog(`[ReAct] tool ${toolCall.function.name} 命中跨请求缓存`);
        enqueueEvent(controller, encoder, {
          type: "tool-call-result",
          toolCallId: toolCall.id,
          result: JSON.parse(sharedCachedResult.value),
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: sharedCachedResult.value,
        });
        continue;
      }

      // 注入流式输出能力到 tool 上下文，tool 可向前端推送 tool-result-delta 事件
      const toolContextWithStream: ToolContext = {
        ...toolContext,
        stream: { controller, encoder, toolCallId: toolCall.id },
      };

      // tool 执行失败时返回 error 作为 result，LLM 可据此决定是否重试
      let result: unknown;
      try {
        result = await tool.execute(args, toolContextWithStream);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        trace?.event("tool_error", nowMs() - toolStartedAt, {
          iteration: iteration + 1,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          error: errorMessage,
        });
        result = { error: errorMessage };
      }

      const resultStr = JSON.stringify(result);
      toolResultCache.set(toolSignature, resultStr);
      const parsedResult = result as Record<string, unknown>;
      const hasError = Boolean(parsedResult && typeof parsedResult === "object" && "error" in parsedResult);
      if (!hasError) {
        setCachedToolResult(toolCall.function.name, args, toolContext, resultStr);
        trace?.event("tool_end", nowMs() - toolStartedAt, {
          iteration: iteration + 1,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          resultLength: resultStr.length,
          recoverable: typeof parsedResult?.recoverable === "boolean" ? parsedResult.recoverable : undefined,
          sourceCount: Array.isArray(parsedResult?.sources) ? parsedResult.sources.length : undefined,
          memoryIds: extractMemoryIdsForTrace(parsedResult),
        });
      }
      debugLog(
        `[ReAct] tool ${toolCall.function.name} 执行完成 resultLength=${resultStr.length}`,
      );

      enqueueEvent(controller, encoder, {
        type: "tool-call-result",
        toolCallId: toolCall.id,
        result,
      });

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultStr,
      });
    }

    trace?.event("react_iteration_end", nowMs() - iterationStartedAt, {
      iteration: iteration + 1,
      toolCallCount: pendingToolCalls.length,
      stopReason: iteration === MAX_ITERATIONS - 1 ? "max_iterations" : "continue",
      messageCount: messages.length,
    });
    if (iteration === MAX_ITERATIONS - 1) {
      reachedMaxIterationsWithTools = true;
    }

    // 继续下一轮迭代，让 LLM 基于工具结果决定是否继续调用
  }

  if (reachedMaxIterationsWithTools) {
    console.warn("[ReAct] 达到最大工具迭代次数，强制进入最终回答阶段");
    messages.push({
      role: "system",
      content:
        "Tool iteration limit reached. Do not call any more tools. Use the available tool results above to answer the user's latest request directly.",
    });
    const finalParams: Record<string, unknown> = {
      model,
      messages,
      max_tokens: 4096,
      stream: true,
    };
    applyThinkingParams(finalParams, enableThinking);
    await streamModelResponse({
      openai,
      params: finalParams as unknown as OpenAI.ChatCompletionCreateParamsStreaming,
      controller,
      encoder,
      responseId,
      enableThinking,
      trace,
      iteration: MAX_ITERATIONS + 1,
    });
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function extractMemoryIdsForTrace(result: Record<string, unknown>): string[] | undefined {
  const metadata = result.metadata;
  if (metadata && typeof metadata === "object") {
    const memoryIds = (metadata as Record<string, unknown>).memoryIds;
    if (Array.isArray(memoryIds)) {
      return memoryIds.flatMap((id) => typeof id === "string" ? [id] : []);
    }
  }

  const memories = result.memories;
  if (!Array.isArray(memories)) return undefined;
  return memories.flatMap((memory) => {
    if (!memory || typeof memory !== "object") return [];
    const id = (memory as Record<string, unknown>).id;
    return typeof id === "string" ? [id] : [];
  });
}

function debugLog(message: string): void {
  if (process.env.AGENT_DEBUG_LOG === "1" || process.env.AGENT_DEBUG_LOG === "true") {
    console.log(message);
  }
}
