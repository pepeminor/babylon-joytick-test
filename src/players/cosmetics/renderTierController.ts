import { getClientPreset } from "../../config/clientPreset";
import type { RenderTier } from "./cosmeticTypes";

export type RenderBudget = {
  nearDistance: number;
  midDistance: number;
  farDistance: number;
};

export function getRenderBudget(): RenderBudget {
  const preset = getClientPreset();
  return preset.renderBudget;
}

export function resolveRenderTier(distance: number): RenderTier {
  const budget = getRenderBudget();

  if (distance <= budget.nearDistance) return "near";
  if (distance <= budget.midDistance) return "mid";
  return "far";
}
