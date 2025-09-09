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
};

// === Config ==============================================================
const MODEL_PATH = "models/pepe-test.glb";
const MODEL_SCALE = 0.1;
const FACE_TO_PLUS_Z_DEG = 0;
const EXTRA_EULER_ROT = new Vector3(0, 0, 0);

// Theme tối (giống bản đầu)
const SKY_COLOR = new Color4(0.06, 0.07, 0.09, 1);
const GROUND_COLOR = new Color3(0.06, 0.07, 0.09);
// ========================================================================

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
    scene.clearColor = SKY_COLOR;

    // Bật blending cho animation (crossfade mượt)
    scene.animationPropertiesOverride = new AnimationPropertiesOverride();
    scene.animationPropertiesOverride.enableBlending = true;
    scene.animationPropertiesOverride.blendingSpeed = 0.08; // ~0.25s

    // IBL: gán khi load xong
    (async () => {
        const envPath = `${import.meta.env.BASE_URL}env/neutral.env`;
        try {
            const res = await fetch(envPath, { cache: "force-cache" });
            if (!res.ok) return;
            const tex = CubeTexture.CreateFromPrefilteredData(envPath, scene);
            tex.onLoadObservable.addOnce(() => {
                scene.environmentTexture = tex;
                scene.environmentIntensity = 0.9;
            });
        } catch { }
    })();

    // Camera
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 6), scene);
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
    gmat.diffuseColor = GROUND_COLOR;
    gmat.specularColor = new Color3(0, 0, 0);
    gmat.emissiveColor = new Color3(0, 0, 0);
    ground.material = gmat;
    ground.freezeWorldMatrix();

    // Player root
    const player = new TransformNode("playerRoot", scene);

    // Placeholder cube
    const placeholder = MeshBuilder.CreateBox("playerPlaceholder", { size: 1.2 }, scene);
    const pmat = new StandardMaterial("pmat", scene);
    pmat.diffuseColor = new Color3(1, 0.18, 0.18);
    pmat.emissiveColor = new Color3(0, 0, 0);
    placeholder.material = pmat;
    placeholder.position = new Vector3(0, 0.6, 0);
    placeholder.parent = player;

    // === Animation state machine (Idle <-> Run) ============================
    let idleGroup: AnimationGroup | undefined;
    let runGroup: AnimationGroup | undefined;
    let animReady = false;

    // weight hiện tại (tự quản, vì Babylon không expose getter weight public)
    let wIdle = 1;
    let wRun = 0;

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

        fade.active = true;
        fade.t = 0;
        fade.dur = 0.25;

        // Snapshot từ weight hiện tại
        fade.fromIdle = wIdle;
        fade.fromRun = wRun;

        fade.toIdle = (next === "idle") ? 1 : 0;
        fade.toRun = (next === "run") ? 1 : 0;
    };

    // Cập nhật fade mỗi frame
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
    // ======================================================================

    // Import GLB nền + thay thế khi xong
    (async () => {
        try {
            const modelUrl = new URL(`${import.meta.env.BASE_URL}${MODEL_PATH}`, window.location.origin).toString();
            const rootUrl = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
            const fileName = modelUrl.slice(modelUrl.lastIndexOf("/") + 1);

            const { meshes, animationGroups } = await importMeshWithRetry(rootUrl, fileName, scene, 3);

            // Log groups
            animationGroups.forEach(g => console.log("g.name", g.name)); // Idle, Run, Attack...

            const importedRoot = new TransformNode("importedRoot", scene);
            for (const m of meshes) {
                if (m.name === "__root__") continue;
                m.setParent(importedRoot);
            }

            importedRoot.scaling.setAll(MODEL_SCALE);
            forceOpaqueMaterials(importedRoot);

            if (FACE_TO_PLUS_Z_DEG !== 0) importedRoot.rotation.y += (FACE_TO_PLUS_Z_DEG * Math.PI) / 180;
            if (EXTRA_EULER_ROT.lengthSquared() > 0) importedRoot.rotation.addInPlace(EXTRA_EULER_ROT);

            const b = importedRoot.getHierarchyBoundingVectors();
            importedRoot.position.y -= b.min.y;

            importedRoot.parent = player;
            placeholder.dispose();

            // Tìm groups
            idleGroup = animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
            runGroup = animationGroups.find((g) => /run/i.test(g.name));

            // Play loop cả hai, điều khiển bằng weight
            idleGroup?.start(true);
            runGroup?.start(true);

            // Speed/timing tùy chỉnh (nếu cần)
            // runGroup && (runGroup.speedRatio = 1.0);

            // Khởi tạo weight
            wIdle = 1; wRun = 0;
            applyWeights();

            animState = "idle";
            animReady = true;

        } catch (err) {
            console.warn("Import GLB failed → giữ placeholder:", err);
        }
    })();

    // Props tĩnh
    for (let i = 0; i < 40; i++) {
        const s = 0.3 + Math.random() * 0.8;
        const box = MeshBuilder.CreateBox("b" + i, { width: s, height: s, depth: s }, scene);
        const m = new StandardMaterial("bm" + i, scene);
        m.diffuseColor = new Color3(0.41, 0.82, 0.57);
        m.emissiveColor = new Color3(0.0, 0.0, 0.0);
        box.material = m;
        const r = 40 + Math.random() * 80, t = Math.random() * Math.PI * 2;
        box.position = new Vector3(Math.cos(t) * r, s / 2, Math.sin(t) * r);
        box.freezeWorldMatrix();
    }

    scene.skipPointerMovePicking = true;

    try { scene.render(); } catch { }

    (scene as any).__cleanupResize = () => {
        window.removeEventListener("resize", hardResize);
    };

    // === Input & chuyển state theo di chuyển ===============================
    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", e => keys[e.code] = true);
    window.addEventListener("keyup", e => keys[e.code] = false);

    let moveSpeed = 3; // m/s
    scene.onBeforeRenderObservable.add(() => {
        const forward = (keys["KeyW"] || keys["ArrowUp"]) ? 1 : 0;
        const back = (keys["KeyS"] || keys["ArrowDown"]) ? 1 : 0;
        const left = (keys["KeyA"] || keys["ArrowLeft"]) ? 1 : 0;
        const right = (keys["KeyD"] || keys["ArrowRight"]) ? 1 : 0;

        const moving = forward || back || left || right;

        if (animReady) {
            if (moving) setState("run");
            else setState("idle");
        }

        // Move theo trục world Z+ (tuỳ bạn đổi sang theo camera)
        const dt = scene.getEngine().getDeltaTime() / 1000;
        let vx = (right - left);
        let vz = (forward - back);

        if (vx || vz) {
            const len = Math.hypot(vx, vz);
            vx /= len; vz /= len;

            // quay mặt theo hướng chạy
            const targetYaw = Math.atan2(vx, vz);
            player.rotation.y = targetYaw;

            // bước tiến
            player.position.x += vx * moveSpeed * dt;
            player.position.z += vz * moveSpeed * dt;
        }
    });
    // ======================================================================

    return { engine, scene, camera, player };
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
