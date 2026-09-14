import { create } from "zustand";

interface SearchVisibilityState {
  isHeroSearchVisible: boolean;
  setHeroSearchVisible: (visible: boolean) => void;
}

export const useSearchVisibilityStore = create<SearchVisibilityState>(
  (set) => ({
    isHeroSearchVisible: true,
    setHeroSearchVisible: (visible) => set({ isHeroSearchVisible: visible }),
  }),
);
