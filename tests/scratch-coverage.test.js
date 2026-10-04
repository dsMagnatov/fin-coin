import test from 'node:test';
import assert from 'node:assert/strict';
import { ScratchCoverage } from '../src/scratch-coverage.js';

const createCoverage = () => new ScratchCoverage(100, 40, {
  columns: 100,
  rows: 40,
  threshold: 0.4,
});

test('revisiting the same patch does not inflate scratched area', () => {
  const coverage = createCoverage();
  const point = { x: 20, y: 20 };
  const progress = coverage.erase(point, point, 5);
  assert.ok(progress > 0 && progress < 0.05);

  for (let repeat = 0; repeat < 100; repeat += 1) {
    assert.equal(coverage.erase(point, point, 5), progress);
  }
  assert.equal(coverage.complete, false);
});

test('a long pointer segment scratches the middle and both round ends', () => {
  const coverage = createCoverage();
  const progress = coverage.erase({ x: 10, y: 20 }, { x: 90, y: 20 }, 5);
  assert.ok(progress > 0.2 && progress < 0.25);
  assert.equal(coverage.erase({ x: 50, y: 20 }, { x: 50, y: 20 }, 5), progress);
  assert.equal(coverage.erase({ x: 10, y: 20 }, { x: 10, y: 20 }, 5), progress);
  assert.equal(coverage.erase({ x: 90, y: 20 }, { x: 90, y: 20 }, 5), progress);
});

test('strokes and brushes outside the card contribute no scratched area', () => {
  const coverage = createCoverage();
  coverage.erase({ x: -50, y: -50 }, { x: -10, y: -10 }, 5);
  coverage.erase({ x: 110, y: 5 }, { x: 140, y: 35 }, 5);
  coverage.erase({ x: 0, y: 50 }, { x: 100, y: 50 }, 5);
  assert.equal(coverage.progress, 0);
  assert.equal(coverage.complete, false);
});

test('sweeps reach the reveal threshold independently of pointer event density', () => {
  const sparse = createCoverage();
  const dense = createCoverage();

  for (const y of [8, 20, 32]) {
    sparse.erase({ x: 0, y }, { x: 100, y }, 6.25);
    for (let x = 0; x < 100; x += 2) {
      dense.erase({ x, y }, { x: x + 2, y }, 6.25);
    }
    assert.equal(sparse.progress, dense.progress);
    assert.equal(sparse.complete, dense.complete);
    assert.equal(sparse.complete, y >= 20);
  }
  assert.ok(sparse.progress >= 0.9 && sparse.progress <= 1);
});

test('reset clears coverage and lets a new scratch reveal the card again', () => {
  const coverage = createCoverage();
  coverage.erase({ x: 0, y: 20 }, { x: 100, y: 20 }, 50);
  assert.equal(coverage.progress, 1);
  assert.equal(coverage.complete, true);
  assert.equal(coverage.reset(), 0);
  assert.equal(coverage.complete, false);
  assert.ok(coverage.erase({ x: 10, y: 10 }, { x: 90, y: 10 }, 5) > 0);
});

test('invalid dimensions, grid sizes, and reveal thresholds are rejected', () => {
  for (const dimension of [0, -1, Infinity, NaN, '100']) {
    assert.throws(() => new ScratchCoverage(dimension, 40), RangeError);
    assert.throws(() => new ScratchCoverage(100, dimension), RangeError);
  }
  for (const count of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => new ScratchCoverage(100, 40, { columns: count }), RangeError);
    assert.throws(() => new ScratchCoverage(100, 40, { rows: count }), RangeError);
  }
  for (const threshold of [0, -0.2, 1.01, Infinity, NaN]) {
    assert.throws(() => new ScratchCoverage(100, 40, { threshold }), RangeError);
  }
});

test('malformed strokes are ignored without losing existing coverage', () => {
  const coverage = createCoverage();
  const point = { x: 20, y: 20 };
  const progress = coverage.erase(point, point, 5);
  for (const invalidPoint of [null, undefined, {}, { x: NaN, y: 0 }, { x: 0, y: Infinity }]) {
    assert.equal(coverage.erase(invalidPoint, point, 5), progress);
    assert.equal(coverage.erase(point, invalidPoint, 5), progress);
  }
  for (const radius of [0, -1, Infinity, NaN, undefined]) {
    assert.equal(coverage.erase(point, point, radius), progress);
  }
});
