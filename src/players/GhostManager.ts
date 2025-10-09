import {
  Scene,
  Vector3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

type Ghost = { mesh: Mesh };

export type GhostManager = ReturnType<typeof createGhostManager>;

export function createGhostManager(scene: Scene) {
  const ghosts: Record<string, Ghost> = {};

  function spawn(id: string, pos: Vector3) {
    if (ghosts[id]) return;

    const parent = new Mesh("ghostRoot_" + id, scene);
    parent.position.copyFrom(pos);

    for (let i = 0; i < 3; i++) {
      const cube = MeshBuilder.CreateBox(
        "ghostCube_" + id + "_" + i,
        { size: 0.14 },
        scene
      );
      cube.parent = parent;

      const mat = new StandardMaterial("ghostMat_" + id + "_" + i, scene);
      mat.emissiveColor = new Color3(0.6, 1, 0.6);
      mat.alpha = 0.6;
      cube.material = mat;

      cube.metadata = { phase: Math.random() * Math.PI * 2 };
    }

    ghosts[id] = { mesh: parent };
  }

  function remove(id: string) {
    const g = ghosts[id];
    if (!g) return;

    g.mesh.getChildMeshes().forEach((m) => m.dispose());
    g.mesh.dispose();
    delete ghosts[id];
  }

  function update(id: string, pos: Vector3, time: number) {
    const g = ghosts[id];
    if (!g) return;

    g.mesh.position.copyFrom(pos);

    g.mesh.getChildMeshes().forEach((cube, i) => {
      const mat = cube.material as StandardMaterial;
      const phase = cube.metadata?.phase ?? 0;

      const angle = time + (i * (Math.PI * 2)) / 3 + phase;
      const radius = 0.6;

      cube.position.x = Math.cos(angle) * radius;
      cube.position.z = Math.sin(angle) * radius;

      cube.position.y = 0.5 + i * 0.3 + Math.sin(time * 2 + phase) * 0.2;
      if (mat) {
        const pulse = 0.7 + 0.3 * Math.sin(time * 4 + phase);
        mat.emissiveColor.set(0.3 * pulse, 1 * pulse, 0.3 * pulse);
      }

      cube.rotation.y += 0.05;
    });
  }

  return { spawn, remove, update };
}
