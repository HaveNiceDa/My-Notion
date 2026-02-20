import { create } from "zustand";

interface VectorStoreStore {
  // Loading status
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  
  // User-specific loading status
  userLoadingStatus: Record<string, 'idle' | 'loading' | 'success' | 'error'>;
  
  // Actions
  setLoading: (status: boolean) => void;
  setLoaded: (status: boolean) => void;
  setError: (error: string | null) => void;
  setUserLoadingStatus: (userId: string, status: 'idle' | 'loading' | 'success' | 'error') => void;
  reset: () => void;
}

export const useVectorStoreStore = create<VectorStoreStore>()((set) => ({
  // Initial state
  isLoading: false,
  isLoaded: false,
  error: null,
  userLoadingStatus: {},
  
  // Actions
  setLoading: (status) => set({ isLoading: status }),
  setLoaded: (status) => set({ isLoaded: status }),
  setError: (error) => set({ error }),
  setUserLoadingStatus: (userId, status) => set((state) => ({
    userLoadingStatus: {
      ...state.userLoadingStatus,
      [userId]: status
    }
  })),
  reset: () => set({
    isLoading: false,
    isLoaded: false,
    error: null,
    userLoadingStatus: {}
  })
}));
