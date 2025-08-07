import * as THREE from 'three';

function makeScreenTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const g = c.getContext('2d')!;
  // Boot screen style
  g.fillStyle = '#001133';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#00ffea';
  g.font = 'bold 20px monospace';
  g.fillText('Microsoft', 16, 36);
  g.font = '14px monospace';
  g.fillText('Starting Windows...', 16, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = true;
  return tex;
}

export class CRTTree extends THREE.Group {
  private screenMat: THREE.MeshBasicMaterial;
  private flickerTime = 0;

  constructor() {
    super();
    const towerGeo = new THREE.BoxGeometry(1, 4, 1);
    const towerMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a6 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0, 2, 0);

    // Monitor casing
    const monitorGeo = new THREE.BoxGeometry(3, 2.2, 2);
    const monitorMat = new THREE.MeshBasicMaterial({ color: 0xcfd8dc });
    const monitor = new THREE.Mesh(monitorGeo, monitorMat);
    monitor.position.set(0, 5, 0);

    // Screen plane
    const screenTex = makeScreenTexture();
    this.screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.6), this.screenMat);
    screen.position.set(0, 5, 1.01);

    // Little CRT curvature feel
    screen.rotation.x = -0.03;

    this.add(tower, monitor, screen);
  }

  update(delta: number) {
    // Flicker the screen subtlely
    this.flickerTime += delta;
    const intensity = 0.9 + Math.sin(this.flickerTime * 120.0) * 0.05 + (Math.random() - 0.5) * 0.02;
    this.screenMat.color.setScalar(intensity);
  }
}


