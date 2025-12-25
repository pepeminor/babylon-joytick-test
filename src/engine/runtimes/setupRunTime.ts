import { createViewportManager } from "./createViewportManager";
import { createCameraController } from "./createCameraController";
import { createMovementController } from "./createMovementController";
import { createNetworkSync } from "./createNetworkSync";
import { createScene } from "../createScene";
import type { Scene, Vector3 } from "@babylonjs/core";

type RefHolder<T> = { current: T };

type RuntimeParams = {
    canvas: HTMLCanvasElement;
    lockDragRef: RefHolder<boolean>;
    keysRef: RefHolder<Record<string, boolean>>;
    joyVecRef: RefHolder<Vector3>;
    lastSentRef: RefHolder<{ x: number; y: number; z: number; yaw: number; state: string }>;
    serverSocketRef: RefHolder<WebSocket | null>;
    disconnectServer: (code?: number, reason?: string) => void;
    setSceneState: (scene: Scene | null | ((prev: Scene | null) => Scene | null)) => void;
};

export async function setupRuntime({
    canvas,
    lockDragRef,
    keysRef,
    joyVecRef,
    lastSentRef,
    serverSocketRef,
    disconnectServer,
    setSceneState,
}: RuntimeParams) {
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.setProperty("-webkit-touch-callout", "none");

    const { engine, scene, camera, player, setLocomotion } =
        await createScene(canvas);

    // ===== VIEWPORT / RESIZE =====
    const viewport = createViewportManager(engine, scene);

    setSceneState(scene);

    // ===== CAMERA =====
    const cameraCtrl = createCameraController({
        canvas,
        camera,
        player,
        lockDragRef,
    });

    // ===== MOVEMENT =====
    const movementCtrl = createMovementController({
        player,
        joyVecRef,
        keysRef,
        setLocomotion,
    });

    const networkSync = createNetworkSync({
        player,
        serverSocketRef,
        lastSentRef,
        movementCtrl
    });

    const loop = () => {
        const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
        cameraCtrl.update(dt);
        movementCtrl.update(dt, camera);
        networkSync.update(dt);
        scene.render();
    };

    engine.runRenderLoop(loop);

    const onLost = () => engine.stopRenderLoop();
    const onRestored = () => engine.runRenderLoop(loop);

    engine.onContextLostObservable.add(onLost);
    engine.onContextRestoredObservable.add(onRestored);

    return () => {
        viewport.dispose();
        cameraCtrl.dispose();

        engine.onContextLostObservable.removeCallback(onLost);
        engine.onContextRestoredObservable.removeCallback(onRestored);

        disconnectServer(1000, "scene disposed");
        setSceneState(null);

        engine.stopRenderLoop();
        engine.dispose();
    };
}
