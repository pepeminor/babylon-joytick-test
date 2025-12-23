import {
  Scene,
  TransformNode,
  AnimationGroup,
  Vector3,
  Scalar,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";
import { importMeshWithRetry } from "../utils";
import { filterVisibleRemotes } from "../network/aoiClient";
import { createMagicStaff } from "../weapons/createMagicStaff";

type Remote = {
  id: string;
  root: TransformNode;
  idle?: AnimationGroup;
  run?: AnimationGroup;
  attack?: AnimationGroup;
  pendingAttack?: boolean;
  weaponPivot?: TransformNode;
  weapon?: TransformNode;
  attackPos?: Vector3;
  attackLockPos?: Vector3;
  target: Vector3;
  yaw: number;
  state: "idle" | "run" | "attack";
  weights: { idle: number; run: number, attack: number }; // blend mềm
  targets: {
    idle: number;
    run: number;
    attack: number;
  };

  justSpawned?: boolean;
  isAttacking?: boolean;
  attackEndFrame?: number; // 🔥 BẮT BUỘC
};

export const remotes: Record<string, Remote> = {};
const loadingRemotes: Set<string> = new Set();

const lastHitTimeByTarget: Record<string, number> = {};
const HIT_COOLDOWN = 500; // ms

// const ATTACK_FRAMES = 72;
// const ATTACK_FPS = 24; // Blender default
// const ATTACK_DURATION = ATTACK_FRAMES / ATTACK_FPS;
const ATTACK_DISTANCE_EPS = 0.005; // tuning

// let isAttacking = false;
let hasEmittedThisAttack = false;

// const ATTACK_DURATION = 0.7; // giây – match local

export function triggerRemoteAttack(
  r: Remote,
  data: { pos: [number, number, number]; yaw: number, duration: number }
) {
  if (!r.attack || r.isAttacking) return;

  r.isAttacking = true;

  // 🔥 SNAP NGAY LẬP TỨC
  r.attackPos = new Vector3(data.pos[0], 0, data.pos[2]);
  r.attackLockPos = r.attackPos.clone();

  r.root.position.copyFrom(r.attackLockPos);
  r.root.rotation.y = data.yaw;

  // ❗ IMPORTANT: đồng bộ target luôn
  r.target.copyFrom(r.attackLockPos);

  r.attack.stop();
  r.attack.reset();
  r.attack.start(false);

  r.targets.attack = 1;
  r.targets.run = 0;
  r.targets.idle = 0;
}


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

  const skeleton = meshes.find(m => (m as any).skeleton)?.skeleton;
  const skinnedMesh = meshes.find(m => (m as any).skeleton === skeleton);
  const staff = createMagicStaff(scene);

  const hand = skeleton?.bones.find(b =>
    /RightHandMiddle1/.test(b.name)
  );

  if (hand && skinnedMesh) {
    const weaponPivot = new TransformNode("remoteWeaponPivot", scene);


    staff.scaling.setAll(2000); // GIỐNG LOCAL
    staff.parent = weaponPivot;

    weaponPivot.attachToBone(hand, skinnedMesh);

    weaponPivot.position.set(
      1,
      -0.04,
      1
    );

    weaponPivot.rotation.set(
      Math.PI / 2.2,
      Math.PI / 1.55,
      Math.PI * 0.05
    );

    const weaponHitbox = (staff as any).weaponHitbox;

    if (weaponHitbox) {
      weaponHitbox.setEnabled(false);
    }


  }

  const attack =
    animationGroups.find(g => /attack/i.test(g.name));
  let attackEndFrame = 0;

  if (attack) {
    attackEndFrame = attack.to - 36; // GIỐNG LOCAL
  }

  if (attack) {
    attack.start(true); // chạy ngầm
    attack.enableBlending = true;
    attack.blendingSpeed = 0.12;
    attack.setWeightForAllAnimatables(0);
  }

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
  const weaponPivot = new TransformNode("remoteWeaponPivot_" + id, scene);

  remotes[id] = {
    id,
    root,
    idle,
    run,
    attack, // 👈 THÊM
    weaponPivot,   // 👈 LƯU LẠI
    weapon: staff, // 👈 LƯU LẠI
    attackEndFrame, // 🔥 LƯU LẠI
    target: initState
      ? new Vector3(initState.pos[0], initState.pos[1], initState.pos[2])
      : root.position.clone(),
    yaw: initState ? initState.yaw : 0,
    state: initState ? (initState.state as any) : "idle",
    weights: { idle: 1, run: 0, attack: 0 },
    targets: { idle: 1, run: 0, attack: 0 },
    justSpawned: true,
  };

  if (initState) {
    const pos = new Vector3(initState.pos[0], 0, initState.pos[2]);
    root.position.copyFrom(pos);
    remotes[id].target = pos.clone();
    root.rotation.y = initState.yaw;
  }

  // ===============================
  // BODY HITBOX (REMOTE)
  // ===============================
  const bodyHitbox = MeshBuilder.CreateBox(
    `remoteBodyHitbox_${id}`,
    { width: 0.5, height: 1.2, depth: 0.4 },
    scene
  );

  bodyHitbox.parent = root;
  bodyHitbox.position.y = 0.6; // ngang ngực
  bodyHitbox.isPickable = false;


  // DEBUG MATERIAL
  const mat = new StandardMaterial("remoteHitboxMat", scene);
  mat.diffuseColor = new Color3(1, 0, 0); // red
  mat.alpha = 0.3;
  bodyHitbox.material = mat;
  bodyHitbox.isVisible = false; // set true when want to see a box collision
  // bodyHitbox.setEnabled(false); // set true when want to debug

  // lưu reference
  (remotes[id] as any).bodyHitbox = bodyHitbox;


  return remotes[id];
}

// === Update từ server ===
export function updateRemotePlayerFromServer(
  id: string,
  data: { pos: [number, number, number]; yaw: number; state: string }
) {
  const r = remotes[id];
  if (!r) return;
  if (r.isAttacking) return;
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
    if (r.isAttacking && r.attackLockPos) {
      r.root.position.copyFrom(r.attackLockPos);
    } else {
      Vector3.LerpToRef(r.root.position, r.target, interp, r.root.position);
    }
    r.root.rotation.y = Scalar.LerpAngle(r.root.rotation.y, r.yaw, interp);

    // animation blending
    const blendSpeed = 6 * dt;
    // =======================
    // ATTACK OVERRIDE
    // =======================


    if (!r.isAttacking) {
      if (r.state === "run") {
        r.targets.run = 1;
        r.targets.idle = 0;
      } else {
        r.targets.idle = 1;
        r.targets.run = 0;
      }
    }

    // if (r.pendingAttack) {
    //   r.targets.run = 0;
    //   r.targets.idle = 1;
    // }


    if (r.pendingAttack && !r.isAttacking) {
      const dist = Vector3.Distance(r.root.position, r.target);

      if (dist <= ATTACK_DISTANCE_EPS) {
        // ✅ BÂY GIỜ MỚI ATTACK
        r.pendingAttack = false;
        r.isAttacking = true;

        r.attackPos = r.root.position.clone();

        r.attack!.stop();
        r.attack!.reset();
        r.attack!.start(false);

        r.targets.attack = 1;
        r.targets.idle = 0;
        r.targets.run = 0;
      }
    }


    if (r.isAttacking && r.attack?.animatables.length) {
      const frame = r.attack.animatables[0].masterFrame;

      if (frame >= r.attackEndFrame!) {
        r.isAttacking = false;
        r.attackLockPos = undefined;

        // const dist = Vector3.Distance(r.root.position, r.target);
        // if (dist > 0.01) {
        //   r.targets.run = 1;
        //   r.targets.idle = 0;
        // } else {
        //   r.targets.run = 0;
        //   r.targets.idle = 1;
        // }
      }
    }



    // =======================
    // NORMAL LOCOMOTION
    // =======================
    else if (r.state === "run") {
      r.weights.run = Scalar.Clamp(r.weights.run + blendSpeed, 0, 1);
      r.weights.idle = Scalar.Clamp(r.weights.idle - blendSpeed, 0, 1);
      r.weights.attack = Scalar.Clamp(r.weights.attack - blendSpeed, 0, 1);
    } else {
      r.weights.idle = Scalar.Clamp(r.weights.idle + blendSpeed, 0, 1);
      r.weights.run = Scalar.Clamp(r.weights.run - blendSpeed, 0, 1);
      r.weights.attack = Scalar.Clamp(r.weights.attack - blendSpeed, 0, 1);
    }

    const k = 6;

    r.weights.idle += (r.targets.idle - r.weights.idle) * dt * k;
    r.weights.run += (r.targets.run - r.weights.run) * dt * k;
    r.weights.attack += (r.targets.attack - r.weights.attack) * dt * k;

    r.idle?.setWeightForAllAnimatables(r.weights.idle);
    r.run?.setWeightForAllAnimatables(r.weights.run);
    r.attack?.setWeightForAllAnimatables(r.weights.attack);
  });

  // ===============================
  // TEST WEAPON COLLISION
  // ===============================
  const myWeapon = (window as any).myWeaponHitbox; // gán từ local player
  if (!myWeapon || !myWeapon.isEnabled()) {
    filterVisibleRemotes(myPos);
    return;
  }

  // =====================================
  // FOR COLLION BETWEEN WEAPON AND REMOTE
  // =====================================
  const now = performance.now();
  let didHitSomeone = false;

  for (const r of Object.values(remotes) as any[]) {
    if (!r.bodyHitbox) continue;

    if (!myWeapon.intersectsMesh(r.bodyHitbox, false)) continue;

    const last = lastHitTimeByTarget[r.id] ?? 0;
    if (now - last <= HIT_COOLDOWN) continue;

    lastHitTimeByTarget[r.id] = now;
    console.log("💥 HIT REMOTE:", r.id);
    // emit socket attack here...
    didHitSomeone = true;

  }

  if (didHitSomeone && !hasEmittedThisAttack) {
    hasEmittedThisAttack = true;
    // socket.emit("attack", { ts: now });
  }

}

export function despawnRemotePlayer(id: string) {
  const r = remotes[id];
  if (!r) {
    console.warn("⚠️ despawnRemotePlayer: no remote found for", id);
    return;
  }

  r.weapon?.dispose();
  r.weaponPivot?.dispose();

  (r as any).bodyHitbox?.dispose();

  r.root.getChildMeshes().forEach((m) => m.dispose());

  r.idle?.dispose();
  r.run?.dispose();
  r.attack?.dispose();

  r.root.dispose();

  delete remotes[id];
  loadingRemotes.delete(id);
}