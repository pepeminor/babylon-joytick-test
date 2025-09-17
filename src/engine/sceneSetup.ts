import { Engine, Scene, FreeCamera, HemisphericLight, DirectionalLight, Vector3, Color4, Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";

export function setupScene(canvas: HTMLCanvasElement) {
    const engine = new Engine(canvas, true, {
        antialias: true, stencil: true, preserveDrawingBuffer: false,
        powerPreference: "high-performance",
    });

    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engine.setHardwareScalingLevel(1 / dpr);
        engine.resize(true);
    };
    resize();
    window.addEventListener("resize", resize);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.06, 0.07, 0.09, 1);

    const camera = new FreeCamera("cam", new Vector3(0, 1.6, 8), scene);
    camera.minZ = 0.01; camera.maxZ = 500;
    camera.setTarget(new Vector3(0, 0.9, 0));

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
    dir.position = new Vector3(8, 12, 6);
    dir.intensity = 0.9;

    const ground = MeshBuilder.CreateGround("ground", { width: 400, height: 400 }, scene);
    const gmat = new StandardMaterial("gmat", scene);
    gmat.diffuseColor = new Color3(0.06, 0.07, 0.09);
    gmat.specularColor = new Color3(0, 0, 0);
    gmat.emissiveColor = new Color3(0.06, 0.07, 0.09);
    ground.material = gmat;
    ground.freezeWorldMatrix();

    return { engine, scene, camera };
}
