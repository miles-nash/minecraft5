import * as THREE from 'three';
import { WORLD_HEIGHT } from '../world/constants';
import { World } from '../world/World';

function makeGenericFaceTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f1d7b8';
  g.fillRect(0, 0, c.width, c.height);
  // Glasses
  g.strokeStyle = '#222'; g.lineWidth = 6;
  g.strokeRect(18, 40, 36, 26);
  g.strokeRect(74, 40, 36, 26);
  g.beginPath(); g.moveTo(54, 52); g.lineTo(74, 52); g.stroke();
  // Eyes
  g.fillStyle = '#000';
  g.beginPath(); g.arc(36, 53, 6, 0, Math.PI*2); g.fill();
  g.beginPath(); g.arc(92, 53, 6, 0, Math.PI*2); g.fill();
  // Smile
  g.strokeStyle = '#431'; g.lineWidth = 4;
  g.beginPath(); g.arc(64, 85, 20, 0.15*Math.PI, 0.85*Math.PI); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

export class Zombie extends THREE.Group {
  private world: World;
  private faceMat: THREE.MeshBasicMaterial;
  private speed = 3.5;
  private groanCooldown = 0;

  constructor(world: World) {
    super();
    this.world = world;

    // Body
    const skin = new THREE.MeshBasicMaterial({ color: 0xcaa98a });
    const blazer = new THREE.MeshBasicMaterial({ color: 0x2a3f6e });
    const shirt = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const pants = new THREE.MeshBasicMaterial({ color: 0x222222 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.4), blazer);
    torso.position.set(0, 1.4, 0);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.41), shirt);
    chest.position.set(0, 1.4, 0.01);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), skin);
    head.position.set(0, 2.1, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), this.faceMat = new THREE.MeshBasicMaterial({ map: makeGenericFaceTexture(), transparent: false, toneMapped: false }));
    face.position.set(0, 2.1, 0.31);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), blazer); armL.position.set(-0.6, 1.45, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), blazer); armR.position.set(0.6, 1.45, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), pants); legL.position.set(-0.2, 0.45, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), pants); legR.position.set(0.2, 0.45, 0);

    this.add(torso, chest, head, face, armL, armR, legL, legR);
  }

  private surfaceYAt(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (this.world.isSolidAt(Math.floor(x), y, Math.floor(z))) return y + 1;
    }
    return 32; // fallback
  }

  update(delta: number, playerPos: THREE.Vector3) {
    // Simple chase AI
    const pos = this.position;
    const dir = new THREE.Vector3().subVectors(playerPos, pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.01) {
      dir.normalize();
      const step = Math.min(this.speed * delta, dist);
      pos.addScaledVector(dir, step);
      this.lookAt(playerPos.x, pos.y, playerPos.z);
    }
    // Stick to terrain
    const groundY = this.surfaceYAt(pos.x, pos.z);
    pos.y += (groundY - pos.y) * Math.min(1, delta * 10);

    // Groan when close
    this.groanCooldown -= delta;
    if (dist < 4 && this.groanCooldown <= 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'square'; o.frequency.value = 110 + Math.random()*30; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        o.start(); o.stop(ctx.currentTime + 0.31);
      } catch {}
      this.groanCooldown = 2 + Math.random()*2;
    }
  }
}


