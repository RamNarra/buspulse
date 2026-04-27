import { create } from "zustand";
import { persist } from "zustand/middleware";

type AppState = {
  isMenuOpen: boolean;
  mapType: "hybrid" | "roadmap" | "satellite" | "terrain";
  recenterTick: number;
  toggleMenu: () => void;
  setMenuOpen: (isOpen: boolean) => void;
  setMapType: (type: "hybrid" | "roadmap" | "satellite" | "terrain") => void;
  triggerRecenter: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isMenuOpen: false,
      mapType: "hybrid",
      recenterTick: 0,
      toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
      setMenuOpen: (isOpen: boolean) => set({ isMenuOpen: isOpen }),
      setMapType: (type) => set({ mapType: type }),
      triggerRecenter: () => set((state) => ({ recenterTick: state.recenterTick + 1 })),
    }),
    {
      name: "buspulse-app-storage",
      partialize: (state) => ({ mapType: state.mapType }), // Persist only mapType
    }
  )
);
