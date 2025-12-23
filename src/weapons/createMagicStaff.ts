import {
    MeshBuilder,
    TransformNode,
    Scene,
    Color3,
    Vector3,
    PBRMaterial,
    GlowLayer,
    ParticleSystem,
    Texture,
    Color4,
    StandardMaterial
} from "@babylonjs/core";

export function createMagicStaff(scene: Scene): TransformNode {
    const root = new TransformNode("magicStaff", scene);

    // --------------------------------------------------------
    // 1) STAFF BODY (wood + metal highlight)
    // --------------------------------------------------------
    const body = MeshBuilder.CreateCylinder(
        "staffBody",
        { height: 1, diameterTop: 0.06, diameterBottom: 0.08 },
        scene
    );

    const bodyMat = new PBRMaterial("staffMat", scene);
    bodyMat.albedoColor = new Color3(0.35, 0.22, 0.12); // brown wood
    bodyMat.metallic = 0.2;
    bodyMat.roughness = 0.7;
    body.material = bodyMat;
    body.parent = root;

    // --------------------------------------------------------
    // 2) MAGIC ORB (Elden Ring glowing orb)
    // --------------------------------------------------------
    const orb = MeshBuilder.CreateSphere("staffOrb", { diameter: 0.24 }, scene);

    const orbMat = new PBRMaterial("orbMat", scene);
    orbMat.albedoColor = new Color3(0.3, 0.6, 1.0);
    orbMat.emissiveColor = new Color3(1, 0.9, 1.0); // glowing
    orbMat.metallic = 0.0;
    orbMat.roughness = 0.2;
    orb.material = orbMat;

    orb.position.y = 0.55;
    orb.parent = root;

    // --------------------------------------------------------
    // 3) GLOW EFFECT (tăng độ sáng của orb)
    // --------------------------------------------------------
    const glow = new GlowLayer("glow", scene, {
        blurKernelSize: 16,
    });
    glow.intensity = 2;

    // --------------------------------------------------------
    // 4) PARTICLES (magic dust like Elden Ring)
    // --------------------------------------------------------
    const ps = new ParticleSystem("magicParticles", 200, scene);

    ps.particleTexture = new Texture("/public/textures/flare-mini.png", scene);
    ps.emitter = orb;

    ps.minSize = 0.08;
    ps.maxSize = 0.12;

    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 0.7;

    ps.emitRate = 160;
    ps.updateSpeed = 0.02;

    ps.minEmitPower = 0.05;
    ps.maxEmitPower = 0.15;

    // ps.color1 = new Color4(1.0, 0.6, 0.2, 1);
    // ps.color2 = new Color4(1.0, 0.3, 0.0, 22);

    // blue elden ring
    ps.color1 = new Color4(0.4, 0.8, 1.0, 1);
    ps.color2 = new Color4(0.1, 0.3, 0.9, 0.8);

    // orange burn
    // ps.color1 = new Color4(1.0, 0.6, 0.2, 1);
    // ps.color2 = new Color4(1.0, 0.3, 0.0, 1);

    //purple
    // ps.color1 = new Color4(0.7, 0.3, 1.0, 1);
    // ps.color2 = new Color4(0.4, 0.1, 0.7, 0.8);

    ps.direction1 = new Vector3(-1, 1, -1);
    ps.direction2 = new Vector3(1, 1, 1);

    ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // ps.start();

    // --------------------------------------------------------
    // 5) ORB ANIMATION — pulsing effect
    // --------------------------------------------------------
    scene.onBeforeRenderObservable.add(() => {
        const t = performance.now() * 0.002;
        const pulse = 0.4 + Math.sin(t) * 0.3;

        orb.scaling.setAll(1 + pulse * 0.05);
        orbMat.emissiveColor = new Color3(0.4 + pulse * 0.3, 0.7 + pulse * 0.3, 1.0);
    });

    // --------------------------------------------------------
    // 6) Staff pivot adjustment
    // --------------------------------------------------------
    root.position.y = -0.5;

    // --------------------------------------------------------
    // 7) WEAPON HITBOX (INTERNAL, SAFE)
    // --------------------------------------------------------
    const hitbox = MeshBuilder.CreateBox(
        "staffHitbox",
        { width: 0.25, height: 1.0, depth: 0.25 },
        // { width: 0, height: 0, depth: 0 },
        scene
    );

    // gắn vào root của staff
    hitbox.parent = root;

    // vị trí dọc thân gậy
    hitbox.position.y = 0.2;

    // DEBUG
    const hitMat = new StandardMaterial("staffHitboxMat", scene);
    // hitMat.emissiveColor = new Color3(0, 0, 0);
    hitMat.emissiveColor = new Color3(1, 1, 0);
    hitMat.wireframe = true;
    hitMat.disableLighting = true;
    hitbox.material = hitMat;
    hitbox.isVisible = false; // set true when want to see a box collision

    // // mặc định TẮT (combat mới bật)
    hitbox.setEnabled(false);

    // // expose ra ngoài
    (root as any).weaponHitbox = hitbox;


    return root;
}