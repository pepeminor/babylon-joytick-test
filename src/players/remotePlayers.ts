import {
  Scene,
  TransformNode,
  AnimationGroup,
  Vector3,
  Scalar,
} from "@babylonjs/core";
import { importMeshWithRetry } from "../utils";
import { filterVisibleRemotes } from "../network/aoiClient";

type Remote = {
  id: string;
  root: TransformNode;
  idle?: AnimationGroup;
  run?: AnimationGroup;
  target: Vector3;
  yaw: number;
  state: "idle" | "run" | "attack";
  weights: { idle: number; run: number }; // blend mềm
  justSpawned?: boolean;
};

export const remotes: Record<string, Remote> = {};
const loadingRemotes: Set<string> = new Set();

// === Spawn ===
export async function spawnRemotePlayer(
  scene: Scene,
  id: string,
  modelUrl: string,
  initState?: { pos: [number, number, number]; yaw: number; state: string }
) {
  if (scene.isDisposed) {
    console.warn("⚠️ Cannot spawn, scene is already disposed");
    return null;
  }
  if (remotes[id] || loadingRemotes.has(id)) {
    console.warn("⚠️ Skip spawn, already exists or loading:", id);
    return remotes[id];
  }

  loadingRemotes.add(id);

  const root = new TransformNode("remote_" + id, scene);
  const rootUrl = modelUrl.slice(0, modelUrl.lastIndexOf("/") + 1);
  const fileName = modelUrl.slice(modelUrl.lastIndexOf("/") + 1);
  const { meshes, animationGroups } = await importMeshWithRetry(
    rootUrl,
    fileName,
    scene,
    1
  );

  //   console.log({ animationGroups });
  const imported = new TransformNode("remoteModel_" + id, scene);
  for (const m of meshes) if (m.name !== "__root__") m.setParent(imported);
  imported.scaling.setAll(0.1);
  imported.parent = root;

  const idle =
    animationGroups.find((g) => /idle/i.test(g.name)) ?? animationGroups[0];
  const run = animationGroups.find((g) => /run/i.test(g.name));

  idle?.start(true);
  run?.start(true);
  idle?.setWeightForAllAnimatables(1);
  run?.setWeightForAllAnimatables(0);

  remotes[id] = {
    id,
    root,
    idle,
    run,
    target: initState
      ? new Vector3(initState.pos[0], initState.pos[1], initState.pos[2])
      : root.position.clone(),
    yaw: initState ? initState.yaw : 0,
    state: initState ? (initState.state as any) : "idle",
    weights: { idle: 1, run: 0 },
    justSpawned: true,
  };

  if (initState) {
    const pos = new Vector3(initState.pos[0], 0, initState.pos[2]);
    root.position.copyFrom(pos);
    remotes[id].target = pos.clone();
    root.rotation.y = initState.yaw;
  }

  return remotes[id];
}

// === Update từ server ===
export function updateRemotePlayerFromServer(
  id: string,
  data: { pos: [number, number, number]; yaw: number; state: string }
) {
  const r = remotes[id];
  if (!r) return;
  r.target.copyFromFloats(data.pos[0], 0, data.pos[2]);
  r.yaw = data.yaw;
  r.state = (data.state as any) || "idle";
}

export function updateRemotePlayers(scene: Scene, myPos: Vector3) {
  const dt = scene.getEngine().getDeltaTime() / 1000;
  const interp = Math.min(1, dt * 10);

  Object.values(remotes).forEach((r) => {
    if (r.justSpawned) {
      r.justSpawned = false;
      r.root.position.copyFrom(r.target);
      r.root.rotation.y = r.yaw;
      return;
    }

    // position & rotation smoothing
    Vector3.LerpToRef(r.root.position, r.target, interp, r.root.position);
    r.root.rotation.y = Scalar.LerpAngle(r.root.rotation.y, r.yaw, interp);

    // animation blending
    const blendSpeed = 5 * dt;
    if (r.state === "run") {
      r.weights.idle = Scalar.Clamp(r.weights.idle - blendSpeed, 0, 1);
      r.weights.run = Scalar.Clamp(r.weights.run + blendSpeed, 0, 1);
    } else {
      r.weights.idle = Scalar.Clamp(r.weights.idle + blendSpeed, 0, 1);
      r.weights.run = Scalar.Clamp(r.weights.run - blendSpeed, 0, 1);
    }

    r.idle?.setWeightForAllAnimatables(r.weights.idle);
    r.run?.setWeightForAllAnimatables(r.weights.run);
  });

  filterVisibleRemotes(myPos);
}

export function despawnRemotePlayer(id: string) {
  const r = remotes[id];
  if (!r) {
    console.warn("⚠️ despawnRemotePlayer: no remote found for", id);
    return;
  }

  r.root.getChildMeshes().forEach((m) => m.dispose());
  r.idle?.dispose();
  r.run?.dispose();
  r.root.dispose();

  delete remotes[id];
  loadingRemotes.delete(id);
}
