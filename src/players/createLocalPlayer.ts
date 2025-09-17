import { Scene, TransformNode, AnimationGroup } from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export function createLocalPlayer(scene: Scene, modelPath: string) {
    const player = new TransformNode("playerRoot", scene);

    let idle: AnimationGroup | undefined;
    let run: AnimationGroup | undefined;
    let animReady = false;

    let state: "idle" | "run" = "idle";
    let wIdle = 1, wRun = 0;
    let targetIdle = 1, targetRun = 0;

    const applyWeights = () => {
        idle?.setWeightForAllAnimatables(wIdle);
        run?.setWeightForAllAnimatables(wRun);
    };

    function setLocomotion(speed: number) {
        if (!animReady) return;
        if (speed > 0.1 && state !== "run") {
            state = "run";
            targetIdle = 0;
            targetRun = 1;
        } else if (speed <= 0.1 && state !== "idle") {
            state = "idle";
            targetIdle = 1;
            targetRun = 0;
        }
    }

    function getAnimState() {
        return state;
    }

    // load model
    (async () => {
        try {
            const { meshes, animationGroups } = await SceneLoader.ImportMeshAsync(
                "",
                modelPath.substring(0, modelPath.lastIndexOf("/") + 1),
                modelPath.substring(modelPath.lastIndexOf("/") + 1),
                scene
            );

            const importedRoot = new TransformNode("localModel", scene);
            for (const m of meshes) if (m.name !== "__root__") m.setParent(importedRoot);
            importedRoot.scaling.setAll(0.1);
            importedRoot.parent = player;

            idle = animationGroups.find(g => /idle/i.test(g.name)) ?? animationGroups[0];
            run = animationGroups.find(g => /run/i.test(g.name));

            idle?.start(true);
            run?.start(true);
            applyWeights();
            animReady = true;
        } catch (err) {
            console.error("❌ Failed to load local player model:", err);
        }
    })();

    // chỉ lo blend animation thôi
    scene.onBeforeRenderObservable.add(() => {
        if (!animReady) return;
        const dt = scene.getEngine().getDeltaTime() / 1000;
        const blendSpeed = 5;
        wIdle += (targetIdle - wIdle) * blendSpeed * dt;
        wRun += (targetRun - wRun) * blendSpeed * dt;
        applyWeights();
    });

    return { player, setLocomotion, getAnimState };
}
