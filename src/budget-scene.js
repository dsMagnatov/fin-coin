import * as THREE from 'three';
import { CoinPhysics } from './physics.js';
import { createCoin } from './geometry.js';
import { setupCoinStudio, createGlassMaterial } from './environment.js';
import { COIN_SCALE, COIN_RADIUS, COIN_DIAMETER_PX, WORLD_UNIT_PX } from './coin-size.js';

/** A single coin, rotating in place. Render only while its screen is visible. */
export function startBudgetScene() {
  const canvas = document.querySelector('#budget-coin');
  const container = document.querySelector('.budget-coin');
  const fallback = container.querySelector('.budget-coin-fallback');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  let available = true;
  let inViewport = false;
  let lastFrame = 0;
  let metricsTime = 0;
  let running = false;
  let pointerSample = null;
  let activePointer = null;

  function showFallback() {
    available = false;
    canvas.hidden = true;
    fallback.removeAttribute('hidden');
    container.dataset.status = 'fallback';
    container.dataset.animating = 'false';
    container.dataset.dragging = 'false';
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  } catch {
    showFallback();
    return () => {};
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3.2, 3.2, 3.4, -3.4, 0.1, 100);
  camera.position.set(0, 0, 20);
  setupCoinStudio(scene, renderer);
  const coin = createCoin(5, createGlassMaterial(5));
  coin.scale.setScalar(COIN_SCALE);
  const body = { x: 0, y: 0, homeY: 0, radius: COIN_RADIUS, vx: 0, phase: 0, spinX: 0, spinY: 0, rx: 0.12, ry: -0.35, rz: -0.08 };
  // Reuse the first-screen rotation response, with its conveyor motion disabled.
  const physics = new CoinPhysics([body], { left: -10, right: 10, bottom: -10, top: 10 });
  coin.rotation.set(body.rx, body.ry, body.rz);
  scene.add(coin);
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  canvas.style.touchAction = 'none';

  function applyRotation() {
    coin.rotation.set(body.rx, body.ry, body.rz);
  }

  function reportRotation(timestamp, force = false) {
    if (!force && timestamp - metricsTime < 500) return;
    container.dataset.turn = body.ry.toFixed(4);
    container.dataset.rotation = JSON.stringify({ x: +body.rx.toFixed(4), y: +body.ry.toFixed(4), z: +body.rz.toFixed(4) });
    metricsTime = timestamp;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Number(container.closest('.stage').dataset.scale) || 1;
    const halfWidth = rect.width / (2 * WORLD_UNIT_PX * scale);
    const halfHeight = rect.height / (2 * WORLD_UNIT_PX * scale);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
    pointerSample = null;
    if (available) renderer.render(scene, camera);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    pointerNDC.set(x * 2 - 1, 1 - y * 2);
    return { x: camera.left + x * (camera.right - camera.left), y: camera.top - y * (camera.top - camera.bottom) };
  }

  function hitsCoin(point) {
    coin.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerNDC, camera);
    // The holes are part of the trackball too, matching the first screen.
    return raycaster.intersectObject(coin, true).length > 0 || Math.hypot(point.x, point.y) < body.radius;
  }

  canvas.addEventListener('pointerdown', event => {
    if (!available || !inViewport || document.hidden || event.button !== 0 || activePointer !== null) return;
    const point = pointerPosition(event);
    if (!hitsCoin(point)) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    physics.grab(body);
    pointerSample = { ...point, time: event.timeStamp };
    canvas.style.cursor = 'grabbing';
    container.dataset.dragging = 'true';
    updateActivity();
  });

  canvas.addEventListener('pointermove', event => {
    if (!available || !inViewport || document.hidden || activePointer !== null && event.pointerId !== activePointer) return;
    const point = pointerPosition(event);
    const overCoin = physics.dragged || hitsCoin(point);
    if (overCoin && pointerSample) {
      physics.rotate(body, point.x - pointerSample.x, point.y - pointerSample.y, Math.max((event.timeStamp - pointerSample.time) / 1000, 0.008));
      applyRotation();
      renderer.render(scene, camera);
      reportRotation(event.timeStamp);
      updateActivity();
    }
    canvas.style.cursor = physics.dragged ? 'grabbing' : overCoin ? 'grab' : 'default';
    pointerSample = { ...point, time: event.timeStamp };
  });

  function endDrag(event, cancelled = false, update = true) {
    if (activePointer === null || event.pointerId !== activePointer) return;
    const pointerId = activePointer;
    physics.release(cancelled);
    activePointer = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerSample = null;
    canvas.style.cursor = 'default';
    container.dataset.dragging = 'false';
    reportRotation(performance.now(), true);
    if (update) updateActivity();
  }
  canvas.addEventListener('pointerup', event => endDrag(event));
  canvas.addEventListener('pointercancel', event => endDrag(event, true));
  canvas.addEventListener('lostpointercapture', event => endDrag(event, true));
  canvas.addEventListener('pointerleave', () => {
    if (activePointer === null) {
      pointerSample = null;
      canvas.style.cursor = 'default';
    }
  });

  function frame(timestamp) {
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    if (!motion.matches) body.ry += delta * Math.PI * 2 / 48;
    physics.step(delta, false);
    applyRotation();
    renderer.render(scene, camera);
    reportRotation(timestamp);
    if (motion.matches && !physics.dragged && Math.hypot(body.spinX, body.spinY) < 0.002) {
      body.spinX = body.spinY = 0;
      reportRotation(timestamp, true);
      updateActivity();
    }
  }

  function updateActivity() {
    const active = available && inViewport && !document.hidden;
    if (!active) {
      if (physics.dragged) endDrag({ pointerId: activePointer }, true, false);
      pointerSample = null;
    }
    const shouldRun = active && (!motion.matches || physics.dragged !== null || Math.hypot(body.spinX, body.spinY) >= 0.002);
    if (running !== shouldRun) {
      lastFrame = 0;
      renderer.setAnimationLoop(shouldRun ? frame : null);
      running = shouldRun;
    }
    container.dataset.animating = String(shouldRun);
    if (active && !shouldRun) {
      applyRotation();
      renderer.render(scene, camera);
      reportRotation(performance.now(), true);
    }
  }
  new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    updateActivity();
  }).observe(container);
  document.addEventListener('visibilitychange', updateActivity);
  motion.addEventListener('change', updateActivity);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    available = false;
    updateActivity();
    renderer.setAnimationLoop(null);
    showFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => window.location.reload());
  container.dataset.status = 'ready';
  container.dataset.dragging = 'false';
  reportRotation(performance.now(), true);
  container.dataset.coinDiameter = COIN_DIAMETER_PX.toFixed(3);
  resize();
  return resize;
}
