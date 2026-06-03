import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

import { WhiteboardBlock } from "./WhiteboardBlock";

export const myNotionBlockNoteSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    whiteboard: WhiteboardBlock(),
  },
});

export type MyNotionBlockNoteEditor = typeof myNotionBlockNoteSchema.BlockNoteEditor;
