import { startScratchCoin } from './scratch-coin.js';
import { ScratchCoverage } from './scratch-coverage.js';

const WIDTH = 1034;
const HEIGHT = 220;
const BRUSH_RADIUS = 18;
const MOBILE_BREAKPOINT = '(max-width: 900px)';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const noise = seed => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** Scrape a real canvas coating, using either its own coin or the shared traveler. */
export function startNewsletter({ coin: externalCoin, canInteract = () => true } = {}) {
  const section = document.querySelector('#newsletter');
  const stage = section.querySelector('.stage');
  const card = section.querySelector('.scratch-card');
  const layer = section.querySelector('#scratch-layer');
  const tool = section.querySelector('.scratch-coin');
  const form = section.querySelector('form');
  const input = section.querySelector('input');
  const status = section.querySelector('#newsletter-status');
  const ctx = layer.getContext('2d');
  const coin = externalCoin || startScratchCoin();
  let coverage = new ScratchCoverage(WIDTH, HEIGHT, { threshold: 0.72 });
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia(MOBILE_BREAKPOINT);
  const strokes = [];
  let revealed = false;
  let visible = false;
  let dragging = null;
  let previousScratch = null;
  let request = 0;
  let lastFrame = 0;
  let scale = 1;
  let maskOrigin = { x: 0, y: 0 };
  let maskSize = { width: WIDTH, height: HEIGHT };
  let brushRadius = BRUSH_RADIUS;
  let toolSize = { width: 200, height: 200 };
  let current = { x: 1568, y: 818 };
  let target = { ...current };
  let idle = { ...current };

  function placeCoin() {
    tool.style.transform = `translate3d(${current.x - toolSize.width / 2}px, ${current.y - toolSize.height / 2}px, 0)`;
  }

  function strokeInMask(stroke) {
    return {
      from: { x: stroke.from.x * maskSize.width, y: stroke.from.y * maskSize.height },
      to: { x: stroke.to.x * maskSize.width, y: stroke.to.y * maskSize.height },
      radius: stroke.radius * maskSize.height,
    };
  }

  function eraseStroke(stroke) {
    if (!ctx) return;
    const { from, to, radius } = strokeInMask(stroke);
    const seed = stroke.seed;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const normal = length ? { x: -dy / length, y: dx / length } : { x: 0, y: 1 };
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = radius * 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    const steps = Math.max(1, Math.ceil(length / 4));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const n = seed + step * 7;
      ctx.beginPath();
      ctx.arc(x, y, radius * (0.72 + noise(n) * 0.36), 0, Math.PI * 2);
      ctx.fill();
      for (const side of [-1, 1]) {
        const offset = side * (radius + 3 + noise(n + side) * 6);
        const size = 1 + noise(n + 23) * 3;
        ctx.fillRect(x + normal.x * offset, y + normal.y * offset, size, size);
      }
    }
    ctx.restore();
  }

  function paintCoating() {
    if (!ctx) return;
    const { width, height } = maskSize;
    const density = Math.min(window.devicePixelRatio || 1, 1.75) * scale;
    layer.width = Math.max(1, Math.round(width * density));
    layer.height = Math.max(1, Math.round(height * density));
    ctx.setTransform(layer.width / width, 0, 0, layer.height / height, 0, 0);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1b1b1b');
    gradient.addColorStop(1, '#2d2d2c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const grainCount = Math.round(2600 * width * height / (WIDTH * HEIGHT));
    for (let i = 0; i < grainCount; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff05' : '#0000000a';
      ctx.fillRect(noise(i + 10) * width, noise(i + 8100) * height, 1, 1);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleSize = Math.min(58, Math.max(28, width * 0.1));
    ctx.font = `italic ${titleSize}px 'Instrument Serif'`;
    ctx.fillStyle = '#797975';
    ctx.fillText('Scratch to subscribe', width / 2, height / 2 - 9);
    ctx.font = `${mobile.matches ? 11 : 12}px 'Manrope'`;
    ctx.fillStyle = '#94948e';
    ctx.fillText(mobile.matches ? 'Slide the coin across the layer' : 'Drag the coin across the layer', width / 2, height / 2 + titleSize / 2 + 12);
    strokes.forEach(eraseStroke);
  }

  function scratchAt(point) {
    const next = {
      x: (point.x - maskOrigin.x) / maskSize.width,
      y: (point.y - maskOrigin.y) / maskSize.height,
    };
    if (previousScratch) {
      if (Math.hypot((next.x - previousScratch.x) * maskSize.width, (next.y - previousScratch.y) * maskSize.height) < 0.4) return;
      const stroke = { from: previousScratch, to: next, radius: brushRadius / maskSize.height, seed: strokes.length * 31 };
      const { from, to, radius } = strokeInMask(stroke);
      const intersects = Math.max(from.x, to.x) >= -radius &&
        Math.min(from.x, to.x) <= maskSize.width + radius &&
        Math.max(from.y, to.y) >= -radius &&
        Math.min(from.y, to.y) <= maskSize.height + radius;
      if (intersects) {
        strokes.push(stroke);
        eraseStroke(stroke);
        coverage.erase(from, to, radius);
        card.dataset.progress = coverage.progress.toFixed(4);
      }
    }
    previousScratch = next;
  }

  function schedule() {
    if (visible && !document.hidden && !request) request = requestAnimationFrame(frame);
  }

  function frame(time) {
    request = 0;
    if (dragging !== null && !canInteract()) cancelDrag();
    const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.05) : 1 / 60;
    lastFrame = time;
    const blend = motion.matches ? 1 : 1 - Math.exp(-22 * delta);
    current.x += (target.x - current.x) * blend;
    current.y += (target.y - current.y) * blend;
    placeCoin();
    if (dragging !== null && !revealed) scratchAt(current);
    if (Math.hypot(target.x - current.x, target.y - current.y) > 0.1) schedule();
    else lastFrame = 0;
  }

  function pointAt(event) {
    const rect = stage.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  }

  function reveal(focus = true) {
    if (revealed || !canInteract()) return;
    revealed = true;
    card.dataset.revealed = 'true';
    form.removeAttribute('inert');
    tool.setAttribute('aria-label', 'Newsletter sign-up is revealed');
    if (focus) input.focus({ preventScroll: true });
  }

  function startDrag(event) {
    if (revealed || dragging !== null || event.button !== 0 || !canInteract()) return;
    event.preventDefault();
    dragging = event.pointerId;
    previousScratch = null;
    target = pointAt(event);
    if (event.currentTarget === card) current = { ...target };
    section.setPointerCapture(event.pointerId);
    tool.dataset.scratching = 'true';
    card.dataset.scratching = 'true';
    coin.setScratching(true);
    scratchAt(current);
    schedule();
  }

  tool.addEventListener('pointerdown', startDrag);
  card.addEventListener('pointerdown', startDrag);
  section.addEventListener('pointermove', event => {
    if (event.pointerId !== dragging) return;
    if (!canInteract()) { cancelDrag(); return; }
    const next = pointAt(event);
    const dx = next.x - target.x;
    const dy = next.y - target.y;
    target = next;
    coin.setPosition({ x: clamp(dx / 30, -1, 1), y: clamp(dy / 30, -1, 1) });
    schedule();
  });

  function endDrag(event, cancelled = false) {
    if (event.pointerId !== dragging) return;
    cancelled ||= !canInteract();
    if (!cancelled) scratchAt(target);
    const pointerId = dragging;
    dragging = null;
    previousScratch = null;
    tool.dataset.scratching = 'false';
    card.dataset.scratching = 'false';
    coin.setScratching(false);
    coin.setPosition({ x: 0, y: 0 });
    if (section.hasPointerCapture(pointerId)) section.releasePointerCapture(pointerId);
    if (!cancelled && coverage.complete) reveal();
    target = { ...idle };
    schedule();
  }

  function cancelDrag() {
    if (dragging === null) return;
    endDrag({ pointerId: dragging }, true);
    // Keep the dock stable when the shared coin leaves for another section.
    current = { ...idle };
    target = { ...idle };
    placeCoin();
  }
  section.addEventListener('pointerup', endDrag);
  section.addEventListener('pointercancel', event => endDrag(event, true));
  section.addEventListener('lostpointercapture', event => endDrag(event, true));
  tool.addEventListener('click', event => {
    // Keyboard activation skips dragging; a pointer click simply picks up the coin.
    if (event.detail === 0 && canInteract()) reveal();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    // The visual sign-up is ready for a mailing provider; no address is sent or stored.
    status.textContent = 'Sign-ups open soon. Your email hasn’t been sent yet.';
  });

  function resize() {
    if (dragging !== null) endDrag({ pointerId: dragging }, true);
    scale = Number(stage.dataset.scale) || 1;
    const stageRect = stage.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const toolRect = tool.getBoundingClientRect();
    maskOrigin = { x: (cardRect.left - stageRect.left) / scale, y: (cardRect.top - stageRect.top) / scale };
    maskSize = { width: Math.max(1, cardRect.width / scale), height: Math.max(1, cardRect.height / scale) };
    toolSize = { width: toolRect.width / scale || 200, height: toolRect.height / scale || 200 };
    brushRadius = mobile.matches ? Math.max(12 / scale, toolSize.width * 0.09) : BRUSH_RADIUS;
    const dock = section.querySelector('.scratch-dock');
    const dockRect = dock?.getBoundingClientRect();
    idle = dockRect?.width && dockRect.height ? {
      x: (dockRect.left - stageRect.left + dockRect.width / 2) / scale,
      y: (dockRect.top - stageRect.top + dockRect.height / 2) / scale,
    } : { x: stageRect.width / scale * 0.817, y: stageRect.height / scale * 0.758 };
    coverage = new ScratchCoverage(maskSize.width, maskSize.height, { threshold: 0.72 });
    // Unit coordinates keep every scraped trail in place across rotation and resize.
    for (const stroke of strokes) {
      const { from, to, radius } = strokeInMask(stroke);
      coverage.erase(from, to, radius);
    }
    card.dataset.progress = coverage.progress.toFixed(4);
    if (dragging === null) { current = { ...idle }; target = { ...idle }; }
    placeCoin();
    paintCoating();
    coin.resize();
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio > 0;
    coin.setVisible(visible);
    if (!visible && dragging !== null) endDrag({ pointerId: dragging }, true);
    if (!visible) { cancelAnimationFrame(request); request = 0; lastFrame = 0; }
    else schedule();
  }, { threshold: [0, 0.001] });
  observer.observe(section);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dragging !== null) endDrag({ pointerId: dragging }, true);
    if (document.hidden) { cancelAnimationFrame(request); request = 0; lastFrame = 0; }
    else schedule();
  });
  document.fonts.ready.then(resize);
  resize();
  resize.cancelDrag = cancelDrag;
  resize.tool = tool;
  return resize;
}
