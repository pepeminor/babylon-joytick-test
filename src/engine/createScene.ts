import { createLocalPlayer } from "../players/createLocalPlayer";
import { setupScene } from "./sceneSetup";
import { updateRemotePlayers } from "../players/remotePlayers";
import { createGhostManager, type GhostManager } from "../players/GhostManager";
import { MODEL_PEPE } from "../config";

let ghostManager: GhostManager | null = null;
export function setLocalGhostManager(manager: GhostManager | null) {
  ghostManager = manager;
}

export function getLocalGhostManager() {
  return ghostManager;
}

export async function createScene(canvas: HTMLCanvasElement) {
  const { engine, scene, camera } = setupScene(canvas);



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
    setLocalGhostManager(null);
  });

  return { engine, scene, camera, player, setLocomotion, ghostManager: manager };
}
