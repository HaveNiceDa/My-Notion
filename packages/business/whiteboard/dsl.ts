import type {
  ExcalidrawElementLike,
  ExcalidrawElementType,
  ExcalidrawSceneData,
  WhiteboardDslDocument,
  WhiteboardDslEdge,
  WhiteboardDslLayout,
  WhiteboardDslNode,
} from "./types";

export const MY_NOTION_WHITEBOARD_SCENE_VERSION = 1;
const DEFAULT_NODE_WIDTH = 220;
const DEFAULT_NODE_HEIGHT = 96;
const GRID_COLUMNS = 3;
const GRID_X_GAP = 300;
const GRID_Y_GAP = 180;

function hashText(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function nextId(prefix: string, value: string) {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}-${hashText(value).toString(36)}`;
}

function nowForElement(seed: string) {
  return 1_700_000_000_000 + (hashText(seed) % 100_000_000);
}

function normalizeSpacing(layout?: WhiteboardDslLayout) {
  return {
    x: layout?.spacing?.x ?? GRID_X_GAP,
    y: layout?.spacing?.y ?? GRID_Y_GAP,
  };
}

function positionNode(node: WhiteboardDslNode, index: number, layout?: WhiteboardDslLayout) {
  const spacing = normalizeSpacing(layout);
  const bounds = layout?.bounds;
  const originX = bounds?.x ?? 0;
  const originY = bounds?.y ?? 0;
  const kind = layout?.kind ?? "grid";
  const rankDirection = layout?.rankDirection ?? "LR";

  if (node.x !== undefined || node.y !== undefined || kind === "freeform") {
    return {
      x: node.x ?? originX,
      y: node.y ?? originY,
    };
  }

  if (kind === "flow") {
    return rankDirection === "TB"
      ? { x: originX, y: originY + index * spacing.y }
      : { x: originX + index * spacing.x, y: originY };
  }

  const columns = bounds?.width
    ? Math.max(1, Math.floor(bounds.width / spacing.x))
    : GRID_COLUMNS;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: originX + column * spacing.x,
    y: originY + row * spacing.y,
  };
}

function nodeShapeType(node: WhiteboardDslNode): ExcalidrawElementType {
  if (node.type === "diamond") return "diamond";
  if (node.type === "actor") return "ellipse";
  if (node.type === "frame") return "frame";
  if (node.type === "text") return "text";
  return "rectangle";
}

function createBaseElement(
  id: string,
  type: ExcalidrawElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  seedSource: string,
): ExcalidrawElementLike {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === "rectangle" ? { type: 3 } : null,
    seed: hashText(seedSource) % 2_147_483_647,
    version: 1,
    versionNonce: hashText(`${seedSource}:nonce`) % 2_147_483_647,
    isDeleted: false,
    boundElements: null,
    updated: nowForElement(seedSource),
    link: null,
    locked: false,
  };
}

function createTextElement(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  seedSource: string,
): ExcalidrawElementLike {
  return {
    ...createBaseElement(id, "text", x, y, width, 32, seedSource),
    text,
    originalText: text,
    fontSize: 20,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: 24,
    containerId: null,
    backgroundColor: "transparent",
    strokeWidth: 1,
  };
}

function createNodeElements(node: WhiteboardDslNode, index: number, layout?: WhiteboardDslLayout) {
  const { x, y } = positionNode(node, index, layout);
  const width = node.width ?? DEFAULT_NODE_WIDTH;
  const height = node.height ?? (node.type === "text" ? 40 : DEFAULT_NODE_HEIGHT);
  const shapeType = nodeShapeType(node);
  const shapeId = nextId("node", node.id);
  const elements: ExcalidrawElementLike[] = [];

  if (shapeType !== "text") {
    const shape = createBaseElement(shapeId, shapeType, x, y, width, height, node.id);
    shape.backgroundColor = node.backgroundColor ?? (node.type === "note" ? "#fff3bf" : "#ffffff");
    shape.strokeColor = node.strokeColor ?? "#1e1e1e";
    if (node.type === "database") {
      shape.roundness = { type: 2 };
      shape.backgroundColor = node.backgroundColor ?? "#e7f5ff";
    }
    if (node.type === "frame") {
      shape.name = node.text;
      shape.backgroundColor = "transparent";
    }
    elements.push(shape);
  }

  if (node.type !== "frame") {
    const textId = nextId("text", node.id);
    const text = createTextElement(
      textId,
      node.text,
      x + 12,
      y + Math.max((height - 32) / 2, 4),
      Math.max(width - 24, 80),
      `${node.id}:text`,
    );
    if (shapeType !== "text") {
      text.containerId = shapeId;
    }
    elements.push(text);
  }

  return { nodeId: node.id, shapeId, x, y, width, height, elements };
}

function createEdgeElement(edge: WhiteboardDslEdge, index: number, nodes: Map<string, ReturnType<typeof createNodeElements>>) {
  const from = nodes.get(edge.from);
  const to = nodes.get(edge.to);
  if (!from || !to) return [];

  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  const id = nextId("edge", edge.id ?? `${edge.from}-${edge.to}-${index}`);
  const line = createBaseElement(
    id,
    edge.type === "line" ? "line" : "arrow",
    startX,
    startY,
    endX - startX,
    endY - startY,
    id,
  );
  line.points = [[0, 0], [endX - startX, endY - startY]];
  line.startBinding = { elementId: from.shapeId, focus: 0, gap: 8 };
  line.endBinding = { elementId: to.shapeId, focus: 0, gap: 8 };
  line.startArrowhead = null;
  line.endArrowhead = edge.type === "line" ? null : "arrow";

  const elements: ExcalidrawElementLike[] = [line];
  if (edge.label) {
    elements.push(createTextElement(
      nextId("edge-label", id),
      edge.label,
      startX + (endX - startX) / 2 - 60,
      startY + (endY - startY) / 2 - 24,
      120,
      `${id}:label`,
    ));
  }
  return elements;
}

export function createEmptyExcalidrawScene(): ExcalidrawSceneData {
  return {
    type: "excalidraw",
    version: 2,
    source: "my-notion",
    myNotionSceneVersion: MY_NOTION_WHITEBOARD_SCENE_VERSION,
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
      currentItemStrokeColor: "#1e1e1e",
      currentItemBackgroundColor: "transparent",
      gridSize: null,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    },
    files: {},
  };
}

export function whiteboardDslToExcalidrawScene(dsl: WhiteboardDslDocument): ExcalidrawSceneData {
  const scene = createEmptyExcalidrawScene();
  const nodeElements = dsl.nodes.map((node, index) => createNodeElements(node, index, dsl.layout));
  const nodeMap = new Map(nodeElements.map((node) => [node.nodeId, node]));
  scene.elements.push(...nodeElements.flatMap((node) => node.elements));
  scene.elements.push(...(dsl.edges ?? []).flatMap((edge, index) => createEdgeElement(edge, index, nodeMap)));
  return scene;
}

export function stringifyWhiteboardScene(scene: ExcalidrawSceneData) {
  return JSON.stringify(migrateExcalidrawScene(scene), null, 2);
}

function sanitizeSceneAppState(appState: unknown) {
  const defaultAppState = createEmptyExcalidrawScene().appState;
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return defaultAppState;
  }
  const serializableAppState = { ...(appState as Record<string, unknown>) };
  delete serializableAppState.collaborators;
  delete serializableAppState.openDialog;
  delete serializableAppState.openMenu;
  delete serializableAppState.openSidebar;
  return {
    ...defaultAppState,
    ...serializableAppState,
  } as ExcalidrawSceneData["appState"];
}

export function migrateExcalidrawScene(input: unknown): ExcalidrawSceneData {
  const emptyScene = createEmptyExcalidrawScene();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return emptyScene;
  }

  const candidate = input as Partial<ExcalidrawSceneData>;
  return {
    type: "excalidraw",
    version: typeof candidate.version === "number" ? candidate.version : emptyScene.version,
    source: "my-notion",
    myNotionSceneVersion: MY_NOTION_WHITEBOARD_SCENE_VERSION,
    elements: Array.isArray(candidate.elements) ? candidate.elements : [],
    appState: sanitizeSceneAppState(candidate.appState),
    files:
      candidate.files && typeof candidate.files === "object" && !Array.isArray(candidate.files)
        ? candidate.files
        : {},
  };
}

export function parseWhiteboardDsl(input: unknown): WhiteboardDslDocument {
  if (!input || typeof input !== "object") {
    throw new Error("Whiteboard DSL must be an object.");
  }
  const candidate = input as Partial<WhiteboardDslDocument>;
  if (candidate.version !== "mwb-dsl-v1") {
    throw new Error("Unsupported whiteboard DSL version.");
  }
  if (!Array.isArray(candidate.nodes) || candidate.nodes.length === 0) {
    throw new Error("Whiteboard DSL requires at least one node.");
  }
  return {
    version: "mwb-dsl-v1",
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    layout:
      candidate.layout && typeof candidate.layout === "object" && !Array.isArray(candidate.layout)
        ? candidate.layout
        : undefined,
    nodes: candidate.nodes,
    edges: Array.isArray(candidate.edges) ? candidate.edges : [],
    groups: Array.isArray(candidate.groups) ? candidate.groups : [],
  };
}
