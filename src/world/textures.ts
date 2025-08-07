import * as THREE from 'three';
import { BlockId } from './constants';

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipMapNearestFilter;
  return tex;
}

function drawBlissGrass(): THREE.Texture {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d')!;
  // Sky
  const skyGrad = g.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#7ec0ee');
  skyGrad.addColorStop(1, '#a3d3ff');
  g.fillStyle = skyGrad;
  g.fillRect(0, 0, 256, 256);
  // Hills
  g.fillStyle = '#49a34b';
  g.beginPath();
  g.moveTo(0, 170);
  for (let x = 0; x <= 256; x++) {
    const y = 170 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.12) * 5;
    g.lineTo(x, y);
  }
  g.lineTo(256, 256);
  g.lineTo(0, 256);
  g.closePath();
  g.fill();
  // Clouds
  g.fillStyle = 'rgba(255,255,255,0.9)';
  const cloud = (cx: number, cy: number) => {
    g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.arc(cx + 16, cy + 3, 12, 0, Math.PI * 2); g.arc(cx - 16, cy + 5, 10, 0, Math.PI * 2); g.fill();
  };
  cloud(70, 60); cloud(160, 45);
  return textureFromCanvas(c);
}

function drawBsodStone(): THREE.Texture {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#0951d6';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e6f0ff';
  g.font = '10px monospace';
  for (let y = 10; y < 256; y += 12) {
    const text = 'A problem has been detected and Windows has been shut down to prevent damage.';
    g.fillText(text.substring(0, 28), 6, y);
  }
  return textureFromCanvas(c);
}

function drawWin95Pattern(): THREE.Texture {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = '#b5d6ff';
  g.fillRect(0, 0, 256, 256);
  // Subtle grid
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  // Windows logo squares
  const size = 28;
  const ox = 96, oy = 96;
  const squares = [
    ['#f35325', 0, 0],
    ['#81bc06', size + 4, 0],
    ['#05a6f0', 0, size + 4],
    ['#ffba08', size + 4, size + 4],
  ] as const;
  for (const [color, dx, dy] of squares) {
    g.fillStyle = color;
    g.globalAlpha = 0.6;
    g.fillRect(ox + dx, oy + dy, size, size);
    g.globalAlpha = 1;
  }
  return textureFromCanvas(c);
}

const materialCache = new Map<BlockId, THREE.MeshBasicMaterial>();

export function getMaterialForBlock(blockId: BlockId): THREE.MeshBasicMaterial {
  if (materialCache.has(blockId)) return materialCache.get(blockId)!;
  let texture: THREE.Texture | null = null;
  switch (blockId) {
    case BlockId.Grass: texture = drawBlissGrass(); break;
    case BlockId.Stone: texture = drawBsodStone(); break;
    case BlockId.Dirt: texture = drawWin95Pattern(); break;
    case BlockId.Sand: texture = null; break;
    default: texture = null; break;
  }
  const mat = new THREE.MeshBasicMaterial({ map: texture ?? undefined, color: texture ? 0xffffff : 0xE5D69E });
  materialCache.set(blockId, mat);
  return mat;
}


