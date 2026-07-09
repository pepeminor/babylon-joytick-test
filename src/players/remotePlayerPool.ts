import type { Scene } from "@babylonjs/core";
import { createAvatarRig, type AvatarRig } from "./cosmetics/avatarFactory";
import type { CosmeticDescriptor, CosmeticId } from "./cosmetics/cosmeticTypes";

export type PooledRemoteRig = {
  cosmeticId: CosmeticId;
  avatar: AvatarRig;
  cosmetic: CosmeticDescriptor;
};

const pool: PooledRemoteRig[] = [];

export async function acquireRemoteRig(
  scene: Scene,
  id: string,
  cosmeticId: CosmeticId,
  cosmetic: CosmeticDescriptor
) {
  const exactIdx = pool.findIndex((entry) =>
    entry.cosmeticId === cosmeticId
  );

  if (exactIdx >= 0) {
    const entry = pool.splice(exactIdx, 1)[0];
    return entry.avatar;
  }

  const idx = pool.findIndex((entry) =>
    entry.cosmetic.skinId === cosmetic.skinId &&
    entry.cosmetic.weaponId === cosmetic.weaponId
  );

  if (idx >= 0) {
    const entry = pool.splice(idx, 1)[0];
    return entry.avatar;
  }

  return createAvatarRig(scene, {
    id,
    cosmetic,
    scale: 0.1,
    enableWeaponFx: false,
  });
}

export function releaseRemoteRig(
  avatar: AvatarRig,
  cosmetic: CosmeticDescriptor,
  cosmeticId: CosmeticId
) {
  avatar.root.setEnabled(false);
  avatar.root.parent = null;
  avatar.weaponPivot?.setEnabled(false);
  avatar.bodyHitbox.setEnabled(false);
  avatar.weapon?.root.setEnabled(false);

  pool.push({ avatar, cosmetic, cosmeticId });
}

export function clearRemoteRigPool() {
  while (pool.length > 0) {
    const entry = pool.pop();
    entry?.avatar.dispose();
  }
}
