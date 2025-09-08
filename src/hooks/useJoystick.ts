import { useRef, useState } from "react";
import { Vector3 } from "@babylonjs/core";
import { JOY_RADIUS as R_DEFAULT, JOY_DEADZONE as DZ_DEFAULT } from "../constants";

export function useJoystick(opts?: { radius?: number; deadzone?: number }) {
    const JOY_RADIUS = opts?.radius ?? R_DEFAULT;
    const JOY_DEADZONE = opts?.deadzone ?? DZ_DEFAULT;

    const [joyActive, setJoyActive] = useState(false);
    const [joyKnob, setJoyKnob] = useState<{ x: number; y: number } | null>(null);
    const joyOrigin = useRef<{ x: number; y: number } | null>(null);
    const joyPointerId = useRef<number | null>(null);
    const joyVec = useRef(new Vector3(0, 0, 0)); // x: trái/phải, y: tiến/lùi

    const onJoyStart = (e: React.PointerEvent) => {
        e.preventDefault();
        if (joyPointerId.current !== null && joyPointerId.current !== e.pointerId) return;
        joyPointerId.current = e.pointerId;

        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        joyOrigin.current = { x, y };
        setJoyActive(true);
        setJoyKnob({ x, y });
        el.setPointerCapture?.(e.pointerId);
    };

    const onJoyMove = (e: React.PointerEvent) => {
        e.preventDefault();
        if (joyPointerId.current !== e.pointerId || !joyOrigin.current) return;
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const dx = x - joyOrigin.current.x, dy = y - joyOrigin.current.y;

        const len = Math.hypot(dx, dy);
        const scale = len > JOY_RADIUS ? JOY_RADIUS / len : 1;
        const cx = dx * scale, cy = dy * scale;

        setJoyKnob({ x: joyOrigin.current.x + cx, y: joyOrigin.current.y + cy });

        const nx = cx / JOY_RADIUS;
        const ny = -cy / JOY_RADIUS; // kéo lên = tiến
        const mag = Math.hypot(nx, ny);
        if (mag < JOY_DEADZONE / JOY_RADIUS) {
            joyVec.current.set(0, 0, 0);
        } else {
            joyVec.current.set(nx, ny, 0);
        }
    };

    const onJoyEnd = (e: React.PointerEvent) => {
        if (joyPointerId.current !== e.pointerId) return;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        joyPointerId.current = null;
        joyOrigin.current = null;
        setJoyActive(false);
        setJoyKnob(null);
        joyVec.current.set(0, 0, 0);
    };

    return { JOY_RADIUS, JOY_DEADZONE, joyActive, joyKnob, joyVec, onJoyStart, onJoyMove, onJoyEnd };
}
