import test from 'node:test';
import assert from 'node:assert/strict';
import { CoinPhysics } from '../src/physics.js';

const bounds = { left: -9, right: 9, bottom: -2.4, top: 2.4 };
const coin = (x, y = 0, radius = 1) => ({ x, y, radius, homeY: y, vx: 0, phase: 0, spinX: 0, spinY: 0, rx: 0, ry: 0, rz: 0, passes: 0 });
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const advance = (physics, seconds, animate = true) => {
  for (let i = 0; i < Math.round(seconds * 120); i++) physics.step(1 / 120, animate);
};

test('hover motion rotates the selected coin without translating it', () => {
  const a = coin(2, 0.4);
  const physics = new CoinPhysics([a], bounds);
  physics.rotate(a, 0.6, -0.4, 0.05);
  assert.ok(a.rx > 0 && a.ry > 0);
  assert.equal(a.x, 2);
  assert.equal(a.y, 0.4);
});

test('a held coin continues along its path during large vertical and horizontal drags', () => {
  const a = coin(3);
  const baseline = coin(3);
  const physics = new CoinPhysics([a], bounds, { flowSpeed: -0.8 });
  const control = new CoinPhysics([baseline], bounds, { flowSpeed: -0.8 });
  physics.grab(a);
  for (let i = 0; i < 600; i++) {
    physics.rotate(a, Math.sin(i) * 20, Math.cos(i) * 20, 1 / 120);
    physics.step(1 / 120);
    control.step(1 / 120);
    close(a.x, baseline.x);
    close(a.y, baseline.y);
    close(a.vx, baseline.vx);
  }
  assert.ok(Math.abs(a.rx - baseline.rx) + Math.abs(a.ry - baseline.ry) > 0.1);
});

test('interaction does not change any neighboring position or rotation', () => {
  const bodies = [-6, -2, 2, 6].map(x => coin(x));
  const controls = bodies.map(b => ({ ...b }));
  const physics = new CoinPhysics(bodies, bounds, { flowSpeed: -0.8 });
  const control = new CoinPhysics(controls, bounds, { flowSpeed: -0.8 });
  physics.grab(bodies[1]);
  for (let i = 0; i < 1200; i++) {
    physics.rotate(bodies[1], 0.03, -0.02, 1 / 120);
    physics.step(1 / 120);
    control.step(1 / 120);
    for (const j of [0, 2, 3]) assert.deepEqual(bodies[j], controls[j]);
  }
});

test('release keeps angular inertia and damps it without adding a throw', () => {
  const a = coin(0);
  const physics = new CoinPhysics([a], bounds);
  physics.grab(a);
  physics.rotate(a, 0.4, -0.3, 0.04);
  const before = { rx: a.rx, ry: a.ry, spin: Math.hypot(a.spinX, a.spinY) };
  physics.release();
  advance(physics, 1, false);
  assert.ok(a.rx > before.rx && a.ry > before.ry);
  assert.ok(Math.hypot(a.spinX, a.spinY) < before.spin * 0.05);
  assert.equal(a.x, 0);
  assert.equal(a.y, 0);
});

test('cancelled interactions clear residual rotation', () => {
  const a = coin(0);
  const physics = new CoinPhysics([a], bounds);
  physics.grab(a);
  physics.rotate(a, 1, 1, 0.02);
  physics.release(true);
  assert.equal(physics.dragged, null);
  assert.equal(a.spinX, 0);
  assert.equal(a.spinY, 0);
});

test('an autonomous edge-to-edge pass makes one complete 3D turn', () => {
  const a = coin(4);
  const physics = new CoinPhysics([a], bounds, { flowSpeed: -bounds.right * 2 / 28 });
  advance(physics, 28);
  close(a.ry, Math.PI * 2);
  assert.equal(a.passes, 1);
});

test('coins wrap fully outside the canvas, preserving overshoot and direction', () => {
  const a = coin(bounds.left - 0.5);
  const physics = new CoinPhysics([a], bounds, { flowSpeed: -0.8 });
  physics.contain(a);
  assert.equal(a.x, bounds.left - 0.5);
  assert.equal(a.passes, 0);
  a.x = physics.loopStart - 0.15;
  physics.contain(a);
  close(a.x, physics.loopEnd - 0.15);
  assert.equal(a.passes, 1);
  physics.step(1 / 120);
  close(a.vx, -0.8);
});

test('differently sized coins retain constant spacing through repeated loops', () => {
  const radii = [1.49, 1.4, 1.62, 1.49, 1.44, 1.33];
  const padding = Math.max(...radii) + 0.1;
  const span = bounds.right - bounds.left + 2 * padding;
  const gap = span / radii.length;
  const bodies = radii.map((radius, i) => coin(bounds.left - padding + (i + 0.5) * gap, i % 2 ? 0.5 : -0.2, radius));
  const physics = new CoinPhysics(bodies, bounds, { flowSpeed: -0.8 });
  for (let i = 0; i < 14400; i++) {
    physics.step(1 / 120);
    for (let j = 0; j < bodies.length; j++) {
      const b = bodies[j];
      const next = bodies[(j + 1) % bodies.length];
      close(((next.x - b.x) % span + span) % span, gap);
      assert.ok(b.y - b.radius >= bounds.bottom - 1e-8);
      assert.ok(b.y + b.radius <= bounds.top + 1e-8);
      assert.ok([b.x, b.y, b.rx, b.ry, b.rz].every(Number.isFinite));
    }
  }
  assert.ok(bodies.every(b => b.passes >= 4));
});

test('reduced motion freezes the autonomous path but permits deliberate rotation', () => {
  const a = coin(3, 0.5);
  const physics = new CoinPhysics([a], bounds, { flowSpeed: -1 });
  advance(physics, 1, false);
  assert.deepEqual({ x: a.x, y: a.y, ry: a.ry }, { x: 3, y: 0.5, ry: 0 });
  physics.rotate(a, 0.4, 0, 0.04);
  advance(physics, 1, false);
  assert.ok(a.ry > 0);
  assert.equal(a.x, 3);
  assert.equal(a.y, 0.5);
});

test('resizing preserves loop phase, coin size, and relative vertical placement', () => {
  const a = coin(4, 0.4, 1.3);
  const physics = new CoinPhysics([a], bounds, { flowSpeed: -1 });
  const phase = (a.x - physics.loopStart) / (physics.loopEnd - physics.loopStart);
  physics.resizeBounds({ left: -18, right: 18, bottom: -4.8, top: 4.8 });
  close((a.x - physics.loopStart) / (physics.loopEnd - physics.loopStart), phase);
  close(a.homeY, 0.8);
  assert.equal(a.radius, 1.3);
});

test('desktop-to-mobile resizing updates coin bounds while preserving the shared path', () => {
  const desktop = { left: -9.6, right: 9.6, bottom: -4, top: 4 };
  const mobile = { left: -1.95, right: 1.95, bottom: -2, top: 2 };
  const bodies = Array.from({ length: 6 }, (_, i) => ({ ...coin(0, (i % 2 ? 1 : -1) * 0.4, 3), visualRadius: 3.03 }));
  const physics = new CoinPhysics(bodies, desktop, { flowSpeed: -0.2 });
  const oldSpan = physics.loopEnd - physics.loopStart;
  bodies.forEach((body, i) => { body.x = physics.loopStart + (i + 0.5) / bodies.length * oldSpan; });
  advance(physics, 8);
  const phases = bodies.map(body => (body.x - physics.loopStart) / oldSpan);
  const oldHeights = bodies.map(body => ({ homeY: body.homeY, y: body.y }));

  physics.resizeBounds(mobile, { radius: 1.4, visualRadius: 1.42 });
  const newSpan = physics.loopEnd - physics.loopStart;
  assert.ok(newSpan < oldSpan);
  close(physics.margin, 1.52);
  close(physics.minSpacing, 3.14);
  bodies.forEach((body, i) => {
    assert.equal(body.radius, 1.4);
    assert.equal(body.visualRadius, 1.42);
    close((body.x - physics.loopStart) / newSpan, phases[i]);
    close(body.homeY, oldHeights[i].homeY / 2);
    close(body.y, oldHeights[i].y / 2);
  });
  for (let i = 0; i < 7200; i++) {
    physics.step(1 / 120);
    bodies.forEach((body, j) => {
      const next = bodies[(j + 1) % bodies.length];
      close(((next.x - body.x) % newSpan + newSpan) % newSpan, newSpan / bodies.length);
      assert.ok(body.y - body.visualRadius >= mobile.bottom - 1e-8);
      assert.ok(body.y + body.visualRadius <= mobile.top + 1e-8);
    });
  }
});

test('responsive resizing clamps a coin to the new vertical bounds', () => {
  const body = { ...coin(3, 2, 1), visualRadius: 1.1 };
  const physics = new CoinPhysics([body], { ...bounds, bottom: -4, top: 4 });
  physics.resizeBounds({ ...bounds, bottom: -1.8, top: 1.8 }, { radius: 1.4, visualRadius: 1.5 });
  close(body.homeY, 0.9);
  close(body.y, 0.3);
});
