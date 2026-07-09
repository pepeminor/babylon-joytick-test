import { Vector3 } from "@babylonjs/core";
import { createLookController, type CamState } from "../../controls/createLookController";

type Ref<T> = { current: T };

export function createCameraController({
    canvas,
    camera,
    player,
    lockDragRef,
    lookSens,
    lookLerp,
    distance,
}: {
    canvas: HTMLCanvasElement;
    camera: any;
    player: any;
    lockDragRef: Ref<boolean>;
    lookSens: number;
    lookLerp: number;
    distance: number;
}) {
    const camState: CamState = {
        yaw: 0,
        pitch: -0.12,
        distance,
        target: new Vector3(),
        curPos: camera.position.clone(),
        desiredYaw: 0,
        desiredPitch: -0.12,
    };

    const camFollow = player.position.clone();
    const targetOffset = new Vector3(0, 0.9, 0);
    const off = new Vector3();
    const desired = new Vector3();

    const CAM_FOLLOW_CONFIG = {
        deadZone: 0.05,
        followSpeed: 8,
    };

    const CAM_CONFIG = {
        allowFlip: true,
        minPitch: -Math.PI / 2 + 0.05,
        maxPitch: Math.PI / 2 - 0.05,
    };

    const cleanupLook = createLookController({
        canvas,
        camera,
        camState,
        lookSens,
        ignorePredicate: (t) => (t as HTMLElement | null)?.closest?.("#joystick") != null,
        shouldAcceptPointer: (ev) => {
            if (lockDragRef.current) {
                if (typeof ev.clientY !== "number") return true;
                return ev.clientY < window.innerHeight * 0.6;
            }
            return true;
        },
    });

    function update(dt: number) {
        const k = 1 - Math.exp(-lookLerp * dt);
        camState.yaw += (camState.desiredYaw - camState.yaw) * k;
        camState.pitch += (camState.desiredPitch - camState.pitch) * k;

        if (CAM_CONFIG.allowFlip) {
            camState.pitch = Math.max(
                CAM_CONFIG.minPitch,
                Math.min(CAM_CONFIG.maxPitch, camState.pitch)
            );
        }

        const dx = player.position.x - camFollow.x;
        const dz = player.position.z - camFollow.z;
        const dist = Math.hypot(dx, dz);

        if (dist > CAM_FOLLOW_CONFIG.deadZone) {
            const excess = dist - CAM_FOLLOW_CONFIG.deadZone;
            camFollow.x += (dx / dist) * excess * CAM_FOLLOW_CONFIG.followSpeed * dt;
            camFollow.z += (dz / dist) * excess * CAM_FOLLOW_CONFIG.followSpeed * dt;
        }

        camFollow.x = Math.round(camFollow.x * 1000) / 1000;
        camFollow.z = Math.round(camFollow.z * 1000) / 1000;

        camState.target.set(
            camFollow.x,
            player.position.y + targetOffset.y,
            camFollow.z
        );

        off.set(
            Math.sin(camState.yaw) * Math.cos(camState.pitch),
            Math.sin(camState.pitch),
            Math.cos(camState.yaw) * Math.cos(camState.pitch)
        ).scaleInPlace(camState.distance);

        desired.copyFrom(camState.target).subtractInPlace(off);

        Vector3.LerpToRef(
            camState.curPos,
            desired,
            1 - Math.exp(-dt * 8),
            camState.curPos
        );

        camera.position.copyFrom(camState.curPos);
        camera.setTarget(camState.target);
    }

    return {
        update,
        dispose() {
            cleanupLook();
        },
    };
}
