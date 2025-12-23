import { create } from "zustand";

type CombatState = {
    attackTick: number;
    triggerAttack: () => void;
};

export const useCombatStore = create<CombatState>((set) => ({
    attackTick: 0,
    triggerAttack: () =>
        set((s) => ({ attackTick: s.attackTick + 1 })),
}));
