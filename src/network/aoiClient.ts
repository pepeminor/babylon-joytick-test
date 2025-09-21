import { Vector3 } from "@babylonjs/core";
import { remotes } from "../players/remotePlayers";
import { AOI_CLIENT_CONFIG } from "../config";
import { localGhostManager } from "../engine/createScene";

export function filterVisibleRemotes(myPos: Vector3) {
  const time = performance.now() * 0.002;
  const entries = Object.values(remotes).map((r) => ({
    id: r.id,
    dist: Vector3.Distance(myPos, r.root.position),
    remote: r,
  }));

  for (const e of entries) {
    if (e.dist <= AOI_CLIENT_CONFIG.modelDistance) {
      e.remote.root.setEnabled(true);
      localGhostManager.remove(e.id);
    } else if (e.dist <= AOI_CLIENT_CONFIG.maxRenderDistance) {
      e.remote.root.setEnabled(false);
      localGhostManager.spawn(e.id, e.remote.root.position);
      localGhostManager.update(e.id, e.remote.root.position, time);
    } else {
      e.remote.root.setEnabled(false);
      localGhostManager.remove(e.id);
    }
  }
}
