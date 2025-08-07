import * as THREE from 'three';
import { BlockId, CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { getMaterialForBlock } from './textures';

export class Chunk {
  key: string;
  originX: number;
  originZ: number;
  blocks: Uint8Array; // x,y,z packed
  mesh: THREE.Object3D | null = null;

  constructor(key: string, originX: number, originZ: number) {
    this.key = key;
    this.originX = originX;
    this.originZ = originZ;
    this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  }

  index(x: number, y: number, z: number) {
    return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
  }

  get(x: number, y: number, z: number): BlockId {
    return this.blocks[this.index(x, y, z)] as BlockId;
  }

  set(x: number, y: number, z: number, id: BlockId) {
    this.blocks[this.index(x, y, z)] = id;
  }

  private static seededHue(x: number, y: number, z: number): number {
    const h = (Math.sin(x * 12_989.0 + y * 78_233.0 + z * 45_679.0) * 43758.5453) % 1;
    return (h + 1 + 0.5) % 1;
  }

  buildMesh(): THREE.Object3D | null {
    if (this.mesh) {
      // Dispose any previous group children
      this.mesh.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as any).isMesh) {
          mesh.geometry?.dispose?.();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else (mesh.material as THREE.Material | undefined)?.dispose?.();
        }
      });
    }

    const group = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);

    // First pass: count visible blocks per BlockId
    const counts = new Map<BlockId, number>();
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.get(x, y, z);
          if (id === BlockId.Air) continue;
          if (this.isHidden(x, y, z)) continue;
          counts.set(id, (counts.get(id) || 0) + 1);
        }
      }
    }

    // Create instanced meshes per block type
    const meshes = new Map<BlockId, THREE.InstancedMesh>();
    const counters = new Map<BlockId, number>();
    for (const [id, count] of counts) {
      const inst = new THREE.InstancedMesh(box, getMaterialForBlock(id), count);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      meshes.set(id, inst);
      counters.set(id, 0);
      group.add(inst);
    }

    const dummy = new THREE.Object3D();
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.get(x, y, z);
          if (id === BlockId.Air) continue;
          if (this.isHidden(x, y, z)) continue;
          const inst = meshes.get(id);
          if (!inst) continue;
          const idx = counters.get(id)!;
          dummy.position.set(this.originX + x + 0.5, y + 0.5, this.originZ + z + 0.5);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          counters.set(id, idx + 1);
        }
      }
    }

    for (const inst of meshes.values()) {
      inst.instanceMatrix.needsUpdate = true;
    }
    this.mesh = group;
    if (group.children.length === 0) return null;
    return group;
  }

  private isHidden(x: number, y: number, z: number) {
    const self = this.get(x, y, z);
    if (self === BlockId.Air) return true;
    const neighbor = (nx: number, ny: number, nz: number) => {
      if (nx < 0 || nz < 0 || nx >= CHUNK_SIZE || nz >= CHUNK_SIZE || ny < 0 || ny >= WORLD_HEIGHT) return BlockId.Air;
      return this.get(nx, ny, nz);
    };
    const left = neighbor(x - 1, y, z);
    const right = neighbor(x + 1, y, z);
    const down = neighbor(x, y - 1, z);
    const up = neighbor(x, y + 1, z);
    const back = neighbor(x, y, z - 1);
    const front = neighbor(x, y, z + 1);
    return left && right && down && up && back && front;
  }
}


