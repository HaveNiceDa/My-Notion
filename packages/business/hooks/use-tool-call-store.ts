import { create } from "zustand";

export interface ToolCall {
  id: string;
  name: string;
  parameters: any;
  status: "calling" | "executing" | "completed" | "error";
  result?: any;
  error?: string;
  timestamp: Date;
}

interface ToolCallStore {
  toolCalls: ToolCall[];
  addToolCall: (toolCall: Omit<ToolCall, "timestamp">) => void;
  updateToolCallStatus: (id: string, status: ToolCall["status"]) => void;
  setToolCallResult: (id: string, result: any) => void;
  setToolCallError: (id: string, error: string) => void;
  clearToolCalls: () => void;
}

export const useToolCallStore = create<ToolCallStore>((set) => ({
  toolCalls: [],

  addToolCall: (toolCall) => {
    set((state) => ({
      toolCalls: [
        ...state.toolCalls,
        {
          ...toolCall,
          timestamp: new Date(),
        },
      ],
    }));
  },

  updateToolCallStatus: (id, status) => {
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, status } : tc,
      ),
    }));
  },

  setToolCallResult: (id, result) => {
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, result, status: "completed" } : tc,
      ),
    }));
  },

  setToolCallError: (id, error) => {
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, error, status: "error" } : tc,
      ),
    }));
  },

  clearToolCalls: () => {
    set({ toolCalls: [] });
  },
}));
