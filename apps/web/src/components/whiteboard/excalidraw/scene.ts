import { createEmptyExcalidrawScene, migrateExcalidrawScene } from "@notion/business/whiteboard";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

function sanitizeAppState(appState: unknown) {
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return {};
  }

  const serializableAppState = { ...(appState as Record<string, unknown>) };
  delete serializableAppState.collaborators;
  delete serializableAppState.openDialog;
  delete serializableAppState.openMenu;
  delete serializableAppState.openSidebar;
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
    const parsed = migrateExcalidrawScene(JSON.parse(sceneJson));
    return {
      elements: parsed.elements,
      appState: sanitizeAppState(parsed.appState),
      files: parsed.files,
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
