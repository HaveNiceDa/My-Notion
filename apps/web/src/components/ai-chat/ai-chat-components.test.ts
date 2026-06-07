import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { ToolCallCard } from "./ToolCallCard";
import { EmptyHome } from "./EmptyHome";
import { MemoryInbox } from "./memory/MemoryInbox";
import type { ChatMessage, ToolCallResult } from "./types";
import type { AgentMemoryItem } from "./memory/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      useAIToHandleTasks: "使用 AI 处理各种任务",
      planMode: "计划",
      planModeOn: "计划中",
      knowledgeSearchTool: "知识库检索",
      documentWriteTool: "文档写入",
      documentWritePreview: "文档写入预览",
      documentConfirmationRequired: "需要确认后写入",
      toolActionAvailableAfterResponse: "回复结束后可操作",
      summarizeCurrentDocument: "总结当前文档",
      summarizeCurrentDocumentPrompt: "请读取当前文档",
      searchMyDocuments: "搜索我的文档",
      searchMyDocumentsPrompt: "请搜索我的文档",
      draftNewDocument: "起草新文档",
      draftNewDocumentPrompt: "请起草新文档",
      rememberPreference: "记录长期记忆",
      rememberPreferencePrompt: "请整理成长期记忆",
      taskPlanTool: "任务计划",
      taskPlanPending: "待处理",
      taskPlanInProgress: "进行中",
      taskPlanCompleted: "已完成",
      executePlan: "确认执行",
      planConfirmationRequired: "确认后会按计划继续执行",
      planExecutionStarting: "启动中...",
      planExecutionStarted: "已开始执行",
      planExecutionVisible: "执行过程会在新的回复中展示",
      planExecutionPromptIntro: "请按以下已确认的计划开始执行。",
      planExecutionPromptObjective: "目标",
      planExecutionPromptSteps: "步骤",
      inboxTitle: "待确认",
      inboxDescription: "AI 认为这些内容可能值得记住，确认后才会生效。",
      pendingCount: `${values?.count ?? 0} 条待确认`,
      type_episodic: "最近决策",
      source_agent_proposed: "Agent 提议保存",
      acceptProposal: "确认",
      ignoreProposal: "忽略",
      edit: "编辑",
      retrievalStrategyLabel: "检索策略",
      retrievalStrategyBalanced: "均衡",
      retrievalRecallStats: `召回 semantic=${values?.semantic ?? 0} keyword=${values?.keyword ?? 0} metadata=${values?.metadata ?? 0} fused=${values?.fused ?? 0}`,
      retrievalPackingStats: `上下文 ${values?.packed ?? 0}/${values?.tokens ?? 0}/${values?.budget ?? 0}`,
      retrievalCitationQuality: `引用覆盖 ${values?.coverage ?? 0}% ${values?.documents ?? 0} 篇`,
      referencedDocsCount: `${values?.count ?? 0} 篇文档`,
      toolRepeated: `重复 ${values?.count ?? 0} 次`,
      generatingResponse: "正在生成响应...",
      resumeGeneration: "继续生成",
      deepThinking: "深度思考",
    };
    return translations[key] ?? key;
  },
}));

vi.mock("./MarkdownRenderer", async () => {
  const ReactModule = await import("react");
  return {
    MarkdownRenderer: ({ content }: { content: string }) =>
      ReactModule.createElement("div", { "data-markdown": "true" }, content),
  };
});

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("@/src/lib/agent/memory-sync-client", () => ({
  syncMemoryIndex: vi.fn(),
}));

vi.mock("@/src/lib/store/use-current-document-store", () => ({
  useCurrentDocumentStore: (selector: (state: { currentDocument: { id: string; title: string } }) => unknown) =>
    selector({ currentDocument: { id: "doc-1", title: "当前文档" } }),
}));

function render(element: React.ReactElement) {
  return renderToStaticMarkup(element);
}

describe("AI Chat 组件渲染", () => {
  it("MessageInput 渲染当前模型、输入内容，并在空输入时禁用发送", () => {
    const html = render(
      React.createElement(MessageInput, {
        input: "  ",
        onInputChange: vi.fn(),
        onSend: vi.fn(),
        agentMode: "chat",
        onAgentModeChange: vi.fn(),
        modelId: "deepseek-v4-pro",
        onModelChange: vi.fn(),
        enableThinking: true,
        isSending: false,
      }),
    );

    expect(html).toContain("使用 AI 处理各种任务");
    expect(html).toContain("计划");
    expect(html).toContain("DeepSeek V4 Pro");
    expect(html).toContain("disabled");
  });

  it("MessageInput 在发送中展示加载态并禁用模型切换", () => {
    const html = render(
      React.createElement(MessageInput, {
        input: "帮我总结",
        onInputChange: vi.fn(),
        onSend: vi.fn(),
        agentMode: "plan",
        onAgentModeChange: vi.fn(),
        modelId: "qwen3.6-27b",
        onModelChange: vi.fn(),
        enableThinking: true,
        isSending: true,
      }),
    );

    expect(html).toContain("Qwen 3.6 27B");
    expect(html).toContain("计划中");
    expect(html).toContain("animate-spin");
    expect(html).toContain("disabled");
  });

  it("MessageList 渲染用户 JSON 文本、助手思考过程和加载状态", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: JSON.stringify({ text: "用户问题" }),
        timestamp: new Date("2026-05-30T10:00:00Z"),
      },
      {
        id: "2",
        role: "assistant",
        content: "助手回答",
        reasoningContent: "分析过程",
        timestamp: new Date("2026-05-30T10:00:01Z"),
      },
    ];

    const html = render(
      React.createElement(MessageList, {
        messages,
        isLoading: true,
        toolCalls: [],
        messagesEndRef: { current: null },
        conversationCreatedAt: new Date("2026-05-30T10:00:00Z"),
      }),
    );

    expect(html).toContain("用户问题");
    expect(html).toContain("助手回答");
    expect(html).toContain("深度思考");
    expect(html).toContain("分析过程");
    expect(html).toContain("正在生成响应...");
  });

  it("MessageList 将重复只读工具调用折叠为重复次数", () => {
    const toolResult: ToolCallResult = {
      id: "tool-1",
      name: "knowledge_search",
      status: "completed",
      parameters: { arguments: "{\"query\":\"Agent\"}" },
      result: {
        query: "Agent",
        strategy: "balanced",
        documents: [
          {
            documentId: "doc1",
            title: "Agent 架构",
            score: 0.9,
            content: "Agent 架构内容",
            sources: ["semantic", "keyword"],
          },
        ],
      },
    };
    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "已检索",
        timestamp: new Date("2026-05-30T10:00:00Z"),
        toolResults: [toolResult, { ...toolResult, id: "tool-2" }],
      },
    ];

    const html = render(
      React.createElement(MessageList, {
        messages,
        isLoading: false,
        toolCalls: [],
        messagesEndRef: { current: null },
        conversationCreatedAt: null,
      }),
    );

    expect(html).toContain("知识库检索");
    expect(html).toContain("重复 2 次");
    expect(html).toContain("Agent 架构");
  });

  it("MessageList 在最后一条助手消息上展示继续生成入口", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "部分回答",
        timestamp: new Date("2026-06-06T10:00:00Z"),
      },
    ];

    const html = render(
      React.createElement(MessageList, {
        messages,
        isLoading: false,
        toolCalls: [],
        messagesEndRef: { current: null },
        conversationCreatedAt: null,
        canResumeLastRun: true,
        onResumeLastRun: vi.fn(),
      }),
    );

    expect(html).toContain("继续生成");
  });

  it("ToolCallCard 对写类工具展示确认预览而不是自动落库状态", () => {
    const html = render(
      React.createElement(ToolCallCard, {
        toolResult: {
          id: "write-1",
          name: "document_write",
          status: "completed",
          result: {
            dryRun: true,
            confirmationRequired: true,
            action: "document_write",
            document: {
              title: "新文档",
              contentMarkdown: "# 标题\n正文",
            },
          },
        },
      }),
    );

    expect(html).toContain("文档写入");
    expect(html).toContain("文档写入预览");
    expect(html).toContain("需要确认后写入");
    expect(html).toContain("新文档");
    expect(html).toContain("# 标题");
  });

  it("ToolCallCard 展示 task_plan 步骤状态", () => {
    const html = render(
      React.createElement(ToolCallCard, {
        toolResult: {
          id: "plan-1",
          name: "task_plan",
          status: "completed",
          result: {
            objective: "补齐基础能力",
            steps: [
              { title: "修 typecheck", status: "completed" },
              { title: "补 task_plan", description: "生成多步骤计划", status: "in_progress" },
              { title: "验证", status: "pending" },
            ],
          },
        },
      }),
    );

    expect(html).toContain("任务计划");
    expect(html).toContain("补齐基础能力");
    expect(html).toContain("修 typecheck");
    expect(html).toContain("已完成");
    expect(html).toContain("补 task_plan");
    expect(html).toContain("进行中");
  });

  it("ToolCallCard 在 task_plan 上展示确认执行入口", () => {
    const html = render(
      React.createElement(ToolCallCard, {
        toolResult: {
          id: "plan-2",
          name: "task_plan",
          status: "completed",
          result: {
            objective: "执行计划",
            steps: [
              { title: "第一步", status: "pending" },
            ],
          },
        },
        onExecutePlan: vi.fn(),
      }),
    );

    expect(html).toContain("确认执行");
    expect(html).toContain("确认后会按计划继续执行");
  });

  it("ToolCallCard 在生成中禁用确认型操作", () => {
    const html = render(
      React.createElement(ToolCallCard, {
        toolResult: {
          id: "write-2",
          name: "document_write",
          status: "completed",
          result: {
            dryRun: true,
            confirmationRequired: true,
            action: "document_write",
            document: { title: "空白文档", contentMarkdown: "" },
          },
        },
        isStreaming: true,
      }),
    );

    expect(html).toContain("回复结束后可操作");
    expect(html).toContain("disabled");
  });

  it("EmptyHome 只展示当前支持的快捷操作", () => {
    const html = render(
      React.createElement(EmptyHome, {
        onPromptSelect: vi.fn(),
      }),
    );

    expect(html).toContain("总结当前文档");
    expect(html).toContain("搜索我的文档");
    expect(html).toContain("起草新文档");
    expect(html).toContain("记录长期记忆");
    expect(html).not.toContain("创建任务跟踪器");
  });

  it("ToolCallCard 可从已持久化状态恢复 task_plan 已执行状态", () => {
    const html = render(
      React.createElement(ToolCallCard, {
        toolResult: {
          id: "plan-3",
          name: "task_plan",
          status: "completed",
          result: {
            objective: "执行计划",
            planExecutionStatus: "started",
            steps: [
              { title: "第一步", status: "pending" },
            ],
          },
        },
        onExecutePlan: vi.fn(),
      }),
    );

    expect(html).toContain("已开始执行");
    expect(html).toContain("执行过程会在新的回复中展示");
  });

  it("MemoryInbox 展示待确认记忆的精简确认入口", () => {
    const now = Date.now();
    const pendingMemories = [
      {
        id: "p1",
        type: "episodic",
        content: "保留画板整宽缩略图",
        source: "agent_proposed",
        confidence: 1,
        createdAt: now,
        updatedAt: now,
      },
    ] as AgentMemoryItem[];

    const html = render(
      React.createElement(MemoryInbox, {
        pendingMemories,
        onAccept: vi.fn(),
        onReject: vi.fn(),
      }),
    );

    expect(html).toContain("待确认");
    expect(html).toContain("保留画板整宽缩略图");
    expect(html).toContain("最近决策");
    expect(html).toContain("确认");
    expect(html).toContain("忽略");
  });
});
