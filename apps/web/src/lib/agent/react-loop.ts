import OpenAI from "openai";
import type { AgentTool } from "./tools/definitions";
import type { ToolContext } from "./tools/types";
import { enqueueEvent, streamModelResponse, applyThinkingParams } from "./stream";

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
  } = params;
  const messages = [...params.messages];

  console.log(
    `[ReAct] 开始循环 model=${model} tools=[${tools.map((t) => "function" in t ? t.function.name : t.type).join(",")}] messages=${messages.length} thinking=${enableThinking}`,
  );

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    console.log(`[ReAct] 迭代 ${iteration + 1}/${MAX_ITERATIONS}`);

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
    });

    // LLM 没有调用任何 tool → 直接输出文本，循环结束
    if (pendingToolCalls.length === 0) {
      console.log(`[ReAct] 迭代 ${iteration + 1} 无 tool_calls，循环结束`);
      break;
    }

    console.log(
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

      console.log(`[ReAct] 执行 tool: ${toolCall.function.name} args=${JSON.stringify(args)}`);

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
        result = { error: error instanceof Error ? error.message : String(error) };
      }

      const resultStr = JSON.stringify(result);
      console.log(
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

    // 继续下一轮迭代，让 LLM 基于工具结果决定是否继续调用
  }
}
