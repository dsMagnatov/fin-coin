import * as THREE from 'three';
import { createCoin } from './geometry.js';
import { createGlassMaterial, setupCoinStudio } from './environment.js';
import { WORLD_UNIT_PX } from './coin-size.js';

const DIAMETER_PX = 185;
const DESIGN_SIZE = 200;
const BASE_POSE = { x: 0.5, y: -0.3, z: -0.45 };
const clamp = value => Math.max(-1, Math.min(1, Number(value) || 0));

/** The shared glass coin, used as a pointer-controlled scratch tool. */
export function startScratchCoin() {
  const canvas = document.querySelector('#scratch-coin');
  const container = canvas?.closest('.scratch-coin');
  if (!canvas || !container) return { resize() {}, setPosition() {}, setScratching() {}, setVisible() {} };

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 20);
  const position = { x: 0, y: 0 };
  const pose = { ...BASE_POSE };
  const target = { ...BASE_POSE };
  let renderer;
  let coin;
  let available = false;
  let inViewport = false;
  let requestedVisible = true;
  let scratching = false;
  let request = 0;
  let previousTime = 0;
  let fallback;

  function isVisible() {
    return requestedVisible && inViewport && !document.hidden;
  }

  function showFallback() {
    available = false;
    cancelAnimationFrame(request);
    request = 0;
    canvas.hidden = true;
    if (!fallback) {
      fallback = document.createElement('span');
      fallback.className = 'scratch-coin-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.style.cssText = 'position:absolute;inset:0;display:block;pointer-events:none';
      fallback.innerHTML = '<svg viewBox="-55 -55 110 110" aria-hidden="true" style="display:block;width:100%;height:100%;overflow:visible"><defs><linearGradient id="scratch-glass" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#122732"/><stop offset=".25" stop-color="#7184ff"/><stop offset=".4" stop-color="#90f5ff"/><stop offset=".52" stop-color="#e2d7ff"/><stop offset=".62" stop-color="#a955e5"/><stop offset=".82" stop-color="#151525"/><stop offset="1" stop-color="#9bb6e7"/></linearGradient></defs><g transform="rotate(-26) scale(1 .88)"><path d="M0 -49A49 49 0 1 1 0 49A49 49 0 1 1 0 -49Z M0 -33Q2 -35 4 -33L33 -4Q35 -2 33 0L4 33Q2 35 0 33L-33 4Q-35 2 -33 0Z" fill="url(#scratch-glass)" fill-rule="evenodd" stroke="#c1dcff" stroke-width=".8"/><circle r="47" fill="none" stroke="#95b2ff" stroke-width=".5"/></g></svg>';
      container.append(fallback);
    }
    fallback.hidden = false;
    fallback.style.display = 'block';
    container.dataset.status = 'fallback';
    container.dataset.animating = 'false';
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    setupCoinStudio(scene, renderer);
    coin = createCoin(1, createGlassMaterial(1));
    coin.scale.setScalar(DIAMETER_PX / (2 * 1.065 * WORLD_UNIT_PX));
    coin.rotation.set(pose.x, pose.y, pose.z);
    scene.add(coin);
    available = true;
    container.dataset.status = 'ready';
  } catch {
    showFallback();
  }

  function report() {
    container.dataset.scratching = String(scratching);
    container.dataset.animating = String(Boolean(request));
    container.dataset.rotation = JSON.stringify({ x: +pose.x.toFixed(4), y: +pose.y.toFixed(4), z: +pose.z.toFixed(4) });
  }

  function render() {
    if (available && isVisible()) {
      coin.rotation.set(pose.x, pose.y, pose.z);
      renderer.render(scene, camera);
    }
    report();
  }

  function unsettled() {
    return Math.abs(pose.x - target.x) + Math.abs(pose.y - target.y) + Math.abs(pose.z - target.z) > 0.0005;
  }

  function schedule() {
    if (available && isVisible() && !motion.matches && unsettled() && !request) request = requestAnimationFrame(frame);
    report();
  }

  function frame(time) {
    request = 0;
    if (!available || !isVisible() || motion.matches) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    const easing = 1 - Math.exp(-delta * 15);
    for (const axis of ['x', 'y', 'z']) pose[axis] += (target[axis] - pose[axis]) * easing;
    if (!unsettled()) Object.assign(pose, target);
    render();
    schedule();
    if (!request) previousTime = 0;
  }

  function updateActivity() {
    cancelAnimationFrame(request);
    request = 0;
    previousTime = 0;
    if (motion.matches) Object.assign(pose, target);
    render();
    schedule();
  }

  function updateTarget() {
    target.x = BASE_POSE.x + position.y * 0.23 - (scratching ? 0.12 : 0);
    target.y = BASE_POSE.y + position.x * 0.27;
    target.z = BASE_POSE.z + position.x * 0.12 - (scratching ? 0.08 : 0);
    if (motion.matches) Object.assign(pose, target);
    render();
    schedule();
  }

  function setPosition(next = {}) {
    position.x = clamp(next.x);
    position.y = clamp(next.y);
    updateTarget();
  }

  function setScratching(next) {
    if (scratching === Boolean(next)) return;
    scratching = Boolean(next);
    updateTarget();
  }

  function setVisible(next) {
    requestedVisible = Boolean(next);
    updateActivity();
  }

  function resize() {
    if (!available) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Number(container.closest('.stage')?.dataset.scale) || rect.width / DESIGN_SIZE || 1;
    const halfWidth = rect.width / (2 * WORLD_UNIT_PX * scale);
    const halfHeight = rect.height / (2 * WORLD_UNIT_PX * scale);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
    render();
  }

  new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting && entry.intersectionRatio > 0;
    updateActivity();
  }, { threshold: [0, 0.001] }).observe(container);
  new ResizeObserver(resize).observe(container);
  document.addEventListener('visibilitychange', updateActivity);
  motion.addEventListener('change', updateActivity);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showFallback();
    report();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!renderer || !coin) return;
    available = true;
    canvas.hidden = false;
    if (fallback) {
      fallback.hidden = true;
      fallback.style.display = 'none';
    }
    container.dataset.status = 'ready';
    resize();
    updateActivity();
  });
  container.dataset.coinDiameter = String(DIAMETER_PX);
  document.fonts.ready.then(resize);
  resize();
  report();
  return { resize, setPosition, setScratching, setVisible };
}
