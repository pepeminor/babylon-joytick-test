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
import { useCombatStore } from "./store/combatStore";
import { useForceLandscape } from "./hooks/useForceLandscape";
import { RotateToLandscape } from "./components/RotateToLandscape";

export default function App() {
  const forceLandscape = useForceLandscape();

  // ⛔ MOBILE + PORTRAIT → KHÔNG LOAD GAME
  if (forceLandscape) {
    return <RotateToLandscape />;
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

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
        debugOnRef,
        lockDragRef,
        keysRef: keys,
        joyVecRef: joyVec,
        lastDebugPushRef,
        lastSentRef,
        setDebug,
        serverSocketRef,
        disconnectServer,
        setSceneState,
      });

      // Nếu component vẫn còn mounted → giữ cleanup
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
        // touchAction: "none",
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

      {/* {weaponDebug && <WeaponDebug weapon={weaponDebug} />} */}
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

async function setupRuntime({
  canvas,
  // debugOnRef,
  lockDragRef,
  keysRef,
  joyVecRef,
  // lastDebugPushRef,
  lastSentRef,
  serverSocketRef,
  disconnectServer,
  setSceneState,
  // setDebug,
}: RuntimeParams) {
  canvas.style.touchAction = "none";
  canvas.style.userSelect = "none";
  canvas.style.setProperty("-webkit-touch-callout", "none");

  const { engine, scene, camera, player, setLocomotion } = await createScene(canvas);
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
    shouldAcceptPointer: (ev) => {
      if (lockDragRef.current) {
        if (typeof ev.clientY !== "number") return true;
        return ev.clientY < window.innerHeight * 0.6;
      }
      return true;
    },
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

  camState.target.copyFrom(player.position).addInPlace(targetOffset);

  const initOff = new Vector3(
    Math.sin(camState.yaw) * Math.cos(camState.pitch),
    Math.sin(camState.pitch),
    Math.cos(camState.yaw) * Math.cos(camState.pitch)
  ).scale(camState.distance);

  camState.curPos.copyFrom(camState.target).addInPlace(initOff);
  camera.position.copyFrom(camState.curPos);
  camera.setTarget(camState.target);

  const CAM_CONFIG = {
    allowFlip: true,              // true = xoay 360
    minPitch: -Math.PI / 2 + 0.05, // gần nhìn thẳng xuống
    maxPitch: Math.PI / 2 - 0.05, // gần nhìn thẳng lên
  };

  let netAccum = 0;


  const loop = () => {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

    // ===== APPLY LOOK CONTROLLER =====
    const k = 1 - Math.exp(-LOOK_LERP * dt);
    camState.yaw += (camState.desiredYaw - camState.yaw) * k;
    camState.pitch += (camState.desiredPitch - camState.pitch) * k;

    // clamp pitch
    // camState.pitch = Math.max(-1.2, Math.min(-0.35, camState.pitch));
    if (CAM_CONFIG.allowFlip) {
      camState.pitch = Math.max(
        CAM_CONFIG.minPitch,
        Math.min(CAM_CONFIG.maxPitch, camState.pitch)
      );
    } else {
      // kiểu Souls / God of War
      camState.pitch = Math.max(-1.2, Math.min(-0.35, camState.pitch));
    }

    // ===== CAMERA TARGET =====
    camState.target.copyFrom(player.position).addInPlace(targetOffset);

    // ===== CAMERA BACK OFFSET (THIRD PERSON) =====
    const radius = camState.distance;

    off.set(
      Math.sin(camState.yaw) * Math.cos(camState.pitch),
      Math.sin(camState.pitch),
      Math.cos(camState.yaw) * Math.cos(camState.pitch)
    ).scaleInPlace(radius);

    // 🔥 QUAN TRỌNG: CAMERA Ở PHÍA SAU → TRỪ OFFSET
    desired.copyFrom(camState.target).subtractInPlace(off);

    // smooth follow
    Vector3.LerpToRef(
      camState.curPos,
      desired,
      1 - Math.exp(-dt * 8),
      camState.curPos
    );

    camera.position.copyFrom(camState.curPos);
    camera.setTarget(camState.target);

    camForward.copyFrom(camState.target)
      .subtractInPlace(camera.position);
    camForward.y = 0;
    camForward.normalize();

    Vector3.CrossToRef(up, camForward, camRight);
    camRight.normalize();

    let iX = joyVecRef.current.x;
    let iY = joyVecRef.current.y;

    if (Math.abs(iX) < 0.05) iX = 0;
    if (Math.abs(iY) < 0.05) iY = 0;

    if (keysRef.current["w"]) iY += 1;
    if (keysRef.current["s"]) iY -= 1;
    if (keysRef.current["a"]) iX -= 1;
    if (keysRef.current["d"]) iX += 1;

    const mag = Math.hypot(iX, iY);
    if (mag > 1) {
      iX /= mag;
      iY /= mag;
    }

    if (!(player as any).isAttacking?.()) {
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
    } else {
      vel.setAll(0);
    }

    vel.scaleToRef(dt, scaledVel);
    player.position.addInPlace(scaledVel);

    netAccum += dt;

    if (
      serverSocketRef.current &&
      serverSocketRef.current.readyState === WebSocket.OPEN &&
      netAccum > 0.1 && // 10 lần / giây
      !(player as any).isAttacking?.()
    ) {
      netAccum = 0;

      const cur = {
        x: player.position.x,
        y: 0,
        z: player.position.z,
        yaw: player.rotation.y,
        state: vel.length() > 0.1 ? "run" : "idle",
      };

      const last = lastSentRef.current;

      const moved =
        Math.hypot(cur.x - last.x, cur.z - last.z) > 0.01 ||
        Math.abs(cur.yaw - last.yaw) > 0.02 ||
        cur.state !== last.state;

      if (moved) {
        console.log(moved)
        sendUpdate(serverSocketRef.current, player.id, {
          pos: [cur.x, 0, cur.z],
          yaw: cur.yaw,
          action: cur.state,
        });

        lastSentRef.current = cur;
      }
    }

    const spd = vel.length();
    setLocomotion(spd);

    if (spd > 0.05) {
      const targetYaw = Math.atan2(vel.x, vel.z);
      let d = targetYaw - player.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.rotation.y += d * Math.min(1, dt * 8);
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
