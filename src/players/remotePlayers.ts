import { Scene, TransformNode, AnimationGroup, Vector3, Scalar } from "@babylonjs/core";
import { importMeshWithRetry } from "../utils";

type Remote = {
    root: TransformNode;
    idle?: AnimationGroup;
    run?: AnimationGroup;
    target: Vector3;
    yaw: number;
    state: "idle" | "run" | "attack";
};

const remotes: Record<string, Remote> = {};

// === Spawn ===
export async function spawnRemote(scene: Scene, id: string, modelUrl: string) {
    if (remotes[id]) return remotes[id]; // tránh trùng

    const root = new TransformNode("remote_" + id, scene);
    const rootUrl = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
    const fileName = modelUrl.slice(modelUrl.lastIndexOf("/") + 1);
    const { meshes, animationGroups } = await importMeshWithRetry(rootUrl, fileName, scene, 1);

    const imported = new TransformNode("remoteModel_" + id, scene);
    for (const m of meshes) if (m.name !== "__root__") m.setParent(imported);
    imported.scaling.setAll(0.1);
    imported.parent = root;

    const idle = animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
    const run = animationGroups.find((g) => /run/i.test(g.name));
    idle?.start(true);
    run?.start(true);
    idle?.setWeightForAllAnimatables(1);
    run?.setWeightForAllAnimatables(0);

    remotes[id] = { root, idle, run, target: root.position.clone(), yaw: 0, state: "idle" };
    return remotes[id];
}

// === Update từ server ===
export function updateRemoteFromServer(id: string, data: { pos: [number, number, number]; yaw: number; state: string }) {
    const r = remotes[id];
    if (!r) return;
    r.target.copyFromFloats(...data.pos);
    r.yaw = data.yaw;
    r.state = (data.state as any) || "idle";
}

// === Update mỗi frame ===
export function updateRemotes(scene: Scene) {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    const interp = Math.min(1, dt * 10);

    Object.values(remotes).forEach((r) => {
        r.root.position = Vector3.Lerp(r.root.position, r.target, interp);
        r.root.rotation.y = Scalar.LerpAngle(r.root.rotation.y, r.yaw, interp);

        if (r.idle && r.run) {
            if (r.state === "run") {
                r.idle.setWeightForAllAnimatables(0);
                r.run.setWeightForAllAnimatables(1);
            } else {
                r.idle.setWeightForAllAnimatables(1);
                r.run.setWeightForAllAnimatables(0);
            }
        }
    });
}

// === Despawn (remove player) ===
export function despawnRemote(id: string) {
    const r = remotes[id];
    if (!r) return;

    r.root.getChildMeshes().forEach(m => m.dispose());
    r.root.dispose();
    delete remotes[id];
}
