export { useThinkingProcessStore, type ThinkingStep } from "@notion/business/hooks";

import type { FunctionArgs, FunctionReference } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useThinkingProcessStore } from "@notion/business/hooks";

type ConvexClient = {
  query<Ref extends FunctionReference<"query">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<any>;
  mutation<Ref extends FunctionReference<"mutation">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<any>;
};

export async function loadThinkingStepsFromDB(
  convex: ConvexClient,
  conversationId: Id<"aiConversations">,
): Promise<void> {
  const store = useThinkingProcessStore.getState();
  try {
    const steps = await convex.query(api.aiChat.getThinkingSteps, {
      conversationId,
    });
    const formattedSteps = steps.map((step: any) => ({
      id: step._id,
      timestamp: new Date(step.createdAt),
      type: step.type,
      content: step.content,
      details: step.details,
    }));
    store.setSteps(formattedSteps.slice(0, 6));
  } catch (error) {
    console.error("Error loading thinking steps:", error);
  }
}

export async function addThinkingStepToDB(
  convex: ConvexClient,
  conversationId: Id<"aiConversations">,
  type: string,
  content: string,
  details?: string,
): Promise<void> {
  try {
    await convex.mutation(api.aiChat.addThinkingStep, {
      conversationId,
      type,
      content,
      details,
    });
    useThinkingProcessStore.getState().addStep(type, content, details);
  } catch (error) {
    console.error("Error adding thinking step to database:", error);
  }
}
