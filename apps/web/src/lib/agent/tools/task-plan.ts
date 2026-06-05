import type { ToolContext } from "./types";
import { buildToolMetadata } from "./result-contract";

type TaskPlanStatus = "pending" | "in_progress" | "completed" | "blocked";

interface TaskPlanStep {
  id: string;
  title: string;
  description?: string;
  status: TaskPlanStatus;
}

const TASK_PLAN_STATUSES = new Set<TaskPlanStatus>([
  "pending",
  "in_progress",
  "completed",
  "blocked",
]);

export async function executeTaskPlan(
  args: Record<string, unknown>,
  _context: ToolContext,
): Promise<unknown> {
  const objective = typeof args.objective === "string" ? args.objective.trim() : "";
  const steps = normalizeSteps(args.steps);
  if (!objective) {
    return buildTaskPlanError("objective is required");
  }
  if (steps.length === 0) {
    return buildTaskPlanError("steps must contain at least one item");
  }

  const currentStep = steps.find((step) => step.status === "in_progress") ?? steps[0];
  return {
    objective,
    steps,
    summary: `Planned ${steps.length} steps for: ${objective}`,
    recoverable: true,
    sources: [],
    metadata: {
      ...buildToolMetadata("task_plan"),
      stepCount: steps.length,
      currentStepId: currentStep.id,
      completedCount: steps.filter((step) => step.status === "completed").length,
      blockedCount: steps.filter((step) => step.status === "blocked").length,
    },
  };
}

function normalizeSteps(value: unknown): TaskPlanStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rawStep, index): TaskPlanStep | null => {
      if (!rawStep || typeof rawStep !== "object") return null;
      const step = rawStep as Record<string, unknown>;
      const title = typeof step.title === "string" ? step.title.trim() : "";
      if (!title) return null;

      const normalized: TaskPlanStep = {
        id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : `step-${index + 1}`,
        title,
        status: parseStatus(step.status),
      };
      if (typeof step.description === "string" && step.description.trim()) {
        normalized.description = step.description.trim();
      }
      return normalized;
    })
    .filter((step): step is TaskPlanStep => Boolean(step));
}

function parseStatus(value: unknown): TaskPlanStatus {
  return typeof value === "string" && TASK_PLAN_STATUSES.has(value as TaskPlanStatus)
    ? value as TaskPlanStatus
    : "pending";
}

function buildTaskPlanError(error: string) {
  return {
    objective: "",
    steps: [],
    error,
    summary: `task_plan failed: ${error}`,
    recoverable: true,
    sources: [],
    metadata: buildToolMetadata("task_plan", { reason: "validation_error" }),
  };
}
