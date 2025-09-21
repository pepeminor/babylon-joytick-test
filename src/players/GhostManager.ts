import {
  Scene,
  Vector3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

type Ghost = { mesh: Mesh };

export class GhostManager {
  private scene: Scene;
  private ghosts: Record<string, Ghost> = {};

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // === Spawn ghost ===
  spawn(id: string, pos: Vector3) {
    if (this.ghosts[id]) return;

    const parent = new Mesh("ghostRoot_" + id, this.scene);
    parent.position.copyFrom(pos);

    for (let i = 0; i < 3; i++) {
      const cube = MeshBuilder.CreateBox(
        "ghostCube_" + id + "_" + i,
        { size: 0.14 },
        this.scene
      );
      cube.parent = parent;

      const mat = new StandardMaterial("ghostMat_" + id + "_" + i, this.scene);
      mat.emissiveColor = new Color3(0.6, 1, 0.6);
      mat.alpha = 0.6;
      cube.material = mat;

      cube.metadata = { phase: Math.random() * Math.PI * 2 };
    }

    this.ghosts[id] = { mesh: parent };
  }

  remove(id: string) {
    const g = this.ghosts[id];
    if (!g) return;

    g.mesh.getChildMeshes().forEach((m) => m.dispose());
    g.mesh.dispose();
    delete this.ghosts[id];
  }

  update(id: string, pos: Vector3, time: number) {
    const g = this.ghosts[id];
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
}
