// The 3D Pipes screensaver — the most iconic 3D artifact of the Win98
// era, rebuilt with three.js. Pipes random-walk through a 3D grid,
// elbow spheres at every turn, glossy plastic materials in the classic
// saturated palette, and when the space fills up the screen fades and
// a fresh run begins. Loaded ONLY when the idle timer fires, so it
// costs normal visits zero bytes.
import * as THREE from "three";

const GRID = { x: 22, y: 13, z: 22 };
const SPACING = 1;
const PIPE_RADIUS = 0.19;
const JOINT_RADIUS = 0.27;
const STEP_MS = 45;
const MAX_SEGMENTS = 850;
const WALKERS = 3;
// The classic palette: candy plastic, high specular.
const COLORS = [0xc8a000, 0x00a14b, 0x2257d6, 0xc62121, 0x14a3a8, 0x8d28c9];

type Dir = [number, number, number];
const DIRS: Dir[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function startPipes(container: HTMLElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    200
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(8, 14, 10);
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.6);
  fill.position.set(-10, -4, -8);
  scene.add(fill);

  // Shared unit geometries, scaled per use — disposal stays trivial.
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sphGeo = new THREE.SphereGeometry(1, 12, 9);
  const materials = COLORS.map(
    (c) =>
      new THREE.MeshPhongMaterial({
        color: c,
        shininess: 90,
        specular: 0x666666,
      })
  );

  const pipesGroup = new THREE.Group();
  scene.add(pipesGroup);

  const center = new THREE.Vector3(
    ((GRID.x - 1) * SPACING) / 2,
    ((GRID.y - 1) * SPACING) / 2,
    ((GRID.z - 1) * SPACING) / 2
  );

  let occupied = new Set<string>();
  let segments = 0;

  type Walker = {
    pos: [number, number, number];
    dir: Dir;
    material: THREE.MeshPhongMaterial;
  };
  let walkers: Walker[] = [];

  const randomFreeCell = (): [number, number, number] | null => {
    for (let tries = 0; tries < 60; tries++) {
      const p: [number, number, number] = [
        Math.floor(Math.random() * GRID.x),
        Math.floor(Math.random() * GRID.y),
        Math.floor(Math.random() * GRID.z),
      ];
      if (!occupied.has(key(...p))) return p;
    }
    return null;
  };

  const spawnWalker = (): Walker | null => {
    const pos = randomFreeCell();
    if (!pos) return null;
    occupied.add(key(...pos));
    const material =
      materials[Math.floor(Math.random() * materials.length)];
    addJoint(pos, material);
    return { pos, dir: DIRS[Math.floor(Math.random() * 6)], material };
  };

  const toWorld = (p: [number, number, number]) =>
    new THREE.Vector3(p[0] * SPACING, p[1] * SPACING, p[2] * SPACING);

  function addJoint(p: [number, number, number], m: THREE.Material) {
    const s = new THREE.Mesh(sphGeo, m);
    s.scale.setScalar(JOINT_RADIUS);
    s.position.copy(toWorld(p));
    pipesGroup.add(s);
  }

  function addSegment(
    a: [number, number, number],
    b: [number, number, number],
    m: THREE.Material
  ) {
    const va = toWorld(a);
    const vb = toWorld(b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const cyl = new THREE.Mesh(cylGeo, m);
    cyl.scale.set(PIPE_RADIUS, va.distanceTo(vb), PIPE_RADIUS);
    cyl.position.copy(mid);
    // Cylinder's axis is Y; orient it along the step direction.
    cyl.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      vb.clone().sub(va).normalize()
    );
    pipesGroup.add(cyl);
    segments++;
  }

  function step(w: Walker): boolean {
    // Prefer continuing straight (the real one did) — turns happen,
    // but runs of pipe are what make it read as plumbing.
    const candidates: Dir[] = [];
    const ordered =
      Math.random() < 0.55
        ? [w.dir, ...DIRS.filter((d) => d !== w.dir)]
        : [...DIRS].sort(() => Math.random() - 0.5);
    for (const d of ordered) {
      const n: [number, number, number] = [
        w.pos[0] + d[0],
        w.pos[1] + d[1],
        w.pos[2] + d[2],
      ];
      if (
        n[0] >= 0 && n[0] < GRID.x &&
        n[1] >= 0 && n[1] < GRID.y &&
        n[2] >= 0 && n[2] < GRID.z &&
        !occupied.has(key(...n))
      ) {
        candidates.push(d);
        break; // ordered list — first valid wins
      }
    }
    if (!candidates.length) return false;
    const d = candidates[0];
    const next: [number, number, number] = [
      w.pos[0] + d[0],
      w.pos[1] + d[1],
      w.pos[2] + d[2],
    ];
    const turned = d !== w.dir;
    if (turned) addJoint(w.pos, w.material);
    addSegment(w.pos, next, w.material);
    occupied.add(key(...next));
    w.pos = next;
    w.dir = d;
    return true;
  }

  function resetRun() {
    for (const child of pipesGroup.children) {
      // geometries/materials are shared — only the meshes go.
      (child as THREE.Mesh).geometry = cylGeo; // no-op, keeps TS quiet
    }
    pipesGroup.clear();
    occupied = new Set();
    segments = 0;
    walkers = [];
    for (let i = 0; i < WALKERS; i++) {
      const w = spawnWalker();
      if (w) walkers.push(w);
    }
    // A fresh random viewpoint each run, like the original.
    const radius = 16 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    camera.position.set(
      center.x + radius * Math.cos(theta),
      center.y + 4 + Math.random() * 5,
      center.z + radius * Math.sin(theta)
    );
    camera.lookAt(center);
  }

  resetRun();

  let raf = 0;
  let last = 0;
  let acc = 0;
  let fading = false;

  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const dt = last ? t - last : 0;
    last = t;
    acc += dt;

    while (acc >= STEP_MS && !fading) {
      acc -= STEP_MS;
      for (let i = walkers.length - 1; i >= 0; i--) {
        if (!step(walkers[i])) {
          const fresh = spawnWalker();
          if (fresh) walkers[i] = fresh;
          else walkers.splice(i, 1);
        }
      }
      if (segments >= MAX_SEGMENTS || walkers.length === 0) {
        fading = true;
        const start = performance.now();
        const fade = () => {
          const p = Math.min(1, (performance.now() - start) / 450);
          pipesGroup.children.forEach((c) => {
            const mesh = c as THREE.Mesh;
            (mesh.material as THREE.MeshPhongMaterial).opacity = 1 - p;
            (mesh.material as THREE.MeshPhongMaterial).transparent = true;
          });
          if (p < 1) requestAnimationFrame(fade);
          else {
            materials.forEach((m) => {
              m.opacity = 1;
              m.transparent = false;
            });
            resetRun();
            fading = false;
          }
        };
        fade();
      }
    }

    // A whisper of orbit — the original was static, but a fixed
    // viewpoint on a modern display reads as a stuck frame.
    const orbit = t * 0.00004;
    camera.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.sin(orbit) * 0.0006
    );
    camera.lookAt(center);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  const onResize = () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  };
  window.addEventListener("resize", onResize);

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      last = 0;
    } else {
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    pipesGroup.clear();
    cylGeo.dispose();
    sphGeo.dispose();
    materials.forEach((m) => m.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
