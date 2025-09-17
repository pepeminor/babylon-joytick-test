import { createLocalPlayer } from "../players/createLocalPlayer";
import { setupScene } from "./sceneSetup";
import { updateRemotes } from "../players/remotePlayers";
import { connectGameServer } from "../connectGameServer";

const MODEL_PATH = "/models/pepe-test.glb";

export function createScene(canvas: HTMLCanvasElement) {
    const { engine, scene, camera } = setupScene(canvas);

    const { player, setLocomotion, getAnimState } = createLocalPlayer(scene, MODEL_PATH);

    // connectFakeServer(scene);

    connectGameServer(scene, player, getAnimState);


    // Spawn 10 remotes
    // for (let i = 0; i < 10; i++) spawnRemote(scene, "p" + i, MODEL_PATH);
    scene.onBeforeRenderObservable.add(() => updateRemotes(scene));

    return { engine, scene, camera, player, setLocomotion };
}
