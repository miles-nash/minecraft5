import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, RENDER_DISTANCE_CHUNKS, BlockId } from './constants';
import { Perlin2D } from './noise';
import { Chunk } from './Chunk';

const tempVec3 = new THREE.Vector3();

export class World {
  private scene: THREE.Scene;
  private chunks: Map<string, Chunk> = new Map();
  private perlin = new Perlin2D(2025);
  private chunkMeshes: Map<string, THREE.InstancedMesh> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get loadedChunkCount() { return this.chunks.size; }

  getChunkKey(cx: number, cz: number) { return `${cx},${cz}`; }

  getChunkKeyFromWorld(x: number, _y: number, z: number) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return this.getChunkKey(cx, cz);
  }

  private ensureChunk(cx: number, cz: number) {
    const key = this.getChunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key)!;
    const chunk = new Chunk(key, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
    this.generateChunkTerrain(chunk);
    this.chunks.set(key, chunk);
    const mesh = chunk.buildMesh();
    if (mesh) {
      this.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
    }
    return chunk;
  }

  private generateChunkTerrain(chunk: Chunk) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = chunk.originX + x;
        const wz = chunk.originZ + z;
        const h = this.getHeightAt(wx, wz);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let id: BlockId = BlockId.Air;
          if (y < h - 4) id = BlockId.Stone;
          else if (y < h - 1) id = BlockId.Dirt;
          else if (y < h) id = BlockId.Grass;
          chunk.set(x, y, z, id);
        }
      }
    }
  }

  private getHeightAt(x: number, z: number) {
    const n1 = this.perlin.noise(x * 0.02, z * 0.02);
    const n2 = this.perlin.noise(x * 0.08, z * 0.08);
    const e = n1 * 0.7 + n2 * 0.3;
    const h = Math.floor(20 + e * 28);
    return THREE.MathUtils.clamp(h, 1, WORLD_HEIGHT - 1);
  }

  update(playerPos: THREE.Vector3, camera?: THREE.Camera) {
    const pcx = Math.floor(playerPos.x / CHUNK_SIZE);
    const pcz = Math.floor(playerPos.z / CHUNK_SIZE);

    // Load around player
    for (let dz = -RENDER_DISTANCE_CHUNKS; dz <= RENDER_DISTANCE_CHUNKS; dz++) {
      for (let dx = -RENDER_DISTANCE_CHUNKS; dx <= RENDER_DISTANCE_CHUNKS; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const dist2 = dx * dx + dz * dz;
        if (dist2 > RENDER_DISTANCE_CHUNKS * RENDER_DISTANCE_CHUNKS) continue;
        this.ensureChunk(cx, cz);
      }
    }

    // Unload distant
    for (const [key, chunk] of this.chunks) {
      const cxcz = key.split(',').map(Number);
      const cx = cxcz[0];
      const cz = cxcz[1];
      if (Math.abs(cx - pcx) > RENDER_DISTANCE_CHUNKS + 1 || Math.abs(cz - pcz) > RENDER_DISTANCE_CHUNKS + 1) {
        this.disposeChunk(key);
      }
    }

    // Frustum culling per chunk
    if (camera) {
      const frustum = new THREE.Frustum();
      const projView = new THREE.Matrix4().multiplyMatrices(
        (camera as THREE.PerspectiveCamera).projectionMatrix,
        (camera as any).matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projView);
      for (const [key, mesh] of this.chunkMeshes) {
        const origin = this.chunks.get(key)!;
        const box = new THREE.Box3(
          new THREE.Vector3(origin.originX, 0, origin.originZ),
          new THREE.Vector3(origin.originX + CHUNK_SIZE, WORLD_HEIGHT, origin.originZ + CHUNK_SIZE)
        );
        mesh.visible = frustum.intersectsBox(box);
      }
    }
  }

  private disposeChunk(key: string) {
    const mesh = this.chunkMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.chunkMeshes.delete(key);
    }
    this.chunks.delete(key);
  }

  isSolidAt(x: number, y: number, z: number) {
    if (y < 0 || y >= WORLD_HEIGHT) return true;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return false;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.get(lx, y, lz) !== BlockId.Air;
  }

  setBlock(x: number, y: number, z: number, id: BlockId) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.set(lx, y, lz, id);
    const old = this.chunkMeshes.get(key);
    if (old) this.scene.remove(old);
    const mesh = chunk.buildMesh();
    if (mesh) this.scene.add(mesh);
    if (mesh) this.chunkMeshes.set(key, mesh);
    else this.chunkMeshes.delete(key);

    // Gravity for falling blocks (Sand)
    if (id === BlockId.Sand) {
      this.settleFallingFrom(x, y, z);
    } else if (id === BlockId.Air) {
      // If we remove a block, check for sand above to fall
      this.settleFallingFrom(x, y + 1, z);
    }
  }

  private settleFallingFrom(x: number, y: number, z: number) {
    // Make sand fall straight down until it hits something
    let cy = y;
    while (cy >= 0 && this.getBlockId(x, cy, z) === BlockId.Sand && !this.isSolidAt(x, cy - 1, z)) {
      this.swapBlocks(x, cy, z, x, cy - 1, z);
      cy--;
    }
  }

  private getBlockId(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockId.Air;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const key = this.getChunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return BlockId.Air;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.get(lx, y, lz);
  }

  private swapBlocks(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const a = this.getBlockId(ax, ay, az);
    const b = this.getBlockId(bx, by, bz);
    this.setBlock(ax, ay, az, b);
    this.setBlock(bx, by, bz, a);
  }

  raycastVoxel(origin: THREE.Vector3, direction: THREE.Vector3) {
    // DDA voxel traversal
    const pos = origin.clone();
    const dir = direction.clone().normalize();
    let x = Math.floor(pos.x);
    let y = Math.floor(pos.y);
    let z = Math.floor(pos.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / dir.x);
    const tDeltaY = Math.abs(1 / dir.y);
    const tDeltaZ = Math.abs(1 / dir.z);
    let tMaxX = ((x + (stepX > 0 ? 1 : 0)) - pos.x) / dir.x;
    let tMaxY = ((y + (stepY > 0 ? 1 : 0)) - pos.y) / dir.y;
    let tMaxZ = ((z + (stepZ > 0 ? 1 : 0)) - pos.z) / dir.z;
    tMaxX = isFinite(tMaxX) ? Math.abs(tMaxX) : Infinity;
    tMaxY = isFinite(tMaxY) ? Math.abs(tMaxY) : Infinity;
    tMaxZ = isFinite(tMaxZ) ? Math.abs(tMaxZ) : Infinity;

    for (let i = 0; i < 128; i++) {
      if (this.isSolidAt(x, y, z)) {
        const normal = new THREE.Vector3(0, 0, 0);
        // normal is the opposite of the last step taken
        if (tMaxX < tMaxY && tMaxX < tMaxZ) normal.set(-stepX, 0, 0);
        else if (tMaxY < tMaxZ) normal.set(0, -stepY, 0);
        else normal.set(0, 0, -stepZ);
        return { block: new THREE.Vector3(x, y, z), normal };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX; tMaxX += tDeltaX;
        } else { z += stepZ; tMaxZ += tDeltaZ; }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY; tMaxY += tDeltaY;
        } else { z += stepZ; tMaxZ += tDeltaZ; }
      }
    }
    return null as null;
  }
}


