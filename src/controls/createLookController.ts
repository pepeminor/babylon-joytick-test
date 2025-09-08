import { FreeCamera, Vector3 } from "@babylonjs/core";
import { LOOK_SENS, PITCH_MIN, PITCH_MAX } from "../constants";

export type CamState = {
    yaw: number; pitch: number; distance: number;
    target: Vector3; curPos: Vector3;
    desiredYaw: number; desiredPitch: number;
};

type Options = {
    canvas: HTMLCanvasElement;
    camera: FreeCamera;
    camState: CamState;
    // Bỏ qua nếu target nằm trong 1 vùng (vd: joystick)
    ignorePredicate?: (t: EventTarget | null) => boolean;
    // Chỉ nhận pointer nếu đạt điều kiện (vd: chỉ cho drag ở nửa trên màn)
    shouldAcceptPointer?: (ev: PointerEvent) => boolean;
};

// đăng ký listeners drag xoay camera (multi-touch safe). Trả cleanup.
export function createLookController(opts: Options) {
    const { canvas, camState, ignorePredicate, shouldAcceptPointer } = opts;

    let camPointerId: number | null = null;
    let lastDrag: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
        const t = e.target as HTMLElement;
        if (ignorePredicate?.(t)) return;
        if (shouldAcceptPointer && !shouldAcceptPointer(e)) return;

        if (camPointerId === null) {
            e.preventDefault();
            camPointerId = e.pointerId;
            lastDrag = { x: e.clientX, y: e.clientY };
            t.setPointerCapture?.(e.pointerId);
        }
    };

    const onPointerMove = (e: PointerEvent) => {
        if (camPointerId !== e.pointerId || !lastDrag) return;
        e.preventDefault();
        const dx = e.clientX - lastDrag.x;
        const dy = e.clientY - lastDrag.y;
        lastDrag = { x: e.clientX, y: e.clientY };

        camState.desiredYaw -= dx * LOOK_SENS;
        camState.desiredPitch -= dy * LOOK_SENS;
        camState.desiredPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, camState.desiredPitch));
    };

    const release = () => { camPointerId = null; lastDrag = null; };
    const onPointerUp = (e: PointerEvent) => { if (camPointerId === e.pointerId) release(); };
    const onPointerCancel = (e: PointerEvent) => { if (camPointerId === e.pointerId) release(); };

    canvas.addEventListener("pointerdown", onPointerDown as any, { passive: false });
    window.addEventListener("pointermove", onPointerMove as any, { passive: false });
    window.addEventListener("pointerup", onPointerUp as any, { passive: false });
    window.addEventListener("pointercancel", onPointerCancel as any, { passive: false });

    return () => {
        canvas.removeEventListener("pointerdown", onPointerDown as any);
        window.removeEventListener("pointermove", onPointerMove as any);
        window.removeEventListener("pointerup", onPointerUp as any);
        window.removeEventListener("pointercancel", onPointerCancel as any);
    };
}
