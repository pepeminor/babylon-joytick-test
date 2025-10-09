import { useEffect, useRef, useState } from "react";
import { Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { createScene } from "./engine/createScene";
import { createLookController, type CamState } from "./controls/createLookController";
import { useKeys } from "./hooks/useKeys";
import { useScrollLock } from "./hooks/useScrollLock";
import { useJoystick } from "./hooks/useJoystick";
import { Joystick } from "./components/Joystick";
import { DebugOverlay, type DebugInfo } from "./components/DebugOverlay";
import { sendUpdate } from "./network/connectGameServer";
import { useGameServer } from "./hooks/useGameServer";
import { ACCEL, DEACCEL, LOOK_LERP, MAX_SPEED } from "./config";

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
  const lastDebugPushRef = useRef(0);
  const startedRef = useRef(false);
  const [sceneState, setSceneState] = useState<Scene | null>(null);
  const {socketRef: serverSocketRef, error: serverError, disconnect: disconnectServer} = useGameServer(sceneState);
  const lastSentRef = useRef<{ x: number; y: number; z: number; yaw: number; state: string }>({
    x: 0, y: 0, z: 0, yaw: 0, state: "idle",
  });

  useEffect(() => {
    if (serverError) {
      console.error("❌ Game server error:", serverError);
    }
  }, [serverError]);

  useEffect(() => {
    if (startedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    startedRef.current = true;
    const cleanup = setupRuntime({
      canvas,
      debugOnRef,
      lockDragRef,
      keysRef: keys,
      joyVecRef: joyVec,
      setDebug,
      lastDebugPushRef,
      lastSentRef,
      serverSocketRef,
      disconnectServer,
      setSceneState,
    });

    return cleanup;
  }, [disconnectServer, keys, joyVec, serverSocketRef, setDebug, setSceneState]);

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

type RefHolder<T> = { current: T };

type RuntimeParams = {
  canvas: HTMLCanvasElement;
  debugOnRef: RefHolder<boolean>;
  lockDragRef: RefHolder<boolean>;
  keysRef: RefHolder<Record<string, boolean>>;
  joyVecRef: RefHolder<Vector3>;
  setDebug: (info: DebugInfo) => void;
  lastDebugPushRef: RefHolder<number>;
  lastSentRef: RefHolder<{ x: number; y: number; z: number; yaw: number; state: string }>;
  serverSocketRef: RefHolder<WebSocket | null>;
  disconnectServer: (code?: number, reason?: string) => void;
  setSceneState: (scene: Scene | null | ((prev: Scene | null) => Scene | null)) => void;
};

function setupRuntime({
  canvas,
  debugOnRef,
  lockDragRef,
  keysRef,
  joyVecRef,
  setDebug,
  lastDebugPushRef,
  lastSentRef,
  serverSocketRef,
  disconnectServer,
  setSceneState,
}: RuntimeParams) {
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.setProperty("-webkit-touch-callout", "none");

  const {engine, scene, camera, player, setLocomotion} = createScene(canvas);
  engine.resize();
  try {
    scene.render();
  } catch {
    // ignore initial render failure (scene may not be ready yet)
  }
  setSceneState(scene);

  const camState: CamState = {
    yaw: 0,
    pitch: -0.12,
    distance: 5.5,
    target: new Vector3(),
    curPos: camera.position.clone(),
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
  const moveContribution = new Vector3(0, 0, 0);
  const targetOffset = new Vector3(0, 0.9, 0);
  const off = new Vector3(0, 0, 0);
  const desired = new Vector3(0, 0, 0);
  const camForward = new Vector3(0, 0, 0);
  const camRight = new Vector3(0, 0, 0);
  const scaledVel = new Vector3(0, 0, 0);

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  let accum = 0;

  const loop = () => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

    accum += dt;
    const k = 1 - Math.exp(-LOOK_LERP * dt);
    camState.yaw += (camState.desiredYaw - camState.yaw) * k;
    camState.pitch += (camState.desiredPitch - camState.pitch) * k;

    camState.target.copyFrom(player.position).addInPlace(targetOffset);
    off.set(
      Math.sin(camState.yaw) * Math.cos(camState.pitch),
      Math.sin(camState.pitch),
      Math.cos(camState.yaw) * Math.cos(camState.pitch),
    );
    off.scaleInPlace(-camState.distance);
    desired.copyFrom(camState.target).addInPlace(off);

    camForward.set(-off.x, 0, -off.z).normalize();
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
      moveContribution.copyFrom(moveDir).scaleInPlace(ACCEL * dt);
      vel.addInPlace(moveContribution);
    } else {
      const sp = vel.length();
      if (sp > 0) {
        const dec = Math.max(sp - DEACCEL * dt, 0);
        vel.normalize().scaleInPlace(dec);
      }
    }
    if (vel.length() > MAX_SPEED) vel.normalize().scaleInPlace(MAX_SPEED);

    vel.scaleToRef(dt, scaledVel);
    player.position.addInPlace(scaledVel);

    const spd = vel.length();
    setLocomotion(spd);

    if (spd > 0.1) {
      const targetYaw = Math.atan2(vel.x, vel.z);
      const curYaw = player.rotation.y;
      let d = targetYaw - curYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.rotation.y += d * Math.min(1, dt * 8);
    }

    if (serverSocketRef.current && accum > 0.1) {
      accum = 0;

      const cur = {
        x: player.position.x,
        y: 0,
        z: player.position.z,
        yaw: player.rotation.y,
        state: spd > 0.1 ? "run" : "idle",
      };

      const last = lastSentRef.current;
      const moved =
        Math.hypot(cur.x - last.x, cur.y - last.y, cur.z - last.z) > 0.01 ||
        Math.abs(cur.yaw - last.yaw) > 0.02 ||
        cur.state !== last.state;

      if (moved) {
        sendUpdate(serverSocketRef.current, player.id, {
          pos: [cur.x, 0, cur.z],
          yaw: cur.yaw,
          action: cur.state,
        });
        lastSentRef.current = cur;
      }
    }

    Vector3.LerpToRef(camState.curPos, desired, 1 - Math.exp(-dt * 10), camState.curPos);
    camera.position.copyFrom(camState.curPos);
    camera.setTarget(camState.target);

    if (debugOnRef.current) {
      const now = performance.now();
      if (now - lastDebugPushRef.current > 120) {
        lastDebugPushRef.current = now;
        setDebug({
          fps: engine.getFps(),
          dt,
          speed: vel.length(),
          yaw: camState.yaw,
          pitch: camState.pitch,
          px: player.position.x,
          py: player.position.y,
          pz: player.position.z,
        });
      }
    }

    scene.render();
  };

  engine.runRenderLoop(loop);

  const onLost = () => engine.stopRenderLoop();
  const onRestored = () => engine.runRenderLoop(loop);
  engine.onContextLostObservable.add(onLost);
  engine.onContextRestoredObservable.add(onRestored);

  return () => {
    disconnectServer(1000, "scene disposed");
    setSceneState((prev: Scene | null) => (prev === scene ? null : prev));
    engine.onContextLostObservable.removeCallback(onLost);
    engine.onContextRestoredObservable.removeCallback(onRestored);
    window.removeEventListener("resize", onResize);
    cleanupLook();
    engine.stopRenderLoop();
    (scene as any).__cleanupResize?.();
    engine.dispose();
  };
}
