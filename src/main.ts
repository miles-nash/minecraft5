import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { World } from './world/World';
import { BlockId } from './world/constants';
import { ClippyNPC } from './npc/Clippy';

const appElement = document.getElementById('app')!;
const hudElement = document.getElementById('hud')!;
const invElement = document.getElementById('inv')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 160);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x87ceeb, 1);
appElement.appendChild(renderer.domElement);

// Lights
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(1, 1, 0.5).multiplyScalar(100);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
scene.add(new THREE.HemisphereLight(0x88bbff, 0x446633, 0.5));

// Controls
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());
controls.getObject().position.set(8, 48, 8);

renderer.domElement.addEventListener('click', () => {
  controls.lock();
});

// Movement
const keyState: Record<string, boolean> = {};
let isFlying = false;
let lastSpaceTapMs = 0;
const DOUBLE_TAP_WINDOW_MS = 300;
window.addEventListener('keydown', (e) => {
  keyState[e.code] = true;
  if (e.code === 'Space') {
    const now = performance.now();
    if (now - lastSpaceTapMs < DOUBLE_TAP_WINDOW_MS) {
      isFlying = !isFlying;
      // Reset vertical velocity when toggling flight to avoid abrupt jumps/falls
      const pos = controls.getObject().position;
      velocity.y = 0;
      lastSpaceTapMs = 0;
    } else {
      lastSpaceTapMs = now;
    }
  }
});
window.addEventListener('keyup', (e) => (keyState[e.code] = false));

// World
const world = new World(scene);
const clippy = new ClippyNPC();
clippy.position.set(12, 39, 12);
scene.add(clippy);

// Inventory (0-8 slots, 1-9 to select)
let selected: BlockId = BlockId.Grass;
function renderInventory() {
  invElement.innerHTML = '';
  const options: BlockId[] = [BlockId.Grass, BlockId.Dirt, BlockId.Stone, BlockId.Sand];
  for (const i of options) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selected ? ' active' : '');
    slot.title = i === BlockId.Grass ? 'Grass' : i === BlockId.Dirt ? 'Dirt' : i === BlockId.Stone ? 'Stone' : 'Sand';
    invElement.appendChild(slot);
  }
}
renderInventory();

window.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.replace('Digit', '')) as BlockId;
    if (n >= 1 && n <= 4) {
      selected = n as BlockId;
      renderInventory();
    }
  }
});

// Raycaster for block interact
const raycaster = new THREE.Raycaster();
const tempVec = new THREE.Vector3();

function placeOrBreakBlock(mouseButton: number) {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = world.raycastVoxel(raycaster.ray.origin, raycaster.ray.direction);
  if (!hit) return;
  if (mouseButton === 0) {
    world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockId.Air);
  } else if (mouseButton === 2) {
    const p = hit.block.clone().add(hit.normal);
    world.setBlock(p.x, p.y, p.z, selected);
  }
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  placeOrBreakBlock(e.button);
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Movement integration
const velocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();
let last = performance.now();
let onGround = false;

function updateMovement(delta: number) {
  moveDir.set(0, 0, 0);
  const speed = isFlying ? 40 : 12;
  if (keyState['KeyW']) moveDir.z -= 1;
  if (keyState['KeyS']) moveDir.z += 1;
  if (keyState['KeyA']) moveDir.x -= 1;
  if (keyState['KeyD']) moveDir.x += 1;
  moveDir.normalize();

  // Use camera forward/right so W moves forward, S backward
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const accelX = (-moveDir.z) * forward.x + moveDir.x * right.x;
  const accelZ = (-moveDir.z) * forward.z + moveDir.x * right.z;
  velocity.x += accelX * speed * delta;
  velocity.z += accelZ * speed * delta;

  // Gravity / vertical control
  if (isFlying) {
    let upDown = 0;
    if (keyState['Space']) upDown += 1;
    if (keyState['ShiftLeft'] || keyState['ShiftRight']) upDown -= 1;
    // Direct control to avoid drift
    velocity.y = upDown * speed;
  } else {
    velocity.y -= 32 * delta;
    if (onGround && keyState['Space']) {
      velocity.y = 10;
    }
  }

  const pos = controls.getObject().position;
  const next = tempVec.copy(pos).addScaledVector(velocity, delta);

  if (isFlying) {
    pos.copy(next);
    onGround = false;
  } else {
    // Axis-aligned simple collision resolution (feet/head checks)
    const feetAt = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.y - 1.6, v.z);
    const headAt = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.y + 0.2, v.z);

    // Try X axis
    const tryX = new THREE.Vector3(next.x, pos.y, pos.z);
    const collidesX = world.isSolidAt(Math.floor(feetAt(tryX).x), Math.floor(feetAt(tryX).y), Math.floor(feetAt(tryX).z)) ||
                     world.isSolidAt(Math.floor(headAt(tryX).x), Math.floor(headAt(tryX).y), Math.floor(headAt(tryX).z));
    if (!collidesX) pos.x = tryX.x; else velocity.x = 0;

    // Try Z axis
    const tryZ = new THREE.Vector3(pos.x, pos.y, next.z);
    const collidesZ = world.isSolidAt(Math.floor(feetAt(tryZ).x), Math.floor(feetAt(tryZ).y), Math.floor(feetAt(tryZ).z)) ||
                     world.isSolidAt(Math.floor(headAt(tryZ).x), Math.floor(headAt(tryZ).y), Math.floor(headAt(tryZ).z));
    if (!collidesZ) pos.z = tryZ.z; else velocity.z = 0;

    // Try Y axis
    const tryY = new THREE.Vector3(pos.x, next.y, pos.z);
    const collidesY = world.isSolidAt(Math.floor(feetAt(tryY).x), Math.floor(feetAt(tryY).y), Math.floor(feetAt(tryY).z)) ||
                     world.isSolidAt(Math.floor(headAt(tryY).x), Math.floor(headAt(tryY).y), Math.floor(headAt(tryY).z));
    if (!collidesY) pos.y = tryY.y; else velocity.y = Math.max(0, velocity.y);

    onGround = collidesY && velocity.y <= 0;
  }

  // Dampen horizontal velocity
  const damp = isFlying ? 0.92 : 0.85;
  velocity.x *= damp;
  velocity.z *= damp;
  if (isFlying) velocity.y *= 0.92;
}

// HUD update
function updateHud(fps: number) {
  const p = controls.getObject().position;
  const chunkKey = world.getChunkKeyFromWorld(p.x, p.y, p.z);
  hudElement.textContent = `FPS ${fps.toFixed(0)}  Pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}  Chunks ${world.loadedChunkCount}  Selected ${selected}  Fly ${isFlying ? 'ON' : 'OFF'}`;
}

// Main loop
let frames = 0;
let fps = 0;
let fpsTimer = 0;
function animate() {
  const now = performance.now();
  const delta = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  fpsTimer += delta;
  if (fpsTimer >= 1) {
    fps = frames / fpsTimer;
    frames = 0;
    fpsTimer = 0;
  }

  camera.updateMatrixWorld();
  world.update(camera.position, camera);
  clippy.update(delta, controls.getObject().position);
  if (controls.isLocked) updateMovement(delta);
  updateHud(fps);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
// Prime world before first frame so we don't start in a void
camera.updateMatrixWorld();
world.update(controls.getObject().position, camera);
animate();


