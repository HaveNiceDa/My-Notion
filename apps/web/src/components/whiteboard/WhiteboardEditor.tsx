"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  exportToBlob,
  getNonDeletedElements,
} from "@excalidraw/excalidraw";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import "@excalidraw/excalidraw/index.css";

import { parseInitialExcalidrawData } from "./excalidraw/scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false },
);

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type ScenePayload = {
  elements: readonly ExcalidrawElement[];
  appState: Parameters<NonNullable<ExcalidrawProps["onChange"]>>[1];
  files: BinaryFiles;
};

interface WhiteboardEditorProps {
  title: string;
  sceneJson?: string;
  onSave: (input: { sceneJson: string; thumbnailDataUrl?: string }) => Promise<void>;
  onRename?: (input: { title: string; sceneJson: string }) => Promise<void>;
  onClose?: () => void;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read thumbnail blob"));
    reader.readAsDataURL(blob);
  });
}

async function createThumbnail(payload: ScenePayload) {
  const elements = getNonDeletedElements(payload.elements);
  if (elements.length === 0) return undefined;
  const blob = await exportToBlob({
    elements,
    appState: {
      ...payload.appState,
      exportBackground: true,
      viewBackgroundColor: payload.appState.viewBackgroundColor ?? "#ffffff",
    },
    files: payload.files,
    mimeType: "image/png",
    exportPadding: 24,
    maxWidthOrHeight: 960,
  });
  return blobToDataUrl(blob);
}

function sanitizeSerializableAppState(appState: ScenePayload["appState"]) {
  const serializableAppState = { ...(appState as unknown as Record<string, unknown>) };
  delete serializableAppState.collaborators;
  return serializableAppState;
}

function stringifyScenePayload(payload: ScenePayload) {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "my-notion",
    elements: payload.elements,
    appState: sanitizeSerializableAppState(payload.appState),
    files: payload.files,
  });
}

export function WhiteboardEditor({ title, sceneJson, onSave, onRename, onClose }: WhiteboardEditorProps) {
  const t = useTranslations("Whiteboard");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [draftTitle, setDraftTitle] = useState(title);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const latestPayloadRef = useRef<ScenePayload | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialData = useMemo(() => parseInitialExcalidrawData(sceneJson), [sceneJson]);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  const flushSave = useCallback(async (withThumbnail: boolean) => {
    const payload = latestPayloadRef.current;
    if (!payload) return;
    setStatus("saving");
    try {
      const nextSceneJson = stringifyScenePayload(payload);
      const thumbnailDataUrl = withThumbnail ? await createThumbnail(payload) : undefined;
      await onSave({ sceneJson: nextSceneJson, thumbnailDataUrl });
      setStatus("saved");
    } catch (error) {
      console.error("[WhiteboardEditor] failed to save", error);
      setStatus("error");
    }
  }, [onSave]);

  const scheduleSave: NonNullable<ExcalidrawProps["onChange"]> = (elements, appState, files) => {
    latestPayloadRef.current = { elements, appState, files };
    setStatus("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void flushSave(false);
    }, 1200);
  };

  const commitTitle = async () => {
    const nextTitle = draftTitle.trim() || t("untitled");
    setDraftTitle(nextTitle);
    if (!onRename || nextTitle === title) return;
    try {
      setStatus("saving");
      const latestSceneJson = latestPayloadRef.current
        ? stringifyScenePayload(latestPayloadRef.current)
        : sceneJson;
      if (!latestSceneJson) return;
      await onRename({ title: nextTitle, sceneJson: latestSceneJson });
      setStatus("saved");
    } catch (error) {
      console.error("[WhiteboardEditor] failed to rename", error);
      setStatus("error");
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void flushSave(true);
    };
  }, [flushSave]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b bg-background/95 px-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          {onClose ? (
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={onClose}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("exit")}
            </button>
          ) : null}
          <input
            className="h-8 min-w-0 max-w-[42vw] rounded-md bg-transparent px-2 text-sm font-medium outline-none transition hover:bg-muted focus:bg-muted focus:ring-1 focus:ring-ring"
            value={draftTitle}
            aria-label={t("nameLabel")}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={() => {
              void commitTitle();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setDraftTitle(title);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {status === "dirty" && t("statusDirty")}
          {status === "saving" && t("statusSaving")}
          {status === "saved" && t("statusSaved")}
          {status === "error" && t("statusError")}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          onChange={scheduleSave}
          name={draftTitle}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            },
          }}
        />
      </div>
    </div>
  );
}
