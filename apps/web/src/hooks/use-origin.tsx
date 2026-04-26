import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useOrigin() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "";

  if (!mounted) return "";

  return origin;
}
