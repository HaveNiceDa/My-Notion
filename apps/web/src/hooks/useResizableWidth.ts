import { useCallback, useRef, useState } from "react";

interface UseResizableWidthOptions {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  localStorageKey?: string;
  direction?: "left" | "right";
}

export function useResizableWidth({
  initialWidth = 400,
  minWidth = 320,
  maxWidth = 520,
  localStorageKey = "ai-chat-panel-width",
  direction = "left",
}: UseResizableWidthOptions = {}) {
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return initialWidth;
    const saved = localStorage.getItem(localStorageKey);
    if (saved) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return initialWidth;
  });

  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingRef.current) return;
        const diff =
          direction === "left"
            ? startXRef.current - moveEvent.clientX
            : moveEvent.clientX - startXRef.current;
        const newWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidthRef.current + diff),
        );
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        if (isResizingRef.current) {
          isResizingRef.current = false;
          localStorage.setItem(localStorageKey, String(width));
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, minWidth, maxWidth, direction, localStorageKey],
  );

  return { width, handleMouseDown };
}
