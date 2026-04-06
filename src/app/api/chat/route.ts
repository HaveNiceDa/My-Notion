import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  AI_MODELS,
  type AIModel,
  DEFAULT_MODEL,
  getActualModelId,
  DASHSCOPE_BASE_URL,
} from "@/src/lib/ai/config";
import { getToolDefinitions, getToolByName } from "@/src/lib/ai/tools";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      model: modelName,
      enableThinking = false,
      enableSearch = false,
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 如果 modelName 在 AI_MODELS 中，先转换为实际模型ID
    let actualModelId: string;
    if ((AI_MODELS as readonly string[]).includes(modelName)) {
      actualModelId = getActualModelId(modelName as AIModel);
    } else {
      // 否则直接使用传入的 modelName（可能已经是实际模型ID）
      actualModelId = modelName || getActualModelId(DEFAULT_MODEL);
    }

    // 初始化OpenAI客户端（用于调用阿里云百炼API）
    const openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: DASHSCOPE_BASE_URL,
    });

    // 获取工具定义
    const tools = getToolDefinitions();
    console.log("[Chat API] Available tools:", tools.map((t) => t.function.name));

    // 构建请求参数
    const requestParams: any = {
      model: actualModelId,
      messages: messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    };

    // 如果启用深度思考或联网搜索，添加 extra_body 参数
    requestParams.extra_body = {};
    if (enableThinking) {
      requestParams.extra_body.enable_thinking = true;
    }
    if (enableSearch) {
      requestParams.extra_body.enable_search = true;
      // 添加 search_options 来强制搜索（根据文档建议）
      requestParams.extra_body.search_options = {
        forced_search: true,
      };
    }
    // 如果 extra_body 为空，删除它
    if (Object.keys(requestParams.extra_body).length === 0) {
      delete requestParams.extra_body;
    }

    // 添加调试日志
    console.log("[Chat API] Request params:", {
      model: actualModelId,
      enableThinking,
      enableSearch,
      extraBody: requestParams.extra_body,
      hasTools: tools.length > 0,
    });

    // 创建编码器
    const encoder = new TextEncoder();

    // 创建可读流
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...messages];
          let toolCallHandled = false;

          while (!toolCallHandled) {
            console.log("[Chat API] Calling model...");

            const response = await openai.chat.completions.create(requestParams);

            // 处理响应
            let hasToolCalls = false;
            let assistantMessage: any = { role: "assistant", content: "" };

            // 首先检查响应中是否有 tool_calls
            const streamIterator = response as any;
            const chunks: any[] = [];

            for await (const chunk of streamIterator) {
              chunks.push(chunk);
              const delta = chunk.choices[0]?.delta;

              if (delta?.tool_calls) {
                hasToolCalls = true;
                if (!assistantMessage.tool_calls) {
                  assistantMessage.tool_calls = [];
                }

                delta.tool_calls.forEach((toolCall: any, index: number) => {
                  if (!assistantMessage.tool_calls[index]) {
                    assistantMessage.tool_calls[index] = { ...toolCall };
                  } else {
                    if (toolCall.function?.arguments) {
                      assistantMessage.tool_calls[index].function.arguments =
                        (assistantMessage.tool_calls[index].function.arguments || "") +
                        toolCall.function.arguments;
                    }
                  }
                });

                // 发送工具调用开始事件
                const toolCallEvent = {
                  type: "tool_call_start",
                  tool_calls: delta.tool_calls,
                };
                controller.enqueue(encoder.encode(JSON.stringify(toolCallEvent) + "\n"));
              }

              // 处理 reasoning_content
              const reasoningContent = enableThinking
                ? (delta as any)?.reasoning_content
                : undefined;
              if (reasoningContent) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ reasoning_content: reasoningContent }) + "\n"),
                );
              }

              // 处理常规 content
              const text = delta?.content;
              if (text) {
                assistantMessage.content = (assistantMessage.content || "") + text;
                controller.enqueue(encoder.encode(JSON.stringify({ content: text }) + "\n"));
              }
            }

            // 如果没有工具调用，结束流程
            if (!hasToolCalls) {
              console.log("[Chat API] No tool calls, finishing...");
              toolCallHandled = true;
              break;
            }

            // 处理工具调用
            console.log("[Chat API] Handling tool calls...");
            currentMessages.push(assistantMessage);

            // 执行每个工具调用
            for (const toolCall of assistantMessage.tool_calls) {
              const toolName = toolCall.function.name;
              let toolArgs: any;

              try {
                toolArgs = JSON.parse(toolCall.function.arguments);
              } catch {
                toolArgs = {};
              }

              console.log(`[Chat API] Calling tool: ${toolName} with args:`, toolArgs);

              // 发送工具执行中事件
              const toolExecutingEvent = {
                type: "tool_executing",
                tool_name: toolName,
                tool_args: toolArgs,
              };
              controller.enqueue(encoder.encode(JSON.stringify(toolExecutingEvent) + "\n"));

              // 执行工具
              let toolResult: string;
              try {
                const tool = getToolByName(toolName);
                if (tool) {
                  const result = await tool.execute(toolArgs);
                  toolResult = typeof result === "string" ? result : JSON.stringify(result);
                } else {
                  toolResult = `Tool ${toolName} not found`;
                }
              } catch (error) {
                console.error(`[Chat API] Error executing tool ${toolName}:`, error);
                toolResult = `Error executing tool ${toolName}: ${error}`;
              }

              console.log(`[Chat API] Tool ${toolName} result:`, toolResult);

              // 发送工具结果事件
              const toolResultEvent = {
                type: "tool_result",
                tool_name: toolName,
                result: toolResult,
              };
              controller.enqueue(encoder.encode(JSON.stringify(toolResultEvent) + "\n"));

              // 添加工具响应到消息
              currentMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: toolResult,
              });
            }

            // 更新请求参数，准备下一轮
            requestParams.messages = currentMessages;
          }

          // 发送结束事件
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
          controller.close();
        } catch (error) {
          console.error("[Chat API] Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[Chat API] Error in chat API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
