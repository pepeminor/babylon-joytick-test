import React from "react";

export function Joystick(props: {
    id?: string;
    radius: number;
    active: boolean;
    knob: { x: number; y: number } | null;
    safeBottomCss?: string;
    onStart: (e: React.PointerEvent) => void;
    onMove: (e: React.PointerEvent) => void;
    onEnd: (e: React.PointerEvent) => void;
}) {
    const { id = "joystick", radius, active, knob, safeBottomCss = "env(safe-area-inset-bottom, 0px)", onStart, onMove, onEnd } = props;

    return (
        <div
            id={id}
            onPointerDown={onStart}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                position: "fixed",
                left: "50%",
                transform: "translateX(-50%)",
                bottom: `calc(12vh + ${safeBottomCss} + 8px)`,
                width: radius * 2 + 16,
                height: radius * 2 + 16,
                zIndex: 30,
                touchAction: "none",
            }}
        >
            <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.18)",
                boxShadow: "0 6px 30px rgba(0,0,0,.35)",
                touchAction: "none",
            }} />
            {knob && (
                <div style={{
                    position: "absolute",
                    left: knob.x, top: knob.y,
                    width: 56, height: 56, borderRadius: 999,
                    transform: "translate(-50%,-50%)",
                    background: "rgba(255,255,255,.25)",
                    border: "1px solid rgba(255,255,255,.55)",
                    backdropFilter: "blur(4px)",
                    touchAction: "none",
                }} />
            )}
            {!active && (
                <div style={{
                    position: "absolute",
                    left: "50%", top: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 8, height: 8, borderRadius: 999,
                    background: "rgba(255,255,255,.5)",
                    touchAction: "none",
                }} />
            )}
        </div>
    );
}
