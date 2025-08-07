import * as THREE from 'three';
import { BlockId, CHUNK_SIZE, WORLD_HEIGHT } from './constants';

export class Chunk {
  key: string;
  originX: number;
  originZ: number;
  blocks: Uint8Array; // x,y,z packed
  mesh: THREE.InstancedMesh | null = null;
  instanceCount = 0;

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
    // Large primes hashing to [0,1)
    const h = (Math.sin(x * 12_989.0 + y * 78_233.0 + z * 45_679.0) * 43758.5453) % 1;
    return (h + 1 + 0.5) % 1; // ensure positive and spread
  }

  buildMesh(): THREE.InstancedMesh | null {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    // We color via instance color; enable it
    const mesh = new THREE.InstancedMesh(box, mat, this.blocks.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let count = 0;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.get(x, y, z);
          if (id === BlockId.Air) continue;
          // Simple face culling by checking neighbors; only add if visible on any side
          if (
            this.isHidden(x, y, z)
          ) continue;
          dummy.position.set(this.originX + x + 0.5, y + 0.5, this.originZ + z + 0.5);
          dummy.updateMatrix();
          mesh.setMatrixAt(count, dummy.matrix);
          // Deterministic bright random color per world position
          const wx = this.originX + x;
          const wy = y;
          const wz = this.originZ + z;
          const h = Chunk.seededHue(wx, wy, wz);
          color.setHSL(h, 0.7, 0.6);
          mesh.setColorAt(count, color);
          count++;
        }
      }
    }
    this.instanceCount = count;
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    if (count === 0) return null;
    return mesh;
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


