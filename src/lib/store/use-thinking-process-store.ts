import { create } from "zustand";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ThinkingStep {
  id: string;
  timestamp: Date;
  type: string;
  content: string;
  details?: string;
}

interface ThinkingProcessState {
  steps: ThinkingStep[];
  isExpanded: boolean;
  isVisible: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  addStep: (type: string, content: string, details?: string) => void;
  clearSteps: () => void;
  toggleExpanded: () => void;
  setVisible: (visible: boolean) => void;
  loadSteps: (conversationId: Id<"aiConversations">) => Promise<void>;
  addStepToDatabase: (
    conversationId: Id<"aiConversations">,
    type: string,
    content: string,
    details?: string,
  ) => Promise<void>;
}

export const useThinkingProcessStore = create<ThinkingProcessState>((set) => ({
  steps: [],
  isExpanded: true,
  isVisible: false,
  isLoading: false,
  isLoaded: false,
  addStep: (type: string, content: string, details?: string) => {
    const newStep: ThinkingStep = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      content,
      details,
    };
    set((state) => ({
      steps: [...state.steps, newStep],
      isVisible: true,
    }));
  },
  clearSteps: () => {
    set({ steps: [], isExpanded: true, isVisible: false, isLoaded: false });
  },
  toggleExpanded: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },
  setVisible: (visible: boolean) => {
    set({ isVisible: visible });
  },
  loadSteps: async (conversationId: Id<"aiConversations">) => {
    set({ isLoading: true });
    try {
      const steps = await convex.query(api.aiChat.getThinkingSteps, {
        conversationId,
      });
      const formattedSteps: ThinkingStep[] = steps.map((step: any) => ({
        id: step._id,
        timestamp: new Date(step.createdAt),
        type: step.type,
        content: step.content,
        details: step.details,
      }));
      set({
        steps: formattedSteps,
        isVisible: true,
        isLoading: false,
        isLoaded: true,
      });
      console.log(
        `[Thinking Process] 加载完成，找到 ${formattedSteps.length} 个思考过程步骤`,
      );
    } catch (error) {
      console.error("Error loading thinking steps:", error);
      set({ isLoading: false, isLoaded: true });
    }
  },
  addStepToDatabase: async (
    conversationId: Id<"aiConversations">,
    type: string,
    content: string,
    details?: string,
  ) => {
    try {
      await convex.mutation(api.aiChat.addThinkingStep, {
        conversationId,
        type,
        content,
        details,
      });
      // 同时添加到本地状态
      const newStep: ThinkingStep = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type,
        content,
        details,
      };
      set((state) => ({
        steps: [...state.steps, newStep],
        isVisible: true,
      }));
    } catch (error) {
      console.error("Error adding thinking step to database:", error);
    }
  },
}));
