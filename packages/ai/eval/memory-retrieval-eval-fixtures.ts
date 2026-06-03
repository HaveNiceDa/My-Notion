import type { AgentMemoryRecord, MemoryScope } from "../server/memory";

export interface MemoryRetrievalEvalCase {
  id: string;
  query: string;
  topK: number;
  scopes?: MemoryScope[];
  memories: AgentMemoryRecord[];
  expectedMemoryIds: string[];
  forbiddenMemoryIds?: string[];
}

const now = Date.parse("2026-06-03T00:00:00.000Z");

export const MEMORY_RETRIEVAL_EVAL_CASES: MemoryRetrievalEvalCase[] = [
  {
    id: "project-scope-mobile-i18n",
    query: "以后写移动端文案要注意什么",
    topK: 3,
    scopes: [{ level: "project", key: "mobile" }],
    memories: [
      memory("memory-mobile-i18n", {
        type: "project",
        kind: "instruction",
        category: "i18n",
        scopeLevel: "project",
        scopeKey: "mobile",
        content: "移动端业务 UI 文案必须走 i18n，不能直接写中文或英文硬编码。",
        importance: 0.95,
      }),
      memory("memory-web-only-rule", {
        type: "project",
        kind: "instruction",
        category: "web",
        scopeLevel: "project",
        scopeKey: "web",
        content: "Web 端表单优先使用 shadcn/ui 组件。",
        importance: 0.7,
      }),
      memory("memory-user-language", {
        type: "preference",
        kind: "instruction",
        category: "language",
        scopeLevel: "user",
        scopeKey: "user-1",
        content: "用户偏好中文沟通。",
        importance: 0.8,
      }),
    ],
    expectedMemoryIds: ["memory-mobile-i18n"],
    forbiddenMemoryIds: ["memory-web-only-rule"],
  },
  {
    id: "procedural-cli-device-flow",
    query: "CLI 登录授权链接要怎么处理",
    topK: 3,
    scopes: [{ level: "module", key: "cli" }],
    memories: [
      memory("memory-cli-device-flow", {
        type: "project",
        kind: "procedural",
        category: "auth",
        scopeLevel: "module",
        scopeKey: "cli",
        content: "CLI 强制使用浏览器 Device Flow，授权链接只能包含 user_code，不能泄露 device_code。",
        importance: 1,
      }),
      memory("memory-web-toast", {
        type: "project",
        kind: "semantic",
        category: "auth",
        scopeLevel: "module",
        scopeKey: "web",
        content: "Web 授权成功后显示 5 秒倒计时 toast 并跳转到 /documents。",
        importance: 0.8,
      }),
    ],
    expectedMemoryIds: ["memory-cli-device-flow"],
    forbiddenMemoryIds: ["memory-web-toast"],
  },
  {
    id: "sensitive-and-stale-filter-awareness",
    query: "Agent 写入记忆时要遵守什么安全链路",
    topK: 4,
    scopes: [{ level: "user", key: "user-1" }],
    memories: [
      memory("memory-dry-run-contract", {
        type: "project",
        kind: "instruction",
        category: "safety",
        scopeLevel: "user",
        scopeKey: "user-1",
        content: "Agent 写入文档、记忆等持久化内容必须遵循 Dry-run -> Preview -> User Confirmation -> Commit。",
        importance: 1,
      }),
      memory("memory-sensitive-token", {
        type: "episodic",
        kind: "episodic",
        category: "secret",
        scopeLevel: "user",
        scopeKey: "user-1",
        content: "用户的测试 token 是 sk-test-123。",
        privacy: "sensitive",
        importance: 0.9,
      }),
      memory("memory-expired-debug", {
        type: "episodic",
        kind: "episodic",
        category: "debug",
        scopeLevel: "user",
        scopeKey: "user-1",
        content: "昨天临时调试时跳过 dry-run。",
        expiresAt: now - 1,
        importance: 0.5,
      }),
    ],
    expectedMemoryIds: ["memory-dry-run-contract"],
    forbiddenMemoryIds: ["memory-sensitive-token", "memory-expired-debug"],
  },
];

function memory(
  id: string,
  fields: Omit<AgentMemoryRecord, "id" | "confidence" | "status" | "updatedAt">,
): AgentMemoryRecord {
  return {
    id,
    confidence: 0.95,
    status: "active",
    updatedAt: now,
    ...fields,
  };
}
