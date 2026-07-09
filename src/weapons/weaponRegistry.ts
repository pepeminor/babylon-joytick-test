import type { WeaponId } from "../players/cosmetics/cosmeticTypes";

export type WeaponDefinition = {
  id: WeaponId;
  name: string;
};

export const WEAPON_REGISTRY: Record<WeaponId, WeaponDefinition> = {
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
  },
};
