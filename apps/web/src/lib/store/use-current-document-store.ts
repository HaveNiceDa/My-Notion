import { create } from "zustand";

export interface CurrentDocumentContext {
  id: string;
  title: string;
  content?: string | null;
}

interface CurrentDocumentStoreState {
  currentDocument: CurrentDocumentContext | null;
  setCurrentDocument: (document: CurrentDocumentContext | null) => void;
  clearCurrentDocument: (documentId?: string) => void;
}

export const useCurrentDocumentStore = create<CurrentDocumentStoreState>((set, get) => ({
  currentDocument: null,
  setCurrentDocument: (document) => set({ currentDocument: document }),
  clearCurrentDocument: (documentId) => {
    const currentDocument = get().currentDocument;
    if (!documentId || currentDocument?.id === documentId) {
      set({ currentDocument: null });
    }
  },
}));
