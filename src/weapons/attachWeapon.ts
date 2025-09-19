import { Scene, TransformNode, } from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export async function attachWeapon(
    scene: Scene,
    playerRoot: TransformNode,
    glbUrl: string
) {
    try {
        // ✅ lấy skeleton đầu tiên của nhân vật (giả định là skeleton Mixamo)
        const skeleton = scene.skeletons[0];
        if (!skeleton) {
            console.warn("⚠️ No skeleton found in scene, cannot attach weapon");
            return;
        }

        // 👉 tìm bone RightHand (Mixamo: "mixamorig:RightHand")
        const handBone = skeleton.bones.find(b =>
            b.name.toLowerCase().includes("righthand")
        );
        if (!handBone) {
            console.warn("⚠️ RightHand bone not found");
            return;
        }

        // ✅ load glb weapon
        const { meshes } = await SceneLoader.ImportMeshAsync(
            "",
            glbUrl.substring(0, glbUrl.lastIndexOf("/") + 1),
            glbUrl.substring(glbUrl.lastIndexOf("/") + 1),
            scene
        );

        // gom nhóm meshes lại
        const weaponRoot = new TransformNode("weaponRoot", scene);
        for (const m of meshes) {
            if (m.name !== "__root__") m.setParent(weaponRoot);
        }

        // scale nhỏ lại (tùy model)
        weaponRoot.scaling.setAll(0.5);

        // 👉 attach vào tay
        weaponRoot.attachToBone(handBone, playerRoot);

        // offset nếu bị lệch
        weaponRoot.position.set(0, -0.3, 0.1);
        weaponRoot.rotation.set(Math.PI / 2, 0, 0);

        console.log("✅ Weapon attached to RightHand:", glbUrl);
    } catch (err) {
        console.error("❌ Failed to load weapon", err);
    }
}
