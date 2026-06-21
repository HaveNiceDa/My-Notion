import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "@convex/_generated/api";

import type { HomeRecentItem } from "../types";

const RECENT_DOCUMENTS_CACHE_KEY = "@mynotion/mobile-home-recent-documents";

function isRecentItems(value: unknown): value is HomeRecentItem[] {
  if (!Array.isArray(value)) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Partial<HomeRecentItem>;
    return (
      typeof record.id === "string" &&
      typeof record.title === "string" &&
      record.iconKind === "doc" &&
      (record.icon === undefined || typeof record.icon === "string") &&
      (record.subtitle === undefined || typeof record.subtitle === "string")
    );
  });
}

/** 用「搜索列表」近似 Notion「最近」：按 lastEditedTime 倒序取前若干条 */
export function useRecentDocuments(limit = 12): {
  items: HomeRecentItem[] | undefined;
  isFromCache: boolean;
} {
  const docs = useQuery(api.documents.getSearch, {});
  const [cachedItems, setCachedItems] = useState<HomeRecentItem[] | undefined>();

  const items = useMemo((): HomeRecentItem[] | undefined => {
    if (docs === undefined) return undefined;
    return [...docs]
      .sort(
        (a, b) =>
          (b.lastEditedTime ?? b._creationTime) - (a.lastEditedTime ?? a._creationTime),
      )
      .slice(0, limit)
      .map((d) => ({
        id: d._id,
        title: d.title,
        iconKind: "doc" as const,
        icon: d.icon,
      }));
  }, [docs, limit]);

  useEffect(() => {
    let cancelled = false;

    const loadCachedItems = async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_DOCUMENTS_CACHE_KEY);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!cancelled && isRecentItems(parsed)) {
          setCachedItems(parsed.slice(0, limit));
        }
      } catch (error) {
        console.error("Failed to load cached recent documents:", error);
      }
    };

    void loadCachedItems();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  useEffect(() => {
    if (items === undefined) return;

    setCachedItems(items);
    void AsyncStorage.setItem(
      RECENT_DOCUMENTS_CACHE_KEY,
      JSON.stringify(items),
    ).catch((error) => {
      console.error("Failed to cache recent documents:", error);
    });
  }, [items]);

  return {
    items: items ?? cachedItems,
    isFromCache: items === undefined && cachedItems !== undefined,
  };
}
