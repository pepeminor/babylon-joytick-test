import { createLocalPlayer } from "../players/createLocalPlayer";
import { setupScene } from "./sceneSetup";
import { updateRemotePlayers } from "../players/remotePlayers";
import { GhostManager } from "../players/GhostManager";

const MODEL_PATH = "/models/pepe-test.glb";

export let localGhostManager: GhostManager;
export function createScene(canvas: HTMLCanvasElement) {
  const { engine, scene, camera } = setupScene(canvas);

  const { player, setLocomotion } = createLocalPlayer(scene, MODEL_PATH);
  player.getChildMeshes(false).forEach(m => (m.renderingGroupId = 0));

  localGhostManager = new GhostManager(scene);
  scene.onBeforeRenderObservable.add(() =>
    updateRemotePlayers(scene, player.position)
  );

  return { engine, scene, camera, player, setLocomotion };
}
