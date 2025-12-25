import { useEffect, useRef, useState } from "react";
import type { Scene } from "@babylonjs/core";
import { useKeys } from "./hooks/useKeys";
import { useScrollLock } from "./hooks/useScrollLock";
import { useJoystick } from "./hooks/useJoystick";
import { Joystick } from "./components/Joystick";
import { DebugOverlay, type DebugInfo } from "./components/DebugOverlay";
import { useGameServer } from "./hooks/useGameServer";
import { useCombatStore } from "./store/combatStore";
import { setupRuntime } from "./engine/runtimes/setupRunTime";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // UI toggles
  const [debugOn, setDebugOn] = useState(false);
  const [lockDrag, setLockDrag] = useState(false);
  const debugOnRef = useRef(false);
  const lockDragRef = useRef(false);
  useEffect(() => { debugOnRef.current = debugOn; }, [debugOn]);
  useEffect(() => { lockDragRef.current = lockDrag; }, [lockDrag]);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  console.log("PWA standalone:", isStandalone);

  // input
  const keys = useKeys();
  const { JOY_RADIUS, joyActive, joyKnob, joyVec, onJoyStart, onJoyMove, onJoyEnd } = useJoystick();
  useScrollLock(joyActive);

  // debug state
  const [debug, setDebug] = useState<DebugInfo>({ fps: 0, dt: 0, speed: 0, yaw: 0, pitch: 0, px: 0, py: 0, pz: 0 });
  const startedRef = useRef(false);
  const [sceneState, setSceneState] = useState<Scene | null>(null);
  const { socketRef: serverSocketRef, error: serverError, disconnect: disconnectServer } = useGameServer(sceneState);
  const lastSentRef = useRef<{ x: number; y: number; z: number; yaw: number; state: string }>({
    x: 0, y: 0, z: 0, yaw: 0, state: "idle",
  });

  useEffect(() => {
    if (serverError) {
      console.error("❌ Game server error:", serverError);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (startedRef.current || !canvasRef.current) return;

      startedRef.current = true;

      const cleanup = await setupRuntime({
        canvas: canvasRef.current,
        lockDragRef,
        keysRef: keys,
        joyVecRef: joyVec,
        lastSentRef,
        serverSocketRef,
        disconnectServer,
        setSceneState,
      });

      // If component still mounted → keep cleanup
      if (mounted) {
        cleanupRef.current = cleanup;
      }
    };

    run();

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, [disconnectServer, keys, joyVec, serverSocketRef, setDebug, setSceneState]);

  useEffect(() => {
    let lastTick = useCombatStore.getState().attackTick;

    const unsub = useCombatStore.subscribe((state) => {
      if (state.attackTick !== lastTick) {
        lastTick = state.attackTick;

        const sock = serverSocketRef.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) return;

        sock.send(JSON.stringify({
          type: "attack",
        }));

        // console.log("📤 ATTACK SENT TO SERVER");
      }
    });

    return unsub;
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#000",
        color: "#fff",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        paddingTop: "var(--sat)",
        paddingBottom: "var(--sab)",
        paddingLeft: "var(--sal)",
        paddingRight: "var(--sar)",
        // touchAction: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
        }}
      />

      <DebugOverlay
        info={debug}
        debugOn={debugOn}
        setDebugOn={setDebugOn}
        lockDrag={lockDrag}
        setLockDrag={setLockDrag}
      />

      <Joystick
        radius={JOY_RADIUS}
        active={joyActive}
        knob={joyKnob}
        onStart={onJoyStart}
        onMove={onJoyMove}
        onEnd={onJoyEnd}
      />

      {/* {weaponDebug && <WeaponDebug weapon={weaponDebug} />} */}
    </div>
  );
}