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

export type MagicStaffOptions = {
    enableFx?: boolean;
};

export function createMagicStaff(scene: Scene, options?: MagicStaffOptions): TransformNode {
    const enableFx = options?.enableFx ?? false;
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
    // 3) GLOW EFFECT (increase the orb brightness)
    // --------------------------------------------------------
    let glow: GlowLayer | null = null;
    if (enableFx) {
        glow = new GlowLayer("glow", scene, {
            blurKernelSize: 16,
        });
        glow.intensity = 2;
    }

    // --------------------------------------------------------
    // 4) PARTICLES (magic dust like Elden Ring)
    // --------------------------------------------------------
    let ps: ParticleSystem | null = null;
    if (enableFx) {
        ps = new ParticleSystem("magicParticles", 200, scene);
        ps.particleTexture = new Texture("/textures/flare-mini.png", scene);
        ps.emitter = orb;

        ps.minSize = 0.08;
        ps.maxSize = 0.12;

        ps.minLifeTime = 0.4;
        ps.maxLifeTime = 0.7;

        ps.emitRate = 160;
        ps.updateSpeed = 0.02;

        ps.minEmitPower = 0.05;
        ps.maxEmitPower = 0.15;

        // Blue Elden Ring-style particles.
        ps.color1 = new Color4(0.4, 0.8, 1.0, 1);
        ps.color2 = new Color4(0.1, 0.3, 0.9, 0.8);

        ps.direction1 = new Vector3(-1, 1, -1);
        ps.direction2 = new Vector3(1, 1, 1);
        ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    }

    // --------------------------------------------------------
    // 5) ORB ANIMATION — pulsing effect
    // --------------------------------------------------------
    let beforeRenderToken: any = null;
    if (enableFx) {
        beforeRenderToken = scene.onBeforeRenderObservable.add(() => {
            const t = performance.now() * 0.002;
            const pulse = 0.4 + Math.sin(t) * 0.3;

            orb.scaling.setAll(1 + pulse * 0.05);
            orbMat.emissiveColor = new Color3(0.4 + pulse * 0.3, 0.7 + pulse * 0.3, 1.0);
        });
    }

    // --------------------------------------------------------
    // 6) Staff pivot adjustment
    // --------------------------------------------------------
    root.position.y = -0.5;

    // --------------------------------------------------------
    // 7) WEAPON HITBOX (internal, safe)
    // --------------------------------------------------------
    const hitbox = MeshBuilder.CreateBox(
        "staffHitbox",
        { width: 0.25, height: 1.0, depth: 0.25 },
        // { width: 0, height: 0, depth: 0 },
        scene
    );

    // Attach to the staff root.
    hitbox.parent = root;

    // Position along the staff shaft.
    hitbox.position.y = 0.2;

    // DEBUG
    const hitMat = new StandardMaterial("staffHitboxMat", scene);
    // hitMat.emissiveColor = new Color3(0, 0, 0);
    hitMat.emissiveColor = new Color3(1, 1, 0);
    hitMat.wireframe = true;
    hitMat.disableLighting = true;
    hitbox.material = hitMat;
    hitbox.isVisible = false; // Set to true when you want to see the collision box.

    // Default OFF (enabled by combat state).
    hitbox.setEnabled(false);

    // Expose externally.
    (root as any).weaponHitbox = hitbox;
    (root as any).__disposeWeaponFx = () => {
        if (beforeRenderToken) {
            scene.onBeforeRenderObservable.remove(beforeRenderToken);
            beforeRenderToken = null;
        }
        ps?.dispose();
        glow?.dispose();
    };


    return root;
}
