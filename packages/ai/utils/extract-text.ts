type BlockNode = {
  type?: string;
  text?: string;
  content?: BlockNode[];
  children?: BlockNode[];
};

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
