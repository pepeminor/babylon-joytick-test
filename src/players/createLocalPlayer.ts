import {
    Scene,
    TransformNode,
    AnimationGroup,
    MeshBuilder,
    Mesh,
    Vector3,
    StandardMaterial,
    Color3,
    PointerEventTypes,
    // Color3,
} from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { createMagicStaff } from "../weapons/createMagicStaff";
// import { createCandleChartWeapon, } from "../weapons/createGreenCandle";
import { useCombatStore } from "../store/combatStore";

const ATTACK_FRAMES = 72;
const ATTACK_FPS = 24; // Blender default
const ATTACK_DURATION = ATTACK_FRAMES / ATTACK_FPS;
let ATTACK_END_FRAME = 0;

export async function createLocalPlayer(scene: Scene, modelPath: string) {

    const player = new TransformNode("playerRoot", scene);

    let attackInputLocked = false;

    let pointerRegistered = false;
    let wantAttack = false;

    let attackPressed = false;
    let isAttacking = false;
    let attackWeight = 0;
    let tAttack = 0;
    let movementLocked = false;

    let idle: AnimationGroup | undefined;
    let run: AnimationGroup | undefined;

    let wIdle = 1, wRun = 0;
    let tIdle = 1, tRun = 0;

    function requestAttack() {
        if (attackInputLocked || isAttacking) return;
        wantAttack = true;
    }

    const applyWeights = () => {
        // idle?.setWeightForAllAnimatables(wIdle);
        // run?.setWeightForAllAnimatables(wRun);

        idle?.setWeightForAllAnimatables(wIdle * (1 - attackWeight));
        run?.setWeightForAllAnimatables(wRun * (1 - attackWeight));
        attack?.setWeightForAllAnimatables(attackWeight);
    };

    function startAttack() {
        if (isAttacking || !attack) return;

        isAttacking = true;
        attackInputLocked = true;
        movementLocked = true; // 🔒 KHÓA MOVEMENT

        tRun = 0;
        tIdle = 1;

        attack.stop();
        attack.reset();
        attack.start(false); // không loop

        tAttack = 1; // target blend IN

        // opts?.onAttack?.();
        useCombatStore.getState().triggerAttack();

        const weaponHitbox = (window as any).myWeaponHitbox;

        weaponHitbox?.setEnabled(true) // turn on when debug

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

    // -------------------------------------------------------------------
    // 1) LOAD GLB
    // -------------------------------------------------------------------
    const { meshes, animationGroups, skeletons } = await SceneLoader.ImportMeshAsync(
        "",
        modelPath.substring(0, modelPath.lastIndexOf("/") + 1),
        modelPath.substring(modelPath.lastIndexOf("/") + 1),
        scene
    );

    const skeleton = skeletons[0];

    // -------------------------------------------------------------------
    // 2) MODEL ROOT (scale only here)
    // -------------------------------------------------------------------
    const modelRoot = MeshBuilder.CreateBox("modelRoot", { size: 0.01 }, scene);
    modelRoot.isVisible = false;
    modelRoot.parent = player;

    meshes.forEach(m => {
        try { m.setParent(modelRoot); } catch { m.parent = modelRoot; }
    });

    modelRoot.scaling.setAll(0.1);  // scale model

    // -------------------------------------------------------------------
    // 3) ANIMATIONS
    // -------------------------------------------------------------------
    idle = animationGroups.find(a => /idle/i.test(a.name)) ?? animationGroups[0];
    run = animationGroups.find(a => /run/i.test(a.name));
    const attack = animationGroups.find(a => /attack/i.test(a.name));
    if (attack) {
        ATTACK_END_FRAME = attack.to - 36; // cắt 4 frame cuối (tránh T-pose)
    }

    idle?.start(true);
    run?.start(true);
    idle.enableBlending = true;
    idle.blendingSpeed = 0.12;

    applyWeights();

    if (attack) {
        attack.start(true);              // 🔥 run background forever
        attack.enableBlending = true;
        attack.blendingSpeed = 0.08;
        attack.setWeightForAllAnimatables(0);
    }


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


    // ===============================
    // BODY HITBOX (LOCAL)
    // ===============================
    const bodyHitbox = MeshBuilder.CreateBox(
        "localBodyHitbox",
        { width: 0.5, height: 1.2, depth: 0.4 },
        scene
    );

    bodyHitbox.parent = player;
    bodyHitbox.position.y = 0.6;
    bodyHitbox.isPickable = false;
    bodyHitbox.isVisible = false; // set true when want to see a box collision

    const mat = new StandardMaterial("localHitboxMat", scene);
    mat.diffuseColor = new Color3(0, 1, 0); // green
    mat.alpha = 0.3;
    bodyHitbox.material = mat;
    // bodyHitbox.setEnabled(false); // set true when want to debug

    // expose để combat dùng
    (player as any).bodyHitbox = bodyHitbox;
    (player as any).isAttacking = () => isAttacking;

    // -------------------------------------------------------------------
    // 4) SKINNED MESH + RIGHT HAND
    // -------------------------------------------------------------------
    let skinnedMesh = meshes.find(m => (m as any).skeleton === skeleton) as Mesh;
    if (!skinnedMesh) skinnedMesh = meshes[0] as Mesh;


    const hand = skeleton.bones.find(b =>
        /RightHandMiddle1/.test(b.name)
    );

    // -------------------------------------------------------------
    // 5) CREATE STAFF WITH PROPER ATTACH LOGIC
    // -------------------------------------------------------------
    // const staff = createCandleChartWeapon(scene, {
    //     handle: { height: 0.4, diameter: 0.025 },
    //     candle: {
    //         open: 0.1,
    //         close: -0.19,
    //         high: 0.4,
    //         low: 0.1,
    //         width: 0.1,
    //         // colorUp: new Color3(0.1, 0.9, 0.3),
    //         // colorDown: new Color3(0.1, 0.9, 0.3),
    //         // emissiveUp: new Color3(0.1, 0.9, 0.3),
    //         // emissiveDown: new Color3(0.1, 0.9, 0.3),
    //         colorUp: new Color3(0.84, 0.22, 0.26),
    //         colorDown: new Color3(0.84, 0.22, 0.26),
    //         emissiveUp: new Color3(0.84, 0.22, 0.26),
    //         emissiveDown: new Color3(0.84, 0.22, 0.26),
    //         emissiveStrength: 1.2,
    //     },
    //     head: {
    //         height: 0.01,
    //         width: 0.01,
    //         emissive: new Color3(0.84, 0.22, 0.26),
    //         emissiveStrength: 1.2,
    //     },
    //     glowIntensity: 0.64,
    // });

    // const staff = createGreenCandleWeapon(scene);
    const staff = createMagicStaff(scene);
    staff.scaling.setAll(2000);

    // tạo pivot
    const weaponPivot = new TransformNode("weaponPivot", scene);

    // staff child of pivot
    staff.parent = weaponPivot;
    staff.position.set(0, 0, 0);
    staff.rotation.set(0, 0, 0);

    if (hand) {

        // attach pivot tp bone
        weaponPivot.attachToBone(hand, skinnedMesh);
        weaponPivot.position.set(
            1,      // X
            -0.04,  // Y
            1       // Z
        );

        weaponPivot.rotation = new Vector3(
            Math.PI / 2.2,     // rotate horizontal
            Math.PI / 1.55,   // rotate
            Math.PI * 0.05
        );

        const weaponHitbox = (staff as any).weaponHitbox;

        // console.log({ weaponHitbox })

        // bật luôn để test
        weaponHitbox.setEnabled(false);

        // expose để updateRemotePlayers dùng
        (window as any).myWeaponHitbox = weaponHitbox;

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
        // FRAME-BASED ATTACK END (ANTI T-POSE)
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
