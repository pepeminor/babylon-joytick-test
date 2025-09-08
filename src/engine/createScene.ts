import {
    Engine, Scene, Vector3, Color3, Color4,
    FreeCamera, HemisphericLight, DirectionalLight,
    MeshBuilder, StandardMaterial, TransformNode, AbstractMesh,
} from "@babylonjs/core";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export type SceneBundle = {
    engine: Engine;
    scene: Scene;
    camera: FreeCamera;
    player: TransformNode;
};

// === Config ==============================================================
// const MODEL_PATH = "models/pepe.glb";
// const MODEL_PATH = "models/pepe-idle.glb";
const MODEL_PATH = "models/pepe-idle-t.glb";
const MODEL_SCALE = 0.3;
const FACE_TO_PLUS_Z_DEG = 0;
const EXTRA_EULER_ROT = new Vector3(0, 0, 0);

// Theme tối (giống bản đầu)
const SKY_COLOR = new Color4(0.06, 0.07, 0.09, 1);   // màu clear của scene (phần trời)
const GROUND_COLOR = new Color3(0.06, 0.07, 0.09);   // màu mặt đất tối (không mint nữa)
// ========================================================================

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
    const engine = new Engine(canvas, true, {
        antialias: true,
        stencil: true,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
    });

    // set backbuffer theo CSS size ngay từ đầu
    const hardResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engine.setHardwareScalingLevel(1 / dpr);
        engine.resize(true);
    };
    hardResize();
    window.addEventListener("resize", hardResize);

    const scene = new Scene(engine);
    scene.clearColor = SKY_COLOR;

    // IBL: gán khi load xong
    (async () => {
        const envPath = `${import.meta.env.BASE_URL}env/neutral.env`;
        try {
            const res = await fetch(envPath, { cache: "force-cache" });
            if (!res.ok) return;
            const tex = CubeTexture.CreateFromPrefilteredData(envPath, scene);
            tex.onLoadObservable.addOnce(() => {
                scene.environmentTexture = tex;
                scene.environmentIntensity = 0.9; // nhẹ chút cho “tối” hơn
            });
        } catch { }
    })();

    // Camera
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 6), scene);
    camera.minZ = 0.01; camera.maxZ = 500;
    camera.setTarget(new Vector3(0, 0.9, 0));

    // Lights (giảm nhẹ hemispheric để tổng thể tối)
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
    dir.position = new Vector3(8, 12, 6);
    dir.intensity = 0.9;

    // Ground — màu tối như bản đầu
    const ground = MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
    const gmat = new StandardMaterial("gmat", scene);
    gmat.diffuseColor = GROUND_COLOR;             // ⬅⬅ đổi lại màu tối
    gmat.specularColor = new Color3(0, 0, 0);     // không highlight
    gmat.emissiveColor = new Color3(0, 0, 0);     // không tự phát sáng
    ground.material = gmat;
    ground.freezeWorldMatrix();

    // Player root
    const player = new TransformNode("playerRoot", scene);

    // Placeholder cube (hiện ngay)
    const placeholder = MeshBuilder.CreateBox("playerPlaceholder", { size: 1.2 }, scene);
    const pmat = new StandardMaterial("pmat", scene);
    pmat.diffuseColor = new Color3(1, 0.18, 0.18);
    pmat.emissiveColor = new Color3(0, 0, 0);
    placeholder.material = pmat;
    placeholder.position = new Vector3(0, 0.6, 0);
    placeholder.parent = player;

    // Import GLB nền + thay thế khi xong
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
            // autoOrientUpright(importedRoot);
            forceOpaqueMaterials(importedRoot);

            if (FACE_TO_PLUS_Z_DEG !== 0) importedRoot.rotation.y += (FACE_TO_PLUS_Z_DEG * Math.PI) / 180;
            if (EXTRA_EULER_ROT.lengthSquared() > 0) importedRoot.rotation.addInPlace(EXTRA_EULER_ROT);

            const b = importedRoot.getHierarchyBoundingVectors();
            importedRoot.position.y -= b.min.y;

            importedRoot.parent = player;
            placeholder.dispose();

            const idle = animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
            idle?.play(true);
        } catch (err) {
            console.warn("Import GLB failed → giữ placeholder:", err);
        }
    })();

    // Props tĩnh (giữ màu xanh lá nhạt nhẹ)
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

// function autoOrientUpright(visual: TransformNode) {
//     // Giữ lại rotation gốc
//     const baseRot = visual.rotation.clone();

//     // 3 ứng viên: đang Y-up (giữ nguyên), Z-up (xoay -90° X), X-up (xoay +90° Z)
//     const candidates = [
//         new Vector3(0, 0, 0),                    // Y-up
//         new Vector3(-Math.PI / 2, 0, 0),         // Z-up -> -90° quanh X
//         new Vector3(0, 0, Math.PI / 2),         // X-up -> +90° quanh Z
//     ];

//     let bestScore = -Infinity;
//     let bestRot = candidates[0].clone();

//     for (const rot of candidates) {
//         // thử xoay
//         visual.rotation.copyFrom(baseRot).addInPlace(rot);

//         // đo bounding sau xoay
//         const b = visual.getHierarchyBoundingVectors();
//         const dx = b.max.x - b.min.x;
//         const dy = b.max.y - b.min.y;
//         const dz = b.max.z - b.min.z;

//         // điểm số: càng "cao" (dy) và đế càng "gọn" (max(dx, dz)) thì càng tốt
//         const height = dy;
//         const footprint = Math.max(dx, dz) + 1e-6;
//         const straightness = height / footprint;

//         // nhẹ nhàng thưởng thêm nếu trọng tâm không bị lệch quá
//         const centerY = (b.max.y + b.min.y) * 0.5;
//         const score = straightness - Math.abs(centerY) * 0.001;

//         if (score > bestScore) {
//             bestScore = score;
//             bestRot = rot.clone();
//         }
//     }

//     // áp dụng xoay tối ưu
//     visual.rotation.copyFrom(baseRot).addInPlace(bestRot);
// }


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
