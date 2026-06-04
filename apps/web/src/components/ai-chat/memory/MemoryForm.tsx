"use client";

import { Save, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
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
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <Select
          value={state.type}
          onValueChange={(value) => onStateChange({ ...state, type: value as MemoryType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEMORY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`type_${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="flex items-center rounded-md border bg-muted/30 px-3 text-xs text-muted-foreground">
          {t("formHint")}
        </p>
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
