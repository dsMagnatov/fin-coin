import './style.css';
import * as THREE from 'three';
import { CoinPhysics } from './physics.js';
import { createCoin, coinNames } from './geometry.js';
import { setupCoinStudio, createGlassMaterial } from './environment.js';
import { startStory } from './story.js';
import { startNewsletter } from './newsletter.js';
import { startTravellingCoin } from './travelling-coin.js';
import { closestToCenter } from './travel-route.js';
import { setupNavigation } from './navigation.js';
import { COIN_SCALE, COIN_RADIUS, COIN_BOUNDS_RADIUS, COIN_DIAMETER_PX, WORLD_UNIT_PX } from './coin-size.js';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const sceneSize = { width: 19.2, height: 6.09, coinScale: COIN_SCALE };
const TRAVEL_SECONDS = 28;
const canvas = document.querySelector('#coins');
const stages = [...document.querySelectorAll('.stage')];
const sceneElement = document.querySelector('.coin-scene');
const coinSizeProbe = document.createElement('div');
coinSizeProbe.className = 'hero-coin-size';
coinSizeProbe.setAttribute('aria-hidden', 'true');
sceneElement.append(coinSizeProbe);
let renderer;
let resizeScene;
let heroCoins;
let traveller;
let resizeStory;
let resizeNewsletter;
document.documentElement.style.setProperty('--coin-diameter', `${COIN_DIAMETER_PX}px`);

function fitStage() {
  const width = document.documentElement.clientWidth;
  const mobile = width <= 900;
  const scale = mobile ? 1 : Math.min(width / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
  document.documentElement.style.setProperty('--stage-scale', scale.toString());
  for (const stage of stages) {
    stage.style.width = `${width / scale}px`;
    if (mobile && stage.classList.contains('budget-stage')) stage.style.removeProperty('height');
    else stage.style.height = `${(mobile ? stage.parentElement.getBoundingClientRect().height : window.innerHeight) / scale}px`;
    stage.dataset.scale = String(scale);
  }
  const rect = canvas.getBoundingClientRect();
  sceneSize.width = rect.width / (WORLD_UNIT_PX * scale);
  sceneSize.height = rect.height / (WORLD_UNIT_PX * scale);
  sceneSize.coinScale = coinSizeProbe.getBoundingClientRect().width / scale / (2 * 1.065 * WORLD_UNIT_PX);
  if (renderer) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
  }
  resizeScene?.();
  resizeStory?.();
  resizeNewsletter?.();
  traveller?.resize();
}

fitStage();
window.addEventListener('resize', fitStage);
setupNavigation();

function showFallback() {
  canvas.hidden = true;
  const fallback = document.querySelector('.coin-fallback');
  fallback.hidden = false;
  fallback.innerHTML = Array.from({ length: 6 }, (_, index) => `<svg viewBox="0 0 200 200"><defs><linearGradient id="glass${index}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".25" stop-color="#163afe"/><stop offset=".48" stop-color="#c4f7ff"/><stop offset=".7" stop-color="#d771ff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><circle cx="100" cy="100" r="83" fill="none" stroke="url(#glass${index})" stroke-width="32"/><circle cx="100" cy="100" r="96" fill="none" stroke="#b7c5ff" stroke-width="1.5"/></svg>`).join('');
  sceneElement.dataset.status = 'fallback';
}

try {
  // Retain the buffer so continuous WebGL rendering composites reliably
  // with the page text on desktop Chromium graphics backends.
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
} catch {
  showFallback();
}

if (renderer) startScene();
traveller = startTravellingCoin(heroCoins);
resizeStory = startStory({ externalFirstCoin: true, onCoinActivity: active => traveller.setStoryActivity(active) });
resizeNewsletter = startNewsletter({ coin: traveller.scratchCoin, canInteract: traveller.canScratch });
traveller.connectNewsletter(resizeNewsletter);

function startScene() {
  renderer.setClearColor(0x000000, 1);
  fitStage();

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-sceneSize.width / 2, sceneSize.width / 2, sceneSize.height / 2, -sceneSize.height / 2, 0.1, 100);
  camera.position.set(0, 0, 20);
  setupCoinStudio(scene, renderer);

  const layout = [
    [-0.12, 0.22, -0.38, -0.26],
    [0.65, -0.18, 0.5, 0.18],
    [-0.25, 0.35, -0.28, -0.15],
    [0.5, -0.22, 0.4, 0.18],
    [-0.38, 0.28, -0.48, -0.32],
    [0.5, -0.25, 0.34, 0.2],
  ];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coinRadius = () => COIN_RADIUS / COIN_SCALE * sceneSize.coinScale;
  const boundsRadius = () => COIN_BOUNDS_RADIUS / COIN_SCALE * sceneSize.coinScale;
  const maxCoinRadius = boundsRadius();
  const loopSpan = Math.max(sceneSize.width + (maxCoinRadius + 0.1) * 2, layout.length * (maxCoinRadius * 2 + 0.3));
  const bodies = layout.map(([baseY, rx, ry, rz], index) => {
    const x = -loopSpan / 2 + (index + (document.documentElement.clientWidth <= 900 ? 0 : 0.5)) * loopSpan / layout.length;
    const y = baseY * sceneSize.height / 6.09;
    const mesh = createCoin(index, createGlassMaterial(index));
    const size = sceneSize.coinScale;
    mesh.scale.setScalar(size);
    mesh.position.set(x, y, 0);
    mesh.rotation.set(rx, ry, rz);
    scene.add(mesh);
    const body = { x, y, radius: coinRadius(), visualRadius: maxCoinRadius, homeY: y, vx: 0, phase: index * 1.4, spinX: 0, spinY: 0, rx, ry, rz, passes: 0, mesh };
    mesh.traverse(object => { object.userData.body = body; });
    return body;
  });
  const sceneBounds = () => {
    const margin = Math.min(0.1, Math.max(0, (sceneSize.height - boundsRadius() * 2) / 2));
    return { left: -sceneSize.width / 2, right: sceneSize.width / 2, bottom: -sceneSize.height / 2 + margin, top: sceneSize.height / 2 - margin };
  };
  const physics = new CoinPhysics(bodies, sceneBounds(), { flowSpeed: -sceneSize.width / TRAVEL_SECONDS });
  let detached = null;
  resizeScene = () => {
    const oldStart = physics.loopStart;
    const oldSpan = physics.loopEnd - oldStart;
    const oldHeight = camera.top - camera.bottom;
    camera.left = -sceneSize.width / 2;
    camera.right = sceneSize.width / 2;
    camera.top = sceneSize.height / 2;
    camera.bottom = -sceneSize.height / 2;
    camera.updateProjectionMatrix();
    physics.resizeBounds(sceneBounds(), { radius: coinRadius(), visualRadius: boundsRadius() });
    physics.flowSpeed = -sceneSize.width / TRAVEL_SECONDS;
    for (const body of bodies) if (!body.detached) body.mesh.scale.setScalar(sceneSize.coinScale);
    if (detached) {
      const remapX = x => physics.loopStart + (x - oldStart) / oldSpan * (physics.loopEnd - physics.loopStart);
      detached.x = remapX(detached.x);
      detached.y *= sceneSize.height / oldHeight;
      detached.position.x = remapX(detached.position.x);
      detached.position.y *= sceneSize.height / oldHeight;
      detached.scale.setScalar(sceneSize.coinScale);
    }
    sceneElement.dataset.coinScale = sceneSize.coinScale;
    sceneElement.dataset.coinDiameter = (coinRadius() * 2 * WORLD_UNIT_PX).toFixed(3);
    pointerSample = null;
  };
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let pointerSample = null;
  let activePointer = null;

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    pointerNDC.set(x * 2 - 1, 1 - y * 2);
    return { x: (x - 0.5) * sceneSize.width, y: (0.5 - y) * sceneSize.height };
  }

  function hitCoin(point) {
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObjects(bodies.filter(body => !body.detached).map(body => body.mesh), true)[0];
    if (hit) return hit.object.userData.body;
    // The central cutouts should be interactive too, just like a trackball.
    return bodies.find(body => !body.detached && Math.hypot(point.x - body.x, point.y - body.y) < body.radius);
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || activePointer !== null) return;
    const point = pointerPosition(event);
    const body = hitCoin(point);
    if (!body) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    physics.grab(body);
    pointerSample = { ...point, time: event.timeStamp };
    canvas.style.cursor = 'grabbing';
    sceneElement.dataset.dragging = coinNames[bodies.indexOf(body)];
  });

  canvas.addEventListener('pointermove', event => {
    if (activePointer !== null && event.pointerId !== activePointer) return;
    const point = pointerPosition(event);
    const body = physics.dragged || hitCoin(point);
    if (pointerSample) {
      const dt = Math.max((event.timeStamp - pointerSample.time) / 1000, 0.008);
      physics.rotate(body, point.x - pointerSample.x, point.y - pointerSample.y, dt);
    }
    canvas.style.cursor = physics.dragged ? 'grabbing' : body ? 'grab' : 'default';
    pointerSample = { ...point, time: event.timeStamp };
  });

  function endDrag(event, cancelled = false) {
    if (activePointer === null || event.pointerId !== activePointer) return;
    const pointerId = activePointer;
    physics.release(cancelled);
    activePointer = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerSample = null;
    sceneElement.dataset.dragging = '';
    canvas.style.cursor = 'default';
  }
  canvas.addEventListener('pointerup', event => endDrag(event));
  canvas.addEventListener('pointercancel', event => endDrag(event, true));
  canvas.addEventListener('lostpointercapture', event => endDrag(event, true));
  canvas.addEventListener('pointerleave', () => {
    if (activePointer === null) { pointerSample = null; canvas.style.cursor = 'default'; }
  });

  let visible = !document.hidden;
  let inViewport = true;
  let contextAvailable = true;
  let lastFrame = 0;
  let accumulator = 0;
  let elapsed = 0;
  let metricsTime = 0;
  const timestep = 1 / 120;

  function frame(timestamp) {
    if (!visible) return;
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    elapsed += delta;
    accumulator += delta;
    while (accumulator >= timestep) {
      physics.step(timestep, !motion.matches && !detached);
      accumulator -= timestep;
    }
    for (const body of bodies) {
      if (body.detached) continue;
      body.mesh.position.set(body.x, body.y, Math.sin(elapsed * 0.45 + body.phase) * (motion.matches ? 0 : 0.16));
      body.mesh.rotation.set(body.rx, body.ry, body.rz);
    }
    renderer.render(scene, camera);
    // DOM diagnostics make viewport and interaction verification observable.
    if (elapsed - metricsTime > 0.5) {
      sceneElement.dataset.worldWidth = sceneSize.width.toFixed(3);
      sceneElement.dataset.worldHeight = sceneSize.height.toFixed(3);
      sceneElement.dataset.motionTime = physics.time.toFixed(4);
      sceneElement.dataset.coins = JSON.stringify(bodies.map((body, i) => ({ name: coinNames[i], x: +body.x.toFixed(3), y: +body.y.toFixed(3), radius: +body.radius.toFixed(3), speed: +Math.abs(body.vx).toFixed(3), tilt: +body.rx.toFixed(3), turn: +body.ry.toFixed(3), spin: +Math.hypot(body.spinX, body.spinY).toFixed(3), passes: body.passes })));
      metricsTime = elapsed;
    }
  }

  function updateActivity() {
    visible = contextAvailable && inViewport && !document.hidden;
    if (!visible && physics.dragged) {
      endDrag({ pointerId: activePointer, timeStamp: performance.now() }, true);
    }
    lastFrame = 0;
    accumulator = 0;
    renderer.setAnimationLoop(visible ? frame : null);
  }
  document.addEventListener('visibilitychange', updateActivity);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    updateActivity();
  });
  visibilityObserver.observe(sceneElement);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextAvailable = false;
    renderer.setAnimationLoop(null);
    showFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => window.location.reload());
  sceneElement.dataset.status = 'ready';
  sceneElement.dataset.coinCount = bodies.length;
  sceneElement.dataset.coinScale = sceneSize.coinScale;
  sceneElement.dataset.coinDiameter = (coinRadius() * 2 * WORLD_UNIT_PX).toFixed(3);
  heroCoins = {
    getSource() {
      if (!detached) return null;
      const rect = canvas.getBoundingClientRect();
      const point = detached.position.clone().project(camera);
      return { x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height + window.scrollY, diameter: coinSizeProbe.getBoundingClientRect().width };
    },
    takeNearest() {
      if (activePointer !== null) endDrag({ pointerId: activePointer }, true);
      const rect = canvas.getBoundingClientRect();
      const projected = bodies.map(body => {
        const point = body.mesh.position.clone().project(camera);
        return { x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height + window.scrollY, visible: Math.abs(point.x) <= 1.2 };
      });
      const index = closestToCenter(projected, { x: document.documentElement.clientWidth / 2, y: innerHeight / 2 });
      const body = bodies[index < 0 ? 0 : index];
      const pose = { x: body.mesh.rotation.x, y: body.mesh.rotation.y, z: body.mesh.rotation.z };
      detached = { body, position: body.mesh.position.clone(), scale: body.mesh.scale.clone(), pose, x: body.x, y: body.y };
      body.detached = true;
      scene.remove(body.mesh);
      renderer.render(scene, camera);
      sceneElement.dataset.travelling = coinNames[index < 0 ? 0 : index];
      return { mesh: body.mesh, name: coinNames[index < 0 ? 0 : index], ...projected[index < 0 ? 0 : index], diameter: coinSizeProbe.getBoundingClientRect().width, pose };
    },
    restore() {
      if (!detached) return;
      const { body, position, scale, pose, x, y } = detached;
      Object.assign(body, { x, y, rx: pose.x, ry: pose.y, rz: pose.z, spinX: 0, spinY: 0, detached: false });
      body.mesh.position.copy(position);
      body.mesh.scale.copy(scale);
      body.mesh.rotation.set(pose.x, pose.y, pose.z);
      scene.add(body.mesh);
      renderer.render(scene, camera);
      detached = null;
      sceneElement.dataset.travelling = '';
    },
  };
  renderer.setAnimationLoop(frame);
}
