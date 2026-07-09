import {
  Scene,
  TransformNode,
  Vector3,
  Scalar,
} from "@babylonjs/core";
import { filterVisibleRemotes } from "../network/aoiClient";
import { type AvatarRig } from "./cosmetics/avatarFactory";
import type { RenderTier, CosmeticDescriptor, CosmeticId } from "./cosmetics/cosmeticTypes";
import { DEFAULT_COSMETIC_ID } from "./cosmetics/cosmeticTypes";
import { resolveCosmetic } from "./cosmetics/cosmeticRegistry";
import { acquireRemoteRig, releaseRemoteRig } from "./remotePlayerPool";
import { getAnimationBudget } from "./cosmetics/animationBudget";

type Remote = {
  id: string;
  root: TransformNode;
  avatar?: AvatarRig;
  idle?: import("@babylonjs/core").AnimationGroup;
  run?: import("@babylonjs/core").AnimationGroup;
  attack?: import("@babylonjs/core").AnimationGroup;
  weaponPivot?: TransformNode;
  weapon?: TransformNode;
  attackPos?: Vector3;
  attackLockPos?: Vector3;
  target: Vector3;
  yaw: number;
  state: "idle" | "run" | "attack";
  renderTier?: RenderTier;
  cosmeticId: CosmeticId;
  weights: { idle: number; run: number, attack: number }; // Soft blending.
  targets: {
    idle: number;
    run: number;
    attack: number;
  };
  animationAccumMs?: number;

  justSpawned?: boolean;
  isAttacking?: boolean;
  attackEndFrame?: number; // Required.
};

type PendingAttack = {
  pos: [number, number, number];
  yaw: number;
  duration: number;
};

export const remotes: Record<string, Remote> = {};
const loadingRemotes: Set<string> = new Set();
const pendingAttacksById: Record<string, PendingAttack> = {};

const lastHitTimeByTarget: Record<string, number> = {};
const HIT_COOLDOWN = 500; // ms

// let isAttacking = false;
let hasEmittedThisAttack = false;

// const ATTACK_DURATION = 0.7; // Seconds, matching the local player.

export function triggerRemoteAttack(
  r: Remote,
  data: { pos: [number, number, number]; yaw: number, duration: number }
) {
  if (!r.attack || r.isAttacking) return;

  r.isAttacking = true;

  // Snap immediately.
  r.attackPos = new Vector3(data.pos[0], 0, data.pos[2]);
  r.attackLockPos = r.attackPos.clone();

  r.root.position.copyFrom(r.attackLockPos);
  r.root.rotation.y = data.yaw;

  // IMPORTANT: keep the target in sync as well.
  r.target.copyFrom(r.attackLockPos);

  r.attack.stop();
  r.attack.reset();
  r.attack.start(false);

  r.weights.attack = 1;
  r.weights.run = 0;
  r.weights.idle = 0;
  r.targets.attack = 1;
  r.targets.run = 0;
  r.targets.idle = 0;
}

function applyPendingAttack(id: string, r: Remote) {
  const pending = pendingAttacksById[id];
  if (!pending) return;

  delete pendingAttacksById[id];
  triggerRemoteAttack(r, pending);
}


// === Spawn ===
export async function spawnRemotePlayer(
  scene: Scene,
  id: string,
  modelUrl: string,
  initState?: {
    pos: [number, number, number];
    yaw: number;
    state: string;
    cosmeticId?: string | null;
  }
) {
  void modelUrl;
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
  const cosmeticResolution = resolveCosmetic(initState?.cosmeticId ?? DEFAULT_COSMETIC_ID);
  const cosmetic: CosmeticDescriptor = cosmeticResolution.cosmetic;
  const avatar = await acquireRemoteRig(scene, id, cosmeticResolution.cosmeticId, cosmetic);
  const attack = avatar.attack;
  let attackEndFrame = 0;

  if (attack) {
    attackEndFrame = attack.to - 36; // Same as local.
  }

  if (attack) {
    attack.enableBlending = true;
    attack.blendingSpeed = 0.12;
    attack.setWeightForAllAnimatables(0);
  }

  avatar.root.parent = root;
  avatar.root.setEnabled(true);
  avatar.bodyHitbox.setEnabled(true);
  avatar.weaponPivot?.setEnabled(true);
  avatar.weapon?.root.setEnabled(true);
  avatar.weapon?.hitbox?.setEnabled(false);

  remotes[id] = {
    id,
    root,
    avatar,
    idle: avatar.idle,
    run: avatar.run,
    attack,
    weaponPivot: avatar.weaponPivot,
    weapon: avatar.weapon?.root,
    attackEndFrame, // Store it.
    cosmeticId: cosmeticResolution.cosmeticId,
    target: initState
      ? new Vector3(initState.pos[0], initState.pos[1], initState.pos[2])
      : root.position.clone(),
    yaw: initState ? initState.yaw : 0,
    state: initState ? (initState.state as any) : "idle",
    weights: { idle: 1, run: 0, attack: 0 },
    targets: { idle: 1, run: 0, attack: 0 },
    animationAccumMs: 0,
    justSpawned: true,
    renderTier: "near",
  };

  if (initState) {
    const pos = new Vector3(initState.pos[0], 0, initState.pos[2]);
    root.position.copyFrom(pos);
    remotes[id].target = pos.clone();
    root.rotation.y = initState.yaw;
  }

  // Keep the reference.
  (remotes[id] as any).bodyHitbox = avatar.bodyHitbox;

  applyPendingAttack(id, remotes[id]);

  return remotes[id];
}

// === Update from server ===
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

export function queueRemoteAttack(
  id: string,
  data: { pos: [number, number, number]; yaw: number; duration: number }
) {
  pendingAttacksById[id] = data;

  const r = remotes[id];
  if (r) {
    applyPendingAttack(id, r);
  }
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

    // Position and rotation smoothing.
    if (r.isAttacking && r.attackLockPos) {
      r.root.position.copyFrom(r.attackLockPos);
    } else {
      Vector3.LerpToRef(r.root.position, r.target, interp, r.root.position);
    }
    r.root.rotation.y = Scalar.LerpAngle(r.root.rotation.y, r.yaw, interp);

    // Animation blending.
    const tier = r.renderTier ?? "near";
    const budget = getAnimationBudget(tier);
    const blendSpeed = budget.blendSpeed * dt;
    r.animationAccumMs = (r.animationAccumMs ?? 0) + dt * 1000;
    const shouldUpdateAnimation =
      r.isAttacking ||
      tier !== "far" ||
      r.animationAccumMs >= budget.updateEveryMs;
    // =======================
    // Attack override
    // =======================


    if (shouldUpdateAnimation && !r.isAttacking) {
      r.targets.attack = 0;

      if (r.state === "run") {
        r.targets.run = 1;
        r.targets.idle = 0;
      } else {
        r.targets.run = 0;
        r.targets.idle = 1;
      }
    }

    // if (r.pendingAttack) {
    //   r.targets.run = 0;
    //   r.targets.idle = 1;
    // }


    if (r.isAttacking && r.attack?.animatables.length) {
      const frame = r.attack.animatables[0].masterFrame;

      if (frame >= r.attackEndFrame!) {
        r.isAttacking = false;
        r.attackLockPos = undefined;

        // Restore state from the server.
        r.targets.attack = 0;

        if (r.state === "run") {
          r.targets.run = 1;
          r.targets.idle = 0;
        } else {
          r.targets.run = 0;
          r.targets.idle = 1;
        }
      }
    }



    // =======================
    // NORMAL LOCOMOTION
    // =======================
    if (!r.isAttacking) {
      if (shouldUpdateAnimation && r.state === "run") {
        r.weights.run = Scalar.Clamp(r.weights.run + blendSpeed, 0, 1);
        r.weights.idle = Scalar.Clamp(r.weights.idle - blendSpeed, 0, 1);
        r.weights.attack = Scalar.Clamp(r.weights.attack - blendSpeed, 0, 1);
      } else if (shouldUpdateAnimation) {
        r.weights.idle = Scalar.Clamp(r.weights.idle + blendSpeed, 0, 1);
        r.weights.run = Scalar.Clamp(r.weights.run - blendSpeed, 0, 1);
        r.weights.attack = Scalar.Clamp(r.weights.attack - blendSpeed, 0, 1);
      }
    } else {
      r.weights.attack = 1;
      r.weights.idle = 0;
      r.weights.run = 0;
    }

    const k = budget.weightLerp;

    if (shouldUpdateAnimation) {
      r.animationAccumMs = 0;
      if (r.isAttacking) {
        r.weights.attack = 1;
        r.weights.idle = 0;
        r.weights.run = 0;
      } else {
        r.weights.idle += (r.targets.idle - r.weights.idle) * dt * k;
        r.weights.run += (r.targets.run - r.weights.run) * dt * k;
        r.weights.attack += (r.targets.attack - r.weights.attack) * dt * k;
      }
    }

    if (shouldUpdateAnimation || tier !== "far") {
      r.idle?.setWeightForAllAnimatables(r.weights.idle);
      r.run?.setWeightForAllAnimatables(r.weights.run);
      r.attack?.setWeightForAllAnimatables(r.weights.attack);
    }
  });

  // ===============================
  // TEST WEAPON COLLISION
  // ===============================
  const myWeapon = (window as any).myWeaponHitbox; // Provided by the local player.
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
    delete pendingAttacksById[id];
    return;
  }

  if (r.avatar) {
    releaseRemoteRig(r.avatar, r.avatar.cosmetic, r.cosmeticId);
  }
  r.root.dispose(false, true);

  delete remotes[id];
  loadingRemotes.delete(id);
  delete pendingAttacksById[id];
}
