import * as THREE from 'three';

export class ClippyNPC extends THREE.Group {
  private body: THREE.Mesh;
  private eyeLeft: THREE.Mesh;
  private eyeRight: THREE.Mesh;
  private pupilLeft: THREE.Mesh;
  private pupilRight: THREE.Mesh;
  private target: THREE.Vector3 = new THREE.Vector3();
  private wanderTimer = 0;
  private bubble?: HTMLDivElement;

  constructor() {
    super();
    // Paperclip body: multiple bent segments to mirror the iconic shape
    const metal = new THREE.MeshBasicMaterial({ color: 0xbfc4ff });
    const group = new THREE.Group();
    const tube = (path: THREE.Curve<THREE.Vector3>, radius = 0.12) => new THREE.Mesh(new THREE.TubeGeometry(path, 64, radius, 8, false), metal);

    // Outer loop path
    class ClipPath extends THREE.Curve<THREE.Vector3> {
      private scale: number;
      constructor(scale: number) { super(); this.scale = scale; }
      getPoint(t: number) {
        // Two lobes with a straight middle to avoid a perfect circle
        const s = this.scale;
        const angle = t * Math.PI * 1.6 + 0.2; // slightly open gap
        const r = 2.0 + Math.sin(t * Math.PI) * 0.25; // squash
        return new THREE.Vector3(Math.cos(angle) * r * s, Math.sin(angle) * r * 0.8 * s + 0.6, 0);
      }
    }
    const outer = tube(new ClipPath(1));
    const inner = tube(new ClipPath(0.75));
    inner.position.z = 0.02;
    group.add(outer, inner);
    // Bottom straight leg
    const legPath = new THREE.LineCurve3(new THREE.Vector3(-0.2, -0.2, 0), new THREE.Vector3(0.9, -0.9, 0));
    const leg = tube(legPath as any, 0.12);
    group.add(leg);
    this.body = new THREE.Mesh();
    this.add(group);

    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const pupilGeo = new THREE.SphereGeometry(0.09, 12, 12);
    this.eyeLeft = new THREE.Mesh(eyeGeo, eyeWhite);
    this.eyeRight = new THREE.Mesh(eyeGeo, eyeWhite);
    this.pupilLeft = new THREE.Mesh(pupilGeo, eyeBlack);
    this.pupilRight = new THREE.Mesh(pupilGeo, eyeBlack);
    this.eyeLeft.position.set(-0.35, 1.1, 0.35);
    this.eyeRight.position.set(0.35, 1.1, 0.35);
    this.pupilLeft.position.copy(this.eyeLeft.position).add(new THREE.Vector3(0, 0, 0.12));
    this.pupilRight.position.copy(this.eyeRight.position).add(new THREE.Vector3(0, 0, 0.12));
    this.add(this.eyeLeft, this.eyeRight, this.pupilLeft, this.pupilRight);
  }

  private setNewTarget() {
    const radius = 10 + Math.random() * 15;
    const angle = Math.random() * Math.PI * 2;
    const ox = this.position.x + Math.cos(angle) * radius;
    const oz = this.position.z + Math.sin(angle) * radius;
    this.target.set(ox, this.position.y, oz);
  }

  update(delta: number, playerPos: THREE.Vector3) {
    // Eye tracking
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.position).normalize();
    const look = new THREE.Vector3(toPlayer.x, toPlayer.y * 0.3, toPlayer.z).multiplyScalar(0.18);
    this.pupilLeft.position.copy(this.eyeLeft.position).add(look);
    this.pupilRight.position.copy(this.eyeRight.position).add(look);

    // Wander
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0 || this.position.distanceTo(this.target) < 1) {
      this.setNewTarget();
      this.wanderTimer = 3 + Math.random() * 4;
    }
    const dir = new THREE.Vector3().subVectors(this.target, this.position);
    dir.y = 0;
    const dist = dir.length();
    if (dist > 0.01) {
      dir.normalize();
      this.position.addScaledVector(dir, Math.min(2.5 * delta, dist));
      this.lookAt(this.position.clone().add(dir));
    }

    // Interaction bubble
    const near = this.position.distanceTo(playerPos) < 3;
    if (near) {
      if (!this.bubble) this.spawnBubble();
    } else if (this.bubble) {
      this.removeBubble();
    }
  }

  private spawnBubble() {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '80px';
    div.style.left = '20px';
    div.style.padding = '8px 10px';
    div.style.borderRadius = '8px';
    div.style.background = 'rgba(255,255,255,0.9)';
    div.style.color = '#000';
    div.style.fontFamily = 'sans-serif';
    div.style.boxShadow = '0 2px 8px rgba(0,0,0,.25)';
    const tips = [
      "It looks like you're trying to build a house!",
      'Tip: Dig dirt, place stone. Repeat.',
      'Fun fact: Windows 95 introduced the Start menu!',
      'Remember to back up your world... on floppy?'
    ];
    div.textContent = tips[Math.floor(Math.random() * tips.length)];
    document.body.appendChild(div);
    this.bubble = div;
    // Simple beep
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    } catch {}
  }

  private removeBubble() {
    if (this.bubble && this.bubble.parentElement) this.bubble.parentElement.removeChild(this.bubble);
    this.bubble = undefined;
  }
}


