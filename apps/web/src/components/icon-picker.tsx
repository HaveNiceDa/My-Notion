"use client";

import dynamic from "next/dynamic";
import { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">
      Loading...
    </div>
  ),
});

interface IconPickerProps {
  onChange: (icon: string) => void;
  children: React.ReactNode;
  asChild?: boolean;
}

export function IconPicker({ onChange, children, asChild }: IconPickerProps) {
  const { resolvedTheme } = useTheme();

  const themeMap: Record<string, Theme> = {
    dark: Theme.DARK,
    light: Theme.LIGHT,
  };

  const theme = themeMap[resolvedTheme || "light"];

  return (
    <Popover>
      <PopoverTrigger asChild={asChild}>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-full border-none shadow-none">
        <EmojiPicker
          height={350}
          theme={theme}
          onEmojiClick={(data: { emoji: string }) => onChange(data.emoji)}
        />
      </PopoverContent>
    </Popover>
  );
}
