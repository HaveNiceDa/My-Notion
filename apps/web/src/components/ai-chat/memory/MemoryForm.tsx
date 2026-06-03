"use client";

import { Save, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import type { MemoryEditState, MemoryType } from "./types";
import { MEMORY_TYPES } from "./utils";

interface MemoryFormProps {
  state: MemoryEditState;
  onStateChange: (state: MemoryEditState) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}

export function MemoryForm({
  state,
  onStateChange,
  onCancel,
  onSave,
  saveLabel,
}: MemoryFormProps) {
  const t = useTranslations("MemoryReview");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[220px_160px]">
        <select
          value={state.type}
          onChange={(event) =>
            onStateChange({ ...state, type: event.target.value as MemoryType })
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {MEMORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type_${type}`)}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={state.confidence}
          onChange={(event) =>
            onStateChange({ ...state, confidence: event.target.value })
          }
          aria-label={t("confidence")}
        />
      </div>
      <Textarea
        value={state.content}
        onChange={(event) => onStateChange({ ...state, content: event.target.value })}
        placeholder={t("contentPlaceholder")}
        className="min-h-24"
      />
      <Input
        value={state.reason}
        onChange={(event) => onStateChange({ ...state, reason: event.target.value })}
        placeholder={t("reasonPlaceholder")}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t("cancel")}
        </Button>
        <Button type="button" size="sm" onClick={onSave}>
          <Save className="h-4 w-4" />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
