import { Vector3 } from "@babylonjs/core";
import { remotes } from "../players/remotePlayers";
import { AOI_CLIENT_CONFIG } from "../config";
import { getLocalGhostManager } from "../engine/createScene";

export function filterVisibleRemotes(myPos: Vector3) {
  const time = performance.now() * 0.002;
  const entries = Object.values(remotes).map((r) => ({
    id: r.id,
    dist: Vector3.Distance(myPos, r.root.position),
    remote: r,
  }));

  const ghostManager = getLocalGhostManager();

  for (const e of entries) {
    if (e.dist <= AOI_CLIENT_CONFIG.modelDistance) {
      e.remote.root.setEnabled(true);
      ghostManager?.remove(e.id);
    } else if (e.dist <= AOI_CLIENT_CONFIG.maxRenderDistance) {
      e.remote.root.setEnabled(false);
      ghostManager?.spawn(e.id, e.remote.root.position);
      ghostManager?.update(e.id, e.remote.root.position, time);
    } else {
      e.remote.root.setEnabled(false);
      ghostManager?.remove(e.id);
    }
  }
}
