import { Vector3 } from "@babylonjs/core";
import { remotes } from "../players/remotePlayers";
import { getLocalGhostManager } from "../engine/createScene";
import { getRenderBudget, resolveRenderTier } from "../players/cosmetics/renderTierController";

export function filterVisibleRemotes(myPos: Vector3) {
  const time = performance.now() * 0.002;
  const budget = getRenderBudget();
  const entries = Object.values(remotes).map((r) => ({
    id: r.id,
    distSq: Vector3.DistanceSquared(myPos, r.root.position),
    remote: r,
  }));

  const ghostManager = getLocalGhostManager();

  for (const e of entries) {
    const tier = resolveRenderTier(Math.sqrt(e.distSq));
    e.remote.renderTier = tier;

    if (tier === "near" || tier === "mid") {
      e.remote.root.setEnabled(true);
      ghostManager?.remove(e.id);
      continue;
    }

    if (e.distSq <= budget.farDistance * budget.farDistance) {
      e.remote.root.setEnabled(false);
      ghostManager?.spawn(e.id, e.remote.root.position);
      ghostManager?.update(e.id, e.remote.root.position, time);
    } else {
      e.remote.root.setEnabled(false);
      ghostManager?.remove(e.id);
    }
  }
}
