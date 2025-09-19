import { createLocalPlayer } from "../players/createLocalPlayer";
import { setupScene } from "./sceneSetup";
import { updateRemotePlayers } from "../players/remotePlayers";

const MODEL_PATH = "/models/pepe-test.glb";

export function createScene(canvas: HTMLCanvasElement) {
    const { engine, scene, camera } = setupScene(canvas);

    const { player, setLocomotion } = createLocalPlayer(scene, MODEL_PATH);
    scene.onBeforeRenderObservable.add(() => updateRemotePlayers(scene));

    return { engine, scene, camera, player, setLocomotion };
}
