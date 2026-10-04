import test from 'node:test';
import assert from 'node:assert/strict';
import { storyProgress, tokenReveal, coinIsRevealed } from '../src/story-progress.js';

test('reading stays dark before the pinned section and finishes before the budget', () => {
  assert.equal(storyProgress(1080, 2592, 1080), 0);
  assert.equal(storyProgress(0, 2592, 1080), 0);
  assert.equal(storyProgress(-756, 2592, 1080), 0.5);
  assert.equal(storyProgress(-1512, 2592, 1080), 1);
  assert.equal(storyProgress(-2000, 2592, 1080), 1);
});

test('the reveal advances through the paragraph in reading order', () => {
  assert.equal(tokenReveal(0.405, 39, 100), 1);
  assert.ok(Math.abs(tokenReveal(0.405, 40, 100) - 0.5) < 1e-10);
  assert.equal(tokenReveal(0.405, 41, 100), 0);
});

test('a coin waits until its own position is fully revealed, then pauses on reverse scroll', () => {
  for (const index of [27, 54]) {
    const threshold = (index + 1) / 80;
    assert.equal(coinIsRevealed(threshold - 0.000001, index, 80), false);
    assert.equal(coinIsRevealed(threshold, index, 80), true);
    assert.equal(coinIsRevealed(1, index, 80), true);
    assert.equal(coinIsRevealed(threshold - 0.000001, index, 80), false);
  }
});
