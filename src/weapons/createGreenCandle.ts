import {
    MeshBuilder,
    TransformNode,
    Scene,
    Color3,
    PBRMaterial,
    GlowLayer
} from "@babylonjs/core";
export type CandleChartConfig = {
    handle: {
        height: number;
        diameter: number;
    };

    candle: {
        open: number;   // Open price
        close: number;  // Close price
        high: number;   // High
        low: number;    // Low

        width: number;

        colorUp: Color3;    // Green
        colorDown: Color3;  // Red

        emissiveUp: Color3;
        emissiveDown: Color3;

        emissiveStrength: number;
    };

    head: {
        height: number;
        width: number;
        emissive: Color3;
        emissiveStrength: number;
    };

    glowIntensity: number;
};

export function createCandleChartWeapon(
    scene: Scene,
    cfg: CandleChartConfig
): TransformNode {

    const root = new TransformNode("candleChartWeapon", scene);

    /* -------------------------------------------
       HANDLE
    ------------------------------------------- */
    const handle = MeshBuilder.CreateCylinder(
        "handle",
        { height: cfg.handle.height, diameter: cfg.handle.diameter },
        scene
    );

    const handleMat = new PBRMaterial("handleMat", scene);
    handleMat.albedoColor = new Color3(0.15, 0.15, 0.15);
    handleMat.emissiveColor = cfg.candle.open < cfg.candle.close
        ? cfg.candle.emissiveUp
        : cfg.candle.emissiveDown;

    handle.material = handleMat;
    handle.position.y = -cfg.handle.height * 0.5;
    handle.parent = root;

    /* -------------------------------------------
       CALCULATE CANDLE DATA
    ------------------------------------------- */
    const isBull = cfg.candle.close >= cfg.candle.open;

    const bodyTop = isBull ? cfg.candle.close : cfg.candle.open;
    const bodyBottom = isBull ? cfg.candle.open : cfg.candle.close;

    const bodyHeight = Math.max(bodyTop - bodyBottom, 0.02);
    const wickUpHeight = Math.max(cfg.candle.high - bodyTop, 0.01);
    const wickDownHeight = Math.max(bodyBottom - cfg.candle.low, 0.01);

    const color = isBull ? cfg.candle.colorUp : cfg.candle.colorDown;
    const emissive = isBull ? cfg.candle.emissiveUp : cfg.candle.emissiveDown;

    /* -------------------------------------------
       WICK UP
    ------------------------------------------- */
    const wickUp = MeshBuilder.CreateCylinder(
        "wickUp",
        { height: wickUpHeight, diameter: cfg.candle.width * 0.25 },
        scene
    );

    wickUp.position.y = bodyTop + wickUpHeight * 0.5;
    wickUp.material = new PBRMaterial("wickUpMat", scene);
    // wickUp.material.emissiveColor = emissive.scale(0.6);
    wickUp.parent = root;

    /* -------------------------------------------
       BODY
    ------------------------------------------- */
    const body = MeshBuilder.CreateBox(
        "body",
        {
            height: bodyHeight,
            width: cfg.candle.width,
            depth: cfg.candle.width,
        },
        scene
    );

    const bodyMat = new PBRMaterial("bodyMat", scene);
    bodyMat.albedoColor = color;
    bodyMat.emissiveColor = emissive.scale(cfg.candle.emissiveStrength);
    bodyMat.roughness = 0.25;

    body.material = bodyMat;
    body.position.y = bodyBottom + bodyHeight * 0.5;
    body.parent = root;

    /* -------------------------------------------
       WICK DOWN
    ------------------------------------------- */
    const wickDown = MeshBuilder.CreateCylinder(
        "wickDown",
        { height: wickDownHeight, diameter: cfg.candle.width * 0.25 },
        scene
    );

    wickDown.position.y = bodyBottom - wickDownHeight * 0.5;
    wickDown.material = new PBRMaterial("wickDownMat", scene);
    // wickDown.material.emissiveColor = emissive.scale(0.6);
    wickDown.parent = root;

    /* -------------------------------------------
       HEAD – POWER ZONE
    ------------------------------------------- */
    const head = MeshBuilder.CreateBox(
        "head",
        { height: cfg.head.height, width: cfg.head.width, depth: cfg.head.width },
        scene
    );

    const headMat = new PBRMaterial("headMat", scene);
    headMat.emissiveColor =
        cfg.head.emissive.scale(cfg.head.emissiveStrength);
    headMat.roughness = 0.05;

    head.material = headMat;
    head.position.y = cfg.candle.high + cfg.head.height * 0.5;
    head.parent = root;

    /* -------------------------------------------
       GLOW
    ------------------------------------------- */
    const glow = new GlowLayer("weaponGlow", scene);
    glow.intensity = cfg.glowIntensity;

    glow.addIncludedOnlyMesh(handle);
    glow.addIncludedOnlyMesh(body);
    glow.addIncludedOnlyMesh(wickUp);
    glow.addIncludedOnlyMesh(wickDown);
    glow.addIncludedOnlyMesh(head);

    root.position.y = -0.45;

    return root;
}
