import {
    Engine, Scene, Vector3, Color3, Color4,
    FreeCamera, HemisphericLight, DirectionalLight,
    MeshBuilder, StandardMaterial, TransformNode, AbstractMesh, AnimationGroup
} from "@babylonjs/core";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AnimationPropertiesOverride } from "@babylonjs/core/Animations/animationPropertiesOverride";
import "@babylonjs/loaders/glTF";

export type SceneBundle = {
    engine: Engine;
    scene: Scene;
    camera: FreeCamera;
    player: TransformNode;
    setLocomotion: (speed: number) => void;
};

const MODEL_PATH = "models/pepe-test.glb";
const MODEL_SCALE = 0.1;

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
    const engine = new Engine(canvas, true, {
        antialias: true,
        stencil: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
    });

    const hardResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engine.setHardwareScalingLevel(1 / dpr);
        engine.resize(true);
    };
    hardResize();
    window.addEventListener("resize", hardResize);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.06, 0.07, 0.09, 1);

    scene.animationPropertiesOverride = new AnimationPropertiesOverride();
    scene.animationPropertiesOverride.enableBlending = true;
    scene.animationPropertiesOverride.blendingSpeed = 0.08;

    // Camera
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 8), scene);
    camera.minZ = 0.01; camera.maxZ = 500;
    camera.setTarget(new Vector3(0, 0.9, 0));

    // Lights
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
    dir.position = new Vector3(8, 12, 6);
    dir.intensity = 0.9;

    // Ground
    const ground = MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
    const gmat = new StandardMaterial("gmat", scene);
    gmat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    gmat.specularColor = new Color3(0, 0, 0);
    gmat.emissiveColor = new Color3(0.06, 0.07, 0.09);
    ground.material = gmat;
    ground.freezeWorldMatrix();

    // === Local Player =====================================================
    const player = new TransformNode("playerRoot", scene);

    let idleGroup: AnimationGroup | undefined;
    let runGroup: AnimationGroup | undefined;
    let animReady = false;

    let wIdle = 1, wRun = 0;
    const applyWeights = () => {
        idleGroup?.setWeightForAllAnimatables(wIdle);
        runGroup?.setWeightForAllAnimatables(wRun);
    };

    type AnimState = "idle" | "run";
    let animState: AnimState = "idle";

    const fade = {
        active: false,
        t: 0,
        dur: 0.25,
        fromIdle: 1, toIdle: 1,
        fromRun: 0, toRun: 0
    };

    const setState = (next: AnimState) => {
        if (!animReady) return;
        if (animState === next) return;
        animState = next;

        fade.active = true; fade.t = 0;
        fade.fromIdle = wIdle; fade.fromRun = wRun;
        fade.toIdle = (next === "idle") ? 1 : 0;
        fade.toRun = (next === "run") ? 1 : 0;
    };

    scene.onBeforeRenderObservable.add(() => {
        if (!fade.active) return;
        const dt = scene.getEngine().getDeltaTime() / 1000;
        fade.t = Math.min(fade.t + dt, fade.dur);
        const k = fade.t / fade.dur;
        wIdle = fade.fromIdle + (fade.toIdle - fade.fromIdle) * k;
        wRun = fade.fromRun + (fade.toRun - fade.fromRun) * k;
        applyWeights();
        if (fade.t >= fade.dur) fade.active = false;
    });

    (async () => {
        try {
            const modelUrl = new URL(`${import.meta.env.BASE_URL}${MODEL_PATH}`, window.location.origin).toString();
            const rootUrl = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
            const fileName = modelUrl.slice(modelUrl.lastIndexOf("/") + 1);

            const { meshes, animationGroups } = await importMeshWithRetry(rootUrl, fileName, scene, 3);
            const importedRoot = new TransformNode("importedRoot", scene);
            for (const m of meshes) {
                if (m.name === "__root__") continue;
                m.setParent(importedRoot);
            }
            importedRoot.scaling.setAll(MODEL_SCALE);
            importedRoot.parent = player;

            idleGroup = animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
            runGroup = animationGroups.find((g) => /run/i.test(g.name));

            idleGroup?.start(true);
            runGroup?.start(true);

            wIdle = 1; wRun = 0; applyWeights();
            animReady = true;
        } catch (err) {
            console.warn("Import GLB failed for local:", err);
        }
    })();

    const setLocomotion = (speed: number) => {
        if (!animReady) return;
        if (speed > 0.08) setState("run");
        else setState("idle");
    };

    // Input
    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    let moveSpeed = 3;
    scene.onBeforeRenderObservable.add(() => {
        const forward = (keys["KeyW"] || keys["ArrowUp"]) ? 1 : 0;
        const back = (keys["KeyS"] || keys["ArrowDown"]) ? 1 : 0;
        const left = (keys["KeyA"] || keys["ArrowLeft"]) ? 1 : 0;
        const right = (keys["KeyD"] || keys["ArrowRight"]) ? 1 : 0;

        const dt = scene.getEngine().getDeltaTime() / 1000;
        let vx = (right - left);
        let vz = (forward - back);

        if (vx || vz) {
            const len = Math.hypot(vx, vz);
            vx /= len; vz /= len;
            const targetYaw = Math.atan2(vx, vz);
            player.rotation.y = targetYaw;
            player.position.x += vx * moveSpeed * dt;
            player.position.z += vz * moveSpeed * dt;
            setLocomotion(moveSpeed);
        } else {
            setLocomotion(0);
        }
    });

    // === Remote Players ===================================================
    type Remote = {
        root: TransformNode,
        idle?: AnimationGroup,
        run?: AnimationGroup,
        target: Vector3,
        speed: number
    };
    const remotePlayers: Record<string, Remote> = {};

    async function spawnRemotePlayer(id: string) {
        const root = new TransformNode(`remoteRoot_${id}`, scene);
        try {
            const modelUrl = new URL(`${import.meta.env.BASE_URL}${MODEL_PATH}`, window.location.origin).toString();
            const rootUrl = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
            const fileName = modelUrl.slice(modelUrl.lastIndexOf("/") + 1);

            const { meshes, animationGroups } = await importMeshWithRetry(rootUrl, fileName, scene, 1);
            const importedRoot = new TransformNode(`remoteModelRoot_${id}`, scene);
            for (const m of meshes) {
                if (m.name === "__root__") continue;
                m.setParent(importedRoot);
            }
            importedRoot.scaling.setAll(MODEL_SCALE);
            importedRoot.parent = root;

            const idle = animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
            const run = animationGroups.find((g) => /run/i.test(g.name));
            idle?.start(true); run?.start(true);
            idle?.setWeightForAllAnimatables(1); run?.setWeightForAllAnimatables(0);

            remotePlayers[id] = {
                root,
                idle,
                run,
                target: randomTarget(),
                speed: 2 + Math.random() * 1.5
            };
        } catch (err) {
            console.warn("Import GLB failed for remote:", err);
        }
    }

    function randomTarget() {
        const range = 20;
        return new Vector3(
            (Math.random() - 0.5) * range * 2,
            0,
            (Math.random() - 0.5) * range * 2
        );
    }

    // Spawn 5 remote players
    for (let i = 0; i < 50; i++) {
        spawnRemotePlayer("p" + i);
    }


    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;

        Object.values(remotePlayers).forEach(r => {
            if (!r) return;
            const pos = r.root.position;
            const dir = r.target.subtract(pos);
            const dist = dir.length();

            if (dist < 0.5) {
                // Chọn target mới khi tới gần
                r.target = randomTarget();
            } else {
                dir.normalize();
                pos.addInPlace(dir.scale(r.speed * dt));
                r.root.rotation.y = Math.atan2(dir.x, dir.z);
            }

            // Animation
            const moving = dist >= 0.5;
            if (r.idle && r.run) {
                if (moving) {
                    r.idle.setWeightForAllAnimatables(0);
                    r.run.setWeightForAllAnimatables(1);
                } else {
                    r.idle.setWeightForAllAnimatables(1);
                    r.run.setWeightForAllAnimatables(0);
                }
            }
        });
    });

    // ======================================================================

    return { engine, scene, camera, player, setLocomotion };
}

async function importMeshWithRetry(rootUrl: string, fileName: string, scene: Scene, retries = 2) {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
        try {
            return await SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene);
        } catch (e) {
            lastErr = e;
            await new Promise((r) => setTimeout(r, 250 * (i + 1)));
        }
    }
    throw lastErr;
}

function forceOpaqueMaterials(root: TransformNode) {
    const meshes = root.getChildMeshes(false) as AbstractMesh[];
    for (const m of meshes) {
        const mat = m.material;
        if (!mat) continue;

        if (mat instanceof StandardMaterial) {
            mat.alpha = 1;
            (mat as any).useAlphaFromDiffuseTexture = false;
            if ((mat as any).diffuseTexture) ((mat as any).diffuseTexture as any).hasAlpha = false;
            mat.backFaceCulling = false;
            continue;
        }

        if (mat instanceof PBRMaterial) {
            mat.alpha = 1;
            mat.useAlphaFromAlbedoTexture = false;
            if (mat.albedoTexture) (mat.albedoTexture as any).hasAlpha = false;
            mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
            mat.backFaceCulling = false;
            mat.twoSidedLighting = true;
            if (mat.metallic === undefined) mat.metallic = 0;
            if (mat.roughness === undefined) mat.roughness = 0.6;
        }
    }
}
