export type SkinId = "pepe_v2";
export type WeaponId = "magic_staff";
export type CosmeticId = string;

export type CosmeticDescriptor = {
  skinId: SkinId;
  weaponId: WeaponId;
};

export type RenderTier = "near" | "mid" | "far";

export const DEFAULT_COSMETIC: CosmeticDescriptor = {
  skinId: "pepe_v2",
  weaponId: "magic_staff",
};

export const DEFAULT_COSMETIC_ID: CosmeticId = "default";
