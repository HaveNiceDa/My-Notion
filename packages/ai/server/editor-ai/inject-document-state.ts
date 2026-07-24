import { compressBlocks } from "../../utils";
import type { BlockWithCursor } from "../../utils";

type EditorDocumentState = {
  selection: boolean;
  selectedBlocks?: BlockWithCursor[];
  blocks: BlockWithCursor[];
  isEmptyDocument: boolean;
};

function buildDocumentStateText(documentState: EditorDocumentState): string {
  if (documentState.selection) {
    const selectedBlocks = documentState.selectedBlocks || [];
    const { compressed: docBlocks, wasCompressed } = compressBlocks(
      documentState.blocks,
    );

    return `This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):\n${JSON.stringify(selectedBlocks)}\n\nThis is the latest state of the entire document (INCLUDING the selected text), \nyou can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):${wasCompressed ? " [COMPRESSED - some blocks omitted for brevity]" : ""}\n${JSON.stringify(docBlocks)}`;
  }

  const { compressed: docBlocks, wasCompressed } = compressBlocks(
    documentState.blocks,
  );

  return `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). \nThe cursor is BETWEEN two blocks as indicated by cursor: true.\n${documentState.isEmptyDocument ? "Because the document is empty, YOU MUST first update the empty block before adding new blocks." : "Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."}${wasCompressed ? " [COMPRESSED - some blocks omitted for brevity]" : ""}\n${JSON.stringify(docBlocks)}`;
}

function prependDocumentStateToUserMessage(
  message: Record<string, unknown>,
  stateText: string,
): Record<string, unknown> {
  const statePart = {
    type: "text",
    text: `${stateText}\n\nUser request:`,
  };
  const parts = message.parts as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(parts)) {
    // 将文档状态并入当前 user message，避免模型把选区状态当作历史 assistant 回复忽略。
    return {
      ...message,
      parts: [statePart, ...parts],
    };
  }

  return {
    ...message,
    content: `${stateText}\n\nUser request:\n${String(message.content || "")}`,
  };
}

export function injectDocumentStateMessages(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.map((message) => {
    if (
      message.role === "user" &&
      (message.metadata as Record<string, unknown>)?.documentState
    ) {
      const documentState = (message.metadata as Record<string, unknown>)
        .documentState as EditorDocumentState;

      return prependDocumentStateToUserMessage(
        message,
        buildDocumentStateText(documentState),
      );
    }
    return message;
  });
}
