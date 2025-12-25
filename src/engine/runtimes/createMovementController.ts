import { TransformNode, Vector3 } from "@babylonjs/core";
import { ACCEL, DEACCEL, MAX_SPEED } from "../../config";

type Ref<T> = { current: T };

export function createMovementController({
    player,
    joyVecRef,
    keysRef,
    setLocomotion,
}: {
    player: TransformNode;
    joyVecRef: Ref<Vector3>;
    keysRef: Ref<Record<string, boolean>>;
    setLocomotion: (v: number) => void;
}) {
    const vel = new Vector3();
    const moveDir = new Vector3();
    const moveContribution = new Vector3();
    const scaledVel = new Vector3();
    const camForward = new Vector3();
    const camRight = new Vector3();
    const up = new Vector3(0, 1, 0);
    let speed = 0;


    function update(dt: number, camera: any) {
        camForward.copyFrom(camera.getTarget()).subtractInPlace(camera.position);
        camForward.y = 0;
        camForward.normalize();

        Vector3.CrossToRef(up, camForward, camRight);
        camRight.normalize();

        let iX = joyVecRef.current.x;
        let iY = joyVecRef.current.y;

        if (keysRef.current["w"]) iY += 1;
        if (keysRef.current["s"]) iY -= 1;
        if (keysRef.current["a"]) iX -= 1;
        if (keysRef.current["d"]) iX += 1;

        const mag = Math.hypot(iX, iY);
        if (mag > 1) {
            iX /= mag;
            iY /= mag;
        }

        moveDir.copyFrom(camForward).scaleInPlace(iY);
        camRight.scaleToRef(iX, moveContribution);
        moveDir.addInPlace(moveContribution);

        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
            vel.addInPlace(moveDir.scale(ACCEL * dt));
        } else {
            vel.scaleInPlace(Math.max(0, 1 - DEACCEL * dt));
        }

        if (vel.length() > MAX_SPEED) {
            vel.normalize().scaleInPlace(MAX_SPEED);
        }

        // prevent movement when attacking
        if ((player as any).isAttacking?.()) {
            vel.setAll(0)
        }

        vel.scaleToRef(dt, scaledVel);
        player.position.addInPlace(scaledVel);

        const spd = vel.length();
        setLocomotion(spd);

        if (spd > 0.05) {
            const targetYaw = Math.atan2(vel.x, vel.z);
            let d = targetYaw - player.rotation.y;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            player.rotation.y += d * Math.min(1, dt * 8);
        }

        speed = vel.length();
        setLocomotion(speed);
    }

    return { update, getSpeed: () => speed, };
}
