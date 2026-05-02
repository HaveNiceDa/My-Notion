import { useMemo } from "react";
import type { Doc, Id } from "@convex/_generated/dataModel";

export type DocumentNode = {
  document: Doc<"documents">;
  children: DocumentNode[];
};

export function useDocumentTree(
  allDocuments: Doc<"documents">[] | undefined,
  variant: "private" | "starred" | "knowledge",
): {
  rootNodes: DocumentNode[];
  nodeMap: Map<string, DocumentNode>;
} {
  return useMemo(() => {
    if (!allDocuments) {
      return { rootNodes: [], nodeMap: new Map() };
    }

    const filtered = allDocuments.filter((doc) => {
      switch (variant) {
        case "starred":
          return doc.isStarred;
        case "knowledge":
          return doc.isInKnowledgeBase;
        case "private":
        default:
          return true;
      }
    });

    const nodeMap = new Map<string, DocumentNode>();
    for (const doc of filtered) {
      nodeMap.set(doc._id, { document: doc, children: [] });
    }

    const rootNodes: DocumentNode[] = [];

    if (variant === "private") {
      for (const node of nodeMap.values()) {
        const parentId = node.document.parentDocument;
        if (!parentId) {
          rootNodes.push(node);
        } else {
          const parentNode = nodeMap.get(parentId);
          if (parentNode) {
            parentNode.children.push(node);
          } else {
            rootNodes.push(node);
          }
        }
      }
    } else {
      for (const node of nodeMap.values()) {
        rootNodes.push(node);
      }
    }

    return { rootNodes, nodeMap };
  }, [allDocuments, variant]);
}

export function getChildrenForParent(
  allDocuments: Doc<"documents">[],
  parentId: Id<"documents"> | undefined,
): Doc<"documents">[] {
  return allDocuments.filter(
    (doc) => doc.parentDocument === parentId,
  );
}
