type BlockNode = {
  type?: string;
  text?: string;
  props?: Record<string, unknown>;
  content?: BlockNode[];
  children?: BlockNode[];
};

function whiteboardNodeToText(node: BlockNode) {
  const title =
    typeof node.props?.title === "string" && node.props.title.trim()
      ? node.props.title.trim()
      : "Untitled whiteboard";
  const whiteboardId =
    typeof node.props?.whiteboardId === "string" && node.props.whiteboardId.trim()
      ? node.props.whiteboardId.trim()
      : "unknown";
  return `\n![My-Notion Whiteboard: ${title}](mynotion-whiteboard://${whiteboardId})\n`;
}

export function extractTextFromDocument(content: string): string {
  try {
    const parsedContent: BlockNode[] = JSON.parse(content);

    const extractText = (node: BlockNode | BlockNode[]): string => {
      let text = "";

      if (Array.isArray(node)) {
        for (const item of node) {
          text += extractText(item);
        }
        return text;
      }

      if (typeof node === "object" && node !== null) {
        if (node.type === "whiteboard") {
          text += whiteboardNodeToText(node);
        }

        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.type === "text" && child.text) {
              text += child.text;
            } else {
              text += extractText(child);
            }
          }
        }

        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            text += extractText(child);
          }
        }
      }

      return text;
    };

    return extractText(parsedContent);
  } catch (error) {
    console.error("Error extracting text from document:", error);
    return "";
  }
}
