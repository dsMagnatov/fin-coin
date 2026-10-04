import * as THREE from 'three';
import { createCoin, coinNames } from './geometry.js';
import { createGlassMaterial, setupCoinStudio } from './environment.js';
import { COIN_DIAMETER_PX, WORLD_UNIT_PX } from './coin-size.js';
import { evaluateTravel } from './travel-route.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const burstEase = t => t * t * t * (t * (t * 6 - 15) + 10);

/** One actual hero mesh moves between the page's four coin docks. */
export function startTravellingCoin(hero) {
  const layer = document.querySelector('.travelling-coin');
  const canvas = layer.querySelector('canvas');
  const story = document.querySelector('#story');
  const pin = story.querySelector('.story-pin');
  const slot = story.querySelector('[data-story-coin="0"]');
  const budget = document.querySelector('#budget');
  const budgetDock = budget.querySelector('.budget-coin');
  const budgetInput = budget.querySelector('#budget-coin');
  const newsletter = document.querySelector('#newsletter');
  const tool = newsletter.querySelector('.scratch-coin');
  const scratchDock = newsletter.querySelector('.scratch-dock');
  const heroSize = document.querySelector('.hero-coin-size');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 20);
  let renderer;
  let available = false;
  let capture = null;
  let geometry;
  let route = { phase: 'hero' };
  let request = 0;
  let previousTime = 0;
  let boxSize = 1;
  let newsletterControl;
  let storyActive = false;
  let burstElapsed = 1.6;
  let autoTurn = 0;
  const manual = { x: 0, y: 0, vx: 0, vy: 0 };
  const scratch = { x: 0, y: 0, targetX: 0, targetY: 0, active: false, settlingUntil: 0 };
  let pointer = null;
  let sample = null;

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    setupCoinStudio(scene, renderer);
    available = true;
    layer.dataset.status = 'ready';
  } catch {
    layer.dataset.status = 'fallback';
    canvas.hidden = true;
  }

  function schedule() {
    if (!request && !document.hidden) request = requestAnimationFrame(frame);
  }

  function documentCenter(element) {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 + window.scrollY };
  }

  function measure() {
    const storyRect = story.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const heroEnd = storyRect.top + window.scrollY;
    const budgetRect = budgetDock.getBoundingClientRect();
    const scratchRect = scratchDock.getBoundingClientRect();
    geometry = {
      viewportHeight: window.innerHeight,
      heroEnd,
      storyExit: heroEnd + storyRect.height - pinRect.height,
      budgetTop: budget.getBoundingClientRect().top + window.scrollY,
      newsletterTop: newsletter.getBoundingClientRect().top + window.scrollY,
      heroDiameter: heroSize.getBoundingClientRect().width,
      story: { x: slotRect.left + slotRect.width / 2, y: heroEnd + slotRect.top - pinRect.top + slotRect.height / 2, diameter: slotRect.width * 84 / 94 },
      budget: { ...documentCenter(budgetDock), diameter: budgetRect.width * COIN_DIAMETER_PX / 640 },
      newsletter: { ...documentCenter(scratchDock), diameter: scratchRect.width * 185 / 200 },
    };
    if (document.documentElement.clientWidth <= 900) {
      // The mobile budget is a tall column. Land when its coin slot reaches
      // the viewport center, then depart while it is still visible.
      geometry.budgetDock = Math.max(geometry.storyExit + 1, geometry.budget.y - innerHeight * 0.5);
      geometry.newsletterDeparture = Math.min(geometry.newsletterTop - 1, Math.max(
        geometry.budgetDock + innerHeight * 0.3,
        Math.min(geometry.newsletterTop - innerHeight * 0.85, geometry.budget.y - innerHeight * 0.2),
      ));
    }
  }

  function resize() {
    measure();
    boxSize = Math.ceil(Math.max(geometry.heroDiameter, geometry.budget.diameter, geometry.newsletter.diameter) * 1.16);
    layer.style.width = `${boxSize}px`;
    layer.style.height = `${boxSize}px`;
    camera.left = -boxSize / (2 * WORLD_UNIT_PX);
    camera.right = -camera.left;
    camera.top = camera.right;
    camera.bottom = camera.left;
    camera.updateProjectionMatrix();
    if (available) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(boxSize, boxSize, false);
    }
    schedule();
  }

  function select() {
    capture = hero?.takeNearest();
    if (!capture) {
      const mesh = createCoin(1, createGlassMaterial(1));
      capture = { mesh, name: coinNames[1], x: document.documentElement.clientWidth / 2, y: innerHeight * 0.27, diameter: geometry.heroDiameter, pose: { x: 0.22, y: -0.3, z: -0.26 } };
    }
    capture.width = document.documentElement.clientWidth;
    capture.height = innerHeight;
    scene.add(capture.mesh);
    capture.mesh.position.set(0, 0, 0);
    layer.dataset.coin = capture.name;
    slot.dataset.coin = capture.name;
    budgetDock.dataset.coin = capture.name;
    tool.dataset.coin = capture.name;
  }

  function restore() {
    if (!capture) return;
    scene.remove(capture.mesh);
    hero?.restore();
    capture = null;
    autoTurn = 0;
    manual.x = manual.y = manual.vx = manual.vy = 0;
    burstElapsed = 1.6;
  }

  function endBudgetDrag(event, cancelled = false) {
    if (pointer === null || event.pointerId !== pointer) return;
    const id = pointer;
    pointer = null;
    sample = null;
    if (cancelled) manual.vx = manual.vy = 0;
    if (budgetInput.hasPointerCapture(id)) budgetInput.releasePointerCapture(id);
    budgetDock.dataset.dragging = 'false';
    budgetInput.style.cursor = 'default';
    schedule();
  }

  function canUseBudget() { return route.phase === 'budget' && !document.hidden; }
  function hitsBudget(event) {
    return Math.hypot(event.clientX - route.x, event.clientY - route.y) < route.diameter / 2;
  }
  budgetInput.addEventListener('pointerdown', event => {
    if (!canUseBudget() || event.button !== 0 || pointer !== null || !hitsBudget(event)) return;
    pointer = event.pointerId;
    budgetInput.setPointerCapture(pointer);
    manual.vx = manual.vy = 0;
    sample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    budgetInput.style.cursor = 'grabbing';
    budgetDock.dataset.dragging = 'true';
    schedule();
  });
  budgetInput.addEventListener('pointermove', event => {
    if (!canUseBudget() || pointer !== null && event.pointerId !== pointer) return;
    const over = pointer !== null || hitsBudget(event);
    if (over && sample) {
      const dt = Math.max((event.timeStamp - sample.time) / 1000, 0.008);
      const sensitivity = (pointer === null ? 0.9 : 2.5) / route.diameter;
      const dx = (event.clientX - sample.x) * sensitivity;
      const dy = -(event.clientY - sample.y) * sensitivity;
      manual.x += dy;
      manual.y += dx;
      const blend = pointer === null ? 0.22 : 0.5;
      const limit = pointer === null ? 3 : 6;
      manual.vx += (THREE.MathUtils.clamp(dy / dt, -limit, limit) - manual.vx) * blend;
      manual.vy += (THREE.MathUtils.clamp(dx / dt, -limit, limit) - manual.vy) * blend;
      schedule();
    }
    budgetInput.style.cursor = pointer !== null ? 'grabbing' : over ? 'grab' : 'default';
    sample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  });
  budgetInput.addEventListener('pointerup', event => endBudgetDrag(event));
  budgetInput.addEventListener('pointercancel', event => endBudgetDrag(event, true));
  budgetInput.addEventListener('lostpointercapture', event => endBudgetDrag(event, true));
  budgetInput.addEventListener('pointerleave', () => { if (pointer === null) sample = null; });

  function frame(time) {
    request = 0;
    if (document.hidden) return;
    const scroll = Math.max(0, window.scrollY);
    if (scroll <= 0.5) {
      restore();
      route = { phase: 'hero' };
      layer.hidden = true;
      layer.dataset.phase = 'hero';
      previousTime = 0;
      return;
    }
    if (!capture) select();
    const source = hero?.getSource() || { x: capture.x / capture.width * document.documentElement.clientWidth, y: capture.y / capture.height * innerHeight, diameter: geometry.heroDiameter };
    const next = evaluateTravel(scroll, geometry, source);
    if (next.phase !== 'newsletter') newsletterControl?.cancelDrag();
    if (next.phase !== 'budget' && pointer !== null) endBudgetDrag({ pointerId: pointer }, true);
    route = next;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    const showing = route.y + route.diameter / 2 > 0 && route.y - route.diameter / 2 < innerHeight;
    let animate = false;
    if (!motion.matches && showing) {
      if (route.phase === 'story' && storyActive) {
        const step = Math.min(delta, 1.6 - burstElapsed);
        const before = burstEase(burstElapsed / 1.6);
        burstElapsed += step;
        autoTurn += TAU * (burstEase(burstElapsed / 1.6) - before) + (delta - step) * TAU / 48;
        animate = true;
      } else if (route.phase === 'budget') {
        autoTurn += delta * TAU / 48;
        animate = true;
      }
    }
    if (route.phase !== 'budget') manual.vx = manual.vy = 0;
    if (route.phase === 'budget' && pointer === null && Math.hypot(manual.vx, manual.vy) > 0.002) {
      manual.x += manual.vx * delta;
      manual.y += manual.vy * delta;
      manual.vx *= Math.exp(-3.2 * delta);
      manual.vy *= Math.exp(-3.2 * delta);
      animate = true;
    }
    const contactBlend = motion.matches ? 1 : 1 - Math.exp(-15 * (delta || 1 / 60));
    scratch.x += (scratch.targetX - scratch.x) * contactBlend;
    scratch.y += (scratch.targetY - scratch.y) * contactBlend;
    const departure = route.phase === 'hero-to-story' ? smooth(route.progress) : 1;
    let rx = lerp(capture.pose.x, 0.3, departure);
    let rz = lerp(capture.pose.z, -0.12, departure);
    const second = route.phase === 'story-to-budget' ? smooth(route.progress) : ['budget', 'budget-to-newsletter', 'newsletter'].includes(route.phase) ? 1 : 0;
    rx = lerp(rx, 0.12, second);
    rz = lerp(rz, -0.08, second);
    const final = route.phase === 'budget-to-newsletter' ? smooth(route.progress) : route.phase === 'newsletter' ? 1 : 0;
    rx = lerp(rx, 0.5, final) + manual.x * second * (1 - final);
    rz = lerp(rz, -0.45, final);
    let ry = capture.pose.y + (motion.matches ? 0 : route.turn) + autoTurn * departure + manual.y * second;
    // Ease into the familiar scratch pose, choosing the nearest equivalent
    // angle so the arrival does not suddenly flip or inherit a manual tilt.
    const finalYaw = capture.pose.y + (motion.matches ? 0 : TAU * 3) + autoTurn + manual.y;
    const yawCorrection = Math.atan2(Math.sin(-0.3 - finalYaw), Math.cos(-0.3 - finalYaw));
    ry += yawCorrection * final;
    if (route.phase === 'newsletter') {
      const rect = tool.getBoundingClientRect();
      route.x = rect.left + rect.width / 2;
      route.y = rect.top + rect.height / 2;
      rx += scratch.y * 0.23 - (scratch.active ? 0.12 : 0);
      ry += scratch.x * 0.27;
      rz += scratch.x * 0.12 - (scratch.active ? 0.08 : 0);
      animate ||= scratch.active || time < scratch.settlingUntil;
    }
    capture.mesh.rotation.set(rx, ry, rz);
    capture.mesh.scale.setScalar(route.diameter / (2 * 1.065 * WORLD_UNIT_PX));
    layer.style.transform = `translate3d(${route.x - boxSize / 2}px, ${route.y - boxSize / 2}px, 0)`;
    layer.hidden = !showing;
    if (available && showing) renderer.render(scene, camera);
    if (!available) {
      layer.style.setProperty('--fallback-diameter', `${route.diameter}px`);
      layer.style.setProperty('--fallback-turn', `${ry}rad`);
    }
    layer.dataset.phase = route.phase;
    layer.dataset.progress = route.progress.toFixed(4);
    layer.dataset.position = JSON.stringify({ x: +route.x.toFixed(2), y: +route.y.toFixed(2), diameter: +route.diameter.toFixed(2) });
    layer.dataset.rotation = JSON.stringify({ x: +rx.toFixed(4), y: +ry.toFixed(4), z: +rz.toFixed(4) });
    slot.dataset.rotation = layer.dataset.rotation;
    slot.dataset.animating = String(route.phase === 'story' && storyActive && !motion.matches);
    budgetDock.dataset.rotation = layer.dataset.rotation;
    budgetDock.dataset.animating = String(route.phase === 'budget' && animate);
    budgetDock.dataset.status = available ? 'ready' : 'fallback';
    tool.dataset.status = available ? 'ready' : 'fallback';
    tool.dataset.rotation = layer.dataset.rotation;
    tool.dataset.arrived = String(route.phase === 'newsletter');
    if (animate) schedule();
    else previousTime = 0;
  }

  const scratchCoin = {
    resize: schedule,
    setPosition({ x = 0, y = 0 } = {}) { scratch.targetX = x; scratch.targetY = y; scratch.settlingUntil = performance.now() + 600; schedule(); },
    setScratching(active) { scratch.active = active; scratch.settlingUntil = performance.now() + 600; schedule(); },
    setVisible() {},
  };
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    previousTime = 0;
    if (document.hidden) {
      cancelAnimationFrame(request); request = 0;
      newsletterControl?.cancelDrag();
      if (pointer !== null) endBudgetDrag({ pointerId: pointer }, true);
    } else schedule();
  });
  motion.addEventListener('change', schedule);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); available = false; layer.dataset.status = 'fallback'; canvas.hidden = true; schedule(); });
  canvas.addEventListener('webglcontextrestored', () => window.location.reload());
  new ResizeObserver(resize).observe(story.querySelector('.story-content'));
  document.fonts.ready.then(resize);
  resize();
  return {
    resize,
    scratchCoin,
    canScratch: () => route.phase === 'newsletter',
    connectNewsletter(control) { newsletterControl = control; resize(); },
    setStoryActivity(active) { const next = Boolean(active[0]); if (next && !storyActive) burstElapsed = 0; storyActive = next; schedule(); },
  };
}
