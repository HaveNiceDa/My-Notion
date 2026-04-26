import { create } from "zustand";

export interface ThinkingStep {
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
  addStep: (type: string, content: string, details?: string) => void;
  clearSteps: () => void;
  toggleExpanded: () => void;
  setVisible: (visible: boolean) => void;
  setSteps: (steps: ThinkingStep[]) => void;
}

let stepCounter = 0;

export const useThinkingProcessStore = create<ThinkingProcessState>((set) => ({
  steps: [],
  isExpanded: true,
  isVisible: false,
  addStep: (type: string, content: string, details?: string) => {
    const newStep: ThinkingStep = {
      id: `step_${++stepCounter}_${Date.now()}`,
      timestamp: new Date(),
      type,
      content,
      details,
    };
    set((state) => {
      const updatedSteps = [...state.steps, newStep].slice(0, 6);
      return {
        steps: updatedSteps,
        isVisible: true,
      };
    });
  },
  clearSteps: () => {
    set({ steps: [], isExpanded: true, isVisible: false });
  },
  toggleExpanded: () => {
    set((state) => ({ isExpanded: !state.isExpanded }));
  },
  setVisible: (visible: boolean) => {
    set({ isVisible: visible });
  },
  setSteps: (steps: ThinkingStep[]) => {
    set({ steps, isVisible: steps.length > 0 });
  },
}));
