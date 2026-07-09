// sceneSetup.ts
import {
  Engine,
  Scene,
  FreeCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color4,
  Color3,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Layer,
  ShaderMaterial,
} from "@babylonjs/core";

export function setupScene(
  canvas: HTMLCanvasElement,
  options?: { maxDevicePixelRatio?: number }
) {
  // --- Engine ---
  const engine = new Engine(canvas, true, {
    antialias: true,
    stencil: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, options?.maxDevicePixelRatio ?? 2);
    engine.setHardwareScalingLevel(1 / dpr);
    engine.resize(true);
  };
  resize();
  window.addEventListener("resize", resize);
  const cleanupResize = () => {
    window.removeEventListener("resize", resize);
  };

  // --- Scene ---
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.06, 0.07, 0.09, 1);

  // --- Camera ---
  const camera = new FreeCamera("cam", new Vector3(0, 1.6, 8), scene);
  camera.minZ = 0.01;
  camera.maxZ = 2000;
  camera.setTarget(new Vector3(0, 0.9, 0));

  // --- Lights ---
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.55;
  const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
  dir.position = new Vector3(8, 12, 6);
  dir.intensity = 0.9;

  // --- Ground: neon grid ---
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 400, height: 400 },
    scene
  );
  const gmat = new StandardMaterial("gmat", scene);
  const gridTex = new Texture("/textures/neon-grid.png", scene);
  gridTex.uScale = 20;
  gridTex.vScale = 20;
  gmat.emissiveTexture = gridTex;
  gmat.diffuseColor = Color3.Black();
  gmat.specularColor = Color3.Black();
  ground.material = gmat;
  ground.freezeWorldMatrix();
  ground.renderingGroupId = 0; // ground & player > sun

  // --- Sky (background image) ---
  new Layer("sky", "/textures/retro-sky.jpg", scene, true);

  // --- Sun with a procedural glow shader ---
  const sun = MeshBuilder.CreateDisc(
    "sun",
    { radius: 110, tessellation: 64 },
    scene
  );
  sun.position = new Vector3(0, 120, 900);
  sun.renderingGroupId = 0;

  const sunShader = new ShaderMaterial(
    "sunShader",
    scene,
    {
      vertexSource: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 worldViewProjection;
      varying vec2 vUV;
      void main(void) {
        gl_Position = worldViewProjection * vec4(position, 1.0);
        vUV = uv;
      }
    `,
      fragmentSource: `
      precision highp float;
      varying vec2 vUV;

      void main(void) {
        // Map vUV from [0..1] to [-1..1].
        vec2 p = vUV * 2.0 - 1.0;
        float r = length(p);

        // Discard pixels outside the circle.
        if (r > 1.0) discard;

        // Yellow -> orange -> pink gradient.
        float y = vUV.y;
        vec3 top = vec3(1.0, 0.85, 0.25);
        vec3 mid = vec3(1.0, 0.55, 0.20);
        vec3 bot = vec3(1.0, 0.25, 0.55);
        vec3 color = mix(bot, mid, smoothstep(0.0, 0.5, y));
        color = mix(color, top, smoothstep(0.5, 1.0, y));

        // Horizontal stripes.
        float bands = step(0.5, fract(y * 18.0));
        color *= (1.0 - 0.55 * bands);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    },
    {
      attributes: ["position", "uv"],
      uniforms: ["worldViewProjection"],
    }
  );

  // Disable blending and depth writes.
  sunShader.alphaMode = Engine.ALPHA_DISABLE;
  sunShader.needAlphaBlending = () => false;
  sunShader.backFaceCulling = false;
  sunShader.disableDepthWrite = true;

  sun.material = sunShader;

  // --- Subtle blue-purple fog ---
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.015;
  scene.fogColor = new Color3(0.1, 0.05, 0.2);

  (scene as any).__cleanupResize = cleanupResize;

  return { engine, scene, camera, sun };
}
