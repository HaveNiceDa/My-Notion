import { createEmptyExcalidrawScene } from "@notion/business/whiteboard";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

function sanitizeAppState(appState: unknown) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return {};
  }

  const serializableAppState = { ...(appState as Record<string, unknown>) };
  delete serializableAppState.collaborators;
  return serializableAppState;
}

export function parseInitialExcalidrawData(sceneJson?: string): ExcalidrawInitialDataState {
  if (!sceneJson) {
    const scene = createEmptyExcalidrawScene();
    return {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
    } as unknown as ExcalidrawInitialDataState;
  }

  try {
    const parsed = JSON.parse(sceneJson) as {
      elements?: unknown;
      appState?: unknown;
      files?: unknown;
    };
    return {
      elements: Array.isArray(parsed.elements) ? parsed.elements : [],
      appState: sanitizeAppState(parsed.appState),
      files: typeof parsed.files === "object" && parsed.files ? parsed.files : {},
    } as unknown as ExcalidrawInitialDataState;
  } catch {
    const scene = createEmptyExcalidrawScene();
    return {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
    } as unknown as ExcalidrawInitialDataState;
  }
}
