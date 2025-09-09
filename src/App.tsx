import { useEffect, useRef, useState } from "react";
import { Vector3 } from "@babylonjs/core";
import { createScene } from "./engine/createScene";
import { createLookController, type CamState } from "./controls/createLookController";
import { useKeys } from "./hooks/useKeys";
import { useScrollLock } from "./hooks/useScrollLock";
import { useJoystick } from "./hooks/useJoystick";
import { LOOK_LERP, ACCEL, DEACCEL, MAX_SPEED } from "./constants";
import { Joystick } from "./components/Joystick";
import { DebugOverlay, type DebugInfo } from "./components/DebugOverlay";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // UI toggles
  const [debugOn, setDebugOn] = useState(false);
  const [lockDrag, setLockDrag] = useState(false);
  const debugOnRef = useRef(false);
  const lockDragRef = useRef(false);
  useEffect(() => { debugOnRef.current = debugOn; }, [debugOn]);
  useEffect(() => { lockDragRef.current = lockDrag; }, [lockDrag]);

  // input
  const keys = useKeys();
  const { JOY_RADIUS, joyActive, joyKnob, joyVec, onJoyStart, onJoyMove, onJoyEnd } = useJoystick();
  useScrollLock(joyActive);

  // debug state
  const [debug, setDebug] = useState<DebugInfo>({ fps: 0, dt: 0, speed: 0, yaw: 0, pitch: 0, px: 0, py: 0, pz: 0 });
  const lastDebugPush = useRef(0);

  // StrictMode guard
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.setProperty("-webkit-touch-callout", "none");

    // --- engine + scene (sync, có placeholder ngay)
    const { engine, scene, camera, player, setLocomotion } = createScene(canvas);
    engine.resize();
    try { scene.render(); } catch { }

    // === Camera state: SEED curPos = vị trí camera hiện tại (fix màn đen đầu)
    const camState: CamState = {
      yaw: 0,
      pitch: -0.12,
      distance: 5.5,
      target: new Vector3(),
      curPos: camera.position.clone(),     // 🔧 quan trọng
      desiredYaw: 0,
      desiredPitch: -0.12,
    };

    const cleanupLook = createLookController({
      canvas,
      camera,
      camState,
      ignorePredicate: (t) => (t as HTMLElement | null)?.closest?.("#joystick") != null,
      shouldAcceptPointer: (ev) => !lockDragRef.current || ev.clientY < window.innerHeight * 0.6,
    });

    const up = new Vector3(0, 1, 0);
    const vel = new Vector3(0, 0, 0);
    const moveDir = new Vector3(0, 0, 0);

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    const loop = () => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

      // smooth look
      const k = 1 - Math.exp(-LOOK_LERP * dt);
      camState.yaw += (camState.desiredYaw - camState.yaw) * k;
      camState.pitch += (camState.desiredPitch - camState.pitch) * k;

      // camera target & desired pos
      camState.target.copyFrom(player.position).addInPlace(new Vector3(0, 0.9, 0));
      const off = new Vector3(
        Math.sin(camState.yaw) * Math.cos(camState.pitch),
        Math.sin(camState.pitch),
        Math.cos(camState.yaw) * Math.cos(camState.pitch)
      ).scale(-camState.distance);
      const desired = camState.target.add(off);

      const camForward = new Vector3(-off.x, 0, -off.z).normalize();
      const camRight = Vector3.Cross(up, camForward).normalize();

      // input combine (refs)
      let iX = joyVec.current.x, iY = joyVec.current.y;
      if (keys.current["w"]) iY += 1;
      if (keys.current["s"]) iY -= 1;
      if (keys.current["a"]) iX -= 1;
      if (keys.current["d"]) iX += 1;
      const mag = Math.hypot(iX, iY);
      if (mag > 1) { iX /= mag; iY /= mag; }

      moveDir.set(0, 0, 0)
        .addInPlace(camForward.scale(iY))
        .addInPlace(camRight.scale(iX));

      if (moveDir.lengthSquared() > 0) {
        moveDir.normalize();
        vel.addInPlace(moveDir.scale(ACCEL * dt));
      } else {
        const sp = vel.length();
        if (sp > 0) {
          const dec = Math.max(sp - DEACCEL * dt, 0);
          vel.normalize().scaleInPlace(dec);
        }
      }
      if (vel.length() > MAX_SPEED) vel.normalize().scaleInPlace(MAX_SPEED);

      player.position.addInPlace(vel.scale(dt));

      // xoay player theo hướng chạy
      const spd = vel.length();
      setLocomotion(spd);

      if (spd > 0.1) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        const curYaw = player.rotation.y;
        let d = targetYaw - curYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        player.rotation.y += d * Math.min(1, dt * 8);
      }

      // camera follow
      Vector3.LerpToRef(camState.curPos, desired, 1 - Math.exp(-dt * 10), camState.curPos);
      camera.position.copyFrom(camState.curPos);
      camera.setTarget(camState.target);

      // debug
      if (debugOnRef.current) {
        const now = performance.now();
        if (now - lastDebugPush.current > 120) {
          lastDebugPush.current = now;
          setDebug({
            fps: engine.getFps(),
            dt,
            speed: vel.length(),
            yaw: camState.yaw,
            pitch: camState.pitch,
            px: player.position.x, py: player.position.y, pz: player.position.z,
          });
        }
      }

      scene.render();
    };

    engine.runRenderLoop(loop);

    // handle context lost/restored
    const onLost = () => engine.stopRenderLoop();
    const onRestored = () => engine.runRenderLoop(loop);
    engine.onContextLostObservable.add(onLost);
    engine.onContextRestoredObservable.add(onRestored);

    return () => {
      engine.onContextLostObservable.removeCallback(onLost);
      engine.onContextRestoredObservable.removeCallback(onRestored);
      window.removeEventListener("resize", onResize);
      cleanupLook();
      engine.stopRenderLoop();
      (scene as any).__cleanupResize?.();
      engine.dispose();
    };
  }, []); // chạy đúng 1 lần (đã có guard)

  return (
    <div
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: "#000", color: "#fff",
        userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
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
    </div>
  );
}
