export type WhiteboardEngine = "excalidraw";

export type WhiteboardDslVersion = "mwb-dsl-v1";

export type WhiteboardDslNodeType =
  | "box"
  | "text"
  | "actor"
  | "database"
  | "note"
  | "diamond"
  | "frame";

export type WhiteboardDslEdgeType = "arrow" | "line";
export type WhiteboardDslLayoutKind = "grid" | "flow" | "freeform";
export type WhiteboardDslRankDirection = "LR" | "TB";

export interface WhiteboardDslSpacing {
  x?: number;
  y?: number;
}

export interface WhiteboardDslBounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface WhiteboardDslLayout {
  kind?: WhiteboardDslLayoutKind;
  rankDirection?: WhiteboardDslRankDirection;
  spacing?: WhiteboardDslSpacing;
  bounds?: WhiteboardDslBounds;
}

export interface WhiteboardDslNode {
  id: string;
  type: WhiteboardDslNodeType;
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  strokeColor?: string;
}

export interface WhiteboardDslEdge {
  id?: string;
  from: string;
  to: string;
  type?: WhiteboardDslEdgeType;
  label?: string;
}

export interface WhiteboardDslGroup {
  id: string;
  title?: string;
  nodeIds: string[];
}

export interface WhiteboardDslDocument {
  version: WhiteboardDslVersion;
  title?: string;
  layout?: WhiteboardDslLayout;
  nodes: WhiteboardDslNode[];
  edges?: WhiteboardDslEdge[];
  groups?: WhiteboardDslGroup[];
}

export interface WhiteboardScene {
  engine: WhiteboardEngine;
  version: number;
  data: unknown;
}

export interface ExcalidrawSceneData {
  type: "excalidraw";
  version: number;
  source: "my-notion";
  myNotionSceneVersion?: number;
  elements: ExcalidrawElementLike[];
  appState: ExcalidrawAppStateLike;
  files: Record<string, unknown>;
}

export type ExcalidrawElementType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "text"
  | "frame";

export interface ExcalidrawElementLike {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: Array<{ type: string; id: string }> | null;
  updated: number;
  link: string | null;
  locked: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle";
  baseline?: number;
  containerId?: string | null;
  originalText?: string;
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  points?: Array<[number, number]>;
  label?: { text: string };
  name?: string;
}

export interface ExcalidrawAppStateLike {
  viewBackgroundColor: string;
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  gridSize: number | null;
  scrollX?: number;
  scrollY?: number;
  zoom?: { value: number };
}

export interface WhiteboardResult {
  id: string;
  title: string;
  documentId?: string;
  engine: WhiteboardEngine;
  sceneJson: string;
  thumbnailDataUrl?: string;
  sourceDsl?: string;
  sourceDslVersion?: WhiteboardDslVersion;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}
