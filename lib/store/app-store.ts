import { create } from "zustand";
import { persist } from "zustand/middleware";

type AppState = {
  isMenuOpen: boolean;
  mapType: "hybrid" | "roadmap" | "satellite" | "terrain";
  toggleMenu: () => void;
  setMenuOpen: (isOpen: boolean) => void;
  setMapType: (type: "hybrid" | "roadmap" | "satellite" | "terrain") => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isMenuOpen: false,
      mapType: "hybrid",
      toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
      setMenuOpen: (isOpen: boolean) => set({ isMenuOpen: isOpen }),
      setMapType: (type) => set({ mapType: type }),
    }),
    {
      name: "buspulse-app-storage",
      partialize: (state) => ({ mapType: state.mapType }), // Persist only mapType
    }
  )
);
