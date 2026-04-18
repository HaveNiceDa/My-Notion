import { useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

import type { HomeRecentItem } from "../types";

/** 用「搜索列表」近似 Notion「最近」：按 lastEditedTime 倒序取前若干条 */
export function useRecentDocuments(limit = 12): {
  items: HomeRecentItem[] | undefined;
} {
  const docs = useQuery(api.documents.getSearch, {});

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
      }));
  }, [docs, limit]);

  return { items };
}
