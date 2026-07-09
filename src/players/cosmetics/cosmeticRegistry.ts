import { MODEL_PEPE } from "../../config";
import { DEFAULT_COSMETIC, DEFAULT_COSMETIC_ID, type CosmeticDescriptor, type CosmeticId, type SkinId } from "./cosmeticTypes";

const SKIN_MODEL_PATHS: Record<SkinId, string> = {
  pepe_v2: MODEL_PEPE,
};

export function getSkinModelPath(skinId: SkinId) {
  return SKIN_MODEL_PATHS[skinId];
}

export const COSMETIC_REGISTRY: Record<CosmeticId, CosmeticDescriptor> = {
  [DEFAULT_COSMETIC_ID]: DEFAULT_COSMETIC,
  pepe_v2: DEFAULT_COSMETIC,
};

export function resolveCosmetic(cosmeticId?: string | null): {
  cosmeticId: CosmeticId;
  cosmetic: CosmeticDescriptor;
} {
  if (cosmeticId && COSMETIC_REGISTRY[cosmeticId]) {
    return {
      cosmeticId,
      cosmetic: COSMETIC_REGISTRY[cosmeticId],
    };
  }

  return {
    cosmeticId: DEFAULT_COSMETIC_ID,
    cosmetic: DEFAULT_COSMETIC,
  };
}
