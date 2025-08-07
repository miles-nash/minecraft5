export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const RENDER_DISTANCE_CHUNKS = 6; // radius

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
}

export const BLOCK_COLORS: Record<BlockId, number> = {
  [BlockId.Air]: 0x000000,
  [BlockId.Grass]: 0x55aa55,
  [BlockId.Dirt]: 0x8b5a2b,
  [BlockId.Stone]: 0x888888,
  [BlockId.Sand]: 0xE5D69E,
};


