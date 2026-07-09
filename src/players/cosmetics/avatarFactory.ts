import {
  AnimationGroup,
  Bone,
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  Skeleton,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";
import { createWeapon, type WeaponInstance } from "../../weapons/weaponFactory";
import { DEFAULT_COSMETIC, type CosmeticDescriptor } from "./cosmeticTypes";
import { loadAvatarContainer } from "../../assets/assetRegistry";

export type AvatarRig = {
  root: TransformNode;
  modelRoot: TransformNode;
  cosmetic: CosmeticDescriptor;
  skeleton?: Skeleton;
  skinnedMesh?: Mesh;
  idle?: AnimationGroup;
  run?: AnimationGroup;
  attack?: AnimationGroup;
  bodyHitbox: Mesh;
  weapon?: WeaponInstance;
  weaponPivot?: TransformNode;
  handBone?: Bone;
  dispose: () => void;
};

type AvatarRigOptions = {
  id: string;
  cosmetic?: Partial<CosmeticDescriptor>;
  scale?: number;
  enableWeaponFx?: boolean;
  bodyHitboxVisible?: boolean;
};

export async function createAvatarRig(
  scene: Scene,
  options: AvatarRigOptions
): Promise<AvatarRig> {
  const cosmetic: CosmeticDescriptor = {
    ...DEFAULT_COSMETIC,
    ...options.cosmetic,
  };

  const root = new TransformNode(`avatarRoot_${options.id}`, scene);
  const { container } = await loadAvatarContainer(scene, cosmetic.skinId);
  const inst = container.instantiateModelsToScene((name) => `${options.id}_${name}`);
  const animationGroups = inst.animationGroups;
  const skeletons = inst.skeletons;
  const meshes = inst.rootNodes.flatMap((node) => {
    const collected: Mesh[] = [];
    if (node instanceof Mesh) {
      collected.push(node);
    }
    if ("getChildMeshes" in node) {
      collected.push(...((node as any).getChildMeshes(false) as Mesh[]));
    }
    return collected;
  });

  const modelRoot = MeshBuilder.CreateBox(`avatarModelRoot_${options.id}`, { size: 0.01 }, scene);
  modelRoot.isVisible = false;
  modelRoot.parent = root;

  inst.rootNodes.forEach((node) => {
    if (node !== root) node.parent = modelRoot;
  });

  modelRoot.scaling.setAll(options.scale ?? 0.1);

  const skeleton = skeletons[0];
  const skinnedMesh = meshes.find((mesh) => (mesh as any).skeleton === skeleton) as Mesh | undefined;

  const idle = animationGroups.find((group) => /idle/i.test(group.name)) ?? animationGroups[0];
  const run = animationGroups.find((group) => /run/i.test(group.name));
  const attack = animationGroups.find((group) => /attack/i.test(group.name));

  idle?.start(true);
  run?.start(true);
  idle?.setWeightForAllAnimatables(1);
  run?.setWeightForAllAnimatables(0);

  if (attack) {
    attack.start(true);
    attack.enableBlending = true;
    attack.blendingSpeed = 0.1;
    attack.setWeightForAllAnimatables(0);
  }

  const bodyHitbox = MeshBuilder.CreateBox(
    `bodyHitbox_${options.id}`,
    { width: 0.5, height: 1.2, depth: 0.4 },
    scene
  );
  bodyHitbox.parent = root;
  bodyHitbox.position.y = 0.6;
  bodyHitbox.isPickable = false;
  bodyHitbox.isVisible = Boolean(options.bodyHitboxVisible);

  const hitMat = new StandardMaterial(`bodyHitboxMat_${options.id}`, scene);
  hitMat.diffuseColor = new Color3(0, 1, 0);
  hitMat.alpha = 0.3;
  bodyHitbox.material = hitMat;

  const handBone = skeleton?.bones.find((bone) => /RightHandMiddle1/.test(bone.name));
  const weapon = createWeapon(scene, cosmetic.weaponId, {
    enableFx: options.enableWeaponFx ?? false,
  });

  let weaponPivot: TransformNode | undefined;
  if (handBone && skinnedMesh) {
    weaponPivot = new TransformNode(`weaponPivot_${options.id}`, scene);
    weapon.root.parent = weaponPivot;
    weaponPivot.attachToBone(handBone, skinnedMesh);
    weaponPivot.position.set(1, -0.04, 1);
    weaponPivot.rotation.set(
      Math.PI / 2.2,
      Math.PI / 1.55,
      Math.PI * 0.05
    );
  } else {
    weapon.root.parent = root;
  }

  weapon.root.scaling.setAll(2000);

  return {
    root,
    modelRoot,
    cosmetic,
    skeleton,
    skinnedMesh,
    idle,
    run,
    attack,
    bodyHitbox,
    weapon,
    weaponPivot,
    handBone,
    dispose() {
      weaponPivot?.dispose(false, true);
      (weapon.root as any).__disposeWeaponFx?.();
      inst.animationGroups.forEach((group) => group.dispose());
      root.dispose(false, true);
    },
  };
}
