import type { AgentMemoryRecord } from "../server/memory";

export interface MemoryRetrievalEvalCase {
  id: string;
  query: string;
  memories: AgentMemoryRecord[];
  topK: number;
  expectedMemoryIds: string[];
  forbiddenMemoryIds?: string[];
}

export const MEMORY_RETRIEVAL_EVAL_CASES: MemoryRetrievalEvalCase[] = [
  {
    id: "preference-language",
    query: "用户沟通偏好是什么",
    topK: 3,
    expectedMemoryIds: ["m-language"],
    memories: [
      {
        id: "m-language",
        type: "preference",
        content: "用户偏好中文沟通，回答要直接给结论。",
        confidence: 1,
      },
      {
        id: "m-whiteboard",
        type: "project",
        content: "画板缩略图必须保持整宽展示。",
        confidence: 1,
      },
    ],
  },
  {
    id: "project-whiteboard",
    query: "画板缩略图展示规则",
    topK: 3,
    expectedMemoryIds: ["m-whiteboard"],
    memories: [
      {
        id: "m-language",
        type: "preference",
        content: "用户偏好中文沟通，回答要直接给结论。",
        confidence: 1,
      },
      {
        id: "m-whiteboard",
        type: "project",
        content: "画板缩略图必须保持整宽展示。",
        confidence: 1,
      },
    ],
  },
];
