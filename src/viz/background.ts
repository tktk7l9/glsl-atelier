// The signature atmosphere: a deep-space backdrop — drifting starfield + soft
// cyan/magenta/violet nebulae — with UnrealBloomPass glow. This is the deliberate
// inverse of css-atelier's bright, bloom-free drafting studio. Lazy-loaded, so
// the Three.js + postprocessing chunk never touches the cold load. Honors
// prefers-reduced-motion by rendering a single static frame.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export interface Background {
  dispose(): void;
}

function nebulaTexture(color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBackground(canvas: HTMLCanvasElement, reducedMotion: boolean): Background {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x05060d, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 14;

  // Starfield: additive points scattered in a shell.
  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 18 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xbfe6ff,
    size: 0.09,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Nebulae: big additive sprites.
  const nebGroup = new THREE.Group();
  const textures = [
    nebulaTexture("rgba(70,200,255,0.55)"),
    nebulaTexture("rgba(255,80,200,0.50)"),
    nebulaTexture("rgba(150,110,255,0.45)"),
  ];
  const placements: ReadonlyArray<[number, number, number, number, number]> = [
    [-7, 3, -6, 26, 0],
    [8, -5, -9, 30, 1],
    [0, 2, -12, 36, 2],
  ];
  for (const [x, y, z, s, t] of placements) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({
        map: textures[t],
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    nebGroup.add(mesh);
  }
  scene.add(nebGroup);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.65, 0.0);
  composer.addPass(bloom);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let raf = 0;
  const start = performance.now();
  function frame(): void {
    const t = (performance.now() - start) / 1000;
    stars.rotation.y = t * 0.02;
    nebGroup.rotation.z = t * 0.012;
    camera.position.x = Math.sin(t * 0.1) * 0.7;
    camera.position.y = Math.cos(t * 0.08) * 0.4;
    camera.lookAt(0, 0, 0);
    composer.render();
    raf = requestAnimationFrame(frame);
  }
  if (reducedMotion) {
    camera.lookAt(0, 0, 0);
    composer.render();
  } else {
    frame();
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      composer.dispose();
      renderer.dispose();
    },
  };
}
