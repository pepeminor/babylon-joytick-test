import {
    Scene,
    TransformNode,
    PointerEventTypes,
    // Color3,
} from "@babylonjs/core";
// import { createCandleChartWeapon, } from "../weapons/createGreenCandle";
import { useCombatStore } from "../store/combatStore";
import { createAvatarRig, type AvatarRig } from "./cosmetics/avatarFactory";

const ATTACK_FRAMES = 72;
const ATTACK_FPS = 24; // Blender default
const ATTACK_DURATION = ATTACK_FRAMES / ATTACK_FPS;
let ATTACK_END_FRAME = 0;

export async function createLocalPlayer(scene: Scene, modelPath: string) {
    void modelPath;

    const player = new TransformNode("playerRoot", scene);
    let avatar: AvatarRig | null = null;

    let attackInputLocked = false;

    let pointerRegistered = false;
    let wantAttack = false;

    let attackPressed = false;
    let isAttacking = false;
    let attackWeight = 0;
    let tAttack = 0;
    let movementLocked = false;

    let wIdle = 1, wRun = 0;
    let tIdle = 1, tRun = 0;

    function requestAttack() {
        if (attackInputLocked || isAttacking) return;
        wantAttack = true;
    }

    const applyWeights = () => {
        // idle?.setWeightForAllAnimatables(wIdle);
        // run?.setWeightForAllAnimatables(wRun);

        avatar?.idle?.setWeightForAllAnimatables(wIdle * (1 - attackWeight));
        avatar?.run?.setWeightForAllAnimatables(wRun * (1 - attackWeight));
        avatar?.attack?.setWeightForAllAnimatables(attackWeight);
    };

    function startAttack() {
        if (isAttacking || !avatar?.attack) return;

        isAttacking = true;
        attackInputLocked = true;
        movementLocked = true; // Lock movement.

        tRun = 0;
        tIdle = 1;

        avatar.attack.stop();
        avatar.attack.reset();
        avatar.attack.start(false); // Do not loop.

        tAttack = 1; // target blend IN

        // opts?.onAttack?.();
        useCombatStore.getState().triggerAttack();

        const weaponHitbox = (window as any).myWeaponHitbox;

        weaponHitbox?.setEnabled(true); // Enable during debug.

        setTimeout(() => weaponHitbox?.setEnabled(false), ATTACK_DURATION * 1000 * 0.65);
    }




    function setLocomotion(speed: number) {
        if (movementLocked) {
            tIdle = 1;
            tRun = 0;
            return;
        }

        if (isAttacking) {
            tIdle = 1;
            tRun = 0;
            return;
        }
        if (speed > 0.1) { tIdle = 0; tRun = 1; }
        else { tIdle = 1; tRun = 0; }
    }

    avatar = await createAvatarRig(scene, {
        id: "local",
        scale: 0.1,
        enableWeaponFx: true,
    });
    const attack = avatar.attack;

    avatar.root.parent = player;
    avatar.bodyHitbox.parent = player;
    (player as any).bodyHitbox = avatar.bodyHitbox;
    (player as any).isAttacking = () => isAttacking;

    if (attack) {
        ATTACK_END_FRAME = attack.to - 36; // Trim the last 4 frames to avoid a T-pose.
        attack.enableBlending = true;
        attack.blendingSpeed = 0.08;
        attack.setWeightForAllAnimatables(0);
    }

    if (avatar.idle) {
        avatar.idle.enableBlending = true;
        avatar.idle.setWeightForAllAnimatables(1);
    }
    avatar.run?.setWeightForAllAnimatables(0);

    applyWeights();


    if (!pointerRegistered) {
        pointerRegistered = true;

        scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
            if (attackPressed) return;

            attackPressed = true;

            const evt = pointerInfo.event as PointerEvent;
            const target = evt.target as HTMLElement;
            if (target?.closest?.(".joystick")) return;
            requestAttack();
        });

        scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== PointerEventTypes.POINTERUP) return;
            attackPressed = false;
        });
    }


    if (avatar.weapon?.hitbox) {
        avatar.weapon.hitbox.setEnabled(false);
        (window as any).myWeaponHitbox = avatar.weapon.hitbox;
    }


    // -------------------------------------------------------------------
    // 7) ANIMATION BLEND
    // -------------------------------------------------------------------
    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;
        const k = 6;


        wIdle += (tIdle - wIdle) * dt * k;
        wRun += (tRun - wRun) * dt * k;
        attackWeight += (tAttack - attackWeight) * dt * k;

        applyWeights();


        // ===============================
        // Frame-based attack end (anti T-pose)
        // ===============================
        if (
            isAttacking &&
            attack &&
            attack.animatables.length &&
            attack.animatables[0].masterFrame >= ATTACK_END_FRAME
        ) {
            tAttack = 0;              // blend OUT
            isAttacking = false;
            attackInputLocked = false;
            movementLocked = false;
        }

        if (wantAttack && !isAttacking) {
            wantAttack = false;
            startAttack();
        }
    });

    return { player, setLocomotion };
}
