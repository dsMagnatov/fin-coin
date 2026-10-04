import * as THREE from 'three';
import { createCoin, coinNames } from './geometry.js';
import { createGlassMaterial, setupCoinStudio } from './environment.js';
import { WORLD_UNIT_PX } from './coin-size.js';

const TAU = Math.PI * 2;
const DIAMETER_PX = 84;
const SLOT_COIN_RATIO = DIAMETER_PX / 94;
const COIN_SCALE = DIAMETER_PX / (2 * 1.065 * WORLD_UNIT_PX);
const BURST_SECONDS = 1.6;
const SLOW_TURN_SECONDS = 48;
const smoothTurn = t => t * t * t * (t * (t * 6 - 15) + 10);

/** Two stationary inline coins, set in motion as the reading highlight arrives. */
export function startStoryCoins({ externalFirstCoin = false } = {}) {
  const section = document.querySelector('#story');
  const content = section?.querySelector('.story-content');
  const canvas = section?.querySelector('#story-coins');
  const slots = [...(section?.querySelectorAll('.story-coin') || [])];
  if (!content || !canvas || slots.length !== 2) return { resize() {}, setActive() {} };

  const stage = content.closest('.stage');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const indices = [1, 3];
  const states = slots.map((slot, index) => ({
    slot,
    external: externalFirstCoin && index === 0,
    active: false,
    x: index ? -0.28 : 0.3,
    y: index ? 0.34 : -0.4,
    z: index ? 0.08 : -0.12,
    burstElapsed: BURST_SECONDS,
    mesh: null,
  }));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 20);
  let renderer;
  let available = false;
  let visible = false;
  let request = 0;
  let previousTime = 0;

  function showFallback() {
    available = false;
    canvas.hidden = true;
    canvas.dataset.status = 'fallback';
    states.forEach(({ slot, external }, index) => {
      if (external) return;
      if (slot.querySelector('[data-story-fallback]')) return;
      const hole = index
        ? 'M0 -31 C5 -31 5 -12 13 -8 C18 -4 31 -5 31 0 C31 5 12 5 8 13 C4 18 5 31 0 31 C-5 31 -5 12 -13 8 C-18 4 -31 5 -31 0 C-31 -5 -12 -5 -8 -13 C-4 -18 -5 -31 0 -31Z'
        : 'M0 -29 Q2 -31 4 -29 L29 -4 Q31 -2 29 0 L4 29 Q2 31 0 29 L-29 4 Q-31 2 -29 0Z';
      const gradient = `story-glass-${index}`;
      slot.innerHTML = `<svg data-story-fallback viewBox="-48 -48 96 96" aria-hidden="true" style="display:block;width:100%;height:100%;overflow:visible"><defs><linearGradient id="${gradient}" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#152534"/><stop offset=".23" stop-color="#768cff"/><stop offset=".41" stop-color="#92ffff"/><stop offset=".51" stop-color="#e2d7ff"/><stop offset=".61" stop-color="#c054f2"/><stop offset=".8" stop-color="#181629"/><stop offset="1" stop-color="#72a9e0"/></linearGradient></defs><path d="M0 -43A43 43 0 1 1 0 43A43 43 0 1 1 0 -43Z ${hole}" fill="url(#${gradient})" fill-rule="evenodd" stroke="#bfdcfa" stroke-width=".8"/><circle r="41" fill="none" stroke="#a7b9ff" stroke-width=".5"/></svg>`;
    });
  }

  try {
    // The canvas sits below the text on the same black background. An opaque
    // buffer keeps physical transmission and Chromium compositing consistent.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 1);
    setupCoinStudio(scene, renderer);
    states.forEach((state, index) => {
      if (state.external) return;
      state.mesh = createCoin(indices[index], createGlassMaterial(indices[index]));
      state.mesh.scale.setScalar(COIN_SCALE);
      state.mesh.rotation.set(state.x, state.y, state.z);
      scene.add(state.mesh);
    });
    available = true;
    canvas.dataset.status = 'ready';
  } catch {
    showFallback();
  }

  function shouldRun() {
    return available && visible && !document.hidden && !motion.matches && states.some(state => !state.external && state.active);
  }

  function report() {
    const running = shouldRun();
    canvas.dataset.animating = String(running);
    states.forEach(state => {
      if (!state.external) {
        state.slot.dataset.rotation = JSON.stringify({ x: +state.x.toFixed(5), y: +state.y.toFixed(5), z: +state.z.toFixed(5) });
        state.slot.dataset.animating = String(running && state.active);
      }
      state.slot.dataset.renderedExternally = String(state.external);
      state.slot.dataset.active = String(state.active);
    });
  }

  function render() {
    if (available) renderer.render(scene, camera);
    report();
  }

  function schedule() {
    if (shouldRun() && !request) request = requestAnimationFrame(frame);
  }

  function frame(time) {
    request = 0;
    if (!shouldRun()) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    states.forEach(state => {
      if (state.external || !state.active) return;
      const burstStep = Math.min(delta, BURST_SECONDS - state.burstElapsed);
      if (burstStep > 0) {
        const before = smoothTurn(state.burstElapsed / BURST_SECONDS);
        state.burstElapsed += burstStep;
        const after = smoothTurn(state.burstElapsed / BURST_SECONDS);
        state.y += TAU * (after - before);
      }
      state.y += (delta - burstStep) * TAU / SLOW_TURN_SECONDS;
      state.mesh.rotation.set(state.x, state.y, state.z);
    });
    render();
    schedule();
  }

  function updateActivity() {
    cancelAnimationFrame(request);
    request = 0;
    previousTime = 0;
    render();
    schedule();
  }

  function setActive(active) {
    let changed = false;
    states.forEach((state, index) => {
      const next = Boolean(active[index]);
      if (state.active === next) return;
      state.active = next;
      if (next) state.burstElapsed = 0;
      changed = true;
    });
    if (changed) updateActivity();
  }

  function resize() {
    const bounds = content.getBoundingClientRect();
    const scale = Number(stage?.dataset.scale) || 1;
    const unit = WORLD_UNIT_PX * scale;
    if (!bounds.width || !bounds.height) return;
    const width = bounds.width / unit;
    const height = bounds.height / unit;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    states.forEach(state => {
      if (!state.mesh) return;
      const rect = state.slot.getBoundingClientRect();
      const diameter = rect.width * SLOT_COIN_RATIO / scale;
      state.mesh.scale.setScalar(diameter / (2 * 1.065 * WORLD_UNIT_PX));
      state.mesh.position.set((rect.left + rect.width / 2 - bounds.left) / unit - width / 2, height / 2 - (rect.top + rect.height / 2 - bounds.top) / unit, 0);
      state.slot.dataset.coinDiameter = diameter.toFixed(2);
    });
    if (available) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(Math.max(1, Math.round(bounds.width)), Math.max(1, Math.round(bounds.height)), false);
    }
    render();
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio > 0;
    updateActivity();
  }, { threshold: [0, 0.001] });
  observer.observe(content);
  document.addEventListener('visibilitychange', updateActivity);
  motion.addEventListener('change', updateActivity);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showFallback();
    updateActivity();
  });
  canvas.addEventListener('webglcontextrestored', () => window.location.reload());
  new ResizeObserver(resize).observe(content);
  document.fonts.ready.then(resize);
  canvas.dataset.count = String(states.filter(state => !state.external).length);
  canvas.dataset.coinDiameter = String(DIAMETER_PX);
  canvas.dataset.names = JSON.stringify(indices.filter((_, index) => !states[index].external).map(index => coinNames[index]));
  resize();
  return { resize, setActive };
}
