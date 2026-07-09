import type { Scene, TransformNode } from "@babylonjs/core";
import { createMagicStaff, type MagicStaffOptions } from "./createMagicStaff";
import type { WeaponId } from "../players/cosmetics/cosmeticTypes";
import { WEAPON_REGISTRY } from "./weaponRegistry";

export type WeaponInstance = {
  id: WeaponId;
  root: TransformNode;
  hitbox?: TransformNode;
};

export function createWeapon(
  scene: Scene,
  weaponId: WeaponId,
  options?: MagicStaffOptions
): WeaponInstance {
  const definition = WEAPON_REGISTRY[weaponId];

  switch (definition.id) {
    case "magic_staff": {
      const root = createMagicStaff(scene, options);
      return {
        id: weaponId,
        root,
        hitbox: (root as any).weaponHitbox,
      };
    }
    default: {
      const exhaustive: never = definition.id;
      throw new Error(`Unsupported weapon: ${exhaustive}`);
    }
  }
}
