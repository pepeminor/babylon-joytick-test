import React, { useEffect, useRef, useState } from "react";
import {
  Engine, Scene, Vector3, Color3,
  FreeCamera, HemisphericLight, DirectionalLight,
  MeshBuilder, StandardMaterial
} from "babylonjs";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ====== JOYSTICK ======
  const JOY_RADIUS = 70;
  const JOY_DEADZONE = 6;
  const [joyActive, setJoyActive] = useState(false);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number } | null>(null);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyVec = useRef(new Vector3(0, 0, 0)); // dùng x (trái/phải), y (tiến/lui)

  // Multi-touch: tách pointer cho joystick & camera
  const joyPointerId = useRef<number | null>(null);
  const camPointerId = useRef<number | null>(null);
  const lastDrag = useRef<{ x: number; y: number } | null>(null);

  // WASD desktop
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // iOS: khi đang kéo joystick -> khóa scroll/gesture
  useEffect(() => {
    if (!joyActive) return;
    const prev = {
      ob: document.body.style.overscrollBehavior,
      ta: document.documentElement.style.touchAction,
    };
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.touchAction = "none";
    const noScroll = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", noScroll, { passive: false });
    return () => {
      document.body.style.overscrollBehavior = prev.ob;
      document.documentElement.style.touchAction = prev.ta;
      document.removeEventListener("touchmove", noScroll);
    };
  }, [joyActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    canvas.style.setProperty("-webkit-touch-callout", "none");

    // ===== Babylon: Engine + Scene =====
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
    const scene = new Scene(engine);

    // ===== Camera (tự điều khiển) =====
    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 6), scene);
    camera.minZ = 0.01; camera.maxZ = 500;

    // ===== Lights =====
    new HemisphericLight("hemi", new Vector3(0, 1, 0), scene).intensity = 0.65;
    const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
    dir.position = new Vector3(8, 12, 6);
    dir.intensity = 1.0;

    // ===== Ground =====
    const ground = MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
    const gmat = new StandardMaterial("gmat", scene);
    gmat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    gmat.specularColor = new Color3(0, 0, 0);
    ground.material = gmat;

    // ===== Player (cube) =====
    const player = MeshBuilder.CreateBox("player", { size: 1.2 }, scene);
    const pmat = new StandardMaterial("pmat", scene);
    pmat.diffuseColor = new Color3(1, 0.18, 0.18);
    player.material = pmat;
    player.position = new Vector3(0, 0.6, 0);

    // props rải rác
    for (let i = 0; i < 40; i++) {
      const s = 0.3 + Math.random() * 0.8;
      const box = MeshBuilder.CreateBox("b" + i, { width: s, height: s, depth: s }, scene);
      const m = new StandardMaterial("bm" + i, scene);
      m.diffuseColor = new Color3(0.41, 0.82, 0.57);
      box.material = m;
      const r = 40 + Math.random() * 80;
      const t = Math.random() * Math.PI * 2;
      box.position = new Vector3(Math.cos(t) * r, s / 2, Math.sin(t) * r);
    }

    // ===== Third-person camera follow (smooth) =====
    const camState = {
      yaw: 0,
      pitch: -0.12,
      distance: 5.5,
      target: new Vector3(),
      curPos: new Vector3(),
      desiredYaw: 0,
      desiredPitch: -0.12,
    };
    const LOOK_SENS = 0.0032;
    const LOOK_LERP = 18;
    const PITCH_MIN = -Math.PI / 2 + 0.05;
    const PITCH_MAX = 0.6;

    // ===== Camera drag (multi-touch safe) =====
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("#joystick")) return;
      if (camPointerId.current === null) {
        e.preventDefault();
        camPointerId.current = e.pointerId;
        lastDrag.current = { x: e.clientX, y: e.clientY };
        el.setPointerCapture?.(e.pointerId);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (camPointerId.current !== e.pointerId || !lastDrag.current) return;
      e.preventDefault();
      const dx = e.clientX - lastDrag.current.x;
      const dy = e.clientY - lastDrag.current.y;
      lastDrag.current = { x: e.clientX, y: e.clientY };
      camState.desiredYaw -= dx * LOOK_SENS;
      camState.desiredPitch -= dy * LOOK_SENS;
      camState.desiredPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, camState.desiredPitch));
    };
    const releaseCam = () => { camPointerId.current = null; lastDrag.current = null; };
    const onPointerUp = (e: PointerEvent) => { if (camPointerId.current === e.pointerId) releaseCam(); };
    const onPointerCancel = (e: PointerEvent) => { if (camPointerId.current === e.pointerId) releaseCam(); };

    canvas.addEventListener("pointerdown", onPointerDown as any, { passive: false });
    window.addEventListener("pointermove", onPointerMove as any, { passive: false });
    window.addEventListener("pointerup", onPointerUp as any, { passive: false });
    window.addEventListener("pointercancel", onPointerCancel as any, { passive: false });

    // ===== Resize =====
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    // ===== Movement params =====
    const up = new Vector3(0, 1, 0);
    const vel = new Vector3(0, 0, 0);
    const moveDir = new Vector3(0, 0, 0);
    const ACCEL = 18, DEACCEL = 14, MAX_SPEED = 5.5;

    // ===== Main loop =====
    engine.runRenderLoop(() => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

      // Smooth look
      const k = 1 - Math.exp(-LOOK_LERP * dt);
      camState.yaw += (camState.desiredYaw - camState.yaw) * k;
      camState.pitch += (camState.desiredPitch - camState.pitch) * k;

      // Camera target & desired pos
      camState.target.copyFrom(player.position).addInPlace(new Vector3(0, 0.9, 0));
      const off = new Vector3(
        Math.sin(camState.yaw) * Math.cos(camState.pitch),
        Math.sin(camState.pitch),
        Math.cos(camState.yaw) * Math.cos(camState.pitch)
      ).scale(-camState.distance);
      const desired = camState.target.add(off);

      // ===== Hướng theo camera (đÃ FIX PHẢI/TRÁI) =====
      const camForward = new Vector3(-off.x, 0, -off.z).normalize();
      // RIGHT = UP × FORWARD (đúng chiều tay phải)
      const camRight = Vector3.Cross(up, camForward).normalize();

      // Input (joystick + WASD)
      let iX = joyVec.current.x;
      let iY = joyVec.current.y;
      if (keys.current["w"]) iY += 1;
      if (keys.current["s"]) iY -= 1;
      if (keys.current["a"]) iX -= 1;
      if (keys.current["d"]) iX += 1;
      // clamp độ dài
      let len = Math.hypot(iX, iY);
      if (len > 1) { iX /= len; iY /= len; }

      moveDir.copyFromFloats(0, 0, 0)
        .addInPlace(camForward.scale(iY))   // lên/xuống
        .addInPlace(camRight.scale(iX));    // trái/phải

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

      // update player
      player.position.addInPlace(vel.scale(dt));

      // xoay player theo hướng di chuyển (mượt)
      const spd = vel.length();
      if (spd > 0.1) {
        const targetYaw = Math.atan2(vel.x, vel.z);
        const curYaw = player.rotation.y;
        let d = targetYaw - curYaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        player.rotation.y += d * Math.min(1, dt * 8);
      }

      // camera mượt
      Vector3.LerpToRef(camState.curPos, desired, 1 - Math.exp(-dt * 10), camState.curPos);
      camera.position.copyFrom(camState.curPos);
      camera.setTarget(camState.target);

      // (bỏ xoay cube cho đỡ rối)
      // player.rotation.x += 0.2 * dt;

      scene.render();
    });

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown as any);
      window.removeEventListener("pointermove", onPointerMove as any);
      window.removeEventListener("pointerup", onPointerUp as any);
      window.removeEventListener("pointercancel", onPointerCancel as any);
      engine.dispose();
    };
  }, []);

  // ====== JOYSTICK HANDLERS ======
  const onJoyStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (joyPointerId.current !== null && joyPointerId.current !== e.pointerId) return;
    joyPointerId.current = e.pointerId;

    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - joyOrigin.current.x;
    const dy = y - joyOrigin.current.y;

    // clamp theo bán kính
    const len = Math.hypot(dx, dy);
    const r = JOY_RADIUS;
    const scale = len > r ? r / len : 1;
    const cx = dx * scale, cy = dy * scale;

    setJoyKnob({ x: joyOrigin.current.x + cx, y: joyOrigin.current.y + cy });

    // chuẩn hóa [-1..1], y ngược (kéo lên = tiến)
    const nx = cx / r;
    const ny = -cy / r;
    const mag = Math.hypot(nx, ny);
    if (mag < JOY_DEADZONE / r) {
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

  const safeBottom = "env(safe-area-inset-bottom, 0px)";

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
        touchAction: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      />

      <div style={{
        position: "fixed", left: 12, top: 12, zIndex: 20,
        padding: "6px 10px", borderRadius: 10, background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.15)", fontSize: 12,
        pointerEvents: "none",
      }}>
        Drag để xoay camera • Joystick để di chuyển • WASD (desktop)
      </div>

      {/* JOYSTICK */}
      <div
        id="joystick"
        onPointerDown={onJoyStart}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyEnd}
        onPointerCancel={onJoyEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: `calc(12vh + ${safeBottom} + 8px)`,
          width: JOY_RADIUS * 2 + 16,
          height: JOY_RADIUS * 2 + 16,
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
        {joyKnob && (
          <div style={{
            position: "absolute",
            left: joyKnob.x, top: joyKnob.y,
            width: 56, height: 56, borderRadius: 999,
            transform: "translate(-50%,-50%)",
            background: "rgba(255,255,255,.25)",
            border: "1px solid rgba(255,255,255,.55)",
            backdropFilter: "blur(4px)",
            touchAction: "none",
          }} />
        )}
        {!joyActive && (
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
    </div>
  );
}
