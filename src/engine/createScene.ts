import { createLocalPlayer } from "../players/createLocalPlayer";
import { setupScene } from "./sceneSetup";
import { updateRemotePlayers } from "../players/remotePlayers";
import { createGhostManager, type GhostManager } from "../players/GhostManager";
import { MODEL_PEPE } from "../config";
import { clearRemoteRigPool } from "../players/remotePlayerPool";

let ghostManager: GhostManager | null = null;
export function setLocalGhostManager(manager: GhostManager | null) {
  ghostManager = manager;
}

export function getLocalGhostManager() {
  return ghostManager;
}

export async function createScene(
  canvas: HTMLCanvasElement,
  options?: { maxDevicePixelRatio?: number }
) {
  const { engine, scene, camera } = setupScene(canvas, options);



  const { player, setLocomotion, } = await createLocalPlayer(scene, MODEL_PEPE);
  // player.getChildMeshes(false).forEach(m => (m.renderingGroupId = 0));

  // const staff = createMagicStaff(scene);
  // attachWeapon(staff);

  const manager = createGhostManager(scene);
  setLocalGhostManager(manager);

  scene.onBeforeRenderObservable.add(() =>
    updateRemotePlayers(scene, player.position)
  );

  scene.onDisposeObservable.add(() => {
    (scene as any).__cleanupResize?.();
    setLocalGhostManager(null);
    clearRemoteRigPool();
  });

  return { engine, scene, camera, player, setLocomotion, ghostManager: manager };
}
