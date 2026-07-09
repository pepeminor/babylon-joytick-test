import type { RenderTier } from "./cosmeticTypes";
import { getClientPreset } from "../../config/clientPreset";

export type AnimationBudget = {
  blendSpeed: number;
  weightLerp: number;
  updateEveryMs: number;
  allowAttackPlayback: boolean;
};

export function getAnimationBudget(tier: RenderTier): AnimationBudget {
  const preset = getClientPreset();
  const lowMemory = preset.deviceMemory <= 2;

  if (tier === "near") {
    return {
      blendSpeed: 6,
      weightLerp: 6,
      updateEveryMs: 0,
      allowAttackPlayback: true,
    };
  }

  if (tier === "mid") {
    return {
      blendSpeed: lowMemory ? 2.75 : 4,
      weightLerp: lowMemory ? 3.2 : 4.5,
      updateEveryMs: 0,
      allowAttackPlayback: true,
    };
  }

  return {
    blendSpeed: lowMemory ? 0.7 : 1.05,
    weightLerp: lowMemory ? 1.1 : 1.45,
    updateEveryMs: lowMemory ? 180 : 120,
    allowAttackPlayback: true,
  };
}
