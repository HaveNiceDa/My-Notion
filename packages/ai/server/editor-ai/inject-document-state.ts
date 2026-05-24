import { compressBlocks } from "../../utils";
import type { BlockWithCursor } from "../../utils";

export function injectDocumentStateMessages(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.flatMap((message) => {
    if (
      message.role === "user" &&
      (message.metadata as Record<string, unknown>)?.documentState
    ) {
      const documentState = (message.metadata as Record<string, unknown>)
        .documentState as {
        selection: boolean;
        selectedBlocks?: BlockWithCursor[];
        blocks: BlockWithCursor[];
        isEmptyDocument: boolean;
      };

      if (documentState.selection) {
        const selectedBlocks = documentState.selectedBlocks || [];
        const { compressed: docBlocks, wasCompressed } = compressBlocks(
          documentState.blocks,
        );

        const stateText = `This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):\n${JSON.stringify(selectedBlocks)}\n\nThis is the latest state of the entire document (INCLUDING the selected text), \nyou can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):${wasCompressed ? " [COMPRESSED - some blocks omitted for brevity]" : ""}\n${JSON.stringify(docBlocks)}`;

        return [{ role: "assistant", content: stateText }, message];
      }

      const { compressed: docBlocks, wasCompressed } = compressBlocks(
        documentState.blocks,
      );

      const stateText = `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). \nThe cursor is BETWEEN two blocks as indicated by cursor: true.\n${documentState.isEmptyDocument ? "Because the document is empty, YOU MUST first update the empty block before adding new blocks." : "Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."}${wasCompressed ? " [COMPRESSED - some blocks omitted for brevity]" : ""}\n${JSON.stringify(docBlocks)}`;

      return [{ role: "assistant", content: stateText }, message];
    }
    return [message];
  });
}
